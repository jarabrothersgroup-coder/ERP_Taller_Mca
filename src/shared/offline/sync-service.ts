/**
 * Offline-First Sync Service — Entity Router.
 *
 * Since Paraguayan workshops often have unreliable internet, this service
 * provides an offline-first strategy:
 *
 * 1. Local operations are queued in memory (or IndexedDB in browser clients).
 * 2. When connectivity is restored, the queue is flushed to the remote API.
 * 3. Each operation is routed to the appropriate entity handler based on
 *    `op.entity` (clients, vehicles, work-orders, ingresos, inventory).
 * 4. Conflict resolution uses "last-write-wins" with server timestamps.
 * 5. Max 5 retries per operation before permanent failure.
 *
 * Handler registry pattern — adding a new entity handler is a single
 * entry in the `entityHandlers` map.
 *
 * @module shared/offline/sync-service
 */

import { db } from "../database/drizzle.js";
import { ordenesTrabajo } from "../../modules/workshop/schema/index.js";
import { eq, and } from "drizzle-orm";
import { AppError } from "../errors/app-error.js";
import { createClient, updateClient, deleteClient } from "../../modules/workshop/services/client.service.js";
import { createVehicle, updateVehicle, deleteVehicle } from "../../modules/workshop/services/vehicle.service.js";
import { createIngreso } from "../../modules/workshop/services/ingreso.service.js";
import { updateOrdenStatus } from "../../modules/workshop/services/orden.service.js";

// ─── Types ─────────────────────────────────────

/** Represents a single offline operation to be synced. */
export interface SyncOperation {
  id: string;
  tenant: string;
  entity: string;
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

/** Result of processing a single sync operation. */
export interface SyncResult {
  operationId: string;
  status: "applied" | "conflict" | "failed";
  error?: string;
}

/** Max retries before giving up on an operation. */
const MAX_RETRIES = 5;

// ─── Handler type ──────────────────────────────

type EntityHandler = (
  action: "create" | "update" | "delete",
  payload: Record<string, unknown>,
  context?: { tenantSlug: string },
) => Promise<SyncResult>;

// ─── Entity Handlers ───────────────────────────

/**
 * Handler for the "clients" entity.
 */
const clientsHandler: EntityHandler = async (action, payload, context) => {
  switch (action) {
    case "create": {
      await createClient(payload, context?.tenantSlug);
      return { operationId: "", status: "applied" };
    }
    case "update": {
      const id = payload["id"] as string;
      if (!id) {
        return { operationId: "", status: "failed", error: "Se requiere 'id' para actualizar un cliente" };
      }
      await updateClient(id, payload, context?.tenantSlug);
      return { operationId: "", status: "applied" };
    }
    case "delete": {
      const id = payload["id"] as string;
      if (!id) {
        return { operationId: "", status: "failed", error: "Se requiere 'id' para eliminar un cliente" };
      }
      await deleteClient(id, context?.tenantSlug);
      return { operationId: "", status: "applied" };
    }
    default:
      return { operationId: "", status: "failed", error: `Acción desconocida: ${action}` };
  }
};

/**
 * Handler for the "vehicles" entity.
 */
const vehiclesHandler: EntityHandler = async (action, payload, context) => {
  switch (action) {
    case "create": {
      await createVehicle(payload, context?.tenantSlug);
      return { operationId: "", status: "applied" };
    }
    case "update": {
      const id = payload["id"] as string;
      if (!id) {
        return { operationId: "", status: "failed", error: "Se requiere 'id' para actualizar un vehículo" };
      }
      await updateVehicle(id, payload, context?.tenantSlug);
      return { operationId: "", status: "applied" };
    }
    case "delete": {
      const id = payload["id"] as string;
      if (!id) {
        return { operationId: "", status: "failed", error: "Se requiere 'id' para eliminar un vehículo" };
      }
      await deleteVehicle(id, context?.tenantSlug);
      return { operationId: "", status: "applied" };
    }
    default:
      return { operationId: "", status: "failed", error: `Acción desconocida: ${action}` };
  }
};

/**
 * Handler for the "work-orders" entity.
 *
 * Create inserts an orden de trabajo directly (status: Presupuestado).
 * Update transitions the order status.
 * Delete is not supported for work orders (use status lifecycle instead).
 */
const workOrdersHandler: EntityHandler = async (action, payload, context) => {
  switch (action) {
    case "create": {
      const vehicleId = payload["vehicleId"] as string;
      const clientId = payload["clientId"] as string;
      if (!vehicleId || !clientId) {
        return {
          operationId: "",
          status: "failed",
          error: "Se requieren 'vehicleId' y 'clientId' para crear una orden",
        };
      }

      await db()
        .insert(ordenesTrabajo)
        .values({
          vehicleId,
          clientId,
          description: typeof payload["description"] === "string" ? payload["description"] : null,
          status: "Presupuestado",
          tenantSlug: context?.tenantSlug ?? "default",
          dtcCodes: Array.isArray(payload["dtcCodes"]) ? (payload["dtcCodes"] as string[]) : null,
          hvAlert: payload["hvAlert"] === true,
        });

      return { operationId: "", status: "applied" };
    }
    case "update": {
      const id = payload["id"] as string;
      if (!id) {
        return { operationId: "", status: "failed", error: "Se requiere 'id' para actualizar una orden" };
      }

      // If status update, use the dedicated service
      if (payload["status"]) {
        await updateOrdenStatus(id, payload["status"] as string, context?.tenantSlug);
      } else {
        // Generic field update (description, dtcCodes, hvAlert, etc.)
        const updateData: Record<string, unknown> = {};
        if (payload["description"] !== undefined) updateData["description"] = payload["description"];
        if (payload["dtcCodes"] !== undefined) updateData["dtcCodes"] = payload["dtcCodes"];
        if (payload["hvAlert"] !== undefined) updateData["hvAlert"] = payload["hvAlert"];
        updateData["updatedAt"] = new Date();

        const dbConditions = [eq(ordenesTrabajo.id, id)];
        if (context?.tenantSlug) {
          dbConditions.push(eq(ordenesTrabajo.tenantSlug, context.tenantSlug));
        }
        await db()
          .update(ordenesTrabajo)
          .set(updateData)
          .where(and(...dbConditions));
      }

      return { operationId: "", status: "applied" };
    }
    case "delete": {
      return {
        operationId: "",
        status: "failed",
        error: "Las órdenes de trabajo no se eliminan por sync. Use el ciclo de estados (Anulada/Listo).",
      };
    }
    default:
      return { operationId: "", status: "failed", error: `Acción desconocida: ${action}` };
  }
};

/**
 * Handler for the "ingresos" entity (vehicle check-in).
 */
const ingresosHandler: EntityHandler = async (action, payload, context) => {
  switch (action) {
    case "create": {
      await createIngreso({
        vehicleId: payload["vehicleId"] as string,
        kilometraje: payload["kilometraje"] as number | undefined,
        nivelCombustible: payload["nivelCombustible"] as string | undefined,
        estadoExterior: payload["estadoExterior"] as string | undefined,
        observaciones: payload["observaciones"] as string | undefined,
        crearOrden: payload["crearOrden"] === true,
        descripcionTrabajo: payload["descripcionTrabajo"] as string | undefined,
      }, context?.tenantSlug);
      return { operationId: "", status: "applied" };
    }
    case "update":
    case "delete": {
      return {
        operationId: "",
        status: "failed",
        error: `Acción '${action}' no soportada para ingresos. Use create para registrar ingresos.`,
      };
    }
    default:
      return { operationId: "", status: "failed", error: `Acción desconocida: ${action}` };
  }
};

/**
 * Handler for the "inventory" entity (generic inventory items such as repuestos).
 *
 * This is a simplified handler. Full inventory CRUD should use the dedicated
 * inventory module endpoints for complex operations.
 */
const inventoryHandler: EntityHandler = async (action, _payload) => {
  // For now, return a graceful message since full inventory sync
  // requires the inventory service which handles barcodes, stock levels, etc.
  switch (action) {
    case "create":
    case "update":
    case "delete": {
      return {
        operationId: "",
        status: "failed",
        error: `Inventory operations require the dedicated inventory module. Use the inventory API directly for '${action}' operations.`,
      };
    }
    default:
      return { operationId: "", status: "failed", error: `Acción desconocida: ${action}` };
  }
};

// ─── Handler Registry ──────────────────────────

const entityHandlers: Record<string, EntityHandler> = {
  "clients": clientsHandler,
  "vehicles": vehiclesHandler,
  "work-orders": workOrdersHandler,
  "ingresos": ingresosHandler,
  "inventory": inventoryHandler,
};

// ─── Public API ────────────────────────────────

/**
 * Processes a batch of queued offline operations.
 *
 * Each operation is routed to the registered handler for its entity type.
 * Conflicts and errors are captured per-operation so a single failure
 * does not block the entire batch.
 *
 * @param operations - Array of queued sync operations
 * @returns Array of sync results (one per operation, in the same order)
 */
export async function processSyncQueue(
  operations: SyncOperation[],
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const op of operations) {
    // ── Retry guard ──
    if (op.retryCount > MAX_RETRIES) {
      results.push({
        operationId: op.id,
        status: "failed",
        error: "Max retries exceeded",
      });
      continue;
    }

    // ── Route to entity handler ──
    const handler = entityHandlers[op.entity];

    if (!handler) {
      results.push({
        operationId: op.id,
        status: "failed",
        error: `Unknown entity: ${op.entity}. Supported entities: ${Object.keys(entityHandlers).join(", ")}`,
      });
      continue;
    }

    try {
      const result = await handler(op.action, op.payload, { tenantSlug: op.tenant ?? "default" });
      // Propagate the operation ID into the result
      results.push({
        ...result,
        operationId: op.id,
      });
    } catch (err: unknown) {
      const message =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown sync error";

      results.push({
        operationId: op.id,
        status: "failed",
        error: message,
      });
    }
  }

  return results;
}

/**
 * Returns the current sync configuration.
 * Used by clients to tune their offline behavior.
 */
export function getSyncConfig() {
  return {
    syncIntervalMs: Number(process.env["SYNC_INTERVAL_MS"] ?? "30000"),
    maxBatchSize: 50,
    retryMaxAttempts: MAX_RETRIES,
    retryBackoffBaseMs: 1000,
    strategy: "last-write-wins" as const,
    supportedEntities: Object.keys(entityHandlers),
  };
}
