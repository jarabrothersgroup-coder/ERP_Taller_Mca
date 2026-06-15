/**
 * Intelligence & Peripherals Module — Fastify Plugin.
 *
 * Registers all intelligence-related routes and hooks on the Fastify instance:
 *   - DTC parsing (Launch/Thinkcar scanner reports)
 *   - OpenCode diagnostic engine
 *   - HV safety protocol generator
 *   - Computer Vision (OCR) for license plates and Cédulas Verdes
 *
 * RAM discipline:
 *   - Async file processing queue (single worker, max 1 concurrent heavy op)
 *   - Tesseract.js loaded lazily only during OCR jobs
 *   - Temp files cleaned immediately after processing
 *   - All heavy operations run in the background (non-blocking)
 *
 * Usage (in app.ts):
 * ```ts
 * import { intelligencePlugin } from "./modules/intelligence/plugin.js";
 * await app.register(intelligencePlugin);
 * ```
 *
 * @module intelligence/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { intelligenceRoutes } from "./routes/index.js";
import { initProcessor } from "./services/async-processor.service.js";

/**
 * Fastify plugin that bootstraps the Intelligence & Peripherals module.
 *
 * Features:
 *   - DTC parsing from Launch/Thinkcar scanner reports
 *   - Automatic diagnosis via OpenCode engine (offline-first)
 *   - EV/HEV high-voltage safety protocol generation
 *   - OCR for Paraguayan license plates and Cédulas Verdes
 *   - Async job queue for heavy file processing (RAM-safe)
 *   - Tenant-isolated via X-Tenant-Slug middleware
 *
 * The async processor is initialized on plugin registration and
 * runs background cleanup of expired jobs.
 *
 * @param app - Fastify instance
 */
async function intelligencePlugin(app: FastifyInstance): Promise<void> {
  // ── Initialize the async job processor ──
  initProcessor();

  // ── Tenant isolation hook for all intelligence routes ──
  app.addHook("onRequest", resolveTenant);

  // ── Register intelligence routes ──
  await app.register(intelligenceRoutes);

  app.log.info("Intelligence & Peripherals module registered");

  // ── Cleanup on close ──
  app.addHook("onClose", async () => {
    const { shutdownProcessor } = await import(
      "./services/async-processor.service.js"
    );
    shutdownProcessor();
    app.log.info("Intelligence & Peripherals async processor shut down");
  });
}

export default intelligencePlugin;
