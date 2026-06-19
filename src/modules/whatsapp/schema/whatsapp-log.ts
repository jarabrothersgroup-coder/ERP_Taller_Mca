/**
 * WhatsApp Message Log — Drizzle ORM schema.
 *
 * Tracks all WhatsApp messages sent from the ERP for auditing
 * and delivery confirmation.
 *
 * Multi-tenant: this table lives in each tenant's schema.
 *
 * @module whatsapp/schema/whatsapp-log
 */

import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────

/** Message delivery status */
export const whatsappMsgStatusEnum = pgEnum("whatsapp_msg_status", [
  "PENDING",
  "SENT",
  "FAILED",
]);

/** Message template type */
export const whatsappTemplateEnum = pgEnum("whatsapp_template", [
  "RECEPCIONADO",
  "PRESUPUESTADO",
  "EN_REPARACION",
  "LISTO_ENTREGA",
  "FINALIZADO_RETIRADO",
  "CUSTOM",
]);

// ─── Table ────────────────────────────────────

/**
 * WhatsApp message log — audit trail for all messages sent.
 *
 * Each row represents one WhatsApp message sent from the ERP.
 * Linked to a work order and client for traceability.
 */
export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    /** Work order UUID (FK → ordenes_trabajo) */
    ordenId: uuid("orden_id").notNull(),

    /** Client name (denormalized for fast display) */
    clienteName: text("cliente_name").notNull(),

    /** Destination phone number (E.164 format: +5959xxxxxxxx) */
    phoneNumber: text("phone_number").notNull(),

    /** Message template used */
    template: whatsappTemplateEnum("template").notNull(),

    /** Full message text sent */
    messageText: text("message_text").notNull(),

    /** Whether a PDF was attached */
    hasAttachment: boolean("has_attachment").notNull().default(false),

    /** Attachment filename (if any) */
    attachmentFilename: text("attachment_filename"),

    /** Delivery status */
    status: whatsappMsgStatusEnum("status").notNull().default("PENDING"),

    /** Evolution API message key */
    externalKey: text("external_key"),

    /** Error message if delivery failed */
    errorMessage: text("error_message"),

    /** User who triggered the send */
    sentBy: text("sent_by").notNull(),

    /** Tenant slug for multi-tenant isolation */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Timestamps ───────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => ({
    /** Index on orden_id: link messages to work orders */
    ordenIdx: index("whatsapp_msg_orden_idx").on(table.ordenId),
    /** Index on status: filter by delivery status */
    statusIdx: index("whatsapp_msg_status_idx").on(table.status),
    /** Tenant isolation index */
    tenantIdx: index("whatsapp_msg_tenant_slug_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

/** Row type returned by SELECT */
export type WhatsAppMessage = typeof whatsappMessages.$inferSelect;

/** Row type accepted by INSERT */
export type NewWhatsAppMessage = typeof whatsappMessages.$inferInsert;
