/**
 * Fiscal Routes — Motor Fiscal DNIT endpoints.
 *
 * Endpoints:
 *   POST /finance/fiscal/form120/calcular  — Calculate IVA for a period
 *   GET  /finance/fiscal/form120           — List monthly IVA settlements
 *   POST /finance/fiscal/ire/calcular       — Calculate IRE for a year
 *   GET  /finance/fiscal/ire                — List annual IRE settlements
 *   POST /finance/fiscal/idu/calcular       — Calculate IDU
 *   GET  /finance/fiscal/idu                — List IDU settlements
 *   POST /finance/fiscal/isc/calcular       — Calculate ISC
 *   GET  /finance/fiscal/isc                — List ISC settlements
 *   POST /finance/fiscal/inr/calcular       — Calculate INR
 *   GET  /finance/fiscal/inr                — List INR settlements
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * @module finance/routes/fiscal
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { calcularForm120, listarLiquidacionesIva } from "../services/fiscal/form120.service.js";
import { calcularIre, listarLiquidacionesIre } from "../services/fiscal/ire.service.js";
import { calcularIdu, listarLiquidacionesIdu } from "../services/fiscal/idu.service.js";
import { calcularIsc, listarLiquidacionesIsc } from "../services/fiscal/isc.service.js";
import { calcularInr, listarLiquidacionesInr } from "../services/fiscal/inr.service.js";
import type { CalcularForm120Request, CalcularIreRequest, CalcularIduRequest, CalcularIscRequest, CalcularInrRequest } from "../types.js";

/**
 * Registers fiscal routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function fiscalRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /finance/fiscal/form120/calcular — Calculate IVA ──
  app.post<{ Body: CalcularForm120Request }>(
    "/finance/fiscal/form120/calcular",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100, description: "Año fiscal" },
            mes: { type: "integer", minimum: 1, maximum: 12, description: "Mes fiscal (1-12)" },
          },
        },
        headers: {
          type: "object",
          required: ["x-tenant-slug"],
          properties: {
            "x-tenant-slug": { type: "string" },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: CalcularForm120Request }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const result = await calcularForm120(req.body, tenantSlug);
      return reply.status(200).send(result);
    },
  );

  // ── GET /finance/fiscal/form120 — List settlements ──
  app.get(
    "/finance/fiscal/form120",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 60, default: 12 },
          },
        },
        headers: {
          type: "object",
          required: ["x-tenant-slug"],
          properties: {
            "x-tenant-slug": { type: "string" },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 12;
      const list = await listarLiquidacionesIva(tenantSlug, limit);
      return reply.status(200).send(list);
    },
  );

  // ── POST /finance/fiscal/ire/calcular — Calculate IRE ──
  app.post<{ Body: CalcularIreRequest }>(
    "/finance/fiscal/ire/calcular",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "formulario"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100, description: "Año fiscal" },
            formulario: {
              type: "string",
              enum: ["FORM_500_IRE", "FORM_501_IRE_SIMPLE", "FORM_502_IRE_RESIMPLE"],
              description: "Tipo de formulario IRE",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-tenant-slug"],
          properties: {
            "x-tenant-slug": { type: "string" },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: CalcularIreRequest }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const result = await calcularIre(req.body, tenantSlug);
      return reply.status(200).send(result);
    },
  );

  // ── GET /finance/fiscal/ire — List IRE settlements ──
  app.get(
    "/finance/fiscal/ire",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
          },
        },
        headers: {
          type: "object",
          required: ["x-tenant-slug"],
          properties: {
            "x-tenant-slug": { type: "string" },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
      const list = await listarLiquidacionesIre(tenantSlug, limit);
      return reply.status(200).send(list);
    },
  );

  // ── POST /finance/fiscal/idu/calcular — Calculate IDU ──
  app.post<{ Body: CalcularIduRequest }>(
    "/finance/fiscal/idu/calcular",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100, description: "Año fiscal" },
            tipoBeneficiario: {
              type: "string",
              enum: ["RESIDENTE", "NO_RESIDENTE"],
              default: "RESIDENTE",
              description: "Tipo de beneficiario (8% residente / 15% no residente)",
            },
            porcentajeDistribuido: {
              type: "number",
              minimum: 0.01,
              maximum: 1,
              default: 1,
              description: "% de utilidades distribuidas (0.01-1.00)",
            },
            liquidacionIreId: {
              type: "string",
              format: "uuid",
              description: "UUID de liquidación IRE (opcional, usa última si se omite)",
            },
          },
        },
        headers: {
          type: "object",
          required: ["x-tenant-slug"],
          properties: {
            "x-tenant-slug": { type: "string" },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: CalcularIduRequest }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const result = await calcularIdu(req.body, tenantSlug);
      return reply.status(200).send(result);
    },
  );

  // ── GET /finance/fiscal/idu — List IDU settlements ──
  app.get(
    "/finance/fiscal/idu",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
          },
        },
        headers: {
          type: "object",
          required: ["x-tenant-slug"],
          properties: {
            "x-tenant-slug": { type: "string" },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
      const list = await listarLiquidacionesIdu(tenantSlug, limit);
      return reply.status(200).send(list);
    },
  );

  // ── POST /finance/fiscal/isc/calcular — Calculate ISC (Form 130) ──
  app.post<{ Body: CalcularIscRequest }>(
    "/finance/fiscal/isc/calcular",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes", "rubro", "baseImponible", "tasa"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
            rubro: { type: "string", enum: ["COMBUSTIBLE", "TABACO", "BEBIDAS_ALCOHOLICAS", "BIENES_SUNTUARIOS", "OTROS"] },
            cantidad: { type: "number", minimum: 0 },
            unidadMedida: { type: "string" },
            baseImponible: { type: "number", minimum: 0 },
            tasa: { type: "number", minimum: 0 },
            tipoTasa: { type: "string", enum: ["PORCENTUAL", "ESPECIFICA"], default: "PORCENTUAL" },
            creditos: { type: "number", minimum: 0 },
          },
        },
        headers: {
          type: "object", required: ["x-tenant-slug"],
          properties: { "x-tenant-slug": { type: "string" } },
        },
      },
    },
    async (req: FastifyRequest<{ Body: CalcularIscRequest }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const result = await calcularIsc(req.body, tenantSlug);
      return reply.status(200).send(result);
    },
  );

  // ── GET /finance/fiscal/isc — List ISC settlements ──
  app.get(
    "/finance/fiscal/isc",
    {
      schema: {
        querystring: {
          type: "object", properties: {
            limit: { type: "integer", minimum: 1, maximum: 48, default: 12 },
          },
        },
        headers: {
          type: "object", required: ["x-tenant-slug"],
          properties: { "x-tenant-slug": { type: "string" } },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 12;
      const list = await listarLiquidacionesIsc(tenantSlug, limit);
      return reply.status(200).send(list);
    },
  );

  // ── POST /finance/fiscal/inr/calcular — Calculate INR (Form 515) ──
  app.post<{ Body: CalcularInrRequest }>(
    "/finance/fiscal/inr/calcular",
    {
      schema: {
        body: {
          type: "object",
          required: ["anho", "mes", "tipoRenta", "montoBruto", "tasaRetencion"],
          properties: {
            anho: { type: "integer", minimum: 2020, maximum: 2100 },
            mes: { type: "integer", minimum: 1, maximum: 12 },
            tipoRenta: { type: "string", enum: ["SERVICIOS_TECNICOS", "REGALIAS", "INTERESES", "DIVIDENDOS", "OTROS"] },
            beneficiarioNombre: { type: "string" },
            beneficiarioPais: { type: "string" },
            montoBruto: { type: "number", minimum: 0 },
            tasaRetencion: { type: "number", minimum: 0, maximum: 1 },
          },
        },
        headers: {
          type: "object", required: ["x-tenant-slug"],
          properties: { "x-tenant-slug": { type: "string" } },
        },
      },
    },
    async (req: FastifyRequest<{ Body: CalcularInrRequest }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const result = await calcularInr(req.body, tenantSlug);
      return reply.status(200).send(result);
    },
  );

  // ── GET /finance/fiscal/inr — List INR settlements ──
  app.get(
    "/finance/fiscal/inr",
    {
      schema: {
        querystring: {
          type: "object", properties: {
            limit: { type: "integer", minimum: 1, maximum: 48, default: 12 },
          },
        },
        headers: {
          type: "object", required: ["x-tenant-slug"],
          properties: { "x-tenant-slug": { type: "string" } },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const tenantSlug = req.headers["x-tenant-slug"] as string;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 12;
      const list = await listarLiquidacionesInr(tenantSlug, limit);
      return reply.status(200).send(list);
    },
  );
}
