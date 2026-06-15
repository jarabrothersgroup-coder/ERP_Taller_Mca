/**
 * Órdenes de Repuestos items table — Drizzle ORM schema.
 *
 * Line-item spare parts assigned to a work order.
 * Each row records which part (by ID or manual entry) was used,
 * including quantity, unit price, and subtotal.
 *
 * totalCost on ordenes_trabajo is recalculated automatically
 * whenever rows here are inserted, updated, or deleted.
 *
 * @module workshop/schema/orden-repuestos
 */

import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ordenesTrabajo } from "./ordenes-trabajo.js";

// ─── Table ────────────────────────────────────

/**
 * Items de Repuesto por Orden de Trabajo.
 *
 * One row per spare-part line-item on a work order.
 * repuestoId is nullable to allow manual entries (e.g. parts not in inventory).
 * repuesto_nombre and codigo are denormalised for readability.
 */
export const ordenRepuestos = pgTable(
  "orden_repuestos",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent work order (FK → ordenes_trabajo) */
    ordenTrabajoId: uuid("orden_trabajo_id")
      .notNull()
      .references(() => ordenesTrabajo.id, { onDelete: "cascade" }),

    /** Optional FK to inventory repuesto (null for manual/off-catalog entries) */
    repuestoId: uuid("repuesto_id"),

    /** Denormalised part name */
    repuestoNombre: text("repuesto_nombre").notNull(),

    /** Denormalised part code / SKU */
    codigo: text("codigo"),

    /** Quantity used */
    cantidad: integer("cantidad").notNull().default(1),

    /** Unit price at time of assignment */
    precioUnitario: numeric("precio_unitario", { precision: 10, scale: 2 }).notNull(),

    /** Subtotal = cantidad × precio_unitario */
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),

    /** Tenant slug for multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    /** Creation timestamp */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** FK index: look up all parts on a given order */
    ordenIdx: index("orden_repuestos_orden_trabajo_id_idx").on(table.ordenTrabajoId),
    /** Tenant isolation */
    tenantIdx: index("orden_repuestos_tenant_slug_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type OrdenRepuesto = typeof ordenRepuestos.$inferSelect;

/** Row type accepted by INSERT */
export type NewOrdenRepuesto = typeof ordenRepuestos.$inferInsert;
