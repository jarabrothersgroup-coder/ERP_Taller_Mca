/**
 * Purchase Order Service — CRUD manual de Órdenes de Compra (T-44 · INV-03).
 *
 * Antes de este módulo solo existía la generación automática
 * (`auto-po.service`): sin CRUD manual, sin edición y sin recepción.
 * Este service cubre el flujo completo de la UC de compras:
 *
 *   CREAR     → OC en BORRADOR con items y total calculado
 *   EDITAR    → proveedor/fechas/notas/items (mientras no haya recepción)
 *   RECIBIR   → ingreso de stock con recálculo PPP + asiento contable
 *               (INVENTARIO.ENTRADA/COMPRA: Debe Inventario · Haber Proveedor)
 *               y vinculación del movimiento a la OC (purchase_order_id)
 *   CANCELAR  → CANCELADA (histórico preservado; destructivo → manager+)
 *
 * TODO ocurre dentro de UNA transacción (`withTransaction`): o se recibe la
 * OC completa con su stock y su asiento, o no cambió nada (T-31).
 *
 * @module inventory/services/purchase-order.service
 */

import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { withTransaction } from "../../../shared/database/transaction.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../shared/errors/app-error.js";
import { resolveAuditActor, isRealActor } from "../../../shared/audit/audit-context.js";
import {
  repuestos,
  purchaseOrders,
  purchaseOrderItems,
} from "../schema/index.js";
import { ingresoStock } from "./stock.service.js";

// ─── Types ────────────────────────────────────

export interface PurchaseOrderItemDTO {
  id: string;
  repuestoId: string;
  cantidad: number;
  cantidadRecibida: number;
  costoUnitario: number;
  subtotal: number;
  /** Datos del repuesto (join, solo lectura) */
  codigo?: string | null;
  descripcion?: string | null;
}

export interface PurchaseOrderDTO {
  id: string;
  numero: string;
  proveedor: string;
  estado: string;
  fechaEmision: string;
  fechaEsperada: string | null;
  fechaRecepcion: string | null;
  totalOc: number;
  notas: string | null;
  tenantSlug: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItemDTO[];
}

export interface CreatePurchaseOrderManualInput {
  proveedor: string;
  fechaEsperada?: string | null;
  notas?: string | null;
  estado?: string;
  items: Array<{
    repuestoId: string;
    cantidad: number;
    costoUnitario: number;
  }>;
}

export interface UpdatePurchaseOrderInput {
  proveedor?: string;
  fechaEsperada?: string | null;
  notas?: string | null;
  estado?: string;
  items?: Array<{
    repuestoId: string;
    cantidad: number;
    costoUnitario: number;
  }>;
}

export interface ReceivePurchaseOrderInput {
  items: Array<{ itemId: string; cantidadRecibida: number }>;
}

export interface ReceivePurchaseOrderResult {
  oc: PurchaseOrderDTO;
  recibido: Array<{
    itemId: string;
    repuestoId: string;
    cantidad: number;
    movimientoId: string;
    asientoId: string | null;
  }>;
  estado: string;
}

/** Estados editables del ciclo de vida (CHECK 0013). */
const ESTADOS_OC = [
  "BORRADOR",
  "PENDIENTE",
  "APROBADA",
  "ENVIADA",
  "RECIBIDA_PARCIAL",
  "RECIBIDA",
  "COMPLETADA",
  "CANCELADA",
] as const;

/** Estados desde los cuales la OC ya no admite edición de items. */
const ESTADOS_CERRADOS = ["RECIBIDA", "RECIBIDA_PARCIAL", "COMPLETADA", "CANCELADA"];

// ─── Helpers ──────────────────────────────────

/** Convierte una fecha ISO a `Date`, o `null` si viene vacía. */
function parseFecha(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`Fecha inválida: ${value}`);
  }
  return d;
}

function toDTO(
  po: typeof purchaseOrders.$inferSelect,
  items: Array<{
    id: string;
    repuestoId: string;
    cantidad: number;
    cantidadRecibida: number;
    costoUnitario: string;
    subtotal: string;
    codigo?: string | null;
    descripcion?: string | null;
  }>,
): PurchaseOrderDTO {
  return {
    id: po.id,
    numero: po.numero,
    proveedor: po.proveedor,
    estado: po.estado,
    fechaEmision: po.fechaEmision.toISOString(),
    fechaEsperada: po.fechaEsperada ? po.fechaEsperada.toISOString() : null,
    fechaRecepcion: po.fechaRecepcion ? po.fechaRecepcion.toISOString() : null,
    totalOc: Number(po.totalOc ?? 0),
    notas: po.notas,
    tenantSlug: po.tenantSlug,
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      repuestoId: i.repuestoId,
      cantidad: i.cantidad,
      cantidadRecibida: i.cantidadRecibida,
      costoUnitario: Number(i.costoUnitario),
      subtotal: Number(i.subtotal),
      codigo: i.codigo ?? null,
      descripcion: i.descripcion ?? null,
    })),
  };
}

/**
 * Genera el número secuencial de OC: OC-YYYY-NNNN (por tenant).
 * Misma fórmula que auto-po.service — un solo espacio de numeración.
 */
async function generatePONumber(tenantSlug: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OC-${year}-`;

  const [lastPO] = await db()
    .select({ numero: purchaseOrders.numero })
    .from(purchaseOrders)
    .where(
      and(
        like(purchaseOrders.numero, `${prefix}%`),
        eq(purchaseOrders.tenantSlug, tenantSlug),
      ),
    )
    .orderBy(desc(purchaseOrders.numero))
    .limit(1);

  if (!lastPO) return `${prefix}0001`;
  const lastNum = parseInt(lastPO.numero.split("-")[2] || "0", 10);
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

/** Carga los items de una OC con datos del repuesto (join). */
async function loadItems(ordenCompraId: string, tenantSlug: string) {
  return db()
    .select({
      id: purchaseOrderItems.id,
      repuestoId: purchaseOrderItems.repuestoId,
      cantidad: purchaseOrderItems.cantidad,
      cantidadRecibida: purchaseOrderItems.cantidadRecibida,
      costoUnitario: purchaseOrderItems.costoUnitario,
      subtotal: purchaseOrderItems.subtotal,
      codigo: sql<string | null>`(SELECT codigo FROM repuestos r WHERE r.id = ${purchaseOrderItems.repuestoId})`,
      descripcion: sql<string | null>`(SELECT descripcion FROM repuestos r WHERE r.id = ${purchaseOrderItems.repuestoId})`,
    })
    .from(purchaseOrderItems)
    .where(
      and(
        eq(purchaseOrderItems.ordenCompraId, ordenCompraId),
        eq(purchaseOrderItems.tenantSlug, tenantSlug),
      ),
    );
}

/** Recalcula totalOc = Σ subtotales de los items. */
function calcularTotal(
  items: Array<{ cantidad: number; costoUnitario: number }>,
): number {
  return items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0);
}

// ─── READ ─────────────────────────────────────

/**
 * Lista las OC del tenant (con items), opcionalmente filtradas.
 *
 * @param tenantSlug - Tenant
 * @param filters - estado / proveedor / search
 */
export async function listPurchaseOrders(
  tenantSlug: string,
  filters: { estado?: string; proveedor?: string; search?: string } = {},
): Promise<PurchaseOrderDTO[]> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(purchaseOrders.tenantSlug, tenantSlug),
  ];
  if (filters.estado) {
    conditions.push(eq(purchaseOrders.estado, filters.estado));
  }
  if (filters.proveedor) {
    conditions.push(eq(purchaseOrders.proveedor, filters.proveedor));
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      sql`(${purchaseOrders.proveedor} ILIKE ${like} OR ${purchaseOrders.numero} ILIKE ${like} OR ${purchaseOrders.notas} ILIKE ${like})`,
    );
  }

  const rows = await db()
    .select()
    .from(purchaseOrders)
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(200);

  const result: PurchaseOrderDTO[] = [];
  for (const po of rows) {
    result.push(toDTO(po, await loadItems(po.id, tenantSlug)));
  }
  return result;
}

/**
 * Obtiene una OC por id con sus items (404 cross-tenant).
 */
export async function getPurchaseOrder(
  id: string,
  tenantSlug: string,
): Promise<PurchaseOrderDTO> {
  const [po] = await db()
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!po) {
    throw new NotFoundError(`Orden de compra ${id} no encontrada`);
  }
  return toDTO(po, await loadItems(po.id, tenantSlug));
}

// ─── CREATE ───────────────────────────────────

/**
 * Crea una OC manual (estado inicial BORRADOR o el indicado).
 *
 * Items validados contra el catálogo (tenant-scoped); total calculado.
 */
export async function createPurchaseOrder(
  data: CreatePurchaseOrderManualInput,
  tenantSlug: string,
): Promise<PurchaseOrderDTO> {
  if (!data.proveedor?.trim()) {
    throw new ValidationError("El proveedor es obligatorio");
  }
  if (!data.items || data.items.length === 0) {
    throw new ValidationError("La OC debe tener al menos un item");
  }
  const estado = data.estado ?? "BORRADOR";
  if (!(ESTADOS_OC as readonly string[]).includes(estado)) {
    throw new ValidationError(`Estado inválido: ${estado}`);
  }

  for (const item of data.items) {
    if (!item.cantidad || item.cantidad <= 0) {
      throw new ValidationError("La cantidad de cada item debe ser mayor a cero");
    }
    if (item.costoUnitario < 0) {
      throw new ValidationError("El costo unitario no puede ser negativo");
    }
  }

  return withTransaction(async () => {
    // Los repuestos deben pertenecer al tenant
    const repuestoIds = [...new Set(data.items.map((i) => i.repuestoId))];
    const existentes = await db()
      .select({ id: repuestos.id })
      .from(repuestos)
      .where(
        and(
          inArray(repuestos.id, repuestoIds),
          eq(repuestos.tenantSlug, tenantSlug),
        ),
      );
    const validos = new Set(existentes.map((r) => r.id));
    const faltantes = repuestoIds.filter((id) => !validos.has(id));
    if (faltantes.length > 0) {
      throw new NotFoundError(
        `Repuesto(s) no encontrado(s) en este tenant: ${faltantes.join(", ")}`,
      );
    }

    const actor = resolveAuditActor();
    const numero = await generatePONumber(tenantSlug);
    const total = calcularTotal(data.items);

    const [po] = await db()
      .insert(purchaseOrders)
      .values({
        numero,
        proveedor: data.proveedor.trim(),
        estado,
        fechaEsperada: parseFecha(data.fechaEsperada),
        notas: data.notas ?? null,
        totalOc: String(total),
        usuarioId: isRealActor(actor.usuarioId) ? actor.usuarioId : null,
        tenantSlug,
      })
      .returning();

    for (const item of data.items) {
      await db()
        .insert(purchaseOrderItems)
        .values({
          ordenCompraId: po.id,
          repuestoId: item.repuestoId,
          cantidad: item.cantidad,
          costoUnitario: String(item.costoUnitario),
          subtotal: String(item.cantidad * item.costoUnitario),
          tenantSlug,
        });
    }

    return toDTO(po, await loadItems(po.id, tenantSlug));
  });
}

// ─── UPDATE (edición manual) ──────────────────

/**
 * Edita una OC: proveedor, fechas, notas, estado y (opcionalmente) items.
 *
 * Restricciones:
 *   - No se edita una OC recibida/cancelada (409).
 *   - Los items solo se reemplazan si ninguna fila fue recibida (409).
 *   - `estado` solo admite valores del ciclo de vida y no puede saltar a
 *     RECIBIDA* (eso es exclusivo del flujo de recepción).
 */
export async function updatePurchaseOrder(
  id: string,
  data: UpdatePurchaseOrderInput,
  tenantSlug: string,
): Promise<PurchaseOrderDTO> {
  return withTransaction(async () => {
    const [po] = await db()
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, id),
          eq(purchaseOrders.tenantSlug, tenantSlug),
        ),
      )
      .limit(1);

    if (!po) {
      throw new NotFoundError(`Orden de compra ${id} no encontrada`);
    }
    if (ESTADOS_CERRADOS.includes(po.estado)) {
      throw new ConflictError(
        `La OC ${po.numero} está ${po.estado} y ya no admite edición`,
      );
    }

    if (data.estado !== undefined) {
      if (!(ESTADOS_OC as readonly string[]).includes(data.estado)) {
        throw new ValidationError(`Estado inválido: ${data.estado}`);
      }
      if (data.estado.startsWith("RECIBIDA") || data.estado === "COMPLETADA") {
        throw new ValidationError(
          "Use POST /inventory/purchase-orders/:id/receive para recepcionar",
        );
      }
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.proveedor !== undefined) {
      if (!data.proveedor.trim()) {
        throw new ValidationError("El proveedor no puede quedar vacío");
      }
      patch.proveedor = data.proveedor.trim();
    }
    if (data.fechaEsperada !== undefined) {
      patch.fechaEsperada = parseFecha(data.fechaEsperada);
    }
    if (data.notas !== undefined) patch.notas = data.notas;
    if (data.estado !== undefined) patch.estado = data.estado;

    // Reemplazo de items: solo si no se recibió nada aún
    if (data.items !== undefined) {
      if (data.items.length === 0) {
        throw new ValidationError("La OC debe tener al menos un item");
      }
      const actuales = await db()
        .select({ recibida: purchaseOrderItems.cantidadRecibida })
        .from(purchaseOrderItems)
        .where(
          and(
            eq(purchaseOrderItems.ordenCompraId, po.id),
            eq(purchaseOrderItems.tenantSlug, tenantSlug),
          ),
        );
      if (actuales.some((i) => i.recibida > 0)) {
        throw new ConflictError(
          "La OC ya tiene recepciones parciales: no se pueden reemplazar los items",
        );
      }

      for (const item of data.items) {
        if (!item.cantidad || item.cantidad <= 0) {
          throw new ValidationError("La cantidad de cada item debe ser mayor a cero");
        }
        if (item.costoUnitario < 0) {
          throw new ValidationError("El costo unitario no puede ser negativo");
        }
      }

      await db()
        .delete(purchaseOrderItems)
        .where(
          and(
            eq(purchaseOrderItems.ordenCompraId, po.id),
            eq(purchaseOrderItems.tenantSlug, tenantSlug),
          ),
        );

      for (const item of data.items) {
        await db()
          .insert(purchaseOrderItems)
          .values({
            ordenCompraId: po.id,
            repuestoId: item.repuestoId,
            cantidad: item.cantidad,
            costoUnitario: String(item.costoUnitario),
            subtotal: String(item.cantidad * item.costoUnitario),
            tenantSlug,
          });
      }
      patch.totalOc = String(calcularTotal(data.items));
    }

    const [updated] = await db()
      .update(purchaseOrders)
      .set(patch)
      .where(
        and(
          eq(purchaseOrders.id, id),
          eq(purchaseOrders.tenantSlug, tenantSlug),
        ),
      )
      .returning();

    return toDTO(updated, await loadItems(updated.id, tenantSlug));
  });
}

// ─── RECEIVE (recepción → stock + asiento) ────

/**
 * Recepciona items de una OC: ingresa stock (PPP + movimiento + asiento
 * INVENTARIO.ENTRADA/COMPRA) y vincula cada movimiento a la OC.
 *
 * Transición de estado:
 *   total recibido < total pedido → RECIBIDA_PARCIAL
 *   total recibido = total pedido → RECIBIDA (+ fechaRecepcion)
 *
 * Atómica: un fallo (stock máximo, repuesto inexistente, asiento) revierte
 * items, stock, movimientos y asiento en su totalidad.
 *
 * @param id - OC a recepcionar
 * @param data - Items recibidos en esta tanda (cantidadRecibida)
 * @param tenantSlug - Tenant
 */
export async function receivePurchaseOrder(
  id: string,
  data: ReceivePurchaseOrderInput,
  tenantSlug: string,
): Promise<ReceivePurchaseOrderResult> {
  if (!data.items || data.items.length === 0) {
    throw new ValidationError("Debe indicar los items recibidos");
  }

  return withTransaction(async () => {
    const [po] = await db()
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, id),
          eq(purchaseOrders.tenantSlug, tenantSlug),
        ),
      )
      .limit(1);

    if (!po) {
      throw new NotFoundError(`Orden de compra ${id} no encontrada`);
    }
    if (po.estado === "CANCELADA") {
      throw new ConflictError(`La OC ${po.numero} está cancelada`);
    }
    if (po.estado === "RECIBIDA" || po.estado === "COMPLETADA") {
      throw new ConflictError(`La OC ${po.numero} ya fue recepcionada completa`);
    }

    const recibido: ReceivePurchaseOrderResult["recibido"] = [];

    for (const req of data.items) {
      const qty = Number(req.cantidadRecibida);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new ValidationError("La cantidad recibida debe ser un entero > 0");
      }

      // Item de ESTA OC + guard atómico de pendiente (previene doble recepción)
      const [item] = await db()
        .select()
        .from(purchaseOrderItems)
        .where(
          and(
            eq(purchaseOrderItems.id, req.itemId),
            eq(purchaseOrderItems.ordenCompraId, po.id),
            eq(purchaseOrderItems.tenantSlug, tenantSlug),
          ),
        )
        .limit(1);
      if (!item) {
        throw new NotFoundError(`Item ${req.itemId} no pertenece a esta OC`);
      }

      const [upd] = await db()
        .update(purchaseOrderItems)
        .set({
          cantidadRecibida: sql`${purchaseOrderItems.cantidadRecibida} + ${qty}`,
        })
        .where(
          and(
            eq(purchaseOrderItems.id, item.id),
            eq(purchaseOrderItems.tenantSlug, tenantSlug),
            sql`${purchaseOrderItems.cantidadRecibida} + ${qty} <= ${purchaseOrderItems.cantidad}`,
          ),
        )
        .returning({
          cantidadRecibida: purchaseOrderItems.cantidadRecibida,
          cantidad: purchaseOrderItems.cantidad,
        });

      if (!upd) {
        const pendiente = item.cantidad - item.cantidadRecibida;
        throw new ValidationError(
          pendiente <= 0
            ? `El item ${item.id} ya fue recepcionado completo`
            : `Solo quedan ${pendiente} unidades pendientes del item ${item.id} (pedido: ${qty})`,
        );
      }

      // Ingreso de stock con PPP + asiento + movimiento vinculado a la OC.
      // Si repuesto supera stock_maximo o el asiento falla → rollback total.
      const resultado = await ingresoStock(
        item.repuestoId,
        {
          cantidad: qty,
          motivo: "Compra",
          costoUnitario: Number(item.costoUnitario),
          observaciones: `Recepción OC ${po.numero}`,
          purchaseOrderId: po.id,
          proveedorNombre: po.proveedor,
        },
        tenantSlug,
      );

      recibido.push({
        itemId: item.id,
        repuestoId: item.repuestoId,
        cantidad: qty,
        movimientoId: resultado.movimiento.id,
        asientoId: resultado.movimiento.asientoId ?? null,
      });
    }

    // Transición de estado según el acumulado
    const items = await db()
      .select({
        cantidad: purchaseOrderItems.cantidad,
        cantidadRecibida: purchaseOrderItems.cantidadRecibida,
      })
      .from(purchaseOrderItems)
      .where(
        and(
          eq(purchaseOrderItems.ordenCompraId, po.id),
          eq(purchaseOrderItems.tenantSlug, tenantSlug),
        ),
      );

    const completa =
      items.length > 0 && items.every((i) => i.cantidadRecibida >= i.cantidad);
    const nuevoEstado = completa ? "RECIBIDA" : "RECIBIDA_PARCIAL";

    const [updated] = await db()
      .update(purchaseOrders)
      .set({
        estado: nuevoEstado,
        ...(completa ? { fechaRecepcion: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(purchaseOrders.id, po.id),
          eq(purchaseOrders.tenantSlug, tenantSlug),
        ),
      )
      .returning();

    return {
      oc: toDTO(updated, await loadItems(po.id, tenantSlug)),
      recibido,
      estado: nuevoEstado,
    };
  });
}

// ─── CANCEL / DELETE ──────────────────────────

/**
 * Cancela una OC (soft: estado CANCELADA, histórico preservado).
 * No se puede cancelar una OC ya recepcionada (409).
 */
export async function cancelPurchaseOrder(
  id: string,
  tenantSlug: string,
): Promise<PurchaseOrderDTO> {
  const [po] = await db()
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!po) {
    throw new NotFoundError(`Orden de compra ${id} no encontrada`);
  }
  if (po.estado === "RECIBIDA" || po.estado === "COMPLETADA") {
    throw new ConflictError(
      `La OC ${po.numero} ya fue recepcionada: no se puede cancelar`,
    );
  }
  if (po.estado === "CANCELADA") {
    return toDTO(po, await loadItems(po.id, tenantSlug));
  }

  const [updated] = await db()
    .update(purchaseOrders)
    .set({ estado: "CANCELADA", updatedAt: new Date() })
    .where(
      and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.tenantSlug, tenantSlug),
      ),
    )
    .returning();

  return toDTO(updated, await loadItems(updated.id, tenantSlug));
}

/**
 * Borra una OC — solo si está en BORRADOR y sin recepciones (hard delete;
 * los items caen en cascade). En cualquier otro caso se usa cancel.
 */
export async function deletePurchaseOrder(
  id: string,
  tenantSlug: string,
): Promise<void> {
  const po = await getPurchaseOrder(id, tenantSlug);

  if (po.estado !== "BORRADOR") {
    throw new ConflictError(
      `Solo se pueden borrar OC en BORRADOR (estado actual: ${po.estado}). Use cancel.`,
    );
  }
  if (po.items.some((i) => i.cantidadRecibida > 0)) {
    throw new ConflictError("La OC tiene recepciones parciales: no se puede borrar");
  }

  await db()
    .delete(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.tenantSlug, tenantSlug),
      ),
    );
}

/** Genera el próximo número de OC (exportado para auto-po y tests). */
export { generatePONumber };


