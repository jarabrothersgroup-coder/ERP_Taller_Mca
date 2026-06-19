/**
 * Import Routes — CSV data import endpoints.
 *
 * POST /import/:table          — Import CSV data for a given table
 * GET  /import/:table/template — Download CSV template with headers
 *
 * Supported tables: vehiculos, clientes, repuestos
 *
 * @module shared/routes/import.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../database/drizzle.js";
import { eq } from "drizzle-orm";
import { vehiculos } from "../../modules/workshop/schema/vehiculos.js";
import { clients } from "../database/schema/clients.js";
import { BadRequestError } from "../errors/app-error.js";

// ─── CSV Parser ─────────────────────────────────

/**
 * Parse a CSV string into an array of objects.
 * Handles quoted fields, escaped quotes, and different line endings.
 */
function parseCsv(csvContent: string): Record<string, string>[] {
  const lines = csvContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new BadRequestError("CSV debe contener al menos una cabecera y una fila de datos");
  }

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || "").trim();
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// ─── Import Configurations ──────────────────────

interface ImportConfig {
  table: any;
  columns: Record<string, { field: string; required?: boolean; transform?: (val: string) => any }>;
  query?: (tenantSlug: string) => Promise<any[]>;
}

const IMPORT_CONFIGS: Record<string, ImportConfig> = {
  vehiculos: {
    table: vehiculos,
    columns: {
      chapa: { field: "plate", required: true },
      vin: { field: "vin" },
      marca: { field: "brand", required: true },
      modelo: { field: "model", required: true },
      anio: { field: "year", transform: (v) => (v ? parseInt(v, 10) : undefined) },
      motor: { field: "engineType" },
      kilometraje: { field: "kilometraje", transform: (v) => (v ? parseInt(v, 10) : undefined) },
    },
    query: async (tenantSlug) => {
      return db().select().from(vehiculos).where(eq(vehiculos.tenantSlug, tenantSlug));
    },
  },
  clientes: {
    table: clients,
    columns: {
      nombre: { field: "name", required: true },
      email: { field: "email" },
      telefono: { field: "phone" },
      ruc: { field: "ruc" },
      direccion: { field: "address" },
    },
    query: async (tenantSlug) => {
      return db().select().from(clients).where(eq(clients.tenantSlug, tenantSlug));
    },
  },
};

// ─── Import Routes ──────────────────────────────

export async function importRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /import/:table/template — Download CSV template ──
  app.get<{ Params: { table: string } }>(
    "/import/:table/template",
    async (request: FastifyRequest<{ Params: { table: string } }>, reply: FastifyReply) => {
      const { table } = request.params;
      const config = IMPORT_CONFIGS[table];
      if (!config) {
        throw new BadRequestError(`Tabla no soportada: ${table}. Disponibles: ${Object.keys(IMPORT_CONFIGS).join(", ")}`);
      }

      const headers = Object.keys(config.columns);
      const csv = "\uFEFF" + headers.join(",") + "\n";
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${table}_template.csv"`)
        .send(csv);
    },
  );

  // ── POST /import/:table — Import CSV data ──
  app.post<{ Params: { table: string }; Body: { csv: string } }>(
    "/import/:table",
    {
      schema: {
        body: {
          type: "object",
          required: ["csv"],
          properties: {
            csv: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { table: string }; Body: { csv: string } }>, reply: FastifyReply) => {
      const { table } = request.params;
      const { csv } = request.body;
      const tenantSlug = (request as any).tenantSlug as string;

      const config = IMPORT_CONFIGS[table];
      if (!config) {
        throw new BadRequestError(`Tabla no soportada: ${table}. Disponibles: ${Object.keys(IMPORT_CONFIGS).join(", ")}`);
      }

      if (!csv || csv.trim().length === 0) {
        throw new BadRequestError("CSV vacío");
      }

      // Parse CSV
      const rows = parseCsv(csv);
      if (rows.length === 0) {
        throw new BadRequestError("CSV no contiene filas de datos");
      }

      // Validate required columns
      const csvHeaders = Object.keys(rows[0]);
      for (const [csvCol, colConfig] of Object.entries(config.columns)) {
        if (colConfig.required && !csvHeaders.includes(csvCol)) {
          throw new BadRequestError(`Columna requerida faltante: ${csvCol}`);
        }
      }

      // Transform and insert
      const results: { inserted: number; errors: string[]; skipped: number } = {
        inserted: 0,
        errors: [],
        skipped: 0,
      };

      for (let i = 0; i < rows.length; i++) {
        try {
          const rowData: Record<string, any> = { tenantSlug };
          for (const [csvCol, colConfig] of Object.entries(config.columns)) {
            const rawValue = rows[i][csvCol];
            if (rawValue !== undefined && rawValue !== "") {
              rowData[colConfig.field] = colConfig.transform ? colConfig.transform(rawValue) : rawValue;
            }
          }

          // Skip rows with no required fields
          const hasRequired = Object.entries(config.columns)
            .filter(([, c]) => c.required)
            .every(([csvCol]) => rowData[config.columns[csvCol].field] !== undefined);

          if (!hasRequired) {
            results.skipped++;
            continue;
          }

          await db().insert(config.table).values(rowData);
          results.inserted++;
        } catch (err: any) {
          results.errors.push(`Fila ${i + 1}: ${err.message}`);
        }
      }

      return reply.send({
        ok: true,
        table,
        totalRows: rows.length,
        inserted: results.inserted,
        skipped: results.skipped,
        errors: results.errors.slice(0, 10), // Limit error output
        hasMoreErrors: results.errors.length > 10,
      });
    },
  );
}
