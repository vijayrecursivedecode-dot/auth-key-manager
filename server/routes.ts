import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { storage } from "./storage";
import { users } from "@shared/models/auth";
import { licenses as licensesTable } from "@shared/schema";
import { db } from "./db";

interface ClientSession {
  sessionId: string;
  appId: string;
  userId?: string;
  validated: boolean;
  createdAt: number;
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
  app.options("/api/1.2/", (req, res) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    });
    res.sendStatus(204);
  });

  const handleClientRequest = async (req: any, res: any) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", "application/json");

    const params = { ...req.query, ...req.body };
    const { type } = params;

    try {
      switch (type) {
        case "init": {
          const { name, ownerid, ver, secret } = params;
          if (!name || !ownerid) {
            return res.json({ success: false, message: "Missing name or ownerid" });
          }
          const application = await storage.getApplicationByNameAndOwner(name, ownerid);
          if (!application) {
            return res.json({ success: false, message: "Application not found. Check your application name and owner ID." });
          }
          if (secret && application.secret !== secret) {
            return res.json({ success: false, message: "Invalid application secret." });
          }
          if (!application.enabled) {
            return res.json({ success: false, message: "Application is disabled by the owner." });
          }
          if (ver && application.version && ver !== application.version) {
            return res.json({ success: false, message: "invalidver", download: "" });
          }
          const sessionId = randomUUID();
          clientSessions.set(sessionId, {
            sessionId,
            appId: application.id,
            validated: true,
            createdAt: Date.now(),
          });
          return res.json({
            success: true,
            message: "Initialized",
            sessionid: sessionId,
            appinfo: {
              numUsers: String((await storage.getAppUsersByApp(application.id)).length),
              numKeys: String((await storage.getLicensesByApp(application.id)).length),
              version: application.version,
              customerPanelLink: "",
            },
          });
        }

        case "login": {
          const { username, pass, hwid, sessionid, name: appName, ownerid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated) {
            return res.json({ success: false, message: "Invalid session. Please re-initialize." });
          }
          const application = await storage.getApplication(session.appId);
          if (!application || !application.enabled) {
            return res.json({ success: false, message: "Application not found or disabled." });
          }
          const appUser = await storage.getAppUserByUsername(username, session.appId);
          if (!appUser) {
            return res.json({ success: false, message: "Username not found." });
          }
          if (appUser.banned) {
            return res.json({ success: false, message: "User is banned." });
          }
          if (appUser.password && appUser.password !== pass) {
            return res.json({ success: false, message: "Incorrect password." });
          }
          if (appUser.expiresAt && new Date(appUser.expiresAt) < new Date()) {
            return res.json({ success: false, message: "Subscription expired." });
          }
          if (application.hwidLock && appUser.hwid && hwid && appUser.hwid !== hwid) {
            return res.json({ success: false, message: "HWID mismatch. This account is locked to a different device." });
          }
          const updateData: any = {
            lastLogin: new Date(),
            ip: req.ip || req.headers["x-forwarded-for"] || null,
          };
          if (hwid && (!appUser.hwid || !application.hwidLock)) {
            updateData.hwid = hwid;
          }
          await storage.updateAppUser(appUser.id, updateData);
          session.userId = appUser.id;
          return res.json({
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
            return res.json({ success: false, message: "Invalid session. Please re-initialize." });
          }
          const application = await storage.getApplication(session.appId);
          if (!application || !application.enabled) {
            return res.json({ success: false, message: "Application not found or disabled." });
          }
          const existingUser = await storage.getAppUserByUsername(username, session.appId);
          if (existingUser) {
            return res.json({ success: false, message: "Username already taken." });
          }
          const license = await storage.getLicenseByKey(key, session.appId);
          if (!license) {
            return res.json({ success: false, message: "Invalid license key." });
          }
          if (!license.enabled) {
            return res.json({ success: false, message: "License key is disabled." });
          }
          if (license.maxUses && license.usedCount !== null && license.usedCount >= license.maxUses) {
            return res.json({ success: false, message: "License key has reached maximum uses." });
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
          return res.json({
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
            return res.json({ success: false, message: "Invalid session. Please re-initialize." });
          }
          const application = await storage.getApplication(session.appId);
          if (!application || !application.enabled) {
            return res.json({ success: false, message: "Application not found or disabled." });
          }
          const license = await storage.getLicenseByKey(key, session.appId);
          if (!license) {
            return res.json({ success: false, message: "Invalid license key." });
          }
          if (!license.enabled) {
            return res.json({ success: false, message: "License key is disabled." });
          }
          if (license.maxUses && license.usedCount !== null && license.usedCount >= license.maxUses && !license.usedBy) {
            return res.json({ success: false, message: "License key has reached maximum uses." });
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
            return res.json({ success: false, message: "License key has expired." });
          }
          if (!license.usedBy) {
            await storage.updateLicense(license.id, {
              usedCount: (license.usedCount || 0) + 1,
              usedBy: hwid || "license-auth",
            });
          } else if (license.usedBy !== hwid && hwid && application.hwidLock) {
            return res.json({ success: false, message: "License is already bound to a different device." });
          }
          return res.json({
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
            return res.json({ success: false, message: "Invalid session. Please re-initialize." });
          }
          const appUser = await storage.getAppUserByUsername(username, session.appId);
          if (!appUser) {
            return res.json({ success: false, message: "Username not found." });
          }
          const license = await storage.getLicenseByKey(key, session.appId);
          if (!license || !license.enabled) {
            return res.json({ success: false, message: "Invalid or disabled license key." });
          }
          if (license.maxUses && license.usedCount !== null && license.usedCount >= license.maxUses) {
            return res.json({ success: false, message: "License key has reached maximum uses." });
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
          return res.json({
            success: true,
            message: "Upgrade successful.",
          });
        }

        case "ban": {
          const { sessionid } = params;
          const session = clientSessions.get(sessionid);
          if (!session || !session.validated || !session.userId) {
            return res.json({ success: false, message: "Invalid session or no user logged in." });
          }
          await storage.updateAppUser(session.userId, { banned: true });
          return res.json({ success: true, message: "User has been banned." });
        }

        case "var": {
          return res.json({ success: false, message: "Variables are not supported yet." });
        }

        case "webhook": {
          return res.json({ success: false, message: "Webhooks are not supported yet." });
        }

        case "log": {
          return res.json({ success: true, message: "Log received." });
        }

        default:
          return res.json({ success: false, message: `Unknown request type: ${type}` });
      }
    } catch (error) {
      console.error("Client API error:", error);
      return res.json({ success: false, message: "Server error" });
    }
  };

  app.post("/api/1.2/", handleClientRequest);
  app.get("/api/1.2/", handleClientRequest);
  app.post("/api/1.2", handleClientRequest);
  app.get("/api/1.2", handleClientRequest);
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
      const { username, password, email } = req.body;
      if (!username || !password || !email) {
        return res.status(400).json({ message: "Username, email, and password are required." });
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
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
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
      return res.json(user);
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
      const { appId, count, duration, durationUnit, level, maxUses, note } = req.body;
      if (!appId) return res.status(400).json({ message: "Application is required" });
      const existing = await storage.getApplication(appId);
      if (!existing || existing.ownerId !== userId) {
        return res.status(404).json({ message: "Application not found" });
      }
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
        Math.min(count || 1, 100)
      );
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
      const { appId, username, password } = req.body;
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

  return httpServer;
}
