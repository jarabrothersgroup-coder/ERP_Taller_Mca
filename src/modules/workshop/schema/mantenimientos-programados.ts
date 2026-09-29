/**
 * Mantenimientos Programados table — Drizzle ORM schema.
 *
 * "Ficha de próximos mantenimientos" (T-43 · auditoría 2026-09-25, SRV-03).
 *
 * Cada fila es un servicio pendiente programado para un vehículo:
 *   - origen = OT_COMPLETADA → se generó automáticamente al pasar la OT a
 *     "Listo" con los servicios realizados en esa orden.
 *   - origen = MANUAL        → lo creó el usuario desde la UI.
 *
 * El km/fecha objetivo permite el recordatorio de WhatsApp (template
 * `proximo_servicio`) y alimenta la ficha del vehículo.
 *
 * @module workshop/schema/mantenimientos-programados
 */

import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vehiculos } from "./vehiculos.js";
import { ordenesTrabajo } from "./ordenes-trabajo.js";

// ─── Table ────────────────────────────────────

/**
 * Mantenimientos programados por vehículo.
 * Una fila = un servicio futuro con objetivo de km y/o fecha.
 */
export const mantenimientosProgramados = pgTable(
  "mantenimientos_programados",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Vehicle the maintenance is scheduled for (FK → vehiculos) */
    vehiculoId: uuid("vehiculo_id")
      .notNull()
      .references(() => vehiculos.id, { onDelete: "cascade" }),

    /**
     * Work order that completed the service this schedule derives from
     * (FK → ordenes_trabajo, SET NULL: la ficha sobrevive a la OT).
     */
    ordenTrabajoId: uuid("orden_trabajo_id").references(
      () => ordenesTrabajo.id,
      { onDelete: "set null" },
    ),

    /** Service name (e.g. "Cambio de aceite") */
    servicio: text("servicio").notNull(),

    /** Target odometer (km) — null when scheduling is date-only */
    kmObjetivo: integer("km_objetivo"),

    /** Target date (YYYY-MM-DD) — null when scheduling is km-only */
    fechaObjetivo: date("fecha_objetivo"),

    /** PENDIENTE | REALIZADO | CANCELADO */
    estado: text("estado").notNull().default("PENDIENTE"),

    /** OT_COMPLETADA | MANUAL | PREDICCION */
    origen: text("origen").notNull().default("OT_COMPLETADA"),

    /** True once the WhatsApp reminder was sent (idempotent cron) */
    recordatorioEnviado: boolean("recordatorio_enviado")
      .notNull()
      .default(false),

    /** When the WhatsApp reminder was sent */
    recordatorioEnviadoAt: timestamp("recordatorio_enviado_at", {
      withTimezone: true,
    }),

    /** Tenant slug for multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Tenant isolation: list queries always filter by tenant */
    tenantIdx: index("mantenimientos_programados_tenant_idx").on(
      table.tenantSlug,
    ),
    /** FK index: ficha de un vehículo */
    vehiculoIdx: index("mantenimientos_programados_vehiculo_idx").on(
      table.vehiculoId,
    ),
    /** Cron: pendientes sin recordatorio */
    pendientesIdx: index("mantenimientos_programados_pendientes_idx").on(
      table.tenantSlug,
      table.estado,
      table.recordatorioEnviado,
    ),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type MantenimientoProgramado =
  typeof mantenimientosProgramados.$inferSelect;

/** Row type accepted by INSERT */
export type NewMantenimientoProgramado =
  typeof mantenimientosProgramados.$inferInsert;
