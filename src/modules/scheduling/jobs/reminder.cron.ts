/**
 * Reminder Cron Job — Daily WhatsApp appointment reminders.
 *
 * Runs daily at 08:00 AM to:
 *   1. Find appointments 24h away (RESERVADO state, no reminder sent)
 *   2. Send WhatsApp confirmation request
 *   3. Mark appointments as AUSENTE if 30min past schedule
 *
 * Execution model:
 *   - Registered as a Fastify route: POST /scheduling/cron/reminders
 *   - Can be triggered externally by crontab, systemd timer, or CI
 *   - Idempotent: won't re-send reminders (flag in DB)
 *
 * @module scheduling/jobs/reminder.cron
 */

import { eq, and } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { agendamientos } from "../schema/agendamientos.js";
import {
  sendTextMessage,
} from "../../whatsapp/services/whatsapp.service.js";
import { sanitizePhone } from "../../whatsapp/services/whatsapp.service.js";
import { logIntegrationError } from "../../../shared/middleware/integration-error-logger.js";
import {
  findAbsentAppointments,
} from "../services/capacity.service.js";
import { transitionState } from "../services/agendamiento.service.js";
import type { CronJobResult } from "../types.js";

// ─── Reminder Templates ────────────────────────────────

const REMINDER_TEMPLATE = `Hola {nombre_cliente}, te recordamos que mañana {fecha_turno} a las {hora_turno} hs. tienes tu cita en el taller para tu {vehiculo} ({chapa}). Por favor, ayúdanos a brindarte un mejor servicio respondiendo a este mensaje: escribe *1* si Confirmas tu asistencia, o *2* si deseas Cancelar/Reprogramar.`;

const CONFIRMATION_TEMPLATE = `¡Hola {nombre_cliente}! 📅 Tu turno en el taller ha sido agendado con éxito para el día {fecha_turno} a las {hora_turno} hs. Estaremos listos para recibir tu {vehiculo} (Chapa: {chapa}) para el servicio de {tipo_servicio}.`;

// ─── Main Cron Job ─────────────────────────────────────

/**
 * Executes the daily reminder cron job.
 *
 * This function:
 *   1. Sends 24h reminders to RESERVADO appointments
 *   2. Marks AUSENTE appointments (30min past schedule)
 *
 * @param tenantSlug - Tenant to process
 * @returns Cron job result
 */
export async function executeReminderCron(
  tenantSlug: string,
): Promise<CronJobResult> {
  const startTime = Date.now();
  const result: CronJobResult = {
    remindersSent: 0,
    markedAbsent: 0,
    errors: [],
    executedAt: new Date().toISOString(),
    durationMs: 0,
  };

  try {
    // ── Step 1: Send 24h reminders ──
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Find RESERVADO appointments for tomorrow that haven't been reminded
    const appointmentsToRemind = await db()
      .select()
      .from(agendamientos)
      .where(
        and(
          eq(agendamientos.fechaTurno, tomorrowStr),
          eq(agendamientos.tenantSlug, tenantSlug),
          eq(agendamientos.estado, "RESERVADO"),
          eq(agendamientos.recordatorioEnviado, false),
        ),
      );

    for (const appt of appointmentsToRemind) {
      try {
        // Build reminder message
        const message = buildReminderMessage(appt);

        // Send via WhatsApp
        const phone = sanitizePhone(appt.clientePhone);
        const sendResult = await sendTextMessage(tenantSlug, phone, message);

        if (sendResult.success) {
          // Mark as reminded
          await db()
            .update(agendamientos)
            .set({
              recordatorioEnviado: true,
              recordatorioEnviadoAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(agendamientos.id, appt.id));

          result.remindersSent++;
        } else {
          result.errors.push(
            `Error enviando recordatorio a ${appt.clienteNombre}: ${sendResult.error}`,
          );

          // Log the error (non-blocking)
          await logIntegrationError({
            source: "whatsapp",
            operation: "send_message",
            ordenId: appt.id,
            clientName: appt.clienteNombre,
            phoneNumber: appt.clientePhone,
            errorMessage: sendResult.error || "Unknown error",
            tenantSlug,
            triggeredBy: "reminder-cron",
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        result.errors.push(`Error procesando ${appt.clienteNombre}: ${msg}`);
      }
    }

    // ── Step 2: Mark absent appointments ──
    const absentIds = await findAbsentAppointments(tenantSlug);

    for (const apptId of absentIds) {
      try {
        await transitionState(apptId, "AUSENTE", tenantSlug);
        result.markedAbsent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        result.errors.push(`Error marcando ausente ${apptId}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cron job failed";
    result.errors.push(msg);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

// ─── Confirmation Sender ───────────────────────────────

/**
 * Sends confirmation message when appointment is created.
 *
 * @param agendamientoId - Appointment ID
 * @param tenantSlug - Tenant identifier
 * @returns Whether the message was sent
 */
export async function sendConfirmationMessage(
  agendamientoId: string,
  tenantSlug: string,
): Promise<boolean> {
  const [appt] = await db()
    .select()
    .from(agendamientos)
    .where(eq(agendamientos.id, agendamientoId))
    .limit(1);

  if (!appt) return false;

  try {
    const message = buildConfirmationMessage(appt);
    const phone = sanitizePhone(appt.clientePhone);
    const result = await sendTextMessage(tenantSlug, phone, message);

    if (result.success) {
      await db()
        .update(agendamientos)
        .set({
          confirmacionEnviada: true,
          updatedAt: new Date(),
        })
        .where(eq(agendamientos.id, agendamientoId));
    }

    return result.success;
  } catch (err) {
    await logIntegrationError({
      source: "whatsapp",
      operation: "send_message",
      ordenId: appt.id,
      clientName: appt.clienteNombre,
      phoneNumber: appt.clientePhone,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      tenantSlug,
      triggeredBy: "confirmation-sender",
    });
    return false;
  }
}

// ─── Message Builders ──────────────────────────────────

function buildReminderMessage(appt: any): string {
  return REMINDER_TEMPLATE
    .replace("{nombre_cliente}", appt.clienteNombre)
    .replace("{fecha_turno}", appt.fechaTurno)
    .replace("{hora_turno}", appt.horaTurno)
    .replace("{vehiculo}", `${appt.vehiculoMarca} ${appt.vehiculoModelo}`)
    .replace("{chapa}", appt.vehiculoChapa);
}

function buildConfirmationMessage(appt: any): string {
  return CONFIRMATION_TEMPLATE
    .replace("{nombre_cliente}", appt.clienteNombre)
    .replace("{fecha_turno}", appt.fechaTurno)
    .replace("{hora_turno}", appt.horaTurno)
    .replace("{vehiculo}", `${appt.vehiculoMarca} ${appt.vehiculoModelo}`)
    .replace("{chapa}", appt.vehiculoChapa)
    .replace("{tipo_servicio}", appt.tipoServicio === "RAPIDO" ? "Mantenimiento Rápido" : "Mantenimiento Pesado");
}
