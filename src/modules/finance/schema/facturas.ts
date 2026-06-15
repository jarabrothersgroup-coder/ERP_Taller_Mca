/**
 * Facturas — Hybrid Invoice Table (SIFEN-004-HYBRID).
 *
 * Dual-engine invoice registry for the transitional period:
 *   - **MANUAL**: Pre-printed / software-printed invoices (no CDC yet)
 *   - **ELECTRONICA**: Full SIFEN DTE with X.509 signature and DNIT CDC
 *
 * When DNIT homologation is approved, a feature flag switches to full DTE mode
 * and accumulated MANUAL records can be retroactively converted via batch parser.
 *
 * RAM constraint: inserted via single Drizzle transaction, no open cursors.
 *
 * @module finance/schema/facturas
 */

import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { asientosContables } from "./accounting.js";

// ─── Enums ─────────────────────────────────────

/**
 * Tipo de facturación del motor híbrido.
 */
export const tipoFacturacionEnum = pgEnum("tipo_facturacion", [
  "MANUAL",
  "ELECTRONICA",
]);

export type TipoFacturacion = (typeof tipoFacturacionEnum.enumValues)[number];

/**
 * Estado del documento frente al SIFEN.
 * - `OFFLINE_PENDING`: generado en modo manual, pendiente de conversión
 * - `MANUAL_CONVERT_QUEUE`: factura manual en cola para futura conversión
 * - `APROBADO_DNIT`: aprobado por la DNIT con CDC asignado
 * - `RECHAZADO`: rechazado por la DNIT
 */
export const sifenStatusEnum = pgEnum("sifen_status", [
  "OFFLINE_PENDING",
  "MANUAL_CONVERT_QUEUE",
  "APROBADO_DNIT",
  "RECHAZADO",
]);

export type SifenStatus = (typeof sifenStatusEnum.enumValues)[number];

// ─── Table ─────────────────────────────────────

/**
 * Facturas — registro de facturación del taller.
 *
 * Cada fila corresponde a una emisión (manual o electrónica) vinculada
 * a una orden de trabajo. Durante la etapa transicional, las facturas
 * manuales se registran con `sifen_cdc = NULL` y `sifen_status = 'MANUAL_CONVERT_QUEUE'`
 * para su posterior migración cuando la DNIT apruebe las credenciales.
 */
export const facturas = pgTable(
  "facturas",
  {
    /** Primary key UUID */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Tenant slug for multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    /** Work order that generated this invoice */
    ordenId: uuid("orden_id").notNull(),

    /** Hybrid engine branch: MANUAL | ELECTRONICA */
    tipo: tipoFacturacionEnum("tipo").notNull(),

    /**
     * Pre-printed invoice number (e.g. "001-001-0001234").
     * Required when `tipo = 'MANUAL'`, NULL for ELECTRONICA.
     */
    numeroFacturaManual: text("numero_factura_manual"),

    /**
     * CDC (Código de Control) — 44-character DNIT code.
     * NULL for manual invoices; populated after DNIT approval.
     */
    sifenCdc: text("sifen_cdc"),

    /** SIFEN lifecycle status */
    sifenStatus: sifenStatusEnum("sifen_status").notNull().default("OFFLINE_PENDING"),

    /** Raw DTE XML before signing */
    xmlRaw: text("xml_raw"),

    /** Signed XML (after X.509 envelope) — NULL for manual invoices */
    xmlSigned: text("xml_signed"),

    /** Accounting entry generated for this invoice (Sprint 6) */
    asientoId: uuid("asiento_id").references(() => asientosContables.id),

    /** Total invoice amount (Gs. or USD) */
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),

    /** Estado de cobro: PENDIENTE | PARCIAL | PAGA | ANULADA (Sprint 7) */
    estadoPago: text("estado_pago").default("PENDIENTE"),

    /** Saldo pendiente de cobro (0 si PAGA) */
    saldoPendiente: numeric("saldo_pendiente", { precision: 14, scale: 2 }),

    /** Fecha límite de pago */
    fechaVencimiento: timestamp("fecha_vencimiento", { withTimezone: true }),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("facturas_tenant_slug_idx").on(table.tenantSlug),
    ordenIdx: index("facturas_orden_id_idx").on(table.ordenId),
    cdcIdx: index("facturas_sifen_cdc_idx").on(table.sifenCdc),
    estadoPagoIdx: index("facturas_estado_pago_idx").on(table.estadoPago),
    vencimientoIdx: index("facturas_vencimiento_idx").on(table.fechaVencimiento),
  }),
);

// ─── Types ────────────────────────────────────

export type Factura = typeof facturas.$inferSelect;
export type NewFactura = typeof facturas.$inferInsert;
export type EstadoPagoFactura = "PENDIENTE" | "PARCIAL" | "PAGA" | "ANULADA";
