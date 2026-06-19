/**
 * Scheduling Plugin — Fastify plugin for appointment management.
 *
 * Registers all scheduling routes under /scheduling prefix.
 *
 * @module scheduling/plugin
 */

import type { FastifyInstance } from "fastify";
import { schedulingRoutes } from "./routes/scheduling.routes.js";

export async function schedulingPlugin(app: FastifyInstance): Promise<void> {
  await app.register(schedulingRoutes, { prefix: "/scheduling" });
  app.log.info("Scheduling plugin registered (/scheduling)");
}
