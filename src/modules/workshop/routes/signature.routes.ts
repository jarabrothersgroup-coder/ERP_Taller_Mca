/**
 * Signature Routes — Digital signature capture endpoints.
 *
 * Endpoints:
 *   POST /workshop/signatures         — Save signature
 *   GET  /workshop/signatures/:ordenId — Get signatures for OT
 *
 * @module workshop/routes/signature.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { saveSignature, getSignaturesByOrden } from "../services/signature.service.js";

interface SaveBody {
  ordenTrabajoId: string;
  tipo: string;
  firmaBase64: string;
  clienteNombre?: string;
  clienteDocumento?: string;
  observaciones?: string;
}

interface OrdenParams {
  ordenId: string;
}

export async function signatureRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/signatures — Save signature ──
  app.post<{ Body: SaveBody }>(
    "/workshop/signatures",
    {
      schema: {
        body: {
          type: "object",
          required: ["ordenTrabajoId", "tipo", "firmaBase64"],
          properties: {
            ordenTrabajoId: { type: "string", format: "uuid" },
            tipo: { type: "string", enum: ["AUTORIZACION", "CHECK_IN", "ENTREGA", "RECHAZO"] },
            firmaBase64: { type: "string" },
            clienteNombre: { type: "string" },
            clienteDocumento: { type: "string" },
            observaciones: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SaveBody }>, reply: FastifyReply) => {
      const result = await saveSignature(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /workshop/signatures/:ordenId — Get signatures ──
  app.get<{ Params: OrdenParams }>(
    "/workshop/signatures/:ordenId",
    {
      schema: {
        params: {
          type: "object",
          required: ["ordenId"],
          properties: { ordenId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: OrdenParams }>, reply: FastifyReply) => {
      const result = await getSignaturesByOrden(request.params.ordenId, request.tenantSlug);
      return reply.send(result);
    },
  );
}
