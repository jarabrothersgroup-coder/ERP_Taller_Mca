/**
 * Backup Engine Service — pg_dump, compression, encryption, restore.
 *
 * Executes backup operations via child_process spawning pg_dump,
 * compresses with gzip, encrypts with AES-256-GCM, and manages
 * file lifecycle on local/remote storage.
 *
 * @module backup/services
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { execSync, exec as execCb } from "node:child_process";
import { mkdir, writeFile, readFile, readdir, stat, unlink, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(execCb);

// ─── Types ────────────────────────────────────

export interface BackupConfig {
  /** Database connection string */
  dbUrl: string;
  /** Database name (for pg_dump) */
  dbName: string;
  /** Local staging directory for temp files */
  stagingDir: string;
  /** Final backup destination path */
  destinationDir: string;
  /** Encryption password (plaintext, will be used for AES-256) */
  encryptionPassword?: string;
  /** Compress with gzip? */
  compress?: boolean;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  checksum?: string;
  durationMs?: number;
  error?: string;
  log: string[];
}

export interface RestoreConfig {
  /** Path to the backup file */
  backupFilePath: string;
  /** Decryption password (if encrypted) */
  decryptionPassword?: string;
  /** Database connection string for restore */
  dbUrl: string;
  /** Database name to restore into */
  dbName: string;
  /** Staging directory for temp extraction */
  stagingDir: string;
}

export interface RestoreResult {
  success: boolean;
  durationMs?: number;
  error?: string;
  log: string[];
}

// ─── AES-256-GCM Encryption ──────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Derive a 256-bit key from password using PBKDF2.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return require("node:crypto").pbkdf2Sync(password, salt, 100000, 32, "sha512");
}

/**
 * Encrypt a buffer with AES-256-GCM.
 * Output format: [salt(32)][iv(16)][authTag(16)][encryptedData]
 */
export function encryptBuffer(data: Buffer, password: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypt an AES-256-GCM encrypted buffer.
 */
export function decryptBuffer(encryptedData: Buffer, password: string): Buffer {
  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encryptedData.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
  );
  const data = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const key = deriveKey(password, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Compute SHA-256 checksum of a buffer.
 */
export function computeChecksum(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// ─── Backup Engine ────────────────────────────

/**
 * Execute a full database backup using pg_dump.
 *
 * @returns SQL dump as a string
 */
export async function dumpDatabase(config: BackupConfig, log: string[]): Promise<string> {
  log.push(`[${new Date().toISOString()}] Iniciando pg_dump de ${config.dbName}...`);

  try {
    // Use pg_dump via psql connection string
    const cmd = `pg_dump --no-owner --no-acl --clean --if-exists "${config.dbUrl}" 2>&1`;
    const result = await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 }); // 50MB max
    log.push(`[${new Date().toISOString()}] pg_dump completado exitosamente`);
    return result.stdout;
  } catch (err: any) {
    // pg_dump may exit with non-zero but still produce output
    if (err.stdout) {
      log.push(`[${new Date().toISOString()}] pg_dump completado con advertencias`);
      return err.stdout;
    }
    throw new Error(`pg_dump failed: ${err.message}`);
  }
}

/**
 * Compress data with gzip.
 */
export async function compressData(data: Buffer, log: string[]): Promise<Buffer> {
  log.push(`[${new Date().toISOString()}] Comprimiendo datos...`);
  const { gzipSync } = await import("node:zlib");
  const compressed = gzipSync(data, { level: 6 });
  log.push(`[${new Date().toISOString()}] Compresión completada (${data.length} → ${compressed.length} bytes)`);
  return compressed;
}

/**
 * Decompress gzip data.
 */
export async function decompressData(data: Buffer, log: string[]): Promise<Buffer> {
  log.push(`[${new Date().toISOString()}] Descomprimiendo datos...`);
  const { gunzipSync } = await import("node:zlib");
  const decompressed = gunzipSync(data);
  log.push(`[${new Date().toISOString()}] Descompresión completada`);
  return decompressed;
}

/**
 * Execute a full backup operation:
 * 1. pg_dump
 * 2. Compress (optional)
 * 3. Encrypt (optional)
 * 4. Write to destination
 * 5. Compute checksum
 */
export async function executeBackup(config: BackupConfig): Promise<BackupResult> {
  const log: string[] = [];
  const startTime = Date.now();

  try {
    // Ensure directories exist
    await mkdir(config.stagingDir, { recursive: true });
    await mkdir(config.destinationDir, { recursive: true });

    // 1. Database dump
    const sqlDump = await dumpDatabase(config, log);
    let data = Buffer.from(sqlDump, "utf-8");

    // 2. Compress
    if (config.compress !== false) {
      data = await compressData(data, log);
    }

    // 3. Encrypt
    let methodName = "PLAIN";
    if (config.encryptionPassword) {
      log.push(`[${new Date().toISOString()}] Encriptando con AES-256-GCM...`);
      data = encryptBuffer(data, config.encryptionPassword);
      methodName = "AES-256-GCM";
      log.push(`[${new Date().toISOString()}] Encriptación completada`);
    }

    // 4. Write to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = config.compress !== false ? ".sql.gz" : ".sql";
    const filename = `backup_${config.dbName}_${timestamp}${config.encryptionPassword ? ".enc" : ext}`;
    const filePath = join(config.destinationDir, filename);
    await writeFile(filePath, data);
    log.push(`[${new Date().toISOString()}] Archivo escrito: ${filePath}`);

    // 5. Compute checksum
    const checksum = computeChecksum(data);
    const fileSize = data.length;
    const durationMs = Date.now() - startTime;

    log.push(`[${new Date().toISOString()}] Backup completado en ${durationMs}ms`);
    log.push(`[${new Date().toISOString()}] Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    log.push(`[${new Date().toISOString()}] Checksum: ${checksum}`);
    log.push(`[${new Date().toISOString()}] Encriptación: ${methodName}`);

    return {
      success: true,
      filePath,
      fileSize,
      checksum,
      durationMs,
      log,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    log.push(`[${new Date().toISOString()}] ERROR: ${err.message}`);
    return {
      success: false,
      error: err.message,
      durationMs,
      log,
    };
  }
}

/**
 * Validate backup file integrity.
 * Returns true if file exists and can be read.
 */
export async function validateBackupIntegrity(filePath: string): Promise<{
  valid: boolean;
  size?: number;
  checksum?: string;
  error?: string;
}> {
  try {
    await access(filePath);
    const s = await stat(filePath);
    const data = await readFile(filePath);
    const checksum = computeChecksum(data);
    return { valid: true, size: s.size, checksum };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

/**
 * Execute a restore operation:
 * 1. Read backup file
 * 2. Decrypt (if password provided)
 * 3. Decompress
 * 4. Execute SQL against database
 */
export async function executeRestore(config: RestoreConfig): Promise<RestoreResult> {
  const log: string[] = [];
  const startTime = Date.now();

  try {
    log.push(`[${new Date().toISOString()}] Iniciando restauración desde ${config.backupFilePath}...`);

    // 1. Read file
    let data = await readFile(config.backupFilePath);
    log.push(`[${new Date().toISOString()}] Archivo leído (${data.length} bytes)`);

    // 2. Decrypt if password provided
    if (config.decryptionPassword) {
      log.push(`[${new Date().toISOString()}] Desencriptando con AES-256-GCM...`);
      data = decryptBuffer(data, config.decryptionPassword);
      log.push(`[${new Date().toISOString()}] Desencriptación completada`);
    }

    // 3. Decompress if gzipped
    const isGzipped = data[0] === 0x1f && data[1] === 0x8b;
    if (isGzipped) {
      data = await decompressData(data, log);
    }

    // 4. Execute SQL
    const sql = data.toString("utf-8");
    log.push(`[${new Date().toISOString()}] Ejecutando SQL de restauración...`);

    // Write SQL to temp file and execute via psql
    const tempSql = join(config.stagingDir, `restore_${Date.now()}.sql`);
    await writeFile(tempSql, sql);

    try {
      await execAsync(`psql "${config.dbUrl}" -f "${tempSql}" 2>&1`, {
        maxBuffer: 100 * 1024 * 1024,
      });
      log.push(`[${new Date().toISOString()}] Restauración SQL completada`);
    } finally {
      // Clean up temp SQL file
      try { await unlink(tempSql); } catch { /* ignore */ }
    }

    const durationMs = Date.now() - startTime;
    log.push(`[${new Date().toISOString()}] Restauración completada en ${durationMs}ms`);

    return { success: true, durationMs, log };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    log.push(`[${new Date().toISOString()}] ERROR: ${err.message}`);
    return { success: false, error: err.message, durationMs, log };
  }
}

/**
 * List available backups in a directory.
 */
export async function listBackups(directory: string): Promise<Array<{
  filename: string;
  filePath: string;
  size: number;
  createdAt: Date;
  isEncrypted: boolean;
}>> {
  try {
    const files = await readdir(directory);
    const backups: Array<{
      filename: string;
      filePath: string;
      size: number;
      createdAt: Date;
      isEncrypted: boolean;
    }> = [];

    for (const file of files) {
      if (!file.startsWith("backup_")) continue;
      const filePath = join(directory, file);
      const s = await stat(filePath);
      backups.push({
        filename: file,
        filePath,
        size: s.size,
        createdAt: s.birthtime,
        isEncrypted: file.endsWith(".enc"),
      });
    }

    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

/**
 * Purge old backups based on retention policy.
 */
export async function purgeOldBackups(
  directory: string,
  maxAgeDays: number,
  maxCount: number,
): Promise<number> {
  const backups = await listBackups(directory);
  const now = Date.now();
  const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
  let purged = 0;

  // First: remove by age
  for (const backup of backups) {
    if (backup.createdAt.getTime() < cutoff) {
      try {
        await unlink(backup.filePath);
        purged++;
      } catch { /* ignore */ }
    }
  }

  // Second: remove excess by count (keep newest)
  const remaining = await listBackups(directory);
  if (maxCount > 0 && remaining.length > maxCount) {
    const toRemove = remaining.slice(maxCount);
    for (const backup of toRemove) {
      try {
        await unlink(backup.filePath);
        purged++;
      } catch { /* ignore */ }
    }
  }

  return purged;
}
