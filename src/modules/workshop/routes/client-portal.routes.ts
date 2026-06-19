/**
 * Client Portal Routes — Public view for client's vehicles and invoices.
 *
 * GET /portal/client/:clientId/vehicles   — List client's vehicles
 * GET /portal/client/:clientId/invoices   — List client's invoices
 * GET /portal/client/:clientId/ordenes    — List client's work orders
 * GET /portal/client/:clientId/summary    — Client summary (vehicles + recent orders)
 *
 * These routes are PUBLIC (no auth required) but require the clientId
 * to be valid. Data is tenant-scoped via X-Tenant-Slug header.
 *
 * Use cases:
 *   - QR code on invoice → client scans → sees their vehicle history
 *   - Client portal page → enter RUC/phone → see all their data
 *   - Shared links for specific invoices or work orders
 *
 * @module workshop/routes/client-portal
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { eq, and, desc } from "drizzle-orm";
import { vehiculos } from "../schema/vehiculos.js";
import { ordenesTrabajo } from "../schema/ordenes-trabajo.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { facturas } from "../../finance/schema/index.js";

// ─── Types ──────────────────────────────────────

interface ClientParams {
  clientId: string;
}

// ─── Routes ─────────────────────────────────────

export async function clientPortalRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /portal/client/:clientId/summary — Client summary ──
  app.get<{ Params: ClientParams }>(
    "/portal/client/:clientId/summary",
    async (request: FastifyRequest<{ Params: ClientParams }>, reply: FastifyReply) => {
      const { clientId } = request.params;
      const tenantSlug = (request as any).tenantSlug as string;

      // Get client info
      const [client] = await db()
        .select({
          id: clients.id,
          name: clients.name,
          email: clients.email,
          phone: clients.phone,
          ruc: clients.ruc,
        })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.tenantSlug, tenantSlug)))
        .limit(1);

      if (!client) {
        return reply.status(404).send({ error: "Cliente no encontrado" });
      }

      // Get vehicle count
      const [vehicleCount] = await db()
        .select({ count: vehiculos.id })
        .from(vehiculos)
        .where(eq(vehiculos.clientId, clientId));

      // Get recent work orders
      const recentOrdenes = await db()
        .select({
          id: ordenesTrabajo.id,
          status: ordenesTrabajo.status,
          description: ordenesTrabajo.description,
          createdAt: ordenesTrabajo.createdAt,
          totalCost: ordenesTrabajo.totalCost,
        })
        .from(ordenesTrabajo)
        .where(eq(ordenesTrabajo.clientId, clientId))
        .orderBy(desc(ordenesTrabajo.createdAt))
        .limit(5);

      // Get invoice count via work orders (facturas.ordenId → ordenesTrabajo.clientId)
      const ordenIds = recentOrdenes.map(o => o.id);
      let invoiceCount = 0;
      let invoiceTotal = 0;
      if (ordenIds.length > 0) {
        const invoices = await db()
          .select({
            id: facturas.id,
            total: facturas.total,
          })
          .from(facturas)
          .where(and(
            eq(facturas.tenantSlug, tenantSlug),
            // Use raw SQL for IN clause since drizzle's inArray needs special handling
          ));
        // Filter by ordenIds in JS for simplicity
        const filteredInvoices = invoices.filter(inv => ordenIds.some(oid => inv.id && oid));
        invoiceCount = filteredInvoices.length;
        invoiceTotal = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      }

      return reply.send({
        client,
        vehicles: { count: vehicleCount?.count || 0 },
        recentOrdenes,
        invoices: {
          count: invoiceCount,
          total: invoiceTotal,
        },
      });
    },
  );

  // ── GET /portal/client/:clientId/vehicles — Client's vehicles ──
  app.get<{ Params: ClientParams }>(
    "/portal/client/:clientId/vehicles",
    async (request: FastifyRequest<{ Params: ClientParams }>, reply: FastifyReply) => {
      const { clientId } = request.params;
      const tenantSlug = (request as any).tenantSlug as string;

      const vehicles = await db()
        .select({
          id: vehiculos.id,
          plate: vehiculos.plate,
          vin: vehiculos.vin,
          brand: vehiculos.brand,
          model: vehiculos.model,
          year: vehiculos.year,
          engineType: vehiculos.engineType,
          kilometraje: vehiculos.kilometraje,
        })
        .from(vehiculos)
        .where(and(eq(vehiculos.clientId, clientId), eq(vehiculos.tenantSlug, tenantSlug)))
        .orderBy(desc(vehiculos.createdAt));

      return reply.send({ vehicles, total: vehicles.length });
    },
  );

  // ── GET /portal/client/:clientId/ordenes — Client's work orders ──
  app.get<{ Params: ClientParams }>(
    "/portal/client/:clientId/ordenes",
    async (request: FastifyRequest<{ Params: ClientParams }>, reply: FastifyReply) => {
      const { clientId } = request.params;

      const ordenes = await db()
        .select({
          id: ordenesTrabajo.id,
          status: ordenesTrabajo.status,
          description: ordenesTrabajo.description,
          diagnosis: ordenesTrabajo.diagnosis,
          totalCost: ordenesTrabajo.totalCost,
          createdAt: ordenesTrabajo.createdAt,
          updatedAt: ordenesTrabajo.updatedAt,
          plate: vehiculos.plate,
          brand: vehiculos.brand,
          model: vehiculos.model,
        })
        .from(ordenesTrabajo)
        .leftJoin(vehiculos, eq(ordenesTrabajo.vehicleId, vehiculos.id))
        .where(eq(ordenesTrabajo.clientId, clientId))
        .orderBy(desc(ordenesTrabajo.createdAt));

      return reply.send({ ordenes, total: ordenes.length });
    },
  );

  // ── GET /portal/client/:clientId/invoices — Client's invoices ──
  app.get<{ Params: ClientParams }>(
    "/portal/client/:clientId/invoices",
    async (request: FastifyRequest<{ Params: ClientParams }>, reply: FastifyReply) => {
      const { clientId } = request.params;
      const tenantSlug = (request as any).tenantSlug as string;

      // Get client's work order IDs first
      const clientOrdenes = await db()
        .select({ id: ordenesTrabajo.id })
        .from(ordenesTrabajo)
        .where(eq(ordenesTrabajo.clientId, clientId));

      const ordenIds = clientOrdenes.map(o => o.id);

      let invoices: any[] = [];
      if (ordenIds.length > 0) {
        // Query facturas by ordenId (facturas are linked to work orders, not directly to clients)
        invoices = await db()
          .select({
            id: facturas.id,
            tipo: facturas.tipo,
            numeroFacturaManual: facturas.numeroFacturaManual,
            total: facturas.total,
            estadoPago: facturas.estadoPago,
            saldoPendiente: facturas.saldoPendiente,
            sifenStatus: facturas.sifenStatus,
            createdAt: facturas.createdAt,
            ordenId: facturas.ordenId,
          })
          .from(facturas)
          .where(eq(facturas.tenantSlug, tenantSlug))
          .orderBy(desc(facturas.createdAt));

        // Filter by client's ordenIds
        invoices = invoices.filter(inv => ordenIds.includes(inv.ordenId));
      }

      return reply.send({ invoices, total: invoices.length });
    },
  );
}
