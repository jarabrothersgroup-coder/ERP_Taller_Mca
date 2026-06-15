/**
 * Tenants Module — Fastify Plugin.
 *
 * Registers all tenant configuration routes on the Fastify instance.
 * Handles company identity, MIC classification, and books setup.
 *
 * @module tenants/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { tenantConfigRoutes } from "./routes/tenants.js";

/**
 * Fastify plugin that bootstraps the Tenants configuration module.
 *
 * Features:
 *   - MIC classification (Micro, Pequeña, Mediana, Grande)
 *   - IRE regime determination (General, Simple, Resimple)
 *   - Mandatory books activation (Diario, Mayor, Inventario, etc.)
 *   - RUC/DV, legal form, and tax profile management
 *
 * @param app - Fastify instance
 */
async function tenantsPlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant isolation hook ──
  app.addHook("onRequest", resolveTenant);

  // ── Register tenant routes ──
  await app.register(tenantConfigRoutes);

  app.log.info("Tenants module registered (profile + classification)");
}

export default tenantsPlugin;
