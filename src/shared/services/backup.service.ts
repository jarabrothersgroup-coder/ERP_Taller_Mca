/**
 * Backup & Restore Service — Database backup management.
 *
 * Provides pg_dump-based backup, restore, and archival.
 * Designed for Paraguayan workshops with limited connectivity.
 *
 * @module shared/services/backup.service
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";

// ─── Configuration ─────────────────────────────

const BACKUP_DIR = join(process.cwd(), "backups");
const MAX_BACKUPS = 30; // Keep last 30 backups

// ─── Backup Operations ─────────────────────────

/**
 * Create a database backup using pg_dump.
 * @param label - Optional label for the backup (e.g., "pre-deploy", "manual")
 * @returns Backup file path and size
 */
export function createBackup(label?: string): { path: string; size: string; duration: string } {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${label ? `${label}-` : ""}${timestamp}.sql`;
  const filepath = join(BACKUP_DIR, filename);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set — cannot create backup");
  }

  const startTime = Date.now();

  try {
    // pg_dump with custom format for compression
    execSync(
      `pg_dump "${databaseUrl}" --format=custom --compress=9 --file="${filepath}"`,
      { timeout: 300_000, stdio: "pipe" } // 5 min timeout
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const size = formatSize(statSync(filepath).size);

    // Cleanup old backups
    cleanupOldBackups();

    return { path: filepath, size, duration: `${duration}s` };
  } catch (err: any) {
    // Fallback: plain SQL dump
    try {
      execSync(
        `pg_dump "${databaseUrl}" --format=plain > "${filepath}"`,
        { timeout: 300_000, stdio: "pipe" }
      );
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const size = formatSize(statSync(filepath).size);
      cleanupOldBackups();
      return { path: filepath, size, duration: `${duration}s` };
    } catch (fallbackErr: any) {
      throw new Error(`Backup failed: ${fallbackErr.message}`);
    }
  }
}

/**
 * Restore a database from a backup file.
 * WARNING: This will overwrite the current database!
 *
 * @param backupPath - Path to the backup file
 * @param options - Restore options
 */
export function restoreBackup(
  backupPath: string,
  options: { dryRun?: boolean } = {}
): { success: boolean; message: string } {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set — cannot restore backup");
  }

  if (options.dryRun) {
    return {
      success: true,
      message: `Dry run: would restore from ${backupPath}`,
    };
  }

  try {
    // Try pg_restore for custom format
    execSync(
      `pg_restore "${databaseUrl}" --clean --if-exists "${backupPath}"`,
      { timeout: 600_000, stdio: "pipe" } // 10 min timeout
    );
    return { success: true, message: `Restored from ${backupPath}` };
  } catch {
    // Fallback: psql for plain SQL
    try {
      execSync(
        `psql "${databaseUrl}" < "${backupPath}"`,
        { timeout: 600_000, stdio: "pipe" }
      );
      return { success: true, message: `Restored from ${backupPath} (plain SQL)` };
    } catch (err: any) {
      throw new Error(`Restore failed: ${err.message}`);
    }
  }
}

/**
 * List available backups.
 */
export function listBackups(): Array<{
  filename: string;
  size: string;
  createdAt: string;
  path: string;
}> {
  if (!existsSync(BACKUP_DIR)) return [];

  return readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => {
      const filepath = join(BACKUP_DIR, f);
      const stat = statSync(filepath);
      return {
        filename: f,
        size: formatSize(stat.size),
        createdAt: stat.mtime.toISOString(),
        path: filepath,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Delete a specific backup.
 */
export function deleteBackup(filename: string): boolean {
  const filepath = join(BACKUP_DIR, filename);
  if (!existsSync(filepath)) return false;
  unlinkSync(filepath);
  return true;
}

// ─── Helpers ───────────────────────────────────

function cleanupOldBackups() {
  const backups = listBackups();
  if (backups.length > MAX_BACKUPS) {
    backups.slice(MAX_BACKUPS).forEach((b) => {
      try { unlinkSync(b.path); } catch {}
    });
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
