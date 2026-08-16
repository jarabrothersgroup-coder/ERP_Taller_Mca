/**
 * Migration Plugin — Tenant configuration export/import.
 *
 * Provides endpoints for transferring tenant-agnostic config
 * (chart of accounts, service catalog, pricing) between tenants.
 *
 * @module migration/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { migrationRoutes } from "./migration.routes.js";

export async function migrationPlugin(app: FastifyInstance): Promise<void> {
  // Tenant isolation + profile resolution (all migration routes are
  // tenant-scoped and require an authenticated user).
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);

  await app.register(migrationRoutes);
  app.log.info("Migration module registered");
}
