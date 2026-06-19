import { db } from "../../../shared/database/drizzle.js";
import { ordenesTrabajo, vehiculos, type EstadoOrden } from "../schema/index.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { eq, sql, and, desc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { consumeStockOnOTClose } from "../../inventory/services/ot-stock-consumer.js";

// ─── Tenant isolation helper ──────────────────

// ─── Orden listado y detalle ───────────────────

export interface OrdenListRow {
  id: string;
  vehicleId: string;
  clientId: string;
  description: string | null;
  status: string;
  hvAlert: boolean;
  hvLockoutSigned: boolean;
  dtcCodes: string[] | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  vehiculo?: string | null;
  plate?: string | null;
  cliente?: string | null;
}

/**
 * Lists work orders with optional status filter.
 *
 * Uses a single JOIN query to bring in vehicle and client info.
 *
 * @param filters - Optional filters (status, limit, offset)
 * @returns List of work orders with vehicle and client info
 */
export async function listOrdenes(
  filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  },
  tenantSlug?: string,
): Promise<OrdenListRow[]> {
  const conditions: ReturnType<typeof eq>[] = [];
  if (tenantSlug) {
    conditions.push(eq(ordenesTrabajo.tenantSlug, tenantSlug));
  }
  if (filters?.status) {
    conditions.push(eq(ordenesTrabajo.status, filters.status as EstadoOrden));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const rows = await db()
    .select({
      id: ordenesTrabajo.id,
      vehicleId: ordenesTrabajo.vehicleId,
      clientId: ordenesTrabajo.clientId,
      description: ordenesTrabajo.description,
      status: ordenesTrabajo.status,
      hvAlert: ordenesTrabajo.hvAlert,
      hvLockoutSigned: ordenesTrabajo.hvLockoutSigned,
      dtcCodes: ordenesTrabajo.dtcCodes,
      createdAt: ordenesTrabajo.createdAt,
      updatedAt: ordenesTrabajo.updatedAt,
      vehiculo: sql<string>`COALESCE(${vehiculos.brand} || ' ' || ${vehiculos.model}, NULL)`,
      plate: vehiculos.plate,
      cliente: clients.name,
    })
    .from(ordenesTrabajo)
    .leftJoin(vehiculos, eq(ordenesTrabajo.vehicleId, vehiculos.id))
    .leftJoin(clients, eq(ordenesTrabajo.clientId, clients.id))
    .where(where)
    .orderBy(desc(ordenesTrabajo.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Gets a single work order by ID with vehicle and client info.
 *
 * @param id - Work order UUID
 * @returns The work order with vehicle and client details
 * @throws {NotFoundError} If the order does not exist
 */
export async function getOrden(id: string, tenantSlug?: string): Promise<OrdenListRow> {
  const whereConditions = [eq(ordenesTrabajo.id, id)];
  if (tenantSlug) {
    whereConditions.push(eq(ordenesTrabajo.tenantSlug, tenantSlug));
  }
  const [row] = await db()
    .select({
      id: ordenesTrabajo.id,
      vehicleId: ordenesTrabajo.vehicleId,
      clientId: ordenesTrabajo.clientId,
      description: ordenesTrabajo.description,
      status: ordenesTrabajo.status,
      hvAlert: ordenesTrabajo.hvAlert,
      hvLockoutSigned: ordenesTrabajo.hvLockoutSigned,
      dtcCodes: ordenesTrabajo.dtcCodes,
      createdAt: ordenesTrabajo.createdAt,
      updatedAt: ordenesTrabajo.updatedAt,
      vehiculo: sql<string>`COALESCE(${vehiculos.brand} || ' ' || ${vehiculos.model}, NULL)`,
      plate: vehiculos.plate,
      cliente: clients.name,
    })
    .from(ordenesTrabajo)
    .leftJoin(vehiculos, eq(ordenesTrabajo.vehicleId, vehiculos.id))
    .leftJoin(clients, eq(ordenesTrabajo.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!row) {
    throw new NotFoundError(`Orden de trabajo ${id} no encontrada`);
  }

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── HV Lockout ────────────────────────────────

export async function signHvLockout(
  ordenId: string,
  mechanicId: string,
  tenantSlug?: string,
): Promise<{ signed: boolean; signedAt: string }> {
  const whereConditions = [eq(ordenesTrabajo.id, ordenId)];
  if (tenantSlug) {
    whereConditions.push(eq(ordenesTrabajo.tenantSlug, tenantSlug));
  }
  const [orden] = await db()
    .select({ id: ordenesTrabajo.id, hvAlert: ordenesTrabajo.hvAlert })
    .from(ordenesTrabajo)
    .where(and(...whereConditions));

  if (!orden) throw new NotFoundError(`Orden de trabajo ${ordenId} no encontrada`);
  if (!orden.hvAlert) {
    throw new ValidationError("Esta orden no requiere protocolo de alta tensión");
  }

  const now = new Date().toISOString();
  const updateConditions = [eq(ordenesTrabajo.id, ordenId)];
  if (tenantSlug) {
    updateConditions.push(eq(ordenesTrabajo.tenantSlug, tenantSlug));
  }
  await db()
    .update(ordenesTrabajo)
    .set({
      hvLockoutSigned: true,
      hvLockoutSignedAt: new Date(),
      hvLockoutSignedBy: mechanicId,
      updatedAt: new Date(),
    })
    .where(and(...updateConditions));

  return { signed: true, signedAt: now };
}

// ─── Status transition ─────────────────────────

export async function updateOrdenStatus(
  ordenId: string,
  newStatus: string,
  tenantSlug?: string,
): Promise<{ id: string; status: string }> {
  const validStatuses: ReadonlyArray<string> = ["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"];
  if (!validStatuses.includes(newStatus)) {
    throw new ValidationError(`Estado inválido: ${newStatus}`);
  }

  const selectConditions = [eq(ordenesTrabajo.id, ordenId)];
  if (tenantSlug) {
    selectConditions.push(eq(ordenesTrabajo.tenantSlug, tenantSlug));
  }
  const [orden] = await db()
    .select({
      id: ordenesTrabajo.id,
      status: ordenesTrabajo.status,
      hvAlert: ordenesTrabajo.hvAlert,
      hvLockoutSigned: ordenesTrabajo.hvLockoutSigned,
    })
    .from(ordenesTrabajo)
    .where(and(...selectConditions));

  if (!orden) throw new NotFoundError(`Orden de trabajo ${ordenId} no encontrada`);

  if (newStatus === "Listo" && orden.hvAlert && !orden.hvLockoutSigned) {
    throw new ValidationError(
      "No se puede finalizar la orden: el vehículo es HEV/BEV y el protocolo de " +
      "Lockout/Tagout de alta tensión no ha sido firmado. " +
      "Use POST /workshop/ordenes/:id/sign-lockout para firmarlo.",
    );
  }

  const updateConditions = [eq(ordenesTrabajo.id, ordenId)];
  if (tenantSlug) {
    updateConditions.push(eq(ordenesTrabajo.tenantSlug, tenantSlug));
  }
  const [updated] = await db()
    .update(ordenesTrabajo)
    .set({ status: newStatus as EstadoOrden, updatedAt: new Date() })
    .where(and(...updateConditions))
    .returning({ id: ordenesTrabajo.id, status: ordenesTrabajo.status });

  if (!updated) {
    throw new Error(`Error al actualizar orden ${ordenId}`);
  }

  // ── Auto-consume inventory stock when OT is completed ──
  if (newStatus === "Listo" && tenantSlug) {
    consumeStockOnOTClose(ordenId, tenantSlug).catch((err) => {
      console.warn(
        `[orden] Error consumiendo stock en OT ${ordenId}:`,
        err instanceof Error ? err.message : err,
      );
    });
  }

  broadcastToScreens(updated.id, newStatus).catch(() => {});
  return { id: updated.id, status: updated.status };
}

// ─── TV Screen broadcast ────────────────────────

async function broadcastToScreens(orderId: string, status: string): Promise<void> {
  const statusMap: Record<string, VisualStatus> = {
    Presupuestado: "DIAGNOSTICO",
    Aprobado: "DIAGNOSTICO",
    En_Proceso: "REPARACION",
    Control_Calidad: "CONTROL_CALIDAD",
    Listo: "AJUSTE_FINAL",
  };

  const [orden] = await db()
    .select({
      vehiculoModelo: sql<string>`COALESCE(v.brand || ' ' || v.model, 'Desconocido')`,
      plate: sql<string>`v.plate`,
      hvAlert: ordenesTrabajo.hvAlert,
      dtcCodes: ordenesTrabajo.dtcCodes,
    })
    .from(ordenesTrabajo)
    .leftJoin(vehiculos, eq(ordenesTrabajo.vehicleId, vehiculos.id))
    .where(eq(ordenesTrabajo.id, orderId));

  if (!orden) return;

  const { VisualStreamGateway } = await import(
    "../../intelligence/visual/VisualStreamGateway.js"
  );

  await VisualStreamGateway.broadcastUpdate({
    orderId,
    vehicleModel: orden.vehiculoModelo,
    plate: orden.plate ?? "",
    status: statusMap[status] ?? "REPARACION",
    torqueSpecs: [],
    isHighVoltage: orden.hvAlert,
    dtcCodes: orden.dtcCodes ?? undefined,
  });
}

type VisualStatus = "DIAGNOSTICO" | "REPARACION" | "AJUSTE_FINAL" | "CONTROL_CALIDAD";
