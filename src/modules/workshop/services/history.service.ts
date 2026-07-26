/**
 * History Service — Vehicle & Client history queries.
 *
 * Aggregates related data across multiple tables for comprehensive
 * vehicle and client views.
 *
 * @module workshop/services/history.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { eq, and, desc, inArray } from "drizzle-orm";
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

  // Enrich all orders with services + parts in 2 batch queries instead of 2*N
  const ordenIds = ordenes.map((ot) => ot.id);
  if (ordenIds.length > 0) {
    const [allServicios, allRepuestos] = await Promise.all([
      db().select().from(ordenServicios).where(inArray(ordenServicios.ordenTrabajoId, ordenIds)),
      db().select().from(ordenRepuestos).where(inArray(ordenRepuestos.ordenTrabajoId, ordenIds)),
    ]);
    const serviciosMap = new Map<string, typeof allServicios>();
    const repuestosMap = new Map<string, typeof allRepuestos>();
    for (const s of allServicios) {
      const key = s.ordenTrabajoId;
      if (!serviciosMap.has(key)) serviciosMap.set(key, []);
      serviciosMap.get(key)!.push(s);
    }
    for (const r of allRepuestos) {
      const key = r.ordenTrabajoId;
      if (!repuestosMap.has(key)) repuestosMap.set(key, []);
      repuestosMap.get(key)!.push(r);
    }
    return {
      vehicle,
      ordenes: ordenes.map((ot) => ({
        ...ot,
        servicios: serviciosMap.get(ot.id) ?? [],
        repuestos: repuestosMap.get(ot.id) ?? [],
      })),
      totalOrdenes: ordenes.length,
    };
  }

  return {
    vehicle,
    ordenes: ordenes.map((ot) => ({ ...ot, servicios: [], repuestos: [] })),
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
