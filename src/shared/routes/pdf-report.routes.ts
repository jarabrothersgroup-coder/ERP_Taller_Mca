/**
 * PDF Report Routes — Generate PDF reports.
 *
 *   GET /api/v1/reports/ot/:id    — OT PDF
 *   GET /api/v1/reports/factura/:id — Invoice PDF
 *   GET /api/v1/reports/health     — PDF engine status
 *
 * @module shared/routes/pdf-report.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  generateOtPdf,
  generateInvoicePdf,
  isPdfAvailable,
  getChromiumPath,
} from "../services/pdf-report.service.js";

/**
 * Register PDF report routes.
 */
export async function pdfReportRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /reports/health — PDF engine status ──
  app.get("/reports/health", async (_request: FastifyRequest, reply: FastifyReply) => {
    const available = isPdfAvailable();
    return reply.send({
      available,
      chromium: available ? getChromiumPath() : null,
      message: available
        ? "PDF engine ready (Chromium detected)"
        : "PDF engine unavailable — install chromium-browser",
    });
  });

  // ── GET /reports/ot/:id — OT PDF ──
  app.get<{ Params: { id: string } }>(
    "/reports/ot/:id",
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
      if (!isPdfAvailable()) {
        return reply.status(503).send({
          error: "PDF engine not available",
          message: "Install chromium-browser for PDF generation",
        });
      }

      const { id } = request.params;
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        // Fetch OT data (dynamic import to avoid circular deps)
        const { db } = await import("../database/drizzle.js");
        const { ordenesTrabajo } = await import("../../modules/workshop/schema/ordenes-trabajo.js");
        const { ordenServicios } = await import("../../modules/workshop/schema/orden-servicios.js");
        const { ordenRepuestos } = await import("../../modules/workshop/schema/orden-repuestos.js");
        const { clients: clientes } = await import("../../shared/database/schema/clients.js");
        const { vehiculos } = await import("../../modules/workshop/schema/vehiculos.js");
        const { eq, and } = await import("drizzle-orm");

        // Fetch OT
        const [ot] = await db().select().from(ordenesTrabajo)
          .where(and(eq(ordenesTrabajo.id, id), eq(ordenesTrabajo.tenantSlug, tenantSlug)))
          .limit(1);

        if (!ot) {
          return reply.status(404).send({ error: "OT no encontrada" });
        }

        // Fetch items
        const servicios = await db().select().from(ordenServicios)
          .where(eq(ordenServicios.ordenTrabajoId, id));
        const repuestos = await db().select().from(ordenRepuestos)
          .where(eq(ordenRepuestos.ordenTrabajoId, id));

        // Fetch client + vehicle
        const [cliente] = await db().select().from(clientes)
          .where(eq(clientes.id, ot.clientId))
          .limit(1);
        const [vehiculo] = await db().select().from(vehiculos)
          .where(eq(vehiculos.id, ot.vehicleId))
          .limit(1);

        // Build items with tipo
        const items = [
          ...servicios.map((s: any) => ({ ...s, tipo: "servicio" })),
          ...repuestos.map((r: any) => ({ ...r, tipo: "repuesto" })),
        ];

        const pdf = await generateOtPdf(ot, items, cliente, vehiculo);

        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="OT-${id.slice(0, 8)}.pdf"`)
          .send(pdf);
      } catch (err: any) {
        app.log.error({ err }, "PDF generation failed");
        return reply.status(500).send({ error: "Error generando PDF", message: err.message });
      }
    },
  );

  // ── GET /reports/factura/:id — Invoice PDF ──
  app.get<{ Params: { id: string } }>(
    "/reports/factura/:id",
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
      if (!isPdfAvailable()) {
        return reply.status(503).send({
          error: "PDF engine not available",
          message: "Install chromium-browser for PDF generation",
        });
      }

      const { id } = request.params;

      try {
        const { db } = await import("../database/drizzle.js");
        const { fiscalDocumentos, fiscalDocumentoDetalles } = await import("../../modules/finance/schema/fiscal-docs.js");
        const { clients: clientsTable } = await import("../../shared/database/schema/clients.js");
        const { eq } = await import("drizzle-orm");

        // Fetch factura (fiscal_documentos — schema-per-tenant isolation)
        const [factura] = await db().select().from(fiscalDocumentos)
          .where(eq(fiscalDocumentos.id, id))
          .limit(1);

        if (!factura) {
          return reply.status(404).send({ error: "Factura no encontrada" });
        }

        // Fetch line items
        const items = await db().select().from(fiscalDocumentoDetalles)
          .where(eq(fiscalDocumentoDetalles.documentoId, id));

        // Fetch client
        let cliente = null;
        if (factura.clienteId) {
          const [c] = await db().select().from(clientsTable)
            .where(eq(clientsTable.id, factura.clienteId))
            .limit(1);
          cliente = c;
        }

        const pdf = await generateInvoicePdf(factura, items, cliente);

        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="Factura-${factura.serie}-${factura.numero || id.slice(0, 8)}.pdf"`)
          .send(pdf);
      } catch (err: any) {
        app.log.error({ err }, "PDF generation failed");
        return reply.status(500).send({ error: "Error generando PDF", message: err.message });
      }
    },
  );

  app.log.info("PDF report routes registered");
}
