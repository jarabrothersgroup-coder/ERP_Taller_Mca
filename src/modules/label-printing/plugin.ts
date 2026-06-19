/**
 * Label Printing Module — Fastify Plugin.
 *
 * Registers label generation and printing routes.
 * Supports ESC/POS (Epson/Xprinter), ZPL (Zebra), TSPL (Brother).
 *
 * @module label-printing/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { labelPrintingRoutes } from "./routes/label-printing.routes.js";

async function labelPrintingPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(labelPrintingRoutes);
  app.log.info("Label Printing module registered");
}

export default labelPrintingPlugin;
