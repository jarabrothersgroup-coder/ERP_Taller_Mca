/**
 * DVI Module — Fastify Plugin.
 *
 * Registers Digital Vehicle Inspection routes for:
 *   - Photo capture and markup annotations
 *   - Photo upload/download via Supabase Storage
 *   - Health score calculation
 *   - WhatsApp sharing
 *
 * @module dvi/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { dviRoutes } from "./routes/dvi.routes.js";
import { photoRoutes } from "./routes/photo.routes.js";

/**
 * Fastify plugin that bootstraps the DVI module.
 *
 * @param app - Fastify instance
 */
async function dviPlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant isolation hook ──
  app.addHook("onRequest", resolveTenant);

  // ── Register DVI routes ──
  await app.register(dviRoutes);
  await app.register(photoRoutes);

  app.log.info("DVI module registered (with photo storage)");
}

export default dviPlugin;
