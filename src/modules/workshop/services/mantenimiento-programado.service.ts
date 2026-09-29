/**
 * Mantenimiento Programado Service — "ficha de próximos mantenimientos".
 *
 * T-43 · auditoría 2026-09-25 (SRV-03 / TRN-08). Antes de este módulo:
 *   - nada se persistía al completar un servicio (la ficha no existía),
 *   - `predictMaintenance` inventaba el odómetro e ignoraba el tenant,
 *   - `ingresos.kilometraje` nunca se propagaba a `vehiculos.kilometraje`.
 *
 * Responsabilidades:
 *   1. Al pasar una OT a "Listo": generar/actualizar el próximo mantenimiento
 *      de cada servicio realizado (origen = OT_COMPLETADA).
 *   2. Propagar el km capturado en el ingreso al vehículo (solo si avanza).
 *   3. CRUD tenant-scoped de la ficha.
 *   4. Recordatorio WhatsApp idempotente (template `proximo_servicio`).
 *
 * @module workshop/services/mantenimiento-programado.service
 */

import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { vehiculos } from "../schema/vehiculos.js";
import { ordenesTrabajo } from "../schema/ordenes-trabajo.js";
import { ordenServicios } from "../schema/orden-servicios.js";
import { mantenimientosProgramados } from "../schema/mantenimientos-programados.js";
import { clients } from "../../../shared/database/schema/clients.js";

// ─── Types ────────────────────────────────────

export interface MantenimientoDTO {
  id: string;
  vehiculoId: string;
  ordenTrabajoId: string | null;
  servicio: string;
  kmObjetivo: number | null;
  fechaObjetivo: string | null;
  estado: string;
  origen: string;
  recordatorioEnviado: boolean;
  tenantSlug: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMantenimientoInput {
  vehiculoId: string;
  servicio: string;
  kmObjetivo?: number | null;
  fechaObjetivo?: string | null;
  origen?: string;
}

export interface UpdateMantenimientoInput {
  servicio?: string;
  kmObjetivo?: number | null;
  fechaObjetivo?: string | null;
  estado?: string;
}

export interface RecordatorioResult {
  enviados: number;
  omitidos: number;
  errores: string[];
}

/** Estados válidos (CHECK constraint en la migración 0031). */
const ESTADOS = ["PENDIENTE", "REALIZADO", "CANCELADO"] as const;

// ─── Intervalos por nombre de servicio ─────────

/**
 * Mapea el nombre de un servicio realizado a su intervalo de repetición.
 * Se busca por palabra clave; si no hay match se usa el default (5000 km / 6 meses),
 * razonable para un taller paraguayo (~1500 km/mes).
 */
const INTERVALOS: Array<{ patrones: RegExp; km: number; meses: number }> = [
  { patrones: /aceite/i, km: 5000, meses: 6 },
  { patrones: /filtro/i, km: 10000, meses: 12 },
  { patrones: /freno/i, km: 20000, meses: 12 },
  { patrones: /rotaci|neum|llanta|balanceo/i, km: 10000, meses: 6 },
  { patrones: /transmisi/i, km: 40000, meses: 24 },
  { patrones: /correa/i, km: 60000, meses: 36 },
  { patrones: /refrigerante|anticongelante/i, km: 30000, meses: 18 },
  { patrones: /buj[ií]a/i, km: 30000, meses: 18 },
];

const INTERVALO_DEFAULT = { km: 5000, meses: 6 };

function intervaloPara(servicio: string): { km: number; meses: number } {
  return INTERVALOS.find((i) => i.patrones.test(servicio)) ?? INTERVALO_DEFAULT;
}

function fechaObjetiva(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().split("T")[0]!;
}

function toDTO(row: typeof mantenimientosProgramados.$inferSelect): MantenimientoDTO {
  return {
    id: row.id,
    vehiculoId: row.vehiculoId,
    ordenTrabajoId: row.ordenTrabajoId,
    servicio: row.servicio,
    kmObjetivo: row.kmObjetivo,
    fechaObjetivo: row.fechaObjetivo,
    estado: row.estado,
    origen: row.origen,
    recordatorioEnviado: row.recordatorioEnviado,
    tenantSlug: row.tenantSlug,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── 1. Generación al completar la OT ──────────

/**
 * Genera/actualiza los próximos mantenimientos de los servicios realizados
 * en una OT que acaba de pasar a "Listo".
 *
 * Se ejecuta DENTRO de la transacción de `updateOrdenStatus` (T-31): si la
 * ficha no puede escribirse, la transición completa se revierte — nunca
 * queda una OT "Listo" sin su próximo servicio programado.
 *
 * Idempotente: si ya existe un PENDIENTE para (vehiculo, servicio) se
 * actualiza su objetivo en vez de duplicar la fila.
 *
 * @param ordenId - OT completada
 * @param tenantSlug - Tenant (la lookup de la OT es tenant-scoped)
 * @returns Cantidad de mantenimientos creados/actualizados
 */
export async function generarMantenimientosDeOT(
  ordenId: string,
  tenantSlug: string,
): Promise<number> {
  const [ot] = await db()
    .select({
      id: ordenesTrabajo.id,
      vehicleId: ordenesTrabajo.vehicleId,
      status: ordenesTrabajo.status,
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.id, ordenId),
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!ot || ot.status !== "Listo") return 0;

  // Servicios realizados en la OT (snapshot denormalizado del catálogo)
  const servicios = await db()
    .select({ nombre: ordenServicios.servicioNombre })
    .from(ordenServicios)
    .where(
      and(
        eq(ordenServicios.ordenTrabajoId, ordenId),
        eq(ordenServicios.tenantSlug, tenantSlug),
      ),
    );

  if (servicios.length === 0) return 0;

  // Km real actual del vehículo (nunca inventado)
  const [vehiculo] = await db()
    .select({ kilometraje: vehiculos.kilometraje })
    .from(vehiculos)
    .where(
      and(
        eq(vehiculos.id, ot.vehicleId),
        eq(vehiculos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  const kmActual = vehiculo?.kilometraje ?? null;

  let impactados = 0;
  for (const { nombre } of servicios) {
    const intervalo = intervaloPara(nombre);
    const kmObjetivo = kmActual !== null ? kmActual + intervalo.km : null;
    const fechaObjetivo = fechaObjetiva(intervalo.meses);

    const [existente] = await db()
      .select({ id: mantenimientosProgramados.id })
      .from(mantenimientosProgramados)
      .where(
        and(
          eq(mantenimientosProgramados.vehiculoId, ot.vehicleId),
          eq(mantenimientosProgramados.servicio, nombre),
          eq(mantenimientosProgramados.estado, "PENDIENTE"),
          eq(mantenimientosProgramados.tenantSlug, tenantSlug),
        ),
      )
      .limit(1);

    if (existente) {
      await db()
        .update(mantenimientosProgramados)
        .set({
          kmObjetivo,
          fechaObjetivo,
          ordenTrabajoId: ordenId,
          recordatorioEnviado: false,
          recordatorioEnviadoAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mantenimientosProgramados.id, existente.id),
            eq(mantenimientosProgramados.tenantSlug, tenantSlug),
          ),
        );
    } else {
      await db()
        .insert(mantenimientosProgramados)
        .values({
          vehiculoId: ot.vehicleId,
          ordenTrabajoId: ordenId,
          servicio: nombre,
          kmObjetivo,
          fechaObjetivo,
          origen: "OT_COMPLETADA",
          tenantSlug,
        });
    }
    impactados++;
  }

  return impactados;
}

// ─── 2. Propagación de odómetro (TRN-08) ───────

/**
 * Propaga `ingresos.kilometraje → vehiculos.kilometraje`.
 *
 * Solo avanza: un km menor al registrado (odómetro reseteado / captura
 * errónea) nunca degrada el valor real. Llamado desde `createIngreso`.
 *
 * @param vehicleId - Vehículo (ya validado tenant-scoped en el caller)
 * @param kilometraje - Km capturado en el ingreso
 * @param tenantSlug - Tenant
 * @returns true si el vehículo fue actualizado
 */
export async function propagarKilometraje(
  vehicleId: string,
  kilometraje: number,
  tenantSlug?: string,
): Promise<boolean> {
  if (!Number.isFinite(kilometraje) || kilometraje < 0) return false;

  // Filtro de tenant INLINE (visible para scripts/audit-tenant-filters.mjs):
  // sin tenant la condición no matchea ninguna fila (fail-closed).
  const [updated] = await db()
    .update(vehiculos)
    .set({ kilometraje: Math.round(kilometraje), updatedAt: new Date() })
    .where(
      and(
        eq(vehiculos.id, vehicleId),
        eq(vehiculos.tenantSlug, tenantSlug ?? ""),
        or(
          sql`${vehiculos.kilometraje} IS NULL`,
          sql`${vehiculos.kilometraje} < ${Math.round(kilometraje)}`,
        )!,
      ),
    )
    .returning({ id: vehiculos.id });

  return Boolean(updated);
}

// ─── 3. CRUD tenant-scoped ─────────────────────

/**
 * Lista los mantenimientos programados de un tenant.
 *
 * @param tenantSlug - Tenant
 * @param filters - Filtros opcionales (vehiculoId, estado)
 */
export async function listMantenimientos(
  tenantSlug: string,
  filters: { vehiculoId?: string; estado?: string } = {},
): Promise<MantenimientoDTO[]> {
  // Filtro de tenant INLINE en la sentencia (visible para la auditoría de
  // scripts/audit-tenant-filters.mjs — el techo no puede crecer).
  const rows = await db()
    .select()
    .from(mantenimientosProgramados)
    .where(
      and(
        eq(mantenimientosProgramados.tenantSlug, tenantSlug),
        ...(filters.vehiculoId
          ? [eq(mantenimientosProgramados.vehiculoId, filters.vehiculoId)]
          : []),
        ...(filters.estado
          ? [eq(mantenimientosProgramados.estado, filters.estado)]
          : []),
      ),
    )
    .orderBy(
      sql`COALESCE(${mantenimientosProgramados.fechaObjetivo}, '9999-12-31') ASC`,
      desc(mantenimientosProgramados.kmObjetivo),
    )
    .limit(500);

  return rows.map(toDTO);
}

/**
 * Obtiene un mantenimiento por id (404 si no existe en el tenant).
 */
export async function getMantenimiento(
  id: string,
  tenantSlug: string,
): Promise<MantenimientoDTO> {
  const [row] = await db()
    .select()
    .from(mantenimientosProgramados)
    .where(
      and(
        eq(mantenimientosProgramados.id, id),
        eq(mantenimientosProgramados.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(`Mantenimiento programado ${id} no encontrado`);
  }
  return toDTO(row);
}

/**
 * Crea un mantenimiento manual (origen = MANUAL salvo override).
 */
export async function createMantenimiento(
  data: CreateMantenimientoInput,
  tenantSlug: string,
): Promise<MantenimientoDTO> {
  if (!data.servicio || !data.servicio.trim()) {
    throw new ValidationError("El servicio es obligatorio");
  }
  if (data.kmObjetivo == null && !data.fechaObjetivo) {
    throw new ValidationError(
      "Debe indicar un km objetivo y/o una fecha objetivo",
    );
  }

  // El vehículo debe pertenecer al tenant
  const [vehiculo] = await db()
    .select({ id: vehiculos.id })
    .from(vehiculos)
    .where(
      and(
        eq(vehiculos.id, data.vehiculoId),
        eq(vehiculos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);
  if (!vehiculo) {
    throw new NotFoundError(`Vehículo ${data.vehiculoId} no encontrado`);
  }

  const [row] = await db()
    .insert(mantenimientosProgramados)
    .values({
      vehiculoId: data.vehiculoId,
      servicio: data.servicio.trim(),
      kmObjetivo: data.kmObjetivo ?? null,
      fechaObjetivo: data.fechaObjetivo ?? null,
      origen: data.origen ?? "MANUAL",
      tenantSlug,
    })
    .returning();

  return toDTO(row);
}

/**
 * Actualiza un mantenimiento (cambiar objetivo, marcar REALIZADO/CANCELADO).
 */
export async function updateMantenimiento(
  id: string,
  data: UpdateMantenimientoInput,
  tenantSlug: string,
): Promise<MantenimientoDTO> {
  if (data.estado && !ESTADOS.includes(data.estado as (typeof ESTADOS)[number])) {
    throw new ValidationError(`Estado inválido: ${data.estado}`);
  }
  if (
    data.kmObjetivo === undefined &&
    data.fechaObjetivo === undefined &&
    data.servicio === undefined &&
    data.estado === undefined
  ) {
    throw new ValidationError("Nada para actualizar");
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.servicio !== undefined) patch.servicio = data.servicio.trim();
  if (data.kmObjetivo !== undefined) patch.kmObjetivo = data.kmObjetivo;
  if (data.fechaObjetivo !== undefined) patch.fechaObjetivo = data.fechaObjetivo;
  if (data.estado !== undefined) patch.estado = data.estado;

  const [row] = await db()
    .update(mantenimientosProgramados)
    .set(patch)
    .where(
      and(
        eq(mantenimientosProgramados.id, id),
        eq(mantenimientosProgramados.tenantSlug, tenantSlug),
      ),
    )
    .returning();

  if (!row) {
    throw new NotFoundError(`Mantenimiento programado ${id} no encontrado`);
  }
  return toDTO(row);
}

/**
 * Elimina un mantenimiento (tenant-scoped; 404 si no pertenece al tenant).
 */
export async function deleteMantenimiento(
  id: string,
  tenantSlug: string,
): Promise<void> {
  const rows = await db()
    .delete(mantenimientosProgramados)
    .where(
      and(
        eq(mantenimientosProgramados.id, id),
        eq(mantenimientosProgramados.tenantSlug, tenantSlug),
      ),
    )
    .returning({ id: mantenimientosProgramados.id });

  if (rows.length === 0) {
    throw new NotFoundError(`Mantenimiento programado ${id} no encontrado`);
  }
}

// ─── 4. Recordatorio WhatsApp (template proximo_servicio) ───

/**
 * Ejecuta el recordatorio de mantenimientos próximos.
 *
 * Selecciona PENDIENTEN sin recordatorio cuyo fecha objetivo ya venció o
 * vence dentro de `diasAviso`, o cuyo km objetivo ya se alcanzó según el
 * odómetro real. Idempotente: la fila marcada `recordatorio_enviado` no
 * vuelve a enviarse.
 *
 * Se expone como cron (POST /workshop/cron/mantenimientos-recordatorios).
 *
 * @param tenantSlug - Tenant a procesar
 * @param diasAviso - Días de anticipación para avisar por fecha (default 7)
 */
export async function recordatorioMantenimientos(
  tenantSlug: string,
  diasAviso = 7,
): Promise<RecordatorioResult> {
  const result: RecordatorioResult = { enviados: 0, omitidos: 0, errores: [] };

  const limiteFecha = new Date();
  limiteFecha.setDate(limiteFecha.getDate() + diasAviso);
  const limiteFechaStr = limiteFecha.toISOString().split("T")[0];

  const candidatos = await db()
    .select({
      m: mantenimientosProgramados,
      kmActual: vehiculos.kilometraje,
      vehiculoDesc: sql<string>`CONCAT(${vehiculos.brand}, ' ', ${vehiculos.model})`,
      plate: vehiculos.plate,
      clienteId: vehiculos.clientId,
    })
    .from(mantenimientosProgramados)
    .innerJoin(vehiculos, eq(mantenimientosProgramados.vehiculoId, vehiculos.id))
    .where(
      and(
        eq(mantenimientosProgramados.tenantSlug, tenantSlug),
        eq(mantenimientosProgramados.estado, "PENDIENTE"),
        eq(mantenimientosProgramados.recordatorioEnviado, false),
        or(
          lte(mantenimientosProgramados.fechaObjetivo, limiteFechaStr),
          sql`${mantenimientosProgramados.kmObjetivo} IS NOT NULL`,
        )!,
      ),
    )
    .limit(100);

  if (candidatos.length === 0) return result;

  const { getTemplate } = await import(
    "../../whatsapp/services/whatsapp-template.service.js"
  );
  const { sendTextMessage, sanitizePhone } = await import(
    "../../whatsapp/services/whatsapp.service.js"
  );

  const template = await getTemplate(tenantSlug, "proximo_servicio");
  if (!template) {
    result.omitidos = candidatos.length;
    return result;
  }

  // Resuelve clientes en una sola query (teléfono + nombre)
  const clienteIds = [...new Set(candidatos.map((c) => c.clienteId))];
  const clientes = await db()
    .select({
      id: clients.id,
      phone: clients.phone,
      name: clients.name,
    })
    .from(clients)
    .where(
      and(
        inArray(clients.id, clienteIds),
        eq(clients.tenantSlug, tenantSlug),
      ),
    );
  const clienteMap = new Map(clientes.map((c) => [c.id, c]));

  // Ventana de avance: fecha ya vencida/vence pronto, o km real ya alcanzado
  const hoyStr = new Date().toISOString().split("T")[0]!;
  const pendientes = candidatos.filter((c) => {
    const porFecha =
      c.m.fechaObjetivo !== null && c.m.fechaObjetivo <= limiteFechaStr;
    const porKm =
      c.m.kmObjetivo !== null &&
      c.kmActual !== null &&
      c.kmActual >= c.m.kmObjetivo;
    void hoyStr;
    return porFecha || porKm;
  });

  const INTER_MESSAGE_DELAY_MS = 1500;

  for (let i = 0; i < pendientes.length; i++) {
    const c = pendientes[i]!;
    const cliente = clienteMap.get(c.clienteId);

    if (!cliente?.phone) {
      result.omitidos++;
      continue;
    }

    try {
      const message = template.body
        .replaceAll("{{nombre_cliente}}", cliente.name || "")
        .replaceAll("{{vehiculo}}", c.vehiculoDesc.trim())
        .replaceAll(
          "{{fecha_servicio}}",
          c.m.fechaObjetivo
            ? new Date(`${c.m.fechaObjetivo}T12:00:00`).toLocaleDateString("es-PY")
            : `${c.m.kmObjetivo?.toLocaleString("es-PY")} km`,
        )
        .replaceAll(
          "{{kilometraje}}",
          (c.kmActual ?? 0).toLocaleString("es-PY"),
        );

      const phone = sanitizePhone(cliente.phone);
      const send = await sendTextMessage(tenantSlug, phone, message);

      if (send.success) {
        await db()
          .update(mantenimientosProgramados)
          .set({
            recordatorioEnviado: true,
            recordatorioEnviadoAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(mantenimientosProgramados.id, c.m.id),
              eq(mantenimientosProgramados.tenantSlug, tenantSlug),
            ),
          );
        result.enviados++;
      } else {
        result.omitidos++;
        result.errores.push(
          `${c.m.servicio} (${cliente.name || cliente.id}): ${send.error ?? "error desconocido"}`,
        );
      }
    } catch (err) {
      result.omitidos++;
      result.errores.push(
        `${c.m.servicio}: ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    }

    if (i < pendientes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, INTER_MESSAGE_DELAY_MS));
    }
  }

  return result;
}

// ─── Ficha del vehículo (UI) ───────────────────

/**
 * Ficha de próximos mantenimientos de un vehículo: filtra la lista por
 * vehículo con validación de pertenencia (404 si el vehículo es ajeno).
 *
 * @param vehiculoId - Vehículo
 * @param tenantSlug - Tenant
 */
export async function listMantenimientosDeVehiculo(
  vehiculoId: string,
  tenantSlug: string,
): Promise<{ vehiculoId: string; kilometraje: number | null; items: MantenimientoDTO[] }> {
  const [vehiculo] = await db()
    .select({ id: vehiculos.id, kilometraje: vehiculos.kilometraje })
    .from(vehiculos)
    .where(
      and(
        eq(vehiculos.id, vehiculoId),
        eq(vehiculos.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!vehiculo) {
    throw new NotFoundError(`Vehículo ${vehiculoId} no encontrado`);
  }

  const items = await listMantenimientos(tenantSlug, { vehiculoId });
  return {
    vehiculoId: vehiculo.id,
    kilometraje: vehiculo.kilometraje,
    items,
  };
}
