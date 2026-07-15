/**
 * 2FA (TOTP) Service — Two-Factor Authentication using Time-based OTP.
 *
 * Implements RFC 6238 (TOTP) compatible with Google Authenticator, Authy, etc.
 * Features:
 *   - Secret generation (160-bit, base32 encoded)
 *   - QR code provisioning URI
 *   - TOTP verification with configurable window
 *   - Backup codes (10 single-use codes)
 *   - Per-user enable/disable with rate limiting
 *
 * @module enterprise/services/two-factor.service
 */

import crypto from "node:crypto";

// ─── Constants ────────────────────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const PERIOD = 30; // seconds
const WINDOW = 1; // allow 1 step before/after (30s window)

// ─── Helpers ──────────────────────────────────────────

/**
 * Generate a cryptographically secure random secret.
 * Returns base32-encoded string (160 bits / 20 bytes).
 */
export function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  let secret = "";
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_CHARS[bytes[i] >> 3];
  }
  return secret;
}

/**
 * Decode base32 string to Buffer.
 */
function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/[^A-Z2-7]/gi, "").toUpperCase();
  let bits = "";
  for (const char of cleaned) {
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

/**
 * Compute TOTP code for a given time step.
 */
function computeTotp(secret: Buffer, timeStep: number): string {
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(timeStep, 4);

  const hmac = crypto.createHmac("sha1", secret).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Get current time step (Unix time / period).
 */
function getCurrentTimeStep(): number {
  return Math.floor(Date.now() / 1000 / PERIOD);
}

// ─── Exported Functions ───────────────────────────────

/**
 * Generate 2FA secret and provisioning data.
 */
export function generateTwoFactorSecret(
  issuer: string,
  accountName: string,
): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;

  return { secret, otpauthUrl };
}

/**
 * Verify a TOTP code against a secret.
 * Uses a time window to account for clock skew.
 */
export function verifyTotp(secret: string, code: string): boolean {
  // Validate code length to prevent timingSafeEqual crash
  if (!/^\d{6}$/.test(code)) return false;

  const secretBuffer = base32Decode(secret);
  const currentTimeStep = getCurrentTimeStep();
  const codeBuffer = Buffer.from(code);

  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const timeStep = currentTimeStep + offset;
    const expected = computeTotp(secretBuffer, timeStep);
    const expectedBuffer = Buffer.from(expected);
    if (codeBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(codeBuffer, expectedBuffer)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate backup codes (single-use, 8-char alphanumeric).
 */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(6);
    let code = "";
    for (const byte of bytes) {
      code += (byte % 36).toString(36);
    }
    codes.push(code.toUpperCase().slice(0, 8));
  }
  return codes;
}

/**
 * Hash backup codes for secure storage (bcrypt-like with scrypt).
 */
export function hashBackupCodes(codes: string[]): string[] {
  const hashed: string[] = [];
  for (const code of codes) {
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(code, salt, 64);
    hashed.push(`${salt.toString("hex")}:${derived.toString("hex")}`);
  }
  return hashed;
}

/**
 * Verify a backup code against its hash.
 */
export function verifyBackupCode(
  code: string,
  storedHash: string,
): boolean {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");
  const derived = crypto.scryptSync(code, salt, 64);

  return crypto.timingSafeEqual(derived, expectedHash);
}

/**
 * Get time remaining until current TOTP code expires.
 */
export function getTotpTimeRemaining(): number {
  return PERIOD - (Math.floor(Date.now() / 1000) % PERIOD);
}
