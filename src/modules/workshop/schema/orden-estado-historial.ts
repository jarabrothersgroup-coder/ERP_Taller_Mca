/**
 * Orden Estado Historial table — Drizzle ORM schema.
 *
 * Immutable audit log of every work-order status transition.
 * Used for compliance, analytics, and UI timeline display.
 *
 * @module workshop/schema/orden-estado-historial
 */

import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ordenesTrabajo } from "./ordenes-trabajo.js";

// ─── Table ────────────────────────────────────

/**
 * Historial de estados de órdenes de trabajo.
 * Cada fila representa un cambio de estado (inmutble).
 */
export const ordenEstadoHistorial = pgTable(
  "orden_estado_historial",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent work order (FK → ordenes_trabajo) */
    ordenTrabajoId: uuid("orden_trabajo_id")
      .notNull()
      .references(() => ordenesTrabajo.id, { onDelete: "cascade" }),

    /** Estado anterior (null si es el primer registro) */
    estadoAnterior: text("estado_anterior"),

    /** Estado nuevo */
    estadoNuevo: text("estado_nuevo").notNull(),

    /** Usuario que realizó el cambio (UUID de profiles) */
    usuarioId: text("usuario_id"),

    /** Observaciones opcionales */
    observaciones: text("observaciones"),

    /** Timestamp del cambio */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** FK index: accelerates queries by OT */
    ordenTrabajoIdIdx: index("orden_estado_historial_orden_idx").on(
      table.ordenTrabajoId,
    ),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type OrdenEstadoHistorial = typeof ordenEstadoHistorial.$inferSelect;

/** Row type accepted by INSERT */
export type NewOrdenEstadoHistorial = typeof ordenEstadoHistorial.$inferInsert;
