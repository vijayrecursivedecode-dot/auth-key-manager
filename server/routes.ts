import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID, createHash, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import sodium from "libsodium-wrappers";
import archiver from "archiver";
import path from "path";
import fs from "fs";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { storage } from "./storage";
import { users } from "@shared/models/auth";
import { licenses as licensesTable } from "@shared/schema";
import { db } from "./db";

let signingKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array; keyType: string };
let API_PUBLIC_KEY: string;
let sodiumReady = false;

async function initSodium() {
  await sodium.ready;
  const seed = createHash("sha256")
    .update(process.env.SESSION_SECRET || "keyvault-default-signing-seed")
    .digest();
  const seedBytes = new Uint8Array(seed.buffer, seed.byteOffset, 32);
  signingKeyPair = sodium.crypto_sign_seed_keypair(seedBytes);
  API_PUBLIC_KEY = sodium.to_hex(signingKeyPair.publicKey);
  sodiumReady = true;
  console.log("Ed25519 signing initialized. Public key:", API_PUBLIC_KEY);
}

initSodium();

function padOwnerId(id: string): string {
  return id.padStart(10, "0");
}

function unpadOwnerId(id: string): string {
  return id.replace(/^0+/, "") || id;
}

function signResponse(body: string): { signature: string; timestamp: string } {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const message = timestamp + body;
  const messageBytes = sodium.from_string(message);
  const sig = sodium.crypto_sign_detached(messageBytes, signingKeyPair.privateKey);
  return {
    signature: sodium.to_hex(sig),
    timestamp,
  };
}

function sendSignedJson(res: any, ownerid: string, data: any, hmacKey?: string) {
  const responseData = { ...data, ownerid };
  if (!("code" in responseData)) {
    responseData.code = data.success ? 68 : 0;
  } else if (typeof responseData.code === "string") {
    responseData.code = parseInt(responseData.code, 10) || 0;
  }

  const body = JSON.stringify(responseData);

  if (hmacKey) {
    const hmacSig = createHmac("sha256", hmacKey).update(body).digest("hex");
    res.set("signature", hmacSig);
  }

  const { signature, timestamp } = signResponse(body);
  res.set("x-signature-ed25519", signature);
  res.set("x-signature-timestamp", timestamp);
  return res.send(body);
}

interface ClientSession {
  sessionId: string;
  appId: string;
  userId?: string;
  validated: boolean;
  createdAt: number;
  hmacKey?: string;
}

const clientSessions = new Map<string, ClientSession>();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of clientSessions) {
    if (now - session.createdAt > 3600000) {
      clientSessions.delete(id);
    }
  }
}, 300000);

function registerClientApi(app: Express) {
  const corsHandler = (req: any, res: any) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    });
    res.sendStatus(204);
  };
  app.options("/api/1.2/", corsHandler);
  app.options("/api/1.3/", corsHandler);
  app.options("/api/1.2", corsHandler);
  app.options("/api/1.3", corsHandler);

  const handleClientRequest = async (req: any, res: any) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", "application/json");

    const params = { ...req.query, ...req.body };
    const { type } = params;
    const reqOwnerid = params.ownerid || "";

    console.log(`[CLIENT-API] ${req.method} ${req.path} type=${type} params=${JSON.stringify(params)}`);

    const getSessionHmacKey = (): string | undefined => {
      const sid = params.sessionid;
      if (sid) {
        const session = clientSessions.get(sid);
        if (session?.hmacKey) return session.hmacKey;
      }
      return undefined;
    };

    const sendRes = (data: any) => sendSignedJson(res, reqOwnerid, data, getSessionHmacKey());

    try {
      switch (type) {
        case "init": {
          const { name, ownerid, ver, secret, enckey } = params;
          if (!name || !ownerid) {
            return sendSignedJson(res, ownerid || "", { success: false, message: "Missing name or ownerid" });
          }
          let application = await storage.getApplicationByNameAndOwner(name, ownerid);
          if (!application) {
            const rawId = unpadOwnerId(ownerid);
            if (rawId !== ownerid) {
              application = await storage.getApplicationByNameAndOwner(name, rawId);
            }
          }
          if (!application) {
            const paddedId = padOwnerId(ownerid);
            if (paddedId !== ownerid) {
              application = await storage.getApplicationByNameAndOwner(name, paddedId);
            }
          }
          if (!application && ownerid.length === 10 && /^\d+$/.test(ownerid)) {
            const user = await storage.getUserByNumericId(ownerid);
            if (user) {
              application = await storage.getApplicationByNameAndOwner(name, user.id);
            }
          }
          if (!application) {
            return sendSignedJson(res, ownerid, { success: false, message: "Application not found. Check your application name and owner ID." });
          }
          const initHmacKeyEarly = enckey ? application.secret : undefined;
          if (secret && application.secret !== secret) {
            return sendSignedJson(res, ownerid, { success: false, message: "Invalid application secret." }, initHmacKeyEarly);
          }
          if (!application.enabled) {
            return sendSignedJson(res, ownerid, { success: false, message: "Application is disabled by the owner." }, initHmacKeyEarly);
          }
          if (ver && application.version && ver !== application.version) {
            return sendSignedJson(res, ownerid, { success: false, message: "invalidver", download: "" }, initHmacKeyEarly);
          }
          const hmacKey = enckey ? (enckey + "-" + application.secret) : undefined;
          const initHmacKey = enckey ? application.secret : undefined;
          const sessionId = randomUUID();
          clientSessions.set(sessionId, {
            sessionId,
            appId: application.id,
            validated: true,
            createdAt: Date.now(),
            hmacKey,
          });
          return sendSignedJson(res, ownerid, {
            success: true,
            message: "Initialized",
            sessionid: sessionId,
            newSession: true,
            appinfo: {
              numUsers: String((await storage.getAppUsersByApp(application.id)).length),
              numOnlineUsers: "0",
              numKeys: String((await storage.getLicensesByApp(application.id)).length),
              version: application.version,
              customerPanelLink: "",
              downloadLink: "",
            },
          }, initHmacKey);
        }

        case "login": {
          const { username, pass, hwid, sessionid, name: appName, ownerid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session. Please re-initialize." });
          }
          const application = await storage.getApplication(session.appId);
          if (!application || !application.enabled) {
            return sendRes({ success: false, message: "Application not found or disabled." });
          }
          const appUser = await storage.getAppUserByUsername(username, session.appId);
          if (!appUser) {
            return sendRes({ success: false, message: "Username not found." });
          }
          if (appUser.banned) {
            return sendRes({ success: false, message: "User is banned." });
          }
          if (appUser.password && appUser.password !== pass) {
            return sendRes({ success: false, message: "Incorrect password." });
          }
          if (appUser.expiresAt && new Date(appUser.expiresAt) < new Date()) {
            return sendRes({ success: false, message: "Subscription expired." });
          }
          const currentHwidList: string[] = (appUser as any).hwidList || [];
          const userMaxHwid = (appUser as any).maxHwid !== null && (appUser as any).maxHwid !== undefined ? (appUser as any).maxHwid : 1;
          if (hwid && userMaxHwid > 0) {
            if (!currentHwidList.includes(hwid) && currentHwidList.length >= userMaxHwid) {
              return sendRes({ success: false, message: `Device limit reached. Maximum ${userMaxHwid} device(s) allowed.` });
            }
          }
          if (application.hwidLock && appUser.hwid && hwid && appUser.hwid !== hwid) {
            return sendRes({ success: false, message: "HWID mismatch. This account is locked to a different device." });
          }
          const updateData: any = {
            lastLogin: new Date(),
            ip: req.ip || req.headers["x-forwarded-for"] || null,
          };
          if (hwid) {
            if (!appUser.hwid || !application.hwidLock) {
              updateData.hwid = hwid;
            }
            if (!currentHwidList.includes(hwid)) {
              updateData.hwidList = [...currentHwidList, hwid];
            }
          }
          await storage.updateAppUser(appUser.id, updateData);
          session.userId = appUser.id;
          return sendRes({
            success: true,
            message: "Logged in successfully.",
            info: {
              username: appUser.username,
              subscriptions: [{ subscription: String(appUser.level), expiry: appUser.expiresAt ? String(Math.floor(new Date(appUser.expiresAt).getTime() / 1000)) : "N/A" }],
              ip: updateData.ip,
              hwid: appUser.hwid || hwid || "",
              createdate: appUser.createdAt ? String(Math.floor(new Date(appUser.createdAt).getTime() / 1000)) : "",
              lastlogin: String(Math.floor(Date.now() / 1000)),
            },
          });
        }

        case "register": {
          const { username, pass, key, hwid, sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session. Please re-initialize." });
          }
          const application = await storage.getApplication(session.appId);
          if (!application || !application.enabled) {
            return sendRes({ success: false, message: "Application not found or disabled." });
          }
          const existingUser = await storage.getAppUserByUsername(username, session.appId);
          if (existingUser) {
            return sendRes({ success: false, message: "Username already taken." });
          }
          const license = await storage.getLicenseByKey(key, session.appId);
          if (!license) {
            return sendRes({ success: false, message: "Invalid license key." });
          }
          if (!license.enabled) {
            return sendRes({ success: false, message: "License key is disabled." });
          }
          if (license.maxUses && license.usedCount !== null && license.usedCount >= license.maxUses) {
            return sendRes({ success: false, message: "License key has reached maximum uses." });
          }
          let expiresAt: Date | null = null;
          if (license.duration) {
            expiresAt = new Date();
            const unit = license.durationUnit || "day";
            const dur = license.duration;
            if (unit === "hour") expiresAt.setHours(expiresAt.getHours() + dur);
            else if (unit === "day") expiresAt.setDate(expiresAt.getDate() + dur);
            else if (unit === "week") expiresAt.setDate(expiresAt.getDate() + dur * 7);
            else if (unit === "month") expiresAt.setMonth(expiresAt.getMonth() + dur);
            else if (unit === "year") expiresAt.setFullYear(expiresAt.getFullYear() + dur);
          }
          const newUser = await storage.createAppUser({
            appId: session.appId,
            username,
            password: pass || null,
            hwid: hwid || null,
            ip: req.ip || (req.headers["x-forwarded-for"] as string) || null,
            level: license.level || 1,
            banned: false,
            expiresAt,
          });
          await storage.updateLicense(license.id, {
            usedCount: (license.usedCount || 0) + 1,
            usedBy: username,
          });
          session.userId = newUser.id;
          return sendRes({
            success: true,
            message: "Registered successfully.",
            info: {
              username: newUser.username,
              subscriptions: [{ subscription: String(newUser.level), expiry: expiresAt ? String(Math.floor(expiresAt.getTime() / 1000)) : "N/A" }],
              ip: newUser.ip || "",
              hwid: newUser.hwid || "",
              createdate: String(Math.floor(Date.now() / 1000)),
              lastlogin: String(Math.floor(Date.now() / 1000)),
            },
          });
        }

        case "license": {
          const { key, hwid, sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session. Please re-initialize." });
          }
          const application = await storage.getApplication(session.appId);
          if (!application || !application.enabled) {
            return sendRes({ success: false, message: "Application not found or disabled." });
          }
          const license = await storage.getLicenseByKey(key, session.appId);
          if (!license) {
            return sendRes({ success: false, message: "Invalid license key." });
          }
          if (!license.enabled) {
            return sendRes({ success: false, message: "License key is disabled." });
          }
          if (license.maxUses && license.usedCount !== null && license.usedCount >= license.maxUses && !license.usedBy) {
            return sendRes({ success: false, message: "License key has reached maximum uses." });
          }
          let expiresAt = license.expiresAt;
          if (!expiresAt && license.duration) {
            expiresAt = new Date();
            const unit = license.durationUnit || "day";
            const dur = license.duration;
            if (unit === "hour") expiresAt.setHours(expiresAt.getHours() + dur);
            else if (unit === "day") expiresAt.setDate(expiresAt.getDate() + dur);
            else if (unit === "week") expiresAt.setDate(expiresAt.getDate() + dur * 7);
            else if (unit === "month") expiresAt.setMonth(expiresAt.getMonth() + dur);
            else if (unit === "year") expiresAt.setFullYear(expiresAt.getFullYear() + dur);
            await storage.updateLicense(license.id, { expiresAt });
          }
          if (expiresAt && new Date(expiresAt) < new Date()) {
            return sendRes({ success: false, message: "License key has expired." });
          }
          if (!license.usedBy) {
            await storage.updateLicense(license.id, {
              usedCount: (license.usedCount || 0) + 1,
              usedBy: hwid || "license-auth",
            });
          } else if (license.usedBy !== hwid && hwid && application.hwidLock) {
            return sendRes({ success: false, message: "License is already bound to a different device." });
          }
          return sendRes({
            success: true,
            message: "License key validated successfully.",
            info: {
              username: license.usedBy || "license-user",
              subscriptions: [{ subscription: String(license.level), expiry: expiresAt ? String(Math.floor(new Date(expiresAt).getTime() / 1000)) : "N/A" }],
              ip: req.ip || "",
              hwid: hwid || "",
              createdate: license.createdAt ? String(Math.floor(new Date(license.createdAt).getTime() / 1000)) : "",
              lastlogin: String(Math.floor(Date.now() / 1000)),
            },
          });
        }

        case "upgrade": {
          const { username, key, sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session. Please re-initialize." });
          }
          const appUser = await storage.getAppUserByUsername(username, session.appId);
          if (!appUser) {
            return sendRes({ success: false, message: "Username not found." });
          }
          const license = await storage.getLicenseByKey(key, session.appId);
          if (!license || !license.enabled) {
            return sendRes({ success: false, message: "Invalid or disabled license key." });
          }
          if (license.maxUses && license.usedCount !== null && license.usedCount >= license.maxUses) {
            return sendRes({ success: false, message: "License key has reached maximum uses." });
          }
          let expiresAt = appUser.expiresAt ? new Date(appUser.expiresAt) : new Date();
          if (expiresAt < new Date()) expiresAt = new Date();
          if (license.duration) {
            const unit = license.durationUnit || "day";
            const dur = license.duration;
            if (unit === "hour") expiresAt.setHours(expiresAt.getHours() + dur);
            else if (unit === "day") expiresAt.setDate(expiresAt.getDate() + dur);
            else if (unit === "week") expiresAt.setDate(expiresAt.getDate() + dur * 7);
            else if (unit === "month") expiresAt.setMonth(expiresAt.getMonth() + dur);
            else if (unit === "year") expiresAt.setFullYear(expiresAt.getFullYear() + dur);
          }
          const newLevel = Math.max(appUser.level || 1, license.level || 1);
          await storage.updateAppUser(appUser.id, { expiresAt, level: newLevel });
          await storage.updateLicense(license.id, {
            usedCount: (license.usedCount || 0) + 1,
            usedBy: username,
          });
          return sendRes({
            success: true,
            message: "Upgrade successful.",
          });
        }

        case "ban": {
          const { sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated || !session.userId) {
            return sendRes({ success: false, message: "Invalid session or no user logged in." });
          }
          await storage.updateAppUser(session.userId, { banned: true });
          return sendRes({ success: true, message: "User has been banned." });
        }

        case "check": {
          const { sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session." });
          }
          return sendRes({ success: true, message: "Session is valid." });
        }

        case "logout": {
          const { sessionid } = params;
          if (sessionid) {
            clientSessions.delete(sessionid);
          }
          return sendRes({ success: true, message: "Logged out successfully." });
        }

        case "fetchStats": {
          const { sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session." });
          }
          const application = await storage.getApplication(session.appId);
          if (!application) {
            return sendRes({ success: false, message: "Application not found." });
          }
          return sendRes({
            success: true,
            message: "Successfully fetched stats.",
            appinfo: {
              numUsers: String((await storage.getAppUsersByApp(session.appId)).length),
              numOnlineUsers: "0",
              numKeys: String((await storage.getLicensesByApp(session.appId)).length),
              version: application.version,
              customerPanelLink: "",
              downloadLink: "",
            },
          });
        }

        case "fetchOnline": {
          const { sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session." });
          }
          return sendRes({
            success: true,
            message: "Successfully fetched online users.",
            users: [],
          });
        }

        case "checkblacklist": {
          const { hwid, sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session." });
          }
          return sendRes({ success: false, message: "Not blacklisted." });
        }

        case "setvar": {
          const { sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session." });
          }
          return sendRes({ success: true, message: "Variable set successfully." });
        }

        case "getvar": {
          const { sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session." });
          }
          return sendRes({ success: true, message: "Variable not found.", response: "" });
        }

        case "var": {
          const { sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return sendRes({ success: false, message: "Invalid session." });
          }
          return sendRes({ success: true, message: "Variable not found.", response: "" });
        }

        case "forgot": {
          return sendRes({ success: false, message: "Password reset is not supported." });
        }

        case "changeUsername": {
          const { sessionid, newUsername } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated || !session.userId) {
            return sendRes({ success: false, message: "Invalid session or no user logged in." });
          }
          if (!newUsername) {
            return sendRes({ success: false, message: "New username is required." });
          }
          await storage.updateAppUser(session.userId, { username: newUsername });
          return sendRes({ success: true, message: "Username changed successfully." });
        }

        case "chatget": {
          return sendRes({ success: true, message: "No messages.", messages: [] });
        }

        case "chatsend": {
          return sendRes({ success: true, message: "Message sent." });
        }

        case "file": {
          return sendRes({ success: false, message: "File downloads not supported." });
        }

        case "webhook": {
          return sendRes({ success: false, message: "Webhooks are not supported yet." });
        }

        case "2faenable": {
          return sendRes({ success: false, message: "2FA is not supported." });
        }

        case "2fadisable": {
          return sendRes({ success: false, message: "2FA is not supported." });
        }

        case "button": {
          return sendRes({ success: true, message: "Button logged." });
        }

        case "log": {
          return sendRes({ success: true, message: "Log received." });
        }

        default:
          return sendRes({ success: false, message: `Unknown request type: ${type}` });
      }
    } catch (error) {
      console.error("Client API error:", error);
      return sendRes({ success: false, message: "Server error" });
    }
  };

  app.post("/api/1.2/", handleClientRequest);
  app.get("/api/1.2/", handleClientRequest);
  app.post("/api/1.3/", handleClientRequest);
  app.get("/api/1.3/", handleClientRequest);
  app.post("/api/1.2", handleClientRequest);
  app.get("/api/1.2", handleClientRequest);
  app.post("/api/1.3", handleClientRequest);
  app.get("/api/1.3", handleClientRequest);

  app.get("/api/public-key", (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.json({ publicKey: API_PUBLIC_KEY });
  });
}

const localSessions = new Map<string, { userId: string; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of localSessions) {
    if (now - session.createdAt > 86400000) {
      localSessions.delete(id);
    }
  }
}, 600000);

function registerLocalAuth(app: Express) {
  app.post("/api/local/register", async (req, res) => {
    try {
      const { username, password, email, turnstileToken } = req.body;
      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, email, and password are required." });
      }

      if (process.env.TURNSTILE_SECRET_KEY && turnstileToken) {
        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: turnstileToken,
          }),
        });
        const verifyData = await verifyRes.json() as { success: boolean };
        if (!verifyData.success) {
          return res.status(403).json({ message: "Security verification failed. Please try again." });
        }
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters." });
      }
      if (password.length < 12) {
        return res.status(400).json({ message: "Password must be at least 12 characters." });
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must contain uppercase, lowercase, number, and symbol." });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Please enter a valid email address." });
      }
      const existing = await storage.getAccountByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already taken." });
      }
      const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use." });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = randomUUID();
      const [user] = await db.insert(users).values({
        id: userId,
        firstName: username,
        email,
      }).returning();
      const account = await storage.createAccount(username, passwordHash, userId);
      const sessionId = randomUUID();
      localSessions.set(sessionId, { userId, createdAt: Date.now() });
      res.cookie("kv_session", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 86400000,
        path: "/",
      });
      return res.json({ success: true, user: { id: userId, firstName: username, email: user.email } });
    } catch (error: any) {
      console.error("Register error:", error);
      if (error?.code === "23505") {
        return res.status(400).json({ message: "Username or email already taken." });
      }
      return res.status(500).json({ message: "Registration failed." });
    }
  });

  app.post("/api/local/login", async (req, res) => {
    try {
      const { username, password, turnstileToken } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
      }

      if (process.env.TURNSTILE_SECRET_KEY && turnstileToken) {
        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: turnstileToken,
          }),
        });
        const verifyData = await verifyRes.json() as { success: boolean };
        if (!verifyData.success) {
          return res.status(403).json({ message: "Security verification failed. Please try again." });
        }
      }

      const account = await storage.getAccountByUsername(username);
      if (!account) {
        return res.status(401).json({ message: "Invalid username or password." });
      }
      const valid = await bcrypt.compare(password, account.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid username or password." });
      }
      const sessionId = randomUUID();
      localSessions.set(sessionId, { userId: account.userId!, createdAt: Date.now() });
      res.cookie("kv_session", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 86400000,
        path: "/",
      });
      const [user] = await db.select().from(users).where(eq(users.id, account.userId!));
      return res.json({ success: true, user });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Login failed." });
    }
  });

  app.get("/api/local/user", async (req, res) => {
    try {
      const sessionId = req.cookies?.kv_session;
      if (!sessionId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const session = localSessions.get(sessionId);
      if (!session) {
        return res.status(401).json({ message: "Session expired" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, session.userId));
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const numericId = await storage.ensureNumericId(user.id);
      return res.json({ ...user, numericId });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/local/logout", async (req, res) => {
    const sessionId = req.cookies?.kv_session;
    if (sessionId) {
      localSessions.delete(sessionId);
    }
    res.clearCookie("kv_session", { path: "/" });
    return res.json({ success: true });
  });
}

function isAuthenticatedCombined(req: any, res: any, next: any) {
  const kvSession = req.cookies?.kv_session;
  if (kvSession) {
    const session = localSessions.get(kvSession);
    if (session) {
      req.user = { claims: { sub: session.userId } };
      return next();
    }
  }
  return isAuthenticated(req, res, next);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  registerLocalAuth(app);
  registerClientApi(app);

  app.get("/api/applications", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const apps = await storage.getApplicationsByOwner(userId);
      res.json(apps);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post("/api/applications", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, version } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }
      const app = await storage.createApplication({
        ownerId: userId,
        name: name.trim(),
        version: version || "1.0",
      });
      res.json(app);
    } catch (error) {
      console.error("Error creating application:", error);
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  app.patch("/api/applications/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getApplication(req.params.id);
      if (!existing || existing.ownerId !== userId) {
        return res.status(404).json({ message: "Application not found" });
      }
      const updated = await storage.updateApplication(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  app.delete("/api/applications/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getApplication(req.params.id);
      if (!existing || existing.ownerId !== userId) {
        return res.status(404).json({ message: "Application not found" });
      }
      await storage.deleteApplication(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ message: "Failed to delete application" });
    }
  });

  app.post("/api/applications/:id/reset-secret", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getApplication(req.params.id);
      if (!existing || existing.ownerId !== userId) {
        return res.status(404).json({ message: "Application not found" });
      }
      const updated = await storage.resetApplicationSecret(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error resetting secret:", error);
      res.status(500).json({ message: "Failed to reset secret" });
    }
  });

  app.get("/api/licenses", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lics = await storage.getLicensesByOwner(userId);
      res.json(lics);
    } catch (error) {
      console.error("Error fetching licenses:", error);
      res.status(500).json({ message: "Failed to fetch licenses" });
    }
  });

  app.post("/api/licenses", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { appId, count, duration, durationUnit, level, maxUses, note, mask, useLowercase, useUppercase } = req.body;
      if (!appId) return res.status(400).json({ message: "Application is required" });
      const existing = await storage.getApplication(appId);
      if (!existing || existing.ownerId !== userId) {
        return res.status(404).json({ message: "Application not found" });
      }
      const licCount = Math.min(count || 1, 100);
      const lics = await storage.createLicenses(
        {
          appId,
          duration: duration || 1,
          durationUnit: durationUnit || "day",
          level: level || 1,
          maxUses: maxUses || 1,
          note: note || null,
          enabled: true,
          expiresAt: null,
        },
        licCount,
        mask || undefined,
        useLowercase || false,
        useUppercase !== false
      );
      await storage.createTokens(appId, licCount);
      res.json(lics);
    } catch (error) {
      console.error("Error creating licenses:", error);
      res.status(500).json({ message: "Failed to create licenses" });
    }
  });

  app.patch("/api/licenses/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lic = await storage.getLicense(req.params.id);
      if (!lic) return res.status(404).json({ message: "License not found" });
      const app = await storage.getApplication(lic.appId);
      if (!app || app.ownerId !== userId) return res.status(404).json({ message: "License not found" });
      const updated = await storage.updateLicense(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating license:", error);
      res.status(500).json({ message: "Failed to update license" });
    }
  });

  app.delete("/api/licenses/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lic = await storage.getLicense(req.params.id);
      if (!lic) return res.status(404).json({ message: "License not found" });
      const app = await storage.getApplication(lic.appId);
      if (!app || app.ownerId !== userId) return res.status(404).json({ message: "License not found" });
      await storage.deleteLicense(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting license:", error);
      res.status(500).json({ message: "Failed to delete license" });
    }
  });

  app.post("/api/licenses/bulk-delete", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode } = req.body;
      const allLicenses = await storage.getLicensesByOwner(userId);
      let toDelete: typeof allLicenses = [];
      if (mode === "all") {
        toDelete = allLicenses;
      } else if (mode === "unused") {
        toDelete = allLicenses.filter((l) => (l.usedCount ?? 0) === 0);
      } else if (mode === "used") {
        toDelete = allLicenses.filter((l) => (l.usedCount ?? 0) > 0);
      } else if (mode === "selected" && Array.isArray(req.body.ids)) {
        toDelete = allLicenses.filter((l) => req.body.ids.includes(l.id));
      }
      for (const lic of toDelete) {
        await storage.deleteLicense(lic.id);
      }
      res.json({ success: true, deleted: toDelete.length });
    } catch (error) {
      console.error("Error bulk deleting licenses:", error);
      res.status(500).json({ message: "Failed to delete licenses" });
    }
  });

  app.post("/api/licenses/extend", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { unit, duration } = req.body;
      const allLicenses = await storage.getLicensesByOwner(userId);
      const unused = allLicenses.filter((l) => (l.usedCount ?? 0) === 0);
      let count = 0;
      for (const lic of unused) {
        const newDuration = (lic.duration ?? 0) + parseInt(duration);
        await storage.updateLicense(lic.id, { duration: newDuration, durationUnit: unit });
        count++;
      }
      res.json({ success: true, extended: count });
    } catch (error) {
      console.error("Error extending licenses:", error);
      res.status(500).json({ message: "Failed to extend licenses" });
    }
  });

  app.get("/api/app-users", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const users = await storage.getAppUsersByOwner(userId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching app users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/app-users", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { appId, username, password, email, level, expiresAt, hwid, maxHwid } = req.body;
      if (!appId || !username) {
        return res.status(400).json({ message: "Application and username are required" });
      }
      const existing = await storage.getApplication(appId);
      if (!existing || existing.ownerId !== userId) {
        return res.status(404).json({ message: "Application not found" });
      }
      const user = await storage.createAppUser({
        appId,
        username: username.trim(),
        password: password || null,
        email: email || null,
        level: level !== undefined ? parseInt(level) : 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        hwid: hwid || null,
        maxHwid: maxHwid !== undefined && maxHwid !== null ? parseInt(maxHwid) : 1,
      });
      res.json(user);
    } catch (error) {
      console.error("Error creating app user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/app-users/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const appUser = await storage.getAppUser(req.params.id);
      if (!appUser) return res.status(404).json({ message: "User not found" });
      const app = await storage.getApplication(appUser.appId);
      if (!app || app.ownerId !== userId) return res.status(404).json({ message: "User not found" });
      const updated = await storage.updateAppUser(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating app user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/app-users/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const appUser = await storage.getAppUser(req.params.id);
      if (!appUser) return res.status(404).json({ message: "User not found" });
      const app = await storage.getApplication(appUser.appId);
      if (!app || app.ownerId !== userId) return res.status(404).json({ message: "User not found" });
      await storage.deleteAppUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting app user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/app-users/bulk-delete", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode, ids } = req.body;
      const allUsers = await storage.getAppUsersByOwner(userId);
      let toDelete: typeof allUsers = [];
      if (mode === "all") {
        toDelete = allUsers;
      } else if (mode === "expired") {
        toDelete = allUsers.filter((u) => u.expiresAt && new Date(u.expiresAt) < new Date());
      } else if (mode === "banned") {
        toDelete = allUsers.filter((u) => u.banned);
      } else if (mode === "selected" && Array.isArray(ids)) {
        toDelete = allUsers.filter((u) => ids.includes(u.id));
      }
      for (const u of toDelete) {
        await storage.deleteAppUser(u.id);
      }
      res.json({ success: true, deleted: toDelete.length });
    } catch (error) {
      console.error("Error bulk deleting users:", error);
      res.status(500).json({ message: "Failed to delete users" });
    }
  });

  app.post("/api/app-users/reset-hwid", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode, ids } = req.body;
      const allUsers = await storage.getAppUsersByOwner(userId);
      let toReset: typeof allUsers = [];
      if (mode === "all") {
        toReset = allUsers;
      } else if (mode === "selected" && Array.isArray(ids)) {
        toReset = allUsers.filter((u) => ids.includes(u.id));
      }
      let count = 0;
      for (const u of toReset) {
        if (u.hwid) {
          await storage.updateAppUser(u.id, { hwid: null });
          count++;
        }
      }
      res.json({ success: true, reset: count });
    } catch (error) {
      console.error("Error resetting HWIDs:", error);
      res.status(500).json({ message: "Failed to reset HWIDs" });
    }
  });

  app.get("/api/tokens", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const toks = await storage.getTokensByOwner(userId);
      res.json(toks);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      res.status(500).json({ message: "Failed to fetch tokens" });
    }
  });

  app.post("/api/tokens", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { appId, count } = req.body;
      if (!appId) return res.status(400).json({ message: "Application is required" });
      const existing = await storage.getApplication(appId);
      if (!existing || existing.ownerId !== userId) {
        return res.status(404).json({ message: "Application not found" });
      }
      const toks = await storage.createTokens(appId, Math.min(count || 1, 100));
      res.json(toks);
    } catch (error) {
      console.error("Error creating tokens:", error);
      res.status(500).json({ message: "Failed to create tokens" });
    }
  });

  // Seller CRUD routes
  app.get("/api/sellers", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const apps = await storage.getApplicationsByOwner(userId);
      const allSellers: any[] = [];
      for (const app of apps) {
        const s = await storage.getSellersByApp(app.id);
        allSellers.push(...s);
      }
      res.json(allSellers);
    } catch (error) {
      console.error("Error fetching sellers:", error);
      res.status(500).json({ message: "Failed to fetch sellers" });
    }
  });

  app.post("/api/sellers", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { appId, name, canCreateLicenses, canDeleteLicenses, canCreateUsers, canDeleteUsers, canResetUserHwid, canBanUsers } = req.body;
      if (!appId || !name) return res.status(400).json({ message: "Application and name are required" });
      const app = await storage.getApplication(appId);
      if (!app || app.ownerId !== userId) return res.status(404).json({ message: "Application not found" });
      const seller = await storage.createSeller({
        appId,
        name,
        canCreateLicenses: canCreateLicenses ?? true,
        canDeleteLicenses: canDeleteLicenses ?? false,
        canCreateUsers: canCreateUsers ?? true,
        canDeleteUsers: canDeleteUsers ?? false,
        canResetUserHwid: canResetUserHwid ?? false,
        canBanUsers: canBanUsers ?? false,
      });
      res.json(seller);
    } catch (error) {
      console.error("Error creating seller:", error);
      res.status(500).json({ message: "Failed to create seller" });
    }
  });

  app.patch("/api/sellers/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const seller = await storage.getSeller(req.params.id);
      if (!seller) return res.status(404).json({ message: "Seller not found" });
      const app = await storage.getApplication(seller.appId);
      if (!app || app.ownerId !== userId) return res.status(404).json({ message: "Seller not found" });
      const updated = await storage.updateSeller(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating seller:", error);
      res.status(500).json({ message: "Failed to update seller" });
    }
  });

  app.delete("/api/sellers/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const seller = await storage.getSeller(req.params.id);
      if (!seller) return res.status(404).json({ message: "Seller not found" });
      const app = await storage.getApplication(seller.appId);
      if (!app || app.ownerId !== userId) return res.status(404).json({ message: "Seller not found" });
      await storage.deleteSeller(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting seller:", error);
      res.status(500).json({ message: "Failed to delete seller" });
    }
  });

  // Seller API endpoint
  app.post("/api/seller", async (req, res) => {
    try {
      const { sellerkey, type } = req.body;
      if (!sellerkey) return res.status(400).json({ success: false, message: "Seller key is required" });
      const seller = await storage.getSellerByKey(sellerkey);
      if (!seller || !seller.enabled) return res.status(403).json({ success: false, message: "Invalid or disabled seller key" });
      const app = await storage.getApplication(seller.appId);
      if (!app || !app.enabled) return res.status(403).json({ success: false, message: "Application not found or disabled" });

      switch (type) {
        case "add": {
          if (!seller.canCreateLicenses) return res.status(403).json({ success: false, message: "No permission to create licenses" });
          const { expiry, mask, level, amount, note } = req.body;
          const count = Math.min(parseInt(amount) || 1, 100);
          const lics = await storage.createLicenses({
            appId: seller.appId,
            duration: parseInt(expiry) || 1,
            durationUnit: "day",
            level: parseInt(level) || 1,
            maxUses: 1,
            enabled: true,
            note: note || null,
          }, count, mask);
          return res.json({ success: true, message: "License(s) created", keys: lics.map(l => l.licenseKey) });
        }
        case "del": {
          if (!seller.canDeleteLicenses) return res.status(403).json({ success: false, message: "No permission to delete licenses" });
          const { key } = req.body;
          if (!key) return res.status(400).json({ success: false, message: "License key required" });
          const lic = await storage.getLicenseByKey(key, seller.appId);
          if (!lic) return res.status(404).json({ success: false, message: "License not found" });
          await storage.deleteLicense(lic.id);
          return res.json({ success: true, message: "License deleted" });
        }
        case "adduser": {
          if (!seller.canCreateUsers) return res.status(403).json({ success: false, message: "No permission to create users" });
          const { user: username, pass, email: userEmail, expiry: userExpiry } = req.body;
          if (!username) return res.status(400).json({ success: false, message: "Username is required" });
          const existing = await storage.getAppUserByUsername(username, seller.appId);
          if (existing) return res.status(409).json({ success: false, message: "Username already exists" });
          const expiresAt = userExpiry ? new Date(Date.now() + parseInt(userExpiry) * 86400000) : null;
          await storage.createAppUser({
            appId: seller.appId,
            username,
            password: pass || null,
            email: userEmail || null,
            expiresAt,
          });
          return res.json({ success: true, message: "User created" });
        }
        case "deluser": {
          if (!seller.canDeleteUsers) return res.status(403).json({ success: false, message: "No permission to delete users" });
          const { user: delUsername } = req.body;
          if (!delUsername) return res.status(400).json({ success: false, message: "Username is required" });
          const delUser = await storage.getAppUserByUsername(delUsername, seller.appId);
          if (!delUser) return res.status(404).json({ success: false, message: "User not found" });
          await storage.deleteAppUser(delUser.id);
          return res.json({ success: true, message: "User deleted" });
        }
        case "resetuser": {
          if (!seller.canResetUserHwid) return res.status(403).json({ success: false, message: "No permission to reset HWID" });
          const { user: resetUsername } = req.body;
          if (!resetUsername) return res.status(400).json({ success: false, message: "Username is required" });
          const resetUser = await storage.getAppUserByUsername(resetUsername, seller.appId);
          if (!resetUser) return res.status(404).json({ success: false, message: "User not found" });
          await storage.updateAppUser(resetUser.id, { hwid: null });
          return res.json({ success: true, message: "HWID reset" });
        }
        case "banuser": {
          if (!seller.canBanUsers) return res.status(403).json({ success: false, message: "No permission to ban users" });
          const { user: banUsername } = req.body;
          if (!banUsername) return res.status(400).json({ success: false, message: "Username is required" });
          const banUser = await storage.getAppUserByUsername(banUsername, seller.appId);
          if (!banUser) return res.status(404).json({ success: false, message: "User not found" });
          await storage.updateAppUser(banUser.id, { banned: true });
          return res.json({ success: true, message: "User banned" });
        }
        case "unbanuser": {
          if (!seller.canBanUsers) return res.status(403).json({ success: false, message: "No permission to manage bans" });
          const { user: unbanUsername } = req.body;
          if (!unbanUsername) return res.status(400).json({ success: false, message: "Username is required" });
          const unbanUser = await storage.getAppUserByUsername(unbanUsername, seller.appId);
          if (!unbanUser) return res.status(404).json({ success: false, message: "User not found" });
          await storage.updateAppUser(unbanUser.id, { banned: false });
          return res.json({ success: true, message: "User unbanned" });
        }
        case "validate": {
          return res.json({ success: true, message: "Seller key is valid", appName: app.name });
        }
        case "appdetails": {
          return res.json({
            success: true,
            appdetails: {
              name: app.name,
              ownerid: app.ownerId,
              version: app.version || "1.0",
              enabled: app.enabled,
            },
          });
        }
        case "stats": {
          const allLicenses = await storage.getLicensesByApp(seller.appId);
          const allUsers = await storage.getAppUsersByApp(seller.appId);
          const allTokens = await storage.getTokensByApp(seller.appId);
          const usedKeys = allLicenses.filter(l => l.usedCount > 0).length;
          const unusedKeys = allLicenses.filter(l => l.usedCount === 0).length;
          const bannedUsers = allUsers.filter(u => u.banned).length;
          return res.json({
            success: true,
            totalkeys: allLicenses.length,
            unused: unusedKeys,
            used: usedKeys,
            totalusers: allUsers.length,
            bannedusers: bannedUsers,
            totaltokens: allTokens.length,
          });
        }
        case "fetchallkeys": {
          const licenses = await storage.getLicensesByApp(seller.appId);
          return res.json({
            success: true,
            keys: licenses.map(l => ({
              key: l.licenseKey,
              level: l.level,
              duration: l.duration,
              durationUnit: l.durationUnit,
              enabled: l.enabled,
              usedCount: l.usedCount,
              maxUses: l.maxUses,
              note: l.note,
              createdAt: l.createdAt,
              expiresAt: l.expiresAt,
            })),
          });
        }
        case "fetchallusers": {
          const users = await storage.getAppUsersByApp(seller.appId);
          return res.json({
            success: true,
            users: users.map(u => ({
              username: u.username,
              email: u.email,
              hwid: u.hwid,
              ip: u.ip,
              banned: u.banned,
              level: u.level,
              expiresAt: u.expiresAt,
              lastLogin: u.lastLogin,
              createdAt: u.createdAt,
            })),
          });
        }
        case "info": {
          const { key: infoKey } = req.body;
          if (!infoKey) return res.status(400).json({ success: false, message: "License key required" });
          const infoLic = await storage.getLicenseByKey(infoKey, seller.appId);
          if (!infoLic) return res.status(404).json({ success: false, message: "License not found" });
          return res.json({
            success: true,
            key: infoLic.licenseKey,
            level: infoLic.level,
            duration: infoLic.duration,
            durationUnit: infoLic.durationUnit,
            enabled: infoLic.enabled,
            usedCount: infoLic.usedCount,
            maxUses: infoLic.maxUses,
            note: infoLic.note,
            createdAt: infoLic.createdAt,
            expiresAt: infoLic.expiresAt,
          });
        }
        case "verify": {
          const { key: verifyKey } = req.body;
          if (!verifyKey) return res.status(400).json({ success: false, message: "License key required" });
          const verifyLic = await storage.getLicenseByKey(verifyKey, seller.appId);
          if (!verifyLic) return res.json({ success: false, message: "License not found" });
          return res.json({ success: true, message: "License exists" });
        }
        case "getuserdata": {
          const { user: dataUsername } = req.body;
          if (!dataUsername) return res.status(400).json({ success: false, message: "Username is required" });
          const dataUser = await storage.getAppUserByUsername(dataUsername, seller.appId);
          if (!dataUser) return res.status(404).json({ success: false, message: "User not found" });
          return res.json({
            success: true,
            username: dataUser.username,
            email: dataUser.email,
            hwid: dataUser.hwid,
            ip: dataUser.ip,
            banned: dataUser.banned,
            level: dataUser.level,
            expiresAt: dataUser.expiresAt,
            lastLogin: dataUser.lastLogin,
            createdAt: dataUser.createdAt,
          });
        }
        default:
          return res.status(400).json({ success: false, message: "Invalid type" });
      }
    } catch (error) {
      console.error("Seller API error:", error);
      res.status(500).json({ success: false, message: "Internal error" });
    }
  });

  app.get("/api/statistics", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const apps = await storage.getApplicationsByOwner(userId);
      const allLicenses = await storage.getLicensesByOwner(userId);
      const allUsers = await storage.getAppUsersByOwner(userId);
      const allTokens = await storage.getTokensByOwner(userId);

      const activeLicenses = allLicenses.filter((l) => l.enabled);
      const usedLicenses = allLicenses.filter((l) => l.usedBy);
      const expiredLicenses = allLicenses.filter((l) => l.expiresAt && new Date(l.expiresAt) < new Date());
      const bannedUsers = allUsers.filter((u) => u.banned);
      const activeUsers = allUsers.filter((u) => !u.banned && (!u.expiresAt || new Date(u.expiresAt) >= new Date()));
      const usedTokens = allTokens.filter((t) => t.used);
      const enabledApps = apps.filter((a) => a.enabled);

      const perAppStats = apps.map((app) => {
        const appLicenses = allLicenses.filter((l) => l.appId === app.id);
        const appUsers = allUsers.filter((u) => u.appId === app.id);
        const appTokens = allTokens.filter((t) => t.appId === app.id);
        return {
          appId: app.id,
          appName: app.name,
          enabled: app.enabled,
          version: app.version,
          totalLicenses: appLicenses.length,
          activeLicenses: appLicenses.filter((l) => l.enabled).length,
          usedLicenses: appLicenses.filter((l) => l.usedBy).length,
          totalUsers: appUsers.length,
          activeUsers: appUsers.filter((u) => !u.banned).length,
          bannedUsers: appUsers.filter((u) => u.banned).length,
          totalTokens: appTokens.length,
          usedTokens: appTokens.filter((t) => t.used).length,
        };
      });

      const licensesByLevel: Record<number, number> = {};
      allLicenses.forEach((l) => {
        const level = l.level || 1;
        licensesByLevel[level] = (licensesByLevel[level] || 0) + 1;
      });

      const usersByLevel: Record<number, number> = {};
      allUsers.forEach((u) => {
        const level = u.level || 1;
        usersByLevel[level] = (usersByLevel[level] || 0) + 1;
      });

      res.json({
        overview: {
          totalApps: apps.length,
          enabledApps: enabledApps.length,
          totalLicenses: allLicenses.length,
          activeLicenses: activeLicenses.length,
          usedLicenses: usedLicenses.length,
          expiredLicenses: expiredLicenses.length,
          totalUsers: allUsers.length,
          activeUsers: activeUsers.length,
          bannedUsers: bannedUsers.length,
          totalTokens: allTokens.length,
          usedTokens: usedTokens.length,
          unusedTokens: allTokens.length - usedTokens.length,
        },
        perApp: perAppStats,
        licensesByLevel,
        usersByLevel,
      });
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.post("/api/tokens/bulk-delete", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mode, ids } = req.body;
      const allTokens = await storage.getTokensByOwner(userId);
      let toDelete: typeof allTokens = [];
      if (mode === "all") {
        toDelete = allTokens;
      } else if (mode === "used") {
        toDelete = allTokens.filter((t) => t.used);
      } else if (mode === "unused") {
        toDelete = allTokens.filter((t) => !t.used);
      } else if (mode === "selected" && Array.isArray(ids)) {
        toDelete = allTokens.filter((t) => ids.includes(t.id));
      }
      for (const t of toDelete) {
        await storage.deleteToken(t.id);
      }
      res.json({ success: true, deleted: toDelete.length });
    } catch (error) {
      console.error("Error bulk deleting tokens:", error);
      res.status(500).json({ message: "Failed to delete tokens" });
    }
  });

  app.delete("/api/tokens/:id", isAuthenticatedCombined, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tok = await storage.getToken(req.params.id);
      if (!tok) return res.status(404).json({ message: "Token not found" });
      const app = await storage.getApplication(tok.appId);
      if (!app || app.ownerId !== userId) return res.status(404).json({ message: "Token not found" });
      await storage.deleteToken(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting token:", error);
      res.status(500).json({ message: "Failed to delete token" });
    }
  });

  app.get("/api/download/telegram-bot", (req, res) => {
    const botDir = path.join(process.cwd(), "public", "downloads", "telegram-bot");
    if (!fs.existsSync(botDir)) {
      return res.status(404).json({ message: "Bot files not found" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=keyauth-telegram-bot.zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err: Error) => {
      res.status(500).json({ message: "Failed to create archive" });
    });
    archive.pipe(res);
    archive.directory(botDir, "keyauth-telegram-bot");
    archive.finalize();
  });

  app.get("/api/download/discord-bot", (req, res) => {
    const botDir = path.join(process.cwd(), "public", "downloads", "discord-bot");
    if (!fs.existsSync(botDir)) {
      return res.status(404).json({ message: "Bot files not found" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=keyauth-discord-bot.zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err: Error) => {
      res.status(500).json({ message: "Failed to create archive" });
    });
    archive.pipe(res);
    archive.directory(botDir, "keyauth-discord-bot");
    archive.finalize();
  });

  return httpServer;
}
