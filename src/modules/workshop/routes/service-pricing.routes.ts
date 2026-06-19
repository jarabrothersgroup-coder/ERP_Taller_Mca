/**
 * Service Pricing Routes — CRUD endpoints for multi-dimensional pricing matrix.
 *
 * Categories:
 *   GET    /workshop/service-categories          — List all categories
 *   POST   /workshop/service-categories          — Create a category
 *   PATCH  /workshop/service-categories/:id      — Update a category
 *   DELETE /workshop/service-categories/:id      — Delete a category
 *
 * Pricing Rules:
 *   GET    /workshop/pricing-rules               — List pricing rules (filters: servicioId, vehicleTypeId, activo)
 *   POST   /workshop/pricing-rules               — Create a pricing rule
 *   PATCH  /workshop/pricing-rules/:id           — Update a pricing rule
 *   DELETE /workshop/pricing-rules/:id           — Delete a pricing rule
 *
 * Brand Map:
 *   GET    /workshop/service-brand-map/:servicioId — List brands for a service
 *   PUT    /workshop/service-brand-map/:servicioId — Set brands for a service
 *
 * Reference Data (read-only):
 *   GET    /workshop/reference/vehicle-types     — List vehicle types
 *   GET    /workshop/reference/fuel-types        — List fuel types
 *   GET    /workshop/reference/mileage-intervals — List mileage intervals
 *
 * Matrix Resolution:
 *   GET    /workshop/pricing-matrix              — Resolve price for service + vehicle + fuel + km
 *
 * @module workshop/routes/service-pricing
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  resolvePricing,
  listBrandMap,
  setBrandMap,
  listVehicleTypes,
  listFuelTypes,
  listMileageIntervals,
} from "../services/service-pricing.service.js";

// ─── Types ──────────────────────────────────────

interface ParamsWithId {
  id: string;
}

interface ParamsWithServicioId {
  servicioId: string;
}

interface CategoryBody {
  nombre?: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  orden?: number;
}

interface PricingRuleBody {
  servicioId?: string;
  vehicleTypeId?: string;
  fuelTypeId?: string;
  mileageIntervalId?: string;
  precioVentaPyg?: number;
  precioCostoPyg?: number;
  impuestoIvaPct?: number;
  tiempoEstimadoMin?: number;
  complejidad?: string;
  activo?: boolean;
}

interface PricingRuleQuery {
  servicioId?: string;
  vehicleTypeId?: string;
  activo?: string;
  limit?: string;
  offset?: string;
}

interface PricingMatrixQuery {
  servicioId?: string;
  vehicleTypeId?: string;
  fuelTypeId?: string;
  mileageIntervalId?: string;
}

interface BrandMapBody {
  marcas?: string[];
}

// ─── Response schema properties ──────────────────

const CATEGORY_RESPONSE_PROPS = {
  id: { type: "string" },
  nombre: { type: "string" },
  descripcion: { type: "string", nullable: true },
  icono: { type: "string", nullable: true },
  color: { type: "string", nullable: true },
  orden: { type: "integer" },
};

const PRICING_RULE_RESPONSE_PROPS = {
  id: { type: "string" },
  servicioId: { type: "string" },
  vehicleTypeId: { type: "string" },
  fuelTypeId: { type: "string", nullable: true },
  mileageIntervalId: { type: "string", nullable: true },
  precioVentaPyg: { type: "string" },
  precioCostoPyg: { type: "string" },
  impuestoIvaPct: { type: "string" },
  tiempoEstimadoMin: { type: "integer" },
  complejidad: { type: "string" },
  activo: { type: "boolean" },
  tenantSlug: { type: "string" },
  createdAt: { type: "string" },
  updatedAt: { type: "string" },
};

// ─── Routes ─────────────────────────────────────

export async function servicePricingRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── Categories ──────────────────────────────

  // GET /workshop/service-categories
  app.get(
    "/workshop/service-categories",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: CATEGORY_RESPONSE_PROPS,
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const categories = await listCategories();
      return reply.send(categories);
    },
  );

  // POST /workshop/service-categories
  app.post<{ Body: CategoryBody }>(
    "/workshop/service-categories",
    {
      schema: {
        body: {
          type: "object",
          required: ["nombre"],
          properties: {
            nombre: { type: "string", minLength: 1 },
            descripcion: { type: "string" },
            icono: { type: "string" },
            color: { type: "string" },
            orden: { type: "integer" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: CATEGORY_RESPONSE_PROPS,
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CategoryBody }>,
      reply: FastifyReply,
    ) => {
      const category = await createCategory({
        nombre: request.body.nombre!,
        descripcion: request.body.descripcion,
        icono: request.body.icono,
        color: request.body.color,
        orden: request.body.orden,
      });
      return reply.status(201).send(category);
    },
  );

  // PATCH /workshop/service-categories/:id
  app.patch<{ Params: ParamsWithId; Body: CategoryBody }>(
    "/workshop/service-categories/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            nombre: { type: "string", minLength: 1 },
            descripcion: { type: "string" },
            icono: { type: "string" },
            color: { type: "string" },
            orden: { type: "integer" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ParamsWithId; Body: CategoryBody }>,
      reply: FastifyReply,
    ) => {
      const category = await updateCategory(request.params.id, request.body);
      return reply.send(category);
    },
  );

  // DELETE /workshop/service-categories/:id
  app.delete<{ Params: ParamsWithId }>(
    "/workshop/service-categories/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ParamsWithId }>,
      reply: FastifyReply,
    ) => {
      const result = await deleteCategory(request.params.id);
      return reply.send(result);
    },
  );

  // ── Pricing Rules ───────────────────────────

  // GET /workshop/pricing-rules
  app.get<{ Querystring: PricingRuleQuery }>(
    "/workshop/pricing-rules",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            servicioId: { type: "string", format: "uuid" },
            vehicleTypeId: { type: "string", format: "uuid" },
            activo: { type: "string", enum: ["true", "false"] },
            limit: { type: "string" },
            offset: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: PRICING_RULE_RESPONSE_PROPS,
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: PricingRuleQuery }>,
      reply: FastifyReply,
    ) => {
      const q = request.query;
      const rules = await listPricingRules(
        {
          servicioId: q.servicioId,
          vehicleTypeId: q.vehicleTypeId,
          activo: q.activo !== undefined ? q.activo === "true" : undefined,
          limit: q.limit ? parseInt(q.limit, 10) : undefined,
          offset: q.offset ? parseInt(q.offset, 10) : undefined,
        },
        request.tenantSlug,
      );
      return reply.send(rules);
    },
  );

  // POST /workshop/pricing-rules
  app.post<{ Body: PricingRuleBody }>(
    "/workshop/pricing-rules",
    {
      schema: {
        body: {
          type: "object",
          required: ["servicioId", "vehicleTypeId", "precioVentaPyg", "tiempoEstimadoMin"],
          properties: {
            servicioId: { type: "string", format: "uuid" },
            vehicleTypeId: { type: "string", format: "uuid" },
            fuelTypeId: { type: "string", format: "uuid" },
            mileageIntervalId: { type: "string", format: "uuid" },
            precioVentaPyg: { type: "number", minimum: 0 },
            precioCostoPyg: { type: "number", minimum: 0 },
            impuestoIvaPct: { type: "number", minimum: 0, maximum: 100 },
            tiempoEstimadoMin: { type: "integer", minimum: 0 },
            complejidad: { type: "string" },
            activo: { type: "boolean" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: PRICING_RULE_RESPONSE_PROPS,
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: PricingRuleBody }>,
      reply: FastifyReply,
    ) => {
      const rule = await createPricingRule({
        servicioId: request.body.servicioId!,
        vehicleTypeId: request.body.vehicleTypeId!,
        precioVentaPyg: request.body.precioVentaPyg!,
        precioCostoPyg: request.body.precioCostoPyg,
        impuestoIvaPct: request.body.impuestoIvaPct,
        tiempoEstimadoMin: request.body.tiempoEstimadoMin!,
        complejidad: request.body.complejidad,
        activo: request.body.activo,
        fuelTypeId: request.body.fuelTypeId,
        mileageIntervalId: request.body.mileageIntervalId,
        tenantSlug: request.tenantSlug,
      });
      return reply.status(201).send(rule);
    },
  );

  // PATCH /workshop/pricing-rules/:id
  app.patch<{ Params: ParamsWithId; Body: PricingRuleBody }>(
    "/workshop/pricing-rules/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            servicioId: { type: "string", format: "uuid" },
            vehicleTypeId: { type: "string", format: "uuid" },
            fuelTypeId: { type: "string", format: "uuid" },
            mileageIntervalId: { type: "string", format: "uuid" },
            precioVentaPyg: { type: "number", minimum: 0 },
            precioCostoPyg: { type: "number", minimum: 0 },
            impuestoIvaPct: { type: "number", minimum: 0, maximum: 100 },
            tiempoEstimadoMin: { type: "integer", minimum: 0 },
            complejidad: { type: "string" },
            activo: { type: "boolean" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ParamsWithId; Body: PricingRuleBody }>,
      reply: FastifyReply,
    ) => {
      const rule = await updatePricingRule(
        request.params.id,
        request.body,
        request.tenantSlug,
      );
      return reply.send(rule);
    },
  );

  // DELETE /workshop/pricing-rules/:id
  app.delete<{ Params: ParamsWithId }>(
    "/workshop/pricing-rules/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ParamsWithId }>,
      reply: FastifyReply,
    ) => {
      const result = await deletePricingRule(
        request.params.id,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );

  // ── Brand Map ───────────────────────────────

  // GET /workshop/service-brand-map/:servicioId
  app.get<{ Params: ParamsWithServicioId }>(
    "/workshop/service-brand-map/:servicioId",
    {
      schema: {
        params: {
          type: "object",
          required: ["servicioId"],
          properties: { servicioId: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                servicioId: { type: "string" },
                marca: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ParamsWithServicioId }>,
      reply: FastifyReply,
    ) => {
      const brands = await listBrandMap(request.params.servicioId);
      return reply.send(brands);
    },
  );

  // PUT /workshop/service-brand-map/:servicioId
  app.put<{ Params: ParamsWithServicioId; Body: BrandMapBody }>(
    "/workshop/service-brand-map/:servicioId",
    {
      schema: {
        params: {
          type: "object",
          required: ["servicioId"],
          properties: { servicioId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["marcas"],
          properties: {
            marcas: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: ParamsWithServicioId;
        Body: BrandMapBody;
      }>,
      reply: FastifyReply,
    ) => {
      const result = await setBrandMap(
        request.params.servicioId,
        request.body.marcas!,
      );
      return reply.send(result);
    },
  );

  // ── Reference Data ──────────────────────────

  // GET /workshop/reference/vehicle-types
  app.get(
    "/workshop/reference/vehicle-types",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                nombre: { type: "string" },
                descripcion: { type: "string", nullable: true },
                activo: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const types = await listVehicleTypes();
      return reply.send(types);
    },
  );

  // GET /workshop/reference/fuel-types
  app.get(
    "/workshop/reference/fuel-types",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                nombre: { type: "string" },
                descripcion: { type: "string", nullable: true },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const types = await listFuelTypes();
      return reply.send(types);
    },
  );

  // GET /workshop/reference/mileage-intervals
  app.get(
    "/workshop/reference/mileage-intervals",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                kmDesde: { type: "integer" },
                kmHasta: { type: "integer", nullable: true },
                nombre: { type: "string" },
                orden: { type: "integer" },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const intervals = await listMileageIntervals();
      return reply.send(intervals);
    },
  );

  // ── Pricing Matrix Resolution ───────────────

  // GET /workshop/pricing-matrix
  app.get<{ Querystring: PricingMatrixQuery }>(
    "/workshop/pricing-matrix",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["servicioId", "vehicleTypeId"],
          properties: {
            servicioId: { type: "string", format: "uuid" },
            vehicleTypeId: { type: "string", format: "uuid" },
            fuelTypeId: { type: "string", format: "uuid" },
            mileageIntervalId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            oneOf: [
              {
                type: "object",
                properties: PRICING_RULE_RESPONSE_PROPS,
              },
              { type: "null" },
            ],
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: PricingMatrixQuery }>,
      reply: FastifyReply,
    ) => {
      const q = request.query;
      const rule = await resolvePricing({
        servicioId: q.servicioId!,
        vehicleTypeId: q.vehicleTypeId!,
        fuelTypeId: q.fuelTypeId,
        mileageIntervalId: q.mileageIntervalId,
        tenantSlug: request.tenantSlug,
      });
      return reply.send(rule ?? null);
    },
  );
}
