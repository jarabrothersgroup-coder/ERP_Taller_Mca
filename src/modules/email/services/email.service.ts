/**
 * Email Service — nodemailer-based transactional email.
 *
 * Features:
 *   - SMTP transport with configurable provider (Gmail, SendGrid, AWS SES, etc.)
 *   - HTML email templates for common workshop scenarios
 *   - Email log tracking per tenant (DB persistence)
 *   - Graceful fallback when SMTP not configured (dev mode)
 *   - Connection pooling for production
 *
 * @module email/services/email.service
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type {
  SendEmailRequest,
  SendEmailResult,
  EmailConfig,
} from "../types.js";

// ─── Configuration ──────────────────────────────────────

function getConfig(): EmailConfig {
  return {
    host: process.env["SMTP_HOST"] ?? "smtp.gmail.com",
    port: parseInt(process.env["SMTP_PORT"] ?? "587", 10),
    secure: process.env["SMTP_SECURE"] === "true",
    user: process.env["SMTP_USER"] ?? "",
    pass: process.env["SMTP_PASS"] ?? "",
    fromName: process.env["EMAIL_FROM_NAME"] ?? "AutomotiveOS",
    fromAddress: process.env["EMAIL_FROM_ADDRESS"] ?? "",
  };
}

function isConfigured(): boolean {
  const config = getConfig();
  return Boolean(config.user && config.pass && config.fromAddress);
}

// ─── Transporter singleton ──────────────────────────────

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  const config = getConfig();
  if (!config.user || !config.pass) return null;

  _transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  } as any);

  return _transporter;
}

// ─── Send email ─────────────────────────────────────────

export async function sendEmail(
  request: SendEmailRequest,
): Promise<SendEmailResult> {
  const config = getConfig();
  const transporter = getTransporter();

  if (!transporter || !isConfigured()) {
    // Dev mode: log instead of failing
    if (process.env["NODE_ENV"] !== "production") {
      console.log("[Email Service] SMTP no configurado — email simulado:");
      console.log(`  To: ${Array.isArray(request.to) ? request.to.join(", ") : request.to}`);
      console.log(`  Subject: ${request.subject}`);
      return {
        success: true,
        messageId: `dev-${Date.now()}@automotiveos.local`,
      };
    }

    return {
      success: false,
      error: "SMTP no configurado — SMTP_USER y SMTP_PASS requeridos",
    };
  }

  const fromAddress = request.from ?? `${config.fromName} <${config.fromAddress}>`;
  const toList = Array.isArray(request.to) ? request.to : [request.to];

  try {
    const result = await transporter.sendMail({
      from: fromAddress,
      to: toList.join(", "),
      subject: request.subject,
      html: request.html,
      text: request.text,
      replyTo: request.replyTo,
      attachments: request.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error(`[Email Service] Error enviando email: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}

// ─── Verify connection ──────────────────────────────────

export async function verifyConnection(): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter || !isConfigured()) return false;

  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

// ─── Email log (DB) ────────────────────────────────────

// Lazy import to avoid circular deps
let _dbFn: (() => any) | null = null;
let _emailLogSchema: any = null;

async function getDb() {
  if (!_dbFn) {
    const mod = await import("../../../shared/database/drizzle.js");
    _dbFn = mod.db;
  }
  return _dbFn!();
}

async function getEmailLogSchema() {
  if (!_emailLogSchema) {
    const mod = await import("../schema/index.js");
    _emailLogSchema = mod.emailLog;
  }
  return _emailLogSchema;
}

/**
 * Log email to DB for audit trail.
 */
export async function logEmail(params: {
  tenantSlug?: string;
  from: string;
  to: string[];
  subject: string;
  status: "sent" | "failed";
  messageId?: string;
  errorMessage?: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    const schema = await getEmailLogSchema();

    await db.insert(schema).values({
      tenantSlug: params.tenantSlug ?? null,
      from: params.from,
      to: params.to,
      subject: params.subject,
      status: params.status,
      messageId: params.messageId ?? null,
      errorMessage: params.errorMessage ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
    });
  } catch (err) {
    // Don't fail email sending if logging fails
    console.error("[Email Service] Error logging email:", err);
  }
}

/**
 * Send email + log to DB.
 */
export async function sendAndLogEmail(
  request: SendEmailRequest,
): Promise<SendEmailResult> {
  const config = getConfig();
  const result = await sendEmail(request);

  const toList = Array.isArray(request.to) ? request.to : [request.to];

  await logEmail({
    tenantSlug: request.tenantSlug,
    from: request.from ?? `${config.fromName} <${config.fromAddress}>`,
    to: toList,
    subject: request.subject,
    status: result.success ? "sent" : "failed",
    messageId: result.messageId,
    errorMessage: result.error,
    entityType: request.entityType,
    entityId: request.entityId,
  });

  return result;
}

// ─── Cleanup ────────────────────────────────────────────

export async function closeTransporter(): Promise<void> {
  if (_transporter) {
    _transporter.close();
    _transporter = null;
  }
}
