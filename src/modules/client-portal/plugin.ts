/**
 * Client Portal Module — Fastify Plugin.
 *
 * @module client-portal/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { portalRoutes } from "./routes/portal.routes.js";

async function clientPortalPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(portalRoutes);
  app.log.info("Client Portal module registered");
}

export default clientPortalPlugin;
