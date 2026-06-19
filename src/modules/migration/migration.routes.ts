/**
 * Migration Routes — Export/Import tenant configuration endpoints.
 *
 * GET  /migration/tables          — List available tables with row counts
 * GET  /migration/preview         — Preview export (row counts only)
 * POST /migration/export          — Export tenant config as JSON
 * POST /migration/import          — Import config from JSON payload
 * POST /migration/import/file     — Import config from uploaded JSON file
 *
 * @module migration/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  exportTenantConfig,
  importTenantConfig,
  getExportPreview,
  getAvailableTables,
} from "./migration.service.js";
import type { ExportableTable, ImportOptions } from "./types.js";
import { EXPORTABLE_TABLES } from "./types.js";
import { BadRequestError } from "../../shared/errors/app-error.js";

export async function migrationRoutes(app: FastifyInstance): Promise<void> {
  // ─── List available tables ──────────────────
  app.get("/api/v1/migration/tables", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (request.headers["x-tenant-slug"] as string) || "taller-el-chero";
    const tables = await getAvailableTables(tenantSlug);
    return reply.send({ tables });
  });

  // ─── Preview export (counts only) ───────────
  app.get("/api/v1/migration/preview", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (request.headers["x-tenant-slug"] as string) || "taller-el-chero";
    const preview = await getExportPreview(tenantSlug);
    return reply.send({ tenantSlug, preview });
  });

  // ─── Export tenant config ───────────────────
  app.post("/api/v1/migration/export", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (request.headers["x-tenant-slug"] as string) || "taller-el-chero";
    const body = request.body as { tables?: ExportableTable[] } | undefined;

    // Validate table names if provided
    if (body?.tables) {
      const invalid = body.tables.filter((t) => !EXPORTABLE_TABLES.includes(t));
      if (invalid.length > 0) {
        throw new BadRequestError(`Tablas no válidas: ${invalid.join(", ")}`);
      }
    }

    const exportData = await exportTenantConfig(tenantSlug, body?.tables);

    // Set download headers
    const filename = `migration-${tenantSlug}-${Date.now()}.json`;
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    reply.header("Content-Type", "application/json");

    return reply.send(exportData);
  });

  // ─── Import config from JSON body ──────────
  app.post("/api/v1/migration/import", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      data: any;
      targetTenant?: string;
      tables?: ExportableTable[];
      conflictStrategy?: "skip" | "replace" | "merge";
      dryRun?: boolean;
    };

    if (!body?.data) {
      throw new BadRequestError("Payload 'data' requerido (export JSON)");
    }

    const targetTenant = body.targetTenant || (request.headers["x-tenant-slug"] as string) || "taller-el-chero";

    // Validate export format
    if (!body.data.metadata || !body.data.tables) {
      throw new BadRequestError("Formato de export inválido: faltan 'metadata' o 'tables'");
    }

    const options: ImportOptions = {
      targetTenant,
      tables: body.tables,
      conflictStrategy: body.conflictStrategy ?? "skip",
      dryRun: body.dryRun ?? false,
    };

    const result = await importTenantConfig(body.data, options);
    return reply.send(result);
  });

  // ─── Import config from uploaded JSON file ─
  app.post("/api/v1/migration/import/file", async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      throw new BadRequestError("Archivo JSON requerido");
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString("utf-8");

    let exportData: any;
    try {
      exportData = JSON.parse(content);
    } catch {
      throw new BadRequestError("Archivo JSON inválido");
    }

    if (!exportData.metadata || !exportData.tables) {
      throw new BadRequestError("Formato de export inválido: faltan 'metadata' o 'tables'");
    }

    const targetTenant = (request.headers["x-tenant-slug"] as string) || "taller-el-chero";

    const options: ImportOptions = {
      targetTenant,
      conflictStrategy: "skip",
      dryRun: false,
    };

    const result = await importTenantConfig(exportData, options);
    return reply.send(result);
  });

  app.log.info("Migration routes registered");
}
