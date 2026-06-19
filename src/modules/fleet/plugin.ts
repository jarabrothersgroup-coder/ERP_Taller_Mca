/**
 * Fleet Module — Fastify Plugin.
 *
 * Registers fleet management routes for B2B clients.
 *
 * @module fleet/plugin.ts
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { fleetRoutes } from "./routes/fleet.routes.js";

async function fleetPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(fleetRoutes);
  app.log.info("Fleet module registered");
}

export default fleetPlugin;
