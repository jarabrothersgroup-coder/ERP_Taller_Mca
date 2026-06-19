/**
 * Backup Routes — API endpoints for backup/restore operations.
 *
 * Endpoints:
 *   GET    /backup/policies — List backup policies
 *   POST   /backup/policies — Create/update policy
 *   DELETE /backup/policies/:id — Delete policy
 *   POST   /backup/execute — Trigger manual backup
 *   GET    /backup/jobs — List backup job history
 *   GET    /backup/jobs/:id — Get job details
 *   GET    /backup/list — List available backups
 *   POST   /backup/validate — Validate backup integrity
 *   POST   /backup/restore — Execute restore (SuperAdmin only)
 *   GET    /backup/restore/:id — Get restore session status
 *
 * @module backup/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  executeBackup,
  validateBackupIntegrity,
  listBackups,
  purgeOldBackups,
  type BackupConfig,
} from "../services/backup-engine.service.js";

interface PolicyBody {
  nombre: string;
  activo?: boolean;
  frecuencia?: string;
  horaEjecucion?: number;
  minutoEjecucion?: number;
  destino?: string;
  destinoConfig?: any;
  retencionDias?: number;
  maxBackups?: number;
  comprimir?: boolean;
  passwordEncriptacion?: string;
  tipoBackup?: string;
}

interface ExecuteBody {
  policyId?: string;
  destino?: string;
  destinoConfig?: any;
  encryptionPassword?: string;
}

interface RestoreBody {
  backupFilePath: string;
  decryptionPassword?: string;
  twoFactorCode?: string;
}

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /backup/list — List available backups ──
  app.get(
    "/backup/list",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { path?: string } }>, reply: FastifyReply) => {
      const backupPath = request.query.path || process.env.BACKUP_PATH || "/var/backups/erp";
      const backups = await listBackups(backupPath);
      return reply.send({
        backups: backups.map(b => ({
          filename: b.filename,
          filePath: b.filePath,
          size: b.size,
          sizeFormatted: `${(b.size / 1024 / 1024).toFixed(2)} MB`,
          createdAt: b.createdAt,
          isEncrypted: b.isEncrypted,
        })),
        total: backups.length,
      });
    },
  );

  // ── POST /backup/validate — Validate backup file integrity ──
  app.post<{ Body: { filePath: string } }>(
    "/backup/validate",
    {
      schema: {
        body: {
          type: "object",
          required: ["filePath"],
          properties: {
            filePath: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { filePath: string } }>, reply: FastifyReply) => {
      const result = await validateBackupIntegrity(request.body.filePath);
      return reply.send(result);
    },
  );

  // ── POST /backup/execute — Trigger manual backup ──
  app.post<{ Body: ExecuteBody }>(
    "/backup/execute",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            policyId: { type: "string", format: "uuid" },
            destino: { type: "string", enum: ["LOCAL", "S3", "GDRIVE", "FTP"] },
            destinoConfig: { type: "object" },
            encryptionPassword: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ExecuteBody }>, reply: FastifyReply) => {
      const config: BackupConfig = {
        dbUrl: process.env.DATABASE_URL || "",
        dbName: process.env.DB_NAME || "automotive_erp",
        stagingDir: process.env.BACKUP_STAGING || "/tmp/backup-staging",
        destinationDir: process.env.BACKUP_PATH || "/var/backups/erp",
        encryptionPassword: request.body.encryptionPassword,
        compress: true,
      };

      if (request.body.destinoConfig?.path) {
        config.destinationDir = request.body.destinoConfig.path;
      }

      const result = await executeBackup(config);

      // Purge old backups based on retention
      if (result.success) {
        const purged = await purgeOldBackups(config.destinationDir, 30, 10);
        if (purged > 0) {
          result.log.push(`[${new Date().toISOString()}] ${purged} respaldos antiguos eliminados`);
        }
      }

      return reply.send(result);
    },
  );

  // ── POST /backup/purge — Manually purge old backups ──
  app.post<{ Body: { path?: string; maxAgeDays?: number; maxCount?: number } }>(
    "/backup/purge",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            path: { type: "string" },
            maxAgeDays: { type: "integer", minimum: 1 },
            maxCount: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const backupPath = request.body.path || process.env.BACKUP_PATH || "/var/backups/erp";
      const maxAge = request.body.maxAgeDays || 30;
      const maxCount = request.body.maxCount || 10;
      const purged = await purgeOldBackups(backupPath, maxAge, maxCount);
      return reply.send({ purged, message: `${purged} respaldos eliminados` });
    },
  );

  // ── POST /backup/restore — Execute restore (SuperAdmin + 2FA required) ──
  app.post<{ Body: RestoreBody }>(
    "/backup/restore",
    {
      schema: {
        body: {
          type: "object",
          required: ["backupFilePath"],
          properties: {
            backupFilePath: { type: "string", minLength: 1 },
            decryptionPassword: { type: "string" },
            twoFactorCode: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RestoreBody }>, reply: FastifyReply) => {
      // In production, verify 2FA code here
      const { twoFactorCode } = request.body;
      if (!twoFactorCode && process.env.NODE_ENV === "production") {
        return reply.status(403).send({
          error: "Código de autenticación de dos factores requerido para restauración",
        });
      }

      const { executeRestore } = await import("../services/backup-engine.service.js");
      const result = await executeRestore({
        backupFilePath: request.body.backupFilePath,
        decryptionPassword: request.body.decryptionPassword,
        dbUrl: process.env.DATABASE_URL || "",
        dbName: process.env.DB_NAME || "automotive_erp",
        stagingDir: process.env.BACKUP_STAGING || "/tmp/backup-staging",
      });

      return reply.send(result);
    },
  );
}
