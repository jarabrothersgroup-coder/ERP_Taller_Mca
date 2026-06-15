/**
 * Herramientas table — Drizzle ORM schema.
 *
 * Master catalog of workshop tools and equipment.
 * Each tool can be assigned to mechanics against work orders
 * via the control_herramientas table.
 *
 * Supports barcode/QR scanning for quick check-in/check-out.
 *
 * @module inventory/schema/herramientas
 */

import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Table ────────────────────────────────────

/**
 * Herramientas — master tool catalog.
 *
 * Tracks available stock, calibration status, and location
 * for every tool in the workshop.
 */
export const herramientas = pgTable(
  "herramientas",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Internal code or barcode number (scannable) */
    codigo: text("codigo").notNull().unique(),

    /** Tool name / description */
    nombre: text("nombre").notNull(),

    /** Detailed description */
    descripcion: text("descripcion"),

    /** Category (e.g. Manuales, Eléctricas, Medición, Seguridad) */
    categoria: text("categoria"),

    /** Manufacturer brand */
    marca: text("marca"),

    /** Manufacturer model */
    modelo: text("modelo"),

    /** Serial number for traceability (legacy — use tool_instances for per-unit tracking) */
    numeroSerie: text("numero_serie"),

    /** Storage location in the workshop */
    ubicacion: text("ubicacion"),

    /** Whether this tool type requires periodic calibration */
    requiereCalibracion: boolean("requiere_calibracion").notNull().default(false),

    /** Whether this SKU tracks individual serialised assets (tool_instances) */
    tieneSerialIndividual: boolean("tiene_serial_individual").notNull().default(true),

    /**
     * Useful life in years for depreciation calculation.
     * NULL = no depreciation (consumable tool).
     */
    vidaUtilAnos: integer("vida_util_anos"),

    /**
     * Depreciation method.
     *   LINEA_RECTA    — Straight-line (cost / vida_util_anos / 12 months)
     *   SIN_DEPRECIAR  — No depreciation applied
     */
    metodoDepreciacion: text("metodo_depreciacion").notNull().default('LINEA_RECTA'),

    /** Replacement cost for insurance/depreciation purposes */
    costoReposicion: numeric("costo_reposicion", { precision: 12, scale: 2 }),

    /**
     * Default Chart of Accounts mapping for this tool category.
     * Overrides inventory_accounts_map for tool-specific accounts.
     * Falls back to cuenta inventario default if NULL.
     */
    categoriaContableId: uuid("categoria_contable_id"),

    /** Soft-delete / active flag */
    activo: boolean("activo").notNull().default(true),

    /** Tool image URL (Supabase Storage) */
    imagenUrl: text("imagen_url"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Unique index on codigo: accelerates barcode/QR lookups */
    codigoIdx: index("herramientas_codigo_idx").on(table.codigo),
    /** Index on categoria: accelerates category filtering */
    categoriaIdx: index("herramientas_categoria_idx").on(table.categoria),
    /** Index on activo: accelerates active-tool listings */
    activoIdx: index("herramientas_activo_idx").on(table.activo),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type Herramienta = typeof herramientas.$inferSelect;

/** Row type accepted by INSERT */
export type NewHerramienta = typeof herramientas.$inferInsert;
