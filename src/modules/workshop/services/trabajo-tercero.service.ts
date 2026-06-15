/**
 * Trabajo de Tercero Service — outsourced work business logic.
 *
 * Links third-party / subcontracted services to an existing
 * orden de trabajo. Common when the workshop outsources
 * specialised tasks (paint, AC, machining, etc.).
 *
 * N+1 prevention:
 *   - Work order existence check is a single SELECT by PK (index scan).
 *   - Insert + fetch is a single RETURNING call.
 *   - No lazy loops, no relation-walking in JS.
 *
 * RAM discipline:
 *   - Returns plain DTOs (no full ORM entities).
 *   - No in-memory collections beyond the result set.
 *
 * @module workshop/services/trabajo-tercero-service
 */

import { db } from "../../../shared/database/drizzle.js";
import { trabajosTerceros, ordenesTrabajo } from "../schema/index.js";
import { eq } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import type { CreateTrabajoTerceroRequest, CreateTrabajoTerceroResponse } from "../types.js";

/**
 * Validates that an orden de trabajo exists.
 *
 * Uses a narrow PK-index SELECT (O(1) — no seq scan).
 *
 * @param ordenTrabajoId - The work order UUID
 * @throws {NotFoundError} If the order does not exist
 */
async function ensureOrdenTrabajoExists(ordenTrabajoId: string): Promise<void> {
  const [row] = await db()
    .select({ id: ordenesTrabajo.id })
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.id, ordenTrabajoId))
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      `Orden de trabajo ${ordenTrabajoId} no encontrada`,
    );
  }
}

/**
 * Associates a third-party work item to an existing work order.
 *
 * @param ordenTrabajoId - UUID of the parent work order
 * @param data - The third-party work payload
 * @returns The created trabajo tercero record
 * @throws {NotFoundError} If the work order is not found
 * @throws {ValidationError} If the input is invalid
 */
export async function createTrabajoTercero(
  ordenTrabajoId: string,
  data: CreateTrabajoTerceroRequest,
): Promise<CreateTrabajoTerceroResponse> {
  // ── 1. Validate work order exists (single PK lookup) ──
  await ensureOrdenTrabajoExists(ordenTrabajoId);

  // ── 2. Parse & validate cost ──
  const costo =
    typeof data.costo === "string" ? parseFloat(data.costo) : data.costo;
  if (isNaN(costo) || costo < 0) {
    throw new ValidationError("El costo debe ser un número positivo", {
      costo: ["Debe ser un valor numérico >= 0"],
    });
  }

  // ── 3. Insert trabajo tercero — RETURNING gives us the row back in one round-trip ──
  const [trabajo] = await db()
    .insert(trabajosTerceros)
    .values({
      ordenTrabajoId,
      proveedor: data.proveedor,
      descripcion: data.descripcion,
      costo: costo.toFixed(2),
      fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : null,
      fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
    })
    .returning();

  // ── 4. Return DTO (no full entity tree) ──
  return {
    trabajoTercero: {
      id: trabajo.id,
      ordenTrabajoId: trabajo.ordenTrabajoId,
      proveedor: trabajo.proveedor,
      descripcion: trabajo.descripcion,
      costo: trabajo.costo.toString(),
      estado: trabajo.estado,
      fechaInicio: trabajo.fechaInicio?.toISOString() ?? null,
      fechaFin: trabajo.fechaFin?.toISOString() ?? null,
    },
  };
}

/**
 * Lists all third-party work items for a given work order.
 *
 * Uses a single filtered SELECT with an index on `orden_trabajo_id`.
 * No N+1: returns all items in one query.
 *
 * @param ordenTrabajoId - The parent work order UUID
 * @returns List of third-party work records
 */
export async function listTrabajosTercerosByOrden(
  ordenTrabajoId: string,
) {
  const rows = await db()
    .select()
    .from(trabajosTerceros)
    .where(eq(trabajosTerceros.ordenTrabajoId, ordenTrabajoId))
    .orderBy(trabajosTerceros.createdAt);

  return rows.map((t) => ({
    id: t.id,
    proveedor: t.proveedor,
    descripcion: t.descripcion,
    costo: t.costo.toString(),
    estado: t.estado,
    fechaInicio: t.fechaInicio?.toISOString() ?? null,
    fechaFin: t.fechaFin?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
}
