import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

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
