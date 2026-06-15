/**
 * Cost Center Service — CRUD + Tree (CAPA 5).
 *
 * @module finance/services/accounting/cost-center.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { centrosCosto } from "../../schema/cost-centers.js";
import { eq, and, asc } from "drizzle-orm";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface CreateCentroCostoRequest {
  codigo: string;
  nombre: string;
  descripcion?: string;
  centroPadreId?: string;
}

export interface UpdateCentroCostoRequest {
  nombre?: string;
  descripcion?: string;
  centroPadreId?: string | null;
  activo?: boolean;
}

export interface CostCenterTreeNode extends Omit<CentroCosto, "centroPadreId"> {
  hijos: CostCenterTreeNode[];
}

type CentroCosto = typeof centrosCosto.$inferSelect;

// ─── CRUD ───────────────────────────────────────

/**
 * Crea un centro de costo.
 */
export async function createCentroCosto(
  tenantSlug: string,
  data: CreateCentroCostoRequest,
): Promise<CentroCosto> {
  // 1. Validar código único por tenant
  const existing = await db()
    .select({ id: centrosCosto.id })
    .from(centrosCosto)
    .where(
      and(
        eq(centrosCosto.codigo, data.codigo),
        eq(centrosCosto.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      `Ya existe un centro de costo con código "${data.codigo}" para este tenant`,
    );
  }

  // 2. Validar padre si existe
  if (data.centroPadreId) {
    const padre = await db()
      .select({ id: centrosCosto.id })
      .from(centrosCosto)
      .where(
        and(
          eq(centrosCosto.id, data.centroPadreId),
          eq(centrosCosto.tenantSlug, tenantSlug),
        ),
      )
      .limit(1);

    if (padre.length === 0) {
      throw new NotFoundError("Centro de costo padre no encontrado");
    }
  }

  // 3. Insertar
  const [centro] = await db()
    .insert(centrosCosto)
    .values({
      codigo: data.codigo,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      centroPadreId: data.centroPadreId ?? null,
      tenantSlug,
    })
    .returning();

  return centro;
}

/**
 * Obtiene un centro de costo por ID.
 */
export async function getCentroCostoById(
  id: string,
): Promise<CentroCosto> {
  const [centro] = await db()
    .select()
    .from(centrosCosto)
    .where(eq(centrosCosto.id, id))
    .limit(1);

  if (!centro) {
    throw new NotFoundError(`Centro de costo con ID ${id} no encontrado`);
  }

  return centro;
}

/**
 * Lista centros de costo (plano, con filtros).
 */
export async function listCentrosCosto(options: {
  tenantSlug?: string;
  activo?: boolean;
  centroPadreId?: string;
}) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (options.tenantSlug) conditions.push(eq(centrosCosto.tenantSlug, options.tenantSlug));
  if (options.activo !== undefined) conditions.push(eq(centrosCosto.activo, options.activo));
  if (options.centroPadreId !== undefined) {
    conditions.push(eq(centrosCosto.centroPadreId, options.centroPadreId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db()
    .select()
    .from(centrosCosto)
    .where(where)
    .orderBy(asc(centrosCosto.codigo));
}

/**
 * Obtiene el árbol jerárquico completo de centros de costo.
 *
 * @param tenantSlug - Tenant slug
 * @param soloActivos - Si true, solo incluye centros activos
 */
export async function getArbolCentrosCosto(
  tenantSlug: string,
  soloActivos = false,
): Promise<CostCenterTreeNode[]> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(centrosCosto.tenantSlug, tenantSlug),
  ];
  if (soloActivos) conditions.push(eq(centrosCosto.activo, true));

  const all = await db()
    .select()
    .from(centrosCosto)
    .where(and(...conditions))
    .orderBy(asc(centrosCosto.codigo));

  // Build tree in-memory (flat depth — typically 2-3 levels max)
  const map = new Map<string, CostCenterTreeNode>();
  const roots: CostCenterTreeNode[] = [];

  for (const cc of all) {
    map.set(cc.id, { ...cc, hijos: [] });
  }

  for (const cc of all) {
    const node = map.get(cc.id)!;
    if (cc.centroPadreId && map.has(cc.centroPadreId)) {
      map.get(cc.centroPadreId)!.hijos.push(node);
    } else if (!cc.centroPadreId) {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Actualiza un centro de costo.
 */
export async function updateCentroCosto(
  id: string,
  data: UpdateCentroCostoRequest,
): Promise<CentroCosto> {
  await getCentroCostoById(id); // throws if not found

  // Validar que no se auto-referencie como padre
  if (data.centroPadreId === id) {
    throw new ValidationError("Un centro de costo no puede ser su propio padre");
  }

  const [updated] = await db()
    .update(centrosCosto)
    .set({
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      ...(data.centroPadreId !== undefined && { centroPadreId: data.centroPadreId }),
      ...(data.activo !== undefined && { activo: data.activo }),
      updatedAt: new Date(),
    })
    .where(eq(centrosCosto.id, id))
    .returning();

  return updated;
}

/**
 * Desactiva un centro de costo (borrado lógico).
 */
export async function deleteCentroCosto(id: string): Promise<void> {
  await getCentroCostoById(id); // throws if not found

  await db()
    .update(centrosCosto)
    .set({ activo: false, updatedAt: new Date() })
    .where(eq(centrosCosto.id, id));
}
