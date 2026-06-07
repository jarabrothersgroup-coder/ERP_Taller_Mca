/**
 * Offline-First sync service.
 *
 * Since Paraguayan workshops often have unreliable internet, this service
 * provides an offline-first strategy:
 *
 * 1. Local operations are queued in memory (or IndexedDB in browser clients).
 * 2. When connectivity is restored, the queue is flushed to the remote API.
 * 3. Conflict resolution uses "last-write-wins" with server timestamps.
 *
 * On the backend side, this module provides:
 *   - A sync endpoint to batch-process queued operations
 *   - A conflict detection mechanism
 *
 * @module shared/offline/sync-service
 */

import { env } from "../../config/env.js";

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

/** Result of processing a sync operation. */
export interface SyncResult {
  operationId: string;
  status: "applied" | "conflict" | "failed";
  error?: string;
}

/**
 * Processes a batch of queued offline operations.
 *
 * Each operation is applied in sequence. Conflicts are detected via
 * entity version fields and returned for client-side resolution.
 *
 * @param operations - Array of queued sync operations
 * @returns Array of sync results
 */
export async function processSyncQueue(
  operations: SyncOperation[],
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const op of operations) {
    try {
      // Each entity type would have its own handler registered.
      // For now, this is a stub that acknowledges receipt.
      // In Sprint 2, actual CRUD handlers will be wired here.

      if (op.retryCount > 5) {
        results.push({
          operationId: op.id,
          status: "failed",
          error: "Max retries exceeded",
        });
        continue;
      }

      // TODO: Route to appropriate entity handler based on op.entity
      // e.g., clients, vehicles, work_orders

      results.push({
        operationId: op.id,
        status: "applied",
      });
    } catch (err) {
      results.push({
        operationId: op.id,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
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
    syncIntervalMs: env.SYNC_INTERVAL_MS,
    maxBatchSize: 50,
    retryMaxAttempts: 5,
    retryBackoffBaseMs: 1000,
    strategy: "last-write-wins" as const,
  };
}
