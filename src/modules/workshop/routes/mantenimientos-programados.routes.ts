/**
 * Mantenimientos Programados Routes — "ficha de próximos mantenimientos".
 *
 * Endpoints:
 *   GET    /workshop/mantenimientos                      — Listar (filtros vehiculoId/estado)
 *   POST   /workshop/mantenimientos                      — Crear manual
 *   GET    /workshop/mantenimientos/vehiculo/:vehiculoId — Ficha por vehículo
 *   GET    /workshop/mantenimientos/:id                  — Obtener
 *   PATCH  /workshop/mantenimientos/:id                  — Actualizar / marcar REALIZADO|CANCELADO
 *   DELETE /workshop/mantenimientos/:id                  — Eliminar (manager+)
 *   POST   /workshop/cron/mantenimientos-recordatorios   — Recordatorio WhatsApp (idempotente)
 *
 * Todos los accesos son tenant-scoped (request.tenantSlug).
 *
 * @module workshop/routes/mantenimientos-programados
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireManager } from "../../../shared/middleware/rbac.js";
import {
  listMantenimientos,
  listMantenimientosDeVehiculo,
  getMantenimiento,
  createMantenimiento,
  updateMantenimiento,
  deleteMantenimiento,
  recordatorioMantenimientos,
} from "../services/mantenimiento-programado.service.js";

interface ParamsWithId {
  id: string;
}

interface VehiculoParams {
  vehiculoId: string;
}

interface ListQuery {
  vehiculoId?: string;
  estado?: string;
}

const MANT_RESPONSE_PROPS = {
  id: { type: "string" },
  vehiculoId: { type: "string" },
  ordenTrabajoId: { type: "string", nullable: true },
  servicio: { type: "string" },
  kmObjetivo: { type: "integer", nullable: true },
  fechaObjetivo: { type: "string", nullable: true },
  estado: { type: "string" },
  origen: { type: "string" },
  recordatorioEnviado: { type: "boolean" },
  tenantSlug: { type: "string" },
  createdAt: { type: "string" },
  updatedAt: { type: "string" },
};

export async function mantenimientosProgramadosRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── GET /workshop/mantenimientos — List ──
  app.get<{ Querystring: ListQuery }>(
    "/workshop/mantenimientos",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            vehiculoId: { type: "string", format: "uuid" },
            estado: { type: "string", enum: ["PENDIENTE", "REALIZADO", "CANCELADO"] },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
      const items = await listMantenimientos(request.tenantSlug, {
        vehiculoId: request.query.vehiculoId,
        estado: request.query.estado,
      });
      return reply.send({ total: items.length, items });
    },
  );

  // ── GET /workshop/mantenimientos/vehiculo/:vehiculoId — Ficha ──
  app.get<{ Params: VehiculoParams }>(
    "/workshop/mantenimientos/vehiculo/:vehiculoId",
    {
      schema: {
        params: {
          type: "object",
          required: ["vehiculoId"],
          properties: { vehiculoId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: VehiculoParams }>, reply: FastifyReply) => {
      const ficha = await listMantenimientosDeVehiculo(
        request.params.vehiculoId,
        request.tenantSlug,
      );
      return reply.send(ficha);
    },
  );

  // ── POST /workshop/mantenimientos — Create manual ──
  app.post(
    "/workshop/mantenimientos",
    {
      schema: {
        body: {
          type: "object",
          required: ["vehiculoId", "servicio"],
          properties: {
            vehiculoId: { type: "string", format: "uuid" },
            servicio: { type: "string", minLength: 1, maxLength: 255 },
            kmObjetivo: { type: "integer", minimum: 0 },
            fechaObjetivo: { type: "string", format: "date" },
            origen: { type: "string", enum: ["MANUAL", "PREDICCION"] },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await createMantenimiento(
        request.body as Parameters<typeof createMantenimiento>[0],
        request.tenantSlug,
      );
      return reply.status(201).send(result);
    },
  );

  // ── GET /workshop/mantenimientos/:id — Get ──
  app.get<{ Params: ParamsWithId }>(
    "/workshop/mantenimientos/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: { 200: { type: "object", properties: MANT_RESPONSE_PROPS } },
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId }>, reply: FastifyReply) => {
      const result = await getMantenimiento(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── PATCH /workshop/mantenimientos/:id — Update ──
  app.patch<{ Params: ParamsWithId; Body: Record<string, unknown> }>(
    "/workshop/mantenimientos/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            servicio: { type: "string", minLength: 1, maxLength: 255 },
            kmObjetivo: { type: ["integer", "null"], minimum: 0 },
            fechaObjetivo: { type: ["string", "null"], format: "date" },
            estado: { type: "string", enum: ["PENDIENTE", "REALIZADO", "CANCELADO"] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ParamsWithId; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const result = await updateMantenimiento(
        request.params.id,
        request.body,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── DELETE /workshop/mantenimientos/:id — Delete (destructivo → manager+) ──
  app.delete<{ Params: ParamsWithId }>(
    "/workshop/mantenimientos/:id",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId }>, reply: FastifyReply) => {
      await deleteMantenimiento(request.params.id, request.tenantSlug);
      return reply.status(204).send();
    },
  );

  // ── POST /workshop/cron/mantenimientos-recordatorios — WhatsApp reminder ──
  // Patrón idéntico a POST /scheduling/cron/reminders: invocable por
  // crontab/systemd timer o manualmente; idempotente (flag recordatorio_enviado).
  app.post(
    "/workshop/cron/mantenimientos-recordatorios",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await recordatorioMantenimientos(request.tenantSlug);
        return reply.send({ success: true, ...result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error ejecutando cron";
        return reply.status(500).send({ error: "CronError", message: msg });
      }
    },
  );
}
