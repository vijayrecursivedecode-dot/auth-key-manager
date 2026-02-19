import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { storage } from "./storage";

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
  app.post("/api/1.2/", async (req, res) => {
    const { type } = req.body;

    try {
      switch (type) {
        case "init": {
          const { name, ownerid, ver, secret } = req.body;
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
          const { username, pass, hwid, sessionid, name: appName, ownerid } = req.body;
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
          const { username, pass, key, hwid, sessionid } = req.body;
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
          const { key, hwid, sessionid } = req.body;
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
          const { username, key, sessionid } = req.body;
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
          const { sessionid } = req.body;
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
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  registerClientApi(app);

  app.get("/api/applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const apps = await storage.getApplicationsByOwner(userId);
      res.json(apps);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post("/api/applications", isAuthenticated, async (req: any, res) => {
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

  app.patch("/api/applications/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/applications/:id", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/applications/:id/reset-secret", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/licenses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lics = await storage.getLicensesByOwner(userId);
      res.json(lics);
    } catch (error) {
      console.error("Error fetching licenses:", error);
      res.status(500).json({ message: "Failed to fetch licenses" });
    }
  });

  app.post("/api/licenses", isAuthenticated, async (req: any, res) => {
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

  app.patch("/api/licenses/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/licenses/:id", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/app-users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const users = await storage.getAppUsersByOwner(userId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching app users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/app-users", isAuthenticated, async (req: any, res) => {
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

  app.patch("/api/app-users/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/app-users/:id", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const toks = await storage.getTokensByOwner(userId);
      res.json(toks);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      res.status(500).json({ message: "Failed to fetch tokens" });
    }
  });

  app.post("/api/tokens", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/statistics", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/tokens/:id", isAuthenticated, async (req: any, res) => {
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
