/**
 * Compras Service — Facturas de compra de proveedores.
 *
 * Operaciones CRUD sobre `compras` + `compra_detalles`, con cálculo de
 * total y consulta por período para la centralización contable.
 *
 * @module finance/services/compras.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { compras, compraDetalles } from "../schema/compras.js";
import { NotFoundError } from "../../../shared/errors/app-error.js";

export interface CompraDetalleInput {
  descripcion: string;
  cantidad?: string | number;
  precioUnitario?: string | number;
  subtotal?: string | number;
}

export interface CreateCompraInput {
  tenantSlug: string;
  numeroFactura: string;
  proveedorNombre: string;
  proveedorId?: string;
  fecha?: Date | string;
  fechaVencimiento?: Date | string;
  estadoPago?: "PENDIENTE" | "PARCIAL" | "PAGADO" | "ANULADA";
  notas?: string;
  detalles: CompraDetalleInput[];
}

function toNumeric(v: string | number | undefined, fallback = "0"): string {
  if (v === undefined || v === null || v === "") return fallback;
  return String(v);
}

/** Calcula el subtotal de un detalle. */
function calcSubtotal(d: CompraDetalleInput): string {
  const cantidad = parseFloat(toNumeric(d.cantidad, "1"));
  const precio = parseFloat(toNumeric(d.precioUnitario, "0"));
  if (d.subtotal !== undefined && d.subtotal !== "") {
    return toNumeric(d.subtotal);
  }
  return (cantidad * precio).toFixed(2);
}

export async function createCompra(input: CreateCompraInput) {
  const detalles = input.detalles.map((d) => ({
    descripcion: d.descripcion,
    cantidad: toNumeric(d.cantidad, "1"),
    precioUnitario: toNumeric(d.precioUnitario, "0"),
    subtotal: calcSubtotal(d),
  }));

  const total = detalles
    .reduce((acc, d) => acc + parseFloat(d.subtotal), 0)
    .toFixed(2);

  const [compra] = await db()
    .insert(compras)
    .values({
      tenantSlug: input.tenantSlug,
      numeroFactura: input.numeroFactura,
      proveedorNombre: input.proveedorNombre,
      proveedorId: input.proveedorId,
      fecha: input.fecha ? new Date(input.fecha) : undefined,
      fechaVencimiento: input.fechaVencimiento
        ? new Date(input.fechaVencimiento)
        : null,
      estadoPago: input.estadoPago ?? "PENDIENTE",
      notas: input.notas,
      total,
    })
    .returning();

  if (detalles.length > 0) {
    await db()
      .insert(compraDetalles)
      .values(detalles.map((d) => ({ ...d, compraId: compra.id })));
  }

  return getCompra(input.tenantSlug, compra.id);
}

export async function listCompras(
  tenantSlug: string,
  opts: { limit?: number; offset?: number; estadoPago?: string } = {},
) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const conditions = [eq(compras.tenantSlug, tenantSlug)];
  if (opts.estadoPago) {
    conditions.push(eq(compras.estadoPago, opts.estadoPago as any));
  }

  const [rows, totalRes] = await Promise.all([
    db()
      .select()
      .from(compras)
      .where(and(...conditions))
      .orderBy(desc(compras.fecha))
      .limit(limit)
      .offset(offset),
    db()
      .select({ count: sql<number>`count(*)` })
      .from(compras)
      .where(and(...conditions)),
  ]);

  return {
    data: rows,
    total: Number(totalRes[0]?.count ?? 0),
    limit,
    offset,
  };
}

export async function getCompra(tenantSlug: string, id: string) {
  const [compra] = await db()
    .select()
    .from(compras)
    .where(and(eq(compras.tenantSlug, tenantSlug), eq(compras.id, id)))
    .limit(1);

  if (!compra) throw new NotFoundError(`Compra ${id} no encontrada`);

  const detalles = await db()
    .select()
    .from(compraDetalles)
    .where(eq(compraDetalles.compraId, id))
    .orderBy(compraDetalles.createdAt);

  return { ...compra, detalles };
}

export async function updateCompra(
  tenantSlug: string,
  id: string,
  patch: Partial<{
    numeroFactura: string;
    proveedorNombre: string;
    proveedorId: string;
    fecha: Date | string;
    fechaVencimiento: Date | string;
    estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO" | "ANULADA";
    notas: string;
    total: string;
  }>,
) {
  const [existing] = await db()
    .select()
    .from(compras)
    .where(and(eq(compras.tenantSlug, tenantSlug), eq(compras.id, id)))
    .limit(1);
  if (!existing) throw new NotFoundError(`Compra ${id} no encontrada`);

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.numeroFactura !== undefined) values.numeroFactura = patch.numeroFactura;
  if (patch.proveedorNombre !== undefined) values.proveedorNombre = patch.proveedorNombre;
  if (patch.proveedorId !== undefined) values.proveedorId = patch.proveedorId;
  if (patch.fecha !== undefined) values.fecha = new Date(patch.fecha);
  if (patch.fechaVencimiento !== undefined)
    values.fechaVencimiento = new Date(patch.fechaVencimiento);
  if (patch.estadoPago !== undefined) values.estadoPago = patch.estadoPago;
  if (patch.notas !== undefined) values.notas = patch.notas;
  if (patch.total !== undefined) values.total = patch.total;

  const [updated] = await db()
    .update(compras)
    .set(values)
    .where(eq(compras.id, id))
    .returning();

  return updated;
}

export async function deleteCompra(tenantSlug: string, id: string) {
  const [existing] = await db()
    .select()
    .from(compras)
    .where(and(eq(compras.tenantSlug, tenantSlug), eq(compras.id, id)))
    .limit(1);
  if (!existing) throw new NotFoundError(`Compra ${id} no encontrada`);

  await db().delete(compraDetalles).where(eq(compraDetalles.compraId, id));
  await db()
    .delete(compras)
    .where(eq(compras.id, id));

  return { success: true, id };
}

/**
 * Suma el total de compras en el período (para centralización contable).
 * Incluye todas las compras del tenant en el rango [start, end].
 */
export async function getComprasTotalByPeriod(
  tenantSlug: string,
  start: Date,
  end: Date,
): Promise<number> {
  const [res] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(${compras.total}::numeric), 0)::float`,
    })
    .from(compras)
    .where(
      and(
        eq(compras.tenantSlug, tenantSlug),
        gte(compras.fecha, start),
        lte(compras.fecha, end),
      ),
    );

  return Number(res?.total ?? 0);
}
