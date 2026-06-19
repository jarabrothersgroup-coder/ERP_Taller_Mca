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
  generatePdf,
  generateOtPdf,
  generateInvoicePdf,
  vehicleHistoryTemplate,
  clientStatementTemplate,
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
        const { facturas, facturaDetalles } = await import("../../modules/finance/schema/index.js");
        const { ordenesTrabajo } = await import("../../modules/workshop/schema/ordenes-trabajo.js");
        const { clients: clientsTable } = await import("../../shared/database/schema/clients.js");
        const { eq } = await import("drizzle-orm");

        // Fetch factura
        const [factura] = await db().select().from(facturas)
          .where(eq(facturas.id, id))
          .limit(1);

        if (!factura) {
          return reply.status(404).send({ error: "Factura no encontrada" });
        }

        // Fetch line items
        const items = await db().select().from(facturaDetalles)
          .where(eq(facturaDetalles.facturaId, id));

        // Fetch OT to get client
        let cliente = null;
        if (factura.ordenId) {
          const [ot] = await db().select().from(ordenesTrabajo)
            .where(eq(ordenesTrabajo.id, factura.ordenId))
            .limit(1);
          if (ot?.clientId) {
            const [c] = await db().select().from(clientsTable)
              .where(eq(clientsTable.id, ot.clientId))
              .limit(1);
            cliente = c;
          }
        }

        const pdf = await generateInvoicePdf(factura, items, cliente);

        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="Factura-${factura.numeroFacturaManual || id.slice(0, 8)}.pdf"`)
          .send(pdf);
      } catch (err: any) {
        app.log.error({ err }, "PDF generation failed");
        return reply.status(500).send({ error: "Error generando PDF", message: err.message });
      }
    },
  );

  // ── GET /reports/vehicle-history/:vehicleId — Vehicle History Report ──
  app.get<{ Params: { vehicleId: string } }>(
    "/reports/vehicle-history/:vehicleId",
    {
      schema: {
        params: {
          type: "object",
          required: ["vehicleId"],
          properties: { vehicleId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { vehicleId: string } }>, reply: FastifyReply) => {
      if (!isPdfAvailable()) {
        return reply.status(503).send({
          error: "PDF engine not available",
          message: "Install chromium-browser for PDF generation",
        });
      }

      const { vehicleId } = request.params;

      try {
        const { db } = await import("../database/drizzle.js");
        const { vehiculos } = await import("../../modules/workshop/schema/vehiculos.js");
        const { ordenesTrabajo } = await import("../../modules/workshop/schema/ordenes-trabajo.js");
        const { clients: clientsTable } = await import("../../shared/database/schema/clients.js");
        const { facturas } = await import("../../modules/finance/schema/index.js");
        const { eq, desc } = await import("drizzle-orm");

        // Fetch vehicle
        const [vehiculo] = await db().select().from(vehiculos)
          .where(eq(vehiculos.id, vehicleId))
          .limit(1);

        if (!vehiculo) {
          return reply.status(404).send({ error: "Vehículo no encontrado" });
        }

        // Fetch client
        let cliente = null;
        if (vehiculo.clientId) {
          const [c] = await db().select().from(clientsTable)
            .where(eq(clientsTable.id, vehiculo.clientId))
            .limit(1);
          cliente = c;
        }

        // Fetch all OTs for this vehicle
        const ots = await db().select().from(ordenesTrabajo)
          .where(eq(ordenesTrabajo.vehicleId, vehicleId))
          .orderBy(desc(ordenesTrabajo.createdAt));

        // Fetch invoices for each OT
        const invoices = [];
        for (const ot of ots) {
          const [factura] = await db().select().from(facturas)
            .where(eq(facturas.ordenId, ot.id))
            .limit(1);
          if (factura) invoices.push(factura);
        }

        const html = vehicleHistoryTemplate(vehiculo, cliente, ots, invoices);
        const pdf = await generatePdf(html);

        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="Historial-${vehiculo.plate || vehicleId.slice(0, 8)}.pdf"`)
          .send(pdf);
      } catch (err: any) {
        app.log.error({ err }, "PDF generation failed");
        return reply.status(500).send({ error: "Error generando PDF", message: err.message });
      }
    },
  );

  // ── GET /reports/client-statement/:clientId — Client Statement Report ──
  app.get<{ Params: { clientId: string } }>(
    "/reports/client-statement/:clientId",
    {
      schema: {
        params: {
          type: "object",
          required: ["clientId"],
          properties: { clientId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { clientId: string } }>, reply: FastifyReply) => {
      if (!isPdfAvailable()) {
        return reply.status(503).send({
          error: "PDF engine not available",
          message: "Install chromium-browser for PDF generation",
        });
      }

      const { clientId } = request.params;

      try {
        const { db } = await import("../database/drizzle.js");
        const { clients: clientsTable } = await import("../../shared/database/schema/clients.js");
        const { vehiculos } = await import("../../modules/workshop/schema/vehiculos.js");
        const { ordenesTrabajo } = await import("../../modules/workshop/schema/ordenes-trabajo.js");
        const { facturas } = await import("../../modules/finance/schema/index.js");
        const { eq } = await import("drizzle-orm");

        // Fetch client
        const [cliente] = await db().select().from(clientsTable)
          .where(eq(clientsTable.id, clientId))
          .limit(1);

        if (!cliente) {
          return reply.status(404).send({ error: "Cliente no encontrado" });
        }

        // Fetch all vehicles for this client
        const clientVehicles = await db().select().from(vehiculos)
          .where(eq(vehiculos.clientId, clientId));

        // Fetch OTs for each vehicle
        const invoices = [];
        for (const v of clientVehicles) {
          const ots = await db().select().from(ordenesTrabajo)
            .where(eq(ordenesTrabajo.vehicleId, v.id));
          for (const ot of ots) {
            const [factura] = await db().select().from(facturas)
              .where(eq(facturas.ordenId, ot.id))
              .limit(1);
            if (factura) invoices.push(factura);
          }
        }

        const html = clientStatementTemplate(cliente, invoices);
        const pdf = await generatePdf(html);

        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="Estado-Cuenta-${cliente.name?.replace(/\s+/g, '-') || clientId.slice(0, 8)}.pdf"`)
          .send(pdf);
      } catch (err: any) {
        app.log.error({ err }, "PDF generation failed");
        return reply.status(500).send({ error: "Error generando PDF", message: err.message });
      }
    },
  );

  app.log.info("PDF report routes registered");
}
