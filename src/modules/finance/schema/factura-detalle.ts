/**
 * Factura Detalle — Line items for hybrid invoices.
 *
 * Stores individual service and parts line items for each invoice.
 * Links to orden_servicios and orden_repuestos for traceability.
 *
 * During SIFEN integration, these will migrate to fiscal_documento_detalles.
 *
 * @module finance/schema/factura-detalle
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
import { facturas } from "./facturas.js";

// ─── Table ────────────────────────────────────

/**
 * Líneas de detalle de factura.
 *
 * Cada fila corresponde a un ítem (servicio o repuesto) facturado.
 * Se genera automáticamente al emitir factura desde una OT.
 */
export const facturaDetalles = pgTable(
  "factura_detalles",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent invoice (FK → facturas) */
    facturaId: uuid("factura_id")
      .notNull()
      .references(() => facturas.id, { onDelete: "cascade" }),

    /** Line number within the invoice */
    numeroLinea: integer("numero_linea").notNull(),

    /** Line type: SERVICIO | REPUESTO */
    tipoLinea: text("tipo_linea").notNull(),

    /** Description (service name or part name) */
    descripcion: text("descripcion").notNull(),

    /** Quantity */
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),

    /** Unit price (Gs.) */
    precioUnitario: numeric("precio_unitario", { precision: 14, scale: 2 }).notNull(),

    /** IVA rate: 0, 5, or 10 */
    iva: integer("iva").notNull().default(10),

    /** IVA amount */
    ivaMonto: numeric("iva_monto", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Subtotal before IVA */
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),

    /** Optional FK to orden_servicios */
    ordenServicioId: uuid("orden_servicio_id"),

    /** Optional FK to orden_repuestos */
    ordenRepuestoId: uuid("orden_repuesto_id"),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    /** Timestamps */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    facturaIdx: index("factura_detalles_factura_id_idx").on(table.facturaId),
    tenantIdx: index("factura_detalles_tenant_slug_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type FacturaDetalle = typeof facturaDetalles.$inferSelect;

/** Row type accepted by INSERT */
export type NewFacturaDetalle = typeof facturaDetalles.$inferInsert;
