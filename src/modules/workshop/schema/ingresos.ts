/**
 * Ingresos table — Drizzle ORM schema.
 *
 * Vehicle check-in records for the workshop.
 * Captures the vehicle's condition at the moment of arrival:
 *   - Odometer reading (kilometraje)
 *   - Fuel level (nivel_combustible)
 *   - Exterior condition (estado_exterior)
 *
 * Each ingreso is linked to a vehiculo and optionally an orden de trabajo,
 * allowing the workshop to track vehicle history across multiple visits.
 *
 * @module workshop/schema/ingresos
 */

import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { vehiculos } from "./vehiculos.js";
import { ordenesTrabajo } from "./ordenes-trabajo.js";

// ─── Table ────────────────────────────────────

/**
 * Ingresos — vehicle check-in records.
 *
 * Captures the state of the vehicle when it arrives at the workshop.
 * Used for liability protection and service history.
 */
export const ingresos = pgTable(
  "ingresos",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Vehicle being checked in (FK → vehiculos) */
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehiculos.id, { onDelete: "cascade" }),

    /**
     * Associated work order (FK → ordenes_trabajo).
     * Optional — an ingreso can be registered before the work order is created.
     */
    ordenTrabajoId: uuid("orden_trabajo_id").references(
      () => ordenesTrabajo.id,
      { onDelete: "set null" },
    ),

    /** Date/time the vehicle arrived */
    fechaIngreso: timestamp("fecha_ingreso", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Odometer reading at check-in (km) */
    kilometraje: integer("kilometraje"),

    /** Fuel level description (e.g. "1/4", "1/2", "3/4", "Full") */
    nivelCombustible: text("nivel_combustible"),

    /** Exterior condition notes (scratches, dents, etc.) */
    estadoExterior: text("estado_exterior"),

    /** Additional check-in observations */
    observaciones: text("observaciones"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** FK index: accelerates JOINs on vehicle_id */
    vehicleIdIdx: index("ingresos_vehicle_id_idx").on(table.vehicleId),
    /** FK index: accelerates JOINs on orden_trabajo_id */
    ordenTrabajoIdIdx: index("ingresos_orden_trabajo_id_idx").on(table.ordenTrabajoId),
    /** Index on fecha_ingreso: accelerates timeline/history queries */
    fechaIngresoIdx: index("ingresos_fecha_ingreso_idx").on(table.fechaIngreso),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type Ingreso = typeof ingresos.$inferSelect;

/** Row type accepted by INSERT */
export type NewIngreso = typeof ingresos.$inferInsert;
