/**
 * Repuestos table — Drizzle ORM schema.
 *
 * Spare parts inventory for the automotive workshop.
 * Supports barcode and QR code scanning for instant lookups
 * via the `codigo_barras` field (unique, indexed).
 *
 * Stock levels are tracked with min/max thresholds to support
 * automatic reorder alerts. Prices are stored in guaraníes (Gs.)
 * or USD depending on the tenant's preference, using NUMERIC(12,2).
 *
 * @module inventory/schema/repuestos
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
 * Repuestos — spare parts and consumables inventory.
 *
 * Every part has a unique internal `codigo` and an optional
 * `codigo_barras` (EAN-13, QR, or DataMatrix) for scanner-based
 * stock operations. The barcode index enables instant searches
 * required by @qa-optimizer validation.
 */
export const repuestos = pgTable(
  "repuestos",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Internal part code (e.g. "FIL-001", "FRENO-023") */
    codigo: text("codigo").notNull().unique(),

    /**
     * Barcode / QR code value.
     * Supports EAN-13, CODE-128, QR, and DataMatrix formats.
     * Unique and indexed for instant scanner-based lookups.
     */
    codigoBarras: text("codigo_barras").unique(),

    /** Part description / name */
    descripcion: text("descripcion").notNull(),

    /** Manufacturer brand */
    marca: text("marca"),

    /** Manufacturer model or OEM number */
    modelo: text("modelo"),

    /**
     * Part category.
     * Examples: Filtros, Frenos, Motor, Suspensión,
     * ElÉctrico, Dirección, Transmisión, ESC, Carrocería
     */
    categoria: text("categoria"),

    /** Cost price (last purchase price) */
    precioCosto: numeric("precio_costo", { precision: 12, scale: 2 }),

    /**
     * Weighted average cost (PPP — Precio Promedio Ponderado).
     * Recalculated automatically on every stock input with a purchase cost.
     * Used for inventory valuation and COGS calculation.
     */
    costoPromedio: numeric("costo_promedio", { precision: 12, scale: 2 }),

    /** Sale price to clients */
    precioVenta: numeric("precio_venta", { precision: 12, scale: 2 }),

    /** Current stock quantity */
    stockActual: integer("stock_actual").notNull().default(0),

    /** Minimum stock threshold for reorder alerts */
    stockMinimo: integer("stock_minimo").notNull().default(0),

    /** Maximum stock capacity */
    stockMaximo: integer("stock_maximo"),

    /** Reorder point — when stock_actual drops below this, create a reorder alert */
    puntoReorden: integer("punto_reorden"),

    /** Preferred supplier UUID (references clients table) */
    proveedorPreferidoId: uuid("proveedor_preferido_id"),

    /** Economic order quantity — suggested quantity to reorder */
    loteEconomico: integer("lote_economico"),

    /** Warehouse / shelf location (e.g. "Estante A3") */
    ubicacion: text("ubicacion"),

    /** Unit of measure (e.g. "unidad", "litro", "kg", "par") */
    unidadMedida: text("unidad_medida").notNull().default("unidad"),

    /** Preferred supplier / vendor */
    proveedor: text("proveedor"),

    /** Vehicle compatibility notes */
    compatibleCon: text("compatible_con"),

    /** Soft-delete / active flag */
    activo: boolean("activo").notNull().default(true),

    /** Part image URL (Supabase Storage) */
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
    /**
     * Index on codigo_barras — required for instant barcode/QR
     * scanner lookups. @qa-optimizer validates this index exists
     * in Supabase for sub-100ms search responses.
     */
    codigoBarrasIdx: index("repuestos_codigo_barras_idx").on(
      table.codigoBarras,
    ),
    /** Index on codigo: accelerates internal code lookups */
    codigoIdx: index("repuestos_codigo_idx").on(table.codigo),
    /** Index on categoria: accelerates category-based filtering */
    categoriaIdx: index("repuestos_categoria_idx").on(table.categoria),
    /**
     * Index on stock_actual + stock_minimo: accelerates low-stock
     * alert queries for the dashboard.
     */
    stockAlertIdx: index("repuestos_stock_alert_idx").on(
      table.stockActual,
      table.stockMinimo,
    ),
    /** Index on activo: accelerates active-parts listings */
    activoIdx: index("repuestos_activo_idx").on(table.activo),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type Repuesto = typeof repuestos.$inferSelect;

/** Row type accepted by INSERT */
export type NewRepuesto = typeof repuestos.$inferInsert;
