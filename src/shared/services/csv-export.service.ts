/**
 * CSV Export Service — Generate CSV files from database queries.
 *
 * Generic CSV generator that works with any Drizzle query result.
 * Exports data from key tables for workshop reporting.
 *
 * @module shared/services/csv-export
 */

import { db } from "../../shared/database/drizzle.js";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { vehiculos } from "../../modules/workshop/schema/vehiculos.js";
import { clients } from "../../shared/database/schema/clients.js";
import { ordenesTrabajo } from "../../modules/workshop/schema/ordenes-trabajo.js";
import { facturas } from "../../modules/finance/schema/index.js";

// ─── Types ──────────────────────────────────────

export type ExportableTable = "vehiculos" | "clientes" | "ordenes" | "facturas";

export interface DateRangeOptions {
  /** ISO date string (YYYY-MM-DD) — filter by createdAt >= from */
  from?: string;
  /** ISO date string (YYYY-MM-DD) — filter by createdAt <= to (end of day) */
  to?: string;
}

interface CsvExportConfig {
  table: any;
  columns: Record<string, { header: string; accessor: (row: any) => any }>;
  dateColumn?: any; // Drizzle column for date filtering
  query?: (tenantSlug: string, dateRange?: DateRangeOptions) => Promise<any[]>;
}

// ─── CSV Generator ──────────────────────────────

/**
 * Escape a value for CSV (RFC 4180).
 */
function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV string.
 */
function toCsv(
  rows: any[],
  columns: Record<string, { header: string; accessor: (row: any) => any }>,
): string {
  const headers = Object.values(columns).map((c) => c.header);
  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    const values = Object.values(columns).map((c) => c.accessor(row));
    lines.push(values.map(csvEscape).join(","));
  }

  return lines.join("\n");
}

// ─── Date Range Filter Builder ───────────────────

function buildDateConditions(dateColumn: any, dateRange?: DateRangeOptions): any[] {
  if (!dateRange) return [];
  const conditions: any[] = [];
  if (dateRange.from) {
    conditions.push(gte(dateColumn, new Date(dateRange.from)));
  }
  if (dateRange.to) {
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);
    conditions.push(lte(dateColumn, endDate));
  }
  return conditions;
}

// ─── Export Configurations ──────────────────────

const EXPORT_CONFIGS: Record<string, CsvExportConfig> = {
  vehiculos: {
    table: vehiculos,
    dateColumn: vehiculos.createdAt,
    columns: {
      id: { header: "ID", accessor: (r) => r.id?.slice(0, 8) },
      plate: { header: "Chapa", accessor: (r) => r.plate },
      vin: { header: "VIN", accessor: (r) => r.vin },
      brand: { header: "Marca", accessor: (r) => r.brand },
      model: { header: "Modelo", accessor: (r) => r.model },
      year: { header: "Año", accessor: (r) => r.year },
      engineType: { header: "Motor", accessor: (r) => r.engineType },
      kilometraje: { header: "Kilometraje", accessor: (r) => r.kilometraje },
      createdAt: { header: "Fecha Registro", accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-PY") : "" },
    },
    query: async (tenantSlug, dateRange) => {
      const conditions = [eq(vehiculos.tenantSlug, tenantSlug), ...buildDateConditions(vehiculos.createdAt, dateRange)];
      return db().select().from(vehiculos).where(conditions.length > 1 ? and(...conditions) : conditions[0]).orderBy(desc(vehiculos.createdAt));
    },
  },
  clientes: {
    table: clients,
    dateColumn: clients.createdAt,
    columns: {
      id: { header: "ID", accessor: (r) => r.id?.slice(0, 8) },
      name: { header: "Nombre", accessor: (r) => r.name },
      email: { header: "Email", accessor: (r) => r.email },
      phone: { header: "Teléfono", accessor: (r) => r.phone },
      ruc: { header: "RUC", accessor: (r) => r.ruc },
      address: { header: "Dirección", accessor: (r) => r.address },
      createdAt: { header: "Fecha Registro", accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-PY") : "" },
    },
    query: async (tenantSlug, dateRange) => {
      const conditions = [eq(clients.tenantSlug, tenantSlug), ...buildDateConditions(clients.createdAt, dateRange)];
      return db().select().from(clients).where(conditions.length > 1 ? and(...conditions) : conditions[0]).orderBy(desc(clients.createdAt));
    },
  },
  ordenes: {
    table: ordenesTrabajo,
    dateColumn: ordenesTrabajo.createdAt,
    columns: {
      id: { header: "ID", accessor: (r) => r.id?.slice(0, 8) },
      status: { header: "Estado", accessor: (r) => r.status },
      description: { header: "Descripción", accessor: (r) => r.description },
      diagnosis: { header: "Diagnóstico", accessor: (r) => r.diagnosis },
      totalCost: { header: "Costo Total (Gs.)", accessor: (r) => r.totalCost ? Number(r.totalCost).toLocaleString("es-PY") : "" },
      hvAlert: { header: "HV Alerta", accessor: (r) => r.hvAlert ? "Sí" : "No" },
      createdAt: { header: "Fecha Apertura", accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-PY") : "" },
      updatedAt: { header: "Última Actualización", accessor: (r) => r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("es-PY") : "" },
    },
    query: async (tenantSlug, dateRange) => {
      const conditions = [eq(ordenesTrabajo.tenantSlug, tenantSlug), ...buildDateConditions(ordenesTrabajo.createdAt, dateRange)];
      return db().select().from(ordenesTrabajo).where(conditions.length > 1 ? and(...conditions) : conditions[0]).orderBy(desc(ordenesTrabajo.createdAt));
    },
  },
  facturas: {
    table: facturas,
    dateColumn: facturas.createdAt,
    columns: {
      id: { header: "ID", accessor: (r) => r.id?.slice(0, 8) },
      tipo: { header: "Tipo", accessor: (r) => r.tipo },
      numeroFacturaManual: { header: "Nº Factura", accessor: (r) => r.numeroFacturaManual || "" },
      total: { header: "Total (Gs.)", accessor: (r) => r.total ? Number(r.total).toLocaleString("es-PY") : "" },
      estadoPago: { header: "Estado Pago", accessor: (r) => r.estadoPago || "" },
      saldoPendiente: { header: "Saldo Pendiente (Gs.)", accessor: (r) => r.saldoPendiente ? Number(r.saldoPendiente).toLocaleString("es-PY") : "" },
      sifenStatus: { header: "Estado SIFEN", accessor: (r) => r.sifenStatus || "" },
      createdAt: { header: "Fecha Emisión", accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-PY") : "" },
    },
    query: async (tenantSlug, dateRange) => {
      const conditions = [eq(facturas.tenantSlug, tenantSlug), ...buildDateConditions(facturas.createdAt, dateRange)];
      return db().select().from(facturas).where(conditions.length > 1 ? and(...conditions) : conditions[0]).orderBy(desc(facturas.createdAt));
    },
  },
};

// ─── Public API ─────────────────────────────────

/**
 * Get list of available export tables.
 */
export function getExportableTables(): string[] {
  return Object.keys(EXPORT_CONFIGS);
}

/**
 * Export a table as CSV.
 *
 * @param table - Table name (vehiculos, clientes, ordenes, facturas)
 * @param tenantSlug - Tenant isolation filter
 * @param dateRange - Optional date range filter (from/to ISO strings)
 * @returns CSV string with BOM for Excel compatibility
 */
export async function exportTableCsv(
  table: string,
  tenantSlug: string,
  dateRange?: DateRangeOptions,
): Promise<{ csv: string; filename: string; contentType: string; rowCount: number }> {
  const config = EXPORT_CONFIGS[table];
  if (!config) {
    throw new Error(`Tabla no soportada: ${table}. Disponibles: ${getExportableTables().join(", ")}`);
  }

  const rows = await config.query!(tenantSlug, dateRange);
  const csv = toCsv(rows, config.columns);

  // BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const dateSuffix = dateRange?.from || dateRange?.to
    ? `_${dateRange.from || "start"}_to_${dateRange.to || "end"}`
    : "";
  const filename = `${table}${dateSuffix}_export_${new Date().toISOString().slice(0, 10)}.csv`;

  return {
    csv: BOM + csv,
    filename,
    contentType: "text/csv; charset=utf-8",
    rowCount: rows.length,
  };
}
