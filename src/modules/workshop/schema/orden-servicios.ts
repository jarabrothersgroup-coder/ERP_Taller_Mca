/**
 * Órdenes de Servicio items table — Drizzle ORM schema.
 *
 * Line-item services assigned to a work order.
 * Each row links a servicio_catalogo entry to an orden_trabajo with
 * quantity, unit price, and subtotal.
 *
 * totalCost on ordenes_trabajo is recalculated automatically
 * whenever rows here are inserted, updated, or deleted.
 *
 * @module workshop/schema/orden-servicios
 */

import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ordenesTrabajo } from "./ordenes-trabajo.js";
import { serviciosCatalogo } from "./servicios-catalogo.js";

// ─── Table ────────────────────────────────────

/**
 * Items de Servicio por Orden de Trabajo.
 *
 * One row per service line-item on a work order.
 * servicio_nombre and precio_unitario are denormalised snapshots
 * so the line remains meaningful even if the catalog changes.
 */
export const ordenServicios = pgTable(
  "orden_servicios",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent work order (FK → ordenes_trabajo) */
    ordenTrabajoId: uuid("orden_trabajo_id")
      .notNull()
      .references(() => ordenesTrabajo.id, { onDelete: "cascade" }),

    /** Catalog service (FK → servicios_catalogo) */
    servicioId: uuid("servicio_id")
      .notNull()
      .references(() => serviciosCatalogo.id, { onDelete: "restrict" }),

    /** Denormalised service name snapshot */
    servicioNombre: text("servicio_nombre").notNull(),

    /** Quantity (default 1) */
    cantidad: integer("cantidad").notNull().default(1),

    /** Unit price at time of assignment */
    precioUnitario: numeric("precio_unitario", { precision: 10, scale: 2 }).notNull(),

    /** Subtotal = cantidad × precio_unitario */
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),

    /** Estimated duration in minutes (from catalog) */
    duracionEstimada: integer("duracion_estimada"),

    /** Actual duration in minutes (filled when service is completed) */
    duracionReal: integer("duracion_real"),

    /** Timestamp when mechanic started working on this service */
    horaInicioReal: timestamp("hora_inicio_real", { withTimezone: true }),

    /** Timestamp when mechanic finished this service */
    horaFinReal: timestamp("hora_fin_real", { withTimezone: true }),

    /** Mechanic UUID who performed the service */
    tecnicoId: uuid("tecnico_id"),

    /** Tenant slug for multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    /** Creation timestamp */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** FK index: look up all services on a given order */
    ordenIdx: index("orden_servicios_orden_trabajo_id_idx").on(table.ordenTrabajoId),
    /** FK index: which orders use a given service */
    servicioIdx: index("orden_servicios_servicio_id_idx").on(table.servicioId),
    /** Tenant isolation */
    tenantIdx: index("orden_servicios_tenant_slug_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type OrdenServicio = typeof ordenServicios.$inferSelect;

/** Row type accepted by INSERT */
export type NewOrdenServicio = typeof ordenServicios.$inferInsert;
