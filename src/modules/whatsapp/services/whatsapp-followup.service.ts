/**
 * WhatsApp Follow-up Service — Schedule, process, and track automated follow-ups.
 *
 * @module whatsapp/services/whatsapp-followup.service
 */

import { eq, and, lte, desc } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { whatsappFollowups } from "../schema/whatsapp-followup.js";
import { getTemplate, fillTemplate } from "./whatsapp-template.service.js";

/**
 * Schedule a follow-up message.
 */
export async function scheduleFollowup(params: {
  tenantSlug: string;
  templateKey: string;
  ordenId?: string;
  phone: string;
  variables: Record<string, string>;
  scheduledAt: Date;
}) {
  const template = await getTemplate(params.tenantSlug, params.templateKey);
  if (!template) throw new Error(`Template not found: ${params.templateKey}`);
  if (!template.active) throw new Error(`Template is inactive: ${params.templateKey}`);

  const filledBody = fillTemplate(template.body, params.variables);

  const [followup] = await db()
    .insert(whatsappFollowups)
    .values({
      tenantSlug: params.tenantSlug,
      templateKey: params.templateKey,
      ordenId: params.ordenId || null,
      phone: params.phone,
      filledBody,
      variables: params.variables,
      scheduledAt: params.scheduledAt,
      status: "SCHEDULED",
    })
    .returning();

  return followup;
}

/**
 * Schedule an auto-follow-up based on trigger event.
 */
export async function scheduleAutoFollowup(params: {
  tenantSlug: string;
  triggerEvent: string;
  ordenId: string;
  phone: string;
  variables: Record<string, string>;
}) {
  // Find templates with this trigger event
  const templates = await db()
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.tenantSlug, params.tenantSlug),
        eq(whatsappTemplates.triggerEvent, params.triggerEvent),
        eq(whatsappTemplates.active, true),
      ),
    );

  const results = [];
  for (const tmpl of templates) {
    const delayHours = parseInt(tmpl.triggerDelayHours || "0", 10);
    const scheduledAt = new Date();
    scheduledAt.setHours(scheduledAt.getHours() + delayHours);

    const filledBody = fillTemplate(tmpl.body, params.variables);

    const [followup] = await db()
      .insert(whatsappFollowups)
      .values({
        tenantSlug: params.tenantSlug,
        templateKey: tmpl.key,
        ordenId: params.ordenId,
        phone: params.phone,
        filledBody,
        variables: params.variables,
        scheduledAt,
        status: "SCHEDULED",
      })
      .returning();

    results.push(followup);
  }

  return results;
}

/**
 * Process due follow-ups (called by cron).
 * Returns count of processed follow-ups.
 */
export async function processDueFollowups(tenantSlug?: string) {
  const now = new Date();

  const conditions = [
    eq(whatsappFollowups.status, "SCHEDULED"),
    lte(whatsappFollowups.scheduledAt, now),
  ];

  if (tenantSlug) {
    conditions.push(eq(whatsappFollowups.tenantSlug, tenantSlug));
  }

  const due = await db()
    .select()
    .from(whatsappFollowups)
    .where(and(...conditions))
    .orderBy(whatsappFollowups.scheduledAt)
    .limit(50); // Process max 50 at a time

  let processed = 0;
  for (const followup of due) {
    try {
      // Import dynamically to avoid circular deps
      const { sendMessage } = await import("./whatsapp.service.js");

      const result = await sendMessage({
        tenantSlug: followup.tenantSlug,
        phone: followup.phone,
        message: followup.filledBody,
      });

      await db()
        .update(whatsappFollowups)
        .set({
          status: "SENT",
          sentAt: new Date(),
          messageId: result?.messageId || null,
          updatedAt: new Date(),
        })
        .where(eq(whatsappFollowups.id, followup.id));

      processed++;
    } catch (err: any) {
      const retryCount = (followup.retryCount || 0) + 1;
      const maxRetries = 2;

      await db()
        .update(whatsappFollowups)
        .set({
          status: retryCount >= maxRetries ? "FAILED" : "SCHEDULED",
          retryCount,
          errorMessage: err.message,
          updatedAt: new Date(),
        })
        .where(eq(whatsappFollowups.id, followup.id));
    }
  }

  return processed;
}

/**
 * Cancel a scheduled follow-up.
 */
export async function cancelFollowup(id: string, tenantSlug: string) {
  await db()
    .update(whatsappFollowups)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(
      and(
        eq(whatsappFollowups.id, id),
        eq(whatsappFollowups.tenantSlug, tenantSlug),
      ),
    );
}

/**
 * List follow-ups for a tenant (with optional filters).
 */
export async function listFollowups(
  tenantSlug: string,
  opts: {
    status?: string;
    ordenId?: string;
    limit?: number;
  } = {},
) {
  const conditions = [eq(whatsappFollowups.tenantSlug, tenantSlug)];
  if (opts.status) conditions.push(eq(whatsappFollowups.status, opts.status));
  if (opts.ordenId) conditions.push(eq(whatsappFollowups.ordenId, opts.ordenId));

  return db()
    .select()
    .from(whatsappFollowups)
    .where(and(...conditions))
    .orderBy(desc(whatsappFollowups.createdAt))
    .limit(opts.limit || 100);
}

/**
 * Get follow-up statistics for a tenant.
 */
export async function getFollowupStats(tenantSlug: string) {
  const all = await db()
    .select()
    .from(whatsappFollowups)
    .where(eq(whatsappFollowups.tenantSlug, tenantSlug));

  return {
    total: all.length,
    scheduled: all.filter((f) => f.status === "SCHEDULED").length,
    sent: all.filter((f) => f.status === "SENT").length,
    failed: all.filter((f) => f.status === "FAILED").length,
    cancelled: all.filter((f) => f.status === "CANCELLED").length,
  };
}
