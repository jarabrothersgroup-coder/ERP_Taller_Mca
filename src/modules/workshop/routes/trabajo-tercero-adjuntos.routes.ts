/**
 * Trabajo Tercero Adjuntos Routes — upload/list/delete invoice files.
 *
 * Endpoints:
 *   POST   /workshop/ordenes/:ordenId/trabajos-terceros/:trabajoId/adjuntos — Upload
 *   GET    /workshop/ordenes/:ordenId/trabajos-terceros/:trabajoId/adjuntos — List
 *   DELETE /workshop/ordenes/:ordenId/trabajos-terceros/:trabajoId/adjuntos — Delete
 *
 * @module workshop/routes/trabajo-tercero-adjuntos
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  uploadAdjunto,
  listAdjuntos,
  deleteAdjunto,
} from "../services/trabajo-tercero-adjunto.service.js";

export async function trabajoTerceroAdjuntosRoutes(app: FastifyInstance): Promise<void> {
  // ── POST — Upload ──
  app.post<{ Params: { ordenId: string; trabajoId: string } }>(
    "/workshop/ordenes/:ordenId/trabajos-terceros/:trabajoId/adjuntos",
    {
      schema: {
        params: {
          type: "object",
          required: ["ordenId", "trabajoId"],
          properties: {
            ordenId: { type: "string", format: "uuid" },
            trabajoId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { ordenId: string; trabajoId: string } }>, reply: FastifyReply) => {
      const { trabajoId } = request.params;
      const tenantSlug = request.tenantSlug;

      const parts = request.parts();
      let fileBuffer: Buffer | null = null;
      let contentType = "application/pdf";
      let filename = "adjunto.pdf";

      for await (const part of parts) {
        if (part.type === "file") {
          filename = part.filename || "adjunto.pdf";
          contentType = part.mimetype || "application/pdf";
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          fileBuffer = Buffer.concat(chunks);
        }
      }

      if (!fileBuffer) {
        return reply.status(400).send({ error: "No se proporcionó archivo" });
      }

      const result = await uploadAdjunto(trabajoId, tenantSlug, fileBuffer, filename, contentType);
      return reply.status(201).send(result);
    },
  );

  // ── GET — List ──
  app.get<{ Params: { ordenId: string; trabajoId: string } }>(
    "/workshop/ordenes/:ordenId/trabajos-terceros/:trabajoId/adjuntos",
    {
      schema: {
        params: {
          type: "object",
          required: ["ordenId", "trabajoId"],
          properties: {
            ordenId: { type: "string", format: "uuid" },
            trabajoId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { ordenId: string; trabajoId: string } }>, reply: FastifyReply) => {
      const result = await listAdjuntos(request.params.trabajoId, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── DELETE — Delete ──
  app.delete<{ Params: { ordenId: string; trabajoId: string }; Querystring: { path: string } }>(
    "/workshop/ordenes/:ordenId/trabajos-terceros/:trabajoId/adjuntos",
    {
      schema: {
        params: {
          type: "object",
          required: ["ordenId", "trabajoId"],
          properties: {
            ordenId: { type: "string", format: "uuid" },
            trabajoId: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          required: ["path"],
          properties: { path: { type: "string" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { ordenId: string; trabajoId: string }; Querystring: { path: string } }>, reply: FastifyReply) => {
      const result = await deleteAdjunto(request.params.trabajoId, request.query.path, request.tenantSlug);
      return reply.send(result);
    },
  );
}
