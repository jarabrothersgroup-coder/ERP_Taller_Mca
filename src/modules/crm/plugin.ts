/**
 * CRM Plugin — Fastify plugin for Twenty CRM integration + local pipeline.
 *
 * Registers all CRM routes under /crm prefix.
 *
 * @module crm/plugin
 */

import type { FastifyInstance } from "fastify";
import { crmRoutes } from "./routes/crm.routes.js";
import { dealsRoutes } from "./routes/deals.routes.js";

export async function crmPlugin(app: FastifyInstance): Promise<void> {
  await app.register(crmRoutes, { prefix: "/crm" });
  await app.register(dealsRoutes, { prefix: "/crm" });
  app.log.info("CRM plugin registered (/crm — sync + pipeline)");
}
