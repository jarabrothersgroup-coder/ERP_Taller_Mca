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
 *   GET  /label-printing/factura/:id — Generate ESC/POS/PDF receipt for invoice
 *   GET  /label-printing/config — Get invoice print config for tenant
 *   PUT  /label-printing/config — Update invoice print config
 *   POST /label-printing/config/preview — Preview invoice with current config
 *   GET  /label-printing/reimpresiones — List invoices eligible for reprint
 *   GET  /label-printing/reimpresiones/:id — Print history for invoice
 *   POST /label-printing/reimpresiones/:id — Re-generate print payload
 *
 * @module label-printing/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { repuestos } from "../../inventory/schema/repuestos.js";
import { herramientas } from "../../inventory/schema/herramientas.js";
import { facturas, facturaDetalles } from "../../finance/schema/index.js";
import { ordenesTrabajo } from "../../workshop/schema/index.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { invoiceConfig } from "../schema/invoice-config.js";
import { printJobs } from "../schema/label-templates.js";
import { eq, and, desc, like, or, sql, gte, lte } from "drizzle-orm";
import {
  generateLabelPayload,
  generateFacturaPDF,
  validateLabelData,
  escHtml,
  type LabelData,
  type InvoiceConfig,
} from "../services/label-printing.service.js";

interface GenerateBody {
  tipo: string;
  protocolo: string;
  data: LabelData;
  copias?: number;
}

export async function labelPrintingRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /label-printing/health — Printer connectivity check ──
  app.get(
    "/label-printing/health",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = request.tenantSlug;

      // Fetch tenant's printer config
      const [config] = await db()
        .select()
        .from(invoiceConfig)
        .where(eq(invoiceConfig.tenantSlug, tenant))
        .limit(1);

      const printerAddress = config?.printerAddress || null;
      const printerModel = config?.printerModel || "generic";
      const protocol = config?.printerProtocol || "ESCPOS";

      // Basic health check: verify config exists and printer is configured
      const isConfigured = !!printerAddress;
      const isPcl5e = printerModel.toLowerCase().includes("hp") ||
                      printerModel.toLowerCase().includes("laserjet");

      return reply.send({
        status: isConfigured ? "ready" : "not_configured",
        printer: {
          address: printerAddress,
          model: printerModel,
          protocol,
          isPcl5e,
          dpi: config?.printerDpi || 203,
          paperWidthMm: config?.paperWidthMm || 80,
        },
        message: isConfigured
          ? `Impresora ${printerModel} configurada en ${printerAddress}`
          : "No hay impresora configurada. Configure en Facturación → Configurador.",
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── GET /label-printing/repuesto/:id — Generate label for a spare part ──
  app.get<{ Params: { id: string }; Querystring: { protocolo?: string; copias?: number } }>(
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
        precio: repuesto.precioVenta ?? undefined,
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
  app.get<{ Params: { id: string }; Querystring: { protocolo?: string; copias?: number } }>(
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
            tipo: { type: "string", enum: ["REPUESTO", "HERRAMIENTA", "FACTURA"] },
            protocolo: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: GenerateBody }>, reply: FastifyReply) => {
      const { tipo, data } = request.body;
      const widthMm = tipo === "HERRAMIENTA" ? 60 : tipo === "FACTURA" ? 80 : 50;
      const heightMm = tipo === "HERRAMIENTA" ? 40 : tipo === "FACTURA" ? 200 : 30;

      const html = generateHtmlPreview(tipo, data, widthMm, heightMm);
      return reply.send({ html, widthMm, heightMm });
    },
  );

  // ── GET /label-printing/factura/:id — Generate ESC/POS receipt for invoice ──
  app.get<{ Params: { id: string }; Querystring: { protocolo?: string; copias?: number } }>(
    "/label-printing/factura/:id",
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
      const tenant = request.tenantSlug;
      const { id } = request.params;

      // Fetch factura
      const [factura] = await db()
        .select()
        .from(facturas)
        .where(and(eq(facturas.id, id), eq(facturas.tenantSlug, tenant)))
        .limit(1);

      if (!factura) {
        return reply.status(404).send({ error: "Factura no encontrada" });
      }

      // Fetch line items
      const items = await db()
        .select()
        .from(facturaDetalles)
        .where(eq(facturaDetalles.facturaId, id))
        .orderBy(facturaDetalles.numeroLinea);

      // Fetch client from OT
      let clienteNombre = "";
      let clienteRuc = "";
      let clienteDireccion = "";
      if (factura.ordenId) {
        const [ot] = await db()
          .select({ clientId: ordenesTrabajo.clientId })
          .from(ordenesTrabajo)
          .where(eq(ordenesTrabajo.id, factura.ordenId))
          .limit(1);
        if (ot?.clientId) {
          const [client] = await db()
            .select()
            .from(clients)
            .where(eq(clients.id, ot.clientId))
            .limit(1);
          if (client) {
            clienteNombre = client.name || "";
            clienteRuc = (client as any).ruc || "";
            clienteDireccion = (client as any).direccion || "";
          }
        }
      }

      const protocolo = request.query.protocolo || "ESCPOS";
      const copias = request.query.copias || 1;

      // Build line items for ESC/POS
      const lineItemsData = items.map((it) => ({
        desc: it.descripcion || "",
        cant: Number(it.cantidad ?? 1),
        precio: Number(it.precioUnitario ?? 0),
        total: Number(it.subtotal ?? 0),
      }));

      const totalNum = Number(factura.total ?? 0);
      const ivaRate = 0.10;
      const base = Math.round((totalNum / (1 + ivaRate)) * 100) / 100;
      const iva = Math.round((totalNum - base) * 100) / 100;

      const labelData: LabelData = {
        numeroFactura: factura.numeroFacturaManual || factura.id.slice(0, 12),
        tipoFactura: factura.tipo,
        fechaEmision: factura.createdAt ? new Date(factura.createdAt).toLocaleDateString("es-PY") : "",
        clienteNombre,
        clienteRuc,
        clienteDireccion,
        subtotal: `Gs. ${base.toLocaleString("es-PY")}`,
        ivaMonto: `Gs. ${iva.toLocaleString("es-PY")}`,
        total: `Gs. ${totalNum.toLocaleString("es-PY")}`,
        cdc: factura.sifenCdc || "",
        lineItems: JSON.stringify(lineItemsData),
        empresaNombre: "AUTOMOTIVEOS",
        empresaRuc: "RUC: 800XXXX-X",
        empresaDireccion: "Coronel Oviedo, Paraguay",
        empresaTelefono: "Tel: +595 21 123 4567",
      };

      const validation = validateLabelData("FACTURA", labelData);
      if (!validation.valid) {
        return reply.status(400).send({ error: "Datos incompletos", details: validation.errors });
      }

      const payload = generateLabelPayload("FACTURA", protocolo, labelData);
      return reply.send({
        payload: payload.raw,
        protocol: payload.protocol,
        estimatedWidthMm: payload.estimatedWidthMm,
        estimatedHeightMm: payload.estimatedHeightMm,
        copias,
        factura: {
          id: factura.id,
          numero: labelData.numeroFactura,
          tipo: factura.tipo,
          total: totalNum,
          cliente: clienteNombre,
        },
      });
    },
  );

  // ════════════════════════════════════════════════
  // ── Invoice Config (Configurador de Facturas) ──
  // ════════════════════════════════════════════════

  // ── GET /label-printing/config — Get invoice print config for tenant ──
  app.get(
    "/label-printing/config",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = request.tenantSlug;
      const [config] = await db()
        .select()
        .from(invoiceConfig)
        .where(eq(invoiceConfig.tenantSlug, tenant))
        .limit(1);

      if (!config) {
        // Return defaults if no config exists
        return reply.send({
          paperWidthMm: 80,
          paperHeightMm: 200,
          printerProtocol: "ESCPOS",
          printerAddress: null,
          printerDpi: 203,
          showCompanyHeader: true,
          showClientInfo: true,
          showLineItems: true,
          showSubtotal: true,
          showIva: true,
          showBarcode: true,
          showQRCode: true,
          showFooter: true,
          showTimbrado: true,
          showIvaPerLine: false,
          showConservation: false,
          companyNombre: null,
          companyRuc: null,
          companyDireccion: null,
          companyTelefono: null,
          companyActividad: null,
        });
      }

      return reply.send(config);
    },
  );

  // ── PUT /label-printing/config — Update invoice print config ──
  app.put(
    "/label-printing/config",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = request.tenantSlug;
      const body = request.body as Record<string, unknown>;

      const [existing] = await db()
        .select()
        .from(invoiceConfig)
        .where(eq(invoiceConfig.tenantSlug, tenant))
        .limit(1);

      const configFields = {
        paperWidthMm: (body.paperWidthMm as number) ?? existing?.paperWidthMm ?? 80,
        paperHeightMm: (body.paperHeightMm as number) ?? existing?.paperHeightMm ?? 200,
        printerProtocol: (body.printerProtocol as string) ?? existing?.printerProtocol ?? "ESCPOS",
        printerAddress: (body.printerAddress as string) ?? existing?.printerAddress ?? null,
        printerDpi: (body.printerDpi as number) ?? existing?.printerDpi ?? 203,
        showCompanyHeader: (body.showCompanyHeader as boolean) ?? existing?.showCompanyHeader ?? true,
        showClientInfo: (body.showClientInfo as boolean) ?? existing?.showClientInfo ?? true,
        showLineItems: (body.showLineItems as boolean) ?? existing?.showLineItems ?? true,
        showSubtotal: (body.showSubtotal as boolean) ?? existing?.showSubtotal ?? true,
        showIva: (body.showIva as boolean) ?? existing?.showIva ?? true,
        showBarcode: (body.showBarcode as boolean) ?? existing?.showBarcode ?? true,
        showQRCode: (body.showQRCode as boolean) ?? existing?.showQRCode ?? true,
        showFooter: (body.showFooter as boolean) ?? existing?.showFooter ?? true,
        showTimbrado: (body.showTimbrado as boolean) ?? existing?.showTimbrado ?? true,
        showIvaPerLine: (body.showIvaPerLine as boolean) ?? existing?.showIvaPerLine ?? false,
        showConservation: (body.showConservation as boolean) ?? existing?.showConservation ?? false,
        companyNombre: (body.companyNombre as string) ?? existing?.companyNombre ?? null,
        companyRuc: (body.companyRuc as string) ?? existing?.companyRuc ?? null,
        companyDireccion: (body.companyDireccion as string) ?? existing?.companyDireccion ?? null,
        companyTelefono: (body.companyTelefono as string) ?? existing?.companyTelefono ?? null,
        companyActividad: (body.companyActividad as string) ?? existing?.companyActividad ?? null,
        // SET compliance
        timbradoNumero: (body.timbradoNumero as string) ?? existing?.timbradoNumero ?? null,
        timbradoVigenciaInicio: (body.timbradoVigenciaInicio as string) ?? existing?.timbradoVigenciaInicio ?? null,
        timbradoVigenciaFin: (body.timbradoVigenciaFin as string) ?? existing?.timbradoVigenciaFin ?? null,
        condicionVentaDefault: (body.condicionVentaDefault as string) ?? existing?.condicionVentaDefault ?? "CONTADO",
        showCondicionVenta: (body.showCondicionVenta as boolean) ?? existing?.showCondicionVenta ?? true,
        showContribuyenteIva: (body.showContribuyenteIva as boolean) ?? existing?.showContribuyenteIva ?? true,
        showTipoCambio: (body.showTipoCambio as boolean) ?? existing?.showTipoCambio ?? false,
        seriePrefix: (body.seriePrefix as string) ?? existing?.seriePrefix ?? "001",
        // HP LaserJet P1150
        printerModel: (body.printerModel as string) ?? existing?.printerModel ?? "generic",
        cupsPrinterName: (body.cupsPrinterName as string) ?? existing?.cupsPrinterName ?? null,
        paperTray: (body.paperTray as string) ?? existing?.paperTray ?? "Auto",
        updatedAt: new Date(),
      };

      if (existing) {
        await db()
          .update(invoiceConfig)
          .set(configFields)
          .where(eq(invoiceConfig.tenantSlug, tenant));
      } else {
        await db().insert(invoiceConfig).values({
          tenantSlug: tenant,
          ...configFields,
        });
      }

      return reply.send({ success: true, message: "Configuración actualizada" });
    },
  );

  // ── POST /label-printing/config/preview — Preview invoice with config ──
  app.post(
    "/label-printing/config/preview",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { data?: LabelData; config?: InvoiceConfig };
      const tenant = request.tenantSlug;

      // Get tenant config if not provided
      let config = body.config;
      if (!config) {
        const [saved] = await db()
          .select()
          .from(invoiceConfig)
          .where(eq(invoiceConfig.tenantSlug, tenant))
          .limit(1);
        config = saved ? {
          paperWidthMm: saved.paperWidthMm,
          paperHeightMm: saved.paperHeightMm,
          showCompanyHeader: saved.showCompanyHeader,
          showClientInfo: saved.showClientInfo,
          showLineItems: saved.showLineItems,
          showSubtotal: saved.showSubtotal,
          showIva: saved.showIva,
          showBarcode: saved.showBarcode,
          showQRCode: saved.showQRCode,
          showFooter: saved.showFooter,
          showTimbrado: saved.showTimbrado,
          showIvaPerLine: saved.showIvaPerLine,
          showConservation: saved.showConservation,
          companyNombre: saved.companyNombre ?? undefined,
          companyRuc: saved.companyRuc ?? undefined,
          companyDireccion: saved.companyDireccion ?? undefined,
          companyTelefono: saved.companyTelefono ?? undefined,
          companyActividad: saved.companyActividad ?? undefined,
          printerProtocol: saved.printerProtocol,
          printerAddress: saved.printerAddress ?? undefined,
          // SET compliance
          timbradoNumero: saved.timbradoNumero ?? undefined,
          timbradoVigenciaInicio: saved.timbradoVigenciaInicio ?? undefined,
          timbradoVigenciaFin: saved.timbradoVigenciaFin ?? undefined,
          condicionVentaDefault: saved.condicionVentaDefault ?? "CONTADO",
          showCondicionVenta: saved.showCondicionVenta,
          showContribuyenteIva: saved.showContribuyenteIva,
          showTipoCambio: saved.showTipoCambio,
          seriePrefix: saved.seriePrefix ?? "001",
          // HP LaserJet P1150
          printerModel: saved.printerModel ?? "generic",
          cupsPrinterName: saved.cupsPrinterName ?? undefined,
          paperTray: saved.paperTray ?? "Auto",
        } : {};
      }

      const sampleData: LabelData = body.data || {
        empresaNombre: config?.companyNombre || "AUTOMOTIVEOS",
        empresaRuc: config?.companyRuc || "800XXXX-X",
        empresaDireccion: config?.companyDireccion || "Coronel Oviedo, Paraguay",
        empresaTelefono: config?.companyTelefono || "+595 21 123 4567",
        empresaActividad: config?.companyActividad || "Servicios de reparación vehicular",
        numeroFactura: "001-001-0001234",
        tipoFactura: "MANUAL",
        fechaEmision: new Date().toLocaleDateString("es-PY"),
        timbrado: "12345678",
        clienteNombre: "Juan Pérez",
        clienteRuc: "1234567-8",
        clienteDireccion: "Av. principal 123",
        subtotal: "Gs. 909.091",
        ivaMonto: "Gs. 90.909",
        total: "Gs. 1.000.000",
        lineItems: JSON.stringify([
          { desc: "Cambio de aceite", cant: 2, precio: 450000, total: 900000 },
          { desc: "Filtro de aceite", cant: 1, precio: 150000, total: 150000 },
        ]),
      };

      const protocolo = config?.printerProtocol || "ESCPOS";
      const isPdf = protocolo === "PDF" || protocolo === "PCL";

      if (isPdf) {
        const html = generateFacturaPDF(sampleData, config as InvoiceConfig);
        return reply.send({ html, type: "pdf", widthMm: config?.paperWidthMm || 80 });
      }

      // ESC/POS preview
      const payload = generateLabelPayload("FACTURA", protocolo, sampleData, undefined, config as InvoiceConfig);
      return reply.send({
        payload: payload.raw,
        type: "escpos",
        protocol: payload.protocol,
        widthMm: payload.estimatedWidthMm,
      });
    },
  );

  // ════════════════════════════════════════════════
  // ── Reimpresión de Facturas ─────────────────────
  // ════════════════════════════════════════════════

  // ── GET /label-printing/reimpresiones — List invoices for reprint ──
  app.get(
    "/label-printing/reimpresiones",
    async (request: FastifyRequest<{ Querystring: {
      search?: string;
      tipo?: string;
      desde?: string;
      hasta?: string;
      page?: string;
      limit?: string;
    } }>, reply: FastifyReply) => {
      const tenant = request.tenantSlug;
      const { search, tipo, desde, hasta } = request.query;
      const pageNum = Math.max(1, parseInt(request.query.page || "1"));
      const pageSize = Math.min(50, Math.max(1, parseInt(request.query.limit || "20")));
      const offset = (pageNum - 1) * pageSize;

      // Build where conditions
      const conditions = [eq(facturas.tenantSlug, tenant)];

      if (tipo && tipo !== "Todos") {
        conditions.push(eq(facturas.tipo, tipo as "MANUAL" | "ELECTRONICA"));
      }
      if (desde) {
        conditions.push(gte(facturas.createdAt, new Date(desde)));
      }
      if (hasta) {
        conditions.push(lte(facturas.createdAt, new Date(hasta)));
      }
      if (search) {
        conditions.push(
          or(
            like(facturas.numeroFacturaManual, `%${search}%`),
            like(facturas.id, `%${search}%`),
          )!,
        );
      }

      // Get total count
      const [countResult] = await db()
        .select({ count: sql<number>`count(*)::int` })
        .from(facturas)
        .where(and(...conditions));

      // Get facturas with client info via OT join
      const results = await db()
        .select({
          id: facturas.id,
          numeroFactura: facturas.numeroFacturaManual,
          tipo: facturas.tipo,
          total: facturas.total,
          estado: facturas.estadoPago,
          createdAt: facturas.createdAt,
          ordenId: facturas.ordenId,
        })
        .from(facturas)
        .where(and(...conditions))
        .orderBy(desc(facturas.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Enrich with client names and print job counts
      const enriched = await Promise.all(
        results.map(async (f) => {
          let clienteNombre = "";
          if (f.ordenId) {
            const [ot] = await db()
              .select({ clientId: ordenesTrabajo.clientId })
              .from(ordenesTrabajo)
              .where(eq(ordenesTrabajo.id, f.ordenId))
              .limit(1);
            if (ot?.clientId) {
              const [client] = await db()
                .select({ name: clients.name })
                .from(clients)
                .where(eq(clients.id, ot.clientId))
                .limit(1);
              clienteNombre = client?.name || "";
            }
          }

          // Count print jobs for this invoice
          const [jobCount] = await db()
            .select({ count: sql<number>`count(*)::int` })
            .from(printJobs)
            .where(
              and(
                eq(printJobs.entityType, "FACTURA"),
                eq(printJobs.entityId, f.id),
              ),
            );

          return {
            id: f.id,
            numero: f.numeroFactura || f.id.slice(0, 12),
            cliente: clienteNombre,
            tipo: f.tipo,
            total: Number(f.total || 0),
            estado: f.estado,
            fechaEmision: f.createdAt ? new Date(f.createdAt).toLocaleDateString("es-PY") : "",
            printCount: jobCount?.count || 0,
          };
        }),
      );

      return reply.send({
        data: enriched,
        pagination: {
          page: pageNum,
          pageSize,
          total: countResult?.count || 0,
          pages: Math.ceil((countResult?.count || 0) / pageSize),
        },
      });
    },
  );

  // ── GET /label-printing/reimpresiones/:id — Print history for invoice ──
  app.get(
    "/label-printing/reimpresiones/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const jobs = await db()
        .select()
        .from(printJobs)
        .where(
          and(
            eq(printJobs.entityType, "FACTURA"),
            eq(printJobs.entityId, id),
          ),
        )
        .orderBy(desc(printJobs.createdAt));

      return reply.send({
        facturaId: id,
        printHistory: jobs.map((j) => ({
          id: j.id,
          protocolo: j.protocolo,
          impresora: j.impresora,
          copias: j.copias,
          estado: j.estado,
          error: j.error,
          createdAt: j.createdAt,
        })),
      });
    },
  );

  // ── POST /label-printing/reimpresiones/:id — Re-generate print payload ──
  app.post(
    "/label-printing/reimpresiones/:id",
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
            protocolo: { type: "string", enum: ["ESCPOS", "ZPL", "TSPL", "PDF", "PCL"] },
            copias: { type: "integer", minimum: 1, maximum: 99 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { protocolo?: string; copias?: number } }>, reply: FastifyReply) => {
      const tenant = request.tenantSlug;
      const { id } = request.params;
      const { protocolo: reqProtocolo, copias: reqCopias } = request.body || {};

      // Fetch factura
      const [factura] = await db()
        .select()
        .from(facturas)
        .where(and(eq(facturas.id, id), eq(facturas.tenantSlug, tenant)))
        .limit(1);

      if (!factura) {
        return reply.status(404).send({ error: "Factura no encontrada" });
      }

      // Fetch config
      const [config] = await db()
        .select()
        .from(invoiceConfig)
        .where(eq(invoiceConfig.tenantSlug, tenant))
        .limit(1);

      const protocolo = reqProtocolo || config?.printerProtocol || "ESCPOS";
      const copias = reqCopias || 1;

      // Fetch line items
      const items = await db()
        .select()
        .from(facturaDetalles)
        .where(eq(facturaDetalles.facturaId, id))
        .orderBy(facturaDetalles.numeroLinea);

      // Fetch client from OT
      let clienteNombre = "";
      let clienteRuc = "";
      let clienteDireccion = "";
      if (factura.ordenId) {
        const [ot] = await db()
          .select({ clientId: ordenesTrabajo.clientId })
          .from(ordenesTrabajo)
          .where(eq(ordenesTrabajo.id, factura.ordenId))
          .limit(1);
        if (ot?.clientId) {
          const [client] = await db()
            .select()
            .from(clients)
            .where(eq(clients.id, ot.clientId))
            .limit(1);
          if (client) {
            clienteNombre = client.name || "";
            clienteRuc = (client as any).ruc || "";
            clienteDireccion = (client as any).direccion || "";
          }
        }
      }

      const lineItemsData = items.map((it) => ({
        desc: it.descripcion || "",
        cant: Number(it.cantidad ?? 1),
        precio: Number(it.precioUnitario ?? 0),
        total: Number(it.subtotal ?? 0),
      }));

      const totalNum = Number(factura.total ?? 0);
      const ivaRate = 0.10;
      const base = Math.round(totalNum / (1 + ivaRate));
      const iva = totalNum - base;

      const labelData: LabelData = {
        numeroFactura: factura.numeroFacturaManual || factura.id.slice(0, 12),
        tipoFactura: factura.tipo,
        fechaEmision: factura.createdAt ? new Date(factura.createdAt).toLocaleDateString("es-PY") : "",
        clienteNombre,
        clienteRuc,
        clienteDireccion,
        subtotal: `Gs. ${base.toLocaleString("es-PY")}`,
        ivaMonto: `Gs. ${iva.toLocaleString("es-PY")}`,
        total: `Gs. ${totalNum.toLocaleString("es-PY")}`,
        cdc: factura.sifenCdc || "",
        lineItems: JSON.stringify(lineItemsData),
        empresaNombre: config?.companyNombre || "AUTOMOTIVEOS",
        empresaRuc: config?.companyRuc || "800XXXX-X",
        empresaDireccion: config?.companyDireccion || "Coronel Oviedo, Paraguay",
        empresaTelefono: config?.companyTelefono || "Tel: +595 21 123 4567",
      };

      const invoiceCfg: InvoiceConfig = config ? {
        paperWidthMm: config.paperWidthMm,
        paperHeightMm: config.paperHeightMm,
        showCompanyHeader: config.showCompanyHeader,
        showClientInfo: config.showClientInfo,
        showLineItems: config.showLineItems,
        showSubtotal: config.showSubtotal,
        showIva: config.showIva,
        showBarcode: config.showBarcode,
        showQRCode: config.showQRCode,
        showFooter: config.showFooter,
        showTimbrado: config.showTimbrado,
        showIvaPerLine: config.showIvaPerLine,
        showConservation: config.showConservation,
        companyNombre: config.companyNombre ?? undefined,
        companyRuc: config.companyRuc ?? undefined,
        companyDireccion: config.companyDireccion ?? undefined,
        companyTelefono: config.companyTelefono ?? undefined,
        companyActividad: config.companyActividad ?? undefined,
        printerProtocol: config.printerProtocol,
        printerAddress: config.printerAddress ?? undefined,
        // SET compliance
        timbradoNumero: config.timbradoNumero ?? undefined,
        timbradoVigenciaInicio: config.timbradoVigenciaInicio ?? undefined,
        timbradoVigenciaFin: config.timbradoVigenciaFin ?? undefined,
        condicionVentaDefault: config.condicionVentaDefault ?? "CONTADO",
        showCondicionVenta: config.showCondicionVenta,
        showContribuyenteIva: config.showContribuyenteIva,
        showTipoCambio: config.showTipoCambio,
        seriePrefix: config.seriePrefix ?? "001",
        // HP LaserJet P1150
        printerModel: config.printerModel ?? "generic",
        cupsPrinterName: config.cupsPrinterName ?? undefined,
        paperTray: config.paperTray ?? "Auto",
      } : {};

      const payload = generateLabelPayload("FACTURA", protocolo, labelData, undefined, invoiceCfg);

      // Log to print_jobs
      await db().insert(printJobs).values({
        entityType: "FACTURA",
        entityId: id,
        copias,
        impresora: config?.printerAddress || "default",
        protocolo: protocolo as any,
        payload: payload.raw.substring(0, 10000), // Truncate for DB storage
        estado: "COMPLETADO",
        tenantSlug: tenant,
      });

      return reply.send({
        payload: payload.raw,
        protocol: payload.protocol,
        estimatedWidthMm: payload.estimatedWidthMm,
        estimatedHeightMm: payload.estimatedHeightMm,
        copias,
        factura: {
          id: factura.id,
          numero: labelData.numeroFactura,
          tipo: factura.tipo,
          total: totalNum,
          cliente: clienteNombre,
        },
      });
    },
  );
}

/**
 * Generate an HTML preview of a label for screen display.
 */
function generateHtmlPreview(tipo: string, data: LabelData, widthMm: number, heightMm: number): string {
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
