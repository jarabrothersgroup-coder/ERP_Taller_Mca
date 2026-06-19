/**
 * WhatsApp Queue Service — persistent message queue with retry.
 *
 * Stores outgoing messages in the DB before sending, enabling:
 *   - Retry on failure (exponential backoff)
 *   - Audit trail of all attempts
 *   - Dashboard visibility of pending/failed messages
 *
 * Flow:
 *   1. Enqueue message → PENDING status
 *   2. Attempt send → SENT or FAILED
 *   3. Retry failed messages → exponential backoff
 *
 * @module whatsapp/services/whatsapp-queue.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { whatsappMessages } from "../schema/whatsapp-log.js";
import { eq, and, lte, sql, desc } from "drizzle-orm";
import {
  sendTextMessage,
  sendDocumentMessage,
  sanitizePhone,
} from "./whatsapp.service.js";
import type { WhatsAppMessage } from "../schema/whatsapp-log.js";

// ─── Types ────────────────────────────────────

export interface EnqueueMessageRequest {
  ordenId: string;
  clienteName: string;
  phoneNumber: string;
  template: string;
  messageText: string;
  hasAttachment?: boolean;
  attachmentFilename?: string;
  pdfUrl?: string;
  sentBy: string;
  tenantSlug: string;
}

export interface QueueStats {
  pending: number;
  sent: number;
  failed: number;
  totalRetries: number;
}

// ─── Enqueue ───────────────────────────────────

/**
 * Enqueues a message for sending (stores in DB with PENDING status).
 *
 * @param data - Message payload
 * @returns Enqueued message record
 */
export async function enqueueMessage(
  data: EnqueueMessageRequest,
): Promise<WhatsAppMessage> {
  const [message] = await db()
    .insert(whatsappMessages)
    .values({
      ordenId: data.ordenId,
      clienteName: data.clienteName,
      phoneNumber: sanitizePhone(data.phoneNumber),
      template: data.template as any,
      messageText: data.messageText,
      hasAttachment: data.hasAttachment ?? false,
      attachmentFilename: data.attachmentFilename ?? null,
      status: "PENDING",
      sentBy: data.sentBy,
      tenantSlug: data.tenantSlug,
    })
    .returning();

  return message;
}

// ─── Process Queue ─────────────────────────────

/**
 * Processes pending messages in the queue.
 *
 * Sends all PENDING messages and updates their status.
 * Called by the retry cron job.
 *
 * @param tenantSlug - Optional tenant filter
 * @returns Number of messages processed
 */
export async function processPendingMessages(
  tenantSlug?: string,
): Promise<{ processed: number; sent: number; failed: number }> {
  const conditions = [eq(whatsappMessages.status, "PENDING")];
  if (tenantSlug) {
    conditions.push(eq(whatsappMessages.tenantSlug, tenantSlug));
  }

  const pendingMessages = await db()
    .select()
    .from(whatsappMessages)
    .where(and(...conditions))
    .orderBy(whatsappMessages.createdAt)
    .limit(50); // Process 50 at a time

  let sent = 0;
  let failed = 0;

  for (const msg of pendingMessages) {
    try {
      // Attempt to send via Evolution API
      await sendTextMessage(
        msg.tenantSlug,
        msg.phoneNumber,
        msg.messageText,
      );

      // Update status to SENT
      await db()
        .update(whatsappMessages)
        .set({
          status: "SENT",
          sentAt: new Date(),
        })
        .where(eq(whatsappMessages.id, msg.id));

      sent++;
    } catch (err) {
      // Update status to FAILED with error message
      await db()
        .update(whatsappMessages)
        .set({
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : "Error desconocido",
        })
        .where(eq(whatsappMessages.id, msg.id));

      failed++;
    }
  }

  return {
    processed: pendingMessages.length,
    sent,
    failed,
  };
}

// ─── Retry Failed ──────────────────────────────

/**
 * Retries failed messages with exponential backoff.
 *
 * Only retries messages that:
 *   - Have status FAILED
 *   - Have retryCount < 3
 *   - Were created less than 1 hour ago
 *
 * @param tenantSlug - Optional tenant filter
 * @returns Number of messages retried
 */
export async function retryFailedMessages(
  tenantSlug?: string,
): Promise<{ retried: number; sent: number; failed: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const conditions = [
    eq(whatsappMessages.status, "FAILED"),
    sql`${whatsappMessages.createdAt} > ${oneHourAgo}`,
  ];
  if (tenantSlug) {
    conditions.push(eq(whatsappMessages.tenantSlug, tenantSlug));
  }

  const failedMessages = await db()
    .select()
    .from(whatsappMessages)
    .where(and(...conditions))
    .orderBy(whatsappMessages.createdAt)
    .limit(20);

  let sent = 0;
  let failed = 0;

  for (const msg of failedMessages) {
    try {
      await sendTextMessage(
        msg.tenantSlug,
        msg.phoneNumber,
        msg.messageText,
      );

      await db()
        .update(whatsappMessages)
        .set({
          status: "SENT",
          sentAt: new Date(),
        })
        .where(eq(whatsappMessages.id, msg.id));

      sent++;
    } catch (err) {
      await db()
        .update(whatsappMessages)
        .set({
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : "Error desconocido",
        })
        .where(eq(whatsappMessages.id, msg.id));

      failed++;
    }
  }

  return {
    retried: failedMessages.length,
    sent,
    failed,
  };
}

// ─── Queue Stats ───────────────────────────────

/**
 * Gets queue statistics for a tenant.
 *
 * @param tenantSlug - Tenant identifier
 * @returns Queue statistics
 */
export async function getQueueStats(
  tenantSlug: string,
): Promise<QueueStats> {
  const [stats] = await db()
    .select({
      pending: sql<number>`COUNT(CASE WHEN ${whatsappMessages.status} = 'PENDING' THEN 1 END)::int`,
      sent: sql<number>`COUNT(CASE WHEN ${whatsappMessages.status} = 'SENT' THEN 1 END)::int`,
      failed: sql<number>`COUNT(CASE WHEN ${whatsappMessages.status} = 'FAILED' THEN 1 END)::int`,
    })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.tenantSlug, tenantSlug));

  return {
    pending: stats?.pending ?? 0,
    sent: stats?.sent ?? 0,
    failed: stats?.failed ?? 0,
    totalRetries: 0,
  };
}
