/**
 * Donaciones routes — Registros de donaciones deducibles de IRE.
 *
 * Endpoints:
 *   POST   /finance/donaciones       — Crear donación
 *   GET    /finance/donaciones       — Listar
 *   GET    /finance/donaciones/:id   — Obtener
 *   PATCH  /finance/donaciones/:id   — Actualizar
 *   DELETE /finance/donaciones/:id   — Eliminar
 *
 * Todas requieren header `X-Tenant-Slug`.
 *
 * @module finance/routes/donaciones.routes
 */

import type { FastifyInstance } from "fastify";
import {
  createDonacion,
  listDonaciones,
  getDonacion,
  updateDonacion,
  deleteDonacion,
} from "../services/donaciones.service.js";

export async function donacionesRoutes(app: FastifyInstance): Promise<void> {
  app.post("/finance/donaciones", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const body = request.body as Record<string, unknown>;
    if (!body.beneficiario || body.monto === undefined) {
      return reply.status(400).send({ error: "beneficiario y monto son requeridos" });
    }

    const donacion = await createDonacion({
      tenantSlug,
      beneficiario: body.beneficiario as string,
      descripcion: body.descripcion as string | undefined,
      monto: body.monto as string | number,
      comprobante: body.comprobante as string | undefined,
      deducible: body.deducible as boolean | undefined,
      fecha: body.fecha as string | undefined,
    });

    return reply.status(201).send(donacion);
  });

  app.get("/finance/donaciones", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const q = request.query as Record<string, string>;
    const result = await listDonaciones(tenantSlug, {
      limit: q.limit ? parseInt(q.limit) : undefined,
      offset: q.offset ? parseInt(q.offset) : undefined,
    });

    return reply.send(result);
  });

  app.get("/finance/donaciones/:id", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { id } = request.params as { id: string };
    try {
      const donacion = await getDonacion(tenantSlug, id);
      return reply.send(donacion);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  app.patch("/finance/donaciones/:id", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    try {
      const updated = await updateDonacion(tenantSlug, id, body as any);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  app.delete("/finance/donaciones/:id", async (request, reply) => {
    const tenantSlug = request.headers["x-tenant-slug"] as string;
    if (!tenantSlug) {
      return reply.status(400).send({ error: "X-Tenant-Slug header required" });
    }

    const { id } = request.params as { id: string };
    try {
      const result = await deleteDonacion(tenantSlug, id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });
}
