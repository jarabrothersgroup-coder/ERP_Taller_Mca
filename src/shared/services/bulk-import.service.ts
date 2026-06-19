/**
 * Bulk Import Service — CSV import for clients, vehicles, repuestos.
 *
 * Parses CSV with validation, dry-run mode, and error reporting.
 * Supports Paraguayan data formats (RUC, Guaraní amounts).
 *
 * @module shared/services/bulk-import.service
 */

import { parse } from "csv-parse/sync";
import { z } from "zod";

// ─── Validation Schemas ────────────────────────

const clientImportSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  ruc: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const vehicleImportSchema = z.object({
  brand: z.string().min(1, "Marca requerida"),
  model: z.string().min(1, "Modelo requerida"),
  plate: z.string().optional().or(z.literal("")),
  vin: z.string().optional().or(z.literal("")),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  engineType: z.enum(["Nafta", "Diesel", "HEV", "BEV", "PHEV"]).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientRuc: z.string().optional().or(z.literal("")),
});

const repuestoImportSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  descripcion: z.string().min(1, "Descripción requerida"),
  categoria: z.string().optional().or(z.literal("")),
  precioVenta: z.coerce.number().min(0).optional(),
  stockActual: z.coerce.number().int().min(0).optional(),
  puntoReorden: z.coerce.number().int().min(0).optional(),
  proveedor: z.string().optional().or(z.literal("")),
});

// ─── Import Result Types ───────────────────────

export interface ImportResult {
  total: number;
  valid: number;
  invalid: number;
  errors: Array<{ row: number; field: string; message: string }>;
  preview: Record<string, any>[];
}

export interface ImportOptions {
  dryRun?: boolean;
  tenantSlug: string;
}

// ─── CSV Parsing ───────────────────────────────

/**
 * Parse CSV content and validate rows.
 *
 * @param csvContent - Raw CSV string
 * @param type - Import type (client, vehicle, repuesto)
 * @param options - Import options
 * @returns ImportResult with validation results
 */
export function parseAndValidate(
  csvContent: string,
  type: "client" | "vehicle" | "repuesto",
  _options?: ImportOptions
): ImportResult {
  const schema =
    type === "client" ? clientImportSchema :
    type === "vehicle" ? vehicleImportSchema :
    repuestoImportSchema;

  // Parse CSV
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // Handle BOM from Excel
  });

  const errors: ImportResult["errors"] = [];
  const preview: Record<string, any>[] = [];

  records.forEach((record: unknown, index: number) => {
    const typedRecord = record as Record<string, string>;
    const rowNumber = index + 2; // +2 for 1-indexed + header row

    const result = schema.safeParse(typedRecord);

    if (result.success) {
      preview.push(result.data);
    } else {
      result.error.issues.forEach((err) => {
        errors.push({
          row: rowNumber,
          field: err.path.join("."),
          message: err.message,
        });
      });
    }
  });

  return {
    total: records.length,
    valid: preview.length,
    invalid: records.length - preview.length,
    errors,
    preview: preview.slice(0, 10), // First 10 rows for preview
  };
}

// ─── CSV Template Generators ───────────────────

export function getClientTemplate(): string {
  return "name,email,phone,ruc,address,notes\nJuan Pérez,juan@email.com,+595 991 234567,1234567-8,Asunción,Cliente frecuente";
}

export function getVehicleTemplate(): string {
  return "brand,model,plate,vin,year,engineType,clientEmail,clientRuc\nToyota,Corolla,ABC-123,1HGBH41JXMN109186,2020,Nafta,juan@email.com,1234567-8";
}

export function getRepuestoTemplate(): string {
  return "codigo,descripcion,categoria,precioVenta,stockActual,puntoReorden,proveedor\nFIL-001,Filtro de aceite universal,Filtros,45000,50,10,AutoParts PY";
}

// ─── Export Helpers ─────────────────────────────

export function toCsv(records: Record<string, any>[]): string {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]);
  const rows = records.map((r) =>
    headers.map((h) => {
      const val = r[h];
      if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val ?? "";
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
