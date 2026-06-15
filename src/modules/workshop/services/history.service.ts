/**
 * History Service — Vehicle & Client history queries.
 *
 * Aggregates related data across multiple tables for comprehensive
 * vehicle and client views.
 *
 * @module workshop/services/history.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { eq, and, desc } from "drizzle-orm";
import { vehiculos } from "../schema/vehiculos.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { ordenesTrabajo } from "../schema/ordenes-trabajo.js";
import { ordenServicios } from "../schema/orden-servicios.js";
import { ordenRepuestos } from "../schema/orden-repuestos.js";

// ─── Types ──────────────────────────────────────

export interface VehicleHistory {
  vehicle: any;
  ordenes: any[];
  totalOrdenes: number;
}

export interface ClientHistory {
  client: any;
  vehicles: any[];
  ordenes: any[];
  totalVehicles: number;
  totalOrdenes: number;
}

// ─── Vehicle History ────────────────────────────

/**
 * Get full history for a vehicle: basic info + all work orders with items.
 */
export async function getVehicleHistory(
  vehicleId: string,
  tenantSlug: string,
): Promise<VehicleHistory> {
  // Get vehicle
  const [vehicle] = await db()
    .select()
    .from(vehiculos)
    .where(and(eq(vehiculos.id, vehicleId), eq(vehiculos.tenantSlug, tenantSlug)))
    .limit(1);

  if (!vehicle) return { vehicle: null, ordenes: [], totalOrdenes: 0 };

  // Get all work orders for this vehicle, with services + parts
  const ordenes = await db()
    .select()
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.vehicleId, vehicleId))
    .orderBy(desc(ordenesTrabajo.createdAt));

  // Enrich each order with its services and parts
  const enrichedOrdenes = await Promise.all(
    ordenes.map(async (ot) => {
      const [servicios, repuestos] = await Promise.all([
        db()
          .select()
          .from(ordenServicios)
          .where(eq(ordenServicios.ordenTrabajoId, ot.id)),
        db()
          .select()
          .from(ordenRepuestos)
          .where(eq(ordenRepuestos.ordenTrabajoId, ot.id)),
      ]);
      return { ...ot, servicios, repuestos };
    }),
  );

  return {
    vehicle,
    ordenes: enrichedOrdenes,
    totalOrdenes: ordenes.length,
  };
}

// ─── Client History ─────────────────────────────

/**
 * Get full history for a client: basic info + all vehicles + all their work orders.
 */
export async function getClientHistory(
  clientId: string,
  tenantSlug: string,
): Promise<ClientHistory> {
  // Get client
  const [client] = await db()
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.tenantSlug, tenantSlug)))
    .limit(1);

  if (!client) return { client: null, vehicles: [], ordenes: [], totalVehicles: 0, totalOrdenes: 0 };

  // Get all vehicles owned by this client
  const vehicles = await db()
    .select()
    .from(vehiculos)
    .where(eq(vehiculos.clientId, clientId))
    .orderBy(desc(vehiculos.createdAt));

  // Get all work orders across all vehicles of this client
  const vehicleIds = vehicles.map((v) => v.id);
  if (vehicleIds.length === 0) {
    return { client, vehicles: [], ordenes: [], totalVehicles: 0, totalOrdenes: 0 };
  }

  const ordenes = await db()
    .select()
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.clientId, clientId))
    .orderBy(desc(ordenesTrabajo.createdAt));

  return {
    client,
    vehicles,
    ordenes,
    totalVehicles: vehicles.length,
    totalOrdenes: ordenes.length,
  };
}
