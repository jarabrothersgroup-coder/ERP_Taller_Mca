/**
 * Compras — Registro de Facturas de Compra (proveedores).
 *
 * Módulo de compras: facturas recibidas de proveedores con su detalle
 * de líneas (repuestos, servicios, etc.). Alimenta la centralización
 * contable de COMPRAS y el módulo de tesorería (CxP).
 *
 * Multi-tenant: toda fila lleva `tenant_slug`.
 *
 * @module finance/schema/compras
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

// ─── Enums ─────────────────────────────────────

/** Estado de pago de la factura de compra. */
export const estadoPagoCompraEnum = pgEnum("estado_pago_compra", [
  "PENDIENTE",
  "PARCIAL",
  "PAGADO",
  "ANULADA",
]);

export type EstadoPagoCompra =
  (typeof estadoPagoCompraEnum.enumValues)[number];

// ─── Tables ────────────────────────────────────

export const compras = pgTable(
  "compras",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Número de factura del proveedor */
    numeroFactura: text("numero_factura").notNull(),

    /** ID del proveedor (reusa tabla clients del tenant cuando aplique) */
    proveedorId: uuid("proveedor_id"),

    /** Nombre del proveedor (denormalizado para trazabilidad) */
    proveedorNombre: text("proveedor_nombre").notNull(),

    /** Fecha de emisión de la factura */
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),

    /** Fecha de vencimiento */
    fechaVencimiento: timestamp("fecha_vencimiento", { withTimezone: true }),

    /** Monto total (suma de los detalles) */
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),

    /** Estado de pago */
    estadoPago: estadoPagoCompraEnum("estado_pago")
      .notNull()
      .default("PENDIENTE"),

    /** Notas / concepto */
    notas: text("notas"),

    // ─── Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("compras_tenant_idx").on(table.tenantSlug),
    estadoIdx: index("compras_estado_idx").on(table.estadoPago),
    proveedorIdx: index("compras_proveedor_idx").on(table.proveedorId),
    fechaIdx: index("compras_fecha_idx").on(table.fecha),
  }),
);

export const compraDetalles = pgTable(
  "compra_detalles",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    compraId: uuid("compra_id")
      .notNull()
      .references(() => compras.id, { onDelete: "cascade" }),

    descripcion: text("descripcion").notNull(),

    cantidad: numeric("cantidad", { precision: 12, scale: 2 })
      .notNull()
      .default("1"),

    precioUnitario: numeric("precio_unitario", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),

    subtotal: numeric("subtotal", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    compraIdx: index("compra_detalles_compra_idx").on(table.compraId),
  }),
);

// ─── Types ────────────────────────────────────

export type Compra = typeof compras.$inferSelect;
export type NewCompra = typeof compras.$inferInsert;

export type CompraDetalle = typeof compraDetalles.$inferSelect;
export type NewCompraDetalle = typeof compraDetalles.$inferInsert;
