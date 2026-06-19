/**
 * Sucursal Service — multi-branch management business logic.
 *
 * @module config/services/sucursal.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { sucursales } from "../schema/sucursales.js";
import { eq, and, sql } from "drizzle-orm";
import { NotFoundError, ConflictError, ValidationError } from "../../../shared/errors/app-error.js";

// ─── Types ────────────────────────────────────

export interface CreateSucursalRequest {
  nombre: string;
  codigo: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  telefono?: string;
  email?: string;
  gerente?: string;
  esPrincipal?: boolean;
}

export interface UpdateSucursalRequest {
  nombre?: string;
  direccion?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  telefono?: string | null;
  email?: string | null;
  gerente?: string | null;
  esPrincipal?: boolean;
  activa?: boolean;
}

// ─── CRUD Operations ──────────────────────────

/**
 * Creates a new branch (sucursal).
 *
 * @param data - Branch data
 * @param tenantSlug - Tenant identifier
 * @returns Created branch
 * @throws {ConflictError} If codigo already exists for this tenant
 */
export async function createSucursal(
  data: CreateSucursalRequest,
  tenantSlug: string,
) {
  const existing = await db()
    .select({ id: sucursales.id })
    .from(sucursales)
    .where(
      and(
        eq(sucursales.codigo, data.codigo),
        eq(sucursales.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(`Ya existe una sucursal con el código "${data.codigo}"`);
  }

  // If marking as principal, unset other principals
  if (data.esPrincipal) {
    await db()
      .update(sucursales)
      .set({ esPrincipal: false })
      .where(eq(sucursales.tenantSlug, tenantSlug));
  }

  const [sucursal] = await db()
    .insert(sucursales)
    .values({
      nombre: data.nombre,
      codigo: data.codigo,
      direccion: data.direccion ?? null,
      ciudad: data.ciudad ?? null,
      departamento: data.departamento ?? null,
      telefono: data.telefono ?? null,
      email: data.email ?? null,
      gerente: data.gerente ?? null,
      esPrincipal: data.esPrincipal ?? false,
      activa: true,
      tenantSlug,
    })
    .returning();

  return sucursal;
}

/**
 * Lists all active branches for a tenant.
 *
 * @param tenantSlug - Tenant identifier
 * @returns List of branches
 */
export async function listSucursales(tenantSlug: string) {
  return db()
    .select()
    .from(sucursales)
    .where(
      and(
        eq(sucursales.tenantSlug, tenantSlug),
        eq(sucursales.activa, true),
      )
    )
    .orderBy(sucursales.nombre);
}

/**
 * Gets a single branch by ID.
 *
 * @param id - Branch UUID
 * @param tenantSlug - Tenant identifier
 * @returns The branch
 * @throws {NotFoundError} If not found
 */
export async function getSucursalById(id: string, tenantSlug: string) {
  const [sucursal] = await db()
    .select()
    .from(sucursales)
    .where(
      and(
        eq(sucursales.id, id),
        eq(sucursales.tenantSlug, tenantSlug),
      )
    )
    .limit(1);

  if (!sucursal) {
    throw new NotFoundError(`Sucursal ${id} no encontrada`);
  }

  return sucursal;
}

/**
 * Updates a branch.
 *
 * @param id - Branch UUID
 * @param data - Fields to update
 * @param tenantSlug - Tenant identifier
 * @returns Updated branch
 * @throws {NotFoundError} If not found
 */
export async function updateSucursal(
  id: string,
  data: UpdateSucursalRequest,
  tenantSlug: string,
) {
  await getSucursalById(id, tenantSlug);

  // If marking as principal, unset other principals
  if (data.esPrincipal) {
    await db()
      .update(sucursales)
      .set({ esPrincipal: false })
      .where(
        and(
          eq(sucursales.tenantSlug, tenantSlug),
          sql`${sucursales.id} != ${id}`,
        ),
      );
  }

  const updatePayload: Record<string, unknown> = {};
  if (data.nombre !== undefined) updatePayload.nombre = data.nombre;
  if (data.direccion !== undefined) updatePayload.direccion = data.direccion;
  if (data.ciudad !== undefined) updatePayload.ciudad = data.ciudad;
  if (data.departamento !== undefined) updatePayload.departamento = data.departamento;
  if (data.telefono !== undefined) updatePayload.telefono = data.telefono;
  if (data.email !== undefined) updatePayload.email = data.email;
  if (data.gerente !== undefined) updatePayload.gerente = data.gerente;
  if (data.esPrincipal !== undefined) updatePayload.es_principal = data.esPrincipal;
  if (data.activa !== undefined) updatePayload.activa = data.activa;

  updatePayload.updated_at = new Date();

  const [updated] = await db()
    .update(sucursales)
    .set(updatePayload)
    .where(eq(sucursales.id, id))
    .returning();

  return updated;
}

/**
 * Soft-deletes a branch (sets activa = false).
 *
 * @param id - Branch UUID
 * @param tenantSlug - Tenant identifier
 * @throws {NotFoundError} If not found
 * @throws {ValidationError} If trying to deactivate the principal branch
 */
export async function deleteSucursal(id: string, tenantSlug: string) {
  const sucursal = await getSucursalById(id, tenantSlug);

  if (sucursal.esPrincipal) {
    throw new ValidationError("No se puede desactivar la sucursal principal");
  }

  await db()
    .update(sucursales)
    .set({ activa: false, updatedAt: new Date() })
    .where(eq(sucursales.id, id));
}
