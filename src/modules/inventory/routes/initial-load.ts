/**
 * Initial Load routes — "Puesta en Marcha" inventory setup.
 *
 * Endpoints:
 *   POST  /inventory/initial-load                            — Execute initial load
 *   GET   /inventory/initial-load/batches                    — List load batches
 *   GET   /inventory/initial-load/batches/:batchId           — Get batch details
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * @module inventory/routes/initial-load
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  executeInitialLoad,
  listInitialLoadBatches,
  getLoadBatchDetails,
} from "../services/initial-load.service.js";
import type {
  InitialLoadItemRepuesto,
  InitialLoadItemHerramienta,
} from "../services/initial-load.service.js";

// ─── Types ────────────────────────────────────

interface InitialLoadBody {
  repuestos?: InitialLoadItemRepuesto[];
  herramientas?: InitialLoadItemHerramienta[];
  cuentaContrapartidaId?: string;
  fecha?: string;
  concepto?: string;
}

interface BatchIdParams {
  batchId: string;
}

// ─── Routes ───────────────────────────────────

/**
 * Registers the initial load routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function initialLoadRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/initial-load — Execute initial load ──
  app.post<{ Body: InitialLoadBody }>(
    "/inventory/initial-load",
    {
      schema: {
        body: {
          type: "object",
          required: [],
          properties: {
            repuestos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  repuestoId: { type: "string", format: "uuid" },
                  codigo: { type: "string" },
                  descripcion: { type: "string" },
                  categoria: { type: "string" },
                  cantidad: { type: "integer", minimum: 1 },
                  valorEstimadoMercado: { type: "number", minimum: 0 },
                },
              },
            },
            herramientas: {
              type: "array",
              items: {
                type: "object",
                required: ["herramientaId", "numeroSerie", "estadoInicial", "valorAdquisicion", "valorNetoActual"],
                properties: {
                  herramientaId: { type: "string", format: "uuid" },
                  numeroSerie: { type: "string" },
                  tagRfid: { type: "string" },
                  estadoInicial: { type: "string", enum: ["DISPONIBLE", "REQUIERE_REPARACION", "EN_REPARACION", "EN_CALIBRACION"] },
                  valorAdquisicion: { type: "number", minimum: 0 },
                  valorNetoActual: { type: "number", minimum: 0 },
                  fechaAdquisicion: { type: "string", format: "date" },
                  observaciones: { type: "string" },
                },
              },
            },
            cuentaContrapartidaId: { type: "string", format: "uuid" },
            fecha: { type: "string", format: "date" },
            concepto: { type: "string", maxLength: 500 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              batchId: { type: "string" },
              repuestosCargados: { type: "integer" },
              herramientasCargadas: { type: "integer" },
              valorTotalCargado: { type: "string" },
              asiento: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  numero: { type: "integer" },
                  concepto: { type: "string" },
                  totalDebe: { type: "string" },
                  totalHaber: { type: "string" },
                },
                nullable: true,
              },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tipo: { type: "string" },
                    itemId: { type: "string" },
                    descripcion: { type: "string" },
                    cantidad: { type: "integer" },
                    valorUnitario: { type: "string" },
                    valorTotal: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: InitialLoadBody }>,
      reply: FastifyReply,
    ) => {
      const result = await executeInitialLoad({
        ...request.body,
        tenantSlug: request.tenantSlug,
      });
      return reply.status(201).send(result);
    },
  );

  // ── GET /inventory/initial-load/batches — List load batches ──
  app.get(
    "/inventory/initial-load/batches",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string", pattern: "^([1-9]|[1-9]\\d|100)$" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                batchId: { type: "string" },
                tipo: { type: "string" },
                asientoId: { type: "string", nullable: true },
                createdAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const limit = request.query
        ? parseInt((request.query as { limit?: string }).limit ?? "20", 10)
        : 20;
      const result = await listInitialLoadBatches(request.tenantSlug, limit);
      return reply.send(result);
    },
  );

  // ── GET /inventory/initial-load/batches/:batchId — Get batch details ──
  app.get<{ Params: BatchIdParams }>(
    "/inventory/initial-load/batches/:batchId",
    {
      schema: {
        params: {
          type: "object",
          required: ["batchId"],
          properties: {
            batchId: { type: "string", pattern: "^LOAD-\\d{8}-[A-Z0-9]{4}$" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                tipo: { type: "string" },
                batchId: { type: "string" },
                itemId: { type: "string" },
                itemDescripcion: { type: "string" },
                cantidad: { type: "integer" },
                valorUnitario: { type: "string" },
                valorTotal: { type: "string" },
                cuentaActivoId: { type: "string" },
                asientoId: { type: "string", nullable: true },
                cuentaPatrimonioId: { type: "string" },
                createdAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: BatchIdParams }>,
      reply: FastifyReply,
    ) => {
      const result = await getLoadBatchDetails(
        request.params.batchId,
        request.tenantSlug,
      );
      return reply.send(result);
    },
  );
}
