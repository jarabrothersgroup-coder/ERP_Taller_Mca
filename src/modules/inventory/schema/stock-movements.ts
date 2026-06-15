/**
 * Stock Movements table — Drizzle ORM schema.
 *
 * Tracks every stock input/output/adjustment with full audit trail,
 * linking to work orders, accounting entries, and users.
 * This is the core traceability table for inventory costing (PPP).
 *
 * @module inventory/schema/stock-movements
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
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";
import { asientosContables } from "../../finance/schema/accounting.js";
import { profiles } from "../../../shared/database/schema/profiles.js";

// ─── Table ────────────────────────────────────

/**
 * Stock Movements — audit trail for all inventory transactions.
 *
 * Every salida/ingreso/ajuste creates one row. The movement is linked
 * to the originating repuesto, optional OT, optional accounting entry,
 * and the user who performed it.
 *
 * Cost values are recorded at the PPP-weighted-average at time of movement.
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** The repuesto (spare part) that was moved */
    repuestoId: uuid("repuesto_id")
      .notNull()
      .references(() => repuestos.id),

    /**
     * Movement type:
     *   ENTRADA       → Stock increase (purchase, return, adjustment)
     *   SALIDA        → Stock decrease (sale, OT consumption, adjustment)
     *   AJUSTE        → Manual inventory adjustment (+/-)
     *   TRANSFERENCIA → Between warehouses (future)
     */
    tipo: text("tipo").notNull(),

    /** Absolute quantity moved (always positive) */
    cantidad: integer("cantidad").notNull(),

    /** Stock level BEFORE this movement */
    stockAnterior: integer("stock_anterior").notNull(),

    /** Stock level AFTER this movement */
    stockPosterior: integer("stock_posterior").notNull(),

    /** PPP-weighted-average cost per unit at time of movement */
    costoUnitario: numeric("costo_unitario", { precision: 12, scale: 2 }),

    /** Total cost: costoUnitario × cantidad */
    costoTotal: numeric("costo_total", { precision: 12, scale: 2 }),

    /** Optional work order that consumed this part */
    ordenTrabajoId: uuid("orden_trabajo_id").references(
      () => ordenesTrabajo.id,
    ),

    /** Optional purchase order that supplied this part */
    purchaseOrderId: uuid("purchase_order_id"),

    /** Accounting entry generated for this movement (if applicable) */
    asientoId: uuid("asiento_id").references(
      () => asientosContables.id,
    ),

    /** Reason for the movement (e.g. "Uso en OT", "Compra") */
    motivo: text("motivo").notNull(),

    /** Optional notes */
    observaciones: text("observaciones"),

    /** User who performed the movement */
    usuarioId: uuid("usuario_id").references(() => profiles.id),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    repuestoIdx: index("stock_mov_repuesto_idx").on(table.repuestoId),
    tipoIdx: index("stock_mov_tipo_idx").on(table.tipo),
    otIdx: index("stock_mov_ot_idx").on(table.ordenTrabajoId),
    tenantIdx: index("stock_mov_tenant_idx").on(table.tenantSlug),
    createdAtIdx: index("stock_mov_created_idx").on(table.createdAt),
  }),
);

// ─── Types ────────────────────────────────────

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
