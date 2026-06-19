/**
 * Backup & Restore Module — Fastify Plugin.
 *
 * Registers backup management and restore wizard routes.
 * Includes cron-based backup scheduling via backup-worker.service.
 *
 * @module backup/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { backupRoutes } from "./routes/backup.routes.js";

async function backupPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  await app.register(backupRoutes);

  // Start backup worker cron (evaluates policies and triggers backups)
  try {
    const { startBackupWorker } = await import("./services/backup-worker.service.js");
    startBackupWorker();
    app.log.info("Backup worker started");
  } catch (err) {
    app.log.warn({ err }, "Backup worker not started");
  }

  app.log.info("Backup & Restore module registered");
}

export default backupPlugin;
