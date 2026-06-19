/**
 * Agendamientos (Appointments) — Drizzle ORM schema.
 *
 * Manages the appointment lifecycle from CRM (commercial) to
 * ERP (execution). The state machine drives the workflow:
 *
 *   RESERVADO → CONFIRMADO → PROCESADO_EN_ERP
 *                  ↓              ↓
 *              AUSENTE         (terminal)
 *              CANCELADO
 *
 * Multi-tenant: each tenant has their own appointments.
 *
 * @module scheduling/schema/agendamientos
 */

import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────

/** Appointment status */
export const agendamientoEstadoEnum = pgEnum("agendamiento_estado", [
  "RESERVADO",
  "CONFIRMADO",
  "PROCESADO_EN_ERP",
  "AUSENTE",
  "CANCELADO",
]);

/** Service type */
export const agendamientoServicioEnum = pgEnum("agendamiento_servicio", [
  "RAPIDO",
  "PESADO",
]);

// ─── Table ────────────────────────────────────────────

/**
 * Agendamientos — appointment/scheduling table.
 *
 * Each row represents a scheduled appointment that bridges
 * the CRM (commercial intent) and ERP (execution).
 */
export const agendamientos = pgTable(
  "agendamientos",
  {
    /** Primary key */
    id: uuid("id").primaryKey().defaultRandom(),

    // ─── Client Data (denormalized from CRM) ─────
    /** Client name */
    clienteNombre: varchar("cliente_nombre", { length: 255 }).notNull(),
    /** Client phone (E.164: +5959xxxxxxxx) */
    clientePhone: varchar("cliente_phone", { length: 20 }).notNull(),
    /** Client email */
    clienteEmail: varchar("cliente_email", { length: 255 }),
    /** Document ID (C.I./RUC) */
    clienteDocumento: varchar("cliente_documento", { length: 50 }),

    // ─── Vehicle Data ────────────────────────────
    /** Vehicle plate (chapa) */
    vehiculoChapa: varchar("vehiculo_chapa", { length: 20 }).notNull(),
    /** Vehicle brand */
    vehiculoMarca: varchar("vehiculo_marca", { length: 100 }).notNull(),
    /** Vehicle model */
    vehiculoModelo: varchar("vehiculo_modelo", { length: 100 }).notNull(),
    /** Vehicle VIN */
    vehiculoVin: varchar("vehiculo_vin", { length: 50 }),

    // ─── Schedule Data ───────────────────────────
    /** Scheduled date (YYYY-MM-DD) */
    fechaTurno: varchar("fecha_turno", { length: 10 }).notNull(),
    /** Scheduled time (HH:MM, 24h) */
    horaTurno: varchar("hora_turno", { length: 5 }).notNull(),
    /** Service type */
    tipoServicio: agendamientoServicioEnum("tipo_servicio").notNull(),
    /** Duration in hours (derived from tipo_servicio) */
    duracionHoras: integer("duracion_horas").notNull().default(1),

    // ─── State Machine ───────────────────────────
    /** Current appointment status */
    estado: agendamientoEstadoEnum("estado").notNull().default("RESERVADO"),
    /** Previous status (for audit trail) */
    estadoAnterior: agendamientoEstadoEnum("estado_anterior"),

    // ─── WhatsApp Tracking ───────────────────────
    /** Whether confirmation message was sent */
    confirmacionEnviada: boolean("confirmacion_enviada").notNull().default(false),
    /** Whether 24h reminder was sent */
    recordatorioEnviado: boolean("recordatorio_enviado").notNull().default(false),
    /** Timestamp of last reminder */
    recordatorioEnviadoAt: timestamp("recordatorio_enviado_at", { withTimezone: true }),
    /** Client response to reminder (1=confirm, 2=cancel) */
    clienteRespuesta: varchar("cliente_respuesta", { length: 10 }),
    /** Timestamp of client response */
    clienteRespuestaAt: timestamp("cliente_respuesta_at", { withTimezone: true }),

    // ─── ERP Link ────────────────────────────────
    /** Work order ID (set when PROCESADO_EN_ERP) */
    ordenTrabajoId: uuid("orden_trabajo_id"),
    /** ERP client ID (set when synced) */
    erpClientId: uuid("erp_client_id"),
    /** ERP vehicle ID (set when synced) */
    erpVehicleId: uuid("erp_vehicle_id"),

    // ─── CRM Link ────────────────────────────────
    /** Twenty CRM contact ID */
    twentyContactId: varchar("twenty_contact_id", { length: 100 }),
    /** Twenty CRM appointment/event ID */
    twentyEventId: varchar("twenty_event_id", { length: 100 }),

    // ─── Diagnosis ───────────────────────────────
    /** Previous diagnosis (from CRM) */
    diagnosticoPre: text("diagnostico_pre"),
    /** Observations at check-in */
    observaciones: text("observaciones"),

    // ─── Branch ──────────────────────────────────
    /** Branch for this appointment (FK → sucursales) */
    sucursalId: uuid("sucursal_id"),

    // ─── Tenant + Metadata ───────────────────────
    /** Tenant slug */
    tenantSlug: varchar("tenant_slug", { length: 100 }).notNull(),
    /** User who created the appointment */
    createdBy: varchar("created_by", { length: 255 }),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When client confirmed */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** When checked in (turned into OT) */
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    /** When marked absent */
    markedAbsentAt: timestamp("marked_absent_at", { withTimezone: true }),
  },
  (table) => ({
    /** Index on date + time: capacity queries */
    fechaIdx: index("agendamientos_fecha_idx").on(table.fechaTurno, table.horaTurno),
    /** Index on status: state machine queries */
    estadoIdx: index("agendamientos_estado_idx").on(table.estado),
    /** Index on tenant: multi-tenant isolation */
    tenantIdx: index("agendamientos_tenant_idx").on(table.tenantSlug),
    /** Index on client phone: WhatsApp inbound matching */
    phoneIdx: index("agendamientos_phone_idx").on(table.clientePhone),
    /** Index on reminder status: cron job queries */
    reminderIdx: index("agendamientos_reminder_idx").on(table.recordatorioEnviado, table.estado),
    /** Index on vehicle plate: lookup by chapa */
    chapaIdx: index("agendamientos_chapa_idx").on(table.vehiculoChapa),
  }),
);

// ─── Types ────────────────────────────────────────────

/** Row type returned by SELECT */
export type Agendamiento = typeof agendamientos.$inferSelect;

/** Row type accepted by INSERT */
export type NewAgendamiento = typeof agendamientos.$inferInsert;
