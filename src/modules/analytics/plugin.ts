/**
 * Analytics Module — Fastify Plugin.
 *
 * @module analytics/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { analyticsRoutes } from "./routes/analytics.routes.js";
import { metabaseRoutes } from "./routes/metabase.routes.js";

async function analyticsPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);
  await app.register(analyticsRoutes);
  await app.register(metabaseRoutes);
  app.log.info("Analytics module registered (KPIs + Metabase)");
}

export default analyticsPlugin;
