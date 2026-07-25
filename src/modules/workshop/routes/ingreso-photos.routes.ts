/**
 * Ingreso Photo Routes — Upload/list/delete reception photos.
 *
 * Endpoints:
 *   POST   /workshop/ingresos/:id/fotos        — Upload photo
 *   GET    /workshop/ingresos/:id/fotos        — List photos
 *   DELETE /workshop/ingresos/:id/fotos/:photoId — Delete photo
 *
 * @module workshop/routes/ingreso-photos
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import {
  uploadIngresoPhoto,
  listIngresoPhotos,
  deleteIngresoPhoto,
} from "../services/ingreso-photo.service.js";

export async function ingresoPhotosRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/ingresos/:id/fotos — Upload photo ──
  app.post<{ Params: { id: string } }>(
    "/workshop/ingresos/:id/fotos",
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id: ingresoId } = request.params;
      const tenantSlug = request.tenantSlug;

      const parts = request.parts();
      let fileBuffer: Buffer | null = null;
      let contentType = "image/jpeg";
      let filename = "photo.jpg";

      for await (const part of parts) {
        if (part.type === "file") {
          filename = part.filename || "photo.jpg";
          contentType = part.mimetype || "image/jpeg";
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

      const photoId = crypto.randomUUID();

      const result = await uploadIngresoPhoto({
        tenantSlug,
        ingresoId,
        photoId,
        fileBuffer,
        contentType,
        filename,
      });

      return reply.status(201).send({
        id: photoId,
        ...result,
      });
    },
  );

  // ── GET /workshop/ingresos/:id/fotos — List photos ──
  app.get<{ Params: { id: string } }>(
    "/workshop/ingresos/:id/fotos",
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id: ingresoId } = request.params;
      const tenantSlug = request.tenantSlug;

      const photos = await listIngresoPhotos(tenantSlug, ingresoId);
      return reply.send(photos);
    },
  );

  // ── DELETE /workshop/ingresos/:id/fotos/:photoId — Delete photo ──
  app.delete<{ Params: { id: string; photoId: string } }>(
    "/workshop/ingresos/:id/fotos/:photoId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "photoId"],
          properties: {
            id: { type: "string", format: "uuid" },
            photoId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string; photoId: string } }>,
      reply: FastifyReply,
    ) => {
      const { id: ingresoId, photoId } = request.params;
      const tenantSlug = request.tenantSlug;

      // Find the photo path from list
      const photos = await listIngresoPhotos(tenantSlug, ingresoId);
      const photo = photos.find((p) => p.name.includes(photoId));
      if (!photo) {
        return reply.status(404).send({ error: "Foto no encontrada" });
      }

      const result = await deleteIngresoPhoto(photo.path);
      return reply.send(result);
    },
  );
}
