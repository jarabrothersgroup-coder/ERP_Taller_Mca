/**
 * Migration Service — Export/Import tenant-agnostic configuration.
 *
 * Handles transferring configuration data between tenants:
 *   - Plan de Cuentas (Chart of Accounts)
 *   - Catálogo de Servicios (Service Catalog)
 *   - Service Pricing Rules, Categories, Brand Map, RH Hours
 *
 * Tables are divided into:
 *   - Tenant-scoped (filtered by tenant_slug): plan_cuentas, servicios_catalogo,
 *     service_pricing_rules, rh_service_hours
 *   - Global (no tenant slug): service_categories, service_brand_map
 *
 * @module migration/migration.service
 */

import { db, sql } from "../../shared/database/drizzle.js";
import { planCuentas } from "../../shared/database/schema/index.js";
import {
  serviciosCatalogo,
  serviceCategories,
  servicePricingRules,
  serviceBrandMap,
  rhServiceHours,
} from "../workshop/schema/index.js";
import { eq } from "drizzle-orm";
import type {
  ExportableTable,
  TenantExport,
  TableExport,
  ImportOptions,
  ImportResult,
  TableImportResult,
} from "./types.js";
import { EXPORTABLE_TABLES, TABLE_DISPLAY_NAMES } from "./types.js";

// ─── Table Configuration ────────────────────────

interface TableConfig {
  /** Drizzle table object */
  table: any;
  /** Whether this table has a tenant_slug column */
  tenantScoped: boolean;
  /** Column to match on for conflict detection (besides id) */
  matchColumns: string[];
}

const TABLE_CONFIGS: Record<ExportableTable, TableConfig> = {
  plan_cuentas: {
    table: planCuentas,
    tenantScoped: true,
    matchColumns: ["codigo"],
  },
  servicios_catalogo: {
    table: serviciosCatalogo,
    tenantScoped: true,
    matchColumns: ["nombre"],
  },
  service_categories: {
    table: serviceCategories,
    tenantScoped: false,
    matchColumns: ["nombre"],
  },
  service_pricing_rules: {
    table: servicePricingRules,
    tenantScoped: true,
    matchColumns: ["servicio_id", "vehicle_type_id"],
  },
  service_brand_map: {
    table: serviceBrandMap,
    tenantScoped: false,
    matchColumns: ["servicio_id", "marca"],
  },
  rh_service_hours: {
    table: rhServiceHours,
    tenantScoped: true,
    matchColumns: ["servicio_id", "vehicle_type_id"],
  },
};

// ─── Export ─────────────────────────────────────

/**
 * Export all configuration tables for a tenant.
 *
 * @param tenantSlug - Source tenant slug
 * @param tables - Optional subset of tables to export (default: all)
 * @returns Full export payload with metadata
 */
export async function exportTenantConfig(
  tenantSlug: string,
  tables?: ExportableTable[],
): Promise<TenantExport> {
  const tablesToExport = tables ?? EXPORTABLE_TABLES;
  const tableExports: TableExport[] = [];
  let totalRows = 0;

  for (const tableName of tablesToExport) {
    const config = TABLE_CONFIGS[tableName];
    let rows: Record<string, unknown>[];

    if (config.tenantScoped) {
      // Query with tenant_slug filter
      rows = await db()
        .select()
        .from(config.table)
        .where(eq(config.table.tenantSlug, tenantSlug)) as Record<string, unknown>[];
    } else {
      // Global table — export all rows
      rows = await db()
        .select()
        .from(config.table) as Record<string, unknown>[];
    }

    // Strip internal IDs to allow clean re-import
    const cleanRows = rows.map((row) => {
      const clean = { ...row };
      delete clean.id;
      delete clean.createdAt;
      delete clean.updatedAt;
      return clean;
    });

    tableExports.push({
      table: tableName,
      rowCount: cleanRows.length,
      rows: cleanRows,
    });
    totalRows += cleanRows.length;
  }

  return {
    metadata: {
      sourceTenant: tenantSlug,
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      tableCount: tableExports.length,
      totalRows,
    },
    tables: tableExports,
  };
}

/**
 * Get a preview of exportable data (row counts only, no data).
 */
export async function getExportPreview(
  tenantSlug: string,
): Promise<Record<ExportableTable, number>> {
  const counts: Record<string, number> = {};

  for (const tableName of EXPORTABLE_TABLES) {
    const config = TABLE_CONFIGS[tableName];
    let result: { count: number }[];

    if (config.tenantScoped) {
      result = await db()
        .select({ count: sql<number>`count(*)::int` })
        .from(config.table)
        .where(eq(config.table.tenantSlug, tenantSlug));
    } else {
      result = await db()
        .select({ count: sql<number>`count(*)::int` })
        .from(config.table);
    }

    counts[tableName] = result[0]?.count ?? 0;
  }

  return counts as Record<ExportableTable, number>;
}

// ─── Import ─────────────────────────────────────

/**
 * Import configuration data into a tenant.
 *
 * @param exportData - The export payload to import
 * @param options - Import options (target tenant, conflict strategy, etc.)
 * @returns Import result with per-table stats
 */
export async function importTenantConfig(
  exportData: TenantExport,
  options: ImportOptions,
): Promise<ImportResult> {
  const { targetTenant, conflictStrategy, dryRun = false, tables } = options;
  const tablesToImport = tables ?? exportData.tables.map((t) => t.table);
  const tableResults: TableImportResult[] = [];

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const tableExport of exportData.tables) {
    if (!tablesToImport.includes(tableExport.table)) continue;

    const config = TABLE_CONFIGS[tableExport.table];
    const result: TableImportResult = {
      table: tableExport.table,
      inserted: 0,
      skipped: 0,
      updated: 0,
      errors: [],
    };

    for (const row of tableExport.rows) {
      try {
        // Set tenant_slug for tenant-scoped tables
        if (config.tenantScoped) {
          (row as any).tenantSlug = targetTenant;
        }

        // Check for existing record by match columns
        const existing = await findExisting(config, row, targetTenant);

        if (existing) {
          if (conflictStrategy === "skip") {
            result.skipped++;
            continue;
          } else if (conflictStrategy === "replace") {
            if (!dryRun) {
              await db()
                .update(config.table)
                .set(row)
                .where(eq(config.table.id, existing.id));
            }
            result.updated++;
            continue;
          }
          // "merge" falls through to insert with new ID (skip existing)
          result.skipped++;
          continue;
        }

        // Insert new record
        if (!dryRun) {
          await db().insert(config.table).values(row as any);
        }
        result.inserted++;
      } catch (err: any) {
        result.errors.push(err.message ?? String(err));
      }
    }

    totalInserted += result.inserted;
    totalSkipped += result.skipped;
    totalUpdated += result.updated;
    totalErrors += result.errors.length;
    tableResults.push(result);
  }

  return {
    dryRun,
    targetTenant,
    tables: tableResults,
    totalInserted,
    totalSkipped,
    totalUpdated,
    totalErrors,
  };
}

/**
 * Find an existing record by match columns.
 */
async function findExisting(
  config: TableConfig,
  row: Record<string, unknown>,
  tenantSlug: string,
): Promise<Record<string, unknown> | null> {
  const conditions: any[] = [];

  for (const col of config.matchColumns) {
    const value = (row as any)[col];
    if (value !== undefined && value !== null) {
      conditions.push(eq((config.table as any)[col], value));
    }
  }

  if (conditions.length === 0) return null;

  // For tenant-scoped tables, add tenant filter
  if (config.tenantScoped) {
    conditions.push(eq(config.table.tenantSlug, tenantSlug));
  }

  const result = await db()
    .select({ id: config.table.id })
    .from(config.table)
    .where(conditions[0])
    .limit(1);

  return result[0] ?? null;
}

// ─── Utilities ──────────────────────────────────

/**
 * Get list of available tables with display names and row counts.
 */
export async function getAvailableTables(
  tenantSlug: string,
): Promise<Array<{ key: ExportableTable; name: string; rowCount: number; tenantScoped: boolean }>> {
  const preview = await getExportPreview(tenantSlug);

  return EXPORTABLE_TABLES.map((key) => ({
    key,
    name: TABLE_DISPLAY_NAMES[key],
    rowCount: preview[key],
    tenantScoped: TABLE_CONFIGS[key].tenantScoped,
  }));
}
