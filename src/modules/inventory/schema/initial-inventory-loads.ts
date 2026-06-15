/**
 * Initial Inventory Loads table — Drizzle ORM schema.
 *
 * Audit trail for the "Puesta en Marcha" (initial setup) process.
 * Each row records a single item from an initial inventory load batch.
 *
 * This table is APPEND-ONLY: once recorded, rows are never modified.
 * The asiento_id links to the consolidated accounting entry where
 *   Debit:  Asset account (Inventario de Repuestos / Activo Fijo Herramientas)
 *   Credit: Equity account (Ajustes de Ejercicios Anteriores / Resultados Acumulados)
 *
 * This ensures the initial load is audited separately from ordinary
 * purchases and never touches supplier (Cuentas por Pagar) accounts.
 *
 * @module inventory/schema/initial-inventory-loads
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
import { asientosContables } from "../../finance/schema/accounting.js";

// ─── Table ────────────────────────────────────

/**
 * Initial Inventory Loads — one row per item in an initial load batch.
 *
 * Each load generates a single consolidated accounting entry linked
 * via `asiento_id`. The `tipo` field distinguishes between spare parts
 * and tools, each of which uses a different asset account.
 */
export const initialInventoryLoads = pgTable(
  "initial_inventory_loads",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Load type:
     *   REPUESTOS    → Spare parts inventory (cuenta de activo: Inventario)
     *   HERRAMIENTAS → Workshop tools (cuenta de activo: Activo Fijo Herramientas)
     */
    tipo: text("tipo").notNull(),

    /**
     * Batch identifier — groups items that were loaded together
     * in a single POST /inventory/initial-load request.
     * Format: "LOAD-{YYYYMMDD}-{XXXX}" (auto-generated)
     */
    batchId: text("batch_id").notNull(),

    /**
     * Item reference (polyorphic):
     *   If tipo=REPUESTOS:    repuesto_id
     *   If tipo=HERRAMIENTAS: tool_instance_id
     */
    itemId: uuid("item_id").notNull(),

    /**
     * Human-readable description of the item at load time.
     * Denormalised for audit — won't change if the item is later renamed.
     */
    itemDescripcion: text("item_descripcion").notNull(),

    /** Quantity loaded */
    cantidad: integer("cantidad").notNull(),

    /**
     * Unit value — the user-assessed "Valor Estimado de Mercado"
     * or "Valor de Reposición Ajustado" for repuestos,
     * or "Valor Neto Actual" (cost − accumulated depreciation) for tools.
     */
    valorUnitario: numeric("valor_unitario", { precision: 12, scale: 2 }).notNull(),

    /** Total line value = valorUnitario × cantidad */
    valorTotal: numeric("valor_total", { precision: 12, scale: 2 }).notNull(),

    /**
     * Chart of Accounts — asset account used for the Debit side
     * of the accounting entry for this item.
     */
    cuentaActivoId: uuid("cuenta_activo_id").notNull(),

    /**
     * Consolidated accounting entry for the entire load batch.
     * All items in the same batch share the same asiento_id.
     * Debit:  sum of all cuentaActivoId (per item, per account)
     * Credit: single equity account (cuentaPatrimonioId)
     */
    asientoId: uuid("asiento_id").references(() => asientosContables.id),

    /**
     * Equity account used for the Credit side.
     * Stored here for audit — the entire batch shares one equity account.
     */
    cuentaPatrimonioId: uuid("cuenta_patrimonio_id").notNull(),

    /** Free-text notes for this specific item */
    observaciones: text("observaciones"),

    // ─── Multi-Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps (append-only) ────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Index on batch_id: group by load batch */
    batchIdx: index("init_load_batch_idx").on(table.batchId),
    /** Index on tipo: filter by repuestos/herramientas */
    tipoIdx: index("init_load_tipo_idx").on(table.tipo),
    /** Index on item_id: find loads for a specific item */
    itemIdx: index("init_load_item_idx").on(table.itemId),
    /** Index on asiento_id: trace from accounting entry */
    asientoIdx: index("init_load_asiento_idx").on(table.asientoId),
    /** Tenant-scoped index */
    tenantIdx: index("init_load_tenant_idx").on(table.tenantSlug),
    /** Index on creation date */
    createdAtIdx: index("init_load_created_idx").on(table.createdAt),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type InitialInventoryLoad = typeof initialInventoryLoads.$inferSelect;

/** Row type accepted by INSERT */
export type NewInitialInventoryLoad = typeof initialInventoryLoads.$inferInsert;
