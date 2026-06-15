/**
 * Vehículos routes — CRUD endpoints for workshop vehicles.
 *
 * POST   /workshop/vehiculos        — Create a new vehicle
 * GET    /workshop/vehiculos        — List vehicles (with optional filters)
 * GET    /workshop/vehiculos/:id    — Get a single vehicle by ID
 * PATCH  /workshop/vehiculos/:id    — Update a vehicle
 * DELETE /workshop/vehiculos/:id    — Delete a vehicle
 *
 * Supports HEV/BEV high-voltage safety fields.
 * All routes require X-Tenant-Slug header (resolved by tenant-resolver).
 *
 * @module workshop/routes/vehiculos
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { BadRequestError } from "../../../shared/errors/app-error.js";
import { createVehicle, updateVehicle, deleteVehicle, listVehicles, getVehicle } from "../services/vehicle.service.js";
import { decodeVin } from "../services/vin-decode.service.js";
import { getVehicleHistory } from "../services/history.service.js";

interface ParamsWithId {
  id: string;
}

interface VehiculoQuery {
  clientId?: string;
  brand?: string;
  model?: string;
  plate?: string;
  vin?: string;
  engineType?: string;
  limit?: string;
  offset?: string;
}

interface VinDecodeBody {
  vin: string;
}

interface VehiculoBody {
  brand?: string;
  model?: string;
  clientId?: string;
  plate?: string;
  vin?: string;
  year?: number;
  engineType?: string;
  kilometraje?: number;
  hvBatteryVoltage?: number;
  hvSafetyDisabled?: boolean;
  dtcCodes?: string[];
  notes?: string;
}

const VEHICLE_RESPONSE_PROPS = {
  id: { type: "string" },
  clientId: { type: "string" },
  plate: { type: "string", nullable: true },
  vin: { type: "string", nullable: true },
  brand: { type: "string" },
  model: { type: "string" },
  year: { type: "integer", nullable: true },
  engineType: { type: "string" },
  kilometraje: { type: "integer", nullable: true },
  hvBatteryVoltage: { type: "number", nullable: true },
  hvSafetyDisabled: { type: "boolean" },
  dtcCodes: { type: "array", items: { type: "string" }, nullable: true },
  notes: { type: "string", nullable: true },
  createdAt: { type: "string" },
  updatedAt: { type: "string" },
};

const VEHICLE_BODY_SCHEMA = {
  type: "object",
  properties: {
    brand: { type: "string", minLength: 1 },
    model: { type: "string", minLength: 1 },
    clientId: { type: "string", format: "uuid" },
    plate: { type: "string" },
    vin: { type: "string" },
    year: { type: "integer", minimum: 1900, maximum: 2100 },
    engineType: { type: "string", enum: ["Nafta", "Diésel", "HEV", "BEV"] },
    kilometraje: { type: "integer", minimum: 0 },
    hvBatteryVoltage: { type: "number", minimum: 0 },
    hvSafetyDisabled: { type: "boolean" },
    dtcCodes: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};

/**
 * Registers vehicle routes on the Fastify instance.
 */
export async function vehiculosRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/vehiculos — Create vehicle ──
  app.post<{ Body: VehiculoBody }>(
    "/workshop/vehiculos",
    {
      schema: {
        body: {
          ...VEHICLE_BODY_SCHEMA,
          required: ["brand", "model", "clientId"],
        },
        response: { 201: { type: "object", properties: VEHICLE_RESPONSE_PROPS } },
      },
    },
    async (request: FastifyRequest<{ Body: VehiculoBody }>, reply: FastifyReply) => {
      const vehicle = await createVehicle(request.body as Record<string, unknown>, request.tenantSlug);
      return reply.status(201).send(vehicle);
    },
  );

  // ── GET /workshop/vehiculos — List vehicles ──
  app.get<{ Querystring: VehiculoQuery }>(
    "/workshop/vehiculos",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            clientId: { type: "string", format: "uuid" },
            brand: { type: "string" },
            model: { type: "string" },
            plate: { type: "string" },
            vin: { type: "string" },
            engineType: { type: "string", enum: ["Nafta", "Diésel", "HEV", "BEV"] },
            limit: { type: "string" },
            offset: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: { type: "object", properties: VEHICLE_RESPONSE_PROPS },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: VehiculoQuery }>, reply: FastifyReply) => {
      const q = request.query;
      const vehicles = await listVehicles({
        clientId: q.clientId,
        brand: q.brand,
        model: q.model,
        plate: q.plate,
        vin: q.vin,
        engineType: q.engineType,
        limit: q.limit ? parseInt(q.limit, 10) : undefined,
        offset: q.offset ? parseInt(q.offset, 10) : undefined,
      }, request.tenantSlug);
      return reply.send(vehicles);
    },
  );

  // ── GET /workshop/vehiculos/:id — Get single vehicle ──
  app.get<{ Params: ParamsWithId }>(
    "/workshop/vehiculos/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId }>, reply: FastifyReply) => {
      const vehicle = await getVehicle(request.params.id, request.tenantSlug);
      return reply.send(vehicle);
    },
  );

  // ── PATCH /workshop/vehiculos/:id — Update vehicle ──
  app.patch<{ Params: ParamsWithId; Body: VehiculoBody }>(
    "/workshop/vehiculos/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: VEHICLE_BODY_SCHEMA,
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId; Body: VehiculoBody }>, reply: FastifyReply) => {
      const vehicle = await updateVehicle(request.params.id, request.body as Record<string, unknown>, request.tenantSlug);
      return reply.send(vehicle);
    },
  );

  // ── DELETE /workshop/vehiculos/:id — Delete vehicle ──
  app.delete<{ Params: ParamsWithId }>(
    "/workshop/vehiculos/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId }>, reply: FastifyReply) => {
      const result = await deleteVehicle(request.params.id, request.tenantSlug);
      return reply.send(result);
    },
  );

  // ── POST /workshop/vehiculos/decode-vin — Decode VIN via NHTSA ──
  app.post<{ Body: VinDecodeBody }>(
    "/workshop/vehiculos/decode-vin",
    {
      schema: {
        body: {
          type: "object",
          required: ["vin"],
          properties: {
            vin: { type: "string", minLength: 17, maxLength: 17 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: VinDecodeBody }>, reply: FastifyReply) => {
      const { vin } = request.body;
      if (!vin || vin.length !== 17) {
        throw new BadRequestError("VIN debe tener exactamente 17 caracteres");
      }
      const result = await decodeVin(vin.toUpperCase());
      return reply.send(result);
    },
  );

  // ── GET /workshop/vehiculos/:id/history — Vehicle history ──
  app.get<{ Params: ParamsWithId }>(
    "/workshop/vehiculos/:id/history",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ParamsWithId }>, reply: FastifyReply) => {
      const history = await getVehicleHistory(request.params.id, request.tenantSlug);
      return reply.send(history);
    },
  );
}
