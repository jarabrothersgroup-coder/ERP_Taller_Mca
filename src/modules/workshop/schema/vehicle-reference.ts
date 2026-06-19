/**
 * Vehicle Reference Tables — Drizzle ORM schema.
 *
 * Global (non-tenant) reference tables for vehicle classification:
 *   - vehicle_types: AUTOMOVIL, SUV, PICK_UP, CAMIONETA, CAMION, etc.
 *   - fuel_types: NAFTA, DIESEL, FLEX, HIBRIDO, ELECTRICO
 *   - mileage_intervals: 5K, 10K, 20K, 40K, 60K maintenance intervals
 *
 * @module workshop/schema/vehicle-reference
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";

// ─── vehicle_types ──────────────────────────────

export const vehicleTypes = pgTable("vehicle_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  descripcion: text("descripcion"),
  activo: boolean("activo").notNull().default(true),
});

export type VehicleType = typeof vehicleTypes.$inferSelect;
export type NewVehicleType = typeof vehicleTypes.$inferInsert;

// ─── fuel_types ─────────────────────────────────

export const fuelTypes = pgTable("fuel_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  descripcion: text("descripcion"),
});

export type FuelType = typeof fuelTypes.$inferSelect;
export type NewFuelType = typeof fuelTypes.$inferInsert;

// ─── mileage_intervals ──────────────────────────

export const mileageIntervals = pgTable(
  "mileage_intervals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kmDesde: integer("km_desde").notNull(),
    kmHasta: integer("km_hasta"),
    nombre: text("nombre").notNull().unique(),
    orden: smallint("orden").notNull(),
  },
  (table) => ({
    ordenIdx: index("mileage_intervals_orden_idx").on(table.orden),
  }),
);

export type MileageInterval = typeof mileageIntervals.$inferSelect;
export type NewMileageInterval = typeof mileageIntervals.$inferInsert;
