/**
 * Order Items Service — CRUD for orden_servicios and orden_repuestos.
 *
 * Manages line-item services and spare parts on work orders.
 * Automatically recalculates ordenes_trabajo.totalCost after every
 * mutation by summing all child items.
 *
 * @module workshop/services/order-items.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  ordenServicios,
  ordenRepuestos,
  ordenesTrabajo,
  serviciosCatalogo,
  type OrdenServicio,
  type OrdenRepuesto,
} from "../schema/index.js";
import { eq, and, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

// ─── Internal: recalculate totalCost ─────────────

/**
 * Recalculate totalCost on the parent orden_trabajo by summing
 * all servicio subtotals + repuesto subtotals + trabajos_terceros cost.
 */
async function recalcularTotalCost(
  ordenTrabajoId: string,
): Promise<void> {
  // Sum servicios
  const [servSum] = await db()
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${ordenServicios.subtotal} AS NUMERIC)), 0)`,
    })
    .from(ordenServicios)
    .where(eq(ordenServicios.ordenTrabajoId, ordenTrabajoId));

  // Sum repuestos
  const [repSum] = await db()
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${ordenRepuestos.subtotal} AS NUMERIC)), 0)`,
    })
    .from(ordenRepuestos)
    .where(eq(ordenRepuestos.ordenTrabajoId, ordenTrabajoId));

  const total =
    Number(servSum?.total ?? 0) + Number(repSum?.total ?? 0);

  await db()
    .update(ordenesTrabajo)
    .set({
      totalCost: String(total),
      updatedAt: new Date(),
    })
    .where(eq(ordenesTrabajo.id, ordenTrabajoId));
}

// ═════════════════════════════════════════════════
//  ORDEN_SERVICIOS
// ═════════════════════════════════════════════════

export interface CreateOrdenServicioInput {
  ordenTrabajoId: string;
  servicioId: string;
  cantidad?: number;
}

export interface UpdateOrdenServicioInput {
  cantidad?: number;
}

// ─── Create service item ────────────────────────

/**
 * Assign a catalog service to a work order.
 * Fetches the service name and price from the catalog automatically.
 */
export async function createOrdenServicio(
  data: CreateOrdenServicioInput & { tenantSlug: string },
): Promise<OrdenServicio> {
  const { ordenTrabajoId, servicioId, cantidad, tenantSlug } = data;

  // Fetch catalog service for denormalized snapshot
  const [catalogService] = await db()
    .select({
      nombre: serviciosCatalogo.nombre,
      precioEstimado: serviciosCatalogo.precioEstimado,
    })
    .from(serviciosCatalogo)
    .where(eq(serviciosCatalogo.id, servicioId))
    .limit(1);

  if (!catalogService) {
    throw new NotFoundError(`Servicio ${servicioId} no encontrado en el catálogo`);
  }

  const qty = cantidad ?? 1;
  const unitPrice = catalogService.precioEstimado ?? "0";
  const subtotal = (Number(unitPrice) * qty).toFixed(2);

  const [row] = await db()
    .insert(ordenServicios)
    .values({
      ordenTrabajoId,
      servicioId,
      servicioNombre: catalogService.nombre,
      cantidad: qty,
      precioUnitario: unitPrice,
      subtotal,
      tenantSlug,
    })
    .returning();

  // Recalc total
  await recalcularTotalCost(ordenTrabajoId);

  return row;
}

// ─── Update service item ────────────────────────

/**
 * Update quantity on a service line item. Recalculates subtotal + totalCost.
 */
export async function updateOrdenServicio(
  id: string,
  data: UpdateOrdenServicioInput,
  tenantSlug?: string,
): Promise<OrdenServicio> {
  const conditions = [eq(ordenServicios.id, id)];
  if (tenantSlug) conditions.push(eq(ordenServicios.tenantSlug, tenantSlug));

  // Fetch existing row
  const [existing] = await db()
    .select()
    .from(ordenServicios)
    .where(and(...conditions))
    .limit(1);

  if (!existing) throw new NotFoundError(`Item servicio ${id} no encontrado`);

  const qty = data.cantidad ?? existing.cantidad;
  const subtotal = (Number(existing.precioUnitario) * qty).toFixed(2);

  const [row] = await db()
    .update(ordenServicios)
    .set({
      cantidad: qty,
      subtotal,
    })
    .where(and(...conditions))
    .returning();

  await recalcularTotalCost(existing.ordenTrabajoId);
  return row;
}

// ─── Delete service item ────────────────────────

/**
 * Remove a service line item from a work order.
 */
export async function deleteOrdenServicio(
  id: string,
  tenantSlug?: string,
): Promise<{ deleted: boolean }> {
  const conditions = [eq(ordenServicios.id, id)];
  if (tenantSlug) conditions.push(eq(ordenServicios.tenantSlug, tenantSlug));

  const [row] = await db()
    .delete(ordenServicios)
    .where(and(...conditions))
    .returning({ id: ordenServicios.id, ordenTrabajoId: ordenServicios.ordenTrabajoId });

  if (!row) throw new NotFoundError(`Item servicio ${id} no encontrado`);
  await recalcularTotalCost(row.ordenTrabajoId);
  return { deleted: true };
}

// ─── List by order ──────────────────────────────

/**
 * List all service items on a work order.
 */
export async function listOrdenServicios(
  ordenTrabajoId: string,
): Promise<OrdenServicio[]> {
  return db()
    .select()
    .from(ordenServicios)
    .where(eq(ordenServicios.ordenTrabajoId, ordenTrabajoId))
    .orderBy(ordenServicios.createdAt);
}

// ═════════════════════════════════════════════════
//  ORDEN_REPUESTOS
// ═════════════════════════════════════════════════

export interface CreateOrdenRepuestoInput {
  ordenTrabajoId: string;
  repuestoId?: string | null;
  repuestoNombre: string;
  codigo?: string;
  cantidad?: number;
  precioUnitario: number;
}

export interface UpdateOrdenRepuestoInput {
  cantidad?: number;
  precioUnitario?: number;
}

// ─── Create part item ───────────────────────────

/**
 * Add a spare part line item to a work order.
 * repuestoId is optional — allows manual/off-catalog entries.
 */
export async function createOrdenRepuesto(
  data: CreateOrdenRepuestoInput & { tenantSlug: string },
): Promise<OrdenRepuesto> {
  const { ordenTrabajoId, repuestoId, repuestoNombre, codigo, cantidad, precioUnitario, tenantSlug } = data;

  if (cantidad !== undefined && cantidad <= 0) {
    throw new ValidationError("La cantidad debe ser mayor a cero");
  }

  const qty = cantidad ?? 1;
  const subtotal = (precioUnitario * qty).toFixed(2);

  const [row] = await db()
    .insert(ordenRepuestos)
    .values({
      ordenTrabajoId,
      repuestoId: repuestoId ?? null,
      repuestoNombre,
      codigo: codigo ?? null,
      cantidad: qty,
      precioUnitario: String(precioUnitario),
      subtotal,
      tenantSlug,
    })
    .returning();

  await recalcularTotalCost(ordenTrabajoId);
  return row;
}

// ─── Update part item ───────────────────────────

/**
 * Update quantity and/or unit price on a part line item.
 * Recalculates subtotal + totalCost.
 */
export async function updateOrdenRepuesto(
  id: string,
  data: UpdateOrdenRepuestoInput,
  tenantSlug?: string,
): Promise<OrdenRepuesto> {
  const conditions = [eq(ordenRepuestos.id, id)];
  if (tenantSlug) conditions.push(eq(ordenRepuestos.tenantSlug, tenantSlug));

  const [existing] = await db()
    .select()
    .from(ordenRepuestos)
    .where(and(...conditions))
    .limit(1);

  if (!existing) throw new NotFoundError(`Item repuesto ${id} no encontrado`);

  const qty = data.cantidad ?? existing.cantidad;
  const unitPrice = data.precioUnitario ?? Number(existing.precioUnitario);
  const subtotal = (qty * unitPrice).toFixed(2);

  const [row] = await db()
    .update(ordenRepuestos)
    .set({
      cantidad: qty,
      precioUnitario: String(unitPrice),
      subtotal,
    })
    .where(and(...conditions))
    .returning();

  await recalcularTotalCost(existing.ordenTrabajoId);
  return row;
}

// ─── Delete part item ───────────────────────────

/**
 * Remove a part line item from a work order.
 */
export async function deleteOrdenRepuesto(
  id: string,
  tenantSlug?: string,
): Promise<{ deleted: boolean }> {
  const conditions = [eq(ordenRepuestos.id, id)];
  if (tenantSlug) conditions.push(eq(ordenRepuestos.tenantSlug, tenantSlug));

  const [row] = await db()
    .delete(ordenRepuestos)
    .where(and(...conditions))
    .returning({ id: ordenRepuestos.id, ordenTrabajoId: ordenRepuestos.ordenTrabajoId });

  if (!row) throw new NotFoundError(`Item repuesto ${id} no encontrado`);
  await recalcularTotalCost(row.ordenTrabajoId);
  return { deleted: true };
}

// ─── List by order ──────────────────────────────

/**
 * List all part items on a work order.
 */
export async function listOrdenRepuestos(
  ordenTrabajoId: string,
): Promise<OrdenRepuesto[]> {
  return db()
    .select()
    .from(ordenRepuestos)
    .where(eq(ordenRepuestos.ordenTrabajoId, ordenTrabajoId))
    .orderBy(ordenRepuestos.createdAt);
}
