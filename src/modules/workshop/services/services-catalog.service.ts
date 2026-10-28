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
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface CatalogListOptions {
  categoria?: string;
  activo?: boolean;
  limit?: number;
  offset?: number;
  /**
   * Búsqueda de texto (case-insensitive, substring) sobre nombre,
   * descripción, código y categoría.
   *
   * El Hub de Operaciones (Paso 3) filtra **en el cliente** porque el
   * catálogo es chico/medio (≤ ~200 activos); este parámetro existe para
   * cuando el catálogo crezca y convenga delegar el filtro al servidor.
   */
  search?: string;
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

/** Largo mínimo del término de búsqueda del catálogo (3 letras). */
export const CATALOG_SEARCH_MIN_LENGTH = 3;

/**
 * Escapa los comodines de LIKE (`%`, `_`, `\`) para que un término
 * tipeado por el usuario busque de forma literal.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/([\\%_])/g, "\\$1");
}

/**
 * List services with optional category/active/search filters.
 *
 * El filtro de tenant se aplica siempre que se reciba `tenantSlug`.
 */
export async function listServicios(
  opts: CatalogListOptions = {},
  tenantSlug?: string,
): Promise<ServicioCatalogo[]> {
  const conditions: ReturnType<typeof eq>[] = [];
  if (tenantSlug) conditions.push(eq(serviciosCatalogo.tenantSlug, tenantSlug));
  if (opts.categoria) conditions.push(eq(serviciosCatalogo.categoria, opts.categoria));
  if (opts.activo !== undefined) conditions.push(eq(serviciosCatalogo.activo, opts.activo));

  // Búsqueda de texto: sólo a partir de CATALOG_SEARCH_MIN_LENGTH letras,
  // igual que el combobox del Hub (3 caracteres). Un término más corto se
  // ignora en lugar de devolver un resultado gigante.
  const term = opts.search?.trim() ?? "";
  if (term.length >= CATALOG_SEARCH_MIN_LENGTH) {
    const pattern = `%${escapeLikePattern(term)}%`;
    const textMatch = or(
      ilike(serviciosCatalogo.nombre, pattern),
      ilike(serviciosCatalogo.descripcion, pattern),
      ilike(serviciosCatalogo.codigo, pattern),
      ilike(serviciosCatalogo.categoria, pattern),
    );
    if (textMatch) conditions.push(textMatch);
  }

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
  const nombre = data.nombre?.trim();
  if (!nombre) {
    throw new ValidationError("El nombre del servicio es obligatorio");
  }
  if (data.precioEstimado != null && data.precioEstimado < 0) {
    throw new ValidationError("El precio unitario no puede ser negativo");
  }
  if (data.duracionEstimada != null && data.duracionEstimada < 0) {
    throw new ValidationError("La duración estimada no puede ser negativa");
  }

  const [row] = await db()
    .insert(serviciosCatalogo)
    .values({
      nombre,
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
  if (data.nombre !== undefined && !data.nombre.trim()) {
    throw new ValidationError("El nombre del servicio es obligatorio");
  }
  if (data.precioEstimado != null && data.precioEstimado < 0) {
    throw new ValidationError("El precio unitario no puede ser negativo");
  }
  if (data.duracionEstimada != null && data.duracionEstimada < 0) {
    throw new ValidationError("La duración estimada no puede ser negativa");
  }

  const conditions = [eq(serviciosCatalogo.id, id)];
  if (tenantSlug) conditions.push(eq(serviciosCatalogo.tenantSlug, tenantSlug));

  const [row] = await db()
    .update(serviciosCatalogo)
    .set({
      ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
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
