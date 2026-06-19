/**
 * Label Printing — Drizzle ORM Schema.
 *
 * Stores configurable label templates for thermal/label printers.
 * Supports ESC/POS (Epson/Xprinter), ZPL (Zebra), and TSPL (Brother).
 * Each template defines size, protocol, and layout for a specific use case:
 *   - Etiqueta de repuesto (50x30mm, Code128, ESC/POS)
 *   - Rótulo de herramienta pesada (60x40mm, QR, ZPL)
 *
 * @module label-printing/schema
 */

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────

export const printerProtocolEnum = pgEnum("printer_protocol", [
  "ESCPOS",   // Epson, Xprinter, Star Micronics
  "ZPL",      // Zebra
  "TSPL",     // Brother, TSC, SATO
  "RAW_TEXT", // Plain text fallback
]);

export const labelTypeEnum = pgEnum("label_type", [
  "REPUESTO",         // Spare part label (50x30mm)
  "HERRAMIENTA",      // Heavy tool label (60x40mm)
  "PERSONALIZADA",    // Custom user-defined label
]);

// ─── Tables ───────────────────────────────────

/**
 * Label templates — configurable print layouts.
 *
 * Each template stores the full print configuration including:
 * - Physical dimensions (width x height in mm)
 * - Printer protocol commands
 * - Content layout (which fields to show, positioning)
 * - Default printer IP/name for this template type
 */
export const labelTemplates = pgTable("label_templates", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Template name (e.g. "Etiqueta Repuesto Estándar") */
  nombre: text("nombre").notNull(),

  /** Label type classification */
  tipo: labelTypeEnum("tipo").notNull().default("REPUESTO"),

  /** Printer protocol */
  protocolo: printerProtocolEnum("protocolo").notNull().default("ESCPOS"),

  /** Label width in millimeters */
  anchoMm: integer("ancho_mm").notNull().default(50),

  /** Label height in millimeters */
  altoMm: integer("alto_mm").notNull().default(30),

  /** DPI of the target printer (default 203 for most thermal printers) */
  dpi: integer("dpi").notNull().default(203),

  /** Default printer IP address or USB device path */
  impresoraDefault: text("impresora_default"),

  /** Default number of copies */
  copiasDefault: integer("copias_default").notNull().default(1),

  /**
   * Template layout configuration (JSON).
   * Structure depends on protocolo:
   *
   * ESCPOS layout:
   * {
   *   "fields": [
   *     { "type": "barcode", "format": "CODE128", "dataField": "codigo_barras", "y": 0, "height": 40 },
   *     { "type": "text", "dataField": "descripcion", "y": 45, "fontSize": "SMALL", "align": "CENTER", "maxChars": 20 },
   *     { "type": "text", "dataField": "marca", "y": 60, "fontSize": "SMALL", "bold": true }
   *   ],
   *   "cutPaper": true
   * }
   *
   * ZPL layout:
   * {
   *   "fields": [
   *     { "type": "barcode", "format": "CODE128", "dataField": "codigo_barras", "x": 10, "y": 10, "height": 100 },
   *     { "type": "text", "dataField": "descripcion", "x": 10, "y": 120, "fontSize": 18 }
   *   ]
   * }
   */
  layout: jsonb("layout").notNull().default({ fields: [], cutPaper: true }),

  /** Is this template active? */
  activo: boolean("activo").notNull().default(true),

  /** Tenant slug for multi-tenant isolation */
  tenantSlug: text("tenant_slug").notNull(),

  /** Creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** Last update timestamp */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Print job log — tracks every label print request.
 *
 * Used for audit trail and print queue management.
 */
export const printJobs = pgTable("print_jobs", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Template used */
  templateId: uuid("template_id").references(() => labelTemplates.id),

  /** Entity type being printed (repuesto, herramienta, personalizada) */
  entityType: text("entity_type").notNull(),

  /** Entity ID (repuesto.id or herramienta.id) */
  entityId: text("entity_id").notNull(),

  /** Number of copies requested */
  copias: integer("copias").notNull().default(1),

  /** Target printer IP/path */
  impresora: text("impresora").notNull(),

  /** Protocol used for this job */
  protocolo: printerProtocolEnum("protocolo").notNull(),

  /** Raw print payload (ESC/POS bytes, ZPL commands, etc.) */
  payload: text("payload").notNull(),

  /** Job status */
  estado: text("estado").notNull().default("PENDIENTE"),

  /** Error message if job failed */
  error: text("error"),

  /** Tenant slug */
  tenantSlug: text("tenant_slug").notNull(),

  /** Creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
