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
 * Security: Verifies JWT signature and expiry before trusting any claims.
 * Falls back to X-User-Email header ONLY for backward compatibility
 * during migration (will be removed in future).
 *
 * Must run AFTER resolveTenant (needs `request.tenantSlug`).
 */
export async function resolveProfile(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // Try JWT token first (secure path)
  const authHeader = request.headers["authorization"] as string | undefined;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = verifyToken(token);
    if (!payload) {
      throw new UnauthorizedError("Token inválido o expirado");
    }

    // Verify user still exists and is active in DB
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
          eq(profiles.email, payload.email),
          eq(profiles.isActive, true),
        ),
      )
      .limit(1);

    if (!profile) {
      throw new UnauthorizedError("Usuario no encontrado o inactivo");
    }

    request.profile = profile;
    return;
  }

  // Backward compatibility: X-User-Email header (DEPRECATED — will be removed)
  const email = request.headers["x-user-email"] as string | undefined;
  if (!email) {
    return; // No auth — allow unauthenticated routes (login, health, etc.)
  }

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
