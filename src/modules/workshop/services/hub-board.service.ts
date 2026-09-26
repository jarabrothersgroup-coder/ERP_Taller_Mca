/**
 * Hub Board Service — aggregated Operations Hub payload + SSE registry.
 *
 * Replaces the client-side fan-out (3 requests + join on every poll):
 *   GET /workshop/hub/board        → OTs (open) + technicians, joined server-side
 *   GET /workshop/hub/board/stream → SSE that pings when the board changes
 *
 * The board only serves OPEN orders (status != Finalizado_Retirado);
 * delivered vehicles leave the board by design.
 *
 * @module workshop/services/hub-board.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { ordenesTrabajo, vehiculos, type EstadoOrden } from "../schema/index.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { listActiveTecnicos, type TecnicoRow } from "./tecnicos.service.js";
import { eq, and, desc, notInArray } from "drizzle-orm";
import type { FastifyReply } from "fastify";

/** Statuses excluded from the board (terminal state stays out). */
const BOARD_EXCLUDED_STATUSES = ["Finalizado_Retirado"] as const;

/** Default page size for the board payload. */
const BOARD_DEFAULT_LIMIT = 100;

/** One kanban card of the Operations Hub board. */
export interface HubBoardOT {
  id: string;
  vehicleId: string;
  clientId: string;
  description: string | null;
  status: string;
  hvAlert: boolean;
  totalCost: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: string | null;
  vehiculo: string | null;
  plate: string | null;
  cliente: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
}

/** Aggregated board payload served by GET /workshop/hub/board */
export interface HubBoardPayload {
  ordenes: HubBoardOT[];
  tecnicos: TecnicoRow[];
  generatedAt: string;
}

/**
 * Builds the full board payload in a single round trip:
 * open orders (with vehicle/client join) + active technicians.
 *
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @param limit - Max orders (default 100)
 */
export async function getHubBoard(
  tenantSlug: string,
  limit = BOARD_DEFAULT_LIMIT,
): Promise<HubBoardPayload> {
  const [ordenes, tecnicos] = await Promise.all([
    db()
      .select({
        id: ordenesTrabajo.id,
        vehicleId: ordenesTrabajo.vehicleId,
        clientId: ordenesTrabajo.clientId,
        description: ordenesTrabajo.description,
        status: ordenesTrabajo.status,
        hvAlert: ordenesTrabajo.hvAlert,
        totalCost: ordenesTrabajo.totalCost,
        createdAt: ordenesTrabajo.createdAt,
        updatedAt: ordenesTrabajo.updatedAt,
        assignedTo: ordenesTrabajo.assignedTo,
        vehiculo: vehiculos.brand,
        vehiculoModelo: vehiculos.model,
        plate: vehiculos.plate,
        cliente: clients.name,
        clientPhone: clients.phone,
        clientEmail: clients.email,
      })
      .from(ordenesTrabajo)
      .leftJoin(vehiculos, eq(ordenesTrabajo.vehicleId, vehiculos.id))
      .leftJoin(clients, eq(ordenesTrabajo.clientId, clients.id))
      .where(and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        notInArray(ordenesTrabajo.status, [...BOARD_EXCLUDED_STATUSES] as EstadoOrden[]),
      ))
      .orderBy(desc(ordenesTrabajo.createdAt))
      .limit(limit),
    listActiveTecnicos(tenantSlug),
  ]);

  return {
    ordenes: ordenes.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      clientId: r.clientId,
      description: r.description,
      status: r.status,
      hvAlert: r.hvAlert,
      totalCost: r.totalCost,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      assignedTo: r.assignedTo,
      vehiculo: r.vehiculo || r.vehiculoModelo
        ? `${r.vehiculo ?? ""} ${r.vehiculoModelo ?? ""}`.trim() || null
        : null,
      plate: r.plate,
      cliente: r.cliente,
      clientPhone: r.clientPhone,
      clientEmail: r.clientEmail,
    })),
    tecnicos,
    generatedAt: new Date().toISOString(),
  };
}

// ─── SSE registry (board change pings) ──────────

/** SSE board clients per tenant. */
const boardClients: Map<string, Set<FastifyReply>> = new Map();

/**
 * Registers an SSE reply for board-change pings.
 *
 * The stream carries ONLY lightweight `board_changed` pings — clients
 * refetch GET /workshop/hub/board on each ping. Payloads never flow
 * through SSE, keeping auth/tenant guarantees in the request path.
 */
export function registerBoardSseClient(
  tenantSlug: string,
  reply: FastifyReply,
  onClose: () => void,
): () => void {
  if (!boardClients.has(tenantSlug)) {
    boardClients.set(tenantSlug, new Set());
  }
  const set = boardClients.get(tenantSlug)!;
  set.add(reply);

  // Heartbeat keeps proxies from closing the idle stream.
  const heartbeat = setInterval(() => {
    try {
      reply.raw.write(`:heartbeat ${Date.now()}\n\n`);
    } catch {
      // client gone — cleanup happens via onClose
    }
  }, 30_000);

  return () => {
    clearInterval(heartbeat);
    set.delete(reply);
    if (set.size === 0) boardClients.delete(tenantSlug);
    onClose();
  };
}

/**
 * Pings every connected board client of a tenant that the board changed.
 * Called from orden service after status changes and OT creation.
 *
 * @returns Number of clients pinged
 */
export function broadcastBoardChanged(tenantSlug: string): number {
  const clients = boardClients.get(tenantSlug);
  if (!clients || clients.size === 0) return 0;

  const payload = JSON.stringify({
    type: "board_changed",
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  for (const client of clients) {
    try {
      client.raw.write(`data: ${payload}\n\n`);
      sent++;
    } catch {
      clients.delete(client);
    }
  }
  return sent;
}
