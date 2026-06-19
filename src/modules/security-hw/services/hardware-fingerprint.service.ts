/**
 * Hardware Fingerprint & Kill Switch Service.
 *
 * Extracts hardware identifiers (motherboard UUID, CPU serial, disk serial),
 * generates AES-256 tokens for USB dongle binding, and validates hardware
 * integrity at runtime.
 *
 * @module security-hw/services
 */

import { execSync } from "node:child_process";
import { randomBytes, createHash, createCipheriv, createDecipheriv, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { platform, hostname, arch } from "node:os";

// ─── Types ────────────────────────────────────

export interface HardwareFingerprint {
  motherboardUuid: string;
  cpuSerial: string;
  diskSerial: string;
  hostname: string;
  platform: string;
  arch: string;
}

export interface UsbDongleInfo {
  serial: string;
  vendorId?: string;
  productId?: string;
  model?: string;
  mountPoint?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  hardwareMatch: boolean;
  tokenIntact: boolean;
  error?: string;
  details?: string;
}

// ─── Constants ────────────────────────────────

const TOKEN_FILENAME = "security.token";
/**
 * TOKEN_SECRET — MUST come from environment variable in production.
 * Fallback is only for backward compatibility during migration.
 * CRITICAL: Remove fallback after deploying env var to all environments.
 */
const TOKEN_SECRET = process.env.TOKEN_SECRET || "AutomotiveOS-ERP-2024-SECRET-KEY-xK9mP2vL";
if (process.env.NODE_ENV === "production" && !process.env.TOKEN_SECRET) {
  console.warn("[SECURITY] ⚠️  TOKEN_SECRET not set via env var — using insecure fallback. Set TOKEN_SECRET in your environment!");
}
const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

// ─── Hardware Extraction ──────────────────────

/**
 * Execute a shell command and return stdout, or a fallback on error.
 */
function safeExec(cmd: string, fallback: string = "UNKNOWN"): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return fallback;
  }
}

/**
 * Extract motherboard UUID from the system.
 * Linux: /sys/class/dmi/id/product_uuid or dmidecode
 * Windows: wmic baseboard get serialnumber
 * macOS: ioreg
 */
export function getMotherboardUuid(): string {
  const os = platform();

  if (os === "linux") {
    // Try /sys first (most reliable on modern Linux)
    const sysPath = "/sys/class/dmi/id/product_uuid";
    if (existsSync(sysPath)) {
      try {
        return readFileSync(sysPath, "utf-8").trim();
      } catch { /* fallback */ }
    }
    // Fallback to dmidecode (requires root or sudo)
    return safeExec("sudo dmidecode -s system-uuid", "LINUX-UNKNOWN-UUID");
  }

  if (os === "win32") {
    return safeExec(
      'wmic baseboard get serialnumber',
      "WIN32-UNKNOWN-UUID",
    ).split("\n").filter(Boolean).pop()?.trim() || "WIN32-UNKNOWN-UUID";
  }

  if (os === "darwin") {
    return safeExec(
      "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { print $3 }'",
      "DARWIN-UNKNOWN-UUID",
    );
  }

  return "UNKNOWN-UUID";
}

/**
 * Extract CPU serial number.
 */
export function getCpuSerial(): string {
  const os = platform();

  if (os === "linux") {
    return safeExec(
      "cat /proc/cpuinfo | grep 'Serial' | awk '{print $3}'",
      safeExec("dmidecode -t processor | grep 'ID:' | head -1 | awk '{print $2}'", "LINUX-CPU-UNKNOWN"),
    );
  }

  if (os === "win32") {
    return safeExec(
      "wmic cpu get ProcessorId",
      "WIN32-CPU-UNKNOWN",
    ).split("\n").filter(Boolean).pop()?.trim() || "WIN32-CPU-UNKNOWN";
  }

  if (os === "darwin") {
    return safeExec(
      "sysctl -n machdep.cpu.brand_string",
      "DARWIN-CPU-UNKNOWN",
    );
  }

  return "UNKNOWN-CPU";
}

/**
 * Extract primary disk serial number.
 */
export function getDiskSerial(): string {
  const os = platform();

  if (os === "linux") {
    // Try lsblk first
    const lsblk = safeExec(
      "lsblk -dno SERIAL /dev/sda 2>/dev/null || lsblk -dno SERIAL /dev/nvme0n1 2>/dev/null",
      "",
    );
    if (lsblk && lsblk !== "") return lsblk;

    // Fallback to hdparm
    return safeExec(
      "hdparm -i /dev/sda 2>/dev/null | grep 'Serial' | awk -F= '{print $2}' | tr -d ' '",
      safeExec("cat /sys/block/sda/device serial 2>/dev/null", "LINUX-DISK-UNKNOWN"),
    );
  }

  if (os === "win32") {
    return safeExec(
      'wmic diskdrive get serialnumber',
      "WIN32-DISK-UNKNOWN",
    ).split("\n").filter(Boolean).pop()?.trim() || "WIN32-DISK-UNKNOWN";
  }

  if (os === "darwin") {
    return safeExec(
      "diskutil info disk0 | grep 'Serial Number' | awk '{print $NF}'",
      "DARWIN-DISK-UNKNOWN",
    );
  }

  return "UNKNOWN-DISK";
}

/**
 * Get full hardware fingerprint of the server.
 */
export function getHardwareFingerprint(): HardwareFingerprint {
  return {
    motherboardUuid: getMotherboardUuid(),
    cpuSerial: getCpuSerial(),
    diskSerial: getDiskSerial(),
    hostname: hostname(),
    platform: platform(),
    arch: arch(),
  };
}

// ─── USB Dongle Detection ─────────────────────

/**
 * Detect connected USB storage devices and find one matching
 * a specific serial number.
 */
export function detectUsbDevices(): UsbDongleInfo[] {
  const os = platform();
  const devices: UsbDongleInfo[] = [];

  if (os === "linux") {
    // lsblk -J for JSON output
    const json = safeExec("lsblk -J -o NAME,SERIAL,SIZE,TYPE,MOUNTPOINT 2>/dev/null", "");
    if (json) {
      try {
        const parsed = JSON.parse(json);
        for (const device of parsed.blockdevices || []) {
          if (device.type === "disk" && device.serial) {
            devices.push({
              serial: device.serial,
              model: device.name,
              mountPoint: device.mountpoint || undefined,
            });
          }
        }
      } catch { /* ignore parse errors */ }
    }

    // Also check /dev/disk/by-id/ for USB devices
    const usbIds = safeExec("ls -la /dev/disk/by-id/ 2>/dev/null | grep usb | head -10", "");
    if (usbIds) {
      for (const line of usbIds.split("\n")) {
        const match = line.match(/usb-([^\s]+)/);
        if (match && !devices.find(d => d.model === match[1])) {
          devices.push({ serial: match[1], model: match[1] });
        }
      }
    }
  }

  if (os === "win32") {
    const output = safeExec(
      'wmic logicaldisk where "DriveType=2" get DeviceID,VolumeSerialNumber,Description /format:csv',
      "",
    );
    for (const line of output.split("\n").filter(Boolean)) {
      const parts = line.split(",");
      if (parts.length >= 3 && parts[1]) {
        devices.push({
          serial: parts[1].trim(),
          mountPoint: parts[2]?.trim(),
          model: parts[3]?.trim(),
        });
      }
    }
  }

  if (os === "darwin") {
    const output = safeExec("diskutil list -external -plist 2>/dev/null", "");
    // Parse plist-like output for USB devices
    const serials = output.match(/Serial Number.*?<string>(.*?)<\/string>/gs) || [];
    for (const s of serials) {
      const match = s.match(/<string>(.*?)<\/string>/);
      if (match) {
        devices.push({ serial: match[1] });
      }
    }
  }

  return devices;
}

/**
 * Find a specific USB dongle by serial number.
 */
export function findUsbDongle(expectedSerial: string): UsbDongleInfo | null {
  const devices = detectUsbDevices();
  return devices.find(d => d.serial === expectedSerial) || null;
}

// ─── Token Generation & Validation ────────────

/**
 * Derive a 256-bit key from a password.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, 100000, 32, "sha512");
}

/**
 * Generate a hardware-bound AES-256-GCM token.
 *
 * The token is computed from:
 *   motherboardUuid + cpuSerial + diskSerial + SECRET_KEY
 *
 * Output format: [salt(32)][iv(16)][authTag(16)][encryptedIdentity]
 */
export function generateHardwareToken(fingerprint: HardwareFingerprint): string {
  const identity = [
    fingerprint.motherboardUuid,
    fingerprint.cpuSerial,
    fingerprint.diskSerial,
    TOKEN_SECRET,
  ].join("|");

  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(TOKEN_SECRET, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(identity, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const tokenBuffer = Buffer.concat([salt, iv, authTag, encrypted]);
  return tokenBuffer.toString("base64");
}

/**
 * Validate a hardware token against current hardware.
 *
 * 1. Decode the token
 * 2. Decrypt using SECRET_KEY
 * 3. Compare against current hardware fingerprint
 */
export function validateHardwareToken(tokenBase64: string): TokenValidationResult {
  try {
    const tokenBuffer = Buffer.from(tokenBase64, "base64");

    if (tokenBuffer.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      return { valid: false, hardwareMatch: false, tokenIntact: false, error: "Token demasiado corto" };
    }

    const salt = tokenBuffer.subarray(0, SALT_LENGTH);
    const iv = tokenBuffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = tokenBuffer.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );
    const encryptedData = tokenBuffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    const key = deriveKey(TOKEN_SECRET, salt);
    const decipher = createDecipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString("utf-8");

    // Parse the identity string
    const parts = decrypted.split("|");
    if (parts.length < 4 || parts[3] !== TOKEN_SECRET) {
      return { valid: false, hardwareMatch: false, tokenIntact: false, error: "Token corrupto o inválido" };
    }

    // Compare against current hardware
    const currentFingerprint = getHardwareFingerprint();
    const tokenFingerprint = {
      motherboardUuid: parts[0],
      cpuSerial: parts[1],
      diskSerial: parts[2],
    };

    // C-04 FIX: Use constant-time comparison to prevent timing attacks
    // Standard === leaks byte-by-byte timing information
    const compareField = (a: string, b: string): boolean => {
      const bufA = Buffer.from(a, "utf-8");
      const bufB = Buffer.from(b, "utf-8");
      if (bufA.length !== bufB.length) {
        // Still do the comparison to avoid timing leak on length
        timingSafeEqual(
          Buffer.alloc(bufA.length, 0),
          Buffer.alloc(bufB.length, 0),
        );
        return false;
      }
      return timingSafeEqual(bufA, bufB);
    };

    const hardwareMatch =
      compareField(tokenFingerprint.motherboardUuid, currentFingerprint.motherboardUuid) &&
      compareField(tokenFingerprint.cpuSerial, currentFingerprint.cpuSerial) &&
      compareField(tokenFingerprint.diskSerial, currentFingerprint.diskSerial);

    return {
      valid: hardwareMatch,
      hardwareMatch,
      tokenIntact: true,
      details: hardwareMatch
        ? "Hardware verificado correctamente"
        : "Hardware no coincide — posible cambio de componentes o sistema pirateado",
    };
  } catch (err: any) {
    return {
      valid: false,
      hardwareMatch: false,
      tokenIntact: false,
      error: `Error validando token: ${err.message}`,
    };
  }
}

/**
 * Write the security token to a USB device.
 */
export function writeTokenToUsb(
  usbMountPoint: string,
  tokenBase64: string,
): boolean {
  try {
    const tokenPath = join(usbMountPoint, TOKEN_FILENAME);
    writeFileSync(tokenPath, tokenBase64, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the security token from a USB device.
 */
export function readTokenFromUsb(usbMountPoint: string): string | null {
  try {
    const tokenPath = join(usbMountPoint, TOKEN_FILENAME);
    if (!existsSync(tokenPath)) return null;
    return readFileSync(tokenPath, "utf-8").trim();
  } catch {
    return null;
  }
}

/**
 * Full setup flow: generate token and write to USB.
 */
export function setupUsbDongle(
  usbMountPoint: string,
  nombre: string,
): {
  success: boolean;
  fingerprint: HardwareFingerprint;
  token?: string;
  usbSerial?: string;
  error?: string;
} {
  // 1. Get hardware fingerprint
  const fingerprint = getHardwareFingerprint();

  // 2. Generate token
  const token = generateHardwareToken(fingerprint);

  // 3. Write to USB
  const written = writeTokenToUsb(usbMountPoint, token);
  if (!written) {
    return {
      success: false,
      fingerprint,
      error: "No se pudo escribir el token en el USB. Verifique permisos.",
    };
  }

  // 4. Get USB serial
  const usbDevices = detectUsbDevices();
  const currentDevice = usbDevices.find(d =>
    usbMountPoint.includes(d.serial || "") ||
    usbMountPoint === d.mountPoint,
  );

  return {
    success: true,
    fingerprint,
    token,
    usbSerial: currentDevice?.serial,
  };
}

/**
 * Quick validation check — used by middleware on every request.
 * Returns boolean for fast path in middleware.
 */
export function quickValidate(): boolean {
  try {
    const envPath = process.env.SECURITY_TOKEN_PATH;
    const usbPath = process.env.USB_DONGLE_PATH || "/media/usb";

    // Check if USB device is present
    if (!existsSync(usbPath)) return false;

    // Check if token file exists
    const tokenPath = join(usbPath, TOKEN_FILENAME);
    if (!existsSync(tokenPath)) return false;

    // Read and validate token
    const token = readFileSync(tokenPath, "utf-8").trim();
    if (!token) return false;

    const result = validateHardwareToken(token);
    return result.valid;
  } catch {
    return false;
  }
}
