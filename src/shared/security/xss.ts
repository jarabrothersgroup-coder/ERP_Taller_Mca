/**
 * XSS Sanitization — Prevent cross-site scripting attacks.
 *
 * Escapes HTML entities in user-provided strings before rendering.
 * Used in API responses and frontend templates.
 *
 * @module shared/security/xss
 */

// ─── HTML Entity Map ───────────────────────────

const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
};

const ENTITY_REGEX = /[&<>"'`\/]/g;

/**
 * Escape HTML entities in a string.
 * Prevents XSS when rendering user input in HTML templates.
 *
 * @param str - Raw user string
 * @returns Escaped string safe for HTML rendering
 */
export function escapeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str.replace(ENTITY_REGEX, (char) => ENTITY_MAP[char] || char);
}

/**
 * Strip potentially dangerous HTML tags from a string.
 * Allows only safe inline formatting.
 *
 * @param str - Raw HTML string
 * @returns Sanitized string with dangerous tags removed
 */
export function stripDangerousHtml(str: string): string {
  if (typeof str !== "string") return "";
  // Remove script, iframe, object, embed, form tags and their contents
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // onclick, onerror, etc.
    .replace(/javascript\s*:/gi, ""); // javascript: protocol
}

/**
 * Sanitize a string for safe display.
 * Escapes HTML and strips dangerous content.
 *
 * @param str - Raw user input
 * @returns Sanitized string
 */
export function sanitize(str: string): string {
  return stripDangerousHtml(escapeHtml(str));
}

// ─── SQL Injection Prevention (defense in depth) ─

/**
 * Validate that a string contains no SQL injection patterns.
 * This is a defense-in-depth check — parameterized queries are the primary defense.
 *
 * @param input - User input to check
 * @returns true if safe, false if suspicious patterns detected
 */
export function isSqlSafe(input: string): boolean {
  if (typeof input !== "string") return false;

  const suspicious = [
    /'\s*OR\s+'1'\s*=\s*'1/i,
    /'\s*OR\s+1\s*=\s*1/i,
    /;\s*DROP\s+TABLE/i,
    /;\s*DELETE\s+FROM/i,
    /;\s*UPDATE\s+.*SET/i,
    /;\s*INSERT\s+INTO/i,
    /UNION\s+SELECT/i,
    /--\s*$/,
    /\/\*.*\*\//,
    /CHAR\s*\(/i,
    /0x[0-9a-f]+/i,
  ];

  return !suspicious.some((pattern) => pattern.test(input));
}

// ─── Content Security Policy Helpers ───────────

/**
 * Generate a nonce for inline scripts (CSP compliance).
 * @returns Random base64 nonce string
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  // Use crypto.getRandomValues if available (browser), else fall back
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Buffer.from(array).toString("base64");
}
