/**
 * Fleet Module — Fastify Plugin.
 *
 * Registers fleet management routes for B2B clients,
 * recurring billing contracts, and monthly billing cron.
 *
 * @module fleet/plugin.ts
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { fleetRoutes } from "./routes/fleet.routes.js";
import { fleetContractsRoutes } from "./routes/fleet-contracts.routes.js";
import { startFleetBillingCron } from "./jobs/fleet-billing.cron.js";

async function fleetPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(fleetRoutes);
  await app.register(fleetContractsRoutes);

  // ── G-15: Start fleet billing cron ──
  startFleetBillingCron();

  app.log.info("Fleet module registered (with recurring billing)");
}

export default fleetPlugin;
