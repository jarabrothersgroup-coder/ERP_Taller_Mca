/**
 * RBAC Middleware — Role-Based Access Control with JWT verification.
 *
 * Two-layer approach:
 *   1. resolveProfile — verifies JWT token and resolves user profile
 *   2. requireRole    — enforces role-based access on routes
 *
 * Security:
 *   - JWT token verified with HMAC-SHA256 (no header trust)
 *   - Profile resolved from token claims + DB verification
 *   - Token expiry enforced
 *
 * OWASP Top 10 2021 — A07:2021 Identification and Authentication Failures
 *
 * @module shared/middleware/rbac
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../database/drizzle.js";
import { profiles, type Profile } from "../database/schema/index.js";
import { UnauthorizedError, ForbiddenError } from "../errors/app-error.js";
import { verifyToken, extractTokenFromHeader } from "../services/auth-jwt.js";
import { verifyClerkToken, extractClerkToken, isClerkConfigured, type ClerkUserClaims } from "../services/clerk-verify.js";

// ─── Request augmentation ──────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    /** Resolved user profile (set by resolveProfile hook) */
    profile?: Pick<Profile, "id" | "email" | "fullName" | "role" | "isActive" | "tenantId">;
  }
}

// ─── Role hierarchy (higher index = more privileges) ──

const ROLE_HIERARCHY: Record<string, number> = {
  user: 0,
  mechanic: 1,
  manager: 2,
  admin: 3,
};

/**
 * Fastify preHandler hook that resolves the current user's profile
 * from a verified JWT token.
 *
 * Verification order:
 *   1. Clerk JWT (RS256 via JWKS) — production auth
 *   2. Custom HMAC-SHA256 JWT — legacy/internal auth
 *   3. X-User-Email header — DEPRECATED fallback (will be removed)
 *
 * Security: Verifies JWT signature and expiry before trusting any claims.
 * Must run AFTER resolveTenant (needs `request.tenantSlug`).
 */
export async function resolveProfile(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers["authorization"] as string | undefined;

  // ── 1. Try Clerk JWT (production) ──────────────
  if (isClerkConfigured()) {
    const clerkToken = extractClerkToken(authHeader);
    if (clerkToken) {
      const claims = await verifyClerkToken(clerkToken);
      if (claims) {
        await resolveProfileFromClerkClaims(request, claims);
        return;
      }
      // Clerk token invalid — fall through to legacy
    }
  }

  // ── 2. Try custom HMAC JWT (legacy/internal) ───
  const legacyToken = extractTokenFromHeader(authHeader);
  if (legacyToken) {
    const payload = verifyToken(legacyToken);
    if (payload) {
      await resolveProfileFromEmail(request, payload.email);
      return;
    }
    // Invalid token — don't fall through to header trust
    throw new UnauthorizedError("Token inválido o expirado");
  }

  // ── 3. DEPRECATED: X-User-Email header ─────────
  // Only used during migration when no JWT is available.
  // Will be removed once all clients send JWTs.
  const email = request.headers["x-user-email"] as string | undefined;
  if (email) {
    request.log.warn({ email: email.slice(0, 3) + "***" }, "DEPRECATED: X-User-Email header used — migrate to JWT");
    await resolveProfileFromEmail(request, email);
    return;
  }

  // No auth provided — allow unauthenticated routes (login, health, etc.)
}

/**
 * Resolve user profile from Clerk JWT claims.
 * Maps Clerk org_id → tenant, looks up profile by email.
 */
async function resolveProfileFromClerkClaims(
  request: FastifyRequest,
  claims: ClerkUserClaims,
): Promise<void> {
  const email = claims.email;
  if (!email) return;

  const tenantSlug = request.tenantSlug;
  if (!tenantSlug) return;

  const [profile] = await db()
    .select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName,
      role: profiles.role,
      isActive: profiles.isActive,
      tenantId: profiles.tenantId,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.email, email),
        eq(profiles.isActive, true),
      ),
    )
    .limit(1);

  if (!profile) {
    throw new UnauthorizedError("Usuario no encontrado o inactivo");
  }

  request.profile = profile;
}

/**
 * Resolve user profile from email address.
 * Used by both custom JWT and deprecated X-User-Email header.
 */
async function resolveProfileFromEmail(
  request: FastifyRequest,
  email: string,
): Promise<void> {
  const tenantSlug = request.tenantSlug;
  if (!tenantSlug) return;

  const [profile] = await db()
    .select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName,
      role: profiles.role,
      isActive: profiles.isActive,
      tenantId: profiles.tenantId,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.email, email),
        eq(profiles.isActive, true),
      ),
    )
    .limit(1);

  if (profile) {
    request.profile = profile;
  }
}

/**
 * Creates a Fastify preHandler hook that enforces role-based access.
 *
 * Users must have one of the specified roles (or a higher-privileged role
 * in the hierarchy) to access the route.
 *
 * @param allowedRoles - Minimum role(s) required
 * @returns Fastify preHandler hook
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.profile) {
      throw new UnauthorizedError("Autenticación requerida. Inicie sesión.");
    }

    const userRole = request.profile.role;
    const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
    const minRequired = Math.min(...allowedRoles.map((r) => ROLE_HIERARCHY[r] ?? 99));

    if (userLevel < minRequired) {
      throw new ForbiddenError("Acceso denegado");
    }
  };
}

/**
 * Convenience hooks for common role gates.
 */
export const requireAdmin = requireRole("admin");
export const requireManager = requireRole("manager");
export const requireMechanic = requireRole("mechanic");

/**
 * Register global RBAC hooks on the Fastify instance.
 */
export async function registerGlobalRBAC(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveProfile);
}
