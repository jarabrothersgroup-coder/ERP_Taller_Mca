/**
 * Tool Instances routes — individual asset lifecycle endpoints.
 *
 * Endpoints:
 *   POST   /inventory/tool-instances                    — Create asset instance
 *   GET    /inventory/tool-instances                    — List instances (filtered)
 *   GET    /inventory/tool-instances/disponibles        — List available instances
 *   GET    /inventory/tool-instances/due-for-calibration — List due for calibration
 *   GET    /inventory/tool-instances/:id                — Get instance by ID
 *   PATCH  /inventory/tool-instances/:id                — Update instance
 *   POST   /inventory/tool-instances/:id/calibrate      — Start calibration
 *   POST   /inventory/tool-instances/:id/complete-calibration — Complete calibration
 *   POST   /inventory/tool-instances/:id/complete-repair    — Complete repair
 *   POST   /inventory/tool-instances/:id/decommission   — Write-off
 *
 * @module inventory/routes/tool-instances
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createToolInstance,
  getToolInstanceById,
  listToolInstances,
  updateToolInstance,
  listAvailableInstances,
  getToolsDueForCalibration,
  startCalibration,
  completeCalibration,
  completeRepair,
  decommissionTool,
} from "../services/tool-instance.service.js";

interface IdParams { id: string; }
interface ListQuery {
  herramientaId?: string;
  estado?: string;
  activa?: string;
  search?: string;
  page?: string;
  limit?: string;
}

interface CreateBody {
  herramientaId: string;
  numeroSerie: string;
  tagRfid?: string;
  codigoBarras?: string;
  codigoInventario?: string;
  costoAdquisicion: number | string;
  fechaAdquisicion: string;
  requiereCalibracion?: boolean;
  diasIntervaloCalibracion?: number;
  ubicacionActual?: string;
  categoriaContableId?: string;
}

interface UpdateBody {
  tagRfid?: string | null;
  codigoBarras?: string | null;
  codigoInventario?: string | null;
  ubicacionActual?: string | null;
  requiereCalibracion?: boolean;
  diasIntervaloCalibracion?: number | null;
  activa?: boolean;
  categoriaContableId?: string | null;
}

interface CompleteCalibrationBody {
  proximaCalibracion: string;
  resultado?: string;
  certificadoUrl?: string | null;
  costo?: number | string | null;
  observaciones?: string;
}

interface DecommissionBody {
  motivoBaja: string;
  fechaBaja?: string;
  observaciones?: string;
}

export async function toolInstancesRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/tool-instances — Create instance ──
  app.post<{ Body: CreateBody }>(
    "/inventory/tool-instances",
    {
      schema: {
        body: {
          type: "object",
          required: ["herramientaId", "numeroSerie", "costoAdquisicion", "fechaAdquisicion"],
          properties: {
            herramientaId: { type: "string", format: "uuid" },
            numeroSerie: { type: "string", maxLength: 100 },
            tagRfid: { type: "string", maxLength: 100 },
            codigoBarras: { type: "string", maxLength: 100 },
            codigoInventario: { type: "string", maxLength: 50 },
            costoAdquisicion: { type: "number", minimum: 0 },
            fechaAdquisicion: { type: "string", format: "date" },
            requiereCalibracion: { type: "boolean" },
            diasIntervaloCalibracion: { type: "integer", minimum: 1 },
            ubicacionActual: { type: "string", maxLength: 100 },
            categoriaContableId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await createToolInstance(request.body, tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /inventory/tool-instances — List instances ──
  app.get<{ Querystring: ListQuery }>(
    "/inventory/tool-instances",
    async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const { herramientaId, estado, activa, search, page, limit } = request.query;
      const result = await listToolInstances({
        herramientaId,
        estado,
        activa: activa !== undefined ? activa === "true" : undefined,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        tenantSlug,
      });
      return reply.send(result);
    },
  );

  // ── GET /inventory/tool-instances/disponibles — Available instances ──
  app.get(
    "/inventory/tool-instances/disponibles",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = _request.headers["x-tenant-slug"] as string;
      const result = await listAvailableInstances(tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tool-instances/due-for-calibration ──
  app.get<{ Querystring: { days?: string } }>(
    "/inventory/tool-instances/due-for-calibration",
    async (request: FastifyRequest<{ Querystring: { days?: string } }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const daysAhead = request.query.days ? parseInt(request.query.days, 10) : 30;
      const result = await getToolsDueForCalibration(tenantSlug, daysAhead);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tool-instances/:id — Get instance ──
  app.get<{ Params: IdParams }>(
    "/inventory/tool-instances/:id",
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await getToolInstanceById(request.params.id, tenantSlug);
      return reply.send(result);
    },
  );

  // ── PATCH /inventory/tool-instances/:id — Update instance ──
  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    "/inventory/tool-instances/:id",
    async (request: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await updateToolInstance(request.params.id, request.body, tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /inventory/tool-instances/:id/calibrate — Start calibration ──
  app.post<{ Params: IdParams }>(
    "/inventory/tool-instances/:id/calibrate",
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await startCalibration(request.params.id, tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /inventory/tool-instances/:id/complete-calibration ──
  app.post<{ Params: IdParams; Body: CompleteCalibrationBody }>(
    "/inventory/tool-instances/:id/complete-calibration",
    async (request: FastifyRequest<{ Params: IdParams; Body: CompleteCalibrationBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const { proximaCalibracion, observaciones } = request.body;
      const result = await completeCalibration(request.params.id, tenantSlug, proximaCalibracion, observaciones);
      return reply.send(result);
    },
  );

  // ── POST /inventory/tool-instances/:id/complete-repair ──
  app.post<{ Params: IdParams }>(
    "/inventory/tool-instances/:id/complete-repair",
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await completeRepair(request.params.id, tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /inventory/tool-instances/:id/decommission — Write-off ──
  app.post<{ Params: IdParams; Body: DecommissionBody }>(
    "/inventory/tool-instances/:id/decommission",
    async (request: FastifyRequest<{ Params: IdParams; Body: DecommissionBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await decommissionTool(request.params.id, request.body, tenantSlug);
      return reply.send(result);
    },
  );
}
