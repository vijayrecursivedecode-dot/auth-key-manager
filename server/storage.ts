import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  applications,
  licenses,
  appUsers,
  tokens,
  type Application,
  type InsertApplication,
  type License,
  type InsertLicense,
  type AppUser,
  type InsertAppUser,
  type Token,
  type InsertToken,
} from "@shared/schema";

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateLicenseKey(): string {
  const segments = [];
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let s = 0; s < 5; s++) {
    let seg = "";
    for (let i = 0; i < 5; i++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(seg);
  }
  return segments.join("-");
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface IStorage {
  getApplicationsByOwner(ownerId: string): Promise<Application[]>;
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(data: InsertApplication): Promise<Application>;
  updateApplication(id: string, data: Partial<Application>): Promise<Application | undefined>;
  deleteApplication(id: string): Promise<void>;
  resetApplicationSecret(id: string): Promise<Application | undefined>;

  getLicense(id: string): Promise<License | undefined>;
  getLicensesByOwner(ownerId: string): Promise<License[]>;
  getLicensesByApp(appId: string): Promise<License[]>;
  createLicenses(data: InsertLicense, count: number): Promise<License[]>;
  updateLicense(id: string, data: Partial<License>): Promise<License | undefined>;
  deleteLicense(id: string): Promise<void>;

  getAppUser(id: string): Promise<AppUser | undefined>;
  getAppUsersByOwner(ownerId: string): Promise<AppUser[]>;
  getAppUsersByApp(appId: string): Promise<AppUser[]>;
  createAppUser(data: InsertAppUser): Promise<AppUser>;
  updateAppUser(id: string, data: Partial<AppUser>): Promise<AppUser | undefined>;
  deleteAppUser(id: string): Promise<void>;

  getToken(id: string): Promise<Token | undefined>;
  getTokensByOwner(ownerId: string): Promise<Token[]>;
  getTokensByApp(appId: string): Promise<Token[]>;
  createTokens(appId: string, count: number): Promise<Token[]>;
  deleteToken(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getApplicationsByOwner(ownerId: string): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.ownerId, ownerId));
  }

  async getApplication(id: string): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    return app;
  }

  async createApplication(data: InsertApplication): Promise<Application> {
    const [app] = await db
      .insert(applications)
      .values({ ...data, secret: generateSecret() })
      .returning();
    return app;
  }

  async updateApplication(id: string, data: Partial<Application>): Promise<Application | undefined> {
    const [app] = await db
      .update(applications)
      .set(data)
      .where(eq(applications.id, id))
      .returning();
    return app;
  }

  async deleteApplication(id: string): Promise<void> {
    await db.delete(tokens).where(eq(tokens.appId, id));
    await db.delete(appUsers).where(eq(appUsers.appId, id));
    await db.delete(licenses).where(eq(licenses.appId, id));
    await db.delete(applications).where(eq(applications.id, id));
  }

  async resetApplicationSecret(id: string): Promise<Application | undefined> {
    const [app] = await db
      .update(applications)
      .set({ secret: generateSecret() })
      .where(eq(applications.id, id))
      .returning();
    return app;
  }

  async getLicense(id: string): Promise<License | undefined> {
    const [lic] = await db.select().from(licenses).where(eq(licenses.id, id));
    return lic;
  }

  async getLicensesByOwner(ownerId: string): Promise<License[]> {
    const apps = await this.getApplicationsByOwner(ownerId);
    if (apps.length === 0) return [];
    const appIds = apps.map((a) => a.id);
    const allLicenses: License[] = [];
    for (const appId of appIds) {
      const lics = await db.select().from(licenses).where(eq(licenses.appId, appId));
      allLicenses.push(...lics);
    }
    return allLicenses;
  }

  async getLicensesByApp(appId: string): Promise<License[]> {
    return db.select().from(licenses).where(eq(licenses.appId, appId));
  }

  async createLicenses(data: InsertLicense, count: number): Promise<License[]> {
    const created: License[] = [];
    for (let i = 0; i < count; i++) {
      const [lic] = await db
        .insert(licenses)
        .values({
          ...data,
          licenseKey: generateLicenseKey(),
        })
        .returning();
      created.push(lic);
    }
    return created;
  }

  async updateLicense(id: string, data: Partial<License>): Promise<License | undefined> {
    const [lic] = await db
      .update(licenses)
      .set(data)
      .where(eq(licenses.id, id))
      .returning();
    return lic;
  }

  async deleteLicense(id: string): Promise<void> {
    await db.delete(licenses).where(eq(licenses.id, id));
  }

  async getAppUser(id: string): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, id));
    return user;
  }

  async getAppUsersByOwner(ownerId: string): Promise<AppUser[]> {
    const apps = await this.getApplicationsByOwner(ownerId);
    if (apps.length === 0) return [];
    const allUsers: AppUser[] = [];
    for (const app of apps) {
      const users = await db.select().from(appUsers).where(eq(appUsers.appId, app.id));
      allUsers.push(...users);
    }
    return allUsers;
  }

  async getAppUsersByApp(appId: string): Promise<AppUser[]> {
    return db.select().from(appUsers).where(eq(appUsers.appId, appId));
  }

  async createAppUser(data: InsertAppUser): Promise<AppUser> {
    const [user] = await db.insert(appUsers).values(data).returning();
    return user;
  }

  async updateAppUser(id: string, data: Partial<AppUser>): Promise<AppUser | undefined> {
    const [user] = await db
      .update(appUsers)
      .set(data)
      .where(eq(appUsers.id, id))
      .returning();
    return user;
  }

  async deleteAppUser(id: string): Promise<void> {
    await db.delete(appUsers).where(eq(appUsers.id, id));
  }

  async getToken(id: string): Promise<Token | undefined> {
    const [tok] = await db.select().from(tokens).where(eq(tokens.id, id));
    return tok;
  }

  async getTokensByOwner(ownerId: string): Promise<Token[]> {
    const apps = await this.getApplicationsByOwner(ownerId);
    if (apps.length === 0) return [];
    const allTokens: Token[] = [];
    for (const app of apps) {
      const toks = await db.select().from(tokens).where(eq(tokens.appId, app.id));
      allTokens.push(...toks);
    }
    return allTokens;
  }

  async getTokensByApp(appId: string): Promise<Token[]> {
    return db.select().from(tokens).where(eq(tokens.appId, appId));
  }

  async createTokens(appId: string, count: number): Promise<Token[]> {
    const created: Token[] = [];
    for (let i = 0; i < count; i++) {
      const [tok] = await db
        .insert(tokens)
        .values({ appId, token: generateToken() })
        .returning();
      created.push(tok);
    }
    return created;
  }

  async deleteToken(id: string): Promise<void> {
    await db.delete(tokens).where(eq(tokens.id, id));
  }
}

export const storage = new DatabaseStorage();
