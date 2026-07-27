/**
 * AI Scheduling Service — Intelligent time-slot suggestions.
 *
 * Analyzes historical appointment data to suggest the best available
 * time slots for a given date, service type, and (optionally) client.
 *
 * Scoring factors:
 *   1. **No-show probability** — slots with historically low absence rates
 *   2. **Peak/off-peak** — balanced load (avoid 100% full slots)
 *   3. **Client history** — prefers same time/day as previous visits
 *   4. **Freshness** — prefers slots that haven't been fully booked recently
 *
 * @module scheduling/services/ai-scheduling
 */

import { eq, and, gte, sql, count } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { agendamientos } from "../schema/agendamientos.js";
import { timeToMinutes, getWorkingHours, getBusinessHours, isWorkingDay } from "./capacity.service.js";
import {
  SERVICIO_CONFIG,
  type TipoServicio,
} from "../types.js";

// ─── Types ────────────────────────────────────

export interface AISuggestion {
  /** Suggested time (HH:MM) */
  time: string;
  /** Confidence score 0–100 */
  score: number;
  /** Human-readable reason for the suggestion */
  reason: string;
  /** Whether this is a statistically "sweet spot" */
  isSweetSpot: boolean;
}

export interface AISuggestionsResponse {
  /** The requested date */
  date: string;
  /** Service type */
  tipoServicio: TipoServicio;
  /** Client identifier (if provided) */
  clientePhone?: string;
  /** Ranked suggestions (best first) */
  suggestions: AISuggestion[];
  /** How many total slots are available that day */
  totalAvailableSlots: number;
  /** Statistical context */
  insights: {
    /** Busiest hour (HH:00) */
    peakHour: string;
    /** Quietest hour (HH:00) */
    offPeakHour: string;
    /** Overall no-show rate for this day of week */
    noShowRate: number;
    /** Average bookings per day for this day of week */
    avgBookingsPerDay: number;
  };
}

// ─── Historical Analysis ──────────────────────

interface SlotStats {
  hour: number;
  totalBookings: number;
  noShows: number;
  confirmations: number;
  noShowRate: number;
  confirmationRate: number;
  avgOccupancy: number;
}

/**
 * Computes historical statistics for each hour slot
 * from past appointments for a given day of week and service type.
 */
async function computeSlotStats(
  dayOfWeek: number,
  tipoServicio: TipoServicio,
  tenantSlug: string,
): Promise<SlotStats[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().split("T")[0];

  const rows = await db()
    .select({
      horaTurno: agendamientos.horaTurno,
      estado: agendamientos.estado,
    })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.tenantSlug, tenantSlug),
        eq(agendamientos.tipoServicio, tipoServicio),
        gte(agendamientos.fechaTurno, cutoff),
        sql`EXTRACT(DOW FROM ${agendamientos.fechaTurno}::DATE) = ${dayOfWeek}`,
      ),
    );

  const hourBuckets = new Map<number, { total: number; noShows: number; confirmations: number }>();

  for (const row of rows) {
    const hour = parseInt(row.horaTurno.split(":")[0] || "0", 10);
    if (isNaN(hour)) continue;

    const bucket = hourBuckets.get(hour) || { total: 0, noShows: 0, confirmations: 0 };
    bucket.total++;

    if (row.estado === "AUSENTE" || row.estado === "CANCELADO") {
      bucket.noShows++;
    }
    if (row.estado === "CONFIRMADO" || row.estado === "PROCESADO_EN_ERP") {
      bucket.confirmations++;
    }

    hourBuckets.set(hour, bucket);
  }

  const stats: SlotStats[] = [];
  for (let hour = 7; hour <= 17; hour++) {
    const bucket = hourBuckets.get(hour);
    if (bucket) {
      stats.push({
        hour,
        totalBookings: bucket.total,
        noShows: bucket.noShows,
        confirmations: bucket.confirmations,
        noShowRate: bucket.total > 0 ? (bucket.noShows / bucket.total) * 100 : 0,
        confirmationRate: bucket.total > 0 ? (bucket.confirmations / bucket.total) * 100 : 0,
        avgOccupancy: Math.min(100, (bucket.total / 30) * 100),
      });
    } else {
      stats.push({
        hour,
        totalBookings: 0,
        noShows: 0,
        confirmations: 0,
        noShowRate: 15,
        confirmationRate: 70,
        avgOccupancy: 0,
      });
    }
  }

  return stats;
}

/**
 * Computes overall stats for the insights section.
 */
async function computeOverallStats(
  dayOfWeek: number,
  tenantSlug: string,
): Promise<{ noShowRate: number; avgBookingsPerDay: number }> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().split("T")[0];

  const [totalRow] = await db()
    .select({ total: count() })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.tenantSlug, tenantSlug),
        gte(agendamientos.fechaTurno, cutoff),
        sql`EXTRACT(DOW FROM ${agendamientos.fechaTurno}::DATE) = ${dayOfWeek}`,
      ),
    );

  const [noShowRow] = await db()
    .select({ total: count() })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.tenantSlug, tenantSlug),
        gte(agendamientos.fechaTurno, cutoff),
        sql`EXTRACT(DOW FROM ${agendamientos.fechaTurno}::DATE) = ${dayOfWeek}`,
        sql`${agendamientos.estado} IN ('AUSENTE', 'CANCELADO')`,
      ),
    );

  const total = Number(totalRow?.total ?? 0);
  const noShows = Number(noShowRow?.total ?? 0);
  const noShowRate = total > 0 ? (noShows / total) * 100 : 15;
  const avgBookingsPerDay = total > 0 ? Math.round(total / 12) : 0; // ~12 weeks in 90 days

  return { noShowRate, avgBookingsPerDay };
}

// ─── Client History ───────────────────────────

async function getClientPreferredHour(
  clientePhone: string,
  tenantSlug: string,
): Promise<number | null> {
  const rows = await db()
    .select({ horaTurno: agendamientos.horaTurno })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.clientePhone, clientePhone),
        eq(agendamientos.tenantSlug, tenantSlug),
        eq(agendamientos.estado, "PROCESADO_EN_ERP"),
      ),
    )
    .orderBy(sql`${agendamientos.createdAt} DESC`)
    .limit(20);

  if (rows.length === 0) return null;

  const hourCounts = new Map<number, number>();
  for (const row of rows) {
    const hour = parseInt(row.horaTurno.split(":")[0], 10);
    if (!isNaN(hour)) {
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
  }

  let bestHour: number | null = null;
  let bestCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestHour = hour;
    }
  }

  return bestHour;
}

// ─── Batched Availability Check ───────────────

/**
 * Fetches ALL active appointments for a given date in ONE query,
 * then computes availability for each slot in-memory.
 *
 * This avoids the N+1 problem of calling checkAvailability() in a loop,
 * and does NOT use SELECT FOR UPDATE (since this is a read-only GET).
 */
async function getAvailableSlotsBatched(
  dateStr: string,
  tipoServicio: TipoServicio,
  tenantSlug: string,
): Promise<string[]> {
  // 1. Quick pre-checks
  if (!isWorkingDay(dateStr)) return [];
  const hours = getWorkingHours(dateStr);
  if (!hours) return [];

  // 2. Fetch all non-cancelled appointments for that date (single query, no FOR UPDATE)
  const dayAppointments = await db()
    .select({
      horaTurno: agendamientos.horaTurno,
      duracionHoras: agendamientos.duracionHoras,
    })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.fechaTurno, dateStr),
        eq(agendamientos.tenantSlug, tenantSlug),
        sql`${agendamientos.estado} NOT IN ('CANCELADO', 'AUSENTE')`,
      ),
    );

  const bh = getBusinessHours();
  const config = SERVICIO_CONFIG[tipoServicio];
  const durationMinutes = config.durationHours * 60;
  const openMin = timeToMinutes(hours.open);
  const closeMin = timeToMinutes(hours.close);
  const interval = bh.slotIntervalMinutes;
  const maxCapacity = bh.maxCapacity;

  // 3. Build occupancy map: for each minute, how many appointments overlap?
  const occupancy = new Uint8Array(24 * 60); // 1440 minutes in a day

  for (const appt of dayAppointments) {
    const start = timeToMinutes(appt.horaTurno);
    const end = start + (appt.duracionHoras || 1) * 60;
    for (let m = start; m < end && m < 24 * 60; m++) {
      occupancy[m]++;
    }
  }

  // 4. Generate available slots
  const availableSlots: string[] = [];
  for (let m = openMin; m + durationMinutes <= closeMin; m += interval) {
    // Check if all minutes in this slot are under capacity
    let isFree = true;
    for (let offset = 0; offset < durationMinutes; offset++) {
      if (occupancy[m + offset] >= maxCapacity) {
        isFree = false;
        break;
      }
    }
    if (isFree) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      availableSlots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
  }

  return availableSlots;
}

// ─── Slot Scoring ─────────────────────────────

export interface ScoringContext {
  /** Day of week (0=Sun, 6=Sat) */
  dayOfWeek: number;
  /** Client's preferred hour from history (or null) */
  clientPreferredHour: number | null;
  /** Service type being booked */
  tipoServicio: TipoServicio;
}

/**
 * Scores a time slot based on multiple factors.
 *
 * Factors and weights:
 *   1. No-show rate (30%) — prefer slots where clients actually show up
 *   2. Occupancy (15%) — prefer slots with available capacity
 *   3. Client preference (15%) — if client has history, match their pattern
 *   4. Confirmation rate (10%) — prefer slots with high confirmation rates
 *   5. Day-of-week pattern (10%) — some days are historically better
 *   6. Service-type affinity (10%) — RAPIDO fits mornings, PESADO fits afternoons
 *   7. Time-of-day bonus (10%) — mid-morning sweet spot
 *
 * Returns a score 0–100.
 */
export function scoreSlot(
  hour: number,
  stats: SlotStats,
  ctx: ScoringContext,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 40; // Baseline (lower baseline to make good slots stand out more)

  // 1. No-show factor (up to ±20 points)
  if (stats.noShowRate < 10) {
    score += 18;
    reasons.push("Baja tasa de ausentismo histórico");
  } else if (stats.noShowRate < 20) {
    score += 10;
    reasons.push("Ausentismo moderado");
  } else if (stats.noShowRate > 30) {
    score -= 12;
    reasons.push("Tasa de ausentismo elevada en este horario");
  }

  // 2. Occupancy balance (up to ±10 points)
  if (stats.avgOccupancy < 30) {
    score += 10;
    reasons.push("Horario con buena disponibilidad");
  } else if (stats.avgOccupancy > 70) {
    score -= 8;
    reasons.push("Horario frecuentemente ocupado");
  } else if (stats.avgOccupancy < 50) {
    score += 5;
    reasons.push("Disponibilidad moderada");
  }

  // 3. Client preference bonus (up to +15 points)
  if (ctx.clientPreferredHour !== null && hour === ctx.clientPreferredHour) {
    score += 15;
    reasons.push("Coincide con tu horario habitual");
  } else if (ctx.clientPreferredHour !== null && Math.abs(hour - ctx.clientPreferredHour) <= 1) {
    score += 6;
    reasons.push("Cercano a tu horario habitual");
  }

  // 4. Confirmation rate (up to ±10 points)
  if (stats.confirmationRate > 80) {
    score += 10;
    reasons.push("Alta tasa de confirmación en este horario");
  } else if (stats.confirmationRate < 40) {
    score -= 6;
  }

  // 5. Day-of-week adjustment (up to ±8 points)
  // Weekends and Fridays tend to be quieter
  if (ctx.dayOfWeek === 6) {
    score += 8;
    reasons.push("Sábado — menor afluencia, mejor atención");
  } else if (ctx.dayOfWeek === 5) {
    score += 4;
    reasons.push("Viernes — buen momento para agendar");
  } else if (ctx.dayOfWeek === 1) {
    score -= 2;
    reasons.push("Lunes — suele ser un día muy solicitado");
  }

  // 6. Service-type affinity (up to ±8 points)
  // RAPIDO services work best in short windows (mornings)
  // PESADO services need longer blocks (from early to use full day)
  if (ctx.tipoServicio === "RAPIDO" && hour >= 8 && hour <= 11) {
    score += 8;
    reasons.push("Ideal para mantenimiento rápido (mañana)");
  } else if (ctx.tipoServicio === "PESADO" && hour >= 7 && hour <= 9) {
    score += 7;
    reasons.push("Óptimo para reparaciones mayores (todo el día libre)");
  } else if (ctx.tipoServicio === "PESADO" && hour > 11) {
    score -= 3;
    reasons.push("Reparación mayor — requiere más horas disponibles");
  }

  // 7. Time-of-day bonus (up to +5)
  if (hour >= 8 && hour <= 10) {
    score += 5;
    if (!reasons.some((r) => r.includes("mañana"))) {
      reasons.push("Horario recomendado (mañana temprano)");
    }
  } else if (hour >= 14 && hour <= 15) {
    score += 3;
    reasons.push("Primera hora de la tarde");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

// ─── Public API ───────────────────────────────

/**
 * Gets AI-powered scheduling suggestions for a given date and service type.
 *
 * Uses a single batched query to check availability (no FOR UPDATE, no N+1).
 *
 * @param dateStr - Date in YYYY-MM-DD
 * @param tipoServicio - Service type (RAPIDO or PESADO)
 * @param tenantSlug - Tenant identifier
 * @param clientePhone - Optional client phone for personalized suggestions
 * @returns Ranked suggestions with insights
 */
export async function getAISuggestions(
  dateStr: string,
  tipoServicio: TipoServicio,
  tenantSlug: string,
  clientePhone?: string,
): Promise<AISuggestionsResponse> {
  const date = new Date(dateStr + "T12:00:00");
  const dayOfWeek = date.getDay();

  // Run analysis in parallel
  const [slotStats, overallStats, clientPreferredHour, availableSlots] = await Promise.all([
    computeSlotStats(dayOfWeek, tipoServicio, tenantSlug),
    computeOverallStats(dayOfWeek, tenantSlug),
    clientePhone
      ? getClientPreferredHour(clientePhone, tenantSlug)
      : Promise.resolve(null),
    getAvailableSlotsBatched(dateStr, tipoServicio, tenantSlug),
  ]);

  // Peak / off-peak
  const sortedByOccupancy = [...slotStats].sort((a, b) => b.avgOccupancy - a.avgOccupancy);
  const peakHour = sortedByOccupancy.length > 0
    ? `${String(sortedByOccupancy[0].hour).padStart(2, "0")}:00`
    : "10:00";
  const offPeakHour = sortedByOccupancy.length > 0
    ? `${String(sortedByOccupancy[sortedByOccupancy.length - 1].hour).padStart(2, "0")}:00`
    : "07:00";

  // Score each available slot
  const suggestions: AISuggestion[] = [];
  const scoringCtx: ScoringContext = {
    dayOfWeek,
    clientPreferredHour,
    tipoServicio,
  };

  for (const time of availableSlots) {
    const hour = parseInt(time.split(":")[0], 10);
    const stats = slotStats.find((s) => s.hour === hour) || {
      hour,
      totalBookings: 0, noShows: 0, confirmations: 0,
      noShowRate: 15, confirmationRate: 70, avgOccupancy: 0,
    };

    const { score, reasons } = scoreSlot(hour, stats, scoringCtx);
    const isSweetSpot = score >= 72 && stats.noShowRate < 18;

    suggestions.push({
      time,
      score,
      reason: reasons[0] || "Horario disponible",
      isSweetSpot,
    });
  }

  // Sort: sweet spots first, then by score desc, then by time
  suggestions.sort((a, b) => {
    if (a.isSweetSpot && !b.isSweetSpot) return -1;
    if (!a.isSweetSpot && b.isSweetSpot) return 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.time.localeCompare(b.time);
  });

  return {
    date: dateStr,
    tipoServicio,
    clientePhone,
    suggestions: suggestions.slice(0, 6),
    totalAvailableSlots: suggestions.length,
    insights: {
      peakHour,
      offPeakHour,
      noShowRate: Math.round(overallStats.noShowRate * 10) / 10,
      avgBookingsPerDay: overallStats.avgBookingsPerDay,
    },
  };
}

/**
 * Gets a quick "best time" suggestion for a date and service.
 */
export async function getQuickSuggestion(
  dateStr: string,
  tipoServicio: TipoServicio,
  tenantSlug: string,
): Promise<{ suggestedTime: string; reason: string } | null> {
  const result = await getAISuggestions(dateStr, tipoServicio, tenantSlug);
  if (result.suggestions.length === 0) return null;
  const best = result.suggestions[0];
  return { suggestedTime: best.time, reason: best.reason };
}
