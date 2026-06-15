/**
 * Inventory routes barrel.
 *
 * Aggregates all inventory route handlers and registers them
 * on the Fastify instance with consistent prefix and hooks.
 *
 * @module inventory/routes/index
 */

import type { FastifyInstance } from "fastify";
import { repuestosRoutes } from "./repuestos.js";
import { herramientasRoutes } from "./herramientas.js";
import { toolInstancesRoutes } from "./tool-instances.js";
import { toolLoansRoutes } from "./tool-loans.js";
import { toolMaintenanceRoutes } from "./tool-maintenance.js";
import { toolDepreciationRoutes } from "./tool-depreciation.js";
import { stockMovementsRoutes } from "./stock-movements.js";
import { initialLoadRoutes } from "./initial-load.js";

/**
 * Registers all inventory routes on the given Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  await app.register(repuestosRoutes);
  await app.register(herramientasRoutes);
  await app.register(toolInstancesRoutes);
  await app.register(toolLoansRoutes);
  await app.register(toolMaintenanceRoutes);
  await app.register(toolDepreciationRoutes);
  await app.register(stockMovementsRoutes);
  await app.register(initialLoadRoutes);
}
