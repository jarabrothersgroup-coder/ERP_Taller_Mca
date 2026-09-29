/**
 * Mechanic Profiles Routes — CRUD de perfiles de mecánico (T-45 · FIN-07).
 *
 * `mechanic_profiles` no tiene columna `tenant_slug`: el aislamiento se hereda
 * por `profile_id → profiles.tenant_id → tenants.slug`. Antes de T-45 el GET,
 * el POST y el PATCH NO aplicaban ese filtro, de modo que un taller podía
 * listar y modificar los perfiles de salaries de otro (fuga cross-tenant).
 * Solo el DELETEFiltraba. Todos los verbos usan ahora el mismo `IN (...)`.
 *
 * @module workshop/routes/mechanic-profiles
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { mechanicProfiles, mecanicoCategoriaEnum } from "../../finance/schema/mechanic-profiles.js";
import { profiles } from "../../../shared/database/schema/profiles.js";
import { and, eq, sql } from "drizzle-orm";
import { requireManager } from "../../../shared/middleware/rbac.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../shared/errors/app-error.js";

interface IdParams {
  id: string;
}

interface CreateBody {
  profileId: string;
  category: string;
  baseSalary: number;
  commissionRate: number;
}

interface UpdateBody {
  category?: string;
  baseSalary?: number;
  commissionRate?: number;
}

const CATEGORIAS = mecanicoCategoriaEnum.enumValues;
const RATE_MAX = 100;

/**
 * Ids de `mechanic_profiles` cuyo `profile_id` pertenece al tenant indicado.
 *
 * Es el único predicado de aislamiento del módulo: `mechanic_profiles` no
 * tiene columna de tenant propia, así que cualquier consulta que lo toque debe
 * pasar por acá (o por el `IN` equivalente).
 */
function perfilesDelTenant(tenantSlug: string) {
  return sql`${mechanicProfiles.profileId} IN (
    SELECT p.id FROM profiles p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE t.slug = ${tenantSlug}
  )`;
}

function validarCategoria(value: unknown): (typeof CATEGORIAS)[number] {
  if (typeof value !== "string" || !CATEGORIAS.includes(value as never)) {
    throw new ValidationError(
      `Categoría inválida: ${String(value)}. Válidas: ${CATEGORIAS.join(", ")}`,
    );
  }
  return value as (typeof CATEGORIAS)[number];
}

function validarSalario(value: unknown, campo: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${campo} debe ser un número mayor o igual a cero`);
  }
  return Math.round(value);
}

function validarComision(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(
      "La comisión debe ser un porcentaje mayor o igual a cero",
    );
  }
  if (value > RATE_MAX) {
    throw new ValidationError(
      `La comisión no puede superar ${RATE_MAX}%`,
    );
  }
  return String(value);
}

export async function mechanicProfilesRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /workshop/mechanic-profiles
   * Lista los perfiles de mecánico activos DEL TENANT con el nombre de la persona.
   */
  app.get("/workshop/mechanic-profiles", async (request, reply) => {
    const rows = await db()
      .select({
        id: mechanicProfiles.id,
        profileId: mechanicProfiles.profileId,
        category: mechanicProfiles.category,
        baseSalary: mechanicProfiles.baseSalary,
        commissionRate: mechanicProfiles.commissionRate,
        createdAt: mechanicProfiles.createdAt,
        nombre: profiles.fullName,
        email: profiles.email,
        role: profiles.role,
      })
      .from(mechanicProfiles)
      .innerJoin(profiles, eq(mechanicProfiles.profileId, profiles.id))
      .where(
        and(
          eq(mechanicProfiles.activo, true),
          perfilesDelTenant(request.tenantSlug),
        ),
      )
      .orderBy(profiles.fullName);

    return reply.send(rows);
  });

  /**
   * POST /workshop/mechanic-profiles
   * Crea un perfil de mecánico (manager+: afecta nómina y comisiones).
   */
  app.post<{ Body: CreateBody }>(
    "/workshop/mechanic-profiles",
    {
      preHandler: requireManager,
      schema: {
        body: {
          type: "object",
          required: ["profileId", "category", "baseSalary", "commissionRate"],
          properties: {
            profileId: { type: "string", format: "uuid" },
            // La lista de categorías válidas la valida el service (422 con el
            // detalle); el schema solo fija la forma del string.
            category: { type: "string" },
            baseSalary: { type: "number" },
            commissionRate: { type: "number" },
          },
        },
      },
    },
    async (request, reply) => {
      const { profileId, category, baseSalary, commissionRate } = request.body;

      // La persona debe existir Y ser del tenant: un profileId ajeno es 404
      // (no revelamos que exista en otro taller).
      const [persona] = await db()
        .select({ id: profiles.id, role: profiles.role })
        .from(profiles)
        .where(
          and(
            eq(profiles.id, profileId),
            sql`${profiles.tenantId} = (SELECT id FROM tenants WHERE slug = ${request.tenantSlug})`,
          ),
        )
        .limit(1);

      if (!persona) {
        throw new NotFoundError("Perfil de usuario no encontrado en este taller");
      }

      const [existente] = await db()
        .select({ id: mechanicProfiles.id })
        .from(mechanicProfiles)
        .where(eq(mechanicProfiles.profileId, profileId))
        .limit(1);

      if (existente) {
        throw new ConflictError(
          "Esta persona ya tiene un perfil de mecánico (incluso si está dado de baja).",
        );
      }

      const [row] = await db()
        .insert(mechanicProfiles)
        .values({
          profileId,
          category: validarCategoria(category),
          baseSalary: validarSalario(baseSalary, "El salario base"),
          commissionRate: validarComision(commissionRate),
        })
        .returning();

      return reply.status(201).send(row);
    },
  );

  /**
   * GET /workshop/mechanic-profiles/:id
   * Perfil de mecánico por id (incluye los dados de baja).
   */
  app.get<{ Params: IdParams }>(
    "/workshop/mechanic-profiles/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const [row] = await db()
        .select({
          id: mechanicProfiles.id,
          profileId: mechanicProfiles.profileId,
          category: mechanicProfiles.category,
          baseSalary: mechanicProfiles.baseSalary,
          commissionRate: mechanicProfiles.commissionRate,
          activo: mechanicProfiles.activo,
          createdAt: mechanicProfiles.createdAt,
          updatedAt: mechanicProfiles.updatedAt,
          nombre: profiles.fullName,
        })
        .from(mechanicProfiles)
        .innerJoin(profiles, eq(mechanicProfiles.profileId, profiles.id))
        .where(
          and(
            eq(mechanicProfiles.id, request.params.id),
            perfilesDelTenant(request.tenantSlug),
          ),
        )
        .limit(1);

      if (!row) {
        throw new NotFoundError("Perfil de mecánico no encontrado");
      }

      return reply.send(row);
    },
  );

  /**
   * PATCH /workshop/mechanic-profiles/:id
   * Actualiza categoría / salario / comisión (manager+).
   */
  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    "/workshop/mechanic-profiles/:id",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          // minProperties lo valida el service: un PATCH vacío no es un error
          // de forma, es una petición sin sentido → 422 con mensaje.
          properties: {
            category: { type: "string" },
            baseSalary: { type: "number" },
            commissionRate: { type: "number" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.category !== undefined) {
        updateData.category = validarCategoria(body.category);
      }
      if (body.baseSalary !== undefined) {
        updateData.baseSalary = validarSalario(body.baseSalary, "El salario base");
      }
      if (body.commissionRate !== undefined) {
        updateData.commissionRate = validarComision(body.commissionRate);
      }

      if (Object.keys(updateData).length === 1) {
        throw new ValidationError(
          "Indique al menos un campo a actualizar (category, baseSalary o commissionRate)",
        );
      }

      const [row] = await db()
        .update(mechanicProfiles)
        .set(updateData)
        .where(
          and(
            eq(mechanicProfiles.id, id),
            perfilesDelTenant(request.tenantSlug),
          ),
        )
        .returning();

      // 404 y no `undefined` en el cuerpo: antes un id inexistente devolvía
      // 200 con `null`, y el cliente no podía distinguir "no existe" de "ok".
      if (!row) {
        throw new NotFoundError("Perfil de mecánico no encontrado");
      }

      return reply.send(row);
    },
  );

  /**
   * DELETE /workshop/mechanic-profiles/:id
   * Baja lógica (manager+): el perfil de la persona y su histórico de
   * comisiones se conservan; solo se retira el rol de mecánico.
   */
  app.delete<{ Params: IdParams }>(
    "/workshop/mechanic-profiles/:id",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const tenantSlug = request.tenantSlug;

      const [row] = await db()
        .update(mechanicProfiles)
        .set({ activo: false, updatedAt: new Date() })
        .where(
          and(
            eq(mechanicProfiles.id, request.params.id),
            eq(mechanicProfiles.activo, true),
            perfilesDelTenant(tenantSlug),
          ),
        )
        .returning({ id: mechanicProfiles.id });

      if (!row) {
        throw new NotFoundError("Perfil de mecánico no encontrado");
      }

      return reply.send({ deleted: true });
    },
  );
}
