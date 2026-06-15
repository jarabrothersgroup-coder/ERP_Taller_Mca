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

import { db } from "../../../shared/database/drizzle.js";
import {
  repuestos,
  stockMovements,
  reorderAlerts,
  inventoryAccountsMap,
} from "../schema/index.js";
import { eq, and, or, sql, desc, count } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../shared/errors/app-error.js";
import { recalcularPPP } from "./costing.service.js";
import { emit } from "../../finance/services/index.js";
import type {
  CreateRepuestoRequest,
  UpdateRepuestoRequest,
  SalidaStockRequest,
  IngresoStockRequest,
  StockMovimientoResponse,
} from "../types.js";

/**
 * Creates a new spare part (repuesto) in inventory.
 *
 * @param data - The spare part payload
 * @returns The created repuesto record
 * @throws {ConflictError} If the codigo or codigo_barras already exists
 */
export async function createRepuesto(
  data: CreateRepuestoRequest,
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
 * @returns The repuesto record
 * @throws {NotFoundError} If the repuesto is not found
 */
export async function getRepuestoById(id: string) {
  const [repuesto] = await db()
    .select()
    .from(repuestos)
    .where(eq(repuestos.id, id))
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
}) {
  const { search, categoria, activo, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  // ── Build WHERE clause dynamically ──
  const conditions: ReturnType<typeof eq>[] = [];

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
) {
  // ── 1. Verify existence ──
  const existing = await getRepuestoById(id);

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
    .where(eq(repuestos.id, id))
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
  const { repuestoId, cantidad, motivo, ordenTrabajoId, centroCostoId, observaciones } = data;

  // ── 1. Validate cantidad ──
  if (!cantidad || cantidad <= 0) {
    throw new ValidationError("La cantidad debe ser mayor a cero");
  }

  // ── 2. Fetch repuesto and check stock ──
  const repuesto = await getRepuestoById(repuestoId);

  if (repuesto.stockActual < cantidad) {
    throw new ValidationError(
      `Stock insuficiente. Actual: ${repuesto.stockActual}, solicitado: ${cantidad}`,
    );
  }

  // ── 3. Get current PPP for valuation ──
  const ppVigente = repuesto.costoPromedio
    ? Number(repuesto.costoPromedio)
    : 0;
  const costoTotalSalida = ppVigente * cantidad;

  // ── 4. Atomic stock reduction ──
  const stockAnterior = repuesto.stockActual;

  const [updated] = await db()
    .update(repuestos)
    .set({
      stockActual: sql`${repuestos.stockActual} - ${cantidad}`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(repuestos.id, repuestoId))
    .returning();

  // ── 5. Look up accounts for journal entry ──
  let asientoId: string | null = null;
  try {
    const accountsMap = await db()
      .select()
      .from(inventoryAccountsMap)
      .where(
        and(
          eq(inventoryAccountsMap.categoria, repuesto.categoria ?? "*"),
          eq(inventoryAccountsMap.tenantSlug, tenantSlug),
        ),
      )
      .limit(1);

    if (accountsMap.length > 0 && costoTotalSalida > 0) {
      const result = await emit({
        tenantSlug,
        tipo: "CONSUMO_STOCK",
        fecha: new Date(),
        referenciaId: repuestoId,
        referenciaTipo: "movimiento_stock",
        descripcion: `Salida de stock: ${repuesto.descripcion} x${cantidad} (PPP: ${ppVigente})`,
        ordenTrabajoId: ordenTrabajoId ?? null,
        lineas: [
          {
            cuentaId: accountsMap[0]!.cuentaGastoId,
            debe: costoTotalSalida,
            centroCostoId: centroCostoId ?? null,
            ordenTrabajoId: ordenTrabajoId ?? null,
          },
          {
            cuentaId: accountsMap[0]!.cuentaInventarioId,
            haber: costoTotalSalida,
          },
        ],
      });
      if (result.success) {
        asientoId = result.asientoId!;
      }
    }
  } catch {
    // Journal entry failure should not block stock movement.
    // Log and continue — accounting can be reconciled later.
    console.warn(
      `[stock] No se generó asiento contable para salida ${repuestoId}: sin mapping contable`,
    );
  }

  // ── 6. Persist stock movement ──
  const [movimiento] = await db()
    .insert(stockMovements)
    .values({
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

  // ── 7. Check reorder point ──
  if (
    repuesto.puntoReorden !== null &&
    updated.stockActual <= repuesto.puntoReorden
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
        puntoReorden: repuesto.puntoReorden,
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
    },
  };
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
  const { cantidad, motivo, costoUnitario, observaciones } = data;

  // ── 1. Validate cantidad ──
  if (!cantidad || cantidad <= 0) {
    throw new ValidationError("La cantidad debe ser mayor a cero");
  }

  // ── 2. Fetch repuesto and check max stock ──
  const repuesto = await getRepuestoById(id);
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
      .where(eq(repuestos.id, id))
      .limit(1);

    if (!updated) throw new NotFoundError(`Repuesto ${id} no encontrado`);

    // Try to generate journal entry
    let asientoId: string | null = null;
    try {
      const accountsMap = await db()
        .select()
        .from(inventoryAccountsMap)
        .where(
          and(
            eq(inventoryAccountsMap.categoria, repuesto.categoria ?? "*"),
            eq(inventoryAccountsMap.tenantSlug, tenantSlug),
          ),
        )
        .limit(1);

      if (accountsMap.length > 0) {
        const result = await emit({
          tenantSlug,
          tipo: "COMPRA",
          fecha: new Date(),
          referenciaId: id,
          referenciaTipo: "movimiento_stock",
          descripcion: `Entrada de stock: ${repuesto.descripcion} x${cantidad} (costo: ${costoUnitario})`,
          lineas: [
            {
              cuentaId: accountsMap[0]!.cuentaInventarioId,
              debe: costoUnitario * cantidad,
            },
            {
              cuentaId: accountsMap[0]!.cuentaProveedorId ??
                accountsMap[0]!.cuentaGastoId,
              haber: costoUnitario * cantidad,
            },
          ],
        });
        if (result.success) {
          asientoId = result.asientoId!;
        }

        // Update the movement with the asiento ID
        const [movimiento] = await db()
          .insert(stockMovements)
          .values({
            repuestoId: id,
            tipo: "ENTRADA",
            cantidad,
            stockAnterior,
            stockPosterior: updated.stockActual,
            costoUnitario: String(costoUnitario),
            costoTotal: String(costoUnitario * cantidad),
            asientoId,
            motivo,
            observaciones: observaciones ?? null,
            tenantSlug,
          })
          .returning();

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
            costoUnitario,
          },
        };
      }
    } catch {
      console.warn(
        `[stock] No se generó asiento contable para ingreso ${id}: sin mapping contable`,
      );
    }

    // Return without asiento
    const [movimientoNoAcct] = await db()
      .insert(stockMovements)
      .values({
        repuestoId: id,
        tipo: "ENTRADA",
        cantidad,
        stockAnterior,
        stockPosterior: updated.stockActual,
        costoUnitario: String(costoUnitario),
        costoTotal: String(costoUnitario * cantidad),
        motivo,
        observaciones: observaciones ?? null,
        tenantSlug,
      })
      .returning();

    return {
      repuesto: {
        id: updated.id,
        codigo: updated.codigo,
        descripcion: updated.descripcion,
        stockActual: updated.stockActual,
        stockAnterior,
      },
      movimiento: {
        id: movimientoNoAcct.id,
        tipo: "entrada",
        cantidad,
        motivo,
        ordenTrabajoId: null,
        costoUnitario,
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
    .where(eq(repuestos.id, id))
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
      tenantSlug,
    })
    .returning();

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
    },
  };
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
}) {
  const {
    repuestoId,
    tipo,
    ordenTrabajoId,
    page = 1,
    limit = 50,
  } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];

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
