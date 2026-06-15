/**
 * Herramientas Service — tool catalog management (SKU-level).
 *
 * Manages the herramientas table — the master catalog of tool types.
 * Individual asset tracking (serialised units, state machine, loans)
 * is handled by tool-instance.service.ts and tool-loan.service.ts.
 *
 * This service no longer manages stock counters (stockTotal/stockDisponible).
 * Those are derived from tool_instances state queries.
 *
 * @module inventory/services/herramientas.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  herramientas,
  controlHerramientas,
} from "../schema/index.js";
import { eq, and, sql, desc, count } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../shared/errors/app-error.js";
import type {
  CreateHerramientaRequest,
  UpdateHerramientaRequest,
} from "../types.js";

// ─── Tools Master CRUD ────────────────────────

/**
 * Creates a new tool in the master catalog.
 *
 * @param data - Tool payload
 * @returns The created herramienta
 * @throws {ConflictError} If the codigo already exists
 */
export async function createHerramienta(data: CreateHerramientaRequest) {
  // Validate unique codigo
  const existing = await db()
    .select({ id: herramientas.id })
    .from(herramientas)
    .where(eq(herramientas.codigo, data.codigo))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Ya existe una herramienta con ese código");
  }

  const [tool] = await db()
    .insert(herramientas)
    .values({
      codigo: data.codigo,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      categoria: data.categoria ?? null,
      marca: data.marca ?? null,
      modelo: data.modelo ?? null,
      numeroSerie: data.numeroSerie ?? null,
      ubicacion: data.ubicacion ?? null,
      requiereCalibracion: data.requiereCalibracion ?? false,
      tieneSerialIndividual: data.tieneSerialIndividual ?? true,
      vidaUtilAnos: data.vidaUtilAnos ?? null,
      metodoDepreciacion: data.metodoDepreciacion ?? 'LINEA_RECTA',
      costoReposicion: data.costoReposicion ? String(data.costoReposicion) : null,
      categoriaContableId: data.categoriaContableId ?? null,
      activo: data.activo ?? true,
      imagenUrl: data.imagenUrl ?? null,
    })
    .returning();

  return tool;
}

/**
 * Retrieves a single tool by ID.
 *
 * @param id - Herramienta UUID
 * @returns The herramienta record
 * @throws {NotFoundError} If not found
 */
export async function getHerramientaById(id: string) {
  const [tool] = await db()
    .select()
    .from(herramientas)
    .where(eq(herramientas.id, id))
    .limit(1);

  if (!tool) {
    throw new NotFoundError(`Herramienta con ID ${id} no encontrada`);
  }

  return tool;
}

/**
 * Lists tools with optional search and filtering.
 *
 * @param options - Search, filter, pagination
 * @returns Paginated tool list
 */
export async function listHerramientas(options: {
  search?: string;
  categoria?: string;
  activo?: boolean;
  page?: number;
  limit?: number;
}) {
  const { search, categoria, activo, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${herramientas.codigo} ILIKE ${pattern} OR ${herramientas.nombre} ILIKE ${pattern} OR ${herramientas.numeroSerie} ILIKE ${pattern})` as any,
    );
  }

  if (categoria) {
    conditions.push(eq(herramientas.categoria, categoria));
  }

  if (activo !== undefined) {
    conditions.push(eq(herramientas.activo, activo));
  }

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(herramientas)
    .where(whereClause);

  const items = await db()
    .select()
    .from(herramientas)
    .where(whereClause)
    .orderBy(desc(herramientas.updatedAt))
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
 * Updates a tool record.
 *
 * @param id - Herramienta UUID
 * @param data - Fields to update
 * @returns The updated herramienta
 * @throws {NotFoundError} If not found
 * @throws {ConflictError} If codigo conflicts
 */
export async function updateHerramienta(
  id: string,
  data: UpdateHerramientaRequest,
) {
  const existing = await getHerramientaById(id);

  // Check codigo uniqueness if changed
  if (data.codigo && data.codigo !== existing.codigo) {
    const conflict = await db()
      .select({ id: herramientas.id })
      .from(herramientas)
      .where(
        and(eq(herramientas.codigo, data.codigo), sql`${herramientas.id} != ${id}`),
      )
      .limit(1);

    if (conflict.length > 0) {
      throw new ConflictError("Ya existe otra herramienta con ese código");
    }
  }

  const updatePayload: Record<string, unknown> = {};
  const fields: (keyof UpdateHerramientaRequest)[] = [
    "codigo", "nombre", "descripcion", "categoria", "marca", "modelo",
    "numeroSerie", "ubicacion", "requiereCalibracion",
    "tieneSerialIndividual", "vidaUtilAnos", "metodoDepreciacion",
    "costoReposicion", "categoriaContableId", "activo", "imagenUrl",
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      const dbField = field === "numeroSerie" ? "numero_serie"
        : field === "requiereCalibracion" ? "requiere_calibracion"
        : field === "tieneSerialIndividual" ? "tiene_serial_individual"
        : field === "vidaUtilAnos" ? "vida_util_anos"
        : field === "metodoDepreciacion" ? "metodo_depreciacion"
        : field === "costoReposicion" ? "costo_reposicion"
        : field === "categoriaContableId" ? "categoria_contable_id"
        : field === "imagenUrl" ? "imagen_url"
        : field;

      updatePayload[dbField] = data[field] as string | number | boolean | null;
    }
  }

  updatePayload["updated_at"] = sql`NOW()`;

  const [updated] = await db()
    .update(herramientas)
    .set(updatePayload)
    .where(eq(herramientas.id, id))
    .returning();

  return updated;
}

// ─── Tool Checkout / Return (LEGACY — redirected to tool-loan.service) ──

/**
 * @deprecated Use tool-loan.service.ts lendTool() instead.
 * Kept for backward compatibility — delegates to the new asset-based system.
 *
 * For legacy callers, this function accepts a herramientaId (SKU),
 * resolves to the first available DISPONIBLE tool_instance, and
 * calls lendTool() on that instance.
 */
export async function prestarHerramienta(data: {
  herramientaId: string;
  ordenTrabajoId: string;
  mecanicoId: string;
  observaciones?: string | null;
}) {
  const { lendTool } = await import("./tool-loan.service.js");

  // Auto-resolve: find first available instance of this SKU
  const [availableInstance] = await db()
    .select({ id: sql<string>`id` })
    .from(sql`tool_instances`)
    .where(
      and(
        sql`herramienta_id = ${data.herramientaId}`,
        sql`estado_actual = 'DISPONIBLE'`,
        sql`activa = true`,
      ),
    )
    .limit(1);

  if (!availableInstance) {
    throw new ValidationError(
      `No hay unidades disponibles de esta herramienta. ` +
      `Use tool-loan/lend con un toolInstanceId específico.`,
    );
  }

  return lendTool(
    {
      toolInstanceId: availableInstance.id,
      ordenTrabajoId: data.ordenTrabajoId,
      mecanicoId: data.mecanicoId,
      observaciones: data.observaciones,
    },
    "legacy",
    "",
  );
}

/**
 * @deprecated Use tool-loan.service.ts returnTool() instead.
 * Delegates to the new return flow.
 */
export async function devolverHerramienta(
  controlId: string,
  data: { observaciones?: string | null; estado?: string },
) {
  const { returnTool } = await import("./tool-loan.service.js");

  const conditionMap: Record<string, string> = {
    Devuelto: 'BUENO',
    Perdido: 'EXTRAVIADO',
    'Dañado': 'DANADO',
  };

  const condicionRetorno = conditionMap[data.estado ?? 'Devuelto'] || 'BUENO';

  return returnTool(
    controlId,
    {
      condicionRetorno: condicionRetorno as any,
      observaciones: data.observaciones,
    },
    "legacy",
    "",
  );
}

/**
 * Lists tool control (checkout) records with optional filters.
 *
 * @param options - Filters
 * @returns List of control records with JOINed data
 */
export async function listControlHerramientas(options: {
  ordenTrabajoId?: string;
  mecanicoId?: string;
  herramientaId?: string;
  estado?: string;
  page?: number;
  limit?: number;
}) {
  const {
    ordenTrabajoId,
    mecanicoId,
    herramientaId,
    estado,
    page = 1,
    limit = 20,
  } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];

  if (ordenTrabajoId) {
    conditions.push(
      eq(controlHerramientas.ordenTrabajoId, ordenTrabajoId),
    );
  }
  if (mecanicoId) {
    conditions.push(eq(controlHerramientas.mecanicoId, mecanicoId));
  }
  if (herramientaId) {
    conditions.push(
      eq(controlHerramientas.herramientaId, herramientaId),
    );
  }
  if (estado) {
    conditions.push(eq(controlHerramientas.estado, estado as any));
  }

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(controlHerramientas)
    .where(whereClause);

  // Single JOIN query — avoids N+1
  const items = await db()
    .select({
      id: controlHerramientas.id,
      herramientaId: controlHerramientas.herramientaId,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      toolInstanceId: controlHerramientas.toolInstanceId,
      ordenTrabajoId: controlHerramientas.ordenTrabajoId,
      mecanicoId: controlHerramientas.mecanicoId,
      mecanicoNombre: controlHerramientas.mecanicoNombre,
      fechaAsignacion: controlHerramientas.fechaAsignacion,
      fechaDevolucion: controlHerramientas.fechaDevolucion,
      estado: controlHerramientas.estado,
      condicionRetorno: controlHerramientas.condicionRetorno,
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
