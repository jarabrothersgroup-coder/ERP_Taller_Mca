/**
 * Workshop Module — Fastify Plugin.
 *
 * Registers all workshop-related routes and hooks on the Fastify instance.
 * This is the entry point for the workshop module and should be registered
 * in the main application bootstrap (app.ts).
 *
 * Tenant resolution is enforced via the shared `resolveTenant` hook.
 *
 * RAM impact: ~15 KB additional heap (route definitions + schema metadata).
 * DB connection is shared via the existing lazy singleton — no new pool.
 *
 * Usage (in app.ts):
 * ```ts
 * import { workshopPlugin } from "./modules/workshop/plugin.js";
 * await app.register(workshopPlugin);
 * ```
 *
 * @module workshop/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { workshopRoutes } from "./routes/index.js";

/**
 * Fastify plugin that bootstraps the Workshop Core module.
 *
 * Features:
 *   - Vehicle check-in (ingreso) with optional work order creation
 *   - Third-party work association (trabajos de terceros)
 *   - Tenant-isolated via X-Tenant-Slug middleware
 *   - All queries use JOINs to prevent N+1
 *
 * @param app - Fastify instance
 */
async function workshopPlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant isolation hook for all workshop routes ──
  app.addHook("onRequest", resolveTenant);
  // ── RBAC: resolve user profile for role-based access control ──
  app.addHook("onRequest", resolveProfile);

  // ── Register workshop routes ──
  await app.register(workshopRoutes);

  app.log.info("Workshop Core module registered");
}

export default workshopPlugin;
