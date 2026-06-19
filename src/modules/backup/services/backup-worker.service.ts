/**
 * Backup Worker — Cron-based backup scheduler.
 *
 * Evaluates backup policies and triggers backups according to
 * their configured frequency and execution time.
 *
 * Uses a simple interval-based scheduler (not a full cron library)
 * to keep RAM usage under the 50MB target.
 *
 * @module backup/services/backup-worker
 */

import { executeBackup, purgeOldBackups, type BackupConfig } from "./backup-engine.service.js";

// ─── Configuration ────────────────────────────

/** How often to check policies (every 60 seconds) */
const CHECK_INTERVAL_MS = 60_000;

/** Track last execution per policy to avoid duplicate runs */
const lastExecutionMap = new Map<string, number>();

// ─── Worker Logic ─────────────────────────────

/**
 * Check if a policy should run at the current time.
 */
function shouldRunPolicy(policy: {
  frecuencia: string;
  horaEjecucion: number;
  minutoEjecucion: number;
  diaSemana?: number | null;
  diaMes?: number | null;
}): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDayOfWeek = now.getDay(); // 0=Sunday
  const currentDayOfMonth = now.getDate();

  // Check hour and minute
  if (currentHour !== policy.horaEjecucion || currentMinute !== policy.minutoEjecucion) {
    return false;
  }

  // Check day-specific rules
  switch (policy.frecuencia) {
    case "DIARIA":
      return true; // Every day at the specified time

    case "SEMANAL":
      // diaSemana: 1=Monday..7=Sunday (DB convention), JS: 0=Sunday..6=Monday
      const jsDay = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
      return policy.diaSemana ? jsDay === policy.diaSemana : true;

    case "MENSUAL":
      return policy.diaMes ? currentDayOfMonth === policy.diaMes : currentDayOfMonth === 1;

    default:
      return false;
  }
}

/**
 * Evaluate a single policy and trigger backup if needed.
 */
async function evaluatePolicy(policy: any): Promise<void> {
  const policyKey = policy.id || policy.nombre;
  const now = Date.now();

  // Avoid duplicate execution within the same minute
  const lastRun = lastExecutionMap.get(policyKey) || 0;
  if (now - lastRun < 60_000) return;

  if (!shouldRunPolicy(policy)) return;

  console.log(`[BACKUP-WORKER] Policy "${policy.nombre}" triggered at ${new Date().toISOString()}`);
  lastExecutionMap.set(policyKey, now);

  const config: BackupConfig = {
    dbUrl: process.env.DATABASE_URL || "",
    dbName: process.env.DB_NAME || "automotive_erp",
    stagingDir: process.env.BACKUP_STAGING || "/tmp/backup-staging",
    destinationDir: policy.destinoConfig?.path || process.env.BACKUP_PATH || "/var/backups/erp",
    encryptionPassword: policy.passwordEncriptacion || undefined,
    compress: policy.comprimir !== false,
  };

  const result = await executeBackup(config);

  if (result.success) {
    console.log(`[BACKUP-WORKER] Backup completed: ${result.filePath} (${result.durationMs}ms)`);

    // Purge old backups
    const purged = await purgeOldBackups(
      config.destinationDir,
      policy.retencionDias || 30,
      policy.maxBackups || 10,
    );
    if (purged > 0) {
      console.log(`[BACKUP-WORKER] Purged ${purged} old backups`);
    }
  } else {
    console.error(`[BACKUP-WORKER] Backup FAILED: ${result.error}`);
  }
}

/**
 * Start the backup worker.
 * In production, this runs as a background process/cron.
 * For development, it uses a simple interval.
 */
export function startBackupWorker(): void {
  console.log(`[BACKUP-WORKER] Starting backup worker (checking every ${CHECK_INTERVAL_MS / 1000}s)`);

  // In a real production system, this would read from the backup_policies table
  // and evaluate each policy. For now, it uses environment variables as defaults.
  const defaultPolicy = {
    id: "default",
    nombre: "Backup Diario Nocturno",
    frecuencia: process.env.BACKUP_FREQUENCY || "DIARIA",
    horaEjecucion: parseInt(process.env.BACKUP_HOUR || "23", 10),
    minutoEjecucion: parseInt(process.env.BACKUP_MINUTE || "30", 10),
    diaSemana: null,
    diaMes: null,
    retencionDias: parseInt(process.env.BACKUP_RETENTION_DAYS || "30", 10),
    maxBackups: parseInt(process.env.BACKUP_MAX_COUNT || "10", 10),
    comprimir: true,
    passwordEncriptacion: process.env.BACKUP_ENCRYPTION_KEY || undefined,
    destinoConfig: {
      path: process.env.BACKUP_PATH || "/var/backups/erp",
    },
  };

  setInterval(() => {
    evaluatePolicy(defaultPolicy).catch(err => {
      console.error("[BACKUP-WORKER] Error evaluating policy:", err);
    });
  }, CHECK_INTERVAL_MS);
}
