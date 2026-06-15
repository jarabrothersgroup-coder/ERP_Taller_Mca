/**
 * Revaluations — Drizzle ORM schema (Revaluos de Activos Fijos).
 *
 * Registro histórico de revaluaciones de activos fijos, donde se
 * ajusta el valor contable de un activo a su valor de mercado actual.
 *
 * La revaluación genera un asiento contable:
 *   - Si aumenta de valor: Débito: Activo Fijo / Crédito: Superávit por Revaluación (3.6.x)
 *   - Si disminuye de valor: Débito: Pérdida por Revaluación / Crédito: Activo Fijo
 *
 * @module finance/schema/revaluations
 */

import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { activosFijos } from "./fixed-assets.js";

// ─── Tables ────────────────────────────────────

/**
 * Historial de revaluaciones de activos fijos.
 *
 * Cada fila representa un evento de revaluación que ajustó el
 * valor en libros de un activo fijo a su valor de mercado.
 */
export const revaluaciones = pgTable(
  "revaluaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Activo fijo revaluado */
    activoFijoId: uuid("activo_fijo_id")
      .notNull()
      .references(() => activosFijos.id, { onDelete: "cascade" }),

    /** Tenant slug */
    tenantSlug: text("tenant_slug").notNull(),

    /** Fecha de la revaluación */
    fecha: timestamp("fecha", { withTimezone: true }).notNull(),

    /** Valor anterior en libros */
    valorAnterior: numeric("valor_anterior", { precision: 14, scale: 2 }).notNull(),

    /** Nuevo valor asignado */
    valorNuevo: numeric("valor_nuevo", { precision: 14, scale: 2 }).notNull(),

    /** Diferencia = valorNuevo - valorAnterior (positivo = superávit, negativo = pérdida) */
    diferencia: numeric("diferencia", { precision: 14, scale: 2 }).notNull(),

    /** Depreciación acumulada anterior (antes de la revaluación) */
    depreciacionAcumuladaAnterior: numeric("depreciacion_acumulada_anterior", { precision: 14, scale: 2 }),

    /** Asiento contable generado */
    asientoId: uuid("asiento_id"),

    /** Motivo o justificación de la revaluación */
    motivo: text("motivo"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    activoIdx: index("revaluaciones_activo_idx").on(table.activoFijoId),
    tenantIdx: index("revaluaciones_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type Revaluacion = typeof revaluaciones.$inferSelect;
export type NewRevaluacion = typeof revaluaciones.$inferInsert;
