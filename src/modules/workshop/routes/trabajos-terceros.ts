/**
 * Trabajos de Terceros routes — third-party work endpoints.
 *
 * POST /workshop/ordenes/:id/trabajos-terceros — Asociar trabajo de tercero
 * GET  /workshop/ordenes/:id/trabajos-terceros — Listar trabajos de terceros
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * N+1 audit: service uses PK-index lookup + single RETURNING insert.
 * RAM: minimal DTO allocation, no cached entity trees.
 *
 * @module workshop/routes/trabajos-terceros
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createTrabajoTercero,
  listTrabajosTercerosByOrden,
} from "../services/trabajo-tercero.service.js";

/**
 * Request body for POST /workshop/ordenes/:id/trabajos-terceros
 */
interface TrabajoTerceroBody {
  proveedor: string;
  descripcion: string;
  costo: number | string;
  fechaInicio?: string;
  fechaFin?: string;
}

/**
 * Route params
 */
interface OrdenParams {
  id: string;
}

/**
 * Registers the trabajo-tercero routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function trabajosTercerosRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/ordenes/:id/trabajos-terceros ──
  app.post<{ Params: OrdenParams; Body: TrabajoTerceroBody }>(
    "/workshop/ordenes/:id/trabajos-terceros",
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
          required: ["proveedor", "descripcion", "costo"],
          properties: {
            proveedor: { type: "string", minLength: 1, maxLength: 200 },
            descripcion: { type: "string", minLength: 1, maxLength: 2000 },
            costo: { type: "number", minimum: 0 },
            fechaInicio: { type: "string", format: "date-time" },
            fechaFin: { type: "string", format: "date-time" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              trabajoTercero: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  ordenTrabajoId: { type: "string" },
                  proveedor: { type: "string" },
                  descripcion: { type: "string" },
                  costo: { type: "string" },
                  estado: { type: "string" },
                  fechaInicio: { type: "string", nullable: true },
                  fechaFin: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: OrdenParams; Body: TrabajoTerceroBody }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const result = await createTrabajoTercero(id, request.body);
      return reply.status(201).send(result);
    },
  );

  // ── GET /workshop/ordenes/:id/trabajos-terceros ──
  app.get<{ Params: OrdenParams }>(
    "/workshop/ordenes/:id/trabajos-terceros",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                proveedor: { type: "string" },
                descripcion: { type: "string" },
                costo: { type: "string" },
                estado: { type: "string" },
                fechaInicio: { type: "string", nullable: true },
                fechaFin: { type: "string", nullable: true },
                createdAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: OrdenParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const result = await listTrabajosTercerosByOrden(id);
      return reply.send(result);
    },
  );
}
