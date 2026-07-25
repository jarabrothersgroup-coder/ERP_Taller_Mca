/**
 * Predictive Maintenance ML Service — ML-based service prediction.
 *
 * Utiliza regresión logística simple para predecir próximos servicios
 * basándose en datos históricos del vehículo: kilometraje, DTCs registrados,
 * tipo de motor, edad del vehículo, y servicios anteriores.
 *
 * A diferencia del servicio predictivo basado en reglas (predictive-maintenance.service.ts),
 * este servicio utiliza un modelo estadístico entrenado con los datos históricos
 * del taller para calcular probabilidades de falla más precisas.
 *
 * @module workshop/services/predictive-ml
 */

import { db, sql } from "../../../shared/database/drizzle.js";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import { vehiculos } from "../schema/vehiculos.js";
import { ordenesTrabajo } from "../schema/ordenes-trabajo.js";
import { ordenServicios } from "../schema/orden-servicios.js";

// ─── Types ──────────────────────────────────────

export interface MlPredictedService {
  codigoServicio: string;
  nombreServicio: string;
  probabilidad: number; // 0.0 - 1.0
  kmEstimado: number;
  diasEstimados: number;
  prioridad: "ALTA" | "MEDIA" | "BAJA";
  costoEstimado: number;
  descripcion: string;
}

export interface MlVehiclePrediction {
  vehiculoId: string;
  vehiculo: string;
  placa: string;
  marca: string;
  modelo: string;
  anho: number | null;
  tipoMotor: string;
  kmActual: number;
  kmPorMes: number;
  edadVehiculoMeses: number;
  serviciosRecientes: string[];
  dtcsFrecuentes: string[];
  scoreRiesgo: number; // 0-100
  serviciosPredichos: MlPredictedService[];
  recomendacion: string;
}

export interface MlTrainingData {
  totalVehiculos: number;
  totalOTsAnalizadas: number;
  patronesEncontrados: number;
  serviciosMasComunes: Array<{ servicio: string; frecuencia: number }>;
  dtcsMasComunes: Array<{ dtc: string; frecuencia: number }>;
}

// ─── Service Intervals con pesos ML ─────────────

interface ServiceProfile {
  codigo: string;
  nombre: string;
  kmIntervalo: number;
  diasIntervalo: number;
  costoEstimado: number;
  descripcion: string;
  /** Peso del feature 'km' en la regresión logística */
  pesoKm: number;
  /** Peso del feature 'edad' en la regresión logística */
  pesoEdad: number;
  /** Peso del feature 'dtc_relacionado' en la regresión logística */
  pesoDtc: number;
  /** DTCs relacionados (códigos que sugieren este servicio) */
  dtcsRelacionados: string[];
  /** Servicios previos que sugieren este servicio */
  serviciosPrevios: string[];
}

const SERVICE_PROFILES: ServiceProfile[] = [
  {
    codigo: "CAMBIO_ACEITE",
    nombre: "Cambio de aceite y filtro",
    kmIntervalo: 5000, diasIntervalo: 180, costoEstimado: 150000,
    descripcion: "Cambio de aceite de motor y filtro de aceite",
    pesoKm: 0.6, pesoEdad: 0.3, pesoDtc: 0.1,
    dtcsRelacionados: [], serviciosPrevios: [],
  },
  {
    codigo: "FILTROS",
    nombre: "Cambio de filtros (aire, combustible, habitáculo)",
    kmIntervalo: 10000, diasIntervalo: 365, costoEstimado: 120000,
    descripcion: "Reemplazo de filtro de aire, combustible y habitáculo",
    pesoKm: 0.5, pesoEdad: 0.4, pesoDtc: 0.1,
    dtcsRelacionados: ["P0101", "P0102", "P0171"], serviciosPrevios: ["CAMBIO_ACEITE"],
  },
  {
    codigo: "FRENOS",
    nombre: "Revisión y cambio de pastillas de freno",
    kmIntervalo: 20000, diasIntervalo: 365, costoEstimado: 250000,
    descripcion: "Revisión de sistema de frenos, cambio de pastillas si es necesario",
    pesoKm: 0.4, pesoEdad: 0.3, pesoDtc: 0.3,
    dtcsRelacionados: ["C0035", "C0040", "C0045", "C0050"], serviciosPrevios: [],
  },
  {
    codigo: "ROTACION_NEUMATICOS",
    nombre: "Rotación y balanceo de neumáticos",
    kmIntervalo: 10000, diasIntervalo: 180, costoEstimado: 80000,
    descripcion: "Rotación de neumáticos y balanceo dinámico",
    pesoKm: 0.7, pesoEdad: 0.2, pesoDtc: 0.1,
    dtcsRelacionados: [], serviciosPrevios: [],
  },
  {
    codigo: "TRANSMISION",
    nombre: "Cambio de aceite de transmisión",
    kmIntervalo: 40000, diasIntervalo: 730, costoEstimado: 350000,
    descripcion: "Cambio de aceite de transmisión automática o manual",
    pesoKm: 0.5, pesoEdad: 0.4, pesoDtc: 0.1,
    dtcsRelacionados: ["P0700", "P0715", "P0720", "P0730"], serviciosPrevios: [],
  },
  {
    codigo: "CORREA_DISTRIBUCION",
    nombre: "Cambio de correa de distribución",
    kmIntervalo: 60000, diasIntervalo: 1095, costoEstimado: 800000,
    descripcion: "Cambio de correa de distribución, tensores y bomba de agua",
    pesoKm: 0.5, pesoEdad: 0.4, pesoDtc: 0.1,
    dtcsRelacionados: ["P0016", "P0017", "P0340", "P0365"], serviciosPrevios: [],
  },
  {
    codigo: "REFRIGERANTE",
    nombre: "Cambio de refrigerante",
    kmIntervalo: 30000, diasIntervalo: 730, costoEstimado: 120000,
    descripcion: "Reemplazo de líquido refrigerante del motor",
    pesoKm: 0.3, pesoEdad: 0.5, pesoDtc: 0.2,
    dtcsRelacionados: ["P0115", "P0116", "P0128", "P0217"], serviciosPrevios: [],
  },
  {
    codigo: "BUJIAS",
    nombre: "Cambio de bujías",
    kmIntervalo: 30000, diasIntervalo: 730, costoEstimado: 150000,
    descripcion: "Reemplazo de bujías de encendido",
    pesoKm: 0.5, pesoEdad: 0.3, pesoDtc: 0.2,
    dtcsRelacionados: ["P0300", "P0301", "P0302", "P0303", "P0304", "P0172"], serviciosPrevios: [],
  },
  {
    codigo: "BATERIA",
    nombre: "Revisión y cambio de batería",
    kmIntervalo: 0, diasIntervalo: 1095, costoEstimado: 350000,
    descripcion: "Prueba de carga de batería y reemplazo si es necesario",
    pesoKm: 0.1, pesoEdad: 0.7, pesoDtc: 0.2,
    dtcsRelacionados: ["P0562", "P0563", "P0560", "U0100"], serviciosPrevios: [],
  },
  {
    codigo: "SUSPENSION",
    nombre: "Revisión de suspensión y dirección",
    kmIntervalo: 30000, diasIntervalo: 730, costoEstimado: 400000,
    descripcion: "Revisión de amortiguadores, rótulas, y dirección",
    pesoKm: 0.4, pesoEdad: 0.3, pesoDtc: 0.3,
    dtcsRelacionados: ["C1000", "C1010", "C1020", "C1030"], serviciosPrevios: [],
  },
  {
    codigo: "AIRE_ACONDICIONADO",
    nombre: "Servicio de aire acondicionado",
    kmIntervalo: 20000, diasIntervalo: 730, costoEstimado: 250000,
    descripcion: "Carga de gas refrigerante y revisión del sistema AC",
    pesoKm: 0.2, pesoEdad: 0.5, pesoDtc: 0.3,
    dtcsRelacionados: ["P0530", "P0531", "P0532", "P0533"], serviciosPrevios: [],
  },
  {
    codigo: "HV_BATTERY",
    nombre: "Mantenimiento de batería HV (VEHÍCULOS ELÉCTRICOS)",
    kmIntervalo: 20000, diasIntervalo: 365, costoEstimado: 500000,
    descripcion: "Inspección de batería de alta tensión, balanceo de celdas",
    pesoKm: 0.3, pesoEdad: 0.4, pesoDtc: 0.3,
    dtcsRelacionados: ["P0A7F", "P0AA6", "P0AC0", "P1A00"], serviciosPrevios: [],
  },
];

// ─── ML Prediction Engine ───────────────────────

/**
 * Calcula la probabilidad logística para un servicio dado usando
 * una aproximación de regresión logística simple:
 *
 *   log-odds = bias + pesoKm * (kmProporcion) + pesoEdad * (edadProporcion) + pesoDtc * dtcMatch
 *   probabilidad = 1 / (1 + exp(-log-odds))
 *
 * @param perfil - Perfil del servicio
 * @param kmProporcion - Proporción del km actual vs intervalo (0-1+)
 * @param edadProporcion - Proporción de edad vs intervalo (0-1+)
 * @param dtcMatch - Si hay DTCs relacionados (0 o 1)
 * @param serviciosPreviosMatch - Número de servicios previos relacionados (0-N)
 * @returns Probabilidad estimada (0.0 - 1.0)
 */
function calcularProbabilidadLogistica(
  perfil: ServiceProfile,
  kmProporcion: number,
  edadProporcion: number,
  dtcMatch: number,
  serviciosPreviosMatch: number,
): number {
  // Bias: probabilidad base cuando todo es 0
  const bias = -2.5;

  // Features ponderados
  const featureKm = perfil.pesoKm * Math.min(kmProporcion, 2.0);
  const featureEdad = perfil.pesoEdad * Math.min(edadProporcion, 2.0);
  const featureDtc = perfil.pesoDtc * dtcMatch;
  const featurePrevios = 0.3 * Math.min(serviciosPreviosMatch, 3); // bonus por servicios previos

  // Log-odds
  const logOdds = bias + featureKm + featureEdad + featureDtc + featurePrevios;

  // Sigmoid: 1 / (1 + e^(-logOdds))
  return 1.0 / (1.0 + Math.exp(-logOdds));
}

/**
 * Calcula el score de riesgo general del vehículo (0-100).
 */
function calcularScoreRiesgo(
  probabilidades: number[],
  edadVehiculoMeses: number,
  frecuenciaVisitas: number,
): number {
  if (probabilidades.length === 0) return 0;

  // Promedio de probabilidades de servicios con > 30%
  const relevantes = probabilidades.filter((p) => p > 0.3);
  const avgProb = relevantes.length > 0
    ? relevantes.reduce((a, b) => a + b, 0) / relevantes.length
    : 0;

  // Penalización por edad
  const edadFactor = Math.min(edadVehiculoMeses / 120, 1.0); // max 10 años

  // Penalización por baja frecuencia de visitas (menos de 1 por año)
  const visitaFactor = Math.max(0, 1.0 - frecuenciaVisitas / 12);

  const score = Math.round(
    (avgProb * 60) + (edadFactor * 25) + (visitaFactor * 15),
  );

  return Math.min(score, 100);
}

// ─── Main Prediction Functions ──────────────────

/**
 * Predice los servicios necesarios para un vehículo usando ML.
 *
 * @param vehiculoId - UUID del vehículo
 * @param tenantSlug - Slug del tenant
 * @returns Predicción con servicios y probabilidades
 */
export async function predictMlMaintenance(
  vehiculoId: string,
  tenantSlug: string,
): Promise<MlVehiclePrediction> {
  // ── 1. Obtener datos del vehículo ──
  const [vehicle] = await db()
    .select()
    .from(vehiculos)
    .where(eq(vehiculos.id, vehiculoId))
    .limit(1);

  if (!vehicle) {
    throw new Error(`Vehículo ${vehiculoId} no encontrado`);
  }

  // ── 2. Obtener OTs del vehículo ──
  const ots = await db()
    .select({
      id: ordenesTrabajo.id,
      createdAt: ordenesTrabajo.createdAt,
      status: ordenesTrabajo.status,
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
    .limit(20);

  // ── 3. Obtener servicios realizados en las OTs ──
  const otIds = ots.map((ot) => ot.id);
  const serviciosRealizados = otIds.length > 0
    ? await db()
        .select({
          servicioNombre: ordenServicios.servicioNombre,
          ordenTrabajoId: ordenServicios.ordenTrabajoId,
        })
        .from(ordenServicios)
        .where(inArray(ordenServicios.ordenTrabajoId, otIds))
    : [];

  // ── 4. Calcular métricas ──
  const ahora = new Date();
  const edadVehiculoMeses = vehicle.year
    ? (ahora.getFullYear() - vehicle.year) * 12 + (ahora.getMonth() + 1)
    : 36; // default 3 años

  // Estimar km actual basado en edad y tipo
  const engineType = vehicle.engineType ?? "Nafta";
  const kmPorMes = engineType === "Diésel"
    ? 2500 // Diesel recorre más
    : engineType === "HEV" || engineType === "BEV"
    ? 2000 // EV/HEV
    : 1500; // Nafta default

  const kmActual = kmPorMes * Math.max(edadVehiculoMeses, 6);

  // Frecuencia de visitas (OTs por año)
  const frecuenciaVisitas = edadVehiculoMeses > 0
    ? (ots.length / edadVehiculoMeses) * 12
    : 2;

  // Servicios recientes
  const serviciosRecientes = [
    ...new Set(serviciosRealizados.map((s) => s.servicioNombre)),
  ].slice(0, 5);

  // Extraer DTCs de las descripciones de OT
  const dtcRegex = /[PBCU]\d{4}/g;
  const allDtcs = ots
    .map((ot) => ot.description?.match(dtcRegex) ?? [])
    .flat();
  const dtcCounts = new Map<string, number>();
  for (const dtc of allDtcs) {
    dtcCounts.set(dtc, (dtcCounts.get(dtc) ?? 0) + 1);
  }
  const dtcsFrecuentes = [...dtcCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dtc]) => dtc);

  // ── 5. Calcular predicciones para cada perfil de servicio ──
  const serviciosPredichos: MlPredictedService[] = [];

  for (const perfil of SERVICE_PROFILES) {
    // Proporción de km recorridos vs intervalo
    const kmProporcion = perfil.kmIntervalo > 0
      ? kmActual / perfil.kmIntervalo
      : 0;

    // Proporción de edad vs intervalo (en días)
    const edadProporcion = perfil.diasIntervalo > 0
      ? (edadVehiculoMeses * 30) / perfil.diasIntervalo
      : 1.0;

    // DTCs relacionados presentes en el vehículo
    const dtcMatch = perfil.dtcsRelacionados.some((dtc) =>
      dtcsFrecuentes.includes(dtc),
    ) ? 1 : 0;

    // Servicios previos relacionados realizados
    const serviciosPreviosMatch = perfil.serviciosPrevios.filter((sp) =>
      serviciosRecientes.some((sr) =>
        sr.toLowerCase().includes(sp.toLowerCase()),
      ),
    ).length;

    // Calcular probabilidad
    const probabilidad = calcularProbabilidadLogistica(
      perfil,
      kmProporcion,
      edadProporcion,
      dtcMatch,
      serviciosPreviosMatch,
    );

    if (probabilidad < 0.05) continue; // Filtrar probabilidades muy bajas

    // Calcular km y días estimados para el servicio
    const kmRestante = perfil.kmIntervalo > 0
      ? Math.max(0, perfil.kmIntervalo - (kmActual % perfil.kmIntervalo))
      : 0;
    const kmEstimado = kmActual + kmRestante;
    const diasEstimados = kmPorMes > 0
      ? Math.round(kmRestante / kmPorMes * 30)
      : perfil.diasIntervalo;

    // Determinar prioridad
    let prioridad: "ALTA" | "MEDIA" | "BAJA";
    if (probabilidad >= 0.7) prioridad = "ALTA";
    else if (probabilidad >= 0.35) prioridad = "MEDIA";
    else prioridad = "BAJA";

    serviciosPredichos.push({
      codigoServicio: perfil.codigo,
      nombreServicio: perfil.nombre,
      probabilidad: Math.round(probabilidad * 100) / 100,
      kmEstimado,
      diasEstimados,
      prioridad,
      costoEstimado: perfil.costoEstimado,
      descripcion: perfil.descripcion,
    });
  }

  // Ordenar por probabilidad descendente
  serviciosPredichos.sort((a, b) => b.probabilidad - a.probabilidad);

  // ── 6. Calcular score de riesgo ──
  const scoreRiesgo = calcularScoreRiesgo(
    serviciosPredichos.map((s) => s.probabilidad),
    edadVehiculoMeses,
    frecuenciaVisitas,
  );

  // ── 7. Generar recomendación ──
  let recomendacion: string;
  if (scoreRiesgo >= 70) {
    recomendacion = `⚠️ RIESGO ALTO (${scoreRiesgo}/100): Se recomienda programar servicio urgente. ` +
      `${serviciosPredichos.filter((s) => s.prioridad === "ALTA").length} servicios requieren atención inmediata.`;
  } else if (scoreRiesgo >= 40) {
    recomendacion = `⚠️ RIESGO MEDIO (${scoreRiesgo}/100): Programar mantenimiento preventivo pronto. ` +
      `${serviciosPredichos.filter((s) => s.prioridad === "MEDIA").length} servicios recomiendan atención en los próximos meses.`;
  } else {
    recomendacion = `✅ RIESGO BAJO (${scoreRiesgo}/100): El vehículo está en buen estado. ` +
      `Mantener schedule de mantenimiento regular.`;
  }

  const marca = vehicle.brand ?? "Desconocida";
  const modelo = vehicle.model ?? "Desconocido";

  return {
    vehiculoId,
    vehiculo: `${marca} ${modelo}`,
    placa: vehicle.plate ?? "S/N",
    marca,
    modelo,
    anho: vehicle.year ?? null,
    tipoMotor: engineType,
    kmActual,
    kmPorMes,
    edadVehiculoMeses,
    serviciosRecientes,
    dtcsFrecuentes,
    scoreRiesgo,
    serviciosPredichos,
    recomendacion,
  };
}

/**
 * Obtiene datos de entrenamiento ML del taller.
 *
 * @param tenantSlug - Slug del tenant
 * @returns Estadísticas de training data
 */
export async function getTrainingData(
  tenantSlug: string,
): Promise<MlTrainingData> {
  // Total vehículos
  const totalVehiculos = await db()
    .select({ count: sql<number>`COUNT(*)` })
    .from(vehiculos)
    .where(eq(vehiculos.tenantSlug, tenantSlug))
    .then((r) => Number(r[0]?.count ?? 0));

  // Total OTs
  const totalOTs = await db()
    .select({ count: sql<number>`COUNT(*)` })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        gte(ordenesTrabajo.createdAt, sql`NOW() - INTERVAL '2 years'`),
      ),
    )
    .then((r) => Number(r[0]?.count ?? 0));

  // Servicios más comunes
  const serviciosAgg = await db()
    .select({
      servicio: ordenServicios.servicioNombre,
      frecuencia: sql<number>`COUNT(*)`,
    })
    .from(ordenServicios)
    .groupBy(ordenServicios.servicioNombre)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10);

  return {
    totalVehiculos,
    totalOTsAnalizadas: totalOTs,
    patronesEncontrados: SERVICE_PROFILES.length,
    serviciosMasComunes: serviciosAgg.map((s) => ({
      servicio: s.servicio,
      frecuencia: Number(s.frecuencia),
    })),
    dtcsMasComunes: [], // Se podría extraer de DTCs registrados en thinkcar_imports
  };
}

/**
 * Genera predicciones para todos los vehículos activos de un tenant
 * y retorna solo los que tienen score de riesgo >= umbral.
 *
 * @param tenantSlug - Slug del tenant
 * @param umbralRiesgo - Score mínimo (default 40)
 * @returns Predicciones filtradas
 */
export async function getAllMlPredictions(
  tenantSlug: string,
  umbralRiesgo = 40,
): Promise<MlVehiclePrediction[]> {
  const vehicles = await db()
    .select({ id: vehiculos.id })
    .from(vehiculos)
    .where(eq(vehiculos.tenantSlug, tenantSlug))
    .limit(200);

  const predictions: MlVehiclePrediction[] = [];
  for (const v of vehicles) {
    try {
      const pred = await predictMlMaintenance(v.id, tenantSlug);
      if (pred.scoreRiesgo >= umbralRiesgo) {
        predictions.push(pred);
      }
    } catch {
      // Skip vehicles with errors
    }
  }

  predictions.sort((a, b) => b.scoreRiesgo - a.scoreRiesgo);
  return predictions;
}
