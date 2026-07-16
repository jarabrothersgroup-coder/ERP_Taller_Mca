/**
 * Donaciones Service — Registros de donaciones deducibles de IRE.
 *
 * @module finance/services/donaciones.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { donaciones } from "../schema/donaciones.js";
import { NotFoundError } from "../../../shared/errors/app-error.js";

export interface CreateDonacionInput {
  tenantSlug: string;
  beneficiario: string;
  descripcion?: string;
  monto: string | number;
  comprobante?: string;
  deducible?: boolean;
  fecha?: Date | string;
}

export async function createDonacion(input: CreateDonacionInput) {
  const [row] = await db()
    .insert(donaciones)
    .values({
      tenantSlug: input.tenantSlug,
      beneficiario: input.beneficiario,
      descripcion: input.descripcion,
      monto: String(input.monto),
      comprobante: input.comprobante,
      deducible: input.deducible ?? true,
      fecha: input.fecha ? new Date(input.fecha) : undefined,
    })
    .returning();

  return row;
}

export async function listDonaciones(
  tenantSlug: string,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const [rows, totalRes] = await Promise.all([
    db()
      .select()
      .from(donaciones)
      .where(eq(donaciones.tenantSlug, tenantSlug))
      .orderBy(desc(donaciones.fecha))
      .limit(limit)
      .offset(offset),
    db()
      .select({ count: sql<number>`count(*)` })
      .from(donaciones)
      .where(eq(donaciones.tenantSlug, tenantSlug)),
  ]);

  return {
    data: rows,
    total: Number(totalRes[0]?.count ?? 0),
    limit,
    offset,
  };
}

export async function getDonacion(tenantSlug: string, id: string) {
  const [row] = await db()
    .select()
    .from(donaciones)
    .where(and(eq(donaciones.tenantSlug, tenantSlug), eq(donaciones.id, id)))
    .limit(1);

  if (!row) throw new NotFoundError(`Donación ${id} no encontrada`);
  return row;
}

export async function updateDonacion(
  tenantSlug: string,
  id: string,
  patch: Partial<{
    beneficiario: string;
    descripcion: string;
    monto: string | number;
    comprobante: string;
    deducible: boolean;
    fecha: Date | string;
  }>,
) {
  const [existing] = await db()
    .select()
    .from(donaciones)
    .where(and(eq(donaciones.tenantSlug, tenantSlug), eq(donaciones.id, id)))
    .limit(1);
  if (!existing) throw new NotFoundError(`Donación ${id} no encontrada`);

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.beneficiario !== undefined) values.beneficiario = patch.beneficiario;
  if (patch.descripcion !== undefined) values.descripcion = patch.descripcion;
  if (patch.monto !== undefined) values.monto = String(patch.monto);
  if (patch.comprobante !== undefined) values.comprobante = patch.comprobante;
  if (patch.deducible !== undefined) values.deducible = patch.deducible;
  if (patch.fecha !== undefined) values.fecha = new Date(patch.fecha);

  const [updated] = await db()
    .update(donaciones)
    .set(values)
    .where(eq(donaciones.id, id))
    .returning();

  return updated;
}

export async function deleteDonacion(tenantSlug: string, id: string) {
  const [existing] = await db()
    .select()
    .from(donaciones)
    .where(and(eq(donaciones.tenantSlug, tenantSlug), eq(donaciones.id, id)))
    .limit(1);
  if (!existing) throw new NotFoundError(`Donación ${id} no encontrada`);

  await db().delete(donaciones).where(eq(donaciones.id, id));
  return { success: true, id };
}

/**
 * Suma de donaciones deducibles en el período fiscal (para IRE).
 * Solo cuenta las marcadas como `deducible = true` dentro del mes/año.
 */
export async function getDonacionesTotalByPeriod(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<number> {
  const start = new Date(anho, mes - 1, 1);
  const end = new Date(anho, mes, 0, 23, 59, 59);

  const [res] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(${donaciones.monto}::numeric), 0)::float`,
    })
    .from(donaciones)
    .where(
      and(
        eq(donaciones.tenantSlug, tenantSlug),
        eq(donaciones.deducible, true),
        gte(donaciones.fecha, start),
        lte(donaciones.fecha, end),
      ),
    );

  return Number(res?.total ?? 0);
}
