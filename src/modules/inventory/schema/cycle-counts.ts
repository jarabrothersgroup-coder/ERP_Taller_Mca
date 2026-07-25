/**
 * Cycle Counts — Drizzle ORM schema.
 *
 * Tracks physical inventory counts (conteo cíclico) to reconcile
 * system stock with actual physical stock. Each count is associated
 * with a warehouse (almacén) and a list of counted items.
 *
 * Differences trigger automatic stock adjustments and journal entries.
 *
 * @module inventory/schema/cycle-counts
 */

import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { almacenes } from "./almacenes.js";
import { repuestos } from "./repuestos.js";
import { profiles } from "../../../shared/database/schema/profiles.js";

/**
 * Cycle Count — a physical inventory count session.
 */
export const cycleCounts = pgTable(
  "cycle_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Warehouse being counted */
    almacenId: uuid("almacen_id")
      .notNull()
      .references(() => almacenes.id),

    /**
     * Count status:
     *   ABIERTO       → Created, not started
     *   EN_PROGRESO   → Counting in progress
     *   COMPLETADO    → All items counted, pending review
     *   AJUSTADO      → Differences adjusted, closed
     */
    estado: text("estado").notNull().default("ABIERTO"),

    /** Notes about this count session */
    observaciones: text("observaciones"),

    /** User who created/started the count */
    creadoPor: uuid("creado_por").references(() => profiles.id),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    fechaInicio: timestamp("fecha_inicio", { withTimezone: true })
      .notNull()
      .defaultNow(),

    fechaFin: timestamp("fecha_fin", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("cycle_cnt_tenant_idx").on(table.tenantSlug),
    estadoIdx: index("cycle_cnt_estado_idx").on(table.estado),
    almacenIdx: index("cycle_cnt_almacen_idx").on(table.almacenId),
  }),
);

/**
 * Cycle Count Item — a single counted item within a cycle count session.
 */
export const cycleCountItems = pgTable(
  "cycle_count_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent cycle count */
    cycleCountId: uuid("cycle_count_id")
      .notNull()
      .references(() => cycleCounts.id, { onDelete: "cascade" }),

    /** The spare part that was counted */
    repuestoId: uuid("repuesto_id")
      .notNull()
      .references(() => repuestos.id),

    /** System stock BEFORE adjustment */
    stockSistema: integer("stock_sistema").notNull(),

    /** Physical stock counted */
    stockReal: integer("stock_real").notNull(),

    /** Difference: stock_real - stock_sistema (computed by application) */
    diferencia: integer("diferencia").notNull(),

    /** Whether the adjustment has been applied */
    ajustado: boolean("ajustado").notNull().default(false),

    /** Stock adjustment movement ID (if adjusted) */
    movimientoAjusteId: uuid("movimiento_ajuste_id"),

    /** Notes from the counter */
    observaciones: text("observaciones"),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    cycleCountIdx: index("cycle_cnt_item_cnt_idx").on(table.cycleCountId),
    repuestoIdx: index("cycle_cnt_item_rep_idx").on(table.repuestoId),
    tenantIdx: index("cycle_cnt_item_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type CycleCount = typeof cycleCounts.$inferSelect;
export type NewCycleCount = typeof cycleCounts.$inferInsert;
export type CycleCountItem = typeof cycleCountItems.$inferSelect;
export type NewCycleCountItem = typeof cycleCountItems.$inferInsert;
