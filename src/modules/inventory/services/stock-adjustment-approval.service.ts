/**
 * Stock Adjustment Approval Service — multi-level approval for large adjustments.
 *
 * Large stock adjustments require supervisor approval before being applied.
 * Thresholds are configurable per tenant (default: >10 units or >₲500,000 value).
 *
 * Flow:
 *   1. User creates adjustment request (PENDIENTE)
 *   2. Supervisor reviews and approves/rejects
 *   3. On approval, stock is actually modified
 *
 * @module inventory/services/stock-adjustment-approval
 */

import { db } from "../../../shared/database/drizzle.js";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { repuestos } from "../schema/repuestos.js";
import { stockMovements } from "../schema/stock-movements.js";
import { ValidationError, NotFoundError } from "../../../shared/errors/app-error.js";

// ─── In-memory adjustment requests (schema-free for now) ──

export interface AdjustmentRequest {
  id: string;
  repuestoId: string;
  cantidad: number;
  motivo: string;
  observaciones?: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  solicitadoPor: string;
  aprobadoPor?: string;
  motivoRechazo?: string;
  createdAt: string;
  resolvedAt?: string;
}

const adjustmentStore = new Map<string, AdjustmentRequest>();

// ─── Thresholds ──

const CANTIDAD_THRESHOLD = 10;
const VALOR_THRESHOLD = 500_000;

function requiresApproval(cantidad: number, costoUnitario?: number): boolean {
  if (Math.abs(cantidad) > CANTIDAD_THRESHOLD) return true;
  if (costoUnitario && Math.abs(cantidad) * costoUnitario > VALOR_THRESHOLD) return true;
  return false;
}

// ─── Create Adjustment Request ──

export async function createAdjustmentRequest(params: {
  repuestoId: string;
  cantidad: number;
  motivo: string;
  observaciones?: string;
  solicitadoPor: string;
  costoUnitario?: number;
  tenantSlug: string;
}): Promise<AdjustmentRequest> {
  const { repuestoId, cantidad, motivo, observaciones, solicitadoPor, costoUnitario, tenantSlug } = params;

  if (!cantidad || cantidad === 0) {
    throw new ValidationError("La cantidad no puede ser cero");
  }

  // Validate repuesto exists
  const [repuesto] = await db()
    .select({ id: repuestos.id, stockActual: repuestos.stockActual })
    .from(repuestos)
    .where(and(eq(repuestos.id, repuestoId), eq(repuestos.tenantSlug, tenantSlug)))
    .limit(1);
  if (!repuesto) throw new NotFoundError(`Repuesto ${repuestoId} no encontrado`);

  // Check if adjustment would make stock negative
  const newStock = repuesto.stockActual + cantidad;
  if (newStock < 0) {
    throw new ValidationError(
      `El ajuste dejaría el stock en ${newStock} (negativo). Stock actual: ${repuesto.stockActual}`,
    );
  }

  const needsApproval = requiresApproval(cantidad, costoUnitario);
  const id = crypto.randomUUID();

  const request: AdjustmentRequest = {
    id,
    repuestoId,
    cantidad,
    motivo,
    observaciones,
    estado: needsApproval ? "PENDIENTE" : "APROBADO",
    solicitadoPor,
    createdAt: new Date().toISOString(),
  };

  adjustmentStore.set(id, request);

  // If no approval needed, apply immediately
  if (!needsApproval) {
    await applyAdjustment(request, tenantSlug);
  }

  return request;
}

// ─── Approve Adjustment ──

export async function approveAdjustment(
  id: string,
  aprobadoPor: string,
  tenantSlug: string,
): Promise<AdjustmentRequest> {
  const request = adjustmentStore.get(id);
  if (!request) throw new NotFoundError(`Solicitud de ajuste ${id} no encontrada`);
  if (request.estado !== "PENDIENTE") {
    throw new ValidationError(`La solicitud ya fue ${request.estado}`);
  }

  request.estado = "APROBADO";
  request.aprobadoPor = aprobadoPor;
  request.resolvedAt = new Date().toISOString();

  await applyAdjustment(request, tenantSlug);

  return request;
}

// ─── Reject Adjustment ──

export async function rejectAdjustment(
  id: string,
  rechazadoPor: string,
  motivoRechazo: string,
): Promise<AdjustmentRequest> {
  const request = adjustmentStore.get(id);
  if (!request) throw new NotFoundError(`Solicitud de ajuste ${id} no encontrada`);
  if (request.estado !== "PENDIENTE") {
    throw new ValidationError(`La solicitud ya fue ${request.estado}`);
  }

  request.estado = "RECHAZADO";
  request.aprobadoPor = rechazadoPor;
  request.motivoRechazo = motivoRechazo;
  request.resolvedAt = new Date().toISOString();

  return request;
}

// ─── List Pending Adjustments ──

export async function listPendingAdjustments(_tenantSlug: string): Promise<AdjustmentRequest[]> {
  return Array.from(adjustmentStore.values())
    .filter((r) => r.estado === "PENDIENTE")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Apply Adjustment (internal) ──

async function applyAdjustment(
  request: AdjustmentRequest,
  tenantSlug: string,
): Promise<void> {
  const [repuesto] = await db()
    .select({ stockActual: repuestos.stockActual })
    .from(repuestos)
    .where(eq(repuestos.id, request.repuestoId))
    .limit(1);

  if (!repuesto) throw new NotFoundError(`Repuesto ${request.repuestoId} no encontrado`);

  const stockAnterior = repuesto.stockActual;
  const stockPosterior = stockAnterior + request.cantidad;

  await db()
    .update(repuestos)
    .set({
      stockActual: sql`${repuestos.stockActual} + ${request.cantidad}`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(repuestos.id, request.repuestoId));

  await db().insert(stockMovements).values({
    repuestoId: request.repuestoId,
    tipo: "AJUSTE",
    cantidad: Math.abs(request.cantidad),
    stockAnterior,
    stockPosterior,
    motivo: request.motivo,
    observaciones: `Ajuste ${request.id.slice(0, 8)} — ${request.observaciones || ""}`,
    tenantSlug,
  });
}
