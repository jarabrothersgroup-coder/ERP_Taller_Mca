/**
 * Sucursales table — Drizzle ORM schema.
 *
 * Multi-branch support for the automotive workshop ERP.
 * Each sucursal represents a physical location/branch.
 *
 * @module config/schema/sucursales
 */

import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Table ────────────────────────────────────

/**
 * Sucursales — workshop branches/locations.
 */
export const sucursales = pgTable(
  "sucursales",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Branch name (e.g. "Sucursal Central", "Taller San Lorenzo") */
    nombre: text("nombre").notNull(),

    /** Branch code (e.g. "SC01", "SL02") */
    codigo: text("codigo").notNull().unique(),

    /** Physical address */
    direccion: text("direccion"),

    /** City */
    ciudad: text("ciudad"),

    /** Department (e.g. "Central", "Guairá") */
    departamento: text("departamento"),

    /** Phone number */
    telefono: text("telefono"),

    /** Email */
    email: text("email"),

    /** Manager name */
    gerente: text("gerente"),

    /** Whether this is the main/headquarters branch */
    esPrincipal: boolean("es_principal").notNull().default(false),

    /** Whether this branch is active */
    activa: boolean("activa").notNull().default(true),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    codigoIdx: index("sucursales_codigo_idx").on(table.codigo),
    tenantIdx: index("sucursales_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type Sucursal = typeof sucursales.$inferSelect;
export type NewSucursal = typeof sucursales.$inferInsert;
