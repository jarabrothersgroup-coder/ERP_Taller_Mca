/**
 * Tool Maintenance routes — calibration, repair, PM endpoints.
 *
 * Endpoints:
 *   POST   /inventory/tool-service-events                    — Create service event
 *   GET    /inventory/tool-service-events                    — List events (filtered)
 *   PATCH  /inventory/tool-service-events/:id                — Update event (completion)
 *   GET    /inventory/tool-service-events/calibration/:toolInstanceId — Calibration history
 *
 * @module inventory/routes/tool-maintenance
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createServiceEvent,
  updateServiceEvent,
  listServiceEvents,
  getCalibrationHistory,
} from "../services/tool-maintenance.service.js";

interface IdParams { id: string; }
interface ToolInstanceParams { toolInstanceId: string; }

interface CreateBody {
  toolInstanceId: string;
  tipo: 'CALIBRACION_PROGRAMADA' | 'CALIBRACION_EXTRAORDINARIA' | 'REPARACION' | 'MANTENIMIENTO_PREVENTIVO' | 'INSPECCION';
  fechaInicio?: string;
  proveedor?: string | null;
  numeroOrdenExterna?: string | null;
  costo?: number | string | null;
  observaciones?: string | null;
}

interface UpdateBody {
  estado?: 'PROGRAMADO' | 'EN_PROCESO' | 'COMPLETADO' | 'CANCELADO';
  fechaFin?: string | null;
  costo?: number | string | null;
  resultado?: string | null;
  certificadoUrl?: string | null;
  proveedor?: string | null;
  observaciones?: string | null;
}

interface EventQuery {
  toolInstanceId?: string;
  tipo?: string;
  estado?: string;
  page?: string;
  limit?: string;
}

export async function toolMaintenanceRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/tool-service-events — Create event ──
  app.post<{ Body: CreateBody }>(
    "/inventory/tool-service-events",
    {
      schema: {
        body: {
          type: "object",
          required: ["toolInstanceId", "tipo"],
          properties: {
            toolInstanceId: { type: "string", format: "uuid" },
            tipo: {
              type: "string",
              enum: ["CALIBRACION_PROGRAMADA", "CALIBRACION_EXTRAORDINARIA", "REPARACION", "MANTENIMIENTO_PREVENTIVO", "INSPECCION"],
            },
            fechaInicio: { type: "string", format: "date-time" },
            proveedor: { type: "string", maxLength: 200 },
            numeroOrdenExterna: { type: "string", maxLength: 100 },
            costo: { type: "number", minimum: 0 },
            observaciones: { type: "string", maxLength: 1000 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const usuarioId = request.headers["x-user-id"] as string || "system";
      const result = await createServiceEvent(request.body, usuarioId, tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /inventory/tool-service-events — List events ──
  app.get<{ Querystring: EventQuery }>(
    "/inventory/tool-service-events",
    async (request: FastifyRequest<{ Querystring: EventQuery }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const { toolInstanceId, tipo, estado, page, limit } = request.query;
      const result = await listServiceEvents({
        toolInstanceId,
        tipo,
        estado,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        tenantSlug,
      });
      return reply.send(result);
    },
  );

  // ── PATCH /inventory/tool-service-events/:id — Update event ──
  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    "/inventory/tool-service-events/:id",
    async (request: FastifyRequest<{ Params: IdParams; Body: UpdateBody }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await updateServiceEvent(request.params.id, request.body, tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /inventory/tool-service-events/calibration/:toolInstanceId — Calibration history ──
  app.get<{ Params: ToolInstanceParams }>(
    "/inventory/tool-service-events/calibration/:toolInstanceId",
    async (request: FastifyRequest<{ Params: ToolInstanceParams }>, reply: FastifyReply) => {
      const tenantSlug = request.headers["x-tenant-slug"] as string;
      const result = await getCalibrationHistory(request.params.toolInstanceId, tenantSlug);
      return reply.send(result);
    },
  );
}
