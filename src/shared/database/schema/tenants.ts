/**
 * Tenants table — multi-tenant platform registry.
 *
 * Each tenant (automotive workshop) gets a row in `public.tenants`
 * and an isolated PostgreSQL schema (`tenant_<slug>`) for its data.
 *
 * @module shared/database/schema/tenants
 */

import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Platform-level tenants table.
 *
 * Stores metadata for each registered workshop.
 * The `schema_name` column maps to the tenant's isolated PostgreSQL schema.
 * `ruc` is the Paraguayan tax ID (RUC) for fiscal compliance (SIFEN/DNIT).
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  schemaName: text("schema_name").notNull().unique(),
  ruc: text("ruc"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
