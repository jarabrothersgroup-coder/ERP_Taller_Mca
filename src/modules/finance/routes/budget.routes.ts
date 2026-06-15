/**
 * Budget Routes — Presupuestos + Control de Gestión (Sprint 11).
 *
 * Endpoints:
 *   GET    /finance/presupuestos                   — Listar presupuestos
 *   POST   /finance/presupuestos                   — Crear presupuesto
 *   GET    /finance/presupuestos/:id               — Obtener presupuesto + ítems
 *   PUT    /finance/presupuestos/:id               — Actualizar presupuesto
 *   DELETE /finance/presupuestos/:id               — Eliminar presupuesto
 *   POST   /finance/presupuestos/:id/items         — Agregar ítem
 *   PUT    /finance/presupuestos/items/:itemId     — Actualizar ítem
 *   DELETE /finance/presupuestos/items/:itemId     — Eliminar ítem
 *   GET    /finance/presupuestos/:id/comparativa   — Comparativa real vs presupuestado
 *   POST   /finance/presupuestos/:id/refresh       — Recalcular montos reales
 *   GET    /finance/presupuestos/alertas           — Todas las alertas de desvío
 *
 * @module finance/routes/budget.routes
 */

import type { FastifyInstance } from "fastify";

import {
  listPresupuestos,
  getPresupuesto,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
  addPresupuestoItem,
  updatePresupuestoItem,
  deletePresupuestoItem,
  getComparativa,
  refreshMontoReal,
  getAllAlertas,
} from "../services/budget/budget.service.js";

export async function budgetRoutes(app: FastifyInstance): Promise<void> {
  // ─── Listar presupuestos ────────────────────────
  app.get("/finance/presupuestos", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { periodo, estado } = request.query as {
      periodo?: string;
      estado?: string;
    };

    const presupuestos = await listPresupuestos(tenantSlug, {
      periodo,
      estado,
    });
    return reply.send(presupuestos);
  });

  // ─── Crear presupuesto ──────────────────────────
  app.post("/finance/presupuestos", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const body = request.body as { periodo: string; descripcion?: string };

    const presupuesto = await createPresupuesto(tenantSlug, body);
    return reply.status(201).send(presupuesto);
  });

  // ─── Obtener presupuesto + ítems ────────────────
  app.get("/finance/presupuestos/:id", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { id } = request.params as { id: string };

    const result = await getPresupuesto(id, tenantSlug);
    return reply.send(result);
  });

  // ─── Actualizar presupuesto ─────────────────────
  app.put("/finance/presupuestos/:id", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { id } = request.params as { id: string };
    const body = request.body as {
      descripcion?: string;
      estado?: "borrador" | "aprobado" | "cerrado";
    };

    const updated = await updatePresupuesto(id, tenantSlug, body);
    return reply.send(updated);
  });

  // ─── Eliminar presupuesto ───────────────────────
  app.delete("/finance/presupuestos/:id", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { id } = request.params as { id: string };

    await deletePresupuesto(id, tenantSlug);
    return reply.status(204).send();
  });

  // ─── Agregar ítem ───────────────────────────────
  app.post("/finance/presupuestos/:id/items", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { id } = request.params as { id: string };
    const body = request.body as {
      centroCostoId: string;
      categoria: string;
      montoPresupuestado: number;
      notas?: string;
    };

    const item = await addPresupuestoItem(id, tenantSlug, body);
    return reply.status(201).send(item);
  });

  // ─── Actualizar ítem ────────────────────────────
  app.put("/finance/presupuestos/items/:itemId", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { itemId } = request.params as { itemId: string };
    const body = request.body as {
      montoPresupuestado?: number;
      notas?: string;
    };

    const updated = await updatePresupuestoItem(itemId, tenantSlug, body);
    return reply.send(updated);
  });

  // ─── Eliminar ítem ──────────────────────────────
  app.delete("/finance/presupuestos/items/:itemId", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { itemId } = request.params as { itemId: string };

    await deletePresupuestoItem(itemId, tenantSlug);
    return reply.status(204).send();
  });

  // ─── Comparativa real vs presupuestado ──────────
  app.get("/finance/presupuestos/:id/comparativa", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { id } = request.params as { id: string };

    const comparativa = await getComparativa(id, tenantSlug);
    return reply.send(comparativa);
  });

  // ─── Recalcular montos reales ───────────────────
  app.post("/finance/presupuestos/:id/refresh", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { id } = request.params as { id: string };

    await refreshMontoReal(id, tenantSlug);
    return reply.send({ ok: true, message: "Montos reales actualizados" });
  });

  // ─── Todas las alertas de desvío ────────────────
  app.get("/finance/presupuestos/alertas", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;

    const alertas = await getAllAlertas(tenantSlug);
    return reply.send(alertas);
  });
}
