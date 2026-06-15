/**
 * Trabajos de Terceros table — Drizzle ORM schema.
 *
 * Third-party work / outsourced services linked to a work order.
 * Common in Paraguayan workshops when specialised work (e.g. painting,
 * AC service, electrical, machining) is subcontracted to external vendors.
 *
 * Each trabajo_tercero tracks:
 *   - Vendor / supplier (proveedor)
 *   - Service description
 *   - Cost (for client billing + vendor payment)
 *   - Status (Pendiente → En_Proceso → Completado)
 *
 * @module workshop/schema/trabajos-terceros
 */

import {
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
import { ordenesTrabajo } from "./ordenes-trabajo.js";

// ─── Enums ────────────────────────────────────

/** Status for third-party work items */
export const estadoTerceroEnum = pgEnum("estado_tercero", [
  "Pendiente",
  "En_Proceso",
  "Completado",
]);

// ─── Table ────────────────────────────────────

/**
 * Trabajos de Terceros — outsourced services subcontratados.
 *
 * Linked to a parent work order (orden de trabajo).
 * Multiple third-party work items can exist per order.
 */
export const trabajosTerceros = pgTable(
  "trabajos_terceros",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Parent work order (FK → ordenes_trabajo) */
    ordenTrabajoId: uuid("orden_trabajo_id")
      .notNull()
      .references(() => ordenesTrabajo.id, { onDelete: "cascade" }),

    /** Vendor / supplier name (e.g. "Taller de Pintura El Chero") */
    proveedor: text("proveedor").notNull(),

    /** Description of the outsourced work */
    descripcion: text("descripcion").notNull(),

    /** Cost charged by the third party (Gs. or USD) */
    costo: numeric("costo", { precision: 10, scale: 2 }).notNull().default("0"),

    /** Start date of the third-party work */
    fechaInicio: timestamp("fecha_inicio", { withTimezone: true }),

    /** Completion date of the third-party work */
    fechaFin: timestamp("fecha_fin", { withTimezone: true }),

    /** Current status */
    estado: estadoTerceroEnum("estado").notNull().default("Pendiente"),

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
     * CHECK: costo must be non-negative.
     */
    costCheck: check(
      "trabajos_terceros_cost_check",
      sql`${table.costo} >= 0`,
    ),
    /** FK index: accelerates JOINs on orden_trabajo_id */
    ordenTrabajoIdIdx: index("trabajos_terceros_orden_trabajo_id_idx").on(
      table.ordenTrabajoId,
    ),
    /** Index on proveedor: accelerates vendor lookup queries */
    proveedorIdx: index("trabajos_terceros_proveedor_idx").on(table.proveedor),
  }),
);

// ─── Types ────────────────────────────────────

/** Estado de trabajo tercero literals */
export type EstadoTercero = (typeof estadoTerceroEnum.enumValues)[number];

/** Row type returned by SELECT */
export type TrabajoTercero = typeof trabajosTerceros.$inferSelect;

/** Row type accepted by INSERT */
export type NewTrabajoTercero = typeof trabajosTerceros.$inferInsert;
