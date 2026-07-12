/**
 * Enterprise Plugin — SSO, White-Label, Data Retention.
 *
 * Registers enterprise routes under /enterprise/*.
 *
 * @module enterprise/plugin
 */

import type { FastifyInstance } from "fastify";
import { enterpriseRoutes } from "./routes/enterprise.routes.js";

async function enterprisePlugin(app: FastifyInstance): Promise<void> {
  await app.register(enterpriseRoutes);
  app.log.info("Enterprise module registered");
}

export default enterprisePlugin;
