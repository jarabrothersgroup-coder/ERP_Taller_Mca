/**
 * Enterprise Audit Trail Routes — Admin-only endpoints for compliance.
 *
 * @module enterprise/routes/audit-enterprise.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAdmin } from "../../../shared/middleware/rbac.js";
import {
  queryAuditLog,
  verifyHashChain,
  getAuditStats,
  exportAuditCsv,
} from "../services/audit-enterprise.service.js";

/**
 * Register enterprise audit routes.
 */
export async function enterpriseAuditRoutes(
  app: FastifyInstance,
): Promise<void> {
  // All audit routes require admin role
  app.addHook("preHandler", requireAdmin);

  /**
   * GET /enterprise/audit — Query audit log with filters
   */
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = request.tenantSlug!;
    const {
      from,
      to,
      action,
      entityType,
      entityId,
      userEmail,
      severity,
      limit,
      offset,
    } = request.query as Record<string, string>;

    const result = await queryAuditLog({
      tenantSlug,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      action: action as any,
      entityType,
      entityId,
      userEmail,
      severity,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });

    return reply.send(result);
  });

  /**
   * GET /enterprise/audit/verify — Verify hash chain integrity
   */
  app.get("/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = request.tenantSlug!;
    const { limit } = request.query as { limit?: string };

    const result = await verifyHashChain(
      tenantSlug,
      limit ? parseInt(limit) : 1000,
    );

    return reply.send(result);
  });

  /**
   * GET /enterprise/audit/stats — Audit statistics
   */
  app.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = request.tenantSlug!;
    const { days } = request.query as { days?: string };

    const stats = await getAuditStats(
      tenantSlug,
      days ? parseInt(days) : 30,
    );

    return reply.send(stats);
  });

  /**
   * GET /enterprise/audit/export — Export audit log as CSV
   */
  app.get("/export", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = request.tenantSlug!;
    const { from, to, action, entityType } = request.query as Record<string, string>;

    const csv = await exportAuditCsv({
      tenantSlug,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      action: action as any,
      entityType,
    });

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      )
      .send(csv);
  });
}
