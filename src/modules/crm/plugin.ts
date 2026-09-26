/**
 * CRM Plugin — Fastify plugin for Twenty CRM integration + local pipeline.
 *
 * Registers all CRM routes under /crm prefix.
 *
 * @module crm/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { crmRoutes } from "./routes/crm.routes.js";
import { dealsRoutes } from "./routes/deals.routes.js";

export async function crmPlugin(app: FastifyInstance): Promise<void> {
  // Tenant isolation + profile resolution (all CRM routes are tenant-scoped
  // and require an authenticated user).
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);

  // crmRoutes declara rutas relativas (/status, /stats, /retry, /sync/:ordenId)
  // → necesita el prefijo. deals.routes.ts declara la raíz completa
  // (/crm/stages, /crm/deals) → registrarla con prefijo duplicaba la raíz
  // (/crm/crm/*) y devolvía 404 a toda la UI de pipeline.
  await app.register(crmRoutes, { prefix: "/crm" });
  await app.register(dealsRoutes);
  app.log.info("CRM plugin registered (/crm — sync + pipeline)");
}
