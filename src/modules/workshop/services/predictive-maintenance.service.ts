/**
 * Predictive Maintenance Service — km-based service prediction.
 *
 * Analyzes vehicle history to predict upcoming maintenance needs
 * based on mileage patterns and service intervals.
 *
 * @module workshop/services/predictive-maintenance.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError } from "../../../shared/errors/app-error.js";
import { vehiculos } from "../schema/vehiculos.js";
import { ordenesTrabajo } from "../schema/ordenes-trabajo.js";
import { mantenimientosProgramados } from "../schema/mantenimientos-programados.js";

// ─── Types ────────────────────────────────────

export interface PredictedService {
  servicio: string;
  kmEstimado: number;
  fechaEstimada: string;
  urgencia: "alta" | "media" | "baja";
  costoEstimado: number;
  descripcion: string;
}

export interface VehiclePrediction {
  vehiculoId: string;
  vehiculo: string;
  placa: string;
  kmActual: number;
  kmPorMes: number;
  /** true si `kmActual` salió del odómetro real (vehiculos.kilometraje) */
  kmReal: boolean;
  serviciosPredichos: PredictedService[];
  proximoServicio: PredictedService | null;
  /** Ficha persistida (mantenimientos_programados) — T-43 */
  programados: Array<{
    id: string;
    servicio: string;
    kmObjetivo: number | null;
    fechaObjetivo: string | null;
    estado: string;
    origen: string;
  }>;
}

// ─── Service Intervals ────────────────────────

const SERVICE_INTERVALS = [
  { servicio: "Cambio de aceite", kmIntervalo: 5000, costoEstimado: 150000, descripcion: "Cambio de aceite y filtro" },
  { servicio: "Filtros", kmIntervalo: 10000, costoEstimado: 80000, descripcion: "Cambio de filtro de aire, combustible" },
  { servicio: "Frenos", kmIntervalo: 20000, costoEstimado: 250000, descripcion: "Revisión y cambio de pastillas" },
  { servicio: "Rotación de neumáticos", kmIntervalo: 10000, costoEstimado: 50000, descripcion: "Rotación y balanceo" },
  { servicio: "Transmisión", kmIntervalo: 40000, costoEstimado: 350000, descripcion: "Cambio de aceite de transmisión" },
  { servicio: "Correa de distribución", kmIntervalo: 60000, costoEstimado: 800000, descripcion: "Cambio de correa y tensores" },
  { servicio: "Refrigerante", kmIntervalo: 30000, costoEstimado: 120000, descripcion: "Cambio de refrigerante" },
  { servicio: "Bujías", kmIntervalo: 30000, costoEstimado: 100000, descripcion: "Cambio de bujías" },
];

// ─── Prediction Logic ─────────────────────────

/**
 * Predicts upcoming maintenance for a vehicle.
 *
 * @param vehiculoId - Vehicle UUID
 * @param tenantSlug - Tenant identifier
 * @returns Prediction with upcoming services
 */
export async function predictMaintenance(
  vehiculoId: string,
  tenantSlug: string,
): Promise<VehiclePrediction> {
  // Get vehicle info — TENANT-SCOPED (T-43: antes un UUID ajeno devolvía
  // predicciones de otro tenant; ahora es 404)
  const [vehicle] = await db()
    .select({
      id: vehiculos.id,
      brand: vehiculos.brand,
      model: vehiculos.model,
      plate: vehiculos.plate,
      year: vehiculos.year,
      kilometraje: vehiculos.kilometraje,
    })
    .from(vehiculos)
    .where(
      and(
        eq(vehiculos.id, vehiculoId),
        eq(vehiculos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!vehicle) {
    throw new NotFoundError(`Vehículo ${vehiculoId} no encontrado`);
  }

  // Get recent OTs to estimate km usage
  const recentOTs = await db()
    .select({
      createdAt: ordenesTrabajo.createdAt,
      description: ordenesTrabajo.description,
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.vehicleId, vehiculoId),
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
      ),
    )
    .orderBy(desc(ordenesTrabajo.createdAt))
    .limit(10);

  // Estimate km per month based on visit frequency
  let kmPorMes = 1500; // Default: ~1500 km/month for Paraguay
  if (recentOTs.length >= 2) {
    // Calculate average interval between visits in days
    let totalDays = 0;
    for (let i = 1; i < recentOTs.length; i++) {
      const prev = new Date(recentOTs[i - 1]!.createdAt);
      const curr = new Date(recentOTs[i]!.createdAt);
      totalDays += Math.abs(curr.getTime() - prev.getTime()) / 86400000;
    }
    const avgDaysBetweenVisits = totalDays / (recentOTs.length - 1);
    // Estimate km: assume ~50km per workshop visit on average
    if (avgDaysBetweenVisits > 0) {
      kmPorMes = Math.round((30 / avgDaysBetweenVisits) * 50);
    }
  }

  // ── T-43 (SRV-03): km REAL del odómetro cuando existe ──
  // Antes: kmActual = kmPorMes * 12 (inventado). Ahora el odómetro de
  // `vehiculos.kilometraje` (alimentado por cada ingreso) manda; el cálculo
  // por visita solo queda como fallback para vehículos sin km registrado.
  const kmEstimado = kmPorMes * 12;
  const kmActual = vehicle.kilometraje ?? kmEstimado;
  const kmReal = vehicle.kilometraje !== null;
  const now = new Date();

  // Ficha persistida (T-43): mantenimientos programados PENDIENTES
  const programadosRows = await db()
    .select({
      id: mantenimientosProgramados.id,
      servicio: mantenimientosProgramados.servicio,
      kmObjetivo: mantenimientosProgramados.kmObjetivo,
      fechaObjetivo: mantenimientosProgramados.fechaObjetivo,
      estado: mantenimientosProgramados.estado,
      origen: mantenimientosProgramados.origen,
    })
    .from(mantenimientosProgramados)
    .where(
      and(
        eq(mantenimientosProgramados.vehiculoId, vehiculoId),
        eq(mantenimientosProgramados.tenantSlug, tenantSlug),
        eq(mantenimientosProgramados.estado, "PENDIENTE"),
      ),
    )
    .orderBy(mantenimientosProgramados.fechaObjetivo)
    .limit(50);

  // Predict services
  const serviciosPredichos: PredictedService[] = [];

  for (const interval of SERVICE_INTERVALS) {
    const kmRestante = interval.kmIntervalo - (kmActual % interval.kmIntervalo);
    const mesesRestantes = Math.round(kmRestante / kmPorMes);
    const fechaEstimada = new Date(now);
    fechaEstimada.setMonth(fechaEstimada.getMonth() + mesesRestantes);

    let urgencia: "alta" | "media" | "baja";
    if (kmRestante <= 500) urgencia = "alta";
    else if (kmRestante <= 2000) urgencia = "media";
    else urgencia = "baja";

    serviciosPredichos.push({
      servicio: interval.servicio,
      kmEstimado: kmActual + kmRestante,
      fechaEstimada: fechaEstimada.toISOString().split("T")[0],
      urgencia,
      costoEstimado: interval.costoEstimado,
      descripcion: interval.descripcion,
    });
  }

  // ── T-43: la ficha persistida manda sobre la predicción genérica ──
  // Un mantenimiento programado con su objetivo real entra primero y con
  // urgencia calculada contra el km actual / fecha de hoy.
  for (const p of programadosRows) {
    const kmRestante =
      p.kmObjetivo !== null ? Math.max(p.kmObjetivo - kmActual, 0) : null;
    const diasRestantes = p.fechaObjetivo
      ? Math.ceil(
          (new Date(`${p.fechaObjetivo}T12:00:00`).getTime() - now.getTime()) /
            86400000,
        )
      : null;

    let urgencia: "alta" | "media" | "baja" = "baja";
    if (
      (kmRestante !== null && kmRestante <= 500) ||
      (diasRestantes !== null && diasRestantes <= 7)
    ) {
      urgencia = "alta";
    } else if (
      (kmRestante !== null && kmRestante <= 2000) ||
      (diasRestantes !== null && diasRestantes <= 30)
    ) {
      urgencia = "media";
    }

    const mesesEstimados =
      kmRestante !== null && kmPorMes > 0
        ? Math.round(kmRestante / kmPorMes)
        : diasRestantes !== null
          ? Math.round(diasRestantes / 30)
          : 0;
    const fechaEstimada = new Date(now);
    fechaEstimada.setMonth(fechaEstimada.getMonth() + mesesEstimados);

    serviciosPredichos.unshift({
      servicio: p.servicio,
      kmEstimado: p.kmObjetivo ?? kmActual,
      fechaEstimada: (p.fechaObjetivo ?? fechaEstimada.toISOString().split("T")[0])!,
      urgencia,
      costoEstimado:
        SERVICE_INTERVALS.find((i) => p.servicio.toLowerCase().includes(i.servicio.toLowerCase()))
          ?.costoEstimado ?? 150000,
      descripcion: `Programado (${p.origen === "OT_COMPLETADA" ? "generado por OT" : p.origen.toLowerCase()})`,
    });
  }

  serviciosPredichos.sort((a, b) => {
    const urgenciaOrder = { alta: 0, media: 1, baja: 2 };
    return urgenciaOrder[a.urgencia] - urgenciaOrder[b.urgencia];
  });

  return {
    vehiculoId,
    vehiculo: `${vehicle.brand} ${vehicle.model}`,
    placa: vehicle.plate || "S/N",
    kmActual,
    kmPorMes,
    kmReal,
    serviciosPredichos,
    proximoServicio: serviciosPredichos[0] || null,
    programados: programadosRows,
  };
}

/**
 * Gets predictions for all active vehicles in a tenant.
 *
 * @param tenantSlug - Tenant identifier
 * @returns Array of vehicle predictions
 */
export async function getAllPredictions(
  tenantSlug: string,
): Promise<VehiclePrediction[]> {
  const vehicles = await db()
    .select({ id: vehiculos.id })
    .from(vehiculos)
    .where(eq(vehiculos.tenantSlug, tenantSlug))
    .limit(100);

  const predictions: VehiclePrediction[] = [];
  // Batch parallel with concurrency limit of 10 to avoid DB connection flood
  const BATCH = 10;
  for (let i = 0; i < vehicles.length; i += BATCH) {
    const batch = vehicles.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((v) => predictMaintenance(v.id, tenantSlug)),
    );
    for (const r of results) {
      if (r.status === "fulfilled") predictions.push(r.value);
    }
  }

  return predictions.filter((p) => p.proximoServicio?.urgencia === "alta");
}
