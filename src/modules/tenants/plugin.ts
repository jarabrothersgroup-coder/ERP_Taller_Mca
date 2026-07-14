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
import { onboardingRoutes } from "./routes/onboarding.js";

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
  // ── Register onboarding routes (public — no tenant context) ──
  // These routes handle new tenant creation and slug validation
  await app.register(onboardingRoutes);

  // ── Tenant-scoped routes (require X-Tenant-Slug header) ──
  // Register with tenant isolation hook for profile management
  await app.register(async function tenantScopedRoutes(tenantApp) {
    tenantApp.addHook("onRequest", resolveTenant);
    await tenantApp.register(tenantConfigRoutes);
  });

  app.log.info("Tenants module registered (profile + classification + onboarding)");
}

export default tenantsPlugin;
