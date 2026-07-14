/**
 * Clerk JWT Verification — JWKS-based RS256 token verification.
 *
 * Verifies Clerk-issued JWTs using their JWKS endpoint.
 * Replaces the insecure header-trust model with cryptographic verification.
 *
 * Flow:
 *   1. Extract Bearer token from Authorization header
 *   2. Fetch Clerk's JWKS (cached for 1 hour)
 *   3. Find matching public key by kid header
 *   4. Verify RS256 signature + expiry
 *   5. Return decoded claims (userId, email, orgId, etc.)
 *
 * OWASP Top 10 2021 — A07:2021 Identification and Authentication Failures
 *
 * @module shared/services/clerk-verify
 */

import { createPublicKey, createVerify } from "node:crypto";

/* ── JWKS Cache ──────────────────────────────── */

interface JwksKey {
  kty: string;
  kid: string;
  n: string;
  e: string;
  alg: string;
  use: string;
}

interface JwksCache {
  keys: JwksKey[];
  fetchedAt: number;
}

let jwksCache: JwksCache | null = null;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/* ── Types ───────────────────────────────────── */

/** Claims from a verified Clerk JWT */
export interface ClerkUserClaims {
  /** Clerk user ID (e.g. "user_xxx") */
  sub: string;
  /** Email address */
  email?: string;
  /** Email verified flag */
  email_verified?: boolean;
  /** Full name */
  name?: string;
  /** Profile image URL */
  image?: string;
  /** Clerk organization ID (maps to tenant) */
  org_id?: string;
  /** Clerk organization slug (maps to tenant slug) */
  org_slug?: string;
  /** User's role within the organization */
  org_role?: string;
  /** Token issued at (unix seconds) */
  iat: number;
  /** Token expiry (unix seconds) */
  exp: number;
  /** Issuer (should be "https://clerk.your-app.com") */
  iss?: string;
}

/* ── JWKS Fetching ───────────────────────────── */

/**
 * Fetch Clerk's JWKS (JSON Web Key Set) for token verification.
 * Caches keys for 1 hour to avoid hitting Clerk on every request.
 */
async function fetchJwks(): Promise<JwksKey[]> {
  // Return cached keys if still valid
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }

  const clerkPublishableKey = process.env["CLERK_PUBLISHABLE_KEY"];
  if (!clerkPublishableKey) {
    throw new Error("CLERK_PUBLISHABLE_KEY not configured");
  }

  // Extract the issuer domain from the publishable key
  // Clerk publishable keys look like: pk_test_xxx or pk_live_xxx
  // The JWKS endpoint is at: https://clerk.<domain>/.well-known/jwks.json
  // But we need the actual frontend API URL
  const clerkApiUrl = process.env["CLERK_API_URL"] || "https://api.clerk.com";

  // For Clerk, the JWKS endpoint is typically at the frontend API domain
  // We'll use the standard Clerk JWKS endpoint pattern
  const jwksUrl = `${clerkApiUrl}/.well-known/jwks.json`;

  try {
    const res = await fetch(jwksUrl, {
      headers: {
        "Authorization": `Bearer ${clerkPublishableKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch JWKS: ${res.status}`);
    }

    const data = await res.json() as { keys: JwksKey[] };
    jwksCache = { keys: data.keys, fetchedAt: Date.now() };
    return data.keys;
  } catch (err) {
    // If cache exists, use stale keys
    if (jwksCache) {
      return jwksCache.keys;
    }
    throw err;
  }
}

/* ── JWT Decoding (no verification) ──────────── */

function base64urlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64");
}

function decodeJwtParts(token: string): { header: Record<string, unknown>; payload: Record<string, unknown>; signingInput: string; signature: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;

  try {
    const header = JSON.parse(base64urlDecode(headerB64!).toString()) as Record<string, unknown>;
    const payload = JSON.parse(base64urlDecode(payloadB64!).toString()) as Record<string, unknown>;
    return { header, payload, signingInput: `${headerB64}.${payloadB64}`, signature: signature! };
  } catch {
    return null;
  }
}

/* ── RSA Signature Verification ──────────────── */

/**
 * Convert a JWK (JSON Web Key) to a Node.js crypto KeyObject.
 * Supports RSA keys (RS256, RS384, RS512).
 */
function jwkToPublicKey(jwk: JwksKey): ReturnType<typeof createPublicKey> {
  const publicKeyPem = convertPublicKeyToPem(jwk);
  return createPublicKey(publicKeyPem);
}

/**
 * Convert JWK RSA key to PEM format for Node.js crypto.
 */
function convertPublicKeyToPem(jwk: JwksKey): string {
  // Use Node.js crypto to convert JWK to PEM
  const { createPublicKey } = require("node:crypto") as typeof import("node:crypto");
  const keyObject = createPublicKey({ format: "jwk", key: { kty: jwk.kty, n: jwk.n, e: jwk.e } });
  return keyObject.export({ type: "spki", format: "pem" }) as string;
}

/**
 * Verify RSA signature using Node.js crypto.
 */
function verifyRsaSignature(
  signingInput: string,
  signature: string,
  publicKey: ReturnType<typeof createPublicKey>,
  algorithm: string,
): boolean {
  const algMap: Record<string, string> = {
    RS256: "sha256",
    RS384: "sha384",
    RS512: "sha512",
  };

  const hashAlg = algMap[algorithm];
  if (!hashAlg) return false;

  const verify = createVerify(hashAlg);
  verify.update(signingInput);
  verify.end();

  const sigBuffer = Buffer.from(signature, "base64url");
  return verify.verify(publicKey, sigBuffer);
}

/* ── Public API ──────────────────────────────── */

/**
 * Verify a Clerk JWT token and return the decoded claims.
 *
 * @param token - The JWT token string (without "Bearer " prefix)
 * @returns Verified claims if valid, null if invalid/expired
 */
export async function verifyClerkToken(token: string): Promise<ClerkUserClaims | null> {
  try {
    const decoded = decodeJwtParts(token);
    if (!decoded) return null;

    const { header, payload, signingInput, signature } = decoded;

    // Verify algorithm is RSA
    const alg = header["alg"] as string;
    if (!alg || !alg.startsWith("RS")) {
      return null;
    }

    // Verify issuer matches Clerk
    const issuer = payload["iss"] as string | undefined;
    const clerkIssuer = process.env["CLERK_ISSUER"];
    if (clerkIssuer && issuer !== clerkIssuer) {
      return null;
    }

    // Check expiry
    const exp = payload["exp"] as number | undefined;
    if (!exp || Date.now() / 1000 > exp) {
      return null;
    }

    // Fetch JWKS and find matching key
    const keys = await fetchJwks();
    const kid = header["kid"] as string;
    const matchingKey = keys.find((k) => k.kid === kid);

    if (!matchingKey) {
      // Key not found — maybe rotated. Force refresh JWKS.
      jwksCache = null;
      const refreshedKeys = await fetchJwks();
      const refreshedKey = refreshedKeys.find((k) => k.kid === kid);
      if (!refreshedKey) return null;

      const publicKey = jwkToPublicKey(refreshedKey);
      if (!verifyRsaSignature(signingInput, signature, publicKey, alg)) {
        return null;
      }
    } else {
      const publicKey = jwkToPublicKey(matchingKey);
      if (!verifyRsaSignature(signingInput, signature, publicKey, alg)) {
        return null;
      }
    }

    return payload as unknown as ClerkUserClaims;
  } catch {
    return null;
  }
}

/**
 * Extract a Clerk JWT from the Authorization header.
 * Expected format: "Bearer <token>"
 */
export function extractClerkToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] || null;
}

/**
 * Check if Clerk is configured (env vars present).
 */
export function isClerkConfigured(): boolean {
  return !!(process.env["CLERK_SECRET_KEY"] && process.env["CLERK_PUBLISHABLE_KEY"]);
}
