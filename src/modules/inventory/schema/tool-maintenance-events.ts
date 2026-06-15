/**
 * Tool Maintenance Events table — Drizzle ORM schema.
 *
 * Records all calibration, repair, and preventive maintenance
 * events for individual tool assets. Each event is linked to a
 * tool_instance and tracks the full lifecycle: scheduling,
 * execution, cost, result, and accounting integration.
 *
 * @module inventory/schema/tool-maintenance-events
 */

import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { toolInstances } from "./tool-instances.js";
import { asientosContables } from "../../finance/schema/accounting.js";
import { profiles } from "../../../shared/database/schema/profiles.js";

// ─── Table ────────────────────────────────────

/**
 * Tool Maintenance Events — calibration, repair, and PM records.
 *
 * Every time a tool enters EN_REPARACION or EN_CALIBRACION, a row
 * is created here. When the work completes, the event is updated
 * with results, cost, and optionally linked to an accounting entry.
 */
export const toolMaintenanceEvents = pgTable(
  "tool_maintenance_events",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** The tool asset being serviced (FK → tool_instances) */
    toolInstanceId: uuid("tool_instance_id")
      .notNull()
      .references(() => toolInstances.id, { onDelete: "cascade" }),

    /**
     * Event type:
     *   CALIBRACION_PROGRAMADA       — Scheduled periodic calibration
     *   CALIBRACION_EXTRAORDINARIA   — Unscheduled calibration (post-damage, etc.)
     *   REPARACION                   — Repair after damage/breakage
     *   MANTENIMIENTO_PREVENTIVO     — Scheduled preventive maintenance
     *   INSPECCION                   — Visual/functional inspection
     */
    tipo: text("tipo").notNull(),

    /**
     * Event status:
     *   PROGRAMADO       — Planned but not started
     *   EN_PROCESO       — Work in progress
     *   COMPLETADO       — Finished successfully
     *   CANCELADO        — Cancelled
     */
    estado: text("estado").notNull().default('PROGRAMADO'),

    /** Date the event was scheduled / started */
    fechaInicio: timestamp("fecha_inicio", { withTimezone: true }).notNull().defaultNow(),

    /** Date the event was completed */
    fechaFin: timestamp("fecha_fin", { withTimezone: true }),

    // ─── External Workshop / Supplier ─────────────
    /** External workshop or supplier name */
    proveedor: text("proveedor"),

    /** External work order number */
    numeroOrdenExterna: text("numero_orden_externa"),

    // ─── Cost & Accounting ────────────────────────
    /** Cost of this service event */
    costo: numeric("costo", { precision: 12, scale: 2 }),

    /** Accounting entry for this cost */
    asientoCostoId: uuid("asiento_costo_id").references(() => asientosContables.id),

    // ─── Results ──────────────────────────────────
    /** Outcome description */
    resultado: text("resultado"),

    /** Certificate URL (calibration cert in Supabase Storage) */
    certificadoUrl: text("certificado_url"),

    /** Free-text notes */
    observaciones: text("observaciones"),

    /** Who performed/performs the work */
    realizadaPorId: uuid("realizada_por_id").references(() => profiles.id),

    // ─── Multi-Tenant ──────────────────────────────
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
    /** Index on tool_instance_id */
    instanceIdx: index("tool_maint_instance_idx").on(table.toolInstanceId),
    /** Index on type */
    tipoIdx: index("tool_maint_tipo_idx").on(table.tipo),
    /** Index on status */
    estadoIdx: index("tool_maint_estado_idx").on(table.estado),
    /** Index on start date for scheduling queries */
    fechaIdx: index("tool_maint_fecha_idx").on(table.fechaInicio),
    /** Tenant-scoped index */
    tenantIdx: index("tool_maint_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type ToolMaintenanceEvent = typeof toolMaintenanceEvents.$inferSelect;

/** Row type accepted by INSERT */
export type NewToolMaintenanceEvent = typeof toolMaintenanceEvents.$inferInsert;
