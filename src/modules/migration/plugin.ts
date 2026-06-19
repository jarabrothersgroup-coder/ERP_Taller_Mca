/**
 * Migration Plugin — Tenant configuration export/import.
 *
 * Provides endpoints for transferring tenant-agnostic config
 * (chart of accounts, service catalog, pricing) between tenants.
 *
 * @module migration/plugin
 */

import type { FastifyInstance } from "fastify";
import { migrationRoutes } from "./migration.routes.js";

export async function migrationPlugin(app: FastifyInstance): Promise<void> {
  await app.register(migrationRoutes);
  app.log.info("Migration module registered");
}
