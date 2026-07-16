/**
 * Compras routes — Facturas de compra de proveedores.
 *
 * Endpoints:
 *   POST   /finance/compras            — Crear factura de compra (con detalles)
 *   GET    /finance/compras            — Listar (filtro estadoPago)
 *   GET    /finance/compras/:id        — Obtener con detalles
 *   PATCH  /finance/compras/:id        — Actualizar
 *   DELETE /finance/compras/:id        — Eliminar
 *
 * Todas requieren header `X-Tenant-Slug`.
 *
 * @module finance/routes/compras.routes
 */

import type { FastifyInstance } from "fastify";
import {
  createCompra,
  listCompras,
  getCompra,
  updateCompra,
  deleteCompra,
} from "../services/compras.service.js";

export async function comprasRoutes(app: FastifyInstance): Promise<void> {
  app.post("/finance/compras", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const body = request.body as Record<string, unknown>;
    if (!body.numeroFactura || !body.proveedorNombre || !Array.isArray(body.detalles)) {
      return reply
        .status(400)
        .send({ error: "numeroFactura, proveedorNombre y detalles son requeridos" });
    }

    const compra = await createCompra({
      tenantSlug,
      numeroFactura: body.numeroFactura as string,
      proveedorNombre: body.proveedorNombre as string,
      proveedorId: body.proveedorId as string | undefined,
      fecha: body.fecha as string | undefined,
      fechaVencimiento: body.fechaVencimiento as string | undefined,
      estadoPago: body.estadoPago as any,
      notas: body.notas as string | undefined,
      detalles: body.detalles as any[],
    });

    return reply.status(201).send(compra);
  });

  app.get("/finance/compras", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const q = request.query as Record<string, string>;
    const result = await listCompras(tenantSlug, {
      limit: q.limit ? parseInt(q.limit) : undefined,
      offset: q.offset ? parseInt(q.offset) : undefined,
      estadoPago: q.estadoPago,
    });

    return reply.send(result);
  });

  app.get("/finance/compras/:id", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { id } = request.params as { id: string };
    try {
      const compra = await getCompra(tenantSlug, id);
      return reply.send(compra);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  app.patch("/finance/compras/:id", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    try {
      const updated = await updateCompra(tenantSlug, id, body as any);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  app.delete("/finance/compras/:id", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { id } = request.params as { id: string };
    try {
      const result = await deleteCompra(tenantSlug, id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });
}
