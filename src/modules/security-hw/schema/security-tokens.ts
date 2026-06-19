/**
 * Hardware Security Tokens — Drizzle ORM Schema.
 *
 * Stores registered hardware fingerprints and USB dongle tokens
 * for the kill-switch security system. Each token is bound to:
 *   - Motherboard UUID
 *   - CPU serial
 *   - Primary disk serial
 *   - USB dongle serial
 *
 * @module security-hw/schema
 */

import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Tables ───────────────────────────────────

/**
 * Registered hardware fingerprints — the server's identity.
 *
 * One row per deployment. Stores the hardware components that
 * form the server's "identity" for USB dongle binding.
 */
export const hardwareFingerprints = pgTable("hardware_fingerprints", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Deployment name (e.g. "Taller El Chero - Server Principal") */
  nombre: text("nombre").notNull(),

  /** Motherboard UUID (from /sys/class/dmi/id/product_uuid or dmidecode) */
  motherboardUuid: text("motherboard_uuid").notNull(),

  /** CPU serial number */
  cpuSerial: text("cpu_serial").notNull(),

  /** Primary disk serial (HDD/SSD) */
  diskSerial: text("disk_serial").notNull(),

  /** OS hostname */
  hostname: text("hostname").notNull(),

  /** OS platform (linux, win32, darwin) */
  platform: text("platform").notNull(),

  /** Is this fingerprint currently active? */
  activo: boolean("activo").notNull().default(true),

  /** Creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),

  /** Last verification timestamp */
  lastVerifiedAt: timestamp("last_verified_at"),
});

/**
 * USB security tokens — the dongle identity.
 *
 * Stores the expected USB serial and the AES-256 token
 * written to the security.token file on the USB device.
 */
export const usbSecurityTokens = pgTable("usb_security_tokens", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Human-readable token name (e.g. "Dongle Principal Taller") */
  nombre: text("nombre").notNull(),

  /** USB device serial number (from lsblk / udev / WMI) */
  usbSerial: text("usb_serial").notNull().unique(),

  /** USB vendor ID (from udevadm or system_profiler) */
  usbVendorId: text("usb_vendor_id"),

  /** USB product ID */
  usbProductId: text("usb_product_id"),

  /** USB device model name (e.g. "SanDisk Cruzer Blade") */
  usbModel: text("usb_model"),

  /** AES-256 token hash written to security.token on the USB */
  tokenHash: text("token_hash").notNull(),

  /** The hardware fingerprint this token is bound to */
  fingerprintId: uuid("fingerprint_id").references(() => hardwareFingerprints.id),

  /** Is this token currently active? */
  activo: boolean("activo").notNull().default(true),

  /** Last successful validation timestamp */
  lastValidatedAt: timestamp("last_validated_at"),

  /** Creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Security audit log — tracks all security events.
 *
 * Logs USB insert/remove, validation successes/failures,
 * kill-switch activations, and unauthorized access attempts.
 */
export const securityAuditLog = pgTable("security_audit_log", {
  /** Primary key */
  id: uuid("id").primaryKey().defaultRandom(),

  /** Event type: USB_INSERT, USB_REMOVE, VALIDATION_OK, VALIDATION_FAIL,
   *  KILL_SWITCH_ACTIVATED, UNAUTHORIZED_ACCESS, TOKEN_GENERATED */
  eventType: text("event_type").notNull(),

  /** Human-readable description */
  descripcion: text("descripcion").notNull(),

  /** USB serial involved (if any) */
  usbSerial: text("usb_serial"),

  /** Hardware fingerprint involved (if any) */
  fingerprintId: uuid("fingerprint_id"),

  /** IP address of the request (if applicable) */
  ipAddress: text("ip_address"),

  /** User agent string (if applicable) */
  userAgent: text("user_agent"),

  /** Additional context as JSON */
  metadata: text("metadata"),

  /** Severity: INFO, WARNING, CRITICAL */
  severidad: text("severidad").notNull().default("INFO"),

  /** Creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
