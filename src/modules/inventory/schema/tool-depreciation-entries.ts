/**
 * Tool Depreciation Entries table — Drizzle ORM schema.
 *
 * Records monthly depreciation calculations for each tool asset.
 * Depreciation is calculated using the straight-line method
 * over the tool's useful life (from herramienta.vida_util_anos).
 *
 * Each entry is linked to an accounting entry that debits
 * Gasto Depreciación Herramientas and credits
 * Depreciación Acumulada — Herramientas.
 *
 * @module inventory/schema/tool-depreciation-entries
 */

import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { toolInstances } from "./tool-instances.js";
import { asientosContables } from "../../finance/schema/accounting.js";

// ─── Table ────────────────────────────────────

/**
 * Tool Depreciation Entries — monthly depreciation trail.
 *
 * One row per tool_instance per month of depreciation.
 * The asiento_id links to the journal entry that records
 * the accounting impact.
 */
export const toolDepreciationEntries = pgTable(
  "tool_depreciation_entries",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** The tool asset being depreciated */
    toolInstanceId: uuid("tool_instance_id")
      .notNull()
      .references(() => toolInstances.id, { onDelete: "cascade" }),

    /** Depreciation date (last day of the period) */
    fecha: date("fecha").notNull(),

    /** Period identifier (e.g. "2026-06") */
    periodo: text("periodo").notNull(),

    /** Book value at START of this period */
    valorInicial: numeric("valor_inicial", { precision: 12, scale: 2 }).notNull(),

    /** Book value at END of this period */
    valorFinal: numeric("valor_final", { precision: 12, scale: 2 }).notNull(),

    /** Depreciation amount for this period */
    montoDepreciacion: numeric("monto_depreciacion", { precision: 12, scale: 2 }).notNull(),

    /** Accounting entry generated for this depreciation */
    asientoId: uuid("asiento_id").references(() => asientosContables.id),

    // ─── Multi-Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Index on tool_instance_id */
    instanceIdx: index("tool_depr_instance_idx").on(table.toolInstanceId),
    /** Index on period for monthly queries */
    periodoIdx: index("tool_depr_periodo_idx").on(table.periodo),
    /** Index on date */
    fechaIdx: index("tool_depr_fecha_idx").on(table.fecha),
    /** Tenant-scoped index */
    tenantIdx: index("tool_depr_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type ToolDepreciationEntry = typeof toolDepreciationEntries.$inferSelect;

/** Row type accepted by INSERT */
export type NewToolDepreciationEntry = typeof toolDepreciationEntries.$inferInsert;
