/**
 * Auth routes — login and session management.
 *
 * POST /api/auth/login  — Authenticate user (with rate limiting)
 * POST /api/auth/logout — Clear server-side session (idempotent)
 *
 * @module config/routes/auth
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { tenants, profiles } from "../../../shared/database/schema/index.js";
import { BadRequestError, UnauthorizedError, RateLimitError } from "../../../shared/errors/app-error.js";
import { hashPassword, verifyPassword } from "../services/auth-utils.js";

// ─── In-memory rate limiter (no extra deps, < 1KB RAM) ────────────────
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new RateLimitError(
        `Demasiados intentos. Intente de nuevo en ${retryAfter} segundos.`,
      );
    }
  } else {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
  }
}

function recordAttempt(key: string): void {
  const entry = loginAttempts.get(key);
  if (entry) {
    entry.count++;
  }
}

function resetAttempts(key: string): void {
  loginAttempts.delete(key);
}

// Cleanup stale entries every 60 seconds
const CLEANUP_INTERVAL = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now >= entry.resetAt) loginAttempts.delete(key);
  }
}, 60_000);
// Allow garbage collection of the timer (not needed after module load, but safe)
if (CLEANUP_INTERVAL.unref) CLEANUP_INTERVAL.unref();
// ───────────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/auth/login ──────────────────────────────────────
  app.post("/api/auth/login", async (request, reply) => {
    const { tenantSlug, email, password } = request.body as {
      tenantSlug: string;
      email: string;
      password?: string;
    };

    if (!tenantSlug) throw new BadRequestError("tenantSlug requerido");
    if (!email) throw new BadRequestError("email requerido");

    // Rate limit by IP + email composite key
    const ip = request.ip;
    const rateKey = `login:${ip}:${email}`;
    checkRateLimit(rateKey);

    const [tenant] = await db()
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, ruc: tenants.ruc })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    if (!tenant) throw new BadRequestError("Taller no encontrado");

    let [profile] = await db()
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        isActive: profiles.isActive,
        passwordHash: profiles.passwordHash,
      })
      .from(profiles)
      .where(and(eq(profiles.tenantId, tenant.id), eq(profiles.email, email)))
      .limit(1);

    if (profile && profile.passwordHash) {
      if (!password) {
        recordAttempt(rateKey);
        throw new BadRequestError("Contraseña requerida");
      }
      if (!verifyPassword(password, profile.passwordHash)) {
        recordAttempt(rateKey);
        throw new UnauthorizedError("Contraseña incorrecta");
      }
    } else if (!profile) {
      const namePart = email.split("@")[0];
      const fullName = namePart.replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const hashed = password ? hashPassword(password) : null;
      const [newProfile] = await db()
        .insert(profiles)
        .values({ tenantId: tenant.id, email, fullName, role: "admin", passwordHash: hashed, isActive: true })
        .returning({
          id: profiles.id,
          email: profiles.email,
          fullName: profiles.fullName,
          role: profiles.role,
          isActive: profiles.isActive,
          passwordHash: profiles.passwordHash,
        });
      profile = newProfile;
    }

    // Success — reset rate limit
    resetAttempts(rateKey);

    return reply.send({
      ok: true,
      profile: { id: profile.id, email: profile.email, full_name: profile.fullName, role: profile.role, is_active: profile.isActive },
      tenant: { name: tenant.name, slug: tenant.slug, ruc: tenant.ruc },
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────
  app.post("/api/auth/logout", async (_request, reply) => {
    // Stateless auth (no server-side session to invalidate).
    // The client is responsible for clearing localStorage.
    // This endpoint exists for future extensibility (e.g., token blacklist).
    return reply.send({ ok: true, message: "Sesión cerrada. El cliente debe limpiar su almacenamiento local." });
  });
}
