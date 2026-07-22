/**
 * Almacén Service — Multi-warehouse management.
 *
 * Sprint 84 — P0-3 Multi-almacén.
 * Handles CRUD for warehouses and transferencias between them.
 *
 * @module inventory/services/almacen.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { almacenes } from "../schema/almacenes.js";
import { repuestos, stockMovements } from "../schema/index.js";
import { eq, and, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { inventarioConfigurator } from "../../finance/services/accounting/inventario.configurator.js";

export interface CreateAlmacenInput {
  codigo: string;
  nombre: string;
  direccion?: string;
  responsable?: string;
  telefono?: string;
}

export interface TransferenciaInput {
  repuestoId: string;
  cantidad: number;
  almacenDestinoId: string;
  almacenOrigenId?: string;
  ordenTrabajoId?: string;
  motivo?: string;
}

// ─── CRUD Almacenes ────────────────────────────

export async function listAlmacenes(tenantSlug: string) {
  return db()
    .select()
    .from(almacenes)
    .where(and(
      eq(almacenes.tenantSlug, tenantSlug),
      eq(almacenes.activo, true),
    ))
    .orderBy(almacenes.codigo);
}

export async function getAlmacen(id: string, tenantSlug: string) {
  const [almacen] = await db()
    .select()
    .from(almacenes)
    .where(and(eq(almacenes.id, id), eq(almacenes.tenantSlug, tenantSlug)))
    .limit(1);
  if (!almacen) throw new NotFoundError(`Almacén ${id} no encontrado`);
  return almacen;
}

export async function createAlmacen(input: CreateAlmacenInput, tenantSlug: string) {
  const [existing] = await db()
    .select({ id: almacenes.id })
    .from(almacenes)
    .where(and(eq(almacenes.codigo, input.codigo), eq(almacenes.tenantSlug, tenantSlug)))
    .limit(1);
  if (existing) throw new ValidationError(`Ya existe un almacén con código ${input.codigo}`);

  const [created] = await db()
    .insert(almacenes)
    .values({ ...input, tenantSlug })
    .returning();
  return created;
}

export async function updateAlmacen(id: string, input: Partial<CreateAlmacenInput>, tenantSlug: string) {
  await getAlmacen(id, tenantSlug);
  const [updated] = await db()
    .update(almacenes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(almacenes.id, id), eq(almacenes.tenantSlug, tenantSlug)))
    .returning();
  return updated;
}

export async function deleteAlmacen(id: string, tenantSlug: string) {
  await getAlmacen(id, tenantSlug);
  await db()
    .update(almacenes)
    .set({ activo: false, updatedAt: new Date() })
    .where(and(eq(almacenes.id, id), eq(almacenes.tenantSlug, tenantSlug)));
  return { deleted: true };
}

// ─── Transferencias entre almacenes ────────────

export async function realizarTransferencia(
  input: TransferenciaInput,
  tenantSlug: string,
) {
  const { repuestoId, cantidad, almacenDestinoId, almacenOrigenId, ordenTrabajoId, motivo } = input;

  if (cantidad <= 0) throw new ValidationError("La cantidad debe ser mayor a cero");

  // Validate destinos exist
  await getAlmacen(almacenDestinoId, tenantSlug);

  // Atomic: reduce stock from source, increase at destination
  // Use a Drizzle transaction for atomicity
  await db().transaction(async (tx) => {
    // 1. Reduce stock from source (or general stock if no source specified)
    if (almacenOrigenId) {
      await getAlmacen(almacenOrigenId, tenantSlug);
      const [updated] = await tx
        .update(repuestos)
        .set({
          stockActual: sql`${repuestos.stockActual} - ${cantidad}`,
          updatedAt: sql`NOW()`,
        })
        .where(and(
          eq(repuestos.id, repuestoId),
          sql`${repuestos.stockActual} >= ${cantidad}`,
        ))
        .returning({ id: repuestos.id, stockActual: repuestos.stockActual });
      if (!updated) throw new ValidationError("Stock insuficiente en almacén origen");
    }

    // 2. Increase stock at destination
    await tx
      .update(repuestos)
      .set({
        stockActual: sql`${repuestos.stockActual} + ${cantidad}`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(repuestos.id, repuestoId));

    // 3. Insert in transferencias_almacen table (raw SQL)
    await tx.execute(
      sql`INSERT INTO transferencias_almacen (repuesto_id, cantidad, almacen_origen_id, almacen_destino_id, orden_trabajo_id, motivo, estado, tenant_slug) VALUES (${repuestoId}, ${cantidad}, ${almacenOrigenId ?? null}, ${almacenDestinoId}, ${ordenTrabajoId ?? null}, ${motivo ?? "Transferencia entre almacenes"}, 'COMPLETADA', ${tenantSlug})`,
    );

    // 4. Create stock movements
    if (almacenOrigenId) {
      await tx.insert(stockMovements).values({
        repuestoId,
        tipo: "SALIDA",
        cantidad,
        stockAnterior: 0,
        stockPosterior: 0,
        ordenTrabajoId: ordenTrabajoId ?? null,
        motivo: motivo ?? "Transferencia entre almacenes",
        tenantSlug,
      });
    }

    await tx.insert(stockMovements).values({
      repuestoId,
      tipo: "ENTRADA",
      cantidad,
      stockAnterior: 0,
      stockPosterior: 0,
      ordenTrabajoId: ordenTrabajoId ?? null,
      motivo: motivo ?? "Transferencia entre almacenes",
      tenantSlug,
    });

    // 5. Accounting: trigger configurador (non-blocking)
    if (almacenOrigenId) {
      // Look up actual cost from database
      const [repuesto] = await tx
        .select({ costoUnitario: repuestos.precioCosto })
        .from(repuestos)
        .where(eq(repuestos.id, repuestoId))
        .limit(1);
      const costoTotal = repuesto?.costoUnitario
        ? Number(repuesto.costoUnitario) * cantidad
        : 0;

      inventarioConfigurator.onSalidaStock({
        tenantSlug,
        movimientoId: repuestoId,
        repuestoDescripcion: `Transferencia ${almacenOrigenId} → ${almacenDestinoId}`,
        cantidad,
        costoTotal,
        motivo: motivo ?? "Transferencia entre almacenes",
      }).catch(() => {});
    }
  });

  return { success: true, repuestoId, cantidad, almacenOrigenId, almacenDestinoId };
}
