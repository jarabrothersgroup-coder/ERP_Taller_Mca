/**
 * Clients table — Drizzle ORM schema.
 *
 * Per-tenant client/ customer registry for Paraguayan automotive workshops.
 * Each client belongs to a tenant (workshop) and may own multiple vehicles.
 * The `ruc` field stores the Paraguayan Tax ID (RUC) for fiscal compliance
 * with DNIT SIFEN V150 and Ley 1034/83.
 *
 * @module shared/database/schema/clients
 */

import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Clients — vehicle owners / customers of the workshop.
 *
 * Stored in the tenant-isolated schema alongside vehicles and work orders.
 * Linked to `profiles` via `client_profile_id` when the client also has
 * a user account (optional).
 */
export const clients = pgTable("clients", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Full name or business name */
  name: text("name").notNull(),

  /** Email address (for digital invoice / KUDE delivery) */
  email: text("email"),

  /** Primary phone / WhatsApp (Paraguay +595) */
  phone: text("phone"),

  /** Paraguayan Tax ID (RUC) — required for fiscal documents */
  ruc: text("ruc"),

  /** Physical address of the client */
  address: text("address"),

  /** Free-text notes */
  notes: text("notes"),

  /** Tenant slug for multi-tenant isolation */
  tenantSlug: text("tenant_slug").notNull(),

  // ─── Timestamps ─────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  tenantIdx: index("clients_tenant_slug_idx").on(table.tenantSlug),
}));

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type Client = typeof clients.$inferSelect;

/** Row type accepted by INSERT */
export type NewClient = typeof clients.$inferInsert;

// ─── Relations ────────────────────────────────

/**
 * Relations for eager-loading with Drizzle query builder.
 */
export const clientsRelations = relations(clients, ({ many }) => ({
  vehicles: many(clients),
}));
