import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../../shared/database/drizzle.js";
import { ordenesTrabajo, vehiculos, type EstadoOrden } from "../schema/index.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { eq, sql, and, desc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { consumeStockOnOTClose } from "../../inventory/services/ot-stock-consumer.js";
import { smartSend } from "../../email/services/email.service.js";
import { orderCompletedTemplate } from "../../email/templates/index.js";

// ─── Tenant settings cache ──────────────────────

let _tenantSettingsCache: Record<string, unknown> | null = null;

/**
 * Reads the workshop address from config/tenant_settings.json.
 * Falls back to a default if the file is not found or unparseable.
 */
async function getWorkshopAddress(): Promise<string> {
  if (_tenantSettingsCache) return (_tenantSettingsCache.address as string | undefined) ?? "Coronel Oviedo, Paraguay";
  try {
    const raw = await readFile(join(process.cwd(), "config", "tenant_settings.json"), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    _tenantSettingsCache = parsed;
    return (parsed.address as string | undefined) ?? "Coronel Oviedo, Paraguay";
  } catch {
    return "Coronel Oviedo, Paraguay";
  }
}

/**
 * Invalidates the tenant settings cache so the next call re-reads from disk.
 * Call this from config PUT handlers when settings are updated at runtime.
 */
export function invalidateSettingsCache(): void {
  _tenantSettingsCache = null;
}

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

// ─── Create orden ──────────────────────────────

/**
 * Creates a new work order for a vehicle + client.
 *
 * Validates that both vehicleId and clientId exist in the database.
 * Status defaults to "Presupuestado" (workshop workflow).
 *
 * @param data - Work order payload (vehicleId, clientId, description, etc.)
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns The created work order row
 * @throws {NotFoundError} If vehicle or client does not exist
 */
export async function createOrden(
  data: {
    vehicleId: string;
    clientId: string;
    description?: string;
    hvAlert?: boolean;
    dtcCodes?: string[];
  },
  tenantSlug?: string,
): Promise<OrdenListRow> {
  const { vehicleId, clientId, description, hvAlert, dtcCodes } = data;

  // ── Validate vehicle exists (tenant-scoped) ──
  const vehicleConditions = [eq(vehiculos.id, vehicleId)];
  if (tenantSlug) {
    vehicleConditions.push(eq(vehiculos.tenantSlug, tenantSlug));
  }
  const [vehicle] = await db()
    .select({ id: vehiculos.id })
    .from(vehiculos)
    .where(and(...vehicleConditions))
    .limit(1);

  if (!vehicle) {
    throw new NotFoundError(`Vehículo con ID ${vehicleId} no encontrado`);
  }

  // ── Validate client exists ──
  const [client] = await db()
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    throw new NotFoundError(`Cliente con ID ${clientId} no encontrado`);
  }

  // ── Insert work order ──
  const [orden] = await db()
    .insert(ordenesTrabajo)
    .values({
      vehicleId,
      clientId,
      description: description ?? null,
      hvAlert: hvAlert ?? false,
      dtcCodes: dtcCodes ?? [],
      status: "Presupuestado",
      tenantSlug: tenantSlug ?? "default",
    })
    .returning();

  // ── Return as OrdenListRow with joined fields ──
  return {
    id: orden.id,
    vehicleId: orden.vehicleId,
    clientId: orden.clientId,
    description: orden.description,
    status: orden.status,
    hvAlert: orden.hvAlert,
    hvLockoutSigned: orden.hvLockoutSigned,
    dtcCodes: orden.dtcCodes,
    createdAt: orden.createdAt.toISOString(),
    updatedAt: orden.updatedAt.toISOString(),
    vehiculo: null,
    plate: null,
    cliente: null,
  };
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

  // ── Send completion notification email when OT is ready ──
  if (newStatus === "Listo" && tenantSlug) {
    (async () => {
      try {
        const [orden] = await db()
          .select({
            clientId: ordenesTrabajo.clientId,
            description: ordenesTrabajo.description,
            totalCost: ordenesTrabajo.totalCost,
            vehicleId: ordenesTrabajo.vehicleId,
          })
          .from(ordenesTrabajo)
          .where(and(eq(ordenesTrabajo.id, ordenId), eq(ordenesTrabajo.tenantSlug, tenantSlug)))
          .limit(1);

        if (!orden?.clientId) return;

        const [client] = await db()
          .select({ email: clients.email, name: clients.name })
          .from(clients)
          .where(eq(clients.id, orden.clientId))
          .limit(1);

        if (!client?.email) return;

        // Fetch vehicle info for the email
        let vehiculoDesc = "";
        if (orden.vehicleId) {
          const [v] = await db()
            .select({
              brand: vehiculos.brand,
              model: vehiculos.model,
              plate: vehiculos.plate,
            })
            .from(vehiculos)
            .where(eq(vehiculos.id, orden.vehicleId))
            .limit(1);
          if (v) vehiculoDesc = `${v.brand} ${v.model} (${v.plate ?? "sin chapa"})`;
        }

        const totalVal = Number(orden.totalCost ?? 0);
        const html = orderCompletedTemplate({
          cliente: client.name,
          vehiculo: vehiculoDesc || "Vehículo del taller",
          serviciosRealizados: orden.description ?? "Servicio completado",
          total: totalVal.toLocaleString("es-PY", { minimumFractionDigits: 0 }),
          tallerNombre: tenantSlug,
          tallerDireccion: await getWorkshopAddress(),
          fecha: new Date().toLocaleDateString("es-PY"),
        });

        const subject = `✅ Servicio Completado — OT #${ordenId.slice(0, 8)} — AutomotiveOS`;

        await smartSend({
          to: client.email,
          subject,
          html,
          entityType: "orden_completada",
          entityId: ordenId,
          tenantSlug,
        });

        console.warn(`[orden] Notificación de completado enviada a ${client.email}`);
      } catch (emailErr) {
        console.warn(
          `[orden] Error enviando email de completado OT ${ordenId}:`,
          emailErr instanceof Error ? emailErr.message : emailErr,
        );
      }
    })();
  }

  broadcastToScreens(updated.id, newStatus).catch((err) => {
    console.warn(
      `[orden] Error broadcasting OT ${updated.id} to screens:`,
      err instanceof Error ? err.message : err,
    );
  });
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
