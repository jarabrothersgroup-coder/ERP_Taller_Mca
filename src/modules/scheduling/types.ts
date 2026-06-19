/**
 * Scheduling Module — Shared types & DTOs.
 *
 * Defines the interface for the Appointment/Scheduling module
 * that bridges Twenty CRM (commercial) and ERP (execution).
 *
 * @module scheduling/types
 */

// ─── Appointment State Machine ─────────────────────────

/** Appointment status — finite state machine */
export type AgendamientoEstado =
  | "RESERVADO"       // Created from CRM or client request
  | "CONFIRMADO"      // Client confirmed attendance
  | "PROCESADO_EN_ERP" // Client arrived → OT created
  | "AUSENTE"         // 30min past scheduled time, no show
  | "CANCELADO";      // Client cancelled via WhatsApp response

/** Valid state transitions */
export const STATE_TRANSITIONS: Record<AgendamientoEstado, AgendamientoEstado[]> = {
  RESERVADO: ["CONFIRMADO", "CANCELADO", "AUSENTE"],
  CONFIRMADO: ["PROCESADO_EN_ERP", "CANCELADO", "AUSENTE"],
  PROCESADO_EN_ERP: [],  // Terminal state
  AUSENTE: ["RESERVADO"], // Can re-schedule
  CANCELADO: ["RESERVADO"], // Can re-schedule
};

// ─── Service Types ─────────────────────────────────────

/** Service type classification */
export type TipoServicio = "RAPIDO" | "PESADO";

/** Service type configuration */
export interface ServicioConfig {
  /** Display name */
  label: string;
  /** Duration in hours (blocks agenda) */
  durationHours: number;
  /** Description */
  description: string;
}

/** Service type registry */
export const SERVICIO_CONFIG: Record<TipoServicio, ServicioConfig> = {
  RAPIDO: {
    label: "Mantenimiento Rápido",
    durationHours: 1,
    description: "Cambio de aceite, filtros, revisión básica",
  },
  PESADO: {
    label: "Mantenimiento Pesado/Motor",
    durationHours: 4,
    description: "Motor, transmisión, suspensión, frenos mayores",
  },
};

// ─── Business Hours ────────────────────────────────────

/** Day of week (0=Sunday, 6=Saturday) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Time slot configuration */
export interface TimeSlot {
  /** Start time (HH:MM, 24h) */
  open: string;
  /** End time (HH:MM, 24h) */
  close: string;
}

/** Business hours configuration */
export interface BusinessHours {
  /** Slots per day of week (null = closed) */
  slots: Record<DayOfWeek, TimeSlot | null>;
  /** Maximum simultaneous vehicles (bay capacity) */
  maxCapacity: number;
  /** Time slot interval in minutes (e.g., 30, 60) */
  slotIntervalMinutes: number;
}

/** Default business hours for Paraguayan workshops */
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  slots: {
    0: null,                          // Domingo: cerrado
    1: { open: "07:30", close: "17:30" }, // Lunes
    2: { open: "07:30", close: "17:30" }, // Martes
    3: { open: "07:30", close: "17:30" }, // Miércoles
    4: { open: "07:30", close: "17:30" }, // Jueves
    5: { open: "07:30", close: "17:30" }, // Viernes
    6: { open: "07:30", close: "12:00" }, // Sábado
  },
  maxCapacity: 5,
  slotIntervalMinutes: 30,
};

// ─── Request/Response DTOs ─────────────────────────────

/** Create appointment request */
export interface CreateAgendamientoRequest {
  /** Client name */
  clienteNombre: string;
  /** Client phone (will be sanitized) */
  clientePhone: string;
  /** Client email (optional) */
  clienteEmail?: string;
  /** Document ID (C.I./RUC) */
  clienteDocumento?: string;
  /** Vehicle plate */
  vehiculoChapa: string;
  /** Vehicle brand */
  vehiculoMarca: string;
  /** Vehicle model */
  vehiculoModelo: string;
  /** Vehicle VIN (optional) */
  vehiculoVin?: string;
  /** Scheduled date (YYYY-MM-DD) */
  fechaTurno: string;
  /** Scheduled time (HH:MM) */
  horaTurno: string;
  /** Service type */
  tipoServicio: TipoServicio;
  /** Previous diagnosis (optional, from CRM) */
  diagnosticoPre?: string;
  /** Twenty CRM contact ID (if synced) */
  twentyContactId?: string;
  /** Notes */
  notas?: string;
}

/** Check-in request (appointment → OT) */
export interface CheckInRequest {
  /** Appointment ID */
  agendamientoId: string;
  /** Mileage at arrival */
  kilometraje?: number;
  /** Additional observations */
  observaciones?: string;
  /** Override: create client in ERP even if exists */
  forceCreateClient?: boolean;
}

/** Availability check request */
export interface CheckAvailabilityRequest {
  /** Date to check (YYYY-MM-DD) */
  fecha: string;
  /** Time to check (HH:MM) */
  hora: string;
  /** Service type */
  tipoServicio: TipoServicio;
}

/** Availability check response */
export interface CheckAvailabilityResponse {
  /** Whether the slot is available */
  available: boolean;
  /** Reason if not available */
  reason?: string;
  /** Available slots for that day */
  availableSlots?: string[];
  /** Current occupancy count */
  currentOccupancy: number;
  /** Maximum capacity */
  maxCapacity: number;
}

/** WhatsApp reminder template data */
export interface ReminderTemplateData {
  nombre_cliente: string;
  fecha_turno: string;
  hora_turno: string;
  vehiculo: string;
  chapa: string;
  tipo_servicio: string;
}

/** Cron job result */
export interface CronJobResult {
  /** Number of reminders sent */
  remindersSent: number;
  /** Number of appointments marked AUSENTE */
  markedAbsent: number;
  /** Errors encountered */
  errors: string[];
  /** Execution timestamp */
  executedAt: string;
  /** Duration in ms */
  durationMs: number;
}
