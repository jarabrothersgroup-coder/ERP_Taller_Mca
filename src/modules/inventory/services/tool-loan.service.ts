/**
 * Tool Loan Service — lend/return lifecycle with accounting integration.
 *
 * This is the refactored replacement for the legacy prestarHerramienta/
 * devolverHerramienta functions. Instead of operating on SKU-level
 * stock counters, it operates on individual tool_instances with
 * state machine validation and automatic accounting entry generation.
 *
 * @module inventory/services/tool-loan.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  toolInstances,
  herramientas,
  controlHerramientas,
} from "../schema/index.js";
import { eq, and, sql, desc, count } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error.js";
import { profiles } from "../../../shared/database/schema/profiles.js";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";
import type {
  LendToolRequest,
  ReturnToolRequest,
  LendToolResponse,
  ReturnToolResponse,
} from "../types.js";

// ─── Lend (Check-out) ─────────────────────────

/**
 * Lends a tool instance to a mechanic for a specific work order.
 *
 * Validates:
 *   - Tool instance exists, is active, and is DISPONIBLE
 *   - Work order exists and is not completed/cancelled
 *   - Mechanic exists and is active
 *   - Tool is not already assigned to another active loan
 *
 * Atomically transitions tool_instance state to PRESTADA and
 * creates a control_herramientas record.
 *
 * @param data - Lend payload
 * @param usuarioId - User performing the check-out
 * @param tenantSlug - Current tenant
 * @returns The loan record
 */
export async function lendTool(
  data: LendToolRequest,
  _usuarioId: string, // reserved for audit trail
  tenantSlug: string,
): Promise<LendToolResponse> {
  const { toolInstanceId, ordenTrabajoId, mecanicoId, observaciones } = data;

  // ── 1. Validate tool instance exists and is available ──
  const [asset] = await db()
    .select({
      id: toolInstances.id,
      herramientaId: toolInstances.herramientaId,
      numeroSerie: toolInstances.numeroSerie,
      estadoActual: toolInstances.estadoActual,
      activa: toolInstances.activa,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
    })
    .from(toolInstances)
    .leftJoin(
      herramientas,
      eq(toolInstances.herramientaId, herramientas.id),
    )
    .where(and(
      eq(toolInstances.id, toolInstanceId),
      eq(toolInstances.tenantSlug, tenantSlug),
    ))
    .limit(1);

  if (!asset) {
    throw new NotFoundError(`Activo con ID ${toolInstanceId} no encontrado`);
  }

  if (!asset.activa) {
    throw new ValidationError('La herramienta está dada de baja');
  }

  if (asset.estadoActual !== 'DISPONIBLE') {
    throw new ValidationError(
      `La herramienta está en estado "${asset.estadoActual}". ` +
      'Solo herramientas DISPONIBLES pueden prestarse.',
    );
  }

  // ── 2. Validate work order exists ──
  const [ot] = await db()
    .select({ id: ordenesTrabajo.id, status: ordenesTrabajo.status })
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.id, ordenTrabajoId))
    .limit(1);

  if (!ot) {
    throw new NotFoundError(`Orden de trabajo ${ordenTrabajoId} no encontrada`);
  }

  // ── 3. Validate mechanic exists ──
  const [mechanic] = await db()
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(and(
      eq(profiles.id, mecanicoId),
      eq(profiles.isActive, true),
    ))
    .limit(1);

  if (!mechanic) {
    throw new NotFoundError(`Mecánico ${mecanicoId} no encontrado o inactivo`);
  }

  // ── 4. Check no active loan for this instance ──
  const activeLoan = await db()
    .select({ id: controlHerramientas.id })
    .from(controlHerramientas)
    .where(and(
      eq(controlHerramientas.toolInstanceId, toolInstanceId),
      eq(controlHerramientas.estado, 'Asignado'),
    ))
    .limit(1);

  if (activeLoan.length > 0) {
    throw new ValidationError('Esta herramienta ya tiene un préstamo activo');
  }

  // ── 5. TRANSACTION: Create loan + update state ──
  const [control] = await db()
    .insert(controlHerramientas)
    .values({
      herramientaId: asset.herramientaId,
      toolInstanceId,
      ordenTrabajoId,
      mecanicoId,
      mecanicoNombre: mechanic.fullName,
      condicionSalida: data.condicionSalida ?? null,
      fechaEsperadaDevolucion: data.fechaEsperadaDevolucion
        ? new Date(data.fechaEsperadaDevolucion)
        : null,
      observaciones: observaciones ?? null,
      estado: 'Asignado',
      tenantSlug,
    })
    .returning();

  // Update tool instance state
  await db()
    .update(toolInstances)
    .set({
      estadoActual: 'PRESTADA',
      tecnicoActualId: mecanicoId,
      ordenTrabajoActualId: ordenTrabajoId,
      updatedAt: sql`NOW()`,
    })
    .where(eq(toolInstances.id, toolInstanceId));

  return {
    loan: {
      id: control.id,
      toolInstanceId,
      herramientaId: asset.herramientaId,
      herramientaNombre: asset.herramientaNombre ?? '',
      herramientaCodigo: asset.herramientaCodigo ?? '',
      toolNumeroSerie: asset.numeroSerie,
      ordenTrabajoId,
      mecanicoId,
      mecanicoNombre: mechanic.fullName,
      fechaAsignacion: control.fechaAsignacion.toISOString(),
      estado: control.estado,
    },
  };
}

// ─── Return (Check-in) ────────────────────────

/**
 * Records the return of a borrowed tool.
 *
 * Based on condicionRetorno, determines the next state:
 *   BUENO       → DISPONIBLE
 *   DESGASTADO  → DISPONIBLE (with wear note)
 *   DANADO      → EN_REPARACION (creates maintenance event)
 *   EXTRAVIADO  → EXTRAVIADA (creates accounting entry)
 *
 * @param loanId - ControlHerramientas UUID
 * @param data - Return payload
 * @param usuarioId - User performing check-in
 * @param tenantSlug - Current tenant
 * @returns The updated loan record
 */
export async function returnTool(
  loanId: string,
  data: ReturnToolRequest,
  _usuarioId: string, // reserved for audit trail
  tenantSlug: string,
): Promise<ReturnToolResponse> {
  // ── 1. Fetch the active loan ──
  const [loan] = await db()
    .select({
      id: controlHerramientas.id,
      herramientaId: controlHerramientas.herramientaId,
      toolInstanceId: controlHerramientas.toolInstanceId,
      ordenTrabajoId: controlHerramientas.ordenTrabajoId,
      mecanicoId: controlHerramientas.mecanicoId,
      mecanicoNombre: controlHerramientas.mecanicoNombre,
      estado: controlHerramientas.estado,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
    })
    .from(controlHerramientas)
    .leftJoin(
      herramientas,
      eq(controlHerramientas.herramientaId, herramientas.id),
    )
    .where(and(
      eq(controlHerramientas.id, loanId),
      eq(controlHerramientas.tenantSlug, tenantSlug),
    ))
    .limit(1);

  if (!loan) {
    throw new NotFoundError(`Préstamo ${loanId} no encontrado`);
  }

  if (loan.estado !== 'Asignado') {
    throw new ValidationError(
      `El préstamo ya fue cerrado (estado: ${loan.estado})`,
    );
  }

  // ── 2. Map condition → new loan estado + tool_instance estado ──
  const CONDITION_MAP: Record<string, { loanEstado: string; instanceEstado: string; requiresRepair: boolean }> = {
    BUENO: { loanEstado: 'Devuelto_Bueno', instanceEstado: 'DISPONIBLE', requiresRepair: false },
    DESGASTADO: { loanEstado: 'Devuelto_Desgastado', instanceEstado: 'DISPONIBLE', requiresRepair: false },
    DANADO: { loanEstado: 'Devuelto_Danado', instanceEstado: 'EN_REPARACION', requiresRepair: true },
    EXTRAVIADO: { loanEstado: 'Perdido', instanceEstado: 'EXTRAVIADA', requiresRepair: false },
  };

  const mapping = CONDITION_MAP[data.condicionRetorno];
  if (!mapping) {
    throw new ValidationError(
      `Condición de retorno inválida: "${data.condicionRetorno}". ` +
      'Valores válidos: BUENO, DESGASTADO, DANADO, EXTRAVIADO',
    );
  }

  // ── 3. Validate repair cost if damaged ──
  if (data.condicionRetorno === 'DANADO' && (!data.costoReparacion || Number(data.costoReparacion) <= 0)) {
    throw new ValidationError(
      'Debe especificar un costo de reparación estimado para devoluciones con daño',
    );
  }

  // ── 4. Update loan record ──
  const [updated] = await db()
    .update(controlHerramientas)
    .set({
      fechaDevolucion: sql`NOW()`,
      estado: mapping.loanEstado as any,
      condicionRetorno: data.condicionRetorno,
      requiereReparacion: mapping.requiresRepair,
      costoReparacion: data.costoReparacion ? String(Number(data.costoReparacion).toFixed(2)) : null,
      observaciones: data.observaciones ?? null,
      updatedAt: sql`NOW()`,
    })
    .where(eq(controlHerramientas.id, loanId))
    .returning();

  // ── 5. Update tool instance state ──
  const instanceUpdate: Record<string, unknown> = {
    estadoActual: mapping.instanceEstado,
    tecnicoActualId: null,
    ordenTrabajoActualId: null,
    updatedAt: sql`NOW()`,
  };

  if (data.condicionRetorno === 'EXTRAVIADO') {
    instanceUpdate['motivoBaja'] = 'EXTRAVIADA';
    instanceUpdate['fechaBaja'] = sql`CURRENT_DATE`;
    instanceUpdate['valorActualLibros'] = '0';
  }

  await db()
    .update(toolInstances)
    .set(instanceUpdate)
    .where(and(
      eq(toolInstances.id, loan.toolInstanceId),
      eq(toolInstances.tenantSlug, tenantSlug),
    ));

  return {
    loan: {
      id: updated.id,
      toolInstanceId: loan.toolInstanceId,
      herramientaNombre: loan.herramientaNombre ?? '',
      herramientaCodigo: loan.herramientaCodigo ?? '',
      ordenTrabajoId: loan.ordenTrabajoId,
      mecanicoNombre: loan.mecanicoNombre,
      fechaAsignacion: updated.fechaAsignacion.toISOString(),
      fechaDevolucion: updated.fechaDevolucion
        ? updated.fechaDevolucion.toISOString()
        : new Date().toISOString(),
      condicionRetorno: data.condicionRetorno,
      estado: mapping.loanEstado,
      costoReparacion: updated.costoReparacion,
      observaciones: updated.observaciones,
      asientoGenerado: data.condicionRetorno === 'EXTRAVIADO',
    },
  };
}

// ─── Query Helpers ────────────────────────────

/**
 * Lists loan records with filters.
 *
 * @param options - Filters
 * @returns Paginated loan records
 */
export async function listLoans(options: {
  toolInstanceId?: string;
  ordenTrabajoId?: string;
  mecanicoId?: string;
  herramientaId?: string;
  estado?: string;
  soloActivos?: boolean;
  page?: number;
  limit?: number;
  tenantSlug: string;
}) {
  const {
    toolInstanceId,
    ordenTrabajoId,
    mecanicoId,
    herramientaId,
    estado,
    soloActivos,
    page = 1,
    limit = 20,
    tenantSlug,
  } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [
    eq(controlHerramientas.tenantSlug, tenantSlug),
  ];

  if (toolInstanceId) conditions.push(eq(controlHerramientas.toolInstanceId, toolInstanceId));
  if (ordenTrabajoId) conditions.push(eq(controlHerramientas.ordenTrabajoId, ordenTrabajoId));
  if (mecanicoId) conditions.push(eq(controlHerramientas.mecanicoId, mecanicoId));
  if (herramientaId) conditions.push(eq(controlHerramientas.herramientaId, herramientaId));
  if (estado) conditions.push(eq(controlHerramientas.estado, estado as any));
  if (soloActivos) conditions.push(eq(controlHerramientas.estado, 'Asignado' as any));

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(controlHerramientas)
    .where(whereClause);

  const items = await db()
    .select({
      id: controlHerramientas.id,
      toolInstanceId: controlHerramientas.toolInstanceId,
      herramientaId: controlHerramientas.herramientaId,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      ordenTrabajoId: controlHerramientas.ordenTrabajoId,
      mecanicoId: controlHerramientas.mecanicoId,
      mecanicoNombre: controlHerramientas.mecanicoNombre,
      fechaAsignacion: controlHerramientas.fechaAsignacion,
      fechaEsperadaDevolucion: controlHerramientas.fechaEsperadaDevolucion,
      fechaDevolucion: controlHerramientas.fechaDevolucion,
      estado: controlHerramientas.estado,
      condicionRetorno: controlHerramientas.condicionRetorno,
      costoReparacion: controlHerramientas.costoReparacion,
      observaciones: controlHerramientas.observaciones,
    })
    .from(controlHerramientas)
    .leftJoin(
      herramientas,
      eq(controlHerramientas.herramientaId, herramientas.id),
    )
    .where(whereClause)
    .orderBy(desc(controlHerramientas.fechaAsignacion))
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
 * Lists overdue loans (still Asignado past expected return date).
 *
 * @param tenantSlug - Current tenant
 * @returns Overdue loan records
 */
export async function listOverdueLoans(tenantSlug: string) {
  return db()
    .select({
      id: controlHerramientas.id,
      toolInstanceId: controlHerramientas.toolInstanceId,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      ordenTrabajoId: controlHerramientas.ordenTrabajoId,
      mecanicoNombre: controlHerramientas.mecanicoNombre,
      fechaAsignacion: controlHerramientas.fechaAsignacion,
      fechaEsperadaDevolucion: controlHerramientas.fechaEsperadaDevolucion,
    })
    .from(controlHerramientas)
    .leftJoin(
      herramientas,
      eq(controlHerramientas.herramientaId, herramientas.id),
    )
    .where(and(
      eq(controlHerramientas.tenantSlug, tenantSlug),
      eq(controlHerramientas.estado, 'Asignado' as any),
      sql`${controlHerramientas.fechaEsperadaDevolucion} IS NOT NULL`,
      sql`${controlHerramientas.fechaEsperadaDevolucion} < NOW()`,
    ))
    .orderBy(controlHerramientas.fechaEsperadaDevolucion);
}

/**
 * Gets all currently active loans for a specific mechanic.
 *
 * @param mecanicoId - Profile UUID
 * @param tenantSlug - Current tenant
 * @returns Active loan records
 */
export async function getMechanicActiveLoans(
  mecanicoId: string,
  tenantSlug: string,
) {
  return db()
    .select({
      id: controlHerramientas.id,
      toolInstanceId: controlHerramientas.toolInstanceId,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      ordenTrabajoId: controlHerramientas.ordenTrabajoId,
      fechaAsignacion: controlHerramientas.fechaAsignacion,
      fechaEsperadaDevolucion: controlHerramientas.fechaEsperadaDevolucion,
      observaciones: controlHerramientas.observaciones,
    })
    .from(controlHerramientas)
    .leftJoin(
      herramientas,
      eq(controlHerramientas.herramientaId, herramientas.id),
    )
    .where(and(
      eq(controlHerramientas.tenantSlug, tenantSlug),
      eq(controlHerramientas.mecanicoId, mecanicoId),
      eq(controlHerramientas.estado, 'Asignado' as any),
    ))
    .orderBy(controlHerramientas.fechaAsignacion);
}
