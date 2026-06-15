/**
 * Analytics Routes — Sprint 10.
 *
 * Endpoints for the executive dashboard and analytics views.
 * All routes are tenant-scoped via the resolveTenant hook.
 *
 * @module workshop/routes/analytics
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  getDashboardKPIs,
  getTopServicios,
  getTopClientes,
  getProductividad,
  getBalancedScorecard,
} from "../services/analytics.service.js";

/**
 * Query params for GET /workshop/analytics/productividad
 */
interface ProductividadQuery {
  desde?: string;
  hasta?: string;
  limit?: string;
}

/**
 * Query params for top lists
 */
interface TopQuery {
  limit?: string;
}

/**
 * Registers analytics routes on the Fastify instance.
 *
 * Routes:
 *   - GET /workshop/analytics/dashboard       → Dashboard KPIs
 *   - GET /workshop/analytics/top-servicios    → Top services by usage
 *   - GET /workshop/analytics/top-clientes     → Top clients by revenue
 *   - GET /workshop/analytics/productividad    → Workshop productivity
 *
 * @param app - Fastify instance
 */
export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /workshop/analytics/dashboard ──
  app.get(
    "/workshop/analytics/dashboard",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              ordenes: {
                type: "object",
                properties: {
                  activas: { type: "number" },
                  presupuestado: { type: "number" },
                  aprobado: { type: "number" },
                  enProceso: { type: "number" },
                  controlCalidad: { type: "number" },
                  listo: { type: "number" },
                  totalMes: { type: "number" },
                  completadasHoy: { type: "number" },
                },
              },
              finanzas: {
                type: "object",
                properties: {
                  ingresosMes: { type: "number" },
                  ingresosSemana: { type: "number" },
                  pendienteCobro: { type: "number" },
                  facturasEmitidasMes: { type: "number" },
                  cobrosMes: { type: "number" },
                },
              },
              taller: {
                type: "object",
                properties: {
                  serviciosRealizadosMes: { type: "number" },
                  repuestosUsadosMes: { type: "number" },
                  costoRepuestosMes: { type: "number" },
                  facturacionPromedioOT: { type: "number" },
                },
              },
              inventario: {
                type: "object",
                properties: {
                  productosBajoStock: { type: "number" },
                  movimientosHoy: { type: "number" },
                },
              },
              tendenciaSemanal: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    fecha: { type: "string" },
                    ingresos: { type: "number" },
                    ordenesCompletadas: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "X-Tenant-Slug header is required",
        });
      }
      const data = await getDashboardKPIs(tenantSlug);
      return reply.send(data);
    },
  );

  // ── GET /workshop/analytics/top-servicios ──
  app.get<{ Querystring: TopQuery }>(
    "/workshop/analytics/top-servicios",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                servicioId: { type: "string" },
                nombre: { type: "string" },
                categoria: { type: "string", nullable: true },
                totalUsos: { type: "number" },
                ingresosGenerados: { type: "number" },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: TopQuery }>, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) {
        return reply.status(400).send({ error: "ValidationError", message: "X-Tenant-Slug header is required" });
      }
      const limitVal = parseInt(request.query.limit ?? "10", 10);
      const data = await getTopServicios(tenantSlug, limitVal);
      return reply.send(data);
    },
  );

  // ── GET /workshop/analytics/top-clientes ──
  app.get<{ Querystring: TopQuery }>(
    "/workshop/analytics/top-clientes",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                clientId: { type: "string" },
                nombre: { type: "string" },
                telefono: { type: "string", nullable: true },
                totalFacturado: { type: "number" },
                totalOTs: { type: "number" },
                ultimaVisita: { type: "string", nullable: true },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: TopQuery }>, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) {
        return reply.status(400).send({ error: "ValidationError", message: "X-Tenant-Slug header is required" });
      }
      const limitVal = parseInt(request.query.limit ?? "10", 10);
      const data = await getTopClientes(tenantSlug, limitVal);
      return reply.send(data);
    },
  );

  // ── GET /workshop/analytics/productividad ──
  app.get<{ Querystring: ProductividadQuery }>(
    "/workshop/analytics/productividad",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            desde: { type: "string" },
            hasta: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              resumen: {
                type: "object",
                properties: {
                  totalOTsCompletadas: { type: "number" },
                  promedioDuracionDias: { type: "number" },
                  ingresosPeriodo: { type: "number" },
                  costoRepuestos: { type: "number" },
                  margenBruto: { type: "number" },
                  eficienciaPorcentaje: { type: "number" },
                },
              },
              detalleMensual: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    mes: { type: "string" },
                    otsCompletadas: { type: "number" },
                    ingresos: { type: "number" },
                    costoRepuestos: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ProductividadQuery }>, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) {
        return reply.status(400).send({ error: "ValidationError", message: "X-Tenant-Slug header is required" });
      }
      const { desde, hasta } = request.query;
      const data = await getProductividad(tenantSlug, desde, hasta);
      return reply.send(data);
    },
  );

  // ── GET /workshop/analytics/scorecard ──
  app.get(
    "/workshop/analytics/scorecard",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;
      if (!tenantSlug) {
        return reply.status(400).send({ error: "ValidationError", message: "X-Tenant-Slug header is required" });
      }
      const data = await getBalancedScorecard(tenantSlug);
      return reply.send(data);
    },
  );
}
