/**
 * Flat Rate Service — mechanic time tracking and efficiency calculation.
 *
 * Tracks real vs estimated time for services, calculates efficiency,
 * and provides bay profitability metrics.
 *
 * @module workshop/services/flat-rate.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { ordenServicios } from "../schema/orden-servicios.js";
import { ordenesTrabajo } from "../schema/ordenes-trabajo.js";
import { eq, and, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

// ─── Types ────────────────────────────────────

export interface ClockInResult {
  servicioId: string;
  horaInicio: string;
  tecnicoId: string;
}

export interface ClockOutResult {
  servicioId: string;
  horaInicio: string;
  horaFin: string;
  duracionReal: number;
  duracionEstimada: number | null;
  eficiencia: number | null;
}

export interface TechnicianEfficiency {
  tecnicoId: string;
  serviciosCompletados: number;
  duracionEstimadaTotal: number;
  duracionRealTotal: number;
  eficienciaPromedio: number;
}

export interface BayProfitability {
  bayNumber: number;
  ordenesCompletadas: number;
  ingresoTotal: number;
  horasActivas: number;
  ingresoPorHora: number;
}

// ─── Clock In/Out ──────────────────────────────

/**
 * Starts time tracking for a service (clock in).
 *
 * @param servicioId - The service line-item UUID
 * @param tecnicoId - Mechanic UUID performing the service
 * @returns Clock-in confirmation
 * @throws {NotFoundError} If service not found
 * @throws {ValidationError} If already clocked in
 */
export async function clockIn(
  servicioId: string,
  tecnicoId: string,
): Promise<ClockInResult> {
  const [servicio] = await db()
    .select({
      id: ordenServicios.id,
      horaInicioReal: ordenServicios.horaInicioReal,
    })
    .from(ordenServicios)
    .where(eq(ordenServicios.id, servicioId))
    .limit(1);

  if (!servicio) {
    throw new NotFoundError(`Servicio ${servicioId} no encontrado`);
  }

  if (servicio.horaInicioReal) {
    throw new ValidationError("Este servicio ya tiene hora de inicio registrada");
  }

  const now = new Date();
  await db()
    .update(ordenServicios)
    .set({
      horaInicioReal: now,
      tecnicoId,
    })
    .where(eq(ordenServicios.id, servicioId));

  return {
    servicioId,
    horaInicio: now.toISOString(),
    tecnicoId,
  };
}

/**
 * Ends time tracking for a service (clock out).
 *
 * Calculates actual duration and efficiency percentage.
 *
 * @param servicioId - The service line-item UUID
 * @returns Clock-out result with efficiency metrics
 * @throws {NotFoundError} If service not found
 * @throws {ValidationError} If not clocked in yet
 */
export async function clockOut(
  servicioId: string,
): Promise<ClockOutResult> {
  const [servicio] = await db()
    .select({
      id: ordenServicios.id,
      horaInicioReal: ordenServicios.horaInicioReal,
      horaFinReal: ordenServicios.horaFinReal,
      duracionEstimada: ordenServicios.duracionEstimada,
    })
    .from(ordenServicios)
    .where(eq(ordenServicios.id, servicioId))
    .limit(1);

  if (!servicio) {
    throw new NotFoundError(`Servicio ${servicioId} no encontrado`);
  }

  if (!servicio.horaInicioReal) {
    throw new ValidationError("Este servicio aún no tiene hora de inicio");
  }

  if (servicio.horaFinReal) {
    throw new ValidationError("Este servicio ya fue finalizado");
  }

  const now = new Date();
  const duracionReal = Math.round(
    (now.getTime() - servicio.horaInicioReal.getTime()) / 60000,
  );

  // Calculate efficiency: (estimated / actual) × 100
  // >100% = faster than estimated, <100% = slower
  const eficiencia = servicio.duracionEstimada
    ? Math.round((servicio.duracionEstimada / duracionReal) * 100)
    : null;

  await db()
    .update(ordenServicios)
    .set({
      horaFinReal: now,
      duracionReal,
    })
    .where(eq(ordenServicios.id, servicioId));

  return {
    servicioId,
    horaInicio: servicio.horaInicioReal.toISOString(),
    horaFin: now.toISOString(),
    duracionReal,
    duracionEstimada: servicio.duracionEstimada,
    eficiencia,
  };
}

// ─── Efficiency Reports ────────────────────────

/**
 * Calculates average efficiency for a technician.
 *
 * @param tecnicoId - Mechanic UUID
 * @param tenantSlug - Tenant identifier
 * @returns Efficiency metrics for the technician
 */
export async function getTechnicianEfficiency(
  tecnicoId: string,
  tenantSlug: string,
): Promise<TechnicianEfficiency> {
  const [result] = await db()
    .select({
      serviciosCompletados: sql<number>`COUNT(*)::int`,
      duracionEstimadaTotal: sql<number>`COALESCE(SUM(${ordenServicios.duracionEstimada}), 0)::int`,
      duracionRealTotal: sql<number>`COALESCE(SUM(${ordenServicios.duracionReal}), 0)::int`,
    })
    .from(ordenServicios)
    .innerJoin(ordenesTrabajo, eq(ordenServicios.ordenTrabajoId, ordenesTrabajo.id))
    .where(
      and(
        eq(ordenServicios.tecnicoId, tecnicoId),
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenServicios.horaFinReal} IS NOT NULL`,
      ),
    );

  const eficienciaPromedio =
    result.duracionRealTotal > 0
      ? Math.round((result.duracionEstimadaTotal / result.duracionRealTotal) * 100)
      : 0;

  return {
    tecnicoId,
    serviciosCompletados: result.serviciosCompletados,
    duracionEstimadaTotal: result.duracionEstimadaTotal,
    duracionRealTotal: result.duracionRealTotal,
    eficienciaPromedio,
  };
}

// ─── Bay Profitability ─────────────────────────

/**
 * Calculates profitability metrics for a specific bay.
 *
 * @param bayNumber - Bay number (1-10)
 * @param tenantSlug - Tenant identifier
 * @returns Bay profitability metrics
 */
export async function getBayProfitability(
  bayNumber: number,
  tenantSlug: string,
): Promise<BayProfitability> {
  const [result] = await db()
    .select({
      ordenesCompletadas: sql<number>`COUNT(*)::int`,
      ingresoTotal: sql<number>`COALESCE(SUM(${ordenesTrabajo.totalCost}), 0)::numeric`,
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.status} = 'Listo'`,
      ),
    );

  return {
    bayNumber,
    ordenesCompletadas: result.ordenesCompletadas,
    ingresoTotal: Number(result.ingresoTotal),
    horasActivas: 0,
    ingresoPorHora: 0,
  };
}
