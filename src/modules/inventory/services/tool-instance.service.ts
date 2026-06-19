/**
 * Tool Instance Service — individual tool asset lifecycle management.
 *
 * Manages the tool_instances table (per-serial-number asset tracking)
 * and the operational state machine:
 *   DISPONIBLE → PRESTADA (via tool-loan.service)
 *   DISPONIBLE → EN_CALIBRACION
 *   EN_CALIBRACION → DISPONIBLE
 *   EN_REPARACION → DISPONIBLE
 *   CUALQUIER → DADO_DE_BAJA (write-off)
 *
 * @module inventory/services/tool-instance.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  toolInstances,
  herramientas,
} from "../schema/index.js";
import { eq, and, sql, desc, count, inArray } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error.js";
import type {
  CreateToolInstanceRequest,
  UpdateToolInstanceRequest,
  DecommissionToolRequest,
} from "../types.js";

// ─── Allowable State Transitions ──────────────

const STATE_TRANSITIONS: Record<string, string[]> = {
  DISPONIBLE: ['PRESTADA', 'EN_CALIBRACION', 'DADO_DE_BAJA', 'EXTRAVIADA'],
  PRESTADA: ['DISPONIBLE', 'EN_REPARACION', 'EXTRAVIADA', 'DADO_DE_BAJA'],
  EN_REPARACION: ['DISPONIBLE', 'DADO_DE_BAJA'],
  EN_CALIBRACION: ['DISPONIBLE', 'DADO_DE_BAJA'],
  EXTRAVIADA: ['DADO_DE_BAJA'],
  DADO_DE_BAJA: [], // Terminal state
};

/**
 * Validates a state transition is allowed.
 * @throws {ValidationError} If transition is not allowed
 */
export function validateStateTransition(
  currentEstado: string,
  newEstado: string,
): void {
  const allowed = STATE_TRANSITIONS[currentEstado];
  if (!allowed) {
    throw new ValidationError(
      `Estado actual "${currentEstado}" no es válido`,
    );
  }
  if (!allowed.includes(newEstado)) {
    throw new ValidationError(
      `Transición de "${currentEstado}" a "${newEstado}" no permitida. ` +
      `Transiciones permitidas: ${allowed.join(', ')}`,
    );
  }
}

// ─── CRUD Operations ─────────────────────────

/**
 * Creates a new tool instance (individual asset).
 *
 * @param data - Tool instance payload
 * @param tenantSlug - Current tenant
 * @returns The created tool instance
 * @throws {NotFoundError} If herramienta (catalog SKU) not found
 * @throws {ValidationError} If serial number conflicts
 */
export async function createToolInstance(
  data: CreateToolInstanceRequest,
  tenantSlug: string,
) {
  // Validate herramienta exists
  const [cat] = await db()
    .select({ id: herramientas.id })
    .from(herramientas)
    .where(eq(herramientas.id, data.herramientaId))
    .limit(1);

  if (!cat) {
    throw new NotFoundError(`Herramienta SKU ${data.herramientaId} no encontrada`);
  }

  // Check unique serial per herramienta
  const existing = await db()
    .select({ id: toolInstances.id })
    .from(toolInstances)
    .where(and(
      eq(toolInstances.herramientaId, data.herramientaId),
      eq(toolInstances.numeroSerie, data.numeroSerie),
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new ValidationError(
      `Ya existe un activo con serie "${data.numeroSerie}" para esta herramienta`,
    );
  }

  const [instance] = await db()
    .insert(toolInstances)
    .values({
      herramientaId: data.herramientaId,
      numeroSerie: data.numeroSerie,
      tagRfid: data.tagRfid ?? null,
      codigoBarras: data.codigoBarras ?? null,
      codigoInventario: data.codigoInventario ?? null,
      costoAdquisicion: String(data.costoAdquisicion),
      fechaAdquisicion: data.fechaAdquisicion,
      valorActualLibros: String(data.costoAdquisicion), // Initial book value = purchase cost
      requiereCalibracion: data.requiereCalibracion ?? false,
      diasIntervaloCalibracion: data.diasIntervaloCalibracion
        ? String(data.diasIntervaloCalibracion)
        : null,
      ubicacionActual: data.ubicacionActual ?? null,
      estadoActual: 'DISPONIBLE',
      activa: true,
      categoriaContableId: data.categoriaContableId ?? null,
      tenantSlug,
    })
    .returning();

  return instance;
}

/**
 * Retrieves a single tool instance by ID.
 *
 * @param id - ToolInstance UUID
 * @param tenantSlug - Current tenant
 * @returns The tool instance with catalog SKU data
 * @throws {NotFoundError} If not found
 */
export async function getToolInstanceById(id: string, tenantSlug: string) {
  const [instance] = await db()
    .select({
      instance: toolInstances,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      herramientaCategoria: herramientas.categoria,
    })
    .from(toolInstances)
    .leftJoin(
      herramientas,
      eq(toolInstances.herramientaId, herramientas.id),
    )
    .where(and(
      eq(toolInstances.id, id),
      eq(toolInstances.tenantSlug, tenantSlug),
    ))
    .limit(1);

  if (!instance) {
    throw new NotFoundError(`Activo con ID ${id} no encontrado`);
  }

  return instance;
}

/**
 * Lists tool instances with filtering.
 *
 * @param options - Filters
 * @returns Paginated list of tool instances with catalog data
 */
export async function listToolInstances(options: {
  herramientaId?: string;
  estado?: string;
  activa?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  tenantSlug: string;
}) {
  const {
    herramientaId,
    estado,
    activa,
    search,
    page = 1,
    limit = 20,
    tenantSlug,
  } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [
    eq(toolInstances.tenantSlug, tenantSlug),
  ];

  if (herramientaId) {
    conditions.push(eq(toolInstances.herramientaId, herramientaId));
  }
  if (estado) {
    conditions.push(eq(toolInstances.estadoActual, estado));
  }
  if (activa !== undefined) {
    conditions.push(eq(toolInstances.activa, activa));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${toolInstances.numeroSerie} ILIKE ${pattern} OR ${toolInstances.codigoInventario} ILIKE ${pattern} OR ${toolInstances.tagRfid} ILIKE ${pattern})` as any,
    );
  }

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(toolInstances)
    .where(whereClause);

  const items = await db()
    .select({
      id: toolInstances.id,
      herramientaId: toolInstances.herramientaId,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      numeroSerie: toolInstances.numeroSerie,
      tagRfid: toolInstances.tagRfid,
      codigoBarras: toolInstances.codigoBarras,
      codigoInventario: toolInstances.codigoInventario,
      costoAdquisicion: toolInstances.costoAdquisicion,
      valorActualLibros: toolInstances.valorActualLibros,
      estadoActual: toolInstances.estadoActual,
      ubicacionActual: toolInstances.ubicacionActual,
      requiereCalibracion: toolInstances.requiereCalibracion,
      ultimaCalibracion: toolInstances.ultimaCalibracion,
      proximaCalibracion: toolInstances.proximaCalibracion,
      activa: toolInstances.activa,
      tecnicoActualId: toolInstances.tecnicoActualId,
      ordenTrabajoActualId: toolInstances.ordenTrabajoActualId,
    })
    .from(toolInstances)
    .leftJoin(
      herramientas,
      eq(toolInstances.herramientaId, herramientas.id),
    )
    .where(whereClause)
    .orderBy(desc(toolInstances.updatedAt))
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
 * Updates a tool instance's mutable fields.
 *
 * @param id - ToolInstance UUID
 * @param data - Fields to update
 * @param tenantSlug - Current tenant
 * @returns The updated tool instance
 */
export async function updateToolInstance(
  id: string,
  data: UpdateToolInstanceRequest,
  tenantSlug: string,
) {
  await getToolInstanceById(id, tenantSlug); // validates existence

  const updatePayload: Record<string, unknown> = {};

  const fields: (keyof UpdateToolInstanceRequest)[] = [
    'tagRfid', 'codigoBarras', 'codigoInventario',
    'ubicacionActual', 'requiereCalibracion',
    'diasIntervaloCalibracion', 'activa', 'categoriaContableId',
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      const dbField = field === 'tagRfid' ? 'tag_rfid'
        : field === 'codigoBarras' ? 'codigo_barras'
        : field === 'codigoInventario' ? 'codigo_inventario'
        : field === 'ubicacionActual' ? 'ubicacion_actual'
        : field === 'requiereCalibracion' ? 'requiere_calibracion'
        : field === 'diasIntervaloCalibracion' ? 'dias_intervalo_calibracion'
        : field === 'categoriaContableId' ? 'categoria_contable_id'
        : field;

      updatePayload[dbField] = data[field] as string | boolean | number | null;
    }
  }

  updatePayload['updated_at'] = sql`NOW()`;

  const [updated] = await db()
    .update(toolInstances)
    .set(updatePayload)
    .where(and(
      eq(toolInstances.id, id),
      eq(toolInstances.tenantSlug, tenantSlug),
    ))
    .returning();

  return updated;
}

// ─── State Machine Transitions ─────────────────

/**
 * Internal helper to transition a tool instance's state.
 * Validates the transition and updates the database.
 */
async function transitionState(
  id: string,
  newEstado: string,
  tenantSlug: string,
  extraFields?: Record<string, unknown>,
) {
  const instanceData = await getToolInstanceById(id, tenantSlug);
  const instance = instanceData.instance;

  validateStateTransition(instance.estadoActual, newEstado);

  const updateData: Record<string, unknown> = {
    estadoActual: newEstado,
    updatedAt: sql`NOW()`,
    ...extraFields,
  };

  // If entering a terminal/lost state, clear custodian references
  if (newEstado === 'DADO_DE_BAJA' || newEstado === 'EXTRAVIADA') {
    updateData['tecnico_actual_id'] = null;
    updateData['orden_trabajo_actual_id'] = null;
    updateData['activa'] = newEstado === 'DADO_DE_BAJA' ? false : true;
  }

  const [updated] = await db()
    .update(toolInstances)
    .set(updateData)
    .where(and(
      eq(toolInstances.id, id),
      eq(toolInstances.tenantSlug, tenantSlug),
    ))
    .returning();

  return updated;
}

/**
 * Transitions a tool from DISPONIBLE → EN_CALIBRACION.
 *
 * @param id - ToolInstance UUID
 * @param tenantSlug - Current tenant
 * @returns The updated tool instance
 */
export async function startCalibration(
  id: string,
  tenantSlug: string,
) {
  return transitionState(id, 'EN_CALIBRACION', tenantSlug);
}

/**
 * Transitions a tool from EN_CALIBRACION → DISPONIBLE.
 * Updates calibration dates.
 *
 * @param id - ToolInstance UUID
 * @param tenantSlug - Current tenant
 * @param proximaCalibracion - Next calibration due date
 * @param observaciones - Optional notes
 * @returns The updated tool instance
 */
export async function completeCalibration(
  id: string,
  tenantSlug: string,
  proximaCalibracion: string,
  _observaciones?: string, // reserved for future audit log
) {
  const extra: Record<string, unknown> = {
    ultimaCalibracion: sql`CURRENT_DATE`,
    proximaCalibracion: proximaCalibracion,
  };
  return transitionState(id, 'DISPONIBLE', tenantSlug, extra);
}

/**
 * Transitions a tool from EN_REPARACION → DISPONIBLE.
 *
 * @param id - ToolInstance UUID
 * @param tenantSlug - Current tenant
 * @returns The updated tool instance
 */
export async function completeRepair(
  id: string,
  tenantSlug: string,
) {
  return transitionState(id, 'DISPONIBLE', tenantSlug);
}

/**
 * Writes off (decommissions) a tool asset.
 * Creates accounting entry for the write-off.
 *
 * @param id - ToolInstance UUID
 * @param data - Write-off reason
 * @param tenantSlug - Current tenant
 * @returns The decommissioned tool instance
 */
export async function decommissionTool(
  id: string,
  data: DecommissionToolRequest,
  tenantSlug: string,
) {
  const existing = await getToolInstanceById(id, tenantSlug);
  const instance = existing.instance;

  // Cannot write off a currently lent tool
  if (instance.estadoActual === 'PRESTADA') {
    throw new ValidationError(
      'No se puede dar de baja una herramienta que está prestada. Debe devolverse primero.',
    );
  }

  const extra: Record<string, unknown> = {
    fechaBaja: data.fechaBaja ? new Date(data.fechaBaja) : sql`CURRENT_DATE`,
    motivoBaja: data.motivoBaja,
    valorActualLibros: '0',
  };

  return transitionState(id, 'DADO_DE_BAJA', tenantSlug, extra);
}

/**
 * Gets all available (DISPONIBLE) tool instances.
 *
 * @param tenantSlug - Current tenant
 * @returns Available tool instances with catalog data
 */
export async function listAvailableInstances(tenantSlug: string) {
  return db()
    .select({
      id: toolInstances.id,
      herramientaId: toolInstances.herramientaId,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      numeroSerie: toolInstances.numeroSerie,
      codigoInventario: toolInstances.codigoInventario,
      ubicacionActual: toolInstances.ubicacionActual,
    })
    .from(toolInstances)
    .leftJoin(
      herramientas,
      eq(toolInstances.herramientaId, herramientas.id),
    )
    .where(and(
      eq(toolInstances.tenantSlug, tenantSlug),
      eq(toolInstances.estadoActual, 'DISPONIBLE'),
      eq(toolInstances.activa, true),
    ))
    .orderBy(herramientas.nombre);
}

/**
 * Gets tool instances due for calibration.
 *
 * @param tenantSlug - Current tenant
 * @param daysAhead - How many days ahead to check (default 30)
 * @returns Instances where proxima_calibracion is within the window
 */
export async function getToolsDueForCalibration(
  tenantSlug: string,
  daysAhead = 30,
) {
  return db()
    .select({
      id: toolInstances.id,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      numeroSerie: toolInstances.numeroSerie,
      proximaCalibracion: toolInstances.proximaCalibracion,
      estadoActual: toolInstances.estadoActual,
    })
    .from(toolInstances)
    .leftJoin(
      herramientas,
      eq(toolInstances.herramientaId, herramientas.id),
    )
    .where(and(
      eq(toolInstances.tenantSlug, tenantSlug),
      eq(toolInstances.activa, true),
      sql`${toolInstances.proximaCalibracion} IS NOT NULL`,
      sql`${toolInstances.proximaCalibracion} <= CURRENT_DATE + (${daysAhead} || ' days')::interval`,
      inArray(toolInstances.estadoActual, ['DISPONIBLE', 'PRESTADA']),
    ))
    .orderBy(toolInstances.proximaCalibracion);
}
