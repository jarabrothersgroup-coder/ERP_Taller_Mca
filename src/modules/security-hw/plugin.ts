/**
 * Hardware Security Module — Fastify Plugin.
 *
 * Registers USB dongle validation routes and the kill-switch middleware.
 * The kill switch middleware MUST be registered as onRequest on the app
 * to intercept ALL requests.
 *
 * @module security-hw/plugin
 */

import type { FastifyInstance } from "fastify";
import { securityHwRoutes } from "./routes/security-hw.routes.js";

async function securityHwPlugin(app: FastifyInstance): Promise<void> {
  // Register security routes (no tenant resolution — global security)
  await app.register(securityHwRoutes);

  // Register kill switch middleware on ALL requests
  const { hardwareKillSwitch } = await import("./middleware/hardware-lock.middleware.js");
  app.addHook("onRequest", hardwareKillSwitch);

  app.log.info("Hardware Security module registered (kill switch active)");
}

export default securityHwPlugin;
