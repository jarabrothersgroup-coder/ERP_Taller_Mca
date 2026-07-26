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
import { vehiculos } from "../schema/vehiculos.js";
import { ordenesTrabajo } from "../schema/ordenes-trabajo.js";

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
  serviciosPredichos: PredictedService[];
  proximoServicio: PredictedService | null;
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
  // Get vehicle info
  const [vehicle] = await db()
    .select({
      id: vehiculos.id,
      brand: vehiculos.brand,
      model: vehiculos.model,
      plate: vehiculos.plate,
      year: vehiculos.year,
    })
    .from(vehiculos)
    .where(eq(vehiculos.id, vehiculoId))
    .limit(1);

  if (!vehicle) {
    throw new Error(`Vehículo ${vehiculoId} no encontrado`);
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

  const kmActual = kmPorMes * 12; // Estimate current km
  const now = new Date();

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

  // Sort by urgency and km
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
    serviciosPredichos,
    proximoServicio: serviciosPredichos[0] || null,
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
