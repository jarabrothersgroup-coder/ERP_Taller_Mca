/**
 * Tool Instances table — Drizzle ORM schema.
 *
 * Represents individual physical tool assets. Each row is one
 * serialised tool unit, enabling per-asset lifecycle tracking:
 * location, state, calibration, maintenance, depreciation, and write-off.
 *
 * This replaces the fungible stockTotal/stockDisponible model where
 * herramientas were treated as SKUs with quantity — now each unit
 * is tracked independently with its own estado_actual state machine.
 *
 * @module inventory/schema/tool-instances
 */

import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { herramientas } from "./herramientas.js";
import { planCuentas } from "../../finance/schema/accounting.js";
import { asientosContables } from "../../finance/schema/accounting.js";
import { profiles } from "../../../shared/database/schema/profiles.js";

// ─── Table ────────────────────────────────────

/**
 * Tool Instances — individual physical tool assets.
 *
 * Each row represents ONE physical tool. The `herramienta_id` FK
 * references the catalog/SKU entry (herramientas). This enables:
 *   - Per-serial-number tracking
 *   - Per-asset state machine (DISPONIBLE → PRESTADA → EN_REPARACION → ...)
 *   - Calibration scheduling per unit
 *   - Depreciation and write-off accounting
 */
export const toolInstances = pgTable(
  "tool_instances",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Catalog SKU this asset belongs to (FK → herramientas) */
    herramientaId: uuid("herramienta_id")
      .notNull()
      .references(() => herramientas.id, { onDelete: "restrict" }),

    // ─── Physical Identification ─────────────────
    /** Manufacturer serial number (unique per herramienta_id) */
    numeroSerie: text("numero_serie").notNull(),

    /** RFID/NFC tag code (globally unique) */
    tagRfid: text("tag_rfid"),

    /** Barcode / QR code (globally unique) */
    codigoBarras: text("codigo_barras"),

    /** Internal inventory code (e.g. "HERR-001") */
    codigoInventario: text("codigo_inventario"),

    // ─── Cost & Valuation ────────────────────────
    /** Original purchase cost */
    costoAdquisicion: numeric("costo_adquisicion", { precision: 12, scale: 2 }).notNull().default("0"),

    /** Purchase date */
    fechaAdquisicion: date("fecha_adquisicion").notNull(),

    /** Current book value after accumulated depreciation */
    valorActualLibros: numeric("valor_actual_libros", { precision: 12, scale: 2 }).notNull().default("0"),

    /** Last time depreciation was calculated */
    ultimaDepreciacion: date("ultima_depreciacion"),

    // ─── State Machine ────────────────────────────
    /**
     * Current operational state.
     *
     *   DISPONIBLE       — In storage, ready for checkout
     *   PRESTADA         — Checked out to a technician (active tool_loans record)
     *   EN_REPARACION    — Being repaired (external workshop)
     *   EN_CALIBRACION   — Undergoing calibration
     *   EXTRAVIADA       - Reported lost
     *   DADO_DE_BAJA     — Written off (obsolete, destroyed, lost)
     */
    estadoActual: text("estado_actual").notNull().default('DISPONIBLE'),

    /** Current physical location description */
    ubicacionActual: text("ubicacion_actual"),

    // ─── Calibration ──────────────────────────────
    /** Whether this tool type requires periodic calibration */
    requiereCalibracion: boolean("requiere_calibracion").notNull().default(false),

    /** Last successful calibration date */
    ultimaCalibracion: date("ultima_calibracion"),

    /** Next calibration due date */
    proximaCalibracion: date("proxima_calibracion"),

    /** Calibration interval in days (e.g. 180 = every 6 months) */
    diasIntervaloCalibracion: numeric("dias_intervalo_calibracion"),

    // ─── Lifecycle ────────────────────────────────
    /** Whether this asset is active (not soft-deleted) */
    activa: boolean("activa").notNull().default(true),

    /** Date of write-off */
    fechaBaja: date("fecha_baja"),

    /** Reason for write-off */
    motivoBaja: text("motivo_baja"),

    /** Accounting entry for the write-off */
    asientoBajaId: uuid("asiento_baja_id").references(() => asientosContables.id),

    // ─── Current Custodian (denormalised for fast queries) ──
    /** Technician who currently has this tool (NULL if DISPONIBLE) */
    tecnicoActualId: uuid("tecnico_actual_id").references(() => profiles.id),
    /** Work order this tool is currently assigned to (NULL if DISPONIBLE) */
    ordenTrabajoActualId: uuid("orden_trabajo_actual_id"),

    // ─── Accounting Integration ────────────────────
    /** Chart of Accounts mapping for this asset (overrides herramienta.categoriaContableId) */
    categoriaContableId: uuid("categoria_contable_id").references(() => planCuentas.id),

    // ─── Multi-Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Unique serial per catalog SKU */
    herramientaSerieUnique: unique("tool_instances_herramienta_serie_unique").on(
      table.herramientaId,
      table.numeroSerie,
    ),

    /** Unique RFID tag */
    rfidUnique: unique("tool_instances_rfid_unique").on(table.tagRfid),

    /** Unique barcode */
    barcodeUnique: unique("tool_instances_barcode_unique").on(table.codigoBarras),

    /** Unique inventory code */
    inventarioUnique: unique("tool_instances_inventario_unique").on(table.codigoInventario),

    /** Index on estado_actual for "which tools are available?" queries */
    estadoIdx: index("tool_instances_estado_idx").on(table.estadoActual),

    /** Composite index for tenant-scoped state queries */
    tenantEstadoIdx: index("tool_instances_tenant_estado_idx").on(
      table.tenantSlug,
      table.estadoActual,
    ),

    /** Index on herramienta_id for "all assets of this SKU?" queries */
    herramientaIdx: index("tool_instances_herramienta_idx").on(table.herramientaId),

    /** Index on current technician */
    tecnicoIdx: index("tool_instances_tecnico_idx").on(table.tecnicoActualId),

    /** Partial index on upcoming calibration */
    proxCalIdx: index("tool_instances_prox_cal_idx").on(table.proximaCalibracion),

    /** Index on active status */
    activaIdx: index("tool_instances_activa_idx").on(table.activa),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type ToolInstance = typeof toolInstances.$inferSelect;

/** Row type accepted by INSERT */
export type NewToolInstance = typeof toolInstances.$inferInsert;
