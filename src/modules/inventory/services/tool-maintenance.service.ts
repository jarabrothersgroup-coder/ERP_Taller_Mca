/**
 * Tool Maintenance Service — calibration and repair event management.
 *
 * Manages tool_maintenance_events for calibration, repair, and
 * preventive maintenance. Integrates with tool-instance state machine
 * to block DISPONIBLE→PRESTADA transitions when calibration is overdue.
 *
 * @module inventory/services/tool-maintenance.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  toolMaintenanceEvents,
  toolInstances,
} from "../schema/index.js";
import { eq, and, sql, desc, count } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error.js";
import type {
  CreateServiceEventRequest,
  UpdateServiceEventRequest,
} from "../types.js";

// ─── Service Event CRUD ───────────────────────

/**
 * Creates a new service event (calibration, repair, PM).
 *
 * If tipo is CALIBRACION_PROGRAMADA or REPARACION, also transitions
 * the tool instance to the appropriate state.
 *
 * @param data - Service event payload
 * @param usuarioId - User creating the event
 * @param tenantSlug - Current tenant
 * @returns The created service event
 */
export async function createServiceEvent(
  data: CreateServiceEventRequest,
  usuarioId: string,
  tenantSlug: string,
) {
  // Validate tool instance exists
  const [instance] = await db()
    .select({
      id: toolInstances.id,
      estadoActual: toolInstances.estadoActual,
      activa: toolInstances.activa,
    })
    .from(toolInstances)
    .where(and(
      eq(toolInstances.id, data.toolInstanceId),
      eq(toolInstances.tenantSlug, tenantSlug),
    ))
    .limit(1);

  if (!instance) {
    throw new NotFoundError(`Activo ${data.toolInstanceId} no encontrado`);
  }

  if (!instance.activa) {
    throw new ValidationError('No se puede crear eventos en herramientas dadas de baja');
  }

  // Auto-transition tool state based on event type
  if (data.tipo === 'CALIBRACION_PROGRAMADA' || data.tipo === 'CALIBRACION_EXTRAORDINARIA') {
    if (instance.estadoActual !== 'DISPONIBLE') {
      throw new ValidationError(
        `La herramienta está "${instance.estadoActual}". Solo herramientas DISPONIBLES pueden entrar a calibración.`,
      );
    }
    await db()
      .update(toolInstances)
      .set({
        estadoActual: 'EN_CALIBRACION',
        updatedAt: sql`NOW()`,
      })
      .where(eq(toolInstances.id, data.toolInstanceId));
  } else if (data.tipo === 'REPARACION') {
    // Repair can start from DISPONIBLE or from PRESTADA+Danado flow
    if (instance.estadoActual === 'DISPONIBLE') {
      await db()
        .update(toolInstances)
        .set({
          estadoActual: 'EN_REPARACION',
          updatedAt: sql`NOW()`,
        })
        .where(eq(toolInstances.id, data.toolInstanceId));
    }
    // If already EN_REPARACION (from return flow), keep it
  }

  const [event] = await db()
    .insert(toolMaintenanceEvents)
    .values({
      toolInstanceId: data.toolInstanceId,
      tipo: data.tipo,
      estado: 'EN_PROCESO',
      fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : sql`NOW()`,
      proveedor: data.proveedor ?? null,
      numeroOrdenExterna: data.numeroOrdenExterna ?? null,
      costo: data.costo ? String(Number(data.costo).toFixed(2)) : null,
      observaciones: data.observaciones ?? null,
      realizadaPorId: usuarioId,
      tenantSlug,
    })
    .returning();

  return event;
}

/**
 * Updates a service event (typically to mark COMPLETADO).
 *
 * On completion:
 *   - If CALIBRACION: updates tool_instance calibration dates,
 *     transitions back to DISPONIBLE
 *   - If REPARACION: transitions tool back to DISPONIBLE
 *
 * @param id - Maintenance event UUID
 * @param data - Fields to update
 * @param tenantSlug - Current tenant
 * @returns The updated event
 */
export async function updateServiceEvent(
  id: string,
  data: UpdateServiceEventRequest,
  tenantSlug: string,
) {
  // Fetch existing event
  const [event] = await db()
    .select()
    .from(toolMaintenanceEvents)
    .where(and(
      eq(toolMaintenanceEvents.id, id),
      eq(toolMaintenanceEvents.tenantSlug, tenantSlug),
    ))
    .limit(1);

  if (!event) {
    throw new NotFoundError(`Evento de servicio ${id} no encontrado`);
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    updatedAt: sql`NOW()`,
  };

  if (data.estado !== undefined) updatePayload['estado'] = data.estado;
  if (data.fechaFin !== undefined) updatePayload['fecha_fin'] = data.fechaFin ? new Date(data.fechaFin) : sql`NOW()`;
  if (data.costo !== undefined) updatePayload['costo'] = String(Number(data.costo).toFixed(2));
  if (data.resultado !== undefined) updatePayload['resultado'] = data.resultado;
  if (data.certificadoUrl !== undefined) updatePayload['certificado_url'] = data.certificadoUrl;
  if (data.proveedor !== undefined) updatePayload['proveedor'] = data.proveedor;
  if (data.observaciones !== undefined) updatePayload['observaciones'] = data.observaciones;

  const [updated] = await db()
    .update(toolMaintenanceEvents)
    .set(updatePayload)
    .where(and(
      eq(toolMaintenanceEvents.id, id),
      eq(toolMaintenanceEvents.tenantSlug, tenantSlug),
    ))
    .returning();

  // ── On completion, transition tool instance ──
  if (data.estado === 'COMPLETADO') {
    const isCalibration = event.tipo === 'CALIBRACION_PROGRAMADA' || event.tipo === 'CALIBRACION_EXTRAORDINARIA';
    const isRepair = event.tipo === 'REPARACION';

    const instanceUpdate: Record<string, unknown> = {
      updatedAt: sql`NOW()`,
    };

    if (isCalibration) {
      instanceUpdate['estadoActual'] = 'DISPONIBLE';
      instanceUpdate['ultimaCalibracion'] = data.fechaFin
        ? new Date(data.fechaFin)
        : sql`CURRENT_DATE`;
      // The caller can optionally provide the next calibration date
      // via the tool-instance service's completeCalibration endpoint
    } else if (isRepair) {
      instanceUpdate['estadoActual'] = 'DISPONIBLE';
    }

    if (Object.keys(instanceUpdate).length > 1) {
      await db()
        .update(toolInstances)
        .set(instanceUpdate)
        .where(eq(toolInstances.id, event.toolInstanceId));
    }
  }

  return updated;
}

// ─── Query Helpers ────────────────────────────

/**
 * Lists service events with filters.
 *
 * @param options - Filters
 * @returns Paginated event list
 */
export async function listServiceEvents(options: {
  toolInstanceId?: string;
  tipo?: string;
  estado?: string;
  page?: number;
  limit?: number;
  tenantSlug: string;
}) {
  const {
    toolInstanceId,
    tipo,
    estado,
    page = 1,
    limit = 20,
    tenantSlug,
  } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [
    eq(toolMaintenanceEvents.tenantSlug, tenantSlug),
  ];

  if (toolInstanceId) conditions.push(eq(toolMaintenanceEvents.toolInstanceId, toolInstanceId));
  if (tipo) conditions.push(eq(toolMaintenanceEvents.tipo as any, tipo));
  if (estado) conditions.push(eq(toolMaintenanceEvents.estado as any, estado));

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(toolMaintenanceEvents)
    .where(whereClause);

  const items = await db()
    .select({
      id: toolMaintenanceEvents.id,
      toolInstanceId: toolMaintenanceEvents.toolInstanceId,
      tipo: toolMaintenanceEvents.tipo,
      estado: toolMaintenanceEvents.estado,
      fechaInicio: toolMaintenanceEvents.fechaInicio,
      fechaFin: toolMaintenanceEvents.fechaFin,
      proveedor: toolMaintenanceEvents.proveedor,
      costo: toolMaintenanceEvents.costo,
      resultado: toolMaintenanceEvents.resultado,
      certificadoUrl: toolMaintenanceEvents.certificadoUrl,
      observaciones: toolMaintenanceEvents.observaciones,
    })
    .from(toolMaintenanceEvents)
    .where(whereClause)
    .orderBy(desc(toolMaintenanceEvents.fechaInicio))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: Number(totalCount?.total ?? 0),
    page,
    limit,
    totalPages: Math.ceil(Number(totalCount?.total ?? 0) / limit),
  };
}

/**
 * Gets calibration history for a specific tool instance.
 *
 * @param toolInstanceId - ToolInstance UUID
 * @param tenantSlug - Current tenant
 * @returns Calibration event records
 */
export async function getCalibrationHistory(
  toolInstanceId: string,
  tenantSlug: string,
) {
  return db()
    .select()
    .from(toolMaintenanceEvents)
    .where(and(
      eq(toolMaintenanceEvents.toolInstanceId, toolInstanceId),
      eq(toolMaintenanceEvents.tenantSlug, tenantSlug),
      sql`(${toolMaintenanceEvents.tipo} = 'CALIBRACION_PROGRAMADA' OR ${toolMaintenanceEvents.tipo} = 'CALIBRACION_EXTRAORDINARIA')`,
    ))
    .orderBy(desc(toolMaintenanceEvents.fechaInicio));
}
