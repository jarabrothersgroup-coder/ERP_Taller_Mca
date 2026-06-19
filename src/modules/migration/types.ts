/**
 * Tenant Migration Types — Export/Import of tenant-agnostic configuration.
 *
 * Defines the data structures for transferring configuration between tenants:
 *   - Plan de Cuentas (Chart of Accounts)
 *   - Catálogo de Servicios (Service Catalog)
 *   - Service Pricing Rules
 *   - Service Categories
 *   - Service Brand Map
 *   - RH Service Hours
 *
 * @module migration/types
 */

// ─── Exportable Table Keys ──────────────────────

/** Tables that can be exported/imported between tenants */
export type ExportableTable =
  | "plan_cuentas"
  | "servicios_catalogo"
  | "service_categories"
  | "service_pricing_rules"
  | "service_brand_map"
  | "rh_service_hours";

/** All exportable table keys */
export const EXPORTABLE_TABLES: ExportableTable[] = [
  "plan_cuentas",
  "servicios_catalogo",
  "service_categories",
  "service_pricing_rules",
  "service_brand_map",
  "rh_service_hours",
];

/** Human-readable names for exportable tables */
export const TABLE_DISPLAY_NAMES: Record<ExportableTable, string> = {
  plan_cuentas: "Plan de Cuentas",
  servicios_catalogo: "Catálogo de Servicios",
  service_categories: "Categorías de Servicio",
  service_pricing_rules: "Reglas de Precio",
  service_brand_map: "Mapa de Marcas",
  rh_service_hours: "Horas Estimadas por Servicio",
};

// ─── Export Types ───────────────────────────────

/** Single table export payload */
export interface TableExport {
  /** Table name */
  table: ExportableTable;
  /** Row count exported */
  rowCount: number;
  /** The actual data rows */
  rows: Record<string, unknown>[];
}

/** Full tenant config export */
export interface TenantExport {
  /** Export metadata */
  metadata: {
    /** Source tenant slug */
    sourceTenant: string;
    /** Export timestamp */
    exportedAt: string;
    /** ERP version */
    version: string;
    /** Number of tables exported */
    tableCount: number;
    /** Total rows across all tables */
    totalRows: number;
  };
  /** Per-table exports */
  tables: TableExport[];
}

// ─── Import Types ───────────────────────────────

/** Import options */
export interface ImportOptions {
  /** Target tenant slug */
  targetTenant: string;
  /** Tables to import (empty = all) */
  tables?: ExportableTable[];
  /** Conflict resolution strategy */
  conflictStrategy: "skip" | "replace" | "merge";
  /** Dry run — validate without writing */
  dryRun?: boolean;
}

/** Per-table import result */
export interface TableImportResult {
  table: ExportableTable;
  inserted: number;
  skipped: number;
  updated: number;
  errors: string[];
}

/** Full import result */
export interface ImportResult {
  /** Whether it was a dry run */
  dryRun: boolean;
  /** Target tenant */
  targetTenant: string;
  /** Per-table results */
  tables: TableImportResult[];
  /** Total rows affected */
  totalInserted: number;
  /** Total rows skipped */
  totalSkipped: number;
  /** Total rows updated */
  totalUpdated: number;
  /** Total errors */
  totalErrors: number;
}

// ─── Seed Types ─────────────────────────────────

/** Vehicle brand seed data */
export interface VehicleBrandSeed {
  nombre: string;
  paisOrigen: string;
}

/** Vehicle model seed data */
export interface VehicleModelSeed {
  marca: string;
  nombre: string;
  vehicleType: string;
  motorCc?: string;
  combustibleDefault?: string;
}

/** Service catalog seed data */
export interface ServiceSeed {
  nombre: string;
  descripcion?: string;
  categoria: string;
  codigo: string;
  precioEstimado: number;
  duracionEstimada: number;
}
