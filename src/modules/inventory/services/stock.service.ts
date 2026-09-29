/**
 * Stock Service — spare parts inventory business logic.
 *
 * Handles creation, update, stock input/output, and listing of
 * spare parts (repuestos). All stock mutations are atomic and
 * validate constraints before applying changes.
 *
 * Phase 1 integration:
 *   - PPP (Precio Promedio Ponderado) recalculation on input
 *   - Stock movements persistence (stock_movements table)
 *   - Automatic journal entries (double-entry accounting)
 *   - Reorder alert generation on low stock
 *
 * N+1 prevention: all queries use single SELECTs or JOINs —
 * no lazy relation walking.
 *
 * @module inventory/services/stock.service
 */

import { randomUUID } from "node:crypto";
import { db } from "../../../shared/database/drizzle.js";
import { withTransaction } from "../../../shared/database/transaction.js";
import {
  repuestos,
  stockMovements,
  reorderAlerts,
} from "../schema/index.js";
import { eq, and, or, sql, desc, count } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../shared/errors/app-error.js";
import { recalcularPPP } from "./costing.service.js";
import { inventarioConfigurator } from "../../finance/services/index.js";
import type {
  CreateRepuestoRequest,
  UpdateRepuestoRequest,
  SalidaStockRequest,
  IngresoStockRequest,
  StockMovimientoResponse,
} from "../types.js";
import { logEntityAudit } from "../../finance/services/accounting/audit-log.service.js";

/**
 * Creates a new spare part (repuesto) in inventory.
 *
 * @param data - The spare part payload
 * @param tenantSlug - Owning tenant (T-21d/INV-05: stamped on insert so the
 *                     row never falls back to the column default)
 * @returns The created repuesto record
 * @throws {ConflictError} If the codigo or codigo_barras already exists
 */
export async function createRepuesto(
  data: CreateRepuestoRequest,
  tenantSlug: string,
): Promise<StockMovimientoResponse["repuesto"]> {
  // ── 1. Validate uniqueness of codigo and codigo_barras ──
  const conditions: ReturnType<typeof eq>[] = [
    eq(repuestos.codigo, data.codigo),
  ];

  if (data.codigoBarras) {
    conditions.push(eq(repuestos.codigoBarras, data.codigoBarras));
  }

  const existing = await db()
    .select({ id: repuestos.id })
    .from(repuestos)
    .where(or(...conditions))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      "Ya existe un repuesto con ese código o código de barras",
    );
  }

  // ── 2. Build initial cost values ──
  // If precioCosto is provided, use it as initial PPP
  const costoInicial = data.precioCosto ? String(data.precioCosto) : null;

  // ── 3. Insert the new repuesto ──
  const [repuesto] = await db()
    .insert(repuestos)
    .values({
      codigo: data.codigo,
      codigoBarras: data.codigoBarras ?? null,
      descripcion: data.descripcion,
      marca: data.marca ?? null,
      modelo: data.modelo ?? null,
      categoria: data.categoria ?? null,
      precioCosto: costoInicial,
      costoPromedio: costoInicial, // Initial PPP = purchase cost
      tenantSlug,
      precioVenta: data.precioVenta
        ? String(data.precioVenta)
        : null,
      stockActual: data.stockActual ?? 0,
      stockMinimo: data.stockMinimo ?? 0,
      stockMaximo: data.stockMaximo ?? null,
      puntoReorden: data.puntoReorden ?? null,
      proveedorPreferidoId: data.proveedorPreferidoId ?? null,
      loteEconomico: data.loteEconomico ?? null,
      ubicacion: data.ubicacion ?? null,
      unidadMedida: data.unidadMedida ?? "unidad",
      proveedor: data.proveedor ?? null,
      compatibleCon: data.compatibleCon ?? null,
      activo: data.activo ?? true,
      imagenUrl: data.imagenUrl ?? null,
    })
    .returning();

  return {
    id: repuesto.id,
    codigo: repuesto.codigo,
    descripcion: repuesto.descripcion,
    stockActual: repuesto.stockActual,
  } as StockMovimientoResponse["repuesto"];
}

/**
 * Retrieves a single spare part by ID.
 *
 * @param id - Repuesto UUID
 * @param tenantSlug - Owning tenant (T-21d/INV-05: lookup is tenant-scoped —
 *                     a foreign id yields NotFoundError, never the row)
 * @returns The repuesto record
 * @throws {NotFoundError} If the repuesto is not found
 */
export async function getRepuestoById(id: string, tenantSlug: string) {
  const [repuesto] = await db()
    .select()
    .from(repuestos)
    .where(and(eq(repuestos.id, id), eq(repuestos.tenantSlug, tenantSlug)))
    .limit(1);

  if (!repuesto) {
    throw new NotFoundError(`Repuesto con ID ${id} no encontrado`);
  }

  return repuesto;
}

/**
 * Lists spare parts with optional search, filtering, and pagination.
 *
 * Search supports partial matching on:
 *   - codigo (internal code)
 *   - codigo_barras (barcode/QR)
 *   - descripcion (description)
 *
 * @param options - Search, filter, and pagination options
 * @returns Paginated list of repuestos
 */
export async function listRepuestos(options: {
  search?: string;
  categoria?: string;
  activo?: boolean;
  page?: number;
  limit?: number;
  tenantSlug: string;
}) {
  const { search, categoria, activo, page = 1, limit = 20, tenantSlug } = options;
  const offset = (page - 1) * limit;

  // ── Build WHERE clause dynamically ──
  const conditions: ReturnType<typeof eq>[] = [];

  // T-21d/INV-05: always tenant-scoped — the list never cross-tenant leaks
  conditions.push(eq(repuestos.tenantSlug, tenantSlug));

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${repuestos.codigo} ILIKE ${pattern} OR ${repuestos.codigoBarras} ILIKE ${pattern} OR ${repuestos.descripcion} ILIKE ${pattern})` as any,
    );
  }

  if (categoria) {
    conditions.push(eq(repuestos.categoria, categoria));
  }

  if (activo !== undefined) {
    conditions.push(eq(repuestos.activo, activo));
  }

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  // ── Single query: count + data (no N+1) ──
  const [totalCount] = await db()
    .select({ total: count() })
    .from(repuestos)
    .where(whereClause);

  const items = await db()
    .select()
    .from(repuestos)
    .where(whereClause)
    .orderBy(desc(repuestos.updatedAt))
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
 * Updates a spare part record.
 *
 * @param id - Repuesto UUID
 * @param data - Fields to update
 * @returns The updated repuesto
 * @throws {NotFoundError} If the repuesto is not found
 * @throws {ConflictError} If the codigo or codigo_barras conflicts
 */
export async function updateRepuesto(
  id: string,
  data: UpdateRepuestoRequest,
  tenantSlug: string,
) {
  // ── 1. Verify existence (tenant-scoped — T-21d/INV-05) ──
  const existing = await getRepuestoById(id, tenantSlug);

  // ── 2. Check uniqueness if codigo or codigo_barras changed ──
  if (data.codigo && data.codigo !== existing.codigo) {
    const conflict = await db()
      .select({ id: repuestos.id })
      .from(repuestos)
      .where(and(
        eq(repuestos.codigo, data.codigo),
        sql`${repuestos.id} != ${id}`,
      ))
      .limit(1);

    if (conflict.length > 0) {
      throw new ConflictError("Ya existe otro repuesto con ese código");
    }
  }

  if (
    data.codigoBarras !== undefined &&
    data.codigoBarras !== existing.codigoBarras
  ) {
    if (data.codigoBarras !== null) {
      const conflict = await db()
        .select({ id: repuestos.id })
        .from(repuestos)
        .where(
          and(
            sql`${repuestos.codigoBarras} = ${data.codigoBarras}`,
            sql`${repuestos.id} != ${id}`,
          ),
        )
        .limit(1);

      if (conflict.length > 0) {
        throw new ConflictError(
          "Ya existe otro repuesto con ese código de barras",
        );
      }
    }
  }

  // ── 3. Build update payload ──
  const updatePayload: Record<string, unknown> = {};
  const fields: (keyof UpdateRepuestoRequest)[] = [
    "codigo", "codigoBarras", "descripcion", "marca", "modelo",
    "categoria", "precioCosto", "precioVenta", "stockActual",
    "stockMinimo", "stockMaximo", "ubicacion", "unidadMedida",
    "proveedor", "compatibleCon", "activo", "imagenUrl",
    "puntoReorden", "proveedorPreferidoId", "loteEconomico",
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      const dbField = field === "codigoBarras"
        ? "codigo_barras"
        : field === "precioCosto"
        ? "precio_costo"
        : field === "precioVenta"
        ? "precio_venta"
        : field === "stockActual"
        ? "stock_actual"
        : field === "stockMinimo"
        ? "stock_minimo"
        : field === "stockMaximo"
        ? "stock_maximo"
        : field === "unidadMedida"
        ? "unidad_medida"
        : field === "compatibleCon"
        ? "compatible_con"
        : field === "imagenUrl"
        ? "imagen_url"
        : field === "puntoReorden"
        ? "punto_reorden"
        : field === "proveedorPreferidoId"
        ? "proveedor_preferido_id"
        : field === "loteEconomico"
        ? "lote_economico"
        : field;

      const value = field === "precioCosto" || field === "precioVenta"
        ? String(data[field])
        : data[field];

      updatePayload[dbField] = value;
    }
  }

  // ── 4. Apply update ──
  updatePayload["updated_at"] = sql`NOW()`;

  const [updated] = await db()
    .update(repuestos)
    .set(updatePayload)
    .where(and(eq(repuestos.id, id), eq(repuestos.tenantSlug, tenantSlug)))
    .returning();

  return updated;
}

/**
 * Records a stock output (salida) — reduces stock_actual.
 *
 * Integration:
 *   - Validates stock > 0 (no negative inventory)
 *   - Values the output at current PPP
 *   - Generates double-entry journal entry (Gasto ← Inventario)
 *   - Creates reorder_alert if stock drops below puntoReorden
 *   - Persists movement in stock_movements table
 *
 * @param data - Stock output payload
 * @param tenantSlug - Tenant identifier from request header
 * @returns Updated repuesto + movement record
 * @throws {ValidationError} If cantidad <= 0 or insufficient stock
 * @throws {NotFoundError} If repuesto not found
 */
export async function salidaStock(
  data: SalidaStockRequest,
  tenantSlug: string,
): Promise<StockMovimientoResponse> {
  return withTransaction(async () => {
    const { repuestoId, cantidad, motivo, ordenTrabajoId, centroCostoId, observaciones } = data;

    // ── 1. Validate cantidad ──
    if (!cantidad || cantidad <= 0) {
      throw new ValidationError("La cantidad debe ser mayor a cero");
    }

    // ── 2. C-02 FIX: Atomic stock check + reduction (prevents TOCTOU race) ──
    // Instead of: read → check → update (3 steps, race window)
    // Use: UPDATE with WHERE stock >= cantidad → 0 rows = insufficient stock
    const [updated] = await db()
      .update(repuestos)
      .set({
        stockActual: sql`${repuestos.stockActual} - ${cantidad}`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(repuestos.id, repuestoId),
          eq(repuestos.tenantSlug, tenantSlug), // T-21d/INV-05: tenant-scoped
          sql`${repuestos.stockActual} >= ${cantidad}`,  // Atomic guard: fail if insufficient
        ),
      )
      .returning();

    if (!updated) {
      // Either repuesto not found OR stock insufficient — check which
      const repuesto = await getRepuestoById(repuestoId, tenantSlug);
      throw new ValidationError(
        `Stock insuficiente. Actual: ${repuesto.stockActual}, solicitado: ${cantidad}`,
      );
    }

    // ── 3. Get current PPP for valuation (after atomic update) ──
    const ppVigente = updated.costoPromedio
      ? Number(updated.costoPromedio)
      : 0;
    const costoTotalSalida = ppVigente * cantidad;

    // ── 4. Stock already reduced atomically in step 2 ──
    const stockAnterior = Number(updated.stockActual) + Number(cantidad);

    // ── 5. Generate accounting entry via InventarioConfigurator ──
    let asientoId: string | null = null;
    // Id único por evento: el asiento usa `movimiento_stock:<id>` como
    // documentoRef y el índice único parcial (documento_ref, modulo_origen)
    // rechazaría la 2ª salida del mismo repuesto si usáramos su id (T-44).
    const movimientoId = randomUUID();
    if (costoTotalSalida > 0) {
      const result = await inventarioConfigurator.onSalidaStock({
        tenantSlug,
        movimientoId,
        repuestoDescripcion: updated.descripcion,
        cantidad,
        costoTotal: costoTotalSalida,
        ordenTrabajoId: ordenTrabajoId ?? undefined,
        centroCostoId: centroCostoId ?? undefined,
        motivo: motivo ?? "uso en OT",
      });
      if (result.success && result.asientoId) {
        asientoId = result.asientoId;
      }
    }

    // ── 6. Persist stock movement ──
    const [movimiento] = await db()
      .insert(stockMovements)
      .values({
        id: movimientoId,
        repuestoId,
        tipo: "SALIDA",
        cantidad,
        stockAnterior,
        stockPosterior: updated.stockActual,
        costoUnitario: ppVigente > 0 ? String(ppVigente) : null,
        costoTotal: costoTotalSalida > 0 ? String(costoTotalSalida) : null,
        ordenTrabajoId: ordenTrabajoId ?? null,
        asientoId,
        motivo,
        observaciones: observaciones ?? null,
        tenantSlug,
      })
      .returning();

    // ── T-33: trazabilidad del movimiento (quién / cuándo / antes-después) ──
    await logEntityAudit({
      tenantSlug,
      accion: "CREATE",
      entidad: "stock_movements",
      entidadId: movimiento.id,
      valorAnterior: { repuestoId, stockActual: stockAnterior },
      valorNuevo: {
        repuestoId,
        stockActual: updated.stockActual,
        cantidad,
        tipo: "SALIDA",
        asientoId,
      },
      descripcion: `Salida de stock: ${cantidad} × ${updated.descripcion}`,
    });

    // ── 7. Check reorder point ──
    if (
      updated.puntoReorden !== null &&
      updated.stockActual <= updated.puntoReorden
    ) {
      // Check if there's already a pending alert for this repuesto
      const existingAlert = await db()
        .select({ id: reorderAlerts.id })
        .from(reorderAlerts)
        .where(
          and(
            eq(reorderAlerts.repuestoId, repuestoId),
            eq(reorderAlerts.estado, "PENDIENTE"),
            eq(reorderAlerts.tenantSlug, tenantSlug),
          ),
        )
        .limit(1);

      if (existingAlert.length === 0) {
        await db().insert(reorderAlerts).values({
          repuestoId,
          stockActual: updated.stockActual,
          puntoReorden: updated.puntoReorden,
          estado: "PENDIENTE",
          tenantSlug,
        });
      }
    }

    // ── 8. Return DTO ──
    return {
      repuesto: {
        id: updated.id,
        codigo: updated.codigo,
        descripcion: updated.descripcion,
        stockActual: updated.stockActual,
        stockAnterior,
      },
      movimiento: {
        id: movimiento.id,
        tipo: "salida",
        cantidad,
        motivo,
        ordenTrabajoId: ordenTrabajoId ?? null,
        costoUnitario: ppVigente > 0 ? ppVigente : null,
        asientoId,
      },
    };
  });
}

/**
 * Records a stock input (ingreso) — increases stock_actual.
 *
 * Integration:
 *   - Recalculates PPP if costoUnitario is provided
 *   - Generates double-entry journal entry (Inventario ← Proveedores)
 *   - Persists movement in stock_movements table
 *
 * @param id - Repuesto UUID
 * @param data - Stock input payload
 * @param tenantSlug - Tenant identifier from request header
 * @returns Updated repuesto + movement record
 * @throws {ValidationError} If cantidad <= 0 or exceeds stock_maximo
 * @throws {NotFoundError} If repuesto not found
 */
export async function ingresoStock(
  id: string,
  data: IngresoStockRequest,
  tenantSlug: string,
): Promise<StockMovimientoResponse> {
  return withTransaction(async () => {
    const {
      cantidad,
      motivo,
      costoUnitario,
      observaciones,
      purchaseOrderId,
      proveedorNombre,
    } = data;

    // ── 1. Validate cantidad ──
    if (!cantidad || cantidad <= 0) {
      throw new ValidationError("La cantidad debe ser mayor a cero");
    }

    // ── 2. Fetch repuesto (tenant-scoped) and check max stock ──
    const repuesto = await getRepuestoById(id, tenantSlug);
    const stockAnterior = repuesto.stockActual;

    if (repuesto.stockMaximo !== null) {
      const nuevoStock = repuesto.stockActual + cantidad;
      if (nuevoStock > repuesto.stockMaximo) {
        throw new ValidationError(
          `El stock superaría el máximo permitido (${repuesto.stockMaximo}). ` +
          `Actual: ${repuesto.stockActual}, agregando: ${cantidad}`,
        );
      }
    }

    // ── 4. Update stock and optionally recalculate PPP ──
    if (costoUnitario && costoUnitario > 0) {
      // Recalculate PPP via costing service (also increases stock)
      await recalcularPPP(
        id,
        cantidad,
        costoUnitario,
        tenantSlug,
      );

      // Stock was already increased by recalcularPPP
      const [updated] = await db()
        .select()
        .from(repuestos)
        .where(and(eq(repuestos.id, id), eq(repuestos.tenantSlug, tenantSlug)))
        .limit(1);

      if (!updated) throw new NotFoundError(`Repuesto ${id} no encontrado`);

      const costoUnitarioActual = costoUnitario!; // Non-null: verified > 0 above

      // Try to generate journal entry via InventarioConfigurator
      let asientoId: string | null = null;
      const costoTotalEntrada = costoUnitarioActual * cantidad;
      // Id único por evento — ver nota en salidaStock (T-44): evita 23505
      // en uq_asientos_documento_ref_contabilizado con la 2ª entrada.
      const movimientoId = randomUUID();
      if (costoTotalEntrada > 0) {
        const result = await inventarioConfigurator.onEntradaStock({
          tenantSlug,
          movimientoId,
          repuestoDescripcion: repuesto.descripcion,
          cantidad,
          costoTotal: costoTotalEntrada,
          tipoEntrada: "COMPRA",
          proveedorNombre: proveedorNombre ?? "",
        });
        if (result.success && result.asientoId) {
          asientoId = result.asientoId;
        }
      }

      // Update the movement with the asiento ID
      const [movimiento] = await db()
        .insert(stockMovements)
        .values({
          id: movimientoId,
          repuestoId: id,
          tipo: "ENTRADA",
          cantidad,
          stockAnterior,
          stockPosterior: updated.stockActual,
          costoUnitario: String(costoUnitarioActual),
          costoTotal: String(costoTotalEntrada),
          asientoId,
          motivo,
          observaciones: observaciones ?? null,
          purchaseOrderId: purchaseOrderId ?? null,
          tenantSlug,
        })
        .returning();

      // ── T-33: trazabilidad del movimiento (quién / cuándo / antes-después) ──
      await logEntityAudit({
        tenantSlug,
        accion: "CREATE",
        entidad: "stock_movements",
        entidadId: movimiento.id,
        valorAnterior: { repuestoId: id, stockActual: stockAnterior },
        valorNuevo: {
          repuestoId: id,
          stockActual: updated.stockActual,
          cantidad,
          tipo: "ENTRADA",
          costoUnitario: costoUnitarioActual,
          asientoId,
        },
        descripcion: `Entrada de stock: ${cantidad} × ${repuesto.descripcion}`,
      });

      return {
        repuesto: {
          id: updated.id,
          codigo: updated.codigo,
          descripcion: updated.descripcion,
          stockActual: updated.stockActual,
          stockAnterior,
        },
      movimiento: {
        id: movimiento.id,
        tipo: "entrada",
        cantidad,
        motivo,
        ordenTrabajoId: null,
        costoUnitario: costoUnitarioActual,
        asientoId,
      },
      };
    }

    // ── 5. Simple stock increase (no PPP change, no asiento) ──
    const [updated] = await db()
      .update(repuestos)
      .set({
        stockActual: sql`${repuestos.stockActual} + ${cantidad}`,
        updatedAt: sql`NOW()`,
      })
      .where(and(eq(repuestos.id, id), eq(repuestos.tenantSlug, tenantSlug)))
      .returning();

    // Persist movement
    const [movimiento] = await db()
      .insert(stockMovements)
      .values({
        repuestoId: id,
        tipo: "ENTRADA",
        cantidad,
        stockAnterior,
        stockPosterior: updated.stockActual,
        costoUnitario: null,
        costoTotal: null,
        motivo,
        observaciones: observaciones ?? null,
        purchaseOrderId: purchaseOrderId ?? null,
        tenantSlug,
      })
      .returning();

    // ── T-33: trazabilidad del movimiento (quién / cuándo / antes-después) ──
    await logEntityAudit({
      tenantSlug,
      accion: "CREATE",
      entidad: "stock_movements",
      entidadId: movimiento.id,
      valorAnterior: { repuestoId: id, stockActual: stockAnterior },
      valorNuevo: {
        repuestoId: id,
        stockActual: updated.stockActual,
        cantidad,
        tipo: "ENTRADA",
      },
      descripcion: `Entrada de stock: ${cantidad} × ${repuesto.descripcion}`,
    });

    return {
      repuesto: {
        id: updated.id,
        codigo: updated.codigo,
        descripcion: updated.descripcion,
        stockActual: updated.stockActual,
        stockAnterior,
      },
      movimiento: {
        id: movimiento.id,
        tipo: "entrada",
        cantidad,
        motivo,
        ordenTrabajoId: null,
        costoUnitario: null,
        // Sin costo unitario no hay re-cálculo de PPP ni asiento contable.
        asientoId: null,
      },
    };
  });
}

/**
 * Lists stock movements with optional filtering.
 *
 * @param options - Filter and pagination options
 * @returns Paginated list of stock movements
 */
export async function listStockMovements(options: {
  repuestoId?: string;
  tipo?: string;
  ordenTrabajoId?: string;
  page?: number;
  limit?: number;
  tenantSlug: string;
}) {
  const {
    repuestoId,
    tipo,
    ordenTrabajoId,
    page = 1,
    limit = 50,
    tenantSlug,
  } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];

  // T-21d: movements are tenant-scoped — history never leaks cross-tenant
  conditions.push(eq(stockMovements.tenantSlug, tenantSlug));

  if (repuestoId) {
    conditions.push(eq(stockMovements.repuestoId, repuestoId));
  }
  if (tipo) {
    conditions.push(eq(stockMovements.tipo, tipo));
  }
  if (ordenTrabajoId) {
    conditions.push(eq(stockMovements.ordenTrabajoId, ordenTrabajoId));
  }

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(stockMovements)
    .where(whereClause);

  const items = await db()
    .select()
    .from(stockMovements)
    .where(whereClause)
    .orderBy(desc(stockMovements.createdAt))
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
