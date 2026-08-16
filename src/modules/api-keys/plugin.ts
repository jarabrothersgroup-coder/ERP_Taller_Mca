/**
 * API Keys Plugin — registers API key management routes.
 *
 * @module api-keys/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { apiKeyRoutes } from "./routes/api-key.routes.js";

export default async function apiKeyPlugin(app: FastifyInstance): Promise<void> {
  // Tenant isolation + profile resolution for the management routes
  // (the routes use `request.tenantSlug` to scope keys per tenant).
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);

  // Register API key management routes under /api-keys
  await app.register(apiKeyRoutes, { prefix: "/api-keys" });

  app.log.info("API Keys module registered (/api-keys)");
}
