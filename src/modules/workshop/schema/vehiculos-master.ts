/**
 * Vehicle Master Data — Drizzle ORM schema.
 *
 * Global reference tables for the Paraguayan vehicle park:
 *   - vehiculos_marca: Toyota, Kia, Hyundai, VW, Fiat, etc.
 *   - vehiculos_modelo: Corolla, Hilux, Picanto, etc.
 *
 * @module workshop/schema/vehiculos-master
 */

import {
  boolean,
  index,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { vehicleTypes } from "./vehicle-reference.js";

// ─── vehiculos_marca ────────────────────────────

export const vehiculosMarca = pgTable("vehiculos_marca", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  paisOrigen: text("pais_origen"),
  activa: boolean("activa").notNull().default(true),
});

export type VehiculoMarca = typeof vehiculosMarca.$inferSelect;
export type NewVehiculoMarca = typeof vehiculosMarca.$inferInsert;

// ─── vehiculos_modelo ───────────────────────────

export const vehiculosModelo = pgTable(
  "vehiculos_modelo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marcaId: uuid("marca_id")
      .notNull()
      .references(() => vehiculosMarca.id),
    vehicleTypeId: uuid("vehicle_type_id")
      .notNull()
      .references(() => vehicleTypes.id),
    nombre: text("nombre").notNull(),
    motorCc: text("motor_cc"),
    combustibleDefault: text("combustible_default"),
  },
  (table) => ({
    marcaIdx: index("vehiculos_modelo_marca_idx").on(table.marcaId),
  }),
);

export type VehiculoModelo = typeof vehiculosModelo.$inferSelect;
export type NewVehiculoModelo = typeof vehiculosModelo.$inferInsert;
