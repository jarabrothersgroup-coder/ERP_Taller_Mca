/**
 * Search Module — Fastify Plugin.
 *
 * Registers global search endpoint with tenant isolation.
 *
 * @module shared/plugins/search
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../middleware/tenant-resolver.js";
import { resolveProfile } from "../middleware/rbac.js";
import { searchRoutes } from "../routes/search.routes.js";
import { exportRoutes } from "../routes/export.routes.js";

/**
 * Search plugin — global cross-entity search.
 *
 * @param app - Fastify instance
 */
async function searchPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);

  await app.register(searchRoutes, { prefix: "/api/v1" });
  await app.register(exportRoutes, { prefix: "/api/v1" });

  app.log.info("Search module registered");
}

export default searchPlugin;
