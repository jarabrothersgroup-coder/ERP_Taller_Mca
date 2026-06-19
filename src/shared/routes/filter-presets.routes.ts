/**
 * Filter Presets Routes — Advanced multi-field filtering with saved presets.
 *
 * POST   /presets              — Create a filter preset
 * GET    /presets              — List presets (optional ?entity=)
 * GET    /presets/:id          — Get a preset
 * DELETE /presets/:id          — Delete a preset
 * GET    /presets/quick/:entity — Get quick filters for an entity
 *
 * @module shared/routes/filter-presets.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createPreset,
  listPresets,
  getPreset,
  deletePreset,
  QUICK_FILTERS,
  type FilterField,
} from "../services/filter-presets.service.js";
import { BadRequestError, NotFoundError } from "../errors/app-error.js";

interface CreatePresetBody {
  name: string;
  entity: string;
  filters: FilterField[];
}

interface ListPresetsQuery {
  entity?: string;
}

export async function filterPresetRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /presets — Create a filter preset ──
  app.post<{ Body: CreatePresetBody }>(
    "/presets",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "entity", "filters"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            entity: { type: "string" },
            filters: { type: "array", items: { type: "object" } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreatePresetBody }>, reply: FastifyReply) => {
      const { name, entity, filters } = request.body;
      const tenantSlug = (request as any).tenantSlug as string;

      if (!name || name.trim().length === 0) {
        throw new BadRequestError("Nombre del preset requerido");
      }
      if (!entity || entity.trim().length === 0) {
        throw new BadRequestError("Entidad requerida (ordenes, repuestos, facturas)");
      }
      if (!filters || !Array.isArray(filters) || filters.length === 0) {
        throw new BadRequestError("Al menos un filtro requerido");
      }

      const preset = createPreset(tenantSlug, name.trim(), entity.trim(), filters);
      return reply.status(201).send({ ok: true, preset });
    },
  );

  // ── GET /presets — List presets ──
  app.get<{ Querystring: ListPresetsQuery }>(
    "/presets",
    async (request: FastifyRequest<{ Querystring: ListPresetsQuery }>, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { entity } = request.query;
      const presets = listPresets(tenantSlug, entity);
      return reply.send({ presets, total: presets.length });
    },
  );

  // ── GET /presets/:id — Get a preset ──
  app.get<{ Params: { id: string } }>(
    "/presets/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const preset = getPreset(request.params.id);
      if (!preset) {
        throw new NotFoundError(`Preset no encontrado: ${request.params.id}`);
      }
      return reply.send({ preset });
    },
  );

  // ── DELETE /presets/:id — Delete a preset ──
  app.delete<{ Params: { id: string } }>(
    "/presets/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const deleted = deletePreset(request.params.id);
      if (!deleted) {
        throw new NotFoundError(`Preset no encontrado: ${request.params.id}`);
      }
      return reply.send({ ok: true, deleted: true });
    },
  );

  // ── GET /presets/quick/:entity — Get quick filters ──
  app.get<{ Params: { entity: string } }>(
    "/presets/quick/:entity",
    async (request: FastifyRequest<{ Params: { entity: string } }>, reply: FastifyReply) => {
      const { entity } = request.params;
      const quickFilters = (QUICK_FILTERS as any)[entity];
      if (!quickFilters) {
        return reply.send({ quickFilters: [] });
      }
      const filters = Object.entries(quickFilters).map(([key, value]) => ({
        key,
        ...(value as any),
      }));
      return reply.send({ quickFilters: filters });
    },
  );
}
