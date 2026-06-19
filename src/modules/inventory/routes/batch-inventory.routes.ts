/**
 * Batch Inventory Routes — Bulk operations + analytics.
 *
 * Routes:
 *   POST /inventory/bulk/import          — CSV bulk import
 *   POST /inventory/bulk/price-update    — Bulk price update
 *   POST /inventory/bulk/stock-adjust    — Bulk stock adjustment
 *   GET  /inventory/analytics/turnover   — Inventory turnover
 *   GET  /inventory/analytics/dead-stock — Dead stock detection
 *   GET  /inventory/analytics/reorder    — Reorder predictions
 *
 * @module inventory/routes/batch-inventory.routes
 */

import type { FastifyInstance } from "fastify";
import {
  bulkImportRepuestos,
  bulkUpdatePrices,
  bulkAdjustStock,
  getInventoryTurnover,
  getDeadStock,
  getReorderPredictions,
} from "../services/batch-inventory.service.js";

export async function batchInventoryRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /inventory/bulk/import — CSV bulk import ──
  app.post("/inventory/bulk/import", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { rows } = request.body as { rows: Array<{
      codigo?: string;
      descripcion: string;
      marca?: string;
      categoria?: string;
      precioVenta?: number;
      precioCompra?: number;
      stockActual?: number;
      puntoReorden?: number;
      ubicacion?: string;
    }> };

    if (!rows || !Array.isArray(rows) || !rows.length) {
      return reply.status(400).send({ error: "rows array is required" });
    }

    const result = await bulkImportRepuestos(tenantSlug, rows);
    reply.send(result);
  });

  // ── POST /inventory/bulk/price-update — Bulk price update ──
  app.post("/inventory/bulk/price-update", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { ids, field, percentageChange } = request.body as {
      ids: string[];
      field: "precioVenta" | "precioCompra";
      percentageChange: number;
    };

    if (!ids?.length || !field || percentageChange === undefined) {
      return reply.status(400).send({ error: "ids, field, percentageChange are required" });
    }

    const result = await bulkUpdatePrices(tenantSlug, ids, field, percentageChange);
    reply.send(result);
  });

  // ── POST /inventory/bulk/stock-adjust — Bulk stock adjustment ──
  app.post("/inventory/bulk/stock-adjust", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const { adjustments } = request.body as {
      adjustments: Array<{ repuestoId: string; cantidad: number; motivo: string }>;
    };

    if (!adjustments?.length) {
      return reply.status(400).send({ error: "adjustments array is required" });
    }

    const result = await bulkAdjustStock(tenantSlug, adjustments);
    reply.send(result);
  });

  // ── GET /inventory/analytics/turnover — Turnover ──
  app.get("/inventory/analytics/turnover", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const turnover = await getInventoryTurnover(tenantSlug);
    reply.send({ turnover, count: turnover.length });
  });

  // ── GET /inventory/analytics/dead-stock — Dead stock ──
  app.get("/inventory/analytics/dead-stock", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const deadStock = await getDeadStock(tenantSlug);
    const totalValue = deadStock.reduce((sum, d) => sum + d.valorTotal, 0);
    reply.send({ deadStock, count: deadStock.length, totalValue });
  });

  // ── GET /inventory/analytics/reorder — Reorder predictions ──
  app.get("/inventory/analytics/reorder", async (request, reply) => {
    const tenantSlug = (request as any).tenantSlug as string;
    const predictions = await getReorderPredictions(tenantSlug);
    const critico = predictions.filter((p) => p.urgencia === "CRITICO").length;
    reply.send({ predictions, count: predictions.length, critico });
  });
}
