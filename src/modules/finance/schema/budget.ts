/**
 * Presupuestos — Drizzle ORM schema (CAPA 5).
 *
 * Presupuestos por centro de costo para control de gestión.
 * Cada presupuesto tiene un período (mes, trimestre, año) y múltiples
 * líneas vinculadas a centros de costo con montos presupuestados.
 *
 * El monto_real se calcula sumando asientos_detalle.centro_costo_id
 * filtrados por el período del presupuesto.
 *
 * @module finance/schema/budget
 */

import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { centrosCosto } from "./cost-centers.js";

/**
 * Presupuesto — encabezado por período.
 *
 * Estados: borrador → aprobado → cerrado
 * Solo presupuestos "aprobados" se usan para comparativas.
 */
export const presupuestos = pgTable(
  "presupuestos",
  {
    /** Primary key UUID */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Período del presupuesto: "2026-01" (mes), "2026-Q1" (trimestre), "2026" (anual) */
    periodo: text("periodo").notNull(),

    /** Descripción opcional del presupuesto */
    descripcion: text("descripcion"),

    /** Estado: borrador | aprobado | cerrado */
    estado: text("estado").notNull().default("borrador"),

    /** Tenant slug for multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ───────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    periodoIdx: index("presupuestos_periodo_idx").on(table.periodo),
    estadoIdx: index("presupuestos_estado_idx").on(table.estado),
    tenantIdx: index("presupuestos_tenant_slug_idx").on(table.tenantSlug),
  }),
);

/**
 * Presupuesto Item — línea de presupuesto por centro de costo.
 *
 * Cada ítem vincula un centro de costo con un monto presupuestado.
 * El monto_real se actualiza periódicamente desde asientos_detalle.
 *
 * Categorías: servicios, repuestos, mano_obra, fijo, otro
 */
export const presupuestosItems = pgTable(
  "presupuestos_items",
  {
    /** Primary key UUID */
    id: uuid("id").primaryKey().defaultRandom(),

    /** FK al presupuesto padre */
    presupuestoId: uuid("presupuesto_id")
      .notNull()
      .references(() => presupuestos.id, { onDelete: "cascade" }),

    /** FK al centro de costo */
    centroCostoId: uuid("centro_costo_id")
      .notNull()
      .references(() => centrosCosto.id, { onDelete: "restrict" }),

    /** Categoría: servicios | repuestos | mano_obra | fijo | otro */
    categoria: text("categoria").notNull(),

    /** Monto presupuestado para este centro/categoría/período */
    montoPresupuestado: numeric("monto_presupuestado", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    /** Monto real calculado desde asientos contables */
    montoReal: numeric("monto_real", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),

    /** Notas o justificación opcional */
    notas: text("notas"),

    /** Tenant slug for multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ───────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    presupuestoIdx: index("presupuestos_items_presupuesto_idx").on(
      table.presupuestoId,
    ),
    centroCostoIdx: index("presupuestos_items_centro_costo_idx").on(
      table.centroCostoId,
    ),
    categoriaIdx: index("presupuestos_items_categoria_idx").on(
      table.categoria,
    ),
    tenantIdx: index("presupuestos_items_tenant_slug_idx").on(
      table.tenantSlug,
    ),
  }),
);

// ─── Types ────────────────────────────────────

export type Presupuesto = typeof presupuestos.$inferSelect;
export type NewPresupuesto = typeof presupuestos.$inferInsert;

export type PresupuestoItem = typeof presupuestosItems.$inferSelect;
export type NewPresupuestoItem = typeof presupuestosItems.$inferInsert;
