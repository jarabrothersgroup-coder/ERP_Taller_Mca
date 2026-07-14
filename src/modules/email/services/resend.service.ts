/**
 * Resend Email Service — transactional email via Resend API.
 *
 * Alternative to the nodemailer/SMTP transport. When RESEND_API_KEY is set,
 * this service is used instead of nodemailer for higher deliverability.
 *
 * Features:
 *   - HTML email templates (invoice, estimate, notification)
 *   - PDF attachment support
 *   - Tag-based tracking
 *   - Graceful fallback to nodemailer when Resend not configured
 *
 * @module email/services/resend.service
 */

import { env } from "../../../config/env.js";
import type { SendEmailRequest, SendEmailResult } from "../types.js";

// ─── Check if Resend is configured ─────────────────────

/**
 * Returns true if Resend API key is configured and should be used
 * as the primary email transport instead of SMTP.
 */
export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

// ─── Resend SDK (lazy loaded) ──────────────────────────

let _resendClient: any = null;

async function getResendClient(): Promise<any> {
  if (_resendClient) return _resendClient;

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return null;

  try {
    const { Resend } = await import("resend");
    _resendClient = new Resend(apiKey);
    return _resendClient;
  } catch {
    console.warn("[Resend] SDK not installed — falling back to SMTP");
    return null;
  }
}

// ─── Send via Resend ──────────────────────────────────

export async function sendViaResend(
  request: SendEmailRequest,
): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const client = await getResendClient();
  if (!client) {
    return { success: false, error: "Resend SDK not available" };
  }

  const fromAddress =
    request.from ??
    `AutomotiveOS <${process.env["EMAIL_FROM_ADDRESS"] || "noreply@automotiveos.cloud"}>`;

  const toList = Array.isArray(request.to) ? request.to : [request.to];

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: toList,
      subject: request.subject,
      html: request.html,
      text: request.text,
      reply_to: request.replyTo,
      attachments: request.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
      tags: [
        { name: "entity_type", value: request.entityType ?? "general" },
        { name: "entity_id", value: request.entityId ?? "unknown" },
      ],
    });

    if (error) {
      console.error("[Resend] Send error:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      messageId: data?.id ?? `resend-${Date.now()}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Resend error";
    console.error("[Resend] Exception:", message);
    return { success: false, error: message };
  }
}
