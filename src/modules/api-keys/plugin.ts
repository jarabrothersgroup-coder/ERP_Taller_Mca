/**
 * API Keys Plugin — registers API key management routes.
 *
 * @module api-keys/plugin
 */

import type { FastifyInstance } from "fastify";
import { apiKeyRoutes } from "./routes/api-key.routes.js";

export default async function apiKeyPlugin(app: FastifyInstance): Promise<void> {
  // Register API key management routes under /api-keys
  await app.register(apiKeyRoutes, { prefix: "/api-keys" });

  app.log.info("API Keys module registered (/api-keys)");
}
