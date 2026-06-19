/**
 * DVI Photo Routes — Upload/download/list/delete DVI inspection photos.
 *
 * Endpoints:
 *   POST   /dvi/:inspectionId/photos        — Upload photo
 *   GET    /dvi/:inspectionId/photos        — List photos
 *   GET    /dvi/:inspectionId/photos/:photoId — Get signed URL
 *   DELETE /dvi/:inspectionId/photos/:photoId — Delete photo
 *
 * @module dvi/routes/photo.routes.ts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  uploadPhoto,
  downloadPhoto,
  deletePhoto,
  listPhotos,
  getSignedUrl,
} from "../services/photo-storage.service.js";

export async function photoRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /dvi/:inspectionId/photos — Upload photo ──
  app.post<{ Params: { inspectionId: string } }>(
    "/dvi/:inspectionId/photos",
    {
      schema: {
        params: {
          type: "object",
          required: ["inspectionId"],
          properties: {
            inspectionId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { inspectionId: string } }>, reply: FastifyReply) => {
      const { inspectionId } = request.params;
      const tenantSlug = request.tenantSlug;

      // Get file from multipart upload
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

      const result = await uploadPhoto({
        tenantSlug,
        inspectionId,
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

  // ── GET /dvi/:inspectionId/photos — List photos ──
  app.get<{ Params: { inspectionId: string } }>(
    "/dvi/:inspectionId/photos",
    {
      schema: {
        params: {
          type: "object",
          required: ["inspectionId"],
          properties: {
            inspectionId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { inspectionId: string } }>, reply: FastifyReply) => {
      const { inspectionId } = request.params;
      const tenantSlug = request.tenantSlug;

      const photos = await listPhotos(tenantSlug, inspectionId);
      return reply.send(photos);
    },
  );

  // ── GET /dvi/:inspectionId/photos/:photoId — Get signed URL ──
  app.get<{ Params: { inspectionId: string; photoId: string } }>(
    "/dvi/:inspectionId/photos/:photoId",
    {
      schema: {
        params: {
          type: "object",
          required: ["inspectionId", "photoId"],
          properties: {
            inspectionId: { type: "string", format: "uuid" },
            photoId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { inspectionId: string; photoId: string } }>, reply: FastifyReply) => {
      const { inspectionId, photoId } = request.params;
      const tenantSlug = request.tenantSlug;

      // Build path from tenant/inspection/photo
      const path = `${tenantSlug}/${inspectionId}/${photoId}`;
      const url = await getSignedUrl(path);

      return reply.send({ url, expiresIn: 3600 });
    },
  );

  // ── DELETE /dvi/:inspectionId/photos/:photoId — Delete photo ──
  app.delete<{ Params: { inspectionId: string; photoId: string } }>(
    "/dvi/:inspectionId/photos/:photoId",
    {
      schema: {
        params: {
          type: "object",
          required: ["inspectionId", "photoId"],
          properties: {
            inspectionId: { type: "string", format: "uuid" },
            photoId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { inspectionId: string; photoId: string } }>, reply: FastifyReply) => {
      const { inspectionId, photoId } = request.params;
      const tenantSlug = request.tenantSlug;

      const path = `${tenantSlug}/${inspectionId}/${photoId}`;
      const result = await deletePhoto(path);

      return reply.send(result);
    },
  );
}
