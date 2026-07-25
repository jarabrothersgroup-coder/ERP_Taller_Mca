/**
 * Marketing Sequence Routes — automation endpoints.
 *
 * Endpoints:
 *   POST   /marketing/sequences            — Create sequence with steps
 *   GET    /marketing/sequences            — List sequences
 *   GET    /marketing/sequences/:id        — Get sequence with steps
 *   PATCH  /marketing/sequences/:id        — Update sequence
 *   DELETE /marketing/sequences/:id        — Cancel sequence
 *   POST   /marketing/sequences/:id/enroll — Enroll customer
 *   GET    /marketing/sequences/:id/enrollments — List enrollments
 *   POST   /marketing/sequences/run        — Manual processing trigger
 *
 * @module marketing/routes/sequence.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createSequence,
  listSequences,
  getSequence,
  updateSequence,
  deleteSequence,
  enrollCustomer,
  listEnrollments,
  processSequences,
} from "../services/sequence.service.js";

interface CreateBody {
  nombre: string;
  descripcion?: string;
  triggerEvent?: string;
  steps: Array<{ orden: number; delayDays: number; tipo: string; asunto?: string; mensaje: string }>;
}

interface UpdateBody {
  nombre?: string;
  descripcion?: string;
  triggerEvent?: string;
  estado?: string;
}

interface EnrollBody {
  clienteId?: string;
  clienteNombre: string;
  clientePhone?: string;
  clienteEmail?: string;
}

interface SeqParams {
  id: string;
}

export async function sequenceRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /marketing/sequences — Create ──
  app.post<{ Body: CreateBody }>(
    "/marketing/sequences",
    {
      schema: {
        body: {
          type: "object",
          required: ["nombre", "steps"],
          properties: {
            nombre: { type: "string", maxLength: 100 },
            descripcion: { type: "string" },
            triggerEvent: { type: "string" },
            steps: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["orden", "tipo", "mensaje"],
                properties: {
                  orden: { type: "number" },
                  delayDays: { type: "number" },
                  tipo: { type: "string", enum: ["whatsapp", "email", "sms"] },
                  asunto: { type: "string" },
                  mensaje: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const result = await createSequence(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /marketing/sequences — List ──
  app.get(
    "/marketing/sequences",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await listSequences(request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /marketing/sequences/:id — Get with steps ──
  app.get<{ Params: SeqParams }>(
    "/marketing/sequences/:id",
    {
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (request: FastifyRequest<{ Params: SeqParams }>, reply: FastifyReply) => {
      const result = await getSequence(request.params.id, request.tenantSlug);
      if (!result) return reply.status(404).send({ error: "Secuencia no encontrada" });
      return reply.send(result);
    },
  );

  // ── PATCH /marketing/sequences/:id — Update ──
  app.patch<{ Params: SeqParams; Body: UpdateBody }>(
    "/marketing/sequences/:id",
    {
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (request: FastifyRequest<{ Params: SeqParams; Body: UpdateBody }>, reply: FastifyReply) => {
      const ok = await updateSequence(request.params.id, request.body, request.tenantSlug);
      if (!ok) return reply.status(404).send({ error: "Secuencia no encontrada" });
      return reply.send({ ok: true });
    },
  );

  // ── DELETE /marketing/sequences/:id — Cancel ──
  app.delete<{ Params: SeqParams }>(
    "/marketing/sequences/:id",
    {
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (request: FastifyRequest<{ Params: SeqParams }>, reply: FastifyReply) => {
      const ok = await deleteSequence(request.params.id, request.tenantSlug);
      if (!ok) return reply.status(404).send({ error: "Secuencia no encontrada" });
      return reply.send({ ok: true });
    },
  );

  // ── POST /marketing/sequences/:id/enroll — Enroll ──
  app.post<{ Params: SeqParams; Body: EnrollBody }>(
    "/marketing/sequences/:id/enroll",
    {
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object",
          required: ["clienteNombre"],
          properties: {
            clienteId: { type: "string" },
            clienteNombre: { type: "string" },
            clientePhone: { type: "string" },
            clienteEmail: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: SeqParams; Body: EnrollBody }>, reply: FastifyReply) => {
      const result = await enrollCustomer(request.params.id, request.body, request.tenantSlug);
      if (!result) return reply.status(404).send({ error: "Secuencia no encontrada" });
      return reply.status(201).send(result);
    },
  );

  // ── GET /marketing/sequences/:id/enrollments — List ──
  app.get<{ Params: SeqParams }>(
    "/marketing/sequences/:id/enrollments",
    {
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (request: FastifyRequest<{ Params: SeqParams }>, reply: FastifyReply) => {
      const result = await listEnrollments(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /marketing/sequences/run — Manual trigger ──
  app.post(
    "/marketing/sequences/run",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const count = await processSequences(request.tenantSlug);
      return reply.send({ processed: count });
    },
  );
}
