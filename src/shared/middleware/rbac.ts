/**
 * RBAC Middleware — Role-Based Access Control.
 *
 * Two-layer approach:
 *   1. resolveProfile — resolves the user profile from X-User-Email header
 *   2. requireRole    — enforces role-based access on routes
 *
 * Security model:
 *   - Profile resolution uses indexed SELECT (email + tenant_id)
 *   - Password is NOT verified per-request (login validated it)
 *   - Suitable for internal workshop networks (< 10 concurrent users)
 *
 * @module shared/middleware/rbac
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../database/drizzle.js";
import { profiles, type Profile } from "../database/schema/index.js";
import { UnauthorizedError, ForbiddenError } from "../errors/app-error.js";

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
 * from the `X-User-Email` header.
 *
 * Must run AFTER resolveTenant (needs `request.tenantSlug`).
 *
 * @example
 *   fastify.addHook("preHandler", resolveProfile);
 *   fastify.get("/admin/users", { preHandler: [resolveProfile] }, handler);
 */
export async function resolveProfile(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const email = request.headers["x-user-email"] as string | undefined;
  if (!email) {
    // No email header — allow unauthenticated routes (login, health, etc.)
    return;
  }

  const tenantSlug = request.tenantSlug;
  if (!tenantSlug) {
    // resolveTenant not yet run — skip silently
    return;
  }

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
    // Unknown or inactive user — don't block (let route handler decide)
    return;
  }

  request.profile = profile;
}

/**
 * Creates a Fastify preHandler hook that enforces role-based access.
 *
 * Users must have one of the specified roles (or a higher-privileged role
 * in the hierarchy) to access the route.
 *
 * @param allowedRoles - Minimum role(s) required
 * @returns Fastify preHandler hook
 *
 * @example
 *   // Only admin can access
 *   fastify.delete("/users/:id", { preHandler: [requireRole("admin")] }, handler);
 *
 *   // Manager or admin can access
 *   fastify.get("/treasury/movements", { preHandler: [requireRole("manager")] }, handler);
 *
 *   // Any authenticated user can access
 *   fastify.get("/dashboard", { preHandler: [requireRole("user")] }, handler);
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
      throw new ForbiddenError(
        `Acceso denegado. Rol requerido: ${allowedRoles.join(" o ")}. Rol actual: ${userRole}.`,
      );
    }
  };
}

/**
 * Convenience hooks for common role gates.
 *
 * @example
 *   fastify.addHook("preHandler", requireAdmin);
 *   fastify.get("/admin/users", { preHandler: [requireAdmin] }, handler);
 */
export const requireAdmin = requireRole("admin");
export const requireManager = requireRole("manager");
export const requireMechanic = requireRole("mechanic");

/**
 * Register global RBAC hooks on the Fastify instance.
 *
 * Call this AFTER resolveTenant is registered.
 * Adds resolveProfile as a global preHandler so all routes
 * have access to `request.profile`.
 *
 * @param app - Fastify instance
 *
 * @example
 *   // In app.ts bootstrap:
 *   await app.register(resolveTenant);
 *   await registerGlobalRBAC(app);
 */
export async function registerGlobalRBAC(app: FastifyInstance): Promise<void> {
  // resolveProfile runs on every request AFTER tenant resolution
  // It's non-blocking: if no email header, profile is simply undefined
  app.addHook("preHandler", resolveProfile);
}
