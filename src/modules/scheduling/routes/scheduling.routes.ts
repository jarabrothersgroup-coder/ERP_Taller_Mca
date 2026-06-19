/**
 * Scheduling Routes — Appointment management endpoints.
 *
 * Endpoints:
 *   POST   /scheduling/appointments          — Create appointment
 *   GET    /scheduling/appointments          — List appointments
 *   GET    /scheduling/appointments/:id      — Get appointment detail
 *   PATCH  /scheduling/appointments/:id      — Update appointment state
 *   POST   /scheduling/check-in              — Check-in (appointment → OT)
 *   POST   /scheduling/check-availability    — Check slot availability
 *   POST   /scheduling/cron/reminders        — Execute reminder cron job
 *   POST   /scheduling/webhook/whatsapp      — WhatsApp inbound webhook
 *   GET    /scheduling/stats                 — Dashboard statistics
 *
 * All routes require `X-Tenant-Slug` header.
 *
 * @module scheduling/routes/scheduling.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createAgendamiento,
  listAgendamientos,
  getAgendamiento,
  transitionState,
  checkIn,
  handleWhatsAppResponse,
  getSchedulingStats,
} from "../services/agendamiento.service.js";
import { checkAvailability } from "../services/capacity.service.js";
import { executeReminderCron, sendConfirmationMessage } from "../jobs/reminder.cron.js";
import type {
  CreateAgendamientoRequest,
  CheckInRequest,
  CheckAvailabilityRequest,
  TipoServicio,
  AgendamientoEstado,
} from "../types.js";

// ─── Route registration ────────────────────────────────

export async function schedulingRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /scheduling/appointments — Create appointment ──
  app.post<{ Body: CreateAgendamientoRequest }>(
    "/scheduling/appointments",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "clienteNombre",
            "clientePhone",
            "vehiculoChapa",
            "vehiculoMarca",
            "vehiculoModelo",
            "fechaTurno",
            "horaTurno",
            "tipoServicio",
          ],
          properties: {
            clienteNombre: { type: "string", minLength: 2 },
            clientePhone: { type: "string", minLength: 8 },
            clienteEmail: { type: "string" },
            clienteDocumento: { type: "string" },
            vehiculoChapa: { type: "string", minLength: 3 },
            vehiculoMarca: { type: "string" },
            vehiculoModelo: { type: "string" },
            vehiculoVin: { type: "string" },
            fechaTurno: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            horaTurno: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
            tipoServicio: { type: "string", enum: ["RAPIDO", "PESADO"] },
            diagnosticoPre: { type: "string" },
            twentyContactId: { type: "string" },
            notas: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateAgendamientoRequest }>,
      reply: FastifyReply,
    ) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const userEmail = (request as any).userEmail as string || "system";

      try {
        const result = await createAgendamiento(
          request.body,
          tenantSlug,
          userEmail,
        );

        // Send confirmation message asynchronously (fire-and-forget)
        sendConfirmationMessage(result.id, tenantSlug).catch(() => {});

        return reply.status(201).send({
          success: true,
          id: result.id,
          estado: result.estado,
          message: "Turno agendado exitosamente",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error creando turno";
        return reply.status(400).send({
          error: "AgendamientoError",
          message: msg,
        });
      }
    },
  );

  // ── GET /scheduling/appointments — List appointments ──
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      fecha?: string;
      estado?: string;
      search?: string;
    };
  }>(
    "/scheduling/appointments",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { page, limit, fecha, estado, search } = request.query;

      try {
        const result = await listAgendamientos(tenantSlug, {
          page: page ? parseInt(page, 10) : 1,
          limit: limit ? parseInt(limit, 10) : 20,
          fecha,
          estado: estado as AgendamientoEstado | undefined,
          search,
        });

        return reply.send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error listando turnos";
        return reply.status(500).send({ error: "ListError", message: msg });
      }
    },
  );

  // ── GET /scheduling/appointments/:id — Get appointment ──
  app.get<{ Params: { id: string } }>(
    "/scheduling/appointments/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { id } = request.params;

      try {
        const appt = await getAgendamiento(id, tenantSlug);
        if (!appt) {
          return reply.status(404).send({
            error: "NotFoundError",
            message: "Agendamiento no encontrado",
          });
        }
        return reply.send(appt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error obteniendo turno";
        return reply.status(500).send({ error: "GetError", message: msg });
      }
    },
  );

  // ── PATCH /scheduling/appointments/:id — Update state ──
  app.patch<{
    Params: { id: string };
    Body: { estado: AgendamientoEstado };
  }>(
    "/scheduling/appointments/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["estado"],
          properties: {
            estado: {
              type: "string",
              enum: ["RESERVADO", "CONFIRMADO", "PROCESADO_EN_ERP", "AUSENTE", "CANCELADO"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { id } = request.params;
      const { estado } = request.body;

      try {
        const result = await transitionState(id, estado, tenantSlug);
        if (!result) {
          return reply.status(404).send({
            error: "NotFoundError",
            message: "Agendamiento no encontrado",
          });
        }
        return reply.send({
          success: true,
          id: result.id,
          estado: result.estado,
          message: `Estado cambiado a ${estado}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error cambiando estado";
        return reply.status(400).send({ error: "StateError", message: msg });
      }
    },
  );

  // ── POST /scheduling/check-in — Check-in (appointment → OT) ──
  app.post<{ Body: CheckInRequest }>(
    "/scheduling/check-in",
    {
      schema: {
        body: {
          type: "object",
          required: ["agendamientoId"],
          properties: {
            agendamientoId: { type: "string", format: "uuid" },
            kilometraje: { type: "number" },
            observaciones: { type: "string" },
            forceCreateClient: { type: "boolean" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CheckInRequest }>,
      reply: FastifyReply,
    ) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const userEmail = (request as any).userEmail as string || "system";

      try {
        const result = await checkIn(request.body, tenantSlug, userEmail);
        return reply.status(201).send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error en check-in";
        return reply.status(400).send({
          error: "CheckInError",
          message: msg,
        });
      }
    },
  );

  // ── POST /scheduling/check-availability — Check slot ──
  app.post<{ Body: CheckAvailabilityRequest }>(
    "/scheduling/check-availability",
    {
      schema: {
        body: {
          type: "object",
          required: ["fecha", "hora", "tipoServicio"],
          properties: {
            fecha: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            hora: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
            tipoServicio: { type: "string", enum: ["RAPIDO", "PESADO"] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CheckAvailabilityRequest }>,
      reply: FastifyReply,
    ) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { fecha, hora, tipoServicio } = request.body;

      try {
        const result = await checkAvailability(
          fecha,
          hora,
          tipoServicio as TipoServicio,
          tenantSlug,
        );
        return reply.send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error verificando disponibilidad";
        return reply.status(500).send({ error: "AvailabilityError", message: msg });
      }
    },
  );

  // ── POST /scheduling/cron/reminders — Execute cron job ──
  app.post(
    "/scheduling/cron/reminders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const result = await executeReminderCron(tenantSlug);
        return reply.send({
          success: true,
          ...result,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error ejecutando cron";
        return reply.status(500).send({ error: "CronError", message: msg });
      }
    },
  );

  // ── POST /scheduling/webhook/whatsapp — WhatsApp inbound ──
  app.post<{
    Body: {
      phone: string;
      message: string;
      instanceName?: string;
    };
  }>(
    "/scheduling/webhook/whatsapp",
    {
      schema: {
        body: {
          type: "object",
          required: ["phone", "message"],
          properties: {
            phone: { type: "string" },
            message: { type: "string" },
            instanceName: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: { phone: string; message: string; instanceName?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { phone, message } = request.body;

      try {
        const result = await handleWhatsAppResponse(phone, message, tenantSlug);
        return reply.send({
          success: true,
          ...result,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error procesando webhook";
        return reply.status(500).send({ error: "WebhookError", message: msg });
      }
    },
  );

  // ── GET /scheduling/stats — Dashboard statistics ──
  app.get(
    "/scheduling/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const stats = await getSchedulingStats(tenantSlug);
        return reply.send(stats);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error obteniendo estadísticas";
        return reply.status(500).send({ error: "StatsError", message: msg });
      }
    },
  );
}
