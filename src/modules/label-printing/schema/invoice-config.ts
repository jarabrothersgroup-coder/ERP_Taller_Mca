/**
 * Invoice Print Configuration — Drizzle ORM Schema.
 *
 * Stores per-tenant configuration for invoice printing:
 * - Paper size (58mm, 80mm, A4, custom)
 * - Printer protocol (ESCPOS, PDF, PCL, ZPL)
 * - Visible sections toggles
 * - Company info overrides
 *
 * Conforms to SET Paraguay requirements (RG 1382/05, RG 27/2019).
 *
 * @module label-printing/schema/invoice-config
 */

import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Tables ───────────────────────────────────

/**
 * Invoice print configuration — per-tenant settings.
 *
 * Controls how invoices are rendered for printing:
 * - Paper dimensions and printer protocol
 * - Which sections appear on the printed invoice
 * - Company data overrides for printed headers
 */
export const invoiceConfig = pgTable("invoice_config", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Tenant slug for multi-tenant isolation */
  tenantSlug: text("tenant_slug").notNull().unique(),

  // ── Paper size ──

  /** Paper width in millimeters (80=thermal, 210=A4, 58=mini thermal) */
  paperWidthMm: integer("paper_width_mm").notNull().default(80),

  /** Paper height in millimeters (200=auto-cut, 297=A4) */
  paperHeightMm: integer("paper_height_mm").notNull().default(200),

  // ── Printer settings ──

  /** Printer protocol: ESCPOS (thermal), PDF (HP LaserJet/CUPS), ZPL (Zebra), PCL (HP native) */
  printerProtocol: text("printer_protocol").notNull().default("ESCPOS"),

  /** Printer address (IP address or USB device path, e.g. "192.168.1.100:9100" or "/dev/usb/lp0") */
  printerAddress: text("printer_address"),

  /** Printer DPI (default 203 for most thermal, 600 for HP LaserJet) */
  printerDpi: integer("printer_dpi").notNull().default(203),

  // ── Visible sections (toggle on/off) ──

  /** Show company header (name, RUC, address, phone) */
  showCompanyHeader: boolean("show_company_header").notNull().default(true),

  /** Show client info (name, RUC, address) */
  showClientInfo: boolean("show_client_info").notNull().default(true),

  /** Show line items table (services + spare parts) */
  showLineItems: boolean("show_line_items").notNull().default(true),

  /** Show subtotal before IVA */
  showSubtotal: boolean("show_subtotal").notNull().default(true),

  /** Show IVA breakdown (10% or 5% or exento) */
  showIva: boolean("show_iva").notNull().default(true),

  /** Show barcode (for manual invoices) or QR code (for electronic invoices) */
  showBarcode: boolean("show_barcode").notNull().default(true),

  /** Show QR code (electronic invoices — CDC lookup URL) */
  showQRCode: boolean("show_qr_code").notNull().default(true),

  /** Show footer (gracias, website) */
  showFooter: boolean("show_footer").notNull().default(true),

  /** Show timbrado number (required for manual invoices per RG 1382/05) */
  showTimbrado: boolean("show_timbrado").notNull().default(true),

  /** Show IVA rate per line item */
  showIvaPerLine: boolean("show_iva_per_line").notNull().default(false),

  /** Show condition of conservation for thermal paper (RG 27/2019) */
  showConservation: boolean("show_conservation").notNull().default(false),

  // ── Company info overrides ──

  /** Company name override (if null, uses tenant default) */
  companyNombre: text("company_nombre"),

  /** RUC override */
  companyRuc: text("company_ruc"),

  /** Address override */
  companyDireccion: text("company_direccion"),

  /** Phone override */
  companyTelefono: text("company_telefono"),

  /** Economic activity description (required by SET) */
  companyActividad: text("company_actividad"),

  // ── Timestamps ──

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
