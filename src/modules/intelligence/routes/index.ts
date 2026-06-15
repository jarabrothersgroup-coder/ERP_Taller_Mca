/**
 * Intelligence & Peripherals routes barrel.
 *
 * Aggregates all intelligence route handlers and registers them
 * on the Fastify instance with consistent prefix and hooks.
 *
 * @module intelligence/routes/index
 */

import type { FastifyInstance } from "fastify";
import { dtcRoutes } from "./dtc.js";
import { ocrRoutes } from "./ocr.js";
import { safetyRoutes } from "./safety.js";
import { vehicleIntelligenceRoutes } from "./vehicle-intelligence.js";
import { ragRoutes } from "../rag/rag-routes.js";

/**
 * Registers all intelligence routes on the given Fastify instance.
 *
 * Currently registers:
 *   - /intelligence/dtc/parse          POST — Parse scanner report
 *   - /intelligence/dtc/diagnose       POST — Generate diagnosis
 *   - /intelligence/dtc/parse-file     POST — Parse uploaded report file
 *   - /intelligence/ocr/plate          POST — OCR license plate
 *   - /intelligence/ocr/cedula         POST — OCR Cédula Verde
 *   - /intelligence/ocr/jobs/:id       GET  — Poll OCR job status
 *   - /intelligence/safety/protocol    POST — Generate HV safety protocol
 *   - /intelligence/decode-safety      POST — VIN decode + HV safety eval (NHTSA + heuristics)
 *   - /intelligence/parse-dtc          POST — Parse individual DTC code
 *   - /intelligence/manuals/ingest     POST — Upload PDF manual → chunk → embed → store
 *   - /intelligence/manuals/query      POST — Semantic search on indexed manuals
 *
 * @param app - Fastify instance
 */
export async function intelligenceRoutes(app: FastifyInstance): Promise<void> {
  await app.register(dtcRoutes);
  await app.register(ocrRoutes);
  await app.register(safetyRoutes);
  await app.register(vehicleIntelligenceRoutes);
  await app.register(ragRoutes);

  app.log.info("Intelligence & Peripherals routes registered");
}
