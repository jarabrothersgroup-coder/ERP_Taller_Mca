/**
 * Label Printing Routes — API endpoints for label generation and printing.
 *
 * Endpoints:
 *   GET  /label-printing/templates — List label templates
 *   POST /label-printing/templates — Create/update template
 *   POST /label-printing/generate — Generate print payload
 *   POST /label-printing/print — Send to printer (socket)
 *   GET  /label-printing/repuesto/:id — Generate label for repuesto
 *   GET  /label-printing/herramienta/:id — Generate label for herramienta
 *
 * @module label-printing/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { repuestos } from "../../inventory/schema/repuestos.js";
import { herramientas } from "../../inventory/schema/herramientas.js";
import { eq } from "drizzle-orm";
import {
  generateLabelPayload,
  validateLabelData,
  type LabelData,
} from "../services/label-printing.service.js";

interface GenerateBody {
  tipo: string;
  protocolo: string;
  data: LabelData;
  copias?: number;
}

interface TemplateBody {
  nombre: string;
  tipo: string;
  protocolo: string;
  anchoMm?: number;
  altoMm?: number;
  dpi?: number;
  impresoraDefault?: string;
  layout?: any;
}

export async function labelPrintingRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /label-printing/repuesto/:id — Generate label for a spare part ──
  app.get<{ Params: { id: string } }>(
    "/label-printing/repuesto/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        querystring: {
          type: "object",
          properties: {
            protocolo: { type: "string", enum: ["ESCPOS", "ZPL", "TSPL"] },
            copias: { type: "integer", minimum: 1, maximum: 99 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { protocolo?: string; copias?: number } }>, reply: FastifyReply) => {
      const [repuesto] = await db()
        .select()
        .from(repuestos)
        .where(eq(repuestos.id, request.params.id))
        .limit(1);

      if (!repuesto) {
        return reply.status(404).send({ error: "Repuesto no encontrado" });
      }

      const protocolo = request.query.protocolo || "ESCPOS";
      const copias = request.query.copias || 1;
      const labelData: LabelData = {
        id: repuesto.id,
        codigo: repuesto.codigo,
        codigoBarras: repuesto.codigoBarras || repuesto.codigo,
        descripcion: repuesto.descripcion,
        marca: repuesto.marca || "",
        modelo: repuesto.modelo || "",
        precio: repuesto.precioVenta,
        ubicacion: repuesto.ubicacion || "",
      };

      const validation = validateLabelData("REPUESTO", labelData);
      if (!validation.valid) {
        return reply.status(400).send({ error: "Datos incompletos", details: validation.errors });
      }

      const payload = generateLabelPayload("REPUESTO", protocolo, labelData);
      return reply.send({
        payload: payload.raw,
        protocol: payload.protocol,
        estimatedWidthMm: payload.estimatedWidthMm,
        estimatedHeightMm: payload.estimatedHeightMm,
        copias,
        data: labelData,
      });
    },
  );

  // ── GET /label-printing/herramienta/:id — Generate label for a tool ──
  app.get<{ Params: { id: string } }>(
    "/label-printing/herramienta/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        querystring: {
          type: "object",
          properties: {
            protocolo: { type: "string", enum: ["ESCPOS", "ZPL", "TSPL"] },
            copias: { type: "integer", minimum: 1, maximum: 99 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { protocolo?: string; copias?: number } }>, reply: FastifyReply) => {
      const [herramienta] = await db()
        .select()
        .from(herramientas)
        .where(eq(herramientas.id, request.params.id))
        .limit(1);

      if (!herramienta) {
        return reply.status(404).send({ error: "Herramienta no encontrada" });
      }

      const protocolo = request.query.protocolo || "ESCPOS";
      const copias = request.query.copias || 1;
      const labelData: LabelData = {
        id: herramienta.id,
        codigo: herramienta.codigo,
        nombre: herramienta.nombre,
        descripcion: herramienta.descripcion || herramienta.nombre,
        marca: herramienta.marca || "",
        modelo: herramienta.modelo || "",
        estado: herramienta.estadoCalibracion || "DESCONOCIDO",
        ubicacion: herramienta.ubicacion || "",
      };

      const validation = validateLabelData("HERRAMIENTA", labelData);
      if (!validation.valid) {
        return reply.status(400).send({ error: "Datos incompletos", details: validation.errors });
      }

      const payload = generateLabelPayload("HERRAMIENTA", protocolo, labelData);
      return reply.send({
        payload: payload.raw,
        protocol: payload.protocol,
        estimatedWidthMm: payload.estimatedWidthMm,
        estimatedHeightMm: payload.estimatedHeightMm,
        copias,
        data: labelData,
      });
    },
  );

  // ── POST /label-printing/generate — Generate custom label payload ──
  app.post<{ Body: GenerateBody }>(
    "/label-printing/generate",
    {
      schema: {
        body: {
          type: "object",
          required: ["tipo", "protocolo", "data"],
          properties: {
            tipo: { type: "string", enum: ["REPUESTO", "HERRAMIENTA"] },
            protocolo: { type: "string", enum: ["ESCPOS", "ZPL", "TSPL", "RAW_TEXT"] },
            data: { type: "object" },
            copias: { type: "integer", minimum: 1, maximum: 99 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: GenerateBody }>, reply: FastifyReply) => {
      const { tipo, protocolo, data, copias } = request.body;

      const validation = validateLabelData(tipo, data);
      if (!validation.valid) {
        return reply.status(400).send({ error: "Datos inválidos", details: validation.errors });
      }

      const payload = generateLabelPayload(tipo, protocolo, data);
      return reply.send({
        payload: payload.raw,
        protocol: payload.protocol,
        estimatedWidthMm: payload.estimatedWidthMm,
        estimatedHeightMm: payload.estimatedHeightMm,
        copias: copias || 1,
      });
    },
  );

  // ── POST /label-printing/preview — Generate HTML preview of label ──
  app.post<{ Body: GenerateBody }>(
    "/label-printing/preview",
    {
      schema: {
        body: {
          type: "object",
          required: ["tipo", "data"],
          properties: {
            tipo: { type: "string", enum: ["REPUESTO", "HERRAMIENTA"] },
            protocolo: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: GenerateBody }>, reply: FastifyReply) => {
      const { tipo, data } = request.body;
      const widthMm = tipo === "HERRAMIENTA" ? 60 : 50;
      const heightMm = tipo === "HERRAMIENTA" ? 40 : 30;

      const html = generateHtmlPreview(tipo, data, widthMm, heightMm);
      return reply.send({ html, widthMm, heightMm });
    },
  );
}

/**
 * Generate an HTML preview of a label for screen display.
 */
function generateHtmlPreview(tipo: string, data: LabelData, widthMm: number, heightMm: number): string {
  const barcodeData = data.codigoBarras || data.codigo || "";
  const qrData = JSON.stringify({ id: data.id, codigo: data.codigo });

  if (tipo === "REPUESTO") {
    return `
<div style="width:${widthMm}mm;height:${heightMm}mm;border:1px solid #333;padding:2mm;font-family:monospace;font-size:7pt;display:flex;flex-direction:column;justify-content:space-between;background:white;color:black">
  <div style="text-align:center;font-weight:bold;font-size:8pt">${escHtml(String(data.codigo || ""))}</div>
  <div style="text-align:center;background:#f0f0f0;padding:1mm;border:1px dashed #999;font-size:6pt;letter-spacing:1px">
    |||||||||||||||||||||||||||||||
  </div>
  <div style="text-align:center;font-size:6pt">${escHtml(String(data.descripcion || "").substring(0, 25))}</div>
  <div style="text-align:center;font-size:6pt;font-weight:bold">${escHtml(`${data.marca || ""} ${data.modelo || ""}`.trim())}</div>
  ${data.precio ? `<div style="text-align:center;font-size:7pt;font-weight:bold">Gs. ${Number(data.precio).toLocaleString("es-PY")}</div>` : ""}
</div>`;
  }

  return `
<div style="width:${widthMm}mm;height:${heightMm}mm;border:1px solid #333;padding:2mm;font-family:monospace;font-size:7pt;display:flex;flex-direction:column;align-items:center;background:white;color:black">
  <div style="text-align:center;font-weight:bold;font-size:8pt">${escHtml(String(data.codigo || ""))}</div>
  <div style="width:20mm;height:20mm;border:1px solid #333;display:flex;align-items:center;justify-content:center;margin:1mm 0">
    <span style="font-size:5pt">QR: ${escHtml(qrData.substring(0, 20))}...</span>
  </div>
  <div style="text-align:center;font-size:7pt;font-weight:bold">${escHtml(String(data.nombre || "").substring(0, 25))}</div>
  <div style="text-align:center;font-size:6pt">Estado: ${escHtml(String(data.estado || ""))}</div>
  <div style="text-align:center;font-size:6pt;font-weight:bold;color:#c00">⚠ PROPIEDAD DEL TALLER</div>
</div>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
