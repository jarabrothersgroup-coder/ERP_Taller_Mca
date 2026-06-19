/**
 * Capacity Control Service — Workshop availability engine.
 *
 * Validates whether a time slot is available based on:
 *   1. Business hours (Lun-Vie 07:30-17:30, Sáb 07:30-12:00)
 *   2. Bay capacity (max N vehicles simultaneously)
 *   3. Service type duration (RAPIDO=1h, PESADO=4h)
 *
 * RAM impact: ~2 KB (pure functions, no state).
 *
 * @module scheduling/services/capacity.service
 */

import { eq, and, ne } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { agendamientos } from "../schema/agendamientos.js";
import {
  DEFAULT_BUSINESS_HOURS,
  SERVICIO_CONFIG,
  type BusinessHours,
  type TipoServicio,
  type CheckAvailabilityResponse,
  type DayOfWeek,
} from "../types.js";

// ─── Configuration ─────────────────────────────────────

let businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS;

/**
 * Overrides the default business hours configuration.
 *
 * @param config - Custom business hours
 */
export function setBusinessHours(config: BusinessHours): void {
  businessHours = config;
}

/**
 * Gets the current business hours configuration.
 */
export function getBusinessHours(): BusinessHours {
  return businessHours;
}

// ─── Time Utilities ────────────────────────────────────

/**
 * Parses a "HH:MM" string to minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts minutes since midnight to "HH:MM" string.
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Adds hours to a "HH:MM" time string.
 */
export function addHours(time: string, hours: number): string {
  const totalMinutes = timeToMinutes(time) + hours * 60;
  return minutesToTime(totalMinutes);
}

/**
 * Parses a "YYYY-MM-DD" string to a Date object (local time, no timezone).
 */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Gets the day of week for a date string.
 */
export function getDayOfWeek(dateStr: string): DayOfWeek {
  return parseDate(dateStr).getDay() as DayOfWeek;
}

// ─── Business Hours Validation ─────────────────────────

/**
 * Checks if a date is a working day.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns true if the day has configured working hours
 */
export function isWorkingDay(dateStr: string): boolean {
  const dow = getDayOfWeek(dateStr);
  return businessHours.slots[dow] !== null;
}

/**
 * Gets the working hours for a specific date.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Time slot or null if closed
 */
export function getWorkingHours(
  dateStr: string,
): { open: string; close: string } | null {
  const dow = getDayOfWeek(dateStr);
  return businessHours.slots[dow];
}

/**
 * Validates that a time falls within business hours.
 *
 * @param dateStr - Date in YYYY-MM-DD
 * @param time - Time in HH:MM
 * @param durationHours - Service duration in hours
 * @returns null if valid, error message if invalid
 */
export function validateBusinessHours(
  dateStr: string,
  time: string,
  durationHours: number,
): string | null {
  const hours = getWorkingHours(dateStr);
  if (!hours) {
    return `El taller está cerrado el día ${dateStr}`;
  }

  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + durationHours * 60;
  const dayEnd = timeToMinutes(hours.close);

  if (slotStart < timeToMinutes(hours.open)) {
    return `El turno no puede empezar antes de las ${hours.open}`;
  }

  if (slotEnd > dayEnd) {
    return `El servicio de ${durationHours}h terminaría a ${minutesToTime(slotEnd)}, pero el taller cierra a ${hours.close}`;
  }

  return null;
}

// ─── Capacity Check ────────────────────────────────────

/**
 * Counts overlapping appointments for a given time window.
 *
 * An appointment overlaps if:
 *   existing.start < new.end AND existing.end > new.start
 *
 * Where:
 *   existing.start = existing.horaTurno (in minutes)
 *   existing.end = existing.horaTurno + existing.duracionHoras * 60
 *   new.start = new.horaTurno (in minutes)
 *   new.end = new.horaTurno + new.duracionHoras * 60
 *
 * @param dateStr - Date to check
 * @param time - Start time
 * @param durationHours - Duration in hours
 * @param tenantSlug - Tenant identifier
 * @param excludeId - Appointment ID to exclude (for updates)
 * @returns Number of overlapping appointments
 */
export async function countOverlappingAppointments(
  dateStr: string,
  time: string,
  durationHours: number,
  tenantSlug: string,
  excludeId?: string,
): Promise<number> {
  const newStart = timeToMinutes(time);
  const newEnd = newStart + durationHours * 60;

  // Get all active appointments for that date
  const conditions = [
    eq(agendamientos.fechaTurno, dateStr),
    eq(agendamientos.tenantSlug, tenantSlug),
    ne(agendamientos.estado, "CANCELADO"),
    ne(agendamientos.estado, "AUSENTE"),
  ];

  if (excludeId) {
    const { ne: neOp } = await import("drizzle-orm");
    conditions.push(neOp(agendamientos.id, excludeId));
  }

  const dayAppointments = await db()
    .select({
      horaTurno: agendamientos.horaTurno,
      duracionHoras: agendamientos.duracionHoras,
    })
    .from(agendamientos)
    .where(and(...conditions));

  // Count overlaps
  let overlapCount = 0;
  for (const appt of dayAppointments) {
    const existStart = timeToMinutes(appt.horaTurno);
    const existEnd = existStart + (appt.duracionHoras || 1) * 60;

    // Overlap condition: start1 < end2 AND start2 < end1
    if (newStart < existEnd && existStart < newEnd) {
      overlapCount++;
    }
  }

  return overlapCount;
}

// ─── Main Availability Check ───────────────────────────

/**
 * Checks if a time slot is available for booking.
 *
 * Validates:
 *   1. Date is a working day
 *   2. Time is within business hours
 *   3. Service fits before closing time
 *   4. Bay capacity not exceeded
 *
 * @param dateStr - Date in YYYY-MM-DD
 * @param time - Time in HH:MM
 * @param tipoServicio - Service type
 * @param tenantSlug - Tenant identifier
 * @param excludeId - Appointment ID to exclude (for updates)
 * @returns Availability result with details
 */
export async function checkAvailability(
  dateStr: string,
  time: string,
  tipoServicio: TipoServicio,
  tenantSlug: string,
  excludeId?: string,
): Promise<CheckAvailabilityResponse> {
  const config = SERVICIO_CONFIG[tipoServicio];
  const durationHours = config.durationHours;

  // 1. Check working day
  if (!isWorkingDay(dateStr)) {
    return {
      available: false,
      reason: "El taller está cerrado en esa fecha",
      currentOccupancy: 0,
      maxCapacity: businessHours.maxCapacity,
    };
  }

  // 2. Check business hours
  const hoursError = validateBusinessHours(dateStr, time, durationHours);
  if (hoursError) {
    return {
      available: false,
      reason: hoursError,
      currentOccupancy: 0,
      maxCapacity: businessHours.maxCapacity,
    };
  }

  // 3. Check bay capacity
  const overlapCount = await countOverlappingAppointments(
    dateStr,
    time,
    durationHours,
    tenantSlug,
    excludeId,
  );

  if (overlapCount >= businessHours.maxCapacity) {
    return {
      available: false,
      reason: `Taller lleno: ${overlapCount}/${businessHours.maxCapacity} bahías ocupadas`,
      currentOccupancy: overlapCount,
      maxCapacity: businessHours.maxCapacity,
    };
  }

  // 4. Generate available slots for the day
  const hours = getWorkingHours(dateStr);
  const availableSlots: string[] = [];

  if (hours) {
    const openMin = timeToMinutes(hours.open);
    const closeMin = timeToMinutes(hours.close);
    const interval = businessHours.slotIntervalMinutes;

    for (let m = openMin; m + durationHours * 60 <= closeMin; m += interval) {
      const slotTime = minutesToTime(m);
      const slotOverlap = await countOverlappingAppointments(
        dateStr,
        slotTime,
        durationHours,
        tenantSlug,
        excludeId,
      );
      if (slotOverlap < businessHours.maxCapacity) {
        availableSlots.push(slotTime);
      }
    }
  }

  return {
    available: true,
    currentOccupancy: overlapCount,
    maxCapacity: businessHours.maxCapacity,
    availableSlots,
  };
}

// ─── Absence Detection ─────────────────────────────────

/**
 * Finds appointments that should be marked AUSENTE.
 *
 * An appointment is AUSENTE if:
 *   - Status is RESERVADO or CONFIRMADO
 *   - Current time is >= scheduled time + 30 minutes
 *   - Same date
 *
 * @param tenantSlug - Tenant identifier
 * @returns Array of appointment IDs to mark absent
 */
export async function findAbsentAppointments(
  tenantSlug: string,
): Promise<string[]> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Get appointments that are RESERVADO or CONFIRMADO for today
  const pendingAppts = await db()
    .select({
      id: agendamientos.id,
      horaTurno: agendamientos.horaTurno,
      estado: agendamientos.estado,
    })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.fechaTurno, today),
        eq(agendamientos.tenantSlug, tenantSlug),
        eq(agendamientos.estado, "RESERVADO"),
      ),
    );

  const absentIds: string[] = [];

  for (const appt of pendingAppts) {
    const scheduledMinutes = timeToMinutes(appt.horaTurno);
    // 30-minute grace period
    if (currentMinutes >= scheduledMinutes + 30) {
      absentIds.push(appt.id);
    }
  }

  // Also check CONFIRMED appointments
  const confirmedAppts = await db()
    .select({
      id: agendamientos.id,
      horaTurno: agendamientos.horaTurno,
    })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.fechaTurno, today),
        eq(agendamientos.tenantSlug, tenantSlug),
        eq(agendamientos.estado, "CONFIRMADO"),
      ),
    );

  for (const appt of confirmedAppts) {
    const scheduledMinutes = timeToMinutes(appt.horaTurno);
    if (currentMinutes >= scheduledMinutes + 30) {
      absentIds.push(appt.id);
    }
  }

  return absentIds;
}
