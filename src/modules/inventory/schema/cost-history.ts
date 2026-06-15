/**
 * Cost History table — Drizzle ORM schema.
 *
 * Records every PPP (Precio Promedio Ponderado) recalculation event
 * for full auditability of inventory costing.
 *
 * Every stock input (purchase, return) that changes the weighted average
 * cost inserts a row here, capturing the before/after values.
 *
 * @module inventory/schema/cost-history
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
import { repuestos } from "./repuestos.js";
import { stockMovements } from "./stock-movements.js";

// ─── Table ────────────────────────────────────

/**
 * Cost History — PPP calculation audit trail.
 *
 * Each row records one PPP recalculation event, typically triggered
 * by a stock input from a purchase order.
 *
 * The PPP formula:
 *   PPP_new = (StockAnterior × PPP_anterior + CantNueva × CostoNuevo) / (StockAnterior + CantNueva)
 */
export const costHistory = pgTable(
  "cost_history",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** The repuesto whose PPP was recalculated */
    repuestoId: uuid("repuesto_id")
      .notNull()
      .references(() => repuestos.id),

    /** When the recalculation happened */
    fecha: timestamp("fecha", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * Event type:
     *   COMPRA  → Purchase order receipt
     *   AJUSTE  → Manual cost adjustment
     *   INICIAL → Initial cost setup
     */
    tipo: text("tipo").notNull(),

    /** Stock quantity BEFORE the event */
    cantidadAnterior: integer("cantidad_anterior").notNull(),

    /** Quantity added in this event */
    cantidadNueva: integer("cantidad_nueva").notNull(),

    /** Stock quantity AFTER the event */
    cantidadFinal: integer("cantidad_final").notNull(),

    /** PPP value BEFORE the event */
    ppAnterior: numeric("pp_anterior", { precision: 12, scale: 2 }).notNull(),

    /** Unit cost of the incoming lot (purchase price) */
    costoUnitarioNuevo: numeric("costo_unitario_nuevo", {
      precision: 12,
      scale: 2,
    }),

    /** PPP value AFTER the event */
    ppFinal: numeric("pp_final", { precision: 12, scale: 2 }).notNull(),

    /** The stock movement that triggered this recalculation */
    movimientoId: uuid("movimiento_id").references(() => stockMovements.id),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    repuestoIdx: index("cost_hist_repuesto_idx").on(table.repuestoId),
    fechaIdx: index("cost_hist_fecha_idx").on(table.fecha),
    tenantIdx: index("cost_hist_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type CostHistoryEntry = typeof costHistory.$inferSelect;
export type NewCostHistoryEntry = typeof costHistory.$inferInsert;
