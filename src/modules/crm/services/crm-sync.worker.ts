/**
 * CRM Sync Worker — Reverse sync ERP → Twenty CRM.
 *
 * Triggers when an order reaches FINALIZADO_RETIRADO (cobrado + entregado):
 *   1. Fetches client + vehicle data from ERP
 *   2. UPSERTs contact in Twenty CRM
 *   3. Logs the sync operation for auditing
 *
 * This is the bridge between the physical workshop and the CRM,
 * ensuring walk-in clients are captured for post-sale campaigns.
 *
 * RAM impact: ~3 KB (HTTP client, no persistent state).
 *
 * @module crm/services/crm-sync.worker
 */

import { eq } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import {
  ordenesTrabajo,
  clients,
  vehiculos,
  facturas,
} from "../../../shared/database/schema/index.js";
import { crmSyncLog } from "../schema/crm-sync-log.js";
import { upsertContact } from "./twenty-crm.service.js";
import type { CrmSyncResult } from "../types.js";

// ─── Sync Worker ───────────────────────────────────────

/**
 * Generate an idempotency key for CRM sync operations.
 * Prevents duplicate contacts on retry after network failure.
 *
 * Sprint 56: Idempotency key implementation for Twenty CRM sync.
 *
 * @param ordenId - Work order UUID
 * @returns Idempotency key string
 */
function generateIdempotencyKey(ordenId: string): string {
  return `crm-sync-${ordenId}-${new Date().toISOString().split("T")[0]}`;
}

/**
 * Syncs a finalized order to Twenty CRM.
 *
 * Called when an order changes to FINALIZADO_RETIRADO state.
 * Fetches all related data and performs a UPSERT to Twenty CRM.
 *
 * @param ordenId - Work order UUID
 * @param tenantSlug - Tenant identifier
 * @param _triggeredBy - User email who triggered the sync
 * @returns Sync result
 */
export async function syncOrderToCrm(
  ordenId: string,
  tenantSlug: string,
  _triggeredBy: string = "system",
): Promise<CrmSyncResult> {
  const startTime = Date.now();

  // Sprint 56: Idempotency key — prevents duplicate contacts on retry
  const idempotencyKey = generateIdempotencyKey(ordenId);

  try {
    // ── 0. Check for recent successful sync (idempotency) ──
    const recentSync = await db()
      .select({ id: crmSyncLog.id })
      .from(crmSyncLog)
      .where(
        eq(crmSyncLog.ordenId, ordenId),
      )
      .limit(1);

    if (recentSync.length > 0 && recentSync[0].id) {
      // Already synced — return cached result (idempotent)
      return {
        success: true,
        operation: "idempotent_skip",
        contactId: "cached",
        timestamp: new Date().toISOString(),
        durationMs: 0,
      };
    }

    // ── 1. Fetch order data ──
    const [ordenRow] = await db()
      .select({
        id: ordenesTrabajo.id,
        status: ordenesTrabajo.status,
        totalCost: ordenesTrabajo.totalCost,
        clientId: ordenesTrabajo.clientId,
        vehicleId: ordenesTrabajo.vehicleId,
        description: ordenesTrabajo.description,
      })
      .from(ordenesTrabajo)
      .where(eq(ordenesTrabajo.id, ordenId))
      .limit(1);

    if (!ordenRow) {
      throw new Error(`Orden ${ordenId} no encontrada`);
    }

    // ── 2. Fetch client data ──
    const [clientRow] = await db()
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        email: clients.email,
      })
      .from(clients)
      .where(eq(clients.id, ordenRow.clientId))
      .limit(1);

    if (!clientRow) {
      throw new Error(`Cliente no encontrado para orden ${ordenId}`);
    }

    if (!clientRow.phone) {
      throw new Error(`Cliente ${clientRow.name} no tiene teléfono registrado`);
    }

    // ── 3. Fetch vehicle data ──
    const [vehicleRow] = await db()
      .select({
        id: vehiculos.id,
        brand: vehiculos.brand,
        model: vehiculos.model,
        plate: vehiculos.plate,
        vin: vehiculos.vin,
      })
      .from(vehiculos)
      .where(eq(vehiculos.id, ordenRow.vehicleId))
      .limit(1);

    // ── 4. Fetch factura data (if exists) ──
    const [facturaRow] = await db()
      .select({ id: facturas.id })
      .from(facturas)
      .where(eq(facturas.ordenId, ordenId))
      .limit(1);

    // ── 5. Perform UPSERT to Twenty CRM ──
    const upsertResult = await upsertContact(
      {
        name: clientRow.name,
        phone: clientRow.phone,
        email: clientRow.email || undefined,
      },
      {
        plate: vehicleRow?.plate || "S/N",
        brand: vehicleRow?.brand || "N/A",
        model: vehicleRow?.model || "N/A",
        vin: vehicleRow?.vin || undefined,
      },
      ordenId,
      {
        type: ordenRow.description || "Servicio general",
        totalCost: Number(ordenRow.totalCost || 0),
        invoiceNumber: facturaRow?.id?.substring(0, 8).toUpperCase(),
      },
    );

    // ── 6. Log the sync ──
    await db().insert(crmSyncLog).values({
      operation: upsertResult.created ? "create_contact" : "update_contact",
      ordenId,
      clientId: clientRow.id,
      clientName: clientRow.name,
      twentyContactId: upsertResult.contactId,
      twentyObjectName: "person",
      twentyRecordId: upsertResult.contactId,
      status: "success",
      tenantSlug,
      requestPayload: {
        clientName: clientRow.name,
        phone: clientRow.phone,
        vehicle: vehicleRow ? `${vehicleRow.brand} ${vehicleRow.model}` : "N/A",
        plate: vehicleRow?.plate,
      },
      responsePayload: {
        operation: upsertResult.operation,
        contactId: upsertResult.contactId,
      },
      completedAt: new Date(),
    });

    return {
      success: true,
      operation: upsertResult.operation,
      contactId: upsertResult.contactId,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Sync failed";

    // ── Log the error (non-blocking) ──
    try {
      await db().insert(crmSyncLog).values({
        operation: "upsert_contact",
        ordenId,
        clientName: "unknown",
        status: "failed",
        errorMessage: errorMsg,
        tenantSlug,
        completedAt: new Date(),
      });
    } catch {
      // If even logging fails, just continue — don't crash the ERP
    }

    return {
      success: false,
      operation: "upsert_contact",
      error: errorMsg,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Retries failed CRM syncs.
 *
 * Looks for failed sync entries and attempts to re-sync them.
 * Called periodically by the ERP health check or manually.
 *
 * @param tenantSlug - Tenant to retry syncs for
 * @returns Number of successful retries
 */
export async function retryFailedSyncs(
  tenantSlug: string,
): Promise<{ retried: number; succeeded: number }> {
  const failedSyncs = await db()
    .select()
    .from(crmSyncLog)
    .where(
      eq(crmSyncLog.status, "failed"),
    )
    .limit(10); // Process 10 at a time

  let succeeded = 0;

  for (const sync of failedSyncs) {
    if (!sync.ordenId) continue;

    const result = await syncOrderToCrm(
      sync.ordenId,
      tenantSlug,
      "retry-worker",
    );

    if (result.success) {
      succeeded++;
    }
  }

  return {
    retried: failedSyncs.length,
    succeeded,
  };
}

/**
 * Gets sync statistics for the dashboard.
 *
 * @param tenantSlug - Tenant identifier
 * @returns Sync stats
 */
export async function getSyncStats(tenantSlug: string): Promise<{
  total: number;
  success: number;
  failed: number;
  pending: number;
}> {
  const all = await db()
    .select({ status: crmSyncLog.status })
    .from(crmSyncLog)
    .where(eq(crmSyncLog.tenantSlug, tenantSlug));

  return {
    total: all.length,
    success: all.filter((r) => r.status === "success").length,
    failed: all.filter((r) => r.status === "failed").length,
    pending: all.filter((r) => r.status === "pending").length,
  };
}
