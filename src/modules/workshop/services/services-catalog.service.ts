/**
 * Services Catalog Service — CRUD for servicios_catalogo.
 *
 * Provides full Create, Read, Update, Delete (soft) operations
 * on the workshop service catalog, tenant-isolated.
 *
 * @module workshop/services/services-catalog.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  serviciosCatalogo,
  type ServicioCatalogo,
} from "../schema/index.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { NotFoundError } from "../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface CatalogListOptions {
  categoria?: string;
  activo?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateCatalogInput {
  nombre: string;
  descripcion?: string;
  descripcionTecnica?: string;
  categoria?: string;
  categoriaId?: string;
  codigo?: string;
  thinkcarModulo?: string;
  precioEstimado?: number;
  duracionEstimada?: number;
}

// ─── List ───────────────────────────────────────

/**
 * List services with optional category/active filters.
 */
export async function listServicios(
  opts: CatalogListOptions = {},
  tenantSlug?: string,
): Promise<ServicioCatalogo[]> {
  const conditions: ReturnType<typeof eq>[] = [];
  if (tenantSlug) conditions.push(eq(serviciosCatalogo.tenantSlug, tenantSlug));
  if (opts.categoria) conditions.push(eq(serviciosCatalogo.categoria, opts.categoria));
  if (opts.activo !== undefined) conditions.push(eq(serviciosCatalogo.activo, opts.activo));

  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;

  return db()
    .select()
    .from(serviciosCatalogo)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(serviciosCatalogo.createdAt))
    .limit(limit)
    .offset(offset);
}

// ─── Get by ID ──────────────────────────────────

/**
 * Get a single service by ID.
 */
export async function getServicio(
  id: string,
  tenantSlug?: string,
): Promise<ServicioCatalogo> {
  const conditions = [eq(serviciosCatalogo.id, id)];
  if (tenantSlug) conditions.push(eq(serviciosCatalogo.tenantSlug, tenantSlug));

  const [row] = await db()
    .select()
    .from(serviciosCatalogo)
    .where(and(...conditions))
    .limit(1);

  if (!row) throw new NotFoundError(`Servicio ${id} no encontrado`);
  return row;
}

// ─── Create ─────────────────────────────────────

/**
 * Create a new service in the catalog.
 */
export async function createServicio(
  data: CreateCatalogInput & { tenantSlug: string },
): Promise<ServicioCatalogo> {
  const [row] = await db()
    .insert(serviciosCatalogo)
    .values({
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      descripcionTecnica: data.descripcionTecnica ?? null,
      categoria: data.categoria ?? null,
      categoriaId: data.categoriaId ?? null,
      codigo: data.codigo ?? null,
      thinkcarModulo: data.thinkcarModulo ?? null,
      precioEstimado: data.precioEstimado != null ? String(data.precioEstimado) : null,
      duracionEstimada: data.duracionEstimada ?? null,
      tenantSlug: data.tenantSlug,
    })
    .returning();

  return row;
}

// ─── Update ─────────────────────────────────────

/**
 * Update an existing service.
 */
export async function updateServicio(
  id: string,
  data: Partial<CreateCatalogInput> & { activo?: boolean },
  tenantSlug?: string,
): Promise<ServicioCatalogo> {
  const conditions = [eq(serviciosCatalogo.id, id)];
  if (tenantSlug) conditions.push(eq(serviciosCatalogo.tenantSlug, tenantSlug));

  const [row] = await db()
    .update(serviciosCatalogo)
    .set({
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.descripcionTecnica !== undefined
        ? { descripcionTecnica: data.descripcionTecnica }
        : {}),
      ...(data.categoria !== undefined ? { categoria: data.categoria } : {}),
      ...(data.categoriaId !== undefined ? { categoriaId: data.categoriaId } : {}),
      ...(data.codigo !== undefined ? { codigo: data.codigo } : {}),
      ...(data.thinkcarModulo !== undefined ? { thinkcarModulo: data.thinkcarModulo } : {}),
      ...(data.precioEstimado !== undefined
        ? { precioEstimado: String(data.precioEstimado) }
        : {}),
      ...(data.duracionEstimada !== undefined
        ? { duracionEstimada: data.duracionEstimada }
        : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
      updatedAt: sql`NOW()`,
    })
    .where(and(...conditions))
    .returning();

  if (!row) throw new NotFoundError(`Servicio ${id} no encontrado`);
  return row;
}

// ─── Delete (soft: set inactive) ────────────────

/**
 * Soft-delete a service by deactivating it.
 */
export async function deleteServicio(
  id: string,
  tenantSlug?: string,
): Promise<{ deleted: boolean }> {
  const conditions = [eq(serviciosCatalogo.id, id)];
  if (tenantSlug) conditions.push(eq(serviciosCatalogo.tenantSlug, tenantSlug));

  const [row] = await db()
    .update(serviciosCatalogo)
    .set({ activo: false, updatedAt: sql`NOW()` })
    .where(and(...conditions))
    .returning({ id: serviciosCatalogo.id });

  if (!row) throw new NotFoundError(`Servicio ${id} no encontrado`);
  return { deleted: true };
}
