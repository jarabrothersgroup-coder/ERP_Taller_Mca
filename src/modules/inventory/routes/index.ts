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
import { autoPORoutes } from "./auto-po.routes.js";
import { tecdocRoutes } from "./tecdoc.routes.js";
import { batchInventoryRoutes } from "./batch-inventory.routes.js";
import { almacenRoutes } from "./almacenes.js";
import { inventoryReportRoutes } from "./inventory-reports.routes.js";
import { stockAdjustmentApprovalRoutes } from "./stock-adjustment-approval.routes.js";

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
  await app.register(autoPORoutes);
  await app.register(tecdocRoutes);
  await app.register(batchInventoryRoutes);
  await app.register(almacenRoutes);
  // G-04: Reportes de inventario
  await app.register(inventoryReportRoutes);
  // G-11: Aprobación de ajustes de stock
  await app.register(stockAdjustmentApprovalRoutes);
}
