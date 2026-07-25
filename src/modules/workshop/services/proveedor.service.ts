/**
 * Proveedor Service — supplier catalog CRUD.
 *
 * @module workshop/services/proveedor.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { proveedores } from "../schema/proveedores.js";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

export async function listProveedores(tenantSlug: string): Promise<any[]> {
  return db()
    .select()
    .from(proveedores)
    .where(eq(proveedores.tenantSlug, tenantSlug))
    .orderBy(desc(proveedores.createdAt));
}

export async function getProveedorById(id: string, tenantSlug: string): Promise<any> {
  const [row] = await db()
    .select()
    .from(proveedores)
    .where(and(eq(proveedores.id, id), eq(proveedores.tenantSlug, tenantSlug)))
    .limit(1);
  if (!row) throw new NotFoundError(`Proveedor ${id} no encontrado`);
  return row;
}

export async function createProveedor(
  data: {
    nombre: string;
    ruc?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    tipo?: string;
    especialidades?: string;
    calificacion?: number;
    notas?: string;
  },
  tenantSlug: string,
): Promise<any> {
  if (!data.nombre?.trim()) throw new ValidationError("El nombre es obligatorio");
  if (data.calificacion !== undefined && (data.calificacion < 1 || data.calificacion > 5)) {
    throw new ValidationError("La calificación debe ser entre 1 y 5");
  }

  const [row] = await db()
    .insert(proveedores)
    .values({
      ...data,
      tenantSlug,
    })
    .returning();
  return row;
}

export async function updateProveedor(
  id: string,
  data: Record<string, any>,
  tenantSlug: string,
): Promise<any> {
  await getProveedorById(id, tenantSlug);
  if (data.calificacion !== undefined && (data.calificacion < 1 || data.calificacion > 5)) {
    throw new ValidationError("La calificación debe ser entre 1 y 5");
  }

  const [row] = await db()
    .update(proveedores)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(proveedores.id, id))
    .returning();
  return row;
}

export async function deleteProveedor(id: string, tenantSlug: string): Promise<void> {
  await getProveedorById(id, tenantSlug);
  await db().delete(proveedores).where(eq(proveedores.id, id));
}
