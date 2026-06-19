/**
 * Agendamiento Service — CRUD + State Machine + Check-in.
 *
 * Manages the full lifecycle of an appointment:
 *   1. Create (from CRM or manual)
 *   2. Confirm (client via WhatsApp)
 *   3. Check-in (client arrives → create OT in ERP)
 *   4. Mark absent (no-show after 30min)
 *   5. Cancel (client cancels)
 *
 * RAM impact: ~3 KB (HTTP client + DB queries).
 *
 * @module scheduling/services/agendamiento.service
 */

import { eq, and, desc, count } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import {
  agendamientos,
} from "../schema/agendamientos.js";
import {
  clients,
  vehiculos,
  ordenesTrabajo,
} from "../../../shared/database/schema/index.js";
import { sanitizePhone } from "../../whatsapp/services/whatsapp.service.js";
import { checkAvailability } from "./capacity.service.js";
import {
  SERVICIO_CONFIG,
  STATE_TRANSITIONS,
  type AgendamientoEstado,
  type CreateAgendamientoRequest,
  type CheckInRequest,
} from "../types.js";

// ─── State Machine ─────────────────────────────────────

/**
 * Validates a state transition.
 *
 * @param current - Current state
 * @param next - Desired next state
 * @returns true if transition is valid
 */
export function isValidTransition(
  current: AgendamientoEstado,
  next: AgendamientoEstado,
): boolean {
  return STATE_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * Transition an appointment to a new state.
 *
 * @param agendamientoId - Appointment ID
 * @param newState - Target state
 * @param tenantSlug - Tenant identifier
 * @returns Updated appointment or null
 */
export async function transitionState(
  agendamientoId: string,
  newState: AgendamientoEstado,
  tenantSlug: string,
): Promise<{ id: string; estado: AgendamientoEstado } | null> {
  // 1. Fetch current state
  const [current] = await db()
    .select({ id: agendamientos.id, estado: agendamientos.estado })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.id, agendamientoId),
        eq(agendamientos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!current) return null;

  // 2. Validate transition
  if (!isValidTransition(current.estado, newState)) {
    throw new Error(
      `Transición inválida: ${current.estado} → ${newState}`,
    );
  }

  // 3. Apply transition
  const updateData: Record<string, unknown> = {
    estado: newState,
    estadoAnterior: current.estado,
    updatedAt: new Date(),
  };

  if (newState === "CONFIRMADO") {
    updateData.confirmedAt = new Date();
  } else if (newState === "PROCESADO_EN_ERP") {
    updateData.checkedInAt = new Date();
  } else if (newState === "AUSENTE") {
    updateData.markedAbsentAt = new Date();
  }

  await db()
    .update(agendamientos)
    .set(updateData)
    .where(eq(agendamientos.id, agendamientoId));

  return { id: agendamientoId, estado: newState };
}

// ─── CRUD Operations ───────────────────────────────────

/**
 * Creates a new appointment.
 *
 * Validates:
 *   - Business hours
 *   - Bay capacity
 *   - No duplicate appointments for same vehicle
 *
 * @param data - Appointment data
 * @param tenantSlug - Tenant identifier
 * @param createdBy - User email
 * @returns Created appointment
 */
export async function createAgendamiento(
  data: CreateAgendamientoRequest,
  tenantSlug: string,
  createdBy: string = "system",
): Promise<{ id: string; estado: AgendamientoEstado }> {
  // 1. Sanitize phone
  const phone = sanitizePhone(data.clientePhone);

  // 2. Check availability
  const config = SERVICIO_CONFIG[data.tipoServicio];
  const availability = await checkAvailability(
    data.fechaTurno,
    data.horaTurno,
    data.tipoServicio,
    tenantSlug,
  );

  if (!availability.available) {
    throw new Error(`Turno no disponible: ${availability.reason}`);
  }

  // 3. Check for duplicate vehicle on same date/time
  const [duplicate] = await db()
    .select({ id: agendamientos.id })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.vehiculoChapa, data.vehiculoChapa),
        eq(agendamientos.fechaTurno, data.fechaTurno),
        eq(agendamientos.horaTurno, data.horaTurno),
        eq(agendamientos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (duplicate) {
    throw new Error(
      `El vehículo ${data.vehiculoChapa} ya tiene un turno agendado para ${data.fechaTurno} a las ${data.horaTurno}`,
    );
  }

  // 4. Insert appointment
  const [created] = await db()
    .insert(agendamientos)
    .values({
      clienteNombre: data.clienteNombre,
      clientePhone: phone,
      clienteEmail: data.clienteEmail || null,
      clienteDocumento: data.clienteDocumento || null,
      vehiculoChapa: data.vehiculoChapa,
      vehiculoMarca: data.vehiculoMarca,
      vehiculoModelo: data.vehiculoModelo,
      vehiculoVin: data.vehiculoVin || null,
      fechaTurno: data.fechaTurno,
      horaTurno: data.horaTurno,
      tipoServicio: data.tipoServicio,
      duracionHoras: config.durationHours,
      estado: "RESERVADO",
      diagnosticoPre: data.diagnosticoPre || null,
      twentyContactId: data.twentyContactId || null,
      tenantSlug,
      createdBy,
    })
    .returning({ id: agendamientos.id });

  return { id: created.id, estado: "RESERVADO" };
}

/**
 * Lists appointments with filtering and pagination.
 */
export async function listAgendamientos(
  tenantSlug: string,
  options: {
    page?: number;
    limit?: number;
    fecha?: string;
    estado?: AgendamientoEstado;
    search?: string;
  } = {},
): Promise<{
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(agendamientos.tenantSlug, tenantSlug)];

  if (options.fecha) {
    conditions.push(eq(agendamientos.fechaTurno, options.fecha));
  }
  if (options.estado) {
    conditions.push(eq(agendamientos.estado, options.estado));
  }

  const whereClause = and(...conditions);

  const [totalRow] = await db()
    .select({ total: count() })
    .from(agendamientos)
    .where(whereClause);

  let query = db()
    .select()
    .from(agendamientos)
    .where(whereClause)
    .orderBy(desc(agendamientos.fechaTurno), desc(agendamientos.horaTurno))
    .limit(limit)
    .offset(offset);

  const items = await query;

  const total = Number(totalRow?.total ?? 0);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Gets a single appointment by ID.
 */
export async function getAgendamiento(
  agendamientoId: string,
  tenantSlug: string,
): Promise<any | null> {
  const [item] = await db()
    .select()
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.id, agendamientoId),
        eq(agendamientos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  return item || null;
}

// ─── Check-in (Appointment → OT) ──────────────────────

/**
 * CHECK-IN: Converts an appointment into an active Work Order.
 *
 * This is the "handshake" moment:
 *   1. Validates appointment is CONFIRMADO or RESERVADO
 *   2. Creates/finds client in ERP
 *   3. Creates/finds vehicle in ERP
 *   4. Creates Orden de Trabajo with inherited diagnosis
 *   5. Marks appointment as PROCESADO_EN_ERP
 *
 * @param request - Check-in request
 * @param tenantSlug - Tenant identifier
 * @param _checkedInBy - User email
 * @returns Check-in result with OT details
 */
export async function checkIn(
  request: CheckInRequest,
  tenantSlug: string,
  _checkedInBy: string = "system",
): Promise<{
  success: boolean;
  ordenTrabajoId: string;
  clientId: string;
  vehicleId: string;
  message: string;
}> {
  const { agendamientoId, observaciones, forceCreateClient } = request;

  // 1. Fetch appointment
  const appt = await getAgendamiento(agendamientoId, tenantSlug);
  if (!appt) {
    throw new Error(`Agendamiento ${agendamientoId} no encontrado`);
  }

  // 2. Validate state
  if (appt.estado !== "CONFIRMADO" && appt.estado !== "RESERVADO") {
    throw new Error(
      `No se puede hacer check-in: el turno está en estado ${appt.estado}`,
    );
  }

  // 3. Create or find client in ERP
  let clientId = appt.erpClientId;

  if (!clientId || forceCreateClient) {
    // Search by phone
    const [existingClient] = await db()
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.phone, appt.clientePhone))
      .limit(1);

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      // Create new client
      const [newClient] = await db()
        .insert(clients)
        .values({
          name: appt.clienteNombre,
          phone: appt.clientePhone,
          email: appt.clienteEmail || null,
          tenantSlug,
        })
        .returning({ id: clients.id });

      clientId = newClient.id;
    }
  }

  // 4. Create or find vehicle in ERP
  let vehicleId = appt.erpVehicleId;

  if (!vehicleId) {
    // Search by plate
    const [existingVehicle] = await db()
      .select({ id: vehiculos.id })
      .from(vehiculos)
      .where(eq(vehiculos.plate, appt.vehiculoChapa))
      .limit(1);

    if (existingVehicle) {
      vehicleId = existingVehicle.id;
    } else {
      // Create new vehicle
      const [newVehicle] = await db()
        .insert(vehiculos)
        .values({
          brand: appt.vehiculoMarca,
          model: appt.vehiculoModelo,
          plate: appt.vehiculoChapa,
          vin: appt.vehiculoVin || null,
          clientId,
          tenantSlug,
        })
        .returning({ id: vehiculos.id });

      vehicleId = newVehicle.id;
    }
  }

  // 5. Create Orden de Trabajo
  const diagnostico = [
    appt.diagnosticoPre ? `Diagnóstico previo: ${appt.diagnosticoPre}` : "",
    `Tipo de servicio: ${appt.tipoServicio}`,
    `Turno agendado: ${appt.fechaTurno} ${appt.horaTurno}`,
    observaciones || "",
  ]
    .filter(Boolean)
    .join("\n");

  const [newOrden] = await db()
    .insert(ordenesTrabajo)
    .values({
      clientId,
      vehicleId,
      status: "Presupuestado",
      description: diagnostico,
      tenantSlug,
    })
    .returning({ id: ordenesTrabajo.id });

  // 6. Update appointment state
  await db()
    .update(agendamientos)
    .set({
      estado: "PROCESADO_EN_ERP",
      estadoAnterior: appt.estado,
      ordenTrabajoId: newOrden.id,
      erpClientId: clientId,
      erpVehicleId: vehicleId,
      observaciones: observaciones || null,
      checkedInAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agendamientos.id, agendamientoId));

  return {
    success: true,
    ordenTrabajoId: newOrden.id,
    clientId,
    vehicleId,
    message: `Check-in exitoso. OT #${newOrden.id.substring(0, 8).toUpperCase()} creada para ${appt.clienteNombre}`,
  };
}

// ─── WhatsApp Response Handler ─────────────────────────

/**
 * Handles a WhatsApp response from a client.
 *
 * Response codes:
 *   "1" → Confirm appointment
 *   "2" → Cancel appointment
 *
 * @param phone - Client phone number
 * @param response - Client response text
 * @param tenantSlug - Tenant identifier
 * @returns Processing result
 */
export async function handleWhatsAppResponse(
  phone: string,
  response: string,
  tenantSlug: string,
): Promise<{
  processed: boolean;
  agendamientoId?: string;
  newState?: AgendamientoEstado;
  message: string;
}> {
  const cleanPhone = phone.replace(/\D/g, "");

  // Find the most recent RESERVADO appointment for this phone
  const [appt] = await db()
    .select({
      id: agendamientos.id,
      estado: agendamientos.estado,
      clienteNombre: agendamientos.clienteNombre,
      fechaTurno: agendamientos.fechaTurno,
      horaTurno: agendamientos.horaTurno,
    })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.clientePhone, cleanPhone),
        eq(agendamientos.tenantSlug, tenantSlug),
        eq(agendamientos.estado, "RESERVADO"),
      ),
    )
    .orderBy(desc(agendamientos.createdAt))
    .limit(1);

  if (!appt) {
    return {
      processed: false,
      message: "No se encontró un turno activo para este número",
    };
  }

  const trimmedResponse = response.trim();

  if (trimmedResponse === "1") {
    // Confirm
    await transitionState(appt.id, "CONFIRMADO", tenantSlug);
    return {
      processed: true,
      agendamientoId: appt.id,
      newState: "CONFIRMADO",
      message: `Turno confirmado para ${appt.clienteNombre} el ${appt.fechaTurno} a las ${appt.horaTurno}`,
    };
  }

  if (trimmedResponse === "2") {
    // Cancel
    await transitionState(appt.id, "CANCELADO", tenantSlug);
    return {
      processed: true,
      agendamientoId: appt.id,
      newState: "CANCELADO",
      message: `Turno cancelado para ${appt.clienteNombre}. Notificar al asesor para reprogramar.`,
    };
  }

  return {
    processed: false,
    message: `Respuesta no reconocida: "${trimmedResponse}". Responda 1 (confirmar) o 2 (cancelar).`,
  };
}

// ─── Dashboard Stats ───────────────────────────────────

/**
 * Gets scheduling statistics for the dashboard.
 */
export async function getSchedulingStats(
  tenantSlug: string,
): Promise<{
  today: number;
  todayConfirmed: number;
  todayPending: number;
  thisWeek: number;
  totalActive: number;
}> {
  const today = new Date().toISOString().split("T")[0];

  const [todayTotal] = await db()
    .select({ total: count() })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.fechaTurno, today),
        eq(agendamientos.tenantSlug, tenantSlug),
      ),
    );

  const [todayConfirmed] = await db()
    .select({ total: count() })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.fechaTurno, today),
        eq(agendamientos.tenantSlug, tenantSlug),
        eq(agendamientos.estado, "CONFIRMADO"),
      ),
    );

  const [todayPending] = await db()
    .select({ total: count() })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.fechaTurno, today),
        eq(agendamientos.tenantSlug, tenantSlug),
        eq(agendamientos.estado, "RESERVADO"),
      ),
    );

  const [totalActive] = await db()
    .select({ total: count() })
    .from(agendamientos)
    .where(
      and(
        eq(agendamientos.tenantSlug, tenantSlug),
        eq(agendamientos.estado, "RESERVADO"),
      ),
    );

  return {
    today: Number(todayTotal?.total ?? 0),
    todayConfirmed: Number(todayConfirmed?.total ?? 0),
    todayPending: Number(todayPending?.total ?? 0),
    thisWeek: 0, // TODO: implement week range query
    totalActive: Number(totalActive?.total ?? 0),
  };
}
