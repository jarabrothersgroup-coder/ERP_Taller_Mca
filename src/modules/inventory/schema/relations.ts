/**
 * Inventory schema relations — central definition.
 *
 * Drizzle ORM relations for all inventory tables.
 * Defined in a single file to avoid circular imports between
 * table definition files while still enabling eager-loading
 * across the full entity graph.
 *
 * Relations enable JOIN-based queries that eliminate N+1:
 * ```ts
 * const result = await db().query.controlHerramientas.findMany({
 *   with: { herramienta: true, ordenTrabajo: true, mecanico: true },
 * });
 * ```
 *
 * @module inventory/schema/relations
 */

import { relations } from "drizzle-orm";
import { herramientas } from "./herramientas.js";
import { toolInstances } from "./tool-instances.js";
import { toolMaintenanceEvents } from "./tool-maintenance-events.js";
import { toolDepreciationEntries } from "./tool-depreciation-entries.js";
import { controlHerramientas } from "./control-herramientas.js";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";
import { profiles } from "../../../shared/database/schema/profiles.js";

// ─── herramientas → tool_instances ────────────

export const herramientasRelations = relations(herramientas, ({ many }) => ({
  /** All individual asset instances of this catalog SKU */
  instances: many(toolInstances),
  /** Legacy checkout records (pre tool_instances) */
  controles: many(controlHerramientas),
}));

// ─── tool_instances → tool_maintenance_events, tool_depreciation_entries, control_herramientas ──

export const toolInstancesRelations = relations(toolInstances, ({ one, many }) => ({
  /** The catalog SKU this instance belongs to */
  herramienta: one(herramientas, {
    fields: [toolInstances.herramientaId],
    references: [herramientas.id],
  }),
  /** Maintenance and calibration events for this instance */
  maintenanceEvents: many(toolMaintenanceEvents),
  /** Depreciation entries for this instance */
  depreciationEntries: many(toolDepreciationEntries),
  /** Loan/checkout records for this instance */
  controles: many(controlHerramientas),
}));

// ─── tool_maintenance_events → tool_instance ──

export const toolMaintenanceEventsRelations = relations(
  toolMaintenanceEvents,
  ({ one }) => ({
    /** The tool asset being serviced */
    toolInstance: one(toolInstances, {
      fields: [toolMaintenanceEvents.toolInstanceId],
      references: [toolInstances.id],
    }),
  }),
);

// ─── tool_depreciation_entries → tool_instance ──

export const toolDepreciationEntriesRelations = relations(
  toolDepreciationEntries,
  ({ one }) => ({
    /** The tool asset being depreciated */
    toolInstance: one(toolInstances, {
      fields: [toolDepreciationEntries.toolInstanceId],
      references: [toolInstances.id],
    }),
  }),
);

// ─── controlHerramientas → herramienta, tool_instance, ordenTrabajo, mecanico ──

export const controlHerramientasRelations = relations(
  controlHerramientas,
  ({ one }) => ({
    /** The catalog SKU that was checked out */
    herramienta: one(herramientas, {
      fields: [controlHerramientas.herramientaId],
      references: [herramientas.id],
    }),
    /** The specific asset instance that was checked out */
    toolInstance: one(toolInstances, {
      fields: [controlHerramientas.toolInstanceId],
      references: [toolInstances.id],
    }),
    /** The work order requiring this tool */
    ordenTrabajo: one(ordenesTrabajo, {
      fields: [controlHerramientas.ordenTrabajoId],
      references: [ordenesTrabajo.id],
    }),
    /** The mechanic who received the tool */
    mecanico: one(profiles, {
      fields: [controlHerramientas.mecanicoId],
      references: [profiles.id],
    }),
  }),
);

// ─── Extend ordenesTrabajo relations ───────────
// Note: ordenesTrabajoRelations is in workshop/schema/relations.ts.
// The inventory module adds a "controles" relation to ordenesTrabajo
// via declaration merging is not possible with Drizzle relations.
// Instead, query controlHerramientas directly with JOINs on ordenTrabajoId.
// This avoids circular dependencies between workshop and inventory modules.
