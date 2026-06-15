/**
 * Reorder Alerts table — Drizzle ORM schema.
 *
 * Automatic low-stock alerts generated when stock_actual drops
 * below punto_reorden. Each alert tracks its resolution lifecycle:
 *   PENDIENTE → EN_OC (included in a PO) → RESUELTO
 *
 * @module inventory/schema/reorder-alerts
 */

import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { repuestos } from "./repuestos.js";
import { purchaseOrders } from "./purchase-orders.js";

// ─── Table ────────────────────────────────────

/**
 * Reorder Alerts — low-stock notifications.
 *
 * Generated automatically when a stock output causes stock_actual
 * to fall below punto_reorden. Can also be created manually.
 */
export const reorderAlerts = pgTable(
  "reorder_alerts",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** The repuesto that triggered the alert */
    repuestoId: uuid("repuesto_id")
      .notNull()
      .references(() => repuestos.id),

    /** Current stock at time of alert */
    stockActual: integer("stock_actual").notNull(),

    /** Reorder point that was breached */
    puntoReorden: integer("punto_reorden").notNull(),

    /**
     * Alert status:
     *   PENDIENTE → Not yet actioned
     *   EN_OC     → Added to a purchase order
     *   RESUELTO  → Stock replenished above reorder point
     */
    estado: text("estado").notNull().default("PENDIENTE"),

    /** Purchase order that includes this item (if EN_OC) */
    ocGeneradaId: uuid("oc_generada_id").references(
      () => purchaseOrders.id,
    ),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** When the alert was resolved */
    resueltoAt: timestamp("resuelto_at", { withTimezone: true }),
  },
  (table) => ({
    repuestoIdx: index("reorder_repuesto_idx").on(table.repuestoId),
    estadoIdx: index("reorder_estado_idx").on(table.estado),
    tenantIdx: index("reorder_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type ReorderAlert = typeof reorderAlerts.$inferSelect;
export type NewReorderAlert = typeof reorderAlerts.$inferInsert;
