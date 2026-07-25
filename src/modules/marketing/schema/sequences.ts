/**
 * Marketing Sequences — multi-step automation drip campaigns.
 *
 * Defines sequences with trigger events, delay-based steps,
 * customer enrollments, and sent message audit log.
 *
 * @module marketing/schema/sequences
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Automation sequence definition.
 */
export const marketingSequences = pgTable(
  "marketing_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug: text("tenant_slug").notNull(),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion"),
    /** Trigger: ot_completed | new_client | birthday | service_reminder | manual */
    triggerEvent: text("trigger_event").notNull().default("manual"),
    estado: text("estado").notNull().default("ACTIVO"),
    totalEnrolled: integer("total_enrolled").notNull().default(0),
    totalCompleted: integer("total_completed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("mkt_seq_tenant_idx").on(t.tenantSlug),
    triggerIdx: index("mkt_seq_trigger_idx").on(t.triggerEvent),
  }),
);

/**
 * Individual step in a sequence.
 */
export const marketingSequenceSteps = pgTable(
  "marketing_sequence_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sequenceId: uuid("sequence_id").notNull().references(() => marketingSequences.id, { onDelete: "cascade" }),
    tenantSlug: text("tenant_slug").notNull(),
    orden: integer("orden").notNull(),
    /** Days after previous step or trigger */
    delayDays: integer("delay_days").notNull().default(0),
    /** Channel: whatsapp | email | sms */
    tipo: text("tipo").notNull(),
    asunto: text("asunto"),
    mensaje: text("mensaje").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    seqIdx: index("mkt_seq_step_seq_idx").on(t.sequenceId),
  }),
);

/**
 * Customer enrollment in a sequence.
 */
export const marketingSequenceEnrollments = pgTable(
  "marketing_sequence_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sequenceId: uuid("sequence_id").notNull().references(() => marketingSequences.id, { onDelete: "cascade" }),
    tenantSlug: text("tenant_slug").notNull(),
    clienteId: text("cliente_id"),
    clienteNombre: text("cliente_nombre"),
    clientePhone: text("cliente_phone"),
    clienteEmail: text("cliente_email"),
    estado: text("estado").notNull().default("ACTIVO"),
    currentStep: integer("current_step").notNull().default(0),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    seqIdx: index("mkt_seq_enroll_seq_idx").on(t.sequenceId),
    nextIdx: index("mkt_seq_enroll_next_idx").on(t.nextActionAt),
    estadoIdx: index("mkt_seq_enroll_estado_idx").on(t.estado),
  }),
);

/**
 * Audit log of sent messages.
 */
export const marketingSequenceLog = pgTable(
  "marketing_sequence_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => marketingSequenceEnrollments.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").notNull().references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    tenantSlug: text("tenant_slug").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    channel: text("channel"),
    status: text("status").notNull().default("SENT"),
    errorMessage: text("error_message"),
  },
  (t) => ({
    enrollIdx: index("mkt_seq_log_enroll_idx").on(t.enrollmentId),
  }),
);

export type MarketingSequence = typeof marketingSequences.$inferSelect;
export type MarketingSequenceStep = typeof marketingSequenceSteps.$inferSelect;
export type MarketingSequenceEnrollment = typeof marketingSequenceEnrollments.$inferSelect;
