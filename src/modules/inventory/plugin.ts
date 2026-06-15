/**
 * Inventory Module — Fastify Plugin.
 *
 * Registers all inventory-related routes and hooks on the Fastify instance.
 * This is the entry point for the inventory module and should be registered
 * in the main application bootstrap (app.ts).
 *
 * Tenant resolution is enforced via the shared `resolveTenant` hook.
 *
 * The module includes:
 *   - Spare parts inventory (repuestos) with barcode/QR support
 *   - Tool master catalog (herramientas)
 *   - Tool checkout control (control_herramientas) linked to work orders
 *
 * RAM impact: ~20 KB additional heap (route definitions + schema metadata).
 * DB connection is shared via the existing lazy singleton — no new pool.
 *
 * Usage (in app.ts):
 * ```ts
 * import { inventoryPlugin } from "./modules/inventory/plugin.js";
 * await app.register(inventoryPlugin);
 * ```
 *
 * @module inventory/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { inventoryRoutes } from "./routes/index.js";

/**
 * Fastify plugin that bootstraps the Inventory module.
 *
 * Features:
 *   - Spare parts CRUD with barcode/QR scanner support
 *   - Stock input/output operations with OT linkage
 *   - Tool master catalog management
 *   - Tool checkout/return tracking by mechanic per OT
 *   - Tenant-isolated via X-Tenant-Slug middleware
 *   - All queries use JOINs to prevent N+1
 *
 * @param app - Fastify instance
 */
async function inventoryPlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant isolation hook for all inventory routes ──
  app.addHook("onRequest", resolveTenant);

  // ── Register inventory routes ──
  await app.register(inventoryRoutes);

  app.log.info("Inventory module registered");
}

export default inventoryPlugin;
