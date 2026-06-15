/**
 * Profiles routes — user account management within a tenant.
 *
 * All routes require X-Tenant-Slug header (resolved by tenant-resolver).
 *
 * @module config/routes/profiles
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { tenants, profiles } from "../../../shared/database/schema/index.js";
import { BadRequestError, NotFoundError } from "../../../shared/errors/app-error.js";
import { resolveTenant } from "../../../shared/middleware/tenant-resolver.js";

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

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", resolveTenant);

  // ── GET /api/profiles — List all profiles for the tenant ──
  app.get("/api/profiles", async (request, reply) => {
    const [tenant] = await db()
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, request.tenantSlug))
      .limit(1);
    if (!tenant) throw new NotFoundError("Tenant no encontrado");

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
      .where(eq(profiles.tenantId, tenant.id))
      .orderBy(profiles.createdAt);
    return reply.send(rows.map(toSnake));
  });

  // ── POST /api/profiles — Create a profile ──
  app.post("/api/profiles", async (request, reply) => {
    const body = request.body as { email: string; fullName: string; role: string };
    if (!body.email || !body.fullName) throw new BadRequestError("Email y nombre requeridos");

    const [tenant] = await db()
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, request.tenantSlug))
      .limit(1);
    if (!tenant) throw new NotFoundError("Tenant no encontrado");

    const [profile] = await db()
      .insert(profiles)
      .values({
        tenantId: tenant.id,
        email: body.email,
        fullName: body.fullName,
        role: body.role || "mechanic",
      })
      .returning({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        isActive: profiles.isActive,
        createdAt: profiles.createdAt,
      });
    return reply.code(201).send({
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
      role: profile.role,
      is_active: profile.isActive,
      created_at: profile.createdAt,
    });
  });

  // ── PATCH /api/profiles/:id — Update a profile ──
  app.patch("/api/profiles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const [existing] = await db()
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("Perfil no encontrado");

    const email = (body.email as string) ?? existing.email;
    const fullName = (body.fullName as string) ?? existing.fullName;
    const role = (body.role as string) ?? existing.role;
    const isActive = body.isActive !== undefined ? (body.isActive as boolean) : existing.isActive;

    const [updated] = await db()
      .update(profiles)
      .set({ email, fullName, role, isActive, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        isActive: profiles.isActive,
      });
    return reply.send({
      id: updated.id,
      email: updated.email,
      full_name: updated.fullName,
      role: updated.role,
      is_active: updated.isActive,
    });
  });

  // ── DELETE /api/profiles/:id — Soft-delete (deactivate) a profile ──
  app.delete("/api/profiles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [profile] = await db()
      .update(profiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning({ id: profiles.id });
    if (!profile) throw new NotFoundError("Perfil no encontrado");
    return reply.send({ ok: true });
  });
}
