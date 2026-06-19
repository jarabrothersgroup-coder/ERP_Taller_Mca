/**
 * Auth routes — login and session management.
 *
 * POST /api/auth/login  — Authenticate user, return JWT token (with rate limiting)
 * POST /api/auth/logout — Client-side token invalidation (idempotent)
 *
 * Security:
 *   - JWT token signed with HMAC-SHA256 (no password stored client-side)
 *   - Auto-admin creation REMOVED — accounts must be created via invite or seed
 *   - Persistent rate limiting (survives restarts)
 *   - Zod validation on all inputs
 *   - No internal data leaked in error messages
 *
 * @module config/routes/auth
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { tenants, profiles } from "../../../shared/database/schema/index.js";
import { BadRequestError, UnauthorizedError } from "../../../shared/errors/app-error.js";
import { verifyPassword } from "../services/auth-utils.js";
import { generateToken } from "../../../shared/services/auth-jwt.js";
import { checkRateLimit, recordAttempt, resetAttempts } from "../../../shared/services/rate-limiter.js";
import { validateBody } from "../../../shared/schemas/validation.js";
import { loginBodySchema } from "../../../shared/schemas/validation.js";

// ─── Rate limit config ─────────────────────────────
const LOGIN_RATE_LIMIT = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/auth/login ──────────────────────────────────────
  app.post("/api/auth/login", async (request, reply) => {
    // MED-05 FIX: Validate input with Zod schema
    const { tenantSlug, email, password } = validateBody(request.body, loginBodySchema);

    // MED-04 FIX: Use persistent rate limiter
    const ip = request.ip;
    const rateKey = `login:${ip}:${email}`;
    checkRateLimit(rateKey, LOGIN_RATE_LIMIT);

    const [tenant] = await db()
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, ruc: tenants.ruc })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    if (!tenant) throw new BadRequestError("Taller no encontrado");

    const [profile] = await db()
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

    // CRIT-01 FIX: Never auto-create accounts — reject unknown emails
    if (!profile || !profile.passwordHash) {
      recordAttempt(rateKey);
      throw new UnauthorizedError("Credenciales inválidas");
    }

    if (!profile.isActive) {
      recordAttempt(rateKey);
      throw new UnauthorizedError("Credenciales inválidas");
    }

    if (!verifyPassword(password, profile.passwordHash)) {
      recordAttempt(rateKey);
      throw new UnauthorizedError("Credenciales inválidas");
    }

    // Success — reset rate limit and generate JWT
    resetAttempts(rateKey);

    const token = generateToken({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    });

    return reply.send({
      ok: true,
      token,
      profile: { id: profile.id, email: profile.email, full_name: profile.fullName, role: profile.role, is_active: profile.isActive },
      tenant: { name: tenant.name, slug: tenant.slug, ruc: tenant.ruc },
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────
  app.post("/api/auth/logout", async (_request, reply) => {
    return reply.send({ ok: true });
  });
}
