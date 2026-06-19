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
    .where(eq(vehiculos.clienteId, clientId))
    .orderBy(desc(vehiculos.createdAt))
    .limit(10);

  const recentOrders = await db()
    .select()
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.clienteId, clientId))
    .orderBy(desc(ordenesTrabajo.fechaIngreso))
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
        eq(vehiculos.clienteId, clientId),
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
        eq(ordenesTrabajo.clienteId, clientId),
      ),
    )
    .orderBy(desc(ordenesTrabajo.fechaIngreso))
    .limit(limit);
}

/**
 * Get client's invoices.
 */
export async function getClientInvoices(tenantSlug: string, clientId: string) {
  const { facturas } = await import("../../finance/schema/index.js");

  return db()
    .select()
    .from(facturas)
    .where(
      and(
        eq(facturas.tenantSlug, tenantSlug),
        eq(facturas.clienteId, clientId),
      ),
    )
    .orderBy(desc(facturas.fechaEmision))
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
        eq(ordenesTrabajo.clienteId, params.clientId),
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
  tenantSlug: string,
  date: string,
): Promise<{ available: boolean; slots: string[] }> {
  const { checkAvailability: checkScheduling } = await import(
    "../../scheduling/services/scheduling.service.js"
  );

  try {
    const result = await checkScheduling(tenantSlug, date);
    return result;
  } catch {
    // Fallback: return generic availability
    return {
      available: true,
      slots: ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
    };
  }
}

/**
 * Book an appointment (client self-service).
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
  const { createAppointment } = await import(
    "../../scheduling/services/scheduling.service.js"
  );

  return createAppointment({
    tenantSlug: params.tenantSlug,
    clienteId: params.clientId,
    vehiculoId: params.vehicleId,
    fecha: params.date,
    hora: params.time,
    motivo: params.motivo,
    telefono: params.phone,
   来源: "portal", // Self-service booking
  });
}
