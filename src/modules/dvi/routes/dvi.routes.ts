/**
 * DVI Routes — Digital Vehicle Inspection endpoints.
 *
 * Endpoints:
 *   POST   /dvi                        — Create DVI inspection
 *   GET    /dvi/:id                    — Get DVI with details
 *   GET    /dvi/orden/:ordenId         — List DVI by work order
 *   POST   /dvi/:id/photos             — Add photo
 *   PATCH  /dvi/photos/:photoId/markup — Update photo markup
 *   POST   /dvi/:id/items             — Add inspection item
 *   PATCH  /dvi/items/:itemId/status  — Update item status
 *   POST   /dvi/:id/calculate-score   — Recalculate health score
 *   POST   /dvi/:id/share             — Share via WhatsApp
 *
 * @module dvi/routes/dvi.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createDvi,
  getDviById,
  listDviByOrden,
  addPhoto,
  updatePhotoMarkup,
  addItem,
  updateItemStatus,
  calculateHealthScore,
  shareViaWhatsApp,
} from "../services/dvi.service.js";

interface DviParams {
  id: string;
}

interface OrdenParams {
  ordenId: string;
}

interface CreateBody {
  ordenTrabajoId: string;
  observaciones?: string;
  inspector?: string;
}

interface AddPhotoBody {
  categoria: string;
  url: string;
  nombreArchivo?: string;
  markup?: unknown;
  caption?: string;
  orden?: number;
}

interface UpdateMarkupBody {
  markup: unknown;
}

interface AddItemBody {
  categoria: string;
  descripcion: string;
  estado?: string;
  peso?: number;
  notas?: string;
}

interface UpdateStatusBody {
  estado: string;
}

interface PhotoParams {
  photoId: string;
}

interface ItemParams {
  itemId: string;
}

export async function dviRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /dvi — Create DVI inspection ──
  app.post<{ Body: CreateBody }>(
    "/dvi",
    {
      schema: {
        body: {
          type: "object",
          required: ["ordenTrabajoId"],
          properties: {
            ordenTrabajoId: { type: "string", format: "uuid" },
            observaciones: { type: "string" },
            inspector: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) => {
      const result = await createDvi(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /dvi/:id — Get DVI with details ──
  app.get<{ Params: DviParams }>(
    "/dvi/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: DviParams }>, reply: FastifyReply) => {
      const result = await getDviById(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── GET /dvi/orden/:ordenId — List DVI by work order ──
  app.get<{ Params: OrdenParams }>(
    "/dvi/orden/:ordenId",
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
      const result = await listDviByOrden(request.params.ordenId, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /dvi/:id/photos — Add photo ──
  app.post<{ Params: DviParams; Body: AddPhotoBody }>(
    "/dvi/:id/photos",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["categoria", "url"],
          properties: {
            categoria: { type: "string", enum: ["EXTERIOR", "INTERIOR", "MOTOR", "CHASIS", "DOCUMENTACION", "OTRO"] },
            url: { type: "string" },
            nombreArchivo: { type: "string" },
            markup: { type: "object" },
            caption: { type: "string" },
            orden: { type: "integer" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: DviParams; Body: AddPhotoBody }>,
      reply: FastifyReply,
    ) => {
      const result = await addPhoto(request.params.id, request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── PATCH /dvi/photos/:photoId/markup — Update markup ──
  app.patch<{ Params: PhotoParams; Body: UpdateMarkupBody }>(
    "/dvi/photos/:photoId/markup",
    {
      schema: {
        params: {
          type: "object",
          required: ["photoId"],
          properties: { photoId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["markup"],
          properties: {
            markup: { type: "object" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: PhotoParams; Body: UpdateMarkupBody }>,
      reply: FastifyReply,
    ) => {
      const result = await updatePhotoMarkup(
        request.params.photoId,
        request.body.markup,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── POST /dvi/:id/items — Add inspection item ──
  app.post<{ Params: DviParams; Body: AddItemBody }>(
    "/dvi/:id/items",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["categoria", "descripcion"],
          properties: {
            categoria: { type: "string" },
            descripcion: { type: "string" },
            estado: { type: "string", enum: ["OK", "REQUIERE_ATENCION", "CRITICO"] },
            peso: { type: "integer", minimum: 1, maximum: 10 },
            notas: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: DviParams; Body: AddItemBody }>,
      reply: FastifyReply,
    ) => {
      const result = await addItem(request.params.id, request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── PATCH /dvi/items/:itemId/status — Update item status ──
  app.patch<{ Params: ItemParams; Body: UpdateStatusBody }>(
    "/dvi/items/:itemId/status",
    {
      schema: {
        params: {
          type: "object",
          required: ["itemId"],
          properties: { itemId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["estado"],
          properties: {
            estado: { type: "string", enum: ["OK", "REQUIERE_ATENCION", "CRITICO"] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ItemParams; Body: UpdateStatusBody }>,
      reply: FastifyReply,
    ) => {
      const result = await updateItemStatus(
        request.params.itemId,
        request.body.estado,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── POST /dvi/:id/calculate-score — Recalculate health score ──
  app.post<{ Params: DviParams }>(
    "/dvi/:id/calculate-score",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: DviParams }>, reply: FastifyReply) => {
      const score = await calculateHealthScore(request.params.id, request.tenantSlug);
      return reply.send({ healthScore: score });
    },
  );

  // ── POST /dvi/:id/share — Share via WhatsApp ──
  app.post<{ Params: DviParams }>(
    "/dvi/:id/share",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: DviParams }>, reply: FastifyReply) => {
      const healthScoreUrl = await shareViaWhatsApp(
        request.params.id,
        request.tenantSlug,
      );
      return reply.send({ healthScoreUrl });
    },
  );
}
