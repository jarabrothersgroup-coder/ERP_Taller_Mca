/**
 * Catálogo de Servicios table — Drizzle ORM schema.
 *
 * Defines the workshop service catalog: all billable services
 * (diagnosis, repair, maintenance, bodywork, AC, electrical, etc.)
 * with default pricing and estimated duration.
 *
 * Each tenant has its own isolated service catalog.
 *
 * @module workshop/schema/servicios-catalogo
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

// ─── Table ────────────────────────────────────

/**
 * Catálogo de Servicios del Taller.
 *
 * One row per service type offered by the workshop.
 * Services are tenant-isolated and can be soft-deactivated.
 */
export const serviciosCatalogo = pgTable(
  "servicios_catalogo",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Service name (e.g. "Cambio de Aceite", "Diagnóstico Computarizado") */
    nombre: text("nombre").notNull(),

    /** Optional description / scope notes */
    descripcion: text("descripcion"),

    /** Extended technical description for service catalog */
    descripcionTecnica: text("descripcion_tecnica"),

    /** Service category: Mecánica, Eléctrica, Carrocería, Diagnóstico, Aire Acondicionado, etc. */
    categoria: text("categoria"),

    /** Normalized category FK → service_categories (nullable, for new multi-dimensional catalog) */
    categoriaId: uuid("categoria_id"),

    /** Service code (e.g. "MEC-PM-05K", "ELE-DIAG-ADV") */
    codigo: text("codigo"),

    /** Thinkcar module required for this service (e.g. "ECM_RESET", "ABS_BLEEDING") */
    thinkcarModulo: text("thinkcar_modulo"),

    /** Default/estimated price in Gs. or USD */
    precioEstimado: numeric("precio_estimado", { precision: 10, scale: 2 }),

    /** Estimated duration in minutes */
    duracionEstimada: integer("duracion_estimada"),

    /** Soft-deactivation flag — inactive services are hidden from dropdowns */
    activo: boolean("activo").notNull().default(true),

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
    /** Tenant isolation index */
    tenantIdx: index("servicios_catalogo_tenant_slug_idx").on(table.tenantSlug),
    /** Category index — for filtered lookups */
    categoriaIdx: index("servicios_catalogo_categoria_idx").on(table.categoria),
    /** Active filter index */
    activoIdx: index("servicios_catalogo_activo_idx").on(table.activo),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type ServicioCatalogo = typeof serviciosCatalogo.$inferSelect;

/** Row type accepted by INSERT */
export type NewServicioCatalogo = typeof serviciosCatalogo.$inferInsert;
