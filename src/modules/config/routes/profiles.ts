/**
 * Profiles routes — user account management within a tenant.
 *
 * All routes require X-Tenant-Slug header (resolved by tenant-resolver).
 *
 * Security — SEG-01 / T-21a (auditoría 2026-09-25):
 *   1. Every route resolves the caller profile (resolveProfile) after the tenant.
 *   2. GET requires an authenticated user; POST/PATCH/DELETE require `admin`.
 *   3. Every :id lookup is scoped to the caller's tenant — no cross-tenant
 *      reads or writes (a foreign id yields 404, not 403, to avoid leaking
 *      existence).
 *   4. PATCH only accepts whitelisted fields (email, fullName, role, isActive)
 *      and validates `role` against the allowed set.
 *   5. Self-escalation guards: an admin cannot change their own role/isActive
 *      nor delete their own profile (blocks privilege self-promotion and
 *      lock-out via self-deactivation).
 *
 * @module config/routes/profiles
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { tenants, profiles } from "../../../shared/database/schema/index.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../../shared/errors/app-error.js";
import { resolveTenant } from "../../../shared/middleware/tenant-resolver.js";
import { resolveProfile, requireAuth, requireAdmin } from "../../../shared/middleware/rbac.js";

/** Roles accepted by the `profiles.role` CHECK constraint. */
const VALID_ROLES = new Set(["admin", "manager", "mechanic", "user"]);

/**
 * Maps Drizzle camelCase profile → snake_case for frontend compatibility.
 */
function toSnake(p: {
  id: string; email: string; fullName: string; role: string;
  isActive: boolean | null; createdAt: Date | null; updatedAt?: Date | null;
}) {
  return {
    id: p.id,
    email: p.email,
    full_name: p.fullName,
    role: p.role,
    is_active: p.isActive,
    created_at: p.createdAt,
    updated_at: p.updatedAt ?? null,
  };
}

/**
 * Resolve the tenant UUID for the current request or throw 404.
 * Used to scope every profiles lookup by tenant (cross-tenant isolation).
 */
async function tenantIdOrThrow(request: FastifyRequest): Promise<string> {
  const slug = request.tenantSlug;
  if (slug) {
    const [tenant] = await db()
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    if (tenant) return tenant.id;
  }
  throw new NotFoundError("Tenant no encontrado");
}

/** Validate `role` against the allowed set (throws 400 when invalid). */
function assertValidRole(role: string): string {
  if (!VALID_ROLES.has(role)) {
    throw new BadRequestError(`Rol inválido: ${role}. Roles permitidos: ${[...VALID_ROLES].join(", ")}`);
  }
  return role;
}

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);

  // ── GET /api/profiles — List profiles of the tenant (authenticated) ──
  app.get("/api/profiles", { preHandler: requireAuth }, async (request, reply) => {
    const tenantId = await tenantIdOrThrow(request);

    const rows = await db()
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        isActive: profiles.isActive,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .where(eq(profiles.tenantId, tenantId))
      .orderBy(profiles.createdAt);
    return reply.send(rows.map(toSnake));
  });

  // ── POST /api/profiles — Create a profile (admin only) ──
  app.post("/api/profiles", { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { email?: string; fullName?: string; name?: string; role?: string };
    // Tolerate the legacy FE alias `name` (kept for mobile/old clients).
    const fullName = body.fullName ?? body.name;
    if (!body.email || !fullName) throw new BadRequestError("Email y nombre requeridos");
    const role = assertValidRole(body.role ?? "mechanic");

    const tenantId = await tenantIdOrThrow(request);

    let profile: {
      id: string; email: string; fullName: string; role: string;
      isActive: boolean; createdAt: Date;
    };
    try {
      const [created] = await db()
        .insert(profiles)
        .values({
          tenantId,
          email: body.email,
          fullName,
          role,
        })
        .returning({
          id: profiles.id,
          email: profiles.email,
          fullName: profiles.fullName,
          role: profiles.role,
          isActive: profiles.isActive,
          createdAt: profiles.createdAt,
        });
      if (!created) throw new BadRequestError("No se pudo crear el perfil");
      profile = created;
    } catch (err) {
      // Unique violation (23505): duplicate email within the same tenant.
      // postgres.js wraps the driver error in `cause` (the driver error carries
      // `code`), so unwrap one level.
      const cause = (err as { cause?: { code?: string } }).cause;
      const code = (err as { code?: string }).code ?? cause?.code;
      if (code === "23505") {
        throw new BadRequestError("Ya existe un perfil con ese email en este taller");
      }
      throw err;
    }
    return reply.code(201).send({
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
      role: profile.role,
      is_active: profile.isActive,
      created_at: profile.createdAt,
    });
  });

  // ── PATCH /api/profiles/:id — Update a profile (admin only) ──
  app.patch("/api/profiles/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const tenantId = await tenantIdOrThrow(request);

    // Tenant-scoped lookup: a profile of another tenant → 404 (no existence leak).
    const [existing] = await db()
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        isActive: profiles.isActive,
      })
      .from(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.tenantId, tenantId)))
      .limit(1);
    if (!existing) throw new NotFoundError("Perfil no encontrado");

    // ── Whitelist: only these fields may be updated ──
    const patch: { email?: string; fullName?: string; role?: string; isActive?: boolean } = {};
    if (typeof body.email === "string" && body.email) patch.email = body.email;
    // Tolerate the legacy FE alias `name` → fullName.
    const fullName = body.fullName ?? body.name;
    if (typeof fullName === "string" && fullName) patch.fullName = fullName;
    if (body.role !== undefined) {
      if (typeof body.role !== "string") throw new BadRequestError("Rol inválido");
      patch.role = assertValidRole(body.role);
    }
    // Tolerate the legacy FE alias `active` → isActive.
    const isActive = body.isActive !== undefined ? body.isActive : body.active;
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") throw new BadRequestError("isActive debe ser booleano");
      patch.isActive = isActive;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestError("No hay campos válidos para actualizar (email, fullName, role, isActive)");
    }

    // ── Self-escalation guard: no auto-promote / auto-deactivate ──
    if (request.profile?.id === id) {
      if (patch.role !== undefined && patch.role !== existing.role) {
        throw new ForbiddenError("No puedes modificar tu propio rol");
      }
      if (patch.isActive !== undefined && patch.isActive !== existing.isActive) {
        throw new ForbiddenError("No puedes cambiar tu propio estado de actividad");
      }
    }

    const [updated] = await db()
      .update(profiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(profiles.id, id), eq(profiles.tenantId, tenantId)))
      .returning({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        isActive: profiles.isActive,
      });
    if (!updated) throw new NotFoundError("Perfil no encontrado");
    return reply.send({
      id: updated.id,
      email: updated.email,
      full_name: updated.fullName,
      role: updated.role,
      is_active: updated.isActive,
    });
  });

  // ── DELETE /api/profiles/:id — Soft-delete (deactivate) a profile (admin only) ──
  app.delete("/api/profiles/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Self-escalation guard: an admin cannot delete their own account.
    if (request.profile?.id === id) {
      throw new ForbiddenError("No puedes eliminar tu propio perfil");
    }

    const tenantId = await tenantIdOrThrow(request);

    const [profile] = await db()
      .update(profiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(profiles.id, id), eq(profiles.tenantId, tenantId)))
      .returning({ id: profiles.id });
    if (!profile) throw new NotFoundError("Perfil no encontrado");
    return reply.send({ ok: true });
  });
}
