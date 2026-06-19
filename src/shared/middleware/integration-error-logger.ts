/**
 * Integration Error Logger — Non-blocking error tracking.
 *
 * Logs WhatsApp and CRM integration errors to the database
 * WITHOUT blocking the main ERP transaction. This is the
 * safety net: if an external API fails, the ERP continues
 * working normally.
 *
 * Usage:
 *   await logIntegrationError({
 *     source: 'whatsapp',
 *     operation: 'send_message',
 *     ordenId: '...',
 *     tenantSlug: 'taller-el-chero',
 *     errorMessage: 'Evolution API timeout',
 *   });
 *
 * @module shared/middleware/integration-error-logger
 */

import { db } from "../../shared/database/drizzle.js";
import {
  whatsappErrorsLog,
  type NewWhatsAppErrorLog,
} from "../../modules/whatsapp/schema/whatsapp-error-log.js";

// ─── Error Logger ──────────────────────────────────────

export interface IntegrationErrorContext {
  /** Error source system */
  source: "whatsapp" | "twenty_crm" | "evolution_api";
  /** Operation that failed */
  operation: string;
  /** Work order UUID (if related) */
  ordenId?: string;
  /** Client name */
  clientName?: string;
  /** Phone number */
  phoneNumber?: string;
  /** Error code (HTTP status, etc.) */
  errorCode?: string;
  /** Error message */
  errorMessage: string;
  /** Stack trace */
  errorStack?: string;
  /** Request URL */
  requestUrl?: string;
  /** HTTP method */
  requestMethod?: string;
  /** Response status */
  responseStatus?: number;
  /** Response body */
  responseBody?: string;
  /** Tenant slug */
  tenantSlug: string;
  /** User who triggered */
  triggeredBy?: string;
}

/**
 * Logs an integration error to the database.
 *
 * This function is FIRE-AND-FORGET: it never throws,
 * never blocks, and never affects the calling transaction.
 *
 * @param context - Error context information
 */
export async function logIntegrationError(
  context: IntegrationErrorContext,
): Promise<void> {
  try {
    const entry: NewWhatsAppErrorLog = {
      source: context.source,
      operation: context.operation as any,
      ordenId: context.ordenId || null,
      clientName: context.clientName || null,
      phoneNumber: context.phoneNumber || null,
      errorCode: context.errorCode || null,
      errorMessage: context.errorMessage,
      errorStack: context.errorStack || null,
      requestUrl: context.requestUrl || null,
      requestMethod: context.requestMethod || null,
      responseStatus: context.responseStatus || null,
      responseBody: context.responseBody || null,
      tenantSlug: context.tenantSlug,
      triggeredBy: context.triggeredBy || "system",
    };

    await db().insert(whatsappErrorsLog).values(entry);
  } catch {
    // CRITICAL: If logging fails, we MUST NOT crash the ERP.
    // The error is silently dropped. In production, this would
    // be captured by APM/monitoring tools.
    console.error(
      `[INTEGRATION-ERROR-LOGGER] Failed to log error to database: ${context.errorMessage}`,
    );
  }
}

/**
 * Gets unresolved errors for the admin dashboard.
 *
 * @param tenantSlug - Tenant to filter by
 * @param limit - Max results
 * @returns List of unresolved errors
 */
export async function getUnresolvedErrors(
  tenantSlug: string,
  limit: number = 50,
): Promise<any[]> {
  try {
    const { eq, and, desc } = await import("drizzle-orm");
    const errors = await db()
      .select()
      .from(whatsappErrorsLog)
      .where(
        and(
          eq(whatsappErrorsLog.tenantSlug, tenantSlug),
          eq(whatsappErrorsLog.resolved, false),
        ),
      )
      .orderBy(desc(whatsappErrorsLog.createdAt))
      .limit(limit);

    return errors;
  } catch {
    return [];
  }
}

/**
 * Marks an error as resolved.
 *
 * @param errorId - Error UUID
 * @param resolvedBy - User who resolved it
 * @param notes - Resolution notes
 */
export async function resolveError(
  errorId: string,
  resolvedBy: string,
  notes?: string,
): Promise<void> {
  try {
    const { eq } = await import("drizzle-orm");
    await db()
      .update(whatsappErrorsLog)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes: notes || null,
      })
      .where(eq(whatsappErrorsLog.id, errorId));
  } catch {
    // Non-critical — don't crash
  }
}

/**
 * Gets error statistics for the dashboard.
 *
 * @param tenantSlug - Tenant identifier
 */
export async function getErrorStats(tenantSlug: string): Promise<{
  total: number;
  unresolved: number;
  bySource: Record<string, number>;
  recent: number; // last 24h
}> {
  try {
    const { eq } = await import("drizzle-orm");
    const all = await db()
      .select({ source: whatsappErrorsLog.source, resolved: whatsappErrorsLog.resolved, createdAt: whatsappErrorsLog.createdAt })
      .from(whatsappErrorsLog)
      .where(eq(whatsappErrorsLog.tenantSlug, tenantSlug));

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return {
      total: all.length,
      unresolved: all.filter((r) => !r.resolved).length,
      bySource: all.reduce(
        (acc, r) => {
          acc[r.source] = (acc[r.source] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recent: all.filter((r) => r.createdAt >= oneDayAgo).length,
    };
  } catch {
    return { total: 0, unresolved: 0, bySource: {}, recent: 0 };
  }
}
