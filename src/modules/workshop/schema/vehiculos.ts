/**
 * Vehículos table — Drizzle ORM schema.
 *
 * Paraguayan automotive workshop vehicle registry.
 * Engine types follow the DNIT/Marangatu classification:
 *   - Nafta  → Petrol/Gasoline (ICE)
 *   - Diésel → Diesel (ICE)
 *   - HEV    → Hybrid Electric Vehicle (ICE + EV)
 *   - BEV    → Battery Electric Vehicle (pure EV)
 *
 * @module workshop/schema/vehiculos
 */

import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clients } from "../../../shared/database/schema/clients.js";

// ─── Enums ────────────────────────────────────

/**
 * Motorisation / engine type enum.
 * Maps to Paraguayan vehicle classification for fiscal & safety purposes.
 */
export const tipoMotorEnum = pgEnum("tipo_motor", [
  "Nafta",
  "Diésel",
  "HEV",
  "BEV",
]);

// ─── Table ────────────────────────────────────

/**
 * Vehículos — core vehicle registry for the workshop.
 *
 * Stores conventional ICE, hybrid (HEV) and pure electric (BEV) vehicles.
 * HEV/BEV rows include high-voltage safety fields required by
 * Paraguayan Ley 1034/83 and international EV safety standards.
 */
export const vehiculos = pgTable(
  "vehiculos",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Owner (FK → clients) */
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    /** License plate (chapa/patente) */
    plate: text("plate"),

    /** VIN / Chassis number (17 characters) */
    vin: text("vin"),

    /** Vehicle brand (e.g. Toyota, Volkswagen) */
    brand: text("brand").notNull(),

    /** Vehicle model (e.g. Corolla, Amarok) */
    model: text("model").notNull(),

    /** Manufacturing year */
    year: smallint("year"),

    /** Engine / motorisation type */
    engineType: tipoMotorEnum("engine_type").notNull().default("Nafta"),

    /** Odometer reading at last check-in (km) */
    kilometraje: integer("kilometraje"),

    /**
     * High-voltage battery nominal voltage (V).
     * Required for HEV & BEV — safety-critical field.
     */
    hvBatteryVoltage: real("hv_battery_voltage"),

    /**
     * True after the high-voltage safety disconnect procedure
     * has been performed per workshop safety protocol.
     */
    hvSafetyDisabled: boolean("hv_safety_disabled").notNull().default(false),

    /** Stored Diagnostic Trouble Codes (DTC) scanned via Launch/Thinkcar */
    dtcCodes: text("dtc_codes").array(),

    /** Free-text notes / observaciones */
    notes: text("notes"),

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
    /**
     * CHECK: hv_battery_voltage must be positive when set.
     * Prevents accidental zero/negative entries for safety-critical field.
     */
    hvVoltageCheck: check(
      "vehiculos_hv_voltage_check",
      sql`${table.hvBatteryVoltage} IS NULL OR ${table.hvBatteryVoltage} > 0`,
    ),
    /** FK index: accelerates JOINs and CASCADE operations on client_id */
    clientIdIdx: index("vehiculos_client_id_idx").on(table.clientId),
    /** FK index: accelerates plate lookups (common workshop query) */
    plateIdx: index("vehiculos_plate_idx").on(table.plate),
    /** FK index: accelerates VIN lookups (diagnostic scan matching) */
    vinIdx: index("vehiculos_vin_idx").on(table.vin),
    /** Tenant isolation index */
    tenantIdx: index("vehiculos_tenant_slug_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Tipo de motor literals */
export type TipoMotor = (typeof tipoMotorEnum.enumValues)[number];

/** Row type returned by SELECT */
export type Vehiculo = typeof vehiculos.$inferSelect;

/** Row type accepted by INSERT */
export type NewVehiculo = typeof vehiculos.$inferInsert;
