/**
 * Órdenes de Trabajo table — Drizzle ORM schema.
 *
 * Core work-order entity for Paraguayan automotive workshops.
 * Statuses follow the taller operational workflow:
 *   Presupuestado   → Budget quoted, pending client approval
 *   Aprobado        → Client approved, awaiting parts / schedule
 *   En_Proceso      → Active work on the vehicle
 *   Control_Calidad → Quality control / verification stage
 *   Listo           → Completed, ready for delivery & invoicing
 *
 * @module workshop/schema/ordenes-trabajo
 */

import {
  boolean,
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clients } from "../../../shared/database/schema/clients.js";
import { vehiculos } from "./vehiculos.js";

// ─── Enums ────────────────────────────────────

/**
 * Estados de orden de trabajo.
 * Reflects the Paraguayan taller workflow lifecycle.
 */
export const estadoOrdenEnum = pgEnum("estado_orden", [
  "Presupuestado",
  "Aprobado",
  "En_Proceso",
  "Control_Calidad",
  "Listo",
]);

// ─── Table ────────────────────────────────────

/**
 * Órdenes de Trabajo — work orders for vehicle repair / maintenance.
 *
 * Each order is linked to one vehicle and one client.
 * The lifecycle follows the estados defined above.
 */
export const ordenesTrabajo = pgTable(
  "ordenes_trabajo",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Vehicle being serviced (FK → vehiculos) */
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehiculos.id, { onDelete: "cascade" }),

    /** Vehicle owner (FK → clients) — denormalised for query performance */
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    /** Current status in the workshop workflow */
    status: estadoOrdenEnum("status").notNull().default("Presupuestado"),

    /** Work description / scope of work */
    description: text("description"),

    /** Diagnosis notes (LLM-assisted or mechanic-entered) */
    diagnosis: text("diagnosis"),

    /** DTC codes scanned from the vehicle (Launch / Thinkcar) */
    dtcCodes: text("dtc_codes").array(),

    /**
     * High-voltage safety alert flag.
     * Must be true for HEV/BEV vehicles before work begins.
     * Triggers HV safety protocol per Ley 1034/83.
     */
    hvAlert: boolean("hv_alert").notNull().default(false),

    /**
     * HV Lockout/Tagout signature.
     * Mandatory for HEV/BEV — mechanic must sign digitally before
     * work can proceed. Blocks status change to "Listo" if unsigned.
     */
    hvLockoutSigned: boolean("hv_lockout_signed").notNull().default(false),

    /** ISO timestamp when lockout was signed */
    hvLockoutSignedAt: timestamp("hv_lockout_signed_at", { withTimezone: true }),

    /** Mechanic UUID who signed the lockout */
    hvLockoutSignedBy: text("hv_lockout_signed_by"),

    /** Total estimated / final cost (Gs. or USD) */
    totalCost: numeric("total_cost", { precision: 10, scale: 2 }).default("0"),

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
     * CHECK: total_cost must be non-negative.
     */
    costCheck: check(
      "ordenes_trabajo_cost_check",
      sql`${table.totalCost} IS NULL OR ${table.totalCost} >= 0`,
    ),
    /** FK index: accelerates JOINs on vehicle_id */
    vehicleIdIdx: index("ordenes_trabajo_vehicle_id_idx").on(table.vehicleId),
    /** FK index: accelerates JOINs on client_id */
    clientIdIdx: index("ordenes_trabajo_client_id_idx").on(table.clientId),
    /** Index on status: accelerates dashboard queries filtering by status */
    statusIdx: index("ordenes_trabajo_status_idx").on(table.status),
    /** Tenant isolation index */
    tenantIdx: index("ordenes_trabajo_tenant_slug_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Estado de orden de trabajo literals */
export type EstadoOrden = (typeof estadoOrdenEnum.enumValues)[number];

/** Row type returned by SELECT */
export type OrdenTrabajo = typeof ordenesTrabajo.$inferSelect;

/** Row type accepted by INSERT */
export type NewOrdenTrabajo = typeof ordenesTrabajo.$inferInsert;
