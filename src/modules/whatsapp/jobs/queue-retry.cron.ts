/**
 * WhatsApp Queue Retry Cron — periodic retry of failed messages.
 *
 * Runs every 5 minutes to retry failed WhatsApp messages.
 * Uses exponential backoff: only retries messages less than 1 hour old.
 *
 * @module whatsapp/jobs/queue-retry.cron
 */

import { processPendingMessages, retryFailedMessages } from "../services/whatsapp-queue.service.js";

// ─── Cron Configuration ────────────────────────

/** Retry interval in milliseconds (5 minutes) */
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

/** Maximum retry attempts per message */
const MAX_RETRIES = 3;

// ─── Cron Job ──────────────────────────────────

let retryTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the WhatsApp queue retry cron job.
 *
 * Processes pending messages and retries failed ones every 5 minutes.
 */
export function startQueueRetryCron(): void {
  if (retryTimer) {
    console.warn("[whatsapp-queue] Cron ya está ejecutándose");
    return;
  }

  retryTimer = setInterval(async () => {
    try {
      // Process pending messages first
      const pendingResult = await processPendingMessages();
      if (pendingResult.processed > 0) {
        console.log(
          `[whatsapp-queue] Pendientes: ${pendingResult.processed} procesados, ` +
          `${pendingResult.sent} enviados, ${pendingResult.failed} fallidos`
        );
      }

      // Then retry failed messages
      const retryResult = await retryFailedMessages();
      if (retryResult.retried > 0) {
        console.log(
          `[whatsapp-queue] Reintentos: ${retryResult.retried} intentados, ` +
          `${retryResult.sent} enviados, ${retryResult.failed} fallidos`
        );
      }
    } catch (err) {
      console.error(
        "[whatsapp-queue] Error en cron de reintento:",
        err instanceof Error ? err.message : err,
      );
    }
  }, RETRY_INTERVAL_MS);

  console.log("[whatsapp-queue] Cron de reintento iniciado (cada 5 minutos)");
}

/**
 * Stops the WhatsApp queue retry cron job.
 */
export function stopQueueRetryCron(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
    console.log("[whatsapp-queue] Cron de reintento detenido");
  }
}
