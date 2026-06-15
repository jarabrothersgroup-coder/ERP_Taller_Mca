/**
 * Ingresos routes — vehicle check-in endpoints.
 *
 * POST /workshop/ingresos — Register a vehicle check-in
 *   Optionally creates a work order in "Presupuestado" status.
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * N+1 audit: service layer uses single JOIN queries, no lazy relation walking.
 * RAM: DTOs are returned immediately without keeping full entity trees.
 *
 * @module workshop/routes/ingresos
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createIngreso, listIngresosByVehicle } from "../services/ingreso.service.js";

/**
 * Request body schema for POST /workshop/ingresos
 */
interface IngresoBody {
  vehicleId: string;
  kilometraje?: number;
  nivelCombustible?: string;
  estadoExterior?: string;
  observaciones?: string;
  crearOrden?: boolean;
  descripcionTrabajo?: string;
}

/**
 * Query params for GET /workshop/ingresos
 */
interface IngresoQuery {
  vehicleId?: string;
}

/**
 * Registers the ingreso routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function ingresosRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/ingresos — Register vehicle check-in ──
  app.post<{ Body: IngresoBody }>(
    "/workshop/ingresos",
    {
      schema: {
        body: {
          type: "object",
          required: ["vehicleId"],
          properties: {
            vehicleId: { type: "string", format: "uuid" },
            kilometraje: { type: "integer", minimum: 0 },
            nivelCombustible: { type: "string", maxLength: 50 },
            estadoExterior: { type: "string", maxLength: 500 },
            observaciones: { type: "string", maxLength: 1000 },
            crearOrden: { type: "boolean" },
            descripcionTrabajo: { type: "string", maxLength: 2000 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              ingreso: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  vehicleId: { type: "string" },
                  ordenTrabajoId: { type: "string", nullable: true },
                  fechaIngreso: { type: "string" },
                  kilometraje: { type: "integer", nullable: true },
                  nivelCombustible: { type: "string", nullable: true },
                  estadoExterior: { type: "string", nullable: true },
                  observaciones: { type: "string", nullable: true },
                },
              },
              ordenTrabajo: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  status: { type: "string" },
                },
                nullable: true,
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: IngresoBody }>, reply: FastifyReply) => {
      const result = await createIngreso(request.body, request.tenantSlug);
      return reply.status(201).send(result);
    },
  );

  // ── GET /workshop/ingresos — List ingresos for a vehicle ──
  app.get<{ Querystring: IngresoQuery }>(
    "/workshop/ingresos",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["vehicleId"],
          properties: {
            vehicleId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                fechaIngreso: { type: "string" },
                kilometraje: { type: "integer", nullable: true },
                nivelCombustible: { type: "string", nullable: true },
                estadoExterior: { type: "string", nullable: true },
                observaciones: { type: "string", nullable: true },
                ordenTrabajo: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    status: { type: "string" },
                  },
                  nullable: true,
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: IngresoQuery }>, reply: FastifyReply) => {
      const { vehicleId } = request.query;
      if (!vehicleId) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "vehicleId query parameter is required",
        });
      }
      const result = await listIngresosByVehicle(vehicleId);
      return reply.send(result);
    },
  );
}
