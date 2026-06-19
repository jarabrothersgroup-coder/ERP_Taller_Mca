/**
 * Service Pricing Matrix — Drizzle ORM schema.
 *
 * Multi-dimensional pricing for the workshop service catalog:
 *   - service_categories: Mecánica Preventiva, Electricidad, Climatización, etc.
 *   - service_pricing_rules: price by service × vehicle_type × fuel × km interval
 *   - service_brand_map: which brands apply to each service
 *   - rh_service_hours: estimated hours by service × vehicle × complexity
 *
 * @module workshop/schema/service-pricing
 */

import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { serviciosCatalogo } from "./servicios-catalogo.js";
import { vehicleTypes } from "./vehicle-reference.js";
import { fuelTypes } from "./vehicle-reference.js";
import { mileageIntervals } from "./vehicle-reference.js";

// ─── service_categories ─────────────────────────

export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  descripcion: text("descripcion"),
  icono: text("icono"),
  color: text("color"),
  orden: integer("orden").notNull().default(0),
});

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type NewServiceCategory = typeof serviceCategories.$inferInsert;

// ─── service_pricing_rules ──────────────────────

export const servicePricingRules = pgTable(
  "service_pricing_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    servicioId: uuid("servicio_id")
      .notNull()
      .references(() => serviciosCatalogo.id, { onDelete: "cascade" }),
    vehicleTypeId: uuid("vehicle_type_id")
      .notNull()
      .references(() => vehicleTypes.id),
    fuelTypeId: uuid("fuel_type_id").references(() => fuelTypes.id),
    mileageIntervalId: uuid("mileage_interval_id").references(
      () => mileageIntervals.id,
    ),
    precioVentaPyg: numeric("precio_venta_pyg", {
      precision: 15,
      scale: 2,
    }).notNull(),
    precioCostoPyg: numeric("precio_costo_pyg", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    impuestoIvaPct: numeric("impuesto_iva_pct", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("10"),
    tiempoEstimadoMin: integer("tiempo_estimado_min").notNull(),
    complejidad: text("complejidad").notNull().default("NORMAL"),
    activo: boolean("activo").notNull().default(true),
    tenantSlug: text("tenant_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("service_pricing_rules_tenant_idx").on(table.tenantSlug),
    servicioIdx: index("service_pricing_rules_servicio_idx").on(
      table.servicioId,
    ),
  }),
);

export type ServicePricingRule = typeof servicePricingRules.$inferSelect;
export type NewServicePricingRule = typeof servicePricingRules.$inferInsert;

// ─── service_brand_map ──────────────────────────

export const serviceBrandMap = pgTable(
  "service_brand_map",
  {
    servicioId: uuid("servicio_id")
      .notNull()
      .references(() => serviciosCatalogo.id, { onDelete: "cascade" }),
    marca: text("marca").notNull(),
  },
  (table) => ({
    servicioIdx: index("service_brand_map_servicio_idx").on(table.servicioId),
  }),
);

export type ServiceBrandMap = typeof serviceBrandMap.$inferSelect;
export type NewServiceBrandMap = typeof serviceBrandMap.$inferInsert;

// ─── rh_service_hours ───────────────────────────

export const rhServiceHours = pgTable(
  "rh_service_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    servicioId: uuid("servicio_id")
      .notNull()
      .references(() => serviciosCatalogo.id, { onDelete: "cascade" }),
    vehicleTypeId: uuid("vehicle_type_id")
      .notNull()
      .references(() => vehicleTypes.id),
    complejidad: text("complejidad").notNull().default("NORMAL"),
    horasEstimadas: numeric("horas_estimadas", {
      precision: 5,
      scale: 2,
    }).notNull(),
    horasMinimas: numeric("horas_minimas", { precision: 5, scale: 2 }),
    horasMaximas: numeric("horas_maximas", { precision: 5, scale: 2 }),
    requiereEspecialista: boolean("requiere_especialista")
      .notNull()
      .default(false),
    tenantSlug: text("tenant_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("rh_service_hours_tenant_idx").on(table.tenantSlug),
    servicioIdx: index("rh_service_hours_servicio_idx").on(table.servicioId),
  }),
);

export type RhServiceHour = typeof rhServiceHours.$inferSelect;
export type NewRhServiceHour = typeof rhServiceHours.$inferInsert;
