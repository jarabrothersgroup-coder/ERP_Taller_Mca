/**
 * Centros de Costo — Drizzle ORM schema (CAPA 5).
 *
 * Estructura jerárquica de centros de costo para contabilidad analítica.
 * Cada centro de costo puede tener un padre (sub-centro) para reportes
 * consolidados por área: Taller, Administración, Ventas, etc.
 *
 * Los centros de costo se vinculan a las líneas de asientos contables
 * (asientos_detalle.centro_costo_id) para distribución de costos.
 *
 * @module finance/schema/cost-centers
 */

import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Centros de Costo — dimensión analítica para contabilidad de gestión.
 *
 * Jerarquía plana (auto-referencia via centro_padre_id):
 *   Nivel 1: Áreas (Taller, Admisión, Administración, Ventas)
 *   Nivel 2: Sub-áreas (Mecánica Rápida, Diagnóstico, Carrocería)
 *   Nivel 3: Procesos específicos
 */
export const centrosCosto = pgTable(
  "centros_costo",
  {
    /** Primary key UUID */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Código alfanumérico único por tenant (ej: "TALL-01", "ADM-01") */
    codigo: text("codigo").notNull(),

    /** Nombre del centro de costo (ej: "Taller Mecánica Rápida") */
    nombre: text("nombre").notNull(),

    /** Descripción opcional */
    descripcion: text("descripcion"),

    /**
     * Centro de costo padre (jerarquía).
     * NULL para centros de nivel 1 (raíz).
     */
    centroPadreId: uuid("centro_padre_id"),

    /** Activo / inactivo (no se permiten movimientos a inactivos) */
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
    // Unique: código único por tenant
    codigoTenantUniq: index("centros_costo_codigo_tenant_idx").on(
      table.codigo,
      table.tenantSlug,
    ),
    // Index: búsqueda por padre
    padreIdx: index("centros_costo_padre_idx").on(table.centroPadreId),
    // Index: tenant isolation
    tenantIdx: index("centros_costo_tenant_slug_idx").on(table.tenantSlug),
    // Index: activos
    activoIdx: index("centros_costo_activo_idx").on(table.activo),
  }),
);

// ─── Types ────────────────────────────────────

export type CentroCosto = typeof centrosCosto.$inferSelect;
export type NewCentroCosto = typeof centrosCosto.$inferInsert;
