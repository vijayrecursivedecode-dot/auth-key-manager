import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
import { users } from "./models/auth";

export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  secret: text("secret").notNull(),
  version: text("version").default("1.0"),
  enabled: boolean("enabled").default(true),
  hwidLock: boolean("hwid_lock").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const licenses = pgTable(
  "licenses",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    appId: varchar("app_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    licenseKey: text("license_key").notNull().unique(),
    note: text("note"),
    duration: integer("duration").default(1),
    durationUnit: text("duration_unit").default("day"),
    level: integer("level").default(1),
    maxUses: integer("max_uses").default(1),
    usedCount: integer("used_count").default(0),
    enabled: boolean("enabled").default(true),
    usedBy: text("used_by"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_license_app").on(table.appId)]
);

export const appUsers = pgTable(
  "app_users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    appId: varchar("app_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    password: text("password"),
    email: text("email"),
    hwid: text("hwid"),
    hwidList: text("hwid_list").array().default(sql`'{}'::text[]`),
    maxHwid: integer("max_hwid").default(1),
    ip: text("ip"),
    level: integer("level").default(1),
    banned: boolean("banned").default(false),
    expiresAt: timestamp("expires_at"),
    lastLogin: timestamp("last_login"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_appuser_app").on(table.appId)]
);

export const tokens = pgTable(
  "tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    appId: varchar("app_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    usedBy: text("used_by"),
    used: boolean("used").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_token_app").on(table.appId)]
);

export const sellers = pgTable(
  "sellers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    appId: varchar("app_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    sellerKey: text("seller_key").notNull().unique(),
    name: text("name").notNull(),
    enabled: boolean("enabled").default(true),
    canCreateLicenses: boolean("can_create_licenses").default(true),
    canDeleteLicenses: boolean("can_delete_licenses").default(false),
    canCreateUsers: boolean("can_create_users").default(true),
    canDeleteUsers: boolean("can_delete_users").default(false),
    canResetUserHwid: boolean("can_reset_user_hwid").default(false),
    canBanUsers: boolean("can_ban_users").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_seller_app").on(table.appId)]
);

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  secret: true,
  createdAt: true,
});
export const insertLicenseSchema = createInsertSchema(licenses).omit({
  id: true,
  licenseKey: true,
  usedCount: true,
  usedBy: true,
  createdAt: true,
});
export const insertAppUserSchema = createInsertSchema(appUsers).omit({
  id: true,
  lastLogin: true,
  createdAt: true,
});
export const insertTokenSchema = createInsertSchema(tokens).omit({
  id: true,
  token: true,
  usedBy: true,
  used: true,
  createdAt: true,
});

export const insertSellerSchema = createInsertSchema(sellers).omit({
  id: true,
  sellerKey: true,
  createdAt: true,
});

export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type License = typeof licenses.$inferSelect;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type Token = typeof tokens.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Seller = typeof sellers.$inferSelect;
export type InsertSeller = z.infer<typeof insertSellerSchema>;
