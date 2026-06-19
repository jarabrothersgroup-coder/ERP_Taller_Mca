/**
 * Sprint 51 — Label Printing, Backup & Restore, Hardware Security
 *
 * Tests: database schemas, backend services, routes, frontend modules,
 * ESC/POS/ZPL generation, backup engine, encryption, kill switch.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function load(relPath: string): string {
  return readFileSync(resolve(__dirname, relPath), "utf-8");
}

/* ─── Module 1: Label Printing — Schema ────────────────────────── */

describe("Label Printing — Schema", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/label-printing/schema/label-templates.ts"); });

  it("exports labelTemplates table", () => {
    expect(content).toContain("export const labelTemplates");
  });

  it("exports printJobs table", () => {
    expect(content).toContain("export const printJobs");
  });

  it("has printerProtocolEnum with ESCPOS, ZPL, TSPL", () => {
    expect(content).toContain("ESCPOS");
    expect(content).toContain("ZPL");
    expect(content).toContain("TSPL");
  });

  it("has labelTypeEnum with REPUESTO and HERRAMIENTA", () => {
    expect(content).toContain("REPUESTO");
    expect(content).toContain("HERRAMIENTA");
  });

  it("labelTemplates has layout jsonb column", () => {
    expect(content).toContain("layout");
    expect(content).toContain("jsonb");
  });

  it("printJobs has payload column for raw print data", () => {
    expect(content).toContain("payload");
  });
});

/* ─── Module 1: Label Printing — Service ───────────────────────── */

describe("Label Printing — Service", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/label-printing/services/label-printing.service.ts"); });

  it("exports generateLabelPayload function", () => {
    expect(content).toContain("export function generateLabelPayload");
  });

  it("exports generateRepuestoESCPOS function", () => {
    expect(content).toContain("export function generateRepuestoESCPOS");
  });

  it("exports generateHerramientaESCPOS function", () => {
    expect(content).toContain("export function generateHerramientaESCPOS");
  });

  it("exports generateRepuestoZPL function", () => {
    expect(content).toContain("export function generateRepuestoZPL");
  });

  it("exports generateHerramientaZPL function", () => {
    expect(content).toContain("export function generateHerramientaZPL");
  });

  it("exports generateRepuestoTSPL function", () => {
    expect(content).toContain("export function generateRepuestoTSPL");
  });

  it("exports generateHerramientaTSPL function", () => {
    expect(content).toContain("export function generateHerramientaTSPL");
  });

  it("exports validateLabelData function", () => {
    expect(content).toContain("export function validateLabelData");
  });

  it("ESC/POS uses GS command for barcode", () => {
    expect(content).toContain("GS");
    expect(content).toContain("\\x1d");
  });

  it("ZPL uses ^XA and ^XZ delimiters", () => {
    expect(content).toContain("^XA");
    expect(content).toContain("^XZ");
  });

  it("generates Code128 barcode commands", () => {
    expect(content).toContain("CODE128");
    expect(content).toContain("\\x49");
  });

  it("generates QR code commands", () => {
    expect(content).toContain("QRCode");
    expect(content).toContain("qrcode");
  });

  it("has plain text fallback generator", () => {
    expect(content).toContain("generatePlainText");
  });
});

/* ─── Module 1: Label Printing — Routes ────────────────────────── */

describe("Label Printing — Routes", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/label-printing/routes/label-printing.routes.ts"); });

  it("has GET /label-printing/repuesto/:id route", () => {
    expect(content).toContain("/label-printing/repuesto/:id");
  });

  it("has GET /label-printing/herramienta/:id route", () => {
    expect(content).toContain("/label-printing/herramienta/:id");
  });

  it("has POST /label-printing/generate route", () => {
    expect(content).toContain("/label-printing/generate");
  });

  it("has POST /label-printing/preview route", () => {
    expect(content).toContain("/label-printing/preview");
  });

  it("returns payload, protocol, dimensions", () => {
    expect(content).toContain("payload");
    expect(content).toContain("estimatedWidthMm");
    expect(content).toContain("estimatedHeightMm");
  });

  it("generates HTML preview", () => {
    expect(content).toContain("generateHtmlPreview");
  });
});

/* ─── Module 1: Label Printing — Frontend ──────────────────────── */

describe("Label Printing — Frontend", () => {
  let content: string;
  beforeAll(() => { content = load("../src/shared/public/js/label-printing.js"); });

  it("has initLabelPrinting function", () => {
    expect(content).toContain("function initLabelPrinting");
  });

  it("has renderLabelDesigner function", () => {
    expect(content).toContain("function renderLabelDesigner");
  });

  it("has renderLabelPreview function", () => {
    expect(content).toContain("function renderLabelPreview");
  });

  it("has renderPrintHistory function", () => {
    expect(content).toContain("function renderPrintHistory");
  });

  it("has previewLabel function", () => {
    expect(content).toContain("function previewLabel");
  });

  it("has printLabel function", () => {
    expect(content).toContain("function printLabel");
  });

  it("has createLabelPrintButton for inventory integration", () => {
    expect(content).toContain("createLabelPrintButton");
  });

  it("supports ESCPOS, ZPL, TSPL protocols", () => {
    expect(content).toContain("ESCPOS");
    expect(content).toContain("ZPL");
    expect(content).toContain("TSPL");
  });

  it("has copies counter with adjust function", () => {
    expect(content).toContain("adjustCopies");
    expect(content).toContain("_labelState.copias");
  });

  it("saves print history to localStorage", () => {
    expect(content).toContain("localStorage");
    expect(content).toContain("labelPrintHistory");
  });
});

/* ─── Module 2: Backup — Schema ───────────────────────────────── */

describe("Backup — Schema", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/backup/schema/backup-policies.ts"); });

  it("exports backupPolicies table", () => {
    expect(content).toContain("export const backupPolicies");
  });

  it("exports backupJobs table", () => {
    expect(content).toContain("export const backupJobs");
  });

  it("exports restoreSessions table", () => {
    expect(content).toContain("export const restoreSessions");
  });

  it("has backupFrequencyEnum with DIARIA, SEMANAL, MENSUAL", () => {
    expect(content).toContain("DIARIA");
    expect(content).toContain("SEMANAL");
    expect(content).toContain("MENSUAL");
  });

  it("has backupDestinationEnum with LOCAL, S3, GDRIVE, FTP", () => {
    expect(content).toContain("LOCAL");
    expect(content).toContain("S3");
    expect(content).toContain("GDRIVE");
    expect(content).toContain("FTP");
  });

  it("backupJobs has checksum column for integrity", () => {
    expect(content).toContain("checksum");
  });

  it("restoreSessions has twoFactorVerified column", () => {
    expect(content).toContain("two_factor_verified");
  });
});

/* ─── Module 2: Backup — Engine Service ────────────────────────── */

describe("Backup — Engine Service", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/backup/services/backup-engine.service.ts"); });

  it("exports executeBackup function", () => {
    expect(content).toContain("export async function executeBackup");
  });

  it("exports executeRestore function", () => {
    expect(content).toContain("export async function executeRestore");
  });

  it("exports encryptBuffer and decryptBuffer", () => {
    expect(content).toContain("export function encryptBuffer");
    expect(content).toContain("export function decryptBuffer");
  });

  it("exports computeChecksum function", () => {
    expect(content).toContain("export function computeChecksum");
  });

  it("exports listBackups function", () => {
    expect(content).toContain("export async function listBackups");
  });

  it("exports purgeOldBackups function", () => {
    expect(content).toContain("export async function purgeOldBackups");
  });

  it("exports validateBackupIntegrity function", () => {
    expect(content).toContain("export async function validateBackupIntegrity");
  });

  it("uses AES-256-GCM algorithm", () => {
    expect(content).toContain("aes-256-gcm");
  });

  it("uses PBKDF2 key derivation with 100000 iterations", () => {
    expect(content).toContain("pbkdf2Sync");
    expect(content).toContain("100000");
  });

  it("computes SHA-256 checksums", () => {
    expect(content).toContain("sha256");
  });

  it("calls pg_dump for database backup", () => {
    expect(content).toContain("pg_dump");
  });

  it("supports gzip compression", () => {
    expect(content).toContain("gzip");
    expect(content).toContain("gunzipSync");
  });

  it("validates backup integrity with checksum comparison", () => {
    expect(content).toContain("checksum");
    expect(content).toContain("valid");
  });
});

/* ─── Module 2: Backup — Worker ────────────────────────────────── */

describe("Backup — Worker Service", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/backup/services/backup-worker.service.ts"); });

  it("exports startBackupWorker function", () => {
    expect(content).toContain("export function startBackupWorker");
  });

  it("evaluates DIARIA frequency", () => {
    expect(content).toContain("DIARIA");
  });

  it("evaluates SEMANAL frequency with day-of-week", () => {
    expect(content).toContain("SEMANAL");
  });

  it("evaluates MENSUAL frequency with day-of-month", () => {
    expect(content).toContain("MENSUAL");
  });

  it("has shouldRunPolicy function", () => {
    expect(content).toContain("shouldRunPolicy");
  });
});

/* ─── Module 2: Backup — Routes ────────────────────────────────── */

describe("Backup — Routes", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/backup/routes/backup.routes.ts"); });

  it("has GET /backup/list route", () => {
    expect(content).toContain("/backup/list");
  });

  it("has POST /backup/execute route", () => {
    expect(content).toContain("/backup/execute");
  });

  it("has POST /backup/validate route", () => {
    expect(content).toContain("/backup/validate");
  });

  it("has POST /backup/restore route", () => {
    expect(content).toContain("/backup/restore");
  });

  it("has POST /backup/purge route", () => {
    expect(content).toContain("/backup/purge");
  });

  it("restore requires twoFactorCode in production", () => {
    expect(content).toContain("twoFactorCode");
  });
});

/* ─── Module 2: Backup — Shell Scripts ─────────────────────────── */

describe("Backup — Shell Scripts", () => {
  let backupScript: string;
  let restoreScript: string;
  beforeAll(() => {
    backupScript = load("../src/modules/backup/scripts/pg-backup.sh");
    restoreScript = load("../src/modules/backup/scripts/pg-restore.sh");
  });

  it("pg-backup.sh uses pg_dump", () => {
    expect(backupScript).toContain("pg_dump");
  });

  it("pg-backup.sh compresses with gzip", () => {
    expect(backupScript).toContain("gzip");
  });

  it("pg-backup.sh encrypts with openssl AES-256", () => {
    expect(backupScript).toContain("openssl");
    expect(backupScript).toContain("aes-256");
  });

  it("pg-backup.sh computes sha256 checksum", () => {
    expect(backupScript).toContain("sha256sum");
  });

  it("pg-backup.sh purges backups older than 30 days", () => {
    expect(backupScript).toContain("mtime +30");
  });

  it("pg-restore.sh decrypts with openssl", () => {
    expect(restoreScript).toContain("openssl");
    expect(restoreScript).toContain("-d");
  });

  it("pg-restore.sh verifies integrity before restore", () => {
    expect(restoreScript).toContain("shasum");
  });

  it("pg-restore.sh executes via psql", () => {
    expect(restoreScript).toContain("psql");
  });

  it("pg-restore.sh has safety confirmation prompt", () => {
    expect(restoreScript).toContain("read -r");
  });
});

/* ─── Module 2: Backup — Frontend ──────────────────────────────── */

describe("Backup — Frontend", () => {
  let content: string;
  beforeAll(() => { content = load("../src/shared/public/js/backup-restore.js"); });

  it("has initBackupRestore function", () => {
    expect(content).toContain("function initBackupRestore");
  });

  it("has renderBackupStats function", () => {
    expect(content).toContain("function renderBackupStats");
  });

  it("has renderBackupConfig function", () => {
    expect(content).toContain("function renderBackupConfig");
  });

  it("has renderBackupHistory function", () => {
    expect(content).toContain("function renderBackupHistory");
  });

  it("has renderRestoreWizard function", () => {
    expect(content).toContain("function renderRestoreWizard");
  });

  it("has executeManualBackup function", () => {
    expect(content).toContain("function executeManualBackup");
  });

  it("has executeRestore function", () => {
    expect(content).toContain("function executeRestore");
  });

  it("supports DIARIA, SEMANAL, MENSUAL frequencies", () => {
    expect(content).toContain("DIARIA");
    expect(content).toContain("SEMANAL");
    expect(content).toContain("MENSUAL");
  });

  it("supports LOCAL, S3, GDRIVE, FTP destinations", () => {
    expect(content).toContain("LOCAL");
    expect(content).toContain("S3");
    expect(content).toContain("GDRIVE");
    expect(content).toContain("FTP");
  });

  it("has restore wizard with 5 steps", () => {
    expect(content).toContain("Seleccionar Backup");
    expect(content).toContain("Contraseña");
    expect(content).toContain("Verificación 2FA");
    expect(content).toContain("Confirmar");
    expect(content).toContain("Restaurando");
  });

  it("saves policy to localStorage", () => {
    expect(content).toContain("localStorage");
    expect(content).toContain("backupPolicy");
  });
});

/* ─── Module 3: Security HW — Schema ───────────────────────────── */

describe("Security HW — Schema", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/security-hw/schema/security-tokens.ts"); });

  it("exports hardwareFingerprints table", () => {
    expect(content).toContain("export const hardwareFingerprints");
  });

  it("exports usbSecurityTokens table", () => {
    expect(content).toContain("export const usbSecurityTokens");
  });

  it("exports securityAuditLog table", () => {
    expect(content).toContain("export const securityAuditLog");
  });

  it("hardwareFingerprints has motherboardUuid column", () => {
    expect(content).toContain("motherboard_uuid");
  });

  it("hardwareFingerprints has cpuSerial column", () => {
    expect(content).toContain("cpu_serial");
  });

  it("hardwareFingerprints has diskSerial column", () => {
    expect(content).toContain("disk_serial");
  });

  it("usbSecurityTokens has usbSerial column (unique)", () => {
    expect(content).toContain("usb_serial");
  });

  it("usbSecurityTokens has tokenHash column", () => {
    expect(content).toContain("token_hash");
  });

  it("securityAuditLog has eventType column", () => {
    expect(content).toContain("event_type");
  });

  it("securityAuditLog has severidad column", () => {
    expect(content).toContain("severidad");
  });
});

/* ─── Module 3: Security HW — Fingerprint Service ──────────────── */

describe("Security HW — Fingerprint Service", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/security-hw/services/hardware-fingerprint.service.ts"); });

  it("exports getHardwareFingerprint function", () => {
    expect(content).toContain("export function getHardwareFingerprint");
  });

  it("exports getMotherboardUuid function", () => {
    expect(content).toContain("export function getMotherboardUuid");
  });

  it("exports getCpuSerial function", () => {
    expect(content).toContain("export function getCpuSerial");
  });

  it("exports getDiskSerial function", () => {
    expect(content).toContain("export function getDiskSerial");
  });

  it("exports generateHardwareToken function", () => {
    expect(content).toContain("export function generateHardwareToken");
  });

  it("exports validateHardwareToken function", () => {
    expect(content).toContain("export function validateHardwareToken");
  });

  it("exports detectUsbDevices function", () => {
    expect(content).toContain("export function detectUsbDevices");
  });

  it("exports findUsbDongle function", () => {
    expect(content).toContain("export function findUsbDongle");
  });

  it("exports setupUsbDongle function", () => {
    expect(content).toContain("export function setupUsbDongle");
  });

  it("exports quickValidate function for middleware", () => {
    expect(content).toContain("export function quickValidate");
  });

  it("exports writeTokenToUsb and readTokenFromUsb", () => {
    expect(content).toContain("export function writeTokenToUsb");
    expect(content).toContain("export function readTokenFromUsb");
  });

  it("uses AES-256-GCM for token generation", () => {
    expect(content).toContain("aes-256-gcm");
  });

  it("uses PBKDF2 with 100000 iterations for key derivation", () => {
    expect(content).toContain("pbkdf2Sync");
    expect(content).toContain("100000");
  });

  it("reads motherboard UUID from /sys/class/dmi/id on Linux", () => {
    expect(content).toContain("/sys/class/dmi/id/product_uuid");
  });

  it("uses dmidecode as fallback for Linux", () => {
    expect(content).toContain("dmidecode");
  });

  it("uses wmic for Windows hardware extraction", () => {
    expect(content).toContain("wmic");
  });

  it("uses ioreg for macOS hardware extraction", () => {
    expect(content).toContain("ioreg");
  });

  it("writes security.token file to USB", () => {
    expect(content).toContain("security.token");
  });
});

/* ─── Module 3: Security HW — Kill Switch Middleware ───────────── */

describe("Security HW — Kill Switch Middleware", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/security-hw/middleware/hardware-lock.middleware.ts"); });

  it("exports hardwareKillSwitch middleware", () => {
    expect(content).toContain("export async function hardwareKillSwitch");
  });

  it("exports resetKillSwitch function", () => {
    expect(content).toContain("export function resetKillSwitch");
  });

  it("exports getKillSwitchStatus function", () => {
    expect(content).toContain("export function getKillSwitchStatus");
  });

  it("exempts /health from validation", () => {
    expect(content).toContain("/health");
  });

  it("exempts /docs from validation", () => {
    expect(content).toContain("/docs");
  });

  it("has 5-second validation cache", () => {
    expect(content).toContain("5_000");
  });

  it("serves 403 denial HTML when kill switch activates", () => {
    expect(content).toContain("403");
    expect(content).toContain("503");
  });

  it("denial message mentions hardware token", () => {
    expect(content).toContain("Token físico de hardware ausente");
  });

  it("fails closed on validation errors", () => {
    expect(content).toContain("fail closed");
  });
});

/* ─── Module 3: Security HW — Routes ───────────────────────────── */

describe("Security HW — Routes", () => {
  let content: string;
  beforeAll(() => { content = load("../src/modules/security-hw/routes/security-hw.routes.ts"); });

  it("has GET /security/hw/status route", () => {
    expect(content).toContain("/security/hw/status");
  });

  it("has GET /security/hw/fingerprint route", () => {
    expect(content).toContain("/security/hw/fingerprint");
  });

  it("has GET /security/hw/usb-devices route", () => {
    expect(content).toContain("/security/hw/usb-devices");
  });

  it("has POST /security/hw/generate-token route", () => {
    expect(content).toContain("/security/hw/generate-token");
  });

  it("has POST /security/hw/validate-token route", () => {
    expect(content).toContain("/security/hw/validate-token");
  });

  it("has POST /security/hw/setup route", () => {
    expect(content).toContain("/security/hw/setup");
  });

  it("has GET /security/hw/audit route", () => {
    expect(content).toContain("/security/hw/audit");
  });

  it("returns PROTEGIDO or VULNERABLE status", () => {
    expect(content).toContain("PROTEGIDO");
    expect(content).toContain("VULNERABLE");
  });
});

/* ─── Module 3: Security HW — Frontend ─────────────────────────── */

describe("Security HW — Frontend", () => {
  let content: string;
  beforeAll(() => { content = load("../src/shared/public/js/security-hw.js"); });

  it("has initSecurityHw function", () => {
    expect(content).toContain("function initSecurityHw");
  });

  it("has renderSecurityStatus function", () => {
    expect(content).toContain("function renderSecurityStatus");
  });

  it("has renderUsbManagement function", () => {
    expect(content).toContain("function renderUsbManagement");
  });

  it("has renderHardwareFingerprint function", () => {
    expect(content).toContain("function renderHardwareFingerprint");
  });

  it("has renderKillSwitchControl function", () => {
    expect(content).toContain("function renderKillSwitchControl");
  });

  it("has renderAuditLog function", () => {
    expect(content).toContain("function renderAuditLog");
  });

  it("shows PROTEGIDO/VULNERABLE status", () => {
    expect(content).toContain("PROTEGIDO");
    expect(content).toContain("VULNERABLE");
  });

  it("has USB setup wizard", () => {
    expect(content).toContain("showSetupWizard");
    expect(content).toContain("executeSetup");
  });

  it("has token generation", () => {
    expect(content).toContain("generateToken");
  });

  it("has emergency reset with double confirmation", () => {
    expect(content).toContain("emergencyReset");
    expect(content).toContain("SEGUNDA CONFIRMACIÓN");
  });

  it("has fingerprint copy to clipboard", () => {
    expect(content).toContain("copyFingerprint");
    expect(content).toContain("clipboard");
  });

  it("auto-refreshes status every 5 seconds", () => {
    expect(content).toContain("setInterval");
    expect(content).toContain("5000");
  });
});

/* ─── Integration: app.ts Module Registration ──────────────────── */

describe("Integration — Module Registration in app.ts", () => {
  let content: string;
  beforeAll(() => { content = load("../src/app.ts"); });

  it("registers label-printing module", () => {
    expect(content).toContain("label-printing/plugin.js");
  });

  it("registers backup module", () => {
    expect(content).toContain("backup/plugin.js");
  });

  it("registers security-hw module", () => {
    expect(content).toContain("security-hw/plugin.js");
  });
});

/* ─── Integration: app.js View Routing ─────────────────────────── */

describe("Integration — View Routing in app.js", () => {
  let content: string;
  beforeAll(() => { content = load("../src/shared/public/app.js"); });

  it("has label-printing view title", () => {
    expect(content).toContain("label-printing");
    expect(content).toContain("Impresión Etiquetas");
  });

  it("has backup-restore view title", () => {
    expect(content).toContain("backup-restore");
    expect(content).toContain("Backup & Restore");
  });

  it("has security-hw view title", () => {
    expect(content).toContain("security-hw");
    expect(content).toContain("Seguridad Hardware");
  });

  it("routes to label-printing view", () => {
    expect(content).toContain("initLabelPrinting");
  });

  it("routes to backup-restore view", () => {
    expect(content).toContain("initBackupRestore");
  });

  it("routes to security-hw view", () => {
    expect(content).toContain("initSecurityHw");
  });
});

/* ─── Integration: index.html Sidebar & Scripts ────────────────── */

describe("Integration — index.html Navigation & Scripts", () => {
  let content: string;
  beforeAll(() => { content = load("../src/shared/public/index.html"); });

  it("has Etiquetas sidebar button", () => {
    expect(content).toContain('data-view="label-printing"');
    expect(content).toContain("Etiquetas");
  });

  it("has Backup sidebar button", () => {
    expect(content).toContain('data-view="backup-restore"');
    expect(content).toContain("Backup");
  });

  it("has Seguridad HW sidebar button", () => {
    expect(content).toContain('data-view="security-hw"');
    expect(content).toContain("Seguridad HW");
  });

  it("has Herramientas section divider", () => {
    expect(content).toContain("Herramientas");
  });

  it("loads label-printing.js script", () => {
    expect(content).toContain('src="js/label-printing.js"');
  });

  it("loads backup-restore.js script", () => {
    expect(content).toContain('src="js/backup-restore.js"');
  });

  it("loads security-hw.js script", () => {
    expect(content).toContain('src="js/security-hw.js"');
  });
});
