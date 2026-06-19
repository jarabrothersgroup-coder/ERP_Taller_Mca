/**
 * CRM Plugin — Fastify plugin for Twenty CRM integration.
 *
 * Registers all CRM routes under /crm prefix.
 *
 * @module crm/plugin
 */

import type { FastifyInstance } from "fastify";
import { crmRoutes } from "./routes/crm.routes.js";

export async function crmPlugin(app: FastifyInstance): Promise<void> {
  await app.register(crmRoutes, { prefix: "/crm" });
  app.log.info("Twenty CRM plugin registered (/crm)");
}
