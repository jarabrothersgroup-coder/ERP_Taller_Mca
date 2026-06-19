/**
 * Analytics Module — Fastify Plugin.
 *
 * @module analytics/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { analyticsRoutes } from "./routes/analytics.routes.js";

async function analyticsPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);
  await app.register(analyticsRoutes);
  app.log.info("Analytics module registered");
}

export default analyticsPlugin;
