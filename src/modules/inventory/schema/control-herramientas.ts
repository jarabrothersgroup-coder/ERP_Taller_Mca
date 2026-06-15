/**
 * Control Herramientas table — Drizzle ORM schema.
 *
 * Tracks the assignment and return of workshop tools to mechanics,
 * linked to a specific work order (OT). Each record represents a
 * single tool checkout event with full audit trail.
 *
 * Status lifecycle:
 *   Asignado   → Tool checked out to mechanic
 *   Devuelto   → Tool returned in good condition
 *   Perdido    → Tool lost (triggers inventory adjustment)
 *   Dañado     → Tool returned damaged (triggers repair/replace)
 *
 * @module inventory/schema/control-herramientas
 */

import { boolean, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { herramientas } from "./herramientas.js";
import { toolInstances } from "./tool-instances.js";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";
import { profiles } from "../../../shared/database/schema/profiles.js";
import { asientosContables } from "../../finance/schema/accounting.js";

// ─── Enums ────────────────────────────────────

/**
 * Estado de control de herramienta.
 * Reflects the lifecycle of a tool checkout event.
 *
 * Lifecycle:
 *   Asignado            → Tool checked out to mechanic
 *   Devuelto_Bueno      → Returned in good condition
 *   Devuelto_Desgastado → Returned with normal wear
 *   Devuelto_Danado     → Returned damaged (→ EN_REPARACION)
 *   Perdido             → Tool lost (triggers inventory adjustment)
 */
export const estadoControlHerramientaEnum = pgEnum("estado_control_herramienta", [
  "Asignado",
  "Devuelto_Bueno",
  "Devuelto_Desgastado",
  "Devuelto_Danado",
  "Perdido",
]);

// ─── Table ────────────────────────────────────

/**
 * Control Herramientas — tool assignment and return registry.
 *
 * Each row records a single tool checkout event. The tool is
 * assigned to a mechanic (via profiles FK) for a specific work
 * order (via ordenes_trabajo FK). Returns are recorded by setting
 * `fechaDevolucion` and updating the `estado` field.
 *
 * N+1 prevention: all queries use JOINs via Drizzle relations
 * or explicit JOINs — no lazy relation walking.
 */
export const controlHerramientas = pgTable(
  "control_herramientas",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Tool being checked out (FK → herramientas — catalog SKU) */
    herramientaId: uuid("herramienta_id")
      .notNull()
      .references(() => herramientas.id, { onDelete: "restrict" }),

    /** Specific tool asset instance (FK → tool_instances — individual unit) */
    toolInstanceId: uuid("tool_instance_id")
      .notNull()
      .references(() => toolInstances.id, { onDelete: "restrict" }),

    /** Work order requiring the tool (FK → ordenes_trabajo) */
    ordenTrabajoId: uuid("orden_trabajo_id")
      .notNull()
      .references(() => ordenesTrabajo.id, { onDelete: "cascade" }),

    /** Mechanic receiving the tool (FK → profiles) */
    mecanicoId: uuid("mecanico_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    /**
     * Mechanic name at time of assignment (denormalised).
     * Preserves the historical record even if the profile is
     * later updated or deactivated.
     */
    mecanicoNombre: text("mecanico_nombre").notNull(),

    /** Date/time the tool was checked out */
    fechaAsignacion: timestamp("fecha_asignacion", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Expected return date (for overdue alerts) */
    fechaEsperadaDevolucion: timestamp("fecha_esperada_devolucion", { withTimezone: true }),

    /** Date/time the tool was returned (null while assigned) */
    fechaDevolucion: timestamp("fecha_devolucion", { withTimezone: true }),

    /** Condition of the tool at checkout time */
    condicionSalida: text("condicion_salida"),

    /** Condition of the tool at return time */
    condicionRetorno: text("condicion_retorno"),

    /** Whether this return requires a repair follow-up */
    requiereReparacion: boolean("requiere_reparacion").notNull().default(false),

    /** Estimated repair cost (for damaged returns) */
    costoReparacion: numeric("costo_reparacion", { precision: 12, scale: 2 }),

    /** Accounting entry for damage/loss adjustment */
    asientoDanioId: uuid("asiento_danio_id").references(() => asientosContables.id),

    /** Free-text notes about the assignment or return condition */
    observaciones: text("observaciones"),

    /**
     * Current status of this checkout event.
     * Defaults to "Asignado" on creation.
     */
    estado: estadoControlHerramientaEnum("estado").notNull().default("Asignado"),

    // ─── Multi-Tenant ──────────────────────────────
    tenantSlug: text("tenant_slug").notNull().default(''),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** FK index: accelerates JOINs on herramienta_id */
    herramientaIdIdx: index("ctrl_herramientas_herramienta_id_idx").on(
      table.herramientaId,
    ),
    /** FK index: accelerates JOINs on tool_instance_id */
    toolInstanceIdx: index("ctrl_herramientas_tool_instance_idx").on(
      table.toolInstanceId,
    ),
    /** FK index: accelerates JOINs on orden_trabajo_id */
    ordenTrabajoIdIdx: index("ctrl_herramientas_orden_trabajo_id_idx").on(
      table.ordenTrabajoId,
    ),
    /** FK index: accelerates JOINs on mecanico_id */
    mecanicoIdIdx: index("ctrl_herramientas_mecanico_id_idx").on(
      table.mecanicoId,
    ),
    /** Index on estado: accelerates active-assignment queries */
    estadoIdx: index("ctrl_herramientas_estado_idx").on(table.estado),
    /**
     * Composite index on (mecanico_id, estado): accelerates
     * "what tools does this mechanic currently have?" queries.
     */
    mecanicoEstadoIdx: index("ctrl_herramientas_mecanico_estado_idx").on(
      table.mecanicoId,
      table.estado,
    ),
    /** Partial index on active loans (fecha_devolucion IS NULL) */
    activeLoanIdx: index("ctrl_herramientas_active_loan_idx").on(
      table.fechaDevolucion,
      table.toolInstanceId,
    ),
    /** Index on tenant slug */
    tenantIdx: index("ctrl_herramientas_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Estado de control de herramienta literals */
export type EstadoControlHerramienta =
  (typeof estadoControlHerramientaEnum.enumValues)[number];

/** Row type returned by SELECT */
export type ControlHerramienta = typeof controlHerramientas.$inferSelect;

/** Row type accepted by INSERT */
export type NewControlHerramienta = typeof controlHerramientas.$inferInsert;
