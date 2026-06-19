/**
 * Client Portal Auth — Magic link + PIN authentication.
 *
 * Features:
 *   - Magic link generation (email-based)
 *   - PIN-based quick login
 *   - Session tokens (JWT, 24h expiry)
 *   - Rate limiting (5 attempts per 15 min)
 *
 * @module client-portal/services/portal-auth.service
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { clients } from "../../../shared/database/schema/clients.js";
import crypto from "crypto";

/** Portal session */
interface PortalSession {
  clientId: string;
  tenantSlug: string;
  email: string;
  name: string;
  expiresAt: number;
}

/** In-memory rate limiter (production: use Redis) */
const rateLimiter: Map<string, { attempts: number; resetAt: number }> = new Map();

/** In-memory magic links (production: use DB + email service) */
const magicLinks: Map<string, { clientId: string; tenantSlug: string; expiresAt: number }> = new Map();

/** In-memory PINs (production: use DB) */
const pinStore: Map<string, { hash: string; clientId: string; tenantSlug: string }> = new Map();

const SESSION_SECRET = process.env["PORTAL_SESSION_SECRET"] || "portal-dev-secret-change-in-prod";
const MAGIC_LINK_EXPIRY = 15 * 60 * 1000; // 15 minutes
const PIN_EXPIRY = 5 * 60 * 1000; // 5 minutes

// ─── Rate Limiting ──────────────────────────

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(key, { attempts: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }

  if (entry.attempts >= 5) return false;
  entry.attempts++;
  return true;
}

// ─── Magic Link ─────────────────────────────

/**
 * Generate a magic link for client login.
 */
export async function generateMagicLink(
  tenantSlug: string,
  email: string,
): Promise<{ success: boolean; message: string; link?: string }> {
  const rateKey = `magic:${tenantSlug}:${email}`;
  if (!checkRateLimit(rateKey)) {
    return { success: false, message: "Demasiados intentos. Esperá 15 minutos." };
  }

  // Find client by email
  const [client] = await db()
    .select({ id: clients.id, name: clients.name, email: clients.email })
    .from(clients)
    .where(
      and(
        eq(clients.tenantSlug, tenantSlug),
        eq(clients.email, email),
      ),
    )
    .limit(1);

  if (!client) {
    // Don't reveal if email exists (security)
    return { success: true, message: "Si el email existe, recibirás un enlace mágico." };
  }

  // Generate token
  const token = crypto.randomBytes(32).toString("hex");
  magicLinks.set(token, {
    clientId: client.id,
    tenantSlug,
    expiresAt: Date.now() + MAGIC_LINK_EXPIRY,
  });

  // In production: send email with link
  // For now: return the link directly
  const link = `/portal/auth/magic/${token}?tenant=${tenantSlug}`;

  return {
    success: true,
    message: "Enlace mágico generado.",
    link, // In production, don't return this — send via email
  };
}

/**
 * Validate a magic link token and create session.
 */
export async function validateMagicLink(
  token: string,
): Promise<{ session: PortalSession | null; error?: string }> {
  const entry = magicLinks.get(token);

  if (!entry) {
    return { session: null, error: "Enlace inválido o expirado." };
  }

  if (Date.now() > entry.expiresAt) {
    magicLinks.delete(token);
    return { session: null, error: "Enlace expirado. Solicitá uno nuevo." };
  }

  // Get client info
  const [client] = await db()
    .select({ id: clients.id, name: clients.name, email: clients.email })
    .from(clients)
    .where(eq(clients.id, entry.clientId))
    .limit(1);

  if (!client) {
    return { session: null, error: "Cliente no encontrado." };
  }

  // Clean up used token
  magicLinks.delete(token);

  return {
    session: {
      clientId: client.id,
      tenantSlug: entry.tenantSlug,
      email: client.email || "",
      name: client.name || "",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
    },
  };
}

// ─── PIN Auth ───────────────────────────────

/**
 * Generate a PIN for client quick login.
 */
export async function generatePIN(
  tenantSlug: string,
  clientId: string,
): Promise<{ success: boolean; pin?: string; message: string }> {
  const rateKey = `pin:${tenantSlug}:${clientId}`;
  if (!checkRateLimit(rateKey)) {
    return { success: false, message: "Demasiados intentos. Esperá 15 minutos." };
  }

  // ALTO-06 FIX: Use cryptographically secure random for PIN generation
  const { randomInt } = await import("node:crypto");
  const pin = String(randomInt(100000, 999999));
  const hash = crypto.createHash("sha256").update(pin).digest("hex");

  pinStore.set(`${tenantSlug}:${clientId}`, {
    hash,
    clientId,
    tenantSlug,
  });

  return {
    success: true,
    pin, // In production: send via SMS
    message: "PIN generado.",
  };
}

/**
 * Validate a PIN and create session.
 */
export async function validatePIN(
  tenantSlug: string,
  clientId: string,
  pin: string,
): Promise<{ session: PortalSession | null; error?: string }> {
  const rateKey = `pin-auth:${tenantSlug}:${clientId}`;
  if (!checkRateLimit(rateKey)) {
    return { session: null, error: "Demasiados intentos. Esperá 15 minutos." };
  }

  const entry = pinStore.get(`${tenantSlug}:${clientId}`);
  if (!entry) {
    return { session: null, error: "PIN no encontrado. Solicitá uno nuevo." };
  }

  const hash = crypto.createHash("sha256").update(pin).digest("hex");
  if (hash !== entry.hash) {
    return { session: null, error: "PIN incorrecto." };
  }

  // Clean up used PIN
  pinStore.delete(`${tenantSlug}:${clientId}`);

  // Get client info
  const [client] = await db()
    .select({ id: clients.id, name: clients.name, email: clients.email })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return { session: null, error: "Cliente no encontrado." };
  }

  return {
    session: {
      clientId: client.id,
      tenantSlug,
      email: client.email || "",
      name: client.name || "",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    },
  };
}

/**
 * Simple session token encoder (base64 JSON).
 * In production: use JWT with proper signing.
 */
export function encodeSession(session: PortalSession): string {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

/**
 * Decode and validate session token.
 */
export function decodeSession(token: string): PortalSession | null {
  try {
    const session: PortalSession = JSON.parse(
      Buffer.from(token, "base64url").toString(),
    );
    if (Date.now() > session.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}
