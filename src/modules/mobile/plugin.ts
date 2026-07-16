/**
 * Mobile Module — Fastify Plugin.
 *
 * Registers mobile-app backend routes (push token management, health).
 * Tenant isolation is enforced inside the routes via the resolveTenant hook.
 *
 * Usage (in app.ts):
 * ```ts
 * import { mobilePlugin } from "./modules/mobile/plugin.js";
 * await app.register(mobilePlugin);
 * ```
 *
 * @module mobile/plugin
 */

import type { FastifyInstance } from "fastify";
import { mobileRoutes } from "./routes/mobile.routes.js";

/**
 * Fastify plugin that bootstraps the Mobile module.
 *
 * @param app - Fastify instance
 */
export async function mobilePlugin(app: FastifyInstance): Promise<void> {
  await app.register(mobileRoutes);
}
