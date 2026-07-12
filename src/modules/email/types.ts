/**
 * Email module — types and DTOs.
 *
 * @module email/types
 */

/** Email attachment */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/** Send email request */
export interface SendEmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** Tenant slug for email log tracking */
  tenantSlug?: string;
  /** Entity type for linking (e.g., 'factura', 'orden_trabajo') */
  entityType?: string;
  /** Entity ID for linking */
  entityId?: string;
}

/** Email send result */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Email log record from DB */
export interface EmailLogRecord {
  id: string;
  tenantSlug: string | null;
  from: string;
  to: string[];
  subject: string;
  status: "sent" | "failed" | "pending";
  messageId: string | null;
  errorMessage: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}

/** Email config from env */
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromAddress: string;
}
