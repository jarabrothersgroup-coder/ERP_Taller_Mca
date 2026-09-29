import { db } from "../../../shared/database/drizzle.js";
import { withTransaction } from "../../../shared/database/transaction.js";
import { getSettings, invalidateCache } from "../../config/services/TenantConfigService.js";
import { ordenesTrabajo, vehiculos, type EstadoOrden, ordenEstadoHistorial, estadoOrdenEnum } from "../schema/index.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { eq, sql, and, desc, notInArray } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { consumeStockOnOTClose } from "../../inventory/services/ot-stock-consumer.js";
import { generarMantenimientosDeOT } from "./mantenimiento-programado.service.js";
import { presupuestos } from "../../finance/schema/budget.js";
import { workshopConfigurator } from "../../finance/services/index.js";
import { smartSend } from "../../email/services/email.service.js";
import { orderCompletedTemplate } from "../../email/templates/index.js";
import { crearNotificacionPush } from "./notification-push.service.js";
import { broadcastBoardChanged } from "./hub-board.service.js";
import { resolveAuditActor } from "../../../shared/audit/audit-context.js";

// ─── Tenant settings (per-tenant, global fallback) ─────────────

/**
 * Reads the workshop address from the tenant's settings file
 * (`config/tenant_settings.<slug>.json`, falling back to the global
 * `config/tenant_settings.json`). Falls back to a default if none exists.
 */
async function getWorkshopAddress(tenantSlug?: string): Promise<string> {
  const settings = await getSettings(tenantSlug);
  return settings.address || "Coronel Oviedo, Paraguay";
}

/**
 * Invalidates the tenant settings cache so the next call re-reads from disk.
 * Call this from config PUT handlers when settings are updated at runtime.
 */
export function invalidateSettingsCache(): void {
  invalidateCache();
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
  /** Mechanic (profile id) assigned to this work order */
  assignedTo: string | null;
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
 * @param filters - Optional filters (status, excludeStatus, limit, offset)
 * @returns List of work orders with vehicle and client info
 */
export async function listOrdenes(
  filters?: {
    status?: string;
    excludeStatus?: ExcludeStatus[];
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
  if (filters?.excludeStatus && filters.excludeStatus.length > 0) {
    conditions.push(notInArray(ordenesTrabajo.status, filters.excludeStatus as EstadoOrden[]));
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
      assignedTo: ordenesTrabajo.assignedTo,
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
export async function getOrden(id: string, tenantSlug: string): Promise<OrdenListRow> {
  const whereConditions = [eq(ordenesTrabajo.id, id), eq(ordenesTrabajo.tenantSlug, tenantSlug)];
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
      assignedTo: ordenesTrabajo.assignedTo,
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
  tenantSlug: string,
): Promise<{ signed: boolean; signedAt: string }> {
  const whereConditions = [eq(ordenesTrabajo.id, ordenId), eq(ordenesTrabajo.tenantSlug, tenantSlug)];
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
      tenantSlug: tenantSlug!,
    })
    .returning();

  // Sprint 101b: ping connected Hub boards so they refetch
  broadcastBoardChanged(tenantSlug!);

  // ── G-08: WhatsApp recepción notification ──
  if (tenantSlug) {
    const _ordenId = orden.id;
    const _vehicleId = vehicleId;
    const _clientId = clientId;
    // Awaited to ensure client receives confirmation — errors logged, don't block OT creation
    try {
      const [client] = await db()
        .select({ phone: clients.phone, name: clients.name })
        .from(clients)
        .where(eq(clients.id, _clientId))
        .limit(1);

      if (client?.phone) {
        let vehicleDesc = "";
        if (_vehicleId) {
          const [v] = await db()
            .select({ brand: vehiculos.brand, model: vehiculos.model })
            .from(vehiculos)
            .where(eq(vehiculos.id, _vehicleId))
            .limit(1);
          if (v) vehicleDesc = `${v.brand} ${v.model}`;
        }

        const { sendTextMessage } = await import(
          "../../whatsapp/services/whatsapp.service.js"
        );
        const { getTemplate } = await import(
          "../../whatsapp/services/whatsapp-template.service.js"
        );

        const template = await getTemplate(tenantSlug, "recepcion");
        if (template) {
          const message = template.body
            .replaceAll("{{nombre_cliente}}", client.name || "")
            .replaceAll("{{vehiculo}}", vehicleDesc)
            .replaceAll("{{vehiculo_marca}}", vehicleDesc.split(" ")[0] ?? "")
            .replaceAll("{{vehiculo_modelo}}", vehicleDesc.split(" ").slice(1).join(" ") || vehicleDesc)
            .replaceAll("{{chapa}}", "")
            .replaceAll("{{orden_id}}", _ordenId.slice(0, 8));

          await sendTextMessage(tenantSlug, client.phone, message);
        }
      }
    } catch (waErr) {
      console.error(
        `[orden] Error enviando WhatsApp recepción OT ${_ordenId}:`,
        waErr instanceof Error ? waErr.message : waErr,
      );
    }
  }

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
    assignedTo: orden.assignedTo,
    vehiculo: null,
    plate: null,
    cliente: null,
  };
}

// ─── Status transition ─────────────────────────

/** Statuses that can be excluded from list queries. */
export type ExcludeStatus = (typeof estadoOrdenEnum.enumValues)[number];

/**
 * Assigns (or clears) the mechanic responsible for a work order.
 *
 * Powers the Operations Hub technician filter — before Sprint 101 the OT
 * list API never returned an assignee, so filtering silently matched nothing.
 *
 * @param ordenId - Work order UUID
 * @param mechanicId - Profile UUID of the mechanic (null to unassign)
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns The updated order id and assignee
 * @throws {NotFoundError} If the order does not exist in this tenant
 */
export async function setAssignedTo(
  ordenId: string,
  mechanicId: string | null,
  tenantSlug?: string,
): Promise<{ id: string; assignedTo: string | null }> {
  const conditions = [eq(ordenesTrabajo.id, ordenId)];
  if (tenantSlug) {
    conditions.push(eq(ordenesTrabajo.tenantSlug, tenantSlug));
  }
  const [updated] = await db()
    .update(ordenesTrabajo)
    .set({ assignedTo: mechanicId, updatedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: ordenesTrabajo.id, assignedTo: ordenesTrabajo.assignedTo });

  if (!updated) {
    throw new NotFoundError(`Orden de trabajo ${ordenId} no encontrada`);
  }
  return { id: updated.id, assignedTo: updated.assignedTo };
}

export async function updateOrdenStatus(
  ordenId: string,
  newStatus: string,
  tenantSlug?: string,
): Promise<{ id: string; status: string }> {
  const validStatuses: ReadonlyArray<string> = [
    "Presupuestado",
    "Aprobado",
    "En_Proceso",
    "Control_Calidad",
    "Listo",
    "Finalizado_Retirado",
  ];
  if (!validStatuses.includes(newStatus)) {
    throw new ValidationError(`Estado inválido: ${newStatus}`);
  }

  // ── T-31 (SRV-04): estado + historial + consumo de stock + asiento
  //    comparten UNA sola transacción. Cualquier fallo (stock insuficiente,
  //    asiento contable, historial) revierte TODO: nunca queda una OT en
  //    "Listo" con stock desfasado ni un cambio de estado sin historial.
  //    Los efectos no críticos (WhatsApp/e-mail/TV/HUB) se disparan DESPUÉS
  //    del COMMIT — si se programaran dentro, heredarían el handle transaccional.
  let orden!: {
    id: string;
    status: EstadoOrden;
    hvAlert: boolean;
    hvLockoutSigned: boolean;
  };

  const updated = await withTransaction(async () => {
    const selectConditions = [eq(ordenesTrabajo.id, ordenId)];
    if (tenantSlug) {
      selectConditions.push(eq(ordenesTrabajo.tenantSlug, tenantSlug));
    }
    const [row] = await db()
      .select({
        id: ordenesTrabajo.id,
        status: ordenesTrabajo.status,
        hvAlert: ordenesTrabajo.hvAlert,
        hvLockoutSigned: ordenesTrabajo.hvLockoutSigned,
      })
      .from(ordenesTrabajo)
      .where(and(...selectConditions));

    if (!row) throw new NotFoundError(`Orden de trabajo ${ordenId} no encontrada`);
    orden = row;

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
    const [updatedRow] = await db()
      .update(ordenesTrabajo)
      .set({ status: newStatus as EstadoOrden, updatedAt: new Date() })
      .where(and(...updateConditions))
      .returning({ id: ordenesTrabajo.id, status: ordenesTrabajo.status });

    if (!updatedRow) {
      throw new Error(`Error al actualizar orden ${ordenId}`);
    }

    // ── G-02: historial de cambio de estado (auditoría) — dentro de la tx ──
    // Antes se tragaba el error y el estado quedaba cambiado sin registro;
    // ahora un fallo aquí revierte toda la transacción.
    const actor = resolveAuditActor();
    await db()
      .insert(ordenEstadoHistorial)
      .values({
        ordenTrabajoId: ordenId,
        estadoAnterior: orden.status,
        estadoNuevo: newStatus,
        // T-33: quién hizo el cambio (perfil de la request; null en cron/CLI)
        usuarioId: isRealActor(actor.usuarioId) ? actor.usuarioId : null,
        observaciones: null,
      });

    // ── Consumo automático de stock al completar la OT ──
    if (newStatus === "Listo" && tenantSlug) {
      // consumeStockOnOTClose propaga el error dentro de una transacción:
      // una sola pieza sin stock revierte también el cambio de estado.
      await consumeStockOnOTClose(ordenId, tenantSlug);

      // ── T-43 (SRV-03): ficha de próximos mantenimientos ──
      // Genera/actualiza el próximo mantenimiento de cada servicio realizado.
      // Dentro de la misma tx: si la ficha no se puede escribir, la OT no
      // queda "Listo" sin su siguiente servicio programado (T-31).
      await generarMantenimientosDeOT(ordenId, tenantSlug);

      // ── Reconocimiento de ingreso (asiento contable) ──
      const [otRow] = await db()
        .select({
          clientId: ordenesTrabajo.clientId,
          totalCost: ordenesTrabajo.totalCost,
        })
        .from(ordenesTrabajo)
        .where(and(
          eq(ordenesTrabajo.id, ordenId),
          eq(ordenesTrabajo.tenantSlug, tenantSlug),
        ))
        .limit(1);

      if (otRow) {
        const [client] = await db()
          .select({ name: clients.name })
          .from(clients)
          .where(eq(clients.id, otRow.clientId))
          .limit(1);

        const total = Number(otRow.totalCost ?? 0);

        if (total > 0) {
          // emit() relanza el error dentro de una transacción → rollback total
          await workshopConfigurator.onOTCompletada({
            tenantSlug,
            ordenId,
            clienteNombre: client?.name ?? "Cliente",
            totalManoObra: total,
            totalRepuestos: 0,
            totalServicios: 0,
            centroCostoId: undefined,
          });
        }
      }
    }

    return updatedRow;
  });

  // ─── COMMIT realizado — efectos no críticos (T-31) ──────────────

  // ── Notificaciones automáticas para TODOS los cambios de estado ──
  if (tenantSlug) {
    notificarCambioEstadoOt(ordenId, newStatus, tenantSlug, orden.status).catch((err) => {
      console.warn(
        `[orden] Error en notificación de estado ${ordenId}:`,
        err instanceof Error ? err.message : err,
      );
    });
  }

  // ── Send completion notification email when OT is ready ──
  if (newStatus === "Listo" && tenantSlug) {
    (async () => {
      try {
        const [ordenEmail] = await db()
          .select({
            clientId: ordenesTrabajo.clientId,
            description: ordenesTrabajo.description,
            totalCost: ordenesTrabajo.totalCost,
            vehicleId: ordenesTrabajo.vehicleId,
          })
          .from(ordenesTrabajo)
          .where(and(eq(ordenesTrabajo.id, ordenId), eq(ordenesTrabajo.tenantSlug, tenantSlug)))
          .limit(1);

        if (!ordenEmail?.clientId) return;

        const [client] = await db()
          .select({ email: clients.email, name: clients.name })
          .from(clients)
          .where(eq(clients.id, ordenEmail.clientId))
          .limit(1);

        if (!client?.email) return;

        // Fetch vehicle info for the email
        let vehiculoDesc = "";
        if (ordenEmail.vehicleId) {
          const [v] = await db()
            .select({
              brand: vehiculos.brand,
              model: vehiculos.model,
              plate: vehiculos.plate,
            })
            .from(vehiculos)
            .where(eq(vehiculos.id, ordenEmail.vehicleId))
            .limit(1);
          if (v) vehiculoDesc = `${v.brand} ${v.model} (${v.plate ?? "sin chapa"})`;
        }

        const totalVal = Number(ordenEmail.totalCost ?? 0);
        const html = orderCompletedTemplate({
          cliente: client.name,
          vehiculo: vehiculoDesc || "Vehículo del taller",
          serviciosRealizados: ordenEmail.description ?? "Servicio completado",
          total: totalVal.toLocaleString("es-PY", { minimumFractionDigits: 0 }),
          tallerNombre: tenantSlug,
          tallerDireccion: await getWorkshopAddress(tenantSlug),
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

        console.log(`[orden] Notificación de completado enviada a ${client.email}`);
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

  // Sprint 101b: ping connected Hub boards so they refetch
  if (tenantSlug) broadcastBoardChanged(tenantSlug);

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

// ─── Notificaciones multi-canal por cambio de estado ──

// Status mappings — consolidated in web/src/lib/status.ts for frontend.
// Kept here for backend-only operations (WhatsApp notifications, etc).
const WHATSAPP_STATUS_MAP: Record<string, string> = {
  Presupuestado: "PRESUPUESTADO",
  Aprobado: "EN_REPARACION",
  En_Proceso: "EN_REPARACION",
  Control_Calidad: "EN_REPARACION",
  Listo: "LISTO_ENTREGA",
  Finalizado_Retirado: "FINALIZADO_RETIRADO",
};

const STATUS_LABELS: Record<string, string> = {
  Presupuestado: "Presupuestado",
  Aprobado: "Aprobado",
  En_Proceso: "En reparación",
  Control_Calidad: "Control de calidad",
  Listo: "Listo para entrega",
  Finalizado_Retirado: "Finalizado — Retirado",
};

/**
 * Dispara notificaciones multi-canal cuando una OT cambia de estado.
 *
 * - Push notification in-app (SIEMPRE)
 * - WhatsApp al cliente (estados clave: Aprobado, En_Proceso, Listo)
 * - Email (ya manejado en updateOrdenStatus para Listo)
 */
async function notificarCambioEstadoOt(
  ordenId: string,
  nuevoEstado: string,
  tenantSlug: string,
  estadoAnterior?: string,
): Promise<void> {
  // ── 1. Push notification in-app ──
  const estadoLabel = STATUS_LABELS[nuevoEstado] ?? nuevoEstado;
  const estadoAnteriorLabel = estadoAnterior ? (STATUS_LABELS[estadoAnterior] ?? estadoAnterior) : "N/A";

  await crearNotificacionPush({
    tenantSlug,
    tipo: "OT",
    titulo: `OT cambió a: ${estadoLabel}`,
    mensaje: `La orden de trabajo cambió de "${estadoAnteriorLabel}" a "${estadoLabel}".`,
    entityType: "orden_trabajo",
    entityId: ordenId,
    priority: "HIGH",
    actionUrl: `/dashboard/taller/${ordenId}`,
  });

  // ── 2. WhatsApp al cliente (estados clave) ──
  const whatsappTemplate = WHATSAPP_STATUS_MAP[nuevoEstado];
  if (whatsappTemplate && nuevoEstado !== estadoAnterior) {
    try {
      // Obtener datos del cliente y vehículo
      const [orden] = await db()
        .select({
          clientId: ordenesTrabajo.clientId,
          vehicleId: ordenesTrabajo.vehicleId,
        })
        .from(ordenesTrabajo)
        .where(eq(ordenesTrabajo.id, ordenId))
        .limit(1);

      if (orden?.clientId) {
        const [client] = await db()
          .select({ phone: clients.phone, name: clients.name })
          .from(clients)
          .where(eq(clients.id, orden.clientId))
          .limit(1);

        if (client?.phone) {
          let vehicleDesc = "";
          if (orden.vehicleId) {
            const [v] = await db()
              .select({ brand: vehiculos.brand, model: vehiculos.model, plate: vehiculos.plate })
              .from(vehiculos)
              .where(eq(vehiculos.id, orden.vehicleId))
              .limit(1);
            if (v) vehicleDesc = `${v.brand} ${v.model}`;
          }

          const { sendTextMessage, buildMessage } = await import(
            "../../whatsapp/services/whatsapp.service.js"
          );

          const message = buildMessage(whatsappTemplate, {
            nombre_cliente: client.name,
            vehiculo_marca: vehicleDesc.split(" ")[0] ?? "",
            vehiculo_modelo: vehicleDesc.split(" ").slice(1).join(" ") || vehicleDesc,
            id_orden: ordenId.slice(0, 8),
            monto_total: "Consultar",
            fecha_estimada_entrega: new Date(Date.now() + 86400000 * 2).toLocaleDateString("es-PY"),
          } as any);

          await sendTextMessage(tenantSlug, client.phone, message);
        }
      }
    } catch (waErr) {
      console.warn(
        `[orden] Error enviando WhatsApp cambio estado OT ${ordenId}:`,
        waErr instanceof Error ? waErr.message : waErr,
      );
    }
  }
}

type VisualStatus = "DIAGNOSTICO" | "REPARACION" | "AJUSTE_FINAL" | "CONTROL_CALIDAD";

// ─── P1.3: Presupuesto → OT automático ─────────

/**
 * Convierte un presupuesto aprobado en una orden de trabajo.
 *
 * Copia los servicios y repuestos del presupuesto a la nueva OT,
 * y la crea en estado "Aprobado" (saltándose "Presupuestado").
 * Vincula la OT al presupuesto original.
 *
 * @param presupuestoId - ID del presupuesto aprobado
 * @param tenantSlug - Slug del tenant
 * @returns La orden de trabajo creada
 * @throws {NotFoundError} Si el presupuesto no existe
 * @throws {ValidationError} Si el presupuesto no está aprobado
 */
export async function convertPresupuestoToOT(
  presupuestoId: string,
  tenantSlug: string,
): Promise<{ ordenTrabajo: OrdenListRow; presupuesto: { id: string; estado: string } }> {
  // Obtener el presupuesto
  const [presupuesto] = await db()
    .select()
    .from(presupuestos)
    .where(
      and(
        eq(presupuestos.id, presupuestoId),
        eq(presupuestos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!presupuesto) {
    throw new NotFoundError(`Presupuesto ${presupuestoId} no encontrado`);
  }

  if (presupuesto.estado !== "aprobado" && presupuesto.estado !== "borrador") {
    throw new ValidationError(
      `El presupuesto está en estado "${presupuesto.estado}". Debe estar "aprobado" o "borrador" para convertirlo a OT.`,
    );
  }

  if (!presupuesto.clienteId || !presupuesto.vehicleId) {
    throw new ValidationError(
      "El presupuesto debe tener asignados un cliente y un vehículo para crear la OT.",
    );
  }

  // Crear la orden de trabajo en estado "Aprobado"
  const [orden] = await db()
    .insert(ordenesTrabajo)
    .values({
      vehicleId: presupuesto.vehicleId,
      clientId: presupuesto.clienteId,
      description: presupuesto.descripcion ?? `OT desde presupuesto ${presupuestoId.slice(0, 8)}`,
      status: presupuesto.estado === "aprobado" ? "Aprobado" : "Presupuestado",
      tenantSlug,
      totalCost: presupuesto.totalEstimado ?? "0",
    })
    .returning();

  // Vincular la OT al presupuesto
  await db()
    .update(presupuestos)
    .set({
      ordenTrabajoId: orden.id,
      estado: presupuesto.estado === "borrador" ? "aprobado" : presupuesto.estado as any,
      updatedAt: new Date(),
      fechaAprobacion: new Date(),
    })
    .where(eq(presupuestos.id, presupuestoId));

  // Retornar resultado
  return {
    ordenTrabajo: {
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
      assignedTo: orden.assignedTo ?? null,
      vehiculo: null,
      plate: null,
      cliente: null,
    },
    presupuesto: {
      id: presupuesto.id,
      estado: "aprobado",
    },
  };
}

/** True when `usuarioId` identifies a real profile (not system/anonymous). */
function isRealActor(usuarioId: string): boolean {
  return usuarioId !== "system" && usuarioId !== "anonymous";
}
