/**
 * Tool Loans routes — lend/return endpoints.
 *
 * Endpoints:
 *   POST   /inventory/tool-loans/lend                    — Check-out tool to mechanic
 *   POST   /inventory/tool-loans/:id/return              — Check-in with condition
 *   GET    /inventory/tool-loans                         — List loans (filtered)
 *   GET    /inventory/tool-loans/overdue                 — Overdue loans
 *   GET    /inventory/tool-loans/mechanic/:mecanicoId    — Active loans by mechanic
 *
 * @module inventory/routes/tool-loans
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  lendTool,
  returnTool,
  listLoans,
  listOverdueLoans,
  getMechanicActiveLoans,
} from "../services/tool-loan.service.js";

interface IdParams { id: string; }
interface MecanicoParams { mecanicoId: string; }

interface LendBody {
  toolInstanceId: string;
  ordenTrabajoId: string;
  mecanicoId: string;
  fechaEsperadaDevolucion?: string;
  condicionSalida?: string;
  observaciones?: string;
}

interface ReturnBody {
  condicionRetorno: 'BUENO' | 'DESGASTADO' | 'DANADO' | 'EXTRAVIADO';
  costoReparacion?: number | string;
  observaciones?: string;
}

interface LoanQuery {
  toolInstanceId?: string;
  ordenTrabajoId?: string;
  mecanicoId?: string;
  herramientaId?: string;
  estado?: string;
  soloActivos?: string;
  page?: string;
  limit?: string;
}

export async function toolLoansRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/tool-loans/lend — Lend tool ──
  app.post<{ Body: LendBody }>(
    "/inventory/tool-loans/lend",
    {
      schema: {
        body: {
          type: "object",
          required: ["toolInstanceId", "ordenTrabajoId", "mecanicoId"],
          properties: {
            toolInstanceId: { type: "string", format: "uuid" },
            ordenTrabajoId: { type: "string", format: "uuid" },
            mecanicoId: { type: "string", format: "uuid" },
            fechaEsperadaDevolucion: { type: "string", format: "date-time" },
            condicionSalida: { type: "string", maxLength: 50 },
            observaciones: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LendBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const usuarioId = request.headers["x-user-id"] as string || "system";
      const result = await lendTool(request.body, usuarioId, tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── POST /inventory/tool-loans/:id/return — Return tool ──
  app.post<{ Params: IdParams; Body: ReturnBody }>(
    "/inventory/tool-loans/:id/return",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["condicionRetorno"],
          properties: {
            condicionRetorno: {
              type: "string",
              enum: ["BUENO", "DESGASTADO", "DANADO", "EXTRAVIADO"],
            },
            costoReparacion: { type: "number", minimum: 0 },
            observaciones: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams; Body: ReturnBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const usuarioId = request.headers["x-user-id"] as string || "system";
      const result = await returnTool(request.params.id, request.body, usuarioId, tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tool-loans — List loans ──
  app.get<{ Querystring: LoanQuery }>(
    "/inventory/tool-loans",
    async (request: FastifyRequest<{ Querystring: LoanQuery }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const { toolInstanceId, ordenTrabajoId, mecanicoId, herramientaId, estado, soloActivos, page, limit } = request.query;
      const result = await listLoans({
        toolInstanceId,
        ordenTrabajoId,
        mecanicoId,
        herramientaId,
        estado,
        soloActivos: soloActivos === "true",
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        tenantSlug,
      });
      return reply.send(result);
    },
  );

  // ── GET /inventory/tool-loans/overdue — Overdue loans ──
  app.get(
    "/inventory/tool-loans/overdue",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await listOverdueLoans(tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tool-loans/mechanic/:mecanicoId — Active loans by mechanic ──
  app.get<{ Params: MecanicoParams }>(
    "/inventory/tool-loans/mechanic/:mecanicoId",
    async (request: FastifyRequest<{ Params: MecanicoParams }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await getMechanicActiveLoans(request.params.mecanicoId, tenantSlug);
      return reply.send(result);
    },
  );
}
