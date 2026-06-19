/**
 * JWT Authentication Service — Token generation and verification.
 *
 * Provides HMAC-SHA256 signed JWT tokens for stateless authentication.
 * Replaces the insecure header-trust model with cryptographic verification.
 *
 * OWASP Top 10 2021 — A07:2021 Identification and Authentication Failures
 *
 * @module shared/services/auth-jwt
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const JWT_SECRET = process.env["JWT_SECRET"] || (() => {
  // Auto-generate a secret for development; MUST be set in production
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return randomBytes(64).toString("hex");
})();

const TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

interface JwtPayload {
  sub: string;        // user ID
  email: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  iat: number;
  exp: number;
}

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

function base64url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64");
}

function sign(payload: string): string {
  return base64url(createHmac("sha256", JWT_SECRET).update(payload).digest());
}

/**
 * Generate a signed JWT token for an authenticated user.
 */
export function generateToken(user: {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
}): string {
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    iat: now,
    exp: now + Math.floor(TOKEN_EXPIRY_MS / 1000),
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = sign(`${headerB64}.${payloadB64}`);

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify and decode a JWT token.
 * Returns the payload if valid, null if invalid/expired.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    // Verify signature
    const expectedSig = sign(`${headerB64}.${payloadB64}`);
    const sigBuffer = Buffer.from(signature!, "base64url");
    const expectedBuffer = Buffer.from(expectedSig, "base64url");

    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    // Decode payload
    const payload: JwtPayload = JSON.parse(base64urlDecode(payloadB64!).toString());

    // Check expiry
    if (Date.now() / 1000 > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header.
 * Expected format: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] || null;
}

/**
 * Mask an email for logging (show first 2 chars + domain).
 * Example: "ju***@gmail.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `**@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 8))}@${domain}`;
}

/**
 * Mask an IP address for logging.
 * Example: "192.168.***.***"
 */
export function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return "***.***.***.***";
  return `${parts[0]}.${parts[1]}.***.***`;
}
