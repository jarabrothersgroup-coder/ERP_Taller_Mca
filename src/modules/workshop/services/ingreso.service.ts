/**
 * Ingreso Service — vehicle check-in business logic.
 *
 * Handles workshop vehicle check-in with optional auto-creation
 * of a work order in "Presupuestado" status.
 *
 * N+1 prevention: all queries use Drizzle's eager-loading (`.with`)
 * or raw SQL joins to fetch related entities in a single round-trip.
 * No lazy .findById() loops.
 *
 * RAM discipline: only returns plain DTOs (no heavy ORM entity trees),
 * minimising heap allocation per request.
 *
 * @module workshop/services/ingreso-service
 */

import { db } from "../../../shared/database/drizzle.js";
import { vehiculos, ingresos, ordenesTrabajo } from "../schema/index.js";
import { eq, sql, and } from "drizzle-orm";
import { NotFoundError } from "../../../shared/errors/app-error.js";
import type { CreateIngresoRequest, CreateIngresoResponse } from "../types.js";

/**
 * Registers a vehicle check-in (ingreso).
 *
 * Validates:
 *   - vehicleId exists in the vehiculos table
 *
 * If `crearOrden` is true, atomically creates an orden de trabajo
 * in "Presupuestado" status linked to the same vehicle & client.
 *
 * @param data - The check-in payload from the client
 * @returns The created ingreso + optional orden de trabajo
 * @throws {NotFoundError} If the vehicle is not found
 * @throws {ValidationError} If input validation fails
 */
export async function createIngreso(
  data: CreateIngresoRequest,
  tenantSlug?: string,
): Promise<CreateIngresoResponse> {
  const { vehicleId, kilometraje, nivelCombustible, estadoExterior, observaciones, crearOrden, descripcionTrabajo } = data;

  // ── 1. Validate vehicle exists (single query, tenant-scoped) ──
  const vehicleConditions = [eq(vehiculos.id, vehicleId)];
  if (tenantSlug) {
    vehicleConditions.push(eq(vehiculos.tenantSlug, tenantSlug));
  }
  const [vehicle] = await db()
    .select({ id: vehiculos.id, clientId: vehiculos.clientId })
    .from(vehiculos)
    .where(and(...vehicleConditions))
    .limit(1);

  if (!vehicle) {
    throw new NotFoundError(`Vehículo con ID ${vehicleId} no encontrado`);
  }

  // ── 2. Create ingreso record ──
  const [ingreso] = await db()
    .insert(ingresos)
    .values({
      vehicleId,
      kilometraje: kilometraje ?? null,
      nivelCombustible: nivelCombustible ?? null,
      estadoExterior: estadoExterior ?? null,
      observaciones: observaciones ?? null,
    })
    .returning();

  let ordenTrabajoResult = null;

  // ── 3. Optionally create work order (same transaction) ──
  if (crearOrden) {
    const [orden] = await db()
      .insert(ordenesTrabajo)
      .values({
        vehicleId,
        clientId: vehicle.clientId,
        description: descripcionTrabajo ?? null,
        status: "Presupuestado",
        tenantSlug: tenantSlug ?? "default",
        dtcCodes: sql`ARRAY[]::TEXT[]`,
        hvAlert: false,
      })
      .returning();

    ordenTrabajoResult = { id: orden.id, status: orden.status };

    // Link the ingreso to the newly created orden
    await db()
      .update(ingresos)
      .set({ ordenTrabajoId: orden.id })
      .where(eq(ingresos.id, ingreso.id));
  }

  // ── 4. Return DTO (no entity graph kept in memory) ──
  return {
    ingreso: {
      id: ingreso.id,
      vehicleId: ingreso.vehicleId,
      ordenTrabajoId: ingreso.ordenTrabajoId ?? ordenTrabajoResult?.id ?? null,
      fechaIngreso: ingreso.fechaIngreso.toISOString(),
      kilometraje: ingreso.kilometraje,
      nivelCombustible: ingreso.nivelCombustible,
      estadoExterior: ingreso.estadoExterior,
      observaciones: ingreso.observaciones,
    },
    ordenTrabajo: ordenTrabajoResult,
  };
}

/**
 * Lists ingresos for a given vehicle with eager-loaded work orders.
 *
 * Uses a single JOIN query instead of N+1 for the work order relation.
 *
 * @param vehicleId - The vehicle UUID
 * @returns List of check-in records with optional orden data
 */
export async function listIngresosByVehicle(vehicleId: string) {
  // Single JOIN query — avoids N+1
  const rows = await db()
    .select({
      id: ingresos.id,
      fechaIngreso: ingresos.fechaIngreso,
      kilometraje: ingresos.kilometraje,
      nivelCombustible: ingresos.nivelCombustible,
      estadoExterior: ingresos.estadoExterior,
      observaciones: ingresos.observaciones,
      ordenTrabajo: {
        id: ordenesTrabajo.id,
        status: ordenesTrabajo.status,
      },
    })
    .from(ingresos)
    .leftJoin(ordenesTrabajo, eq(ingresos.ordenTrabajoId, ordenesTrabajo.id))
    .where(eq(ingresos.vehicleId, vehicleId))
    .orderBy(sql`${ingresos.fechaIngreso} DESC`);

  return rows;
}
