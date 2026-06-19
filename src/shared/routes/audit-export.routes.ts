/**
 * Audit Export Routes — CSV export for audit log entries.
 *
 * GET /export/audit-log                — Export all audit log entries as CSV
 * GET /export/audit-log?from=&to=      — Export with date range filter
 * GET /export/audit-log?entidad=       — Export filtered by entity type
 * GET /export/audit-log?accion=        — Export filtered by action type
 *
 * All routes require X-Tenant-Slug header.
 *
 * @module shared/routes/audit-export.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { queryAuditLog } from "../../modules/finance/services/accounting/audit-log.service.js";

// ─── CSV Helpers ────────────────────────────────

function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function auditLogToCsv(entries: any[]): string {
  const headers = [
    "ID",
    "Fecha",
    "Usuario",
    "IP",
    "Acción",
    "Entidad",
    "Entidad ID",
    "Descripción",
    "Valor Anterior",
    "Valor Nuevo",
  ];

  const lines = [headers.map(csvEscape).join(",")];

  for (const entry of entries) {
    const row = [
      entry.id?.slice(0, 8) || "",
      entry.createdAt ? new Date(entry.createdAt).toLocaleString("es-PY") : "",
      entry.usuarioId || "",
      entry.ip || "",
      entry.accion || "",
      entry.entidad || "",
      entry.entidadId?.slice(0, 8) || "",
      entry.descripcion || "",
      entry.valorAnterior ? JSON.stringify(entry.valorAnterior) : "",
      entry.valorNuevo ? JSON.stringify(entry.valorNuevo) : "",
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  return lines.join("\n");
}

// ─── Routes ─────────────────────────────────────

interface AuditExportQuery {
  from?: string;
  to?: string;
  entidad?: string;
  accion?: string;
  limit?: string;
}

export async function auditExportRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /export/audit-log — Export audit log as CSV ──
  app.get<{ Querystring: AuditExportQuery }>(
    "/export/audit-log",
    async (request: FastifyRequest<{ Querystring: AuditExportQuery }>, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { from, to, entidad, accion, limit } = request.query;

      const filter: any = {
        tenantSlug,
        limit: limit ? parseInt(limit, 10) : 1000,
      };

      if (from) filter.desde = new Date(from);
      if (to) {
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        filter.hasta = endDate;
      }
      if (entidad) filter.entidad = entidad;
      if (accion) filter.accion = accion;

      const result = await queryAuditLog(filter);
      const csv = auditLogToCsv(result.entries);

      const BOM = "\uFEFF";
      const dateSuffix = from || to ? `_${from || "start"}_to_${to || "end"}` : "";
      const filename = `audit_log${dateSuffix}_export_${new Date().toISOString().slice(0, 10)}.csv`;

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .header("X-Export-Row-Count", String(result.entries.length))
        .header("X-Export-Total-Count", String(result.total))
        .send(BOM + csv);
    },
  );
}
