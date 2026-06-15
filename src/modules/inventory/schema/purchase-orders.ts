/**
 * Purchase Orders schema — Drizzle ORM tables.
 *
 * Manages procurement of spare parts with full lifecycle tracking:
 *   BORRADOR → PENDIENTE_APROB → APROBADA → ENVIADA → RECIBIDA_PARCIAL → RECIBIDA
 *
 * Each PO line item references a repuesto and records the purchase
 * unit cost, which feeds into the PPP recalculation on receipt.
 *
 * @module inventory/schema/purchase-orders
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
import { repuestos } from "./repuestos.js";
import { profiles } from "../../../shared/database/schema/profiles.js";

// ─── Purchase Orders Table ────────────────────

/**
 * Purchase Orders — procurement of spare parts.
 */
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Internal PO number (e.g. "OC-2026-0001") */
    numero: text("numero").notNull(),

    /** Supplier / vendor name */
    proveedor: text("proveedor").notNull(),

    /**
     * PO status lifecycle:
     *   BORRADOR         → Draft, not yet submitted
     *   PENDIENTE_APROB  → Awaiting approval
     *   APROBADA         → Approved, ready to send
     *   ENVIADA          → Sent to supplier
     *   RECIBIDA_PARCIAL → Partially received
     *   RECIBIDA         → Fully received
     *   CANCELADA        → Cancelled
     */
    estado: text("estado").notNull().default("BORRADOR"),

    /** Date the PO was issued */
    fechaEmision: timestamp("fecha_emision", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Expected delivery date */
    fechaEsperada: timestamp("fecha_esperada", { withTimezone: true }),

    /** Actual receipt date */
    fechaRecepcion: timestamp("fecha_recepcion", { withTimezone: true }),

    /** PO total amount (sum of item subtotals) */
    totalOc: numeric("total_oc", { precision: 12, scale: 2 }).default("0"),

    /** Internal notes */
    notas: text("notas"),

    /** User who created the PO */
    usuarioId: uuid("usuario_id").references(() => profiles.id),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    numeroIdx: index("po_numero_idx").on(table.numero),
    proveedorIdx: index("po_proveedor_idx").on(table.proveedor),
    estadoIdx: index("po_estado_idx").on(table.estado),
    tenantIdx: index("po_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Purchase Order Items Table ───────────────

/**
 * Purchase Order Items — line items within a PO.
 *
 * Each item references a repuesto and records the purchase quantity,
 * unit cost, and received quantity (for partial receipts).
 */
export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent purchase order */
    ordenCompraId: uuid("orden_compra_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),

    /** The spare part being ordered */
    repuestoId: uuid("repuesto_id")
      .notNull()
      .references(() => repuestos.id),

    /** Quantity ordered */
    cantidad: integer("cantidad").notNull(),

    /** Quantity received so far (partial receipt support) */
    cantidadRecibida: integer("cantidad_recibida").notNull().default(0),

    /** Purchase unit cost (Gs. or USD per unit) */
    costoUnitario: numeric("costo_unitario", {
      precision: 12,
      scale: 2,
    }).notNull(),

    /** Subtotal: cantidad × costoUnitario */
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),

    /** Multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),
  },
  (table) => ({
    poIdx: index("poi_orden_idx").on(table.ordenCompraId),
    repuestoIdx: index("poi_repuesto_idx").on(table.repuestoId),
    tenantIdx: index("poi_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
