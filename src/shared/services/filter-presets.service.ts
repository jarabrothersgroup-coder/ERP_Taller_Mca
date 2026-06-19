/**
 * Filter Presets Service — Advanced multi-field filtering with saved presets.
 *
 * Provides:
 *   - In-memory preset storage (per-tenant)
 *   - Preset CRUD (create, list, delete)
 *   - Multi-field filter builder for Drizzle queries
 *
 * RAM: < 10KB (in-memory presets only).
 *
 * @module shared/services/filter-presets
 */

// ─── Types ──────────────────────────────────────

export interface FilterField {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "between";
  value: any;
  value2?: any; // For "between" operator
}

export interface FilterPreset {
  id: string;
  tenantSlug: string;
  name: string;
  entity: string; // e.g., "ordenes", "repuestos", "facturas"
  filters: FilterField[];
  createdAt: string;
}

// ─── In-Memory Storage ──────────────────────────

const presets = new Map<string, FilterPreset>();
let presetCounter = 0;

function generatePresetId(): string {
  presetCounter++;
  return `preset-${Date.now()}-${presetCounter}`;
}

// ─── Preset CRUD ────────────────────────────────

/**
 * Create a new filter preset.
 */
export function createPreset(
  tenantSlug: string,
  name: string,
  entity: string,
  filters: FilterField[],
): FilterPreset {
  const id = generatePresetId();
  const preset: FilterPreset = {
    id,
    tenantSlug,
    name,
    entity,
    filters,
    createdAt: new Date().toISOString(),
  };
  presets.set(id, preset);
  return preset;
}

/**
 * List all presets for a tenant and entity.
 */
export function listPresets(tenantSlug: string, entity?: string): FilterPreset[] {
  return Array.from(presets.values()).filter(
    (p) => p.tenantSlug === tenantSlug && (!entity || p.entity === entity),
  );
}

/**
 * Get a preset by ID.
 */
export function getPreset(id: string): FilterPreset | undefined {
  return presets.get(id);
}

/**
 * Delete a preset by ID.
 */
export function deletePreset(id: string): boolean {
  return presets.delete(id);
}

// ─── Filter Builder ─────────────────────────────

import { eq, ne, gt, gte, lt, lte, like, ilike, inArray, and, SQL } from "drizzle-orm";

/**
 * Build a Drizzle WHERE condition from filter fields.
 *
 * @param table - Drizzle table schema
 * @param filters - Array of filter fields
 * @returns SQL condition for .where()
 */
export function buildFilterCondition(
  table: Record<string, any>,
  filters: FilterField[],
): SQL | undefined {
  if (!filters || filters.length === 0) return undefined;

  const conditions: SQL[] = [];

  for (const filter of filters) {
    const column = table[filter.field];
    if (!column) continue; // Skip unknown fields

    let condition: SQL | undefined;
    switch (filter.operator) {
      case "eq":
        condition = eq(column, filter.value);
        break;
      case "neq":
        condition = ne(column, filter.value);
        break;
      case "gt":
        condition = gt(column, filter.value);
        break;
      case "gte":
        condition = gte(column, filter.value);
        break;
      case "lt":
        condition = lt(column, filter.value);
        break;
      case "lte":
        condition = lte(column, filter.value);
        break;
      case "like":
        condition = like(column, filter.value);
        break;
      case "ilike":
        condition = ilike(column, filter.value);
        break;
      case "in":
        condition = inArray(column, filter.value);
        break;
      case "between":
        condition = and(gte(column, filter.value), lte(column, filter.value2)) as SQL;
        break;
    }

    if (condition) conditions.push(condition);
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions) as SQL;
}

// ─── Quick Filters ──────────────────────────────

/**
 * Common quick filters for workshop entities.
 */
export const QUICK_FILTERS = {
  ordenes: {
    activas: { entity: "ordenes", name: "Órdenes Activas", filters: [
      { field: "status", operator: "in" as const, value: ["Presupuestado", "Aprobado", "En_Proceso"] },
    ]},
    finalizadas: { entity: "ordenes", name: "Órdenes Finalizadas", filters: [
      { field: "status", operator: "in" as const, value: ["Control_Calidad", "Listo"] },
    ]},
    hv_alert: { entity: "ordenes", name: "Con Alerta HV", filters: [
      { field: "hvAlert", operator: "eq" as const, value: true },
    ]},
  },
  repuestos: {
    bajo_stock: { entity: "repuestos", name: "Bajo Stock", filters: [
      { field: "stockActual", operator: "lte" as const, value: 5 },
    ]},
    sin_stock: { entity: "repuestos", name: "Sin Stock", filters: [
      { field: "stockActual", operator: "eq" as const, value: 0 },
    ]},
  },
  facturas: {
    pendientes: { entity: "facturas", name: "Facturas Pendientes", filters: [
      { field: "estadoPago", operator: "eq" as const, value: "pendiente" },
    ]},
    pagadas: { entity: "facturas", name: "Facturas Pagadas", filters: [
      { field: "estadoPago", operator: "eq" as const, value: "pagado" },
    ]},
  },
};
