/**
 * Backup Policies — Drizzle ORM Schema.
 *
 * Defines backup frequency, retention, and storage destination.
 * Policies are evaluated by the backup worker cron job.
 *
 * @module backup/schema/backup-policies
 */

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────

export const backupFrequencyEnum = pgEnum("backup_frequency", [
  "DIARIA",      // Every day
  "SEMANAL",     // Once per week
  "MENSUAL",     // Once per month
]);

export const backupDestinationEnum = pgEnum("backup_destination", [
  "LOCAL",       // Local filesystem path
  "S3",          // AWS S3 bucket
  "GDRIVE",      // Google Drive
  "FTP",         // FTP server
]);

export const backupTypeEnum = pgEnum("backup_type", [
  "COMPLETO",    // Full database + files
  "Solo_DB",     // Database only
  "Solo_FILES",  // Files only (DVI photos, PDFs, etc.)
]);

// ─── Tables ───────────────────────────────────

/**
 * Backup policies — configurable backup rules.
 *
 * Each policy defines when and how backups are created,
 * where they're stored, and when old ones are purged.
 */
export const backupPolicies = pgTable("backup_policies", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Policy name (e.g. "Backup Diario Nocturno") */
  nombre: text("nombre").notNull(),

  /** Is this policy active? */
  activo: boolean("activo").notNull().default(true),

  /** Backup frequency */
  frecuencia: backupFrequencyEnum("frecuencia").notNull().default("DIARIA"),

  /** Hour of day to execute (0-23, default 23 for 11 PM) */
  horaEjecucion: integer("hora_ejecucion").notNull().default(23),

  /** Minute of hour (0-59, default 30 for 11:30 PM) */
  minutoEjecucion: integer("minuto_ejecucion").notNull().default(30),

  /** Day of week for SEMANAL (1=Monday..7=Sunday, null = every day) */
  diaSemana: integer("dia_semana"),

  /** Day of month for MENSUAL (1-31, null = 1st) */
  diaMes: integer("dia_mes"),

  /** What to backup */
  tipoBackup: backupTypeEnum("tipo_backup").notNull().default("COMPLETO"),

  /** Storage destination */
  destino: backupDestinationEnum("destino").notNull().default("LOCAL"),

  /**
   * Destination configuration (JSON).
   * LOCAL: { "path": "/var/backups/erp" }
   * S3: { "bucket": "my-bucket", "region": "us-east-1", "prefix": "backups/" }
   * GDRIVE: { "folderId": "...", "credentialsPath": "..." }
   * FTP: { "host": "ftp.example.com", "port": 21, "user": "...", "path": "/backups" }
   */
  destinoConfig: jsonb("destino_config").notNull().default({ path: "/var/backups/erp" }),

  /** Encryption password (hashed with bcrypt, used for AES-256 encryption of backup files) */
  passwordEncriptacion: text("password_encriptacion"),

  /** Retention: keep backups for N days (older ones are auto-deleted) */
  retencionDias: integer("retencion_dias").notNull().default(30),

  /** Max backups to keep (0 = unlimited, rely only on retencionDias) */
  maxBackups: integer("max_backups").notNull().default(10),

  /** Compress backups with gzip? */
  comprimir: boolean("comprimir").notNull().default(true),

  /** Tenant slug */
  tenantSlug: text("tenant_slug").notNull().notNull(),

  /** Creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** Last update timestamp */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Backup jobs — execution history for each backup run.
 *
 * Tracks status, timing, file size, and errors for audit/compliance.
 */
export const backupJobs = pgTable("backup_jobs", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Policy that triggered this job */
  policyId: uuid("policy_id").references(() => backupPolicies.id),

  /** Job status: PENDIENTE, EN_PROGRESO, COMPLETADO, ERROR */
  estado: text("estado").notNull().default("PENDIENTE"),

  /** Backup file path/URL after completion */
  filePath: text("file_path"),

  /** File size in bytes */
  fileSize: integer("file_size"),

  /** SHA-256 checksum of the backup file for integrity verification */
  checksum: text("checksum"),

  /** Encryption method used (e.g. "AES-256-GCM") */
  metodoEncriptacion: text("metodo_encriptacion"),

  /** Duration in milliseconds */
  duracionMs: integer("duracion_ms"),

  /** Error message if job failed */
  error: text("error"),

  /** Progress percentage (0-100) for running jobs */
  progreso: integer("progreso").default(0),

  /** Log entries (array of timestamped messages) */
  log: jsonb("log").default([]),

  /** Who triggered the backup (USER or CRON) */
  trigger: text("trigger").notNull().default("CRON"),

  /** Tenant slug */
  tenantSlug: text("tenant_slug").notNull(),

  /** Creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** Completion timestamp */
  completedAt: timestamp("completed_at"),
});

/**
 * Restore sessions — track restore attempts for audit.
 */
export const restoreSessions = pgTable("restore_sessions", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Backup job being restored */
  backupJobId: uuid("backup_job_id").references(() => backupJobs.id),

  /** Restore status */
  estado: text("estado").notNull().default("PENDIENTE"),

  /** Who initiated the restore */
  initiatedBy: text("initiated_by").notNull(),

  /** Two-factor auth verified? */
  twoFactorVerified: boolean("two_factor_verified").notNull().default(false),

  /** Progress percentage */
  progreso: integer("progreso").default(0),

  /** Log entries */
  log: jsonb("log").default([]),

  /** Error message */
  error: text("error"),

  /** Tenant slug */
  tenantSlug: text("tenant_slug").notNull(),

  /** Creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** Completion timestamp */
  completedAt: timestamp("completed_at"),
});
