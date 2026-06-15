/**
 * Profiles table — user accounts within a tenant.
 *
 * Each user belongs to exactly one tenant (workshop).
 * Roles follow the Paraguayan workshop hierarchy:
 *   - admin:   full access, fiscal document signing
 *   - manager: operational oversight, inventory
 *   - mechanic: work order execution, tool checkout
 *   - user:    read-only / limited
 *
 * @module shared/database/schema/profiles
 */

import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants.js";
import { relations } from "drizzle-orm";

/**
 * User profiles scoped to a tenant.
 *
 * `tenantId` references `public.tenants.id` to enforce data isolation
 * at the platform level. Application-level middleware must also
 * filter by tenant context.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    role: text("role").notNull().default("user"),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    roleCheck: check(
      "profiles_role_check",
      sql`${table.role} IN ('admin', 'manager', 'mechanic', 'user')`,
    ),
  }),
);

/** Role constraint enforced at DB level via CHECK in migration */
export const VALID_ROLES = ["admin", "manager", "mechanic", "user"] as const;
export type ProfileRole = (typeof VALID_ROLES)[number];

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

/**
 * Relations for Drizzle query builder.
 */
export const profilesRelations = relations(profiles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [profiles.tenantId],
    references: [tenants.id],
  }),
}));
