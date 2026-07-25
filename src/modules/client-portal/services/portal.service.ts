/**
 * Client Portal Service — Self-service appointments, feedback, and data access.
 *
 * @module client-portal/services/portal.service
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { vehiculos } from "../../workshop/schema/vehiculos.js";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";

/**
 * Get client summary (vehicles + recent orders).
 */
export async function getClientSummary(tenantSlug: string, clientId: string) {
  const [client] = await db()
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      phone: clients.phone,
      ruc: clients.ruc,
    })
    .from(clients)
    .where(
      and(
        eq(clients.tenantSlug, tenantSlug),
        eq(clients.id, clientId),
      ),
    )
    .limit(1);

  if (!client) return null;

  const vehicles = await db()
    .select()
    .from(vehiculos)
    .where(eq(vehiculos.clientId, clientId))
    .orderBy(desc(vehiculos.createdAt))
    .limit(10);

  const recentOrders = await db()
    .select()
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.clientId, clientId))
    .orderBy(desc(ordenesTrabajo.createdAt))
    .limit(5);

  return {
    client,
    vehicles,
    recentOrders,
    stats: {
      totalVehicles: vehicles.length,
      totalOrders: recentOrders.length,
    },
  };
}

/**
 * Get client's vehicles.
 */
export async function getClientVehicles(tenantSlug: string, clientId: string) {
  return db()
    .select()
    .from(vehiculos)
    .where(
      and(
        eq(vehiculos.tenantSlug, tenantSlug),
        eq(vehiculos.clientId, clientId),
      ),
    )
    .orderBy(desc(vehiculos.createdAt));
}

/**
 * Get client's work orders.
 */
export async function getClientOrders(
  tenantSlug: string,
  clientId: string,
  limit = 20,
) {
  return db()
    .select()
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        eq(ordenesTrabajo.clientId, clientId),
      ),
    )
    .orderBy(desc(ordenesTrabajo.createdAt))
    .limit(limit);
}

/**
 * Get a single work order by ID, verifying it belongs to the client.
 */
export async function getClientOrderById(
  tenantSlug: string,
  clientId: string,
  orderId: string,
) {
  const [order] = await db()
    .select({
      id: ordenesTrabajo.id,
      vehicleId: ordenesTrabajo.vehicleId,
      clientId: ordenesTrabajo.clientId,
      description: ordenesTrabajo.description,
      status: ordenesTrabajo.status,
      hvAlert: ordenesTrabajo.hvAlert,
      hvLockoutSigned: ordenesTrabajo.hvLockoutSigned,
      dtcCodes: ordenesTrabajo.dtcCodes,
      totalCost: ordenesTrabajo.totalCost,
      createdAt: ordenesTrabajo.createdAt,
      updatedAt: ordenesTrabajo.updatedAt,
      vehiculo: sql<string>`COALESCE(${vehiculos.brand} || ' ' || ${vehiculos.model}, NULL)`,
      plate: vehiculos.plate,
      cliente: clients.name,
    })
    .from(ordenesTrabajo)
    .leftJoin(vehiculos, eq(ordenesTrabajo.vehicleId, vehiculos.id))
    .leftJoin(clients, eq(ordenesTrabajo.clientId, clients.id))
    .where(
      and(
        eq(ordenesTrabajo.id, orderId),
        eq(ordenesTrabajo.clientId, clientId),
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!order) return null;

  return {
    id: order.id,
    vehicleId: order.vehicleId,
    clientId: order.clientId,
    description: order.description,
    status: order.status,
    hvAlert: order.hvAlert,
    hvLockoutSigned: order.hvLockoutSigned,
    dtcCodes: order.dtcCodes,
    totalCost: order.totalCost,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    vehiculo: order.vehiculo,
    plate: order.plate,
    cliente: order.cliente,
  };
}

/**
 * Get client's invoices.
 */
export async function getClientInvoices(tenantSlug: string, clientId: string) {
  const { facturas } = await import("../../finance/schema/index.js");

  // facturas don't have clienteId directly — join through ordenes_trabajo
  return db()
    .select()
    .from(facturas)
    .innerJoin(ordenesTrabajo, eq(facturas.ordenId, ordenesTrabajo.id))
    .where(
      and(
        eq(facturas.tenantSlug, tenantSlug),
        eq(ordenesTrabajo.clientId, clientId),
      ),
    )
    .orderBy(desc(facturas.createdAt))
    .limit(20);
}

/**
 * Submit client feedback/rating for a work order.
 */
export async function submitFeedback(params: {
  tenantSlug: string;
  ordenId: string;
  clientId: string;
  rating: number; // 1-5
  comment?: string;
}) {
  // Validate rating
  if (params.rating < 1 || params.rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  // Check if order exists and belongs to client
  const [order] = await db()
    .select({ id: ordenesTrabajo.id })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.id, params.ordenId),
        eq(ordenesTrabajo.clientId, params.clientId),
      ),
    )
    .limit(1);

  if (!order) {
    throw new Error("Orden no encontrada o no pertenece al cliente");
  }

  // Store feedback (using notifications table for now)
  const { crearNotificacion } = await import(
    "../../workshop/services/notifications.service.js"
  );

  await crearNotificacion({
    tipo: "SISTEMA",
    titulo: `Feedback OT #${params.ordenId.substring(0, 8)} — ${params.rating}/5 ⭐`,
    mensaje: params.comment || `Calificación: ${params.rating}/5`,
    entityType: "orden_trabajo",
    entityId: params.ordenId,
    tenantSlug: params.tenantSlug,
  });

  return { success: true, rating: params.rating };
}

/**
 * Check appointment availability for a date.
 */
export async function checkAvailability(
  _tenantSlug: string,
  date: string,
): Promise<{ available: boolean; slots: string[] }> {
  // Inline availability check — returns standard Paraguayan workshop hours
  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 0; // Sunday closed in Paraguay

  return {
    available: !isWeekend,
    slots: isWeekend ? [] : ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
  };
}

/**
 * Book an appointment (client self-service).
 * Delegates to the scheduling module's createAgendamiento.
 * Sends WhatsApp + email confirmation after booking.
 */
export async function bookAppointment(params: {
  tenantSlug: string;
  clientId: string;
  vehicleId: string;
  date: string;
  time: string;
  motivo: string;
  phone: string;
}) {
  const { createAgendamiento } = await import(
    "../../scheduling/services/agendamiento.service.js"
  );

  const result = await createAgendamiento(
    {
      clienteNombre: params.clientId, // Will be resolved by service
      clientePhone: params.phone,
      vehiculoChapa: params.vehicleId, // Will be resolved by service
      vehiculoMarca: "",
      vehiculoModelo: "",
      fechaTurno: params.date,
      horaTurno: params.time,
      tipoServicio: "RAPIDO",
      notas: params.motivo,
    },
    params.tenantSlug,
    "portal",
  );

  // ── Send confirmation notifications (non-blocking) ──
  const agendamientoId = result.id;
  const tenantSlug = params.tenantSlug;

  // WhatsApp confirmation
  const { sendConfirmationMessage } = await import(
    "../../scheduling/jobs/reminder.cron.js"
  ).catch(() => ({ sendConfirmationMessage: async () => false }));

  sendConfirmationMessage(agendamientoId, tenantSlug).catch((err: any) => {
    console.warn(
      `[portal] Error enviando confirmación WhatsApp appointment ${agendamientoId}:`,
      err instanceof Error ? err.message : err,
    );
  });

  // Email confirmation
  const { smartSend } = await import(
    "../../email/services/email.service.js"
  ).catch(() => ({ smartSend: async () => {} }));

  const { serviceReminderTemplate } = await import(
    "../../email/templates/index.js"
  ).catch(() => ({ serviceReminderTemplate: () => "" }));

  // Resolve client email
  try {
    const [client] = await db()
      .select({ email: clients.email, name: clients.name })
      .from(clients)
      .where(eq(clients.id, params.clientId))
      .limit(1);

    if (client?.email) {
      const html = serviceReminderTemplate({
        cliente: client.name || "Cliente",
        vehiculo: params.vehicleId,
        tipoServicio: "Mantenimiento Rápido",
        fecha: params.date,
        hora: params.time,
      });

      smartSend({
        to: client.email,
        subject: `✅ Cita Agendada — ${params.date} a las ${params.time}`,
        html,
        entityType: "appointment_confirmation",
        entityId: agendamientoId,
        tenantSlug,
      }).catch((err: any) => {
        console.warn(
          `[portal] Error enviando email confirmación appointment ${agendamientoId}:`,
          err instanceof Error ? err.message : err,
        );
      });
    }
  } catch {
    // Client lookup failed — email confirmation skipped
  }

  return result;
}
