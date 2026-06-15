/**
 * Tool Depreciation routes — monthly depreciation calculation.
 *
 * Endpoints:
 *   POST /inventory/tools/depreciation/calculate  — Calculate monthly depreciation
 *   GET  /inventory/tools/depreciation/:toolInstanceId — View depreciation history
 *   GET  /inventory/tools/depreciation/book-value/:toolInstanceId — Current book value
 *
 * @module inventory/routes/tool-depreciation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  calculateMonthlyDepreciation,
  getDepreciationHistory,
  getCurrentBookValue,
} from "../services/tool-depreciation.service.js";

interface ToolInstanceParams { toolInstanceId: string; }

interface CalculateBody {
  periodo?: string;
  anho?: number;
  mes?: number;
}

export async function toolDepreciationRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/tools/depreciation/calculate — Calculate ──
  app.post<{ Body: CalculateBody }>(
    "/inventory/tools/depreciation/calculate",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            periodo: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
            anho: { type: "integer", minimum: 2020 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CalculateBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await calculateMonthlyDepreciation(request.body, tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tools/depreciation/:toolInstanceId — History ──
  app.get<{ Params: ToolInstanceParams }>(
    "/inventory/tools/depreciation/:toolInstanceId",
    async (request: FastifyRequest<{ Params: ToolInstanceParams }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await getDepreciationHistory(request.params.toolInstanceId, tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tools/depreciation/book-value/:toolInstanceId — Book value ──
  app.get<{ Params: ToolInstanceParams }>(
    "/inventory/tools/depreciation/book-value/:toolInstanceId",
    async (request: FastifyRequest<{ Params: ToolInstanceParams }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await getCurrentBookValue(request.params.toolInstanceId, tenantSlug);
      if (!result) {
        return reply.status(404).send({ error: "Herramienta no encontrada" });
      }
      return reply.send(result);
    },
  );
}
