/**
 * CRM Sync Worker — Reverse sync ERP → Twenty CRM.
 *
 * Triggers when an order reaches FINALIZADO_RETIRADO (cobrado + entregado):
 *   1. Fetches client + vehicle + service + diagnostic data from ERP
 *   2. UPSERTs contact in Twenty CRM with full automotive context
 *   3. Logs the sync operation for auditing
 *
 * This is the bridge between the physical workshop and the CRM,
 * ensuring walk-in clients are captured for post-sale campaigns.
 *
 * RAM impact: ~5 KB (HTTP client, no persistent state).
 *
 * @module crm/services/crm-sync.worker
 */

import { and, eq, sql, desc, count } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import {
  ordenesTrabajo,
  clients,
  vehiculos,
  facturas,
  ordenServicios,
} from "../../../shared/database/schema/index.js";
import { crmSyncLog } from "../schema/crm-sync-log.js";
import { thinkcarImports } from "../../../modules/thinkcar/schema/index.js";
import { upsertContact } from "./twenty-crm.service.js";
import type { CrmSyncResult } from "../types.js";

// ─── Helpers ────────────────────────────────────────────

/**
 * Normalizes a Paraguayan phone number to E.164 format.
 *
 * Input formats:  "0981 123456", "0981123456", "+595981123456", "595981123456"
 * Output format:  "+595981123456"
 */
function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("595") && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+595${digits.slice(1)}`;
  }
  return `+595${digits}`;
}

/**
 * Validates Paraguayan RUC/C.I. format.
 * C.I.: 6-8 digits. RUC: 8 digits + dash + 1 check digit (e.g. "12345678-9").
 */
function isValidRuc(ruc: string): boolean {
  const cleaned = ruc.replace(/\s/g, "");
  // C.I.: 6-8 digits
  if (/^\d{6,8}$/.test(cleaned)) return true;
  // RUC: 8 digits + dash + 1 digit
  if (/^\d{8}-\d$/.test(cleaned)) return true;
  return false;
}

/**
 * Computes a stable integer from a UUID for PostgreSQL advisory locks.
 * Uses DJB2 hash — deterministic, uniform distribution.
 */
function advisoryLockKey(ordenId: string): number {
  let hash = 5381;
  for (let i = 0; i < ordenId.length; i++) {
    hash = ((hash << 5) + hash + ordenId.charCodeAt(i)) | 0;
  }
  return hash;
}

// ─── Sync Worker ───────────────────────────────────────

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

  // Sprint 58+: DB advisory lock — prevents concurrent syncs for same order
  // (safe across multiple Fastify instances behind a load balancer)
  const lockKey = advisoryLockKey(ordenId);
  const lockResult: any = await db().execute(
    sql`SELECT pg_try_advisory_lock(${lockKey}) as locked`,
  );
  const lockAcquired = lockResult?.rows?.[0]?.locked ?? false;

  if (!lockAcquired) {
    return {
      success: true,
      operation: "idempotent_skip",
      contactId: "in_progress",
      timestamp: new Date().toISOString(),
      durationMs: 0,
    };
  }

  try {
    // ── 0. Check for recent SUCCESSFUL sync (idempotency) ──
    const recentSync = await db()
      .select({ id: crmSyncLog.id })
      .from(crmSyncLog)
      .where(
        and(
          eq(crmSyncLog.ordenId, ordenId),
          eq(crmSyncLog.status, "success"),
        ),
      )
      .limit(1);

    if (recentSync.length > 0 && recentSync[0].id) {
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
        dtcCodes: ordenesTrabajo.dtcCodes,
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
        ruc: clients.ruc,
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

    // FIX #8: Normalize phone to E.164
    const normalizedPhone = normalizePhoneE164(clientRow.phone);

    // FIX #11: Validate RUC format (log warning, don't block)
    const rucValid = clientRow.ruc ? isValidRuc(clientRow.ruc) : true;
    if (clientRow.ruc && !rucValid) {
      console.warn(
        `[CRM] RUC format invalid for client ${clientRow.name}: "${clientRow.ruc}"`,
      );
    }

    // ── 3. Fetch vehicle data ──
    // FIX #1, #6: Added kilometraje, year, engineType, dtcCodes
    const [vehicleRow] = await db()
      .select({
        id: vehiculos.id,
        brand: vehiculos.brand,
        model: vehiculos.model,
        plate: vehiculos.plate,
        vin: vehiculos.vin,
        kilometraje: vehiculos.kilometraje,
        year: vehiculos.year,
        engineType: vehiculos.engineType,
        dtcCodes: vehiculos.dtcCodes,
      })
      .from(vehiculos)
      .where(eq(vehiculos.id, ordenRow.vehicleId))
      .limit(1);

    // ── 4. Fetch structured service types from ordenServicios ──
    // FIX #4: Query service line-items instead of free-text description
    const serviceItems = await db()
      .select({ servicioNombre: ordenServicios.servicioNombre })
      .from(ordenServicios)
      .where(eq(ordenServicios.ordenTrabajoId, ordenId));

    const structuredServiceType =
      serviceItems.length > 0
        ? serviceItems.map((s) => s.servicioNombre).join(", ")
        : ordenRow.description || "Servicio general";

    // ── 5. Fetch factura data (if exists) ──
    // FIX #9: Use numeroFacturaManual instead of UUID snippet
    const [facturaRow] = await db()
      .select({
        id: facturas.id,
        numeroFacturaManual: facturas.numeroFacturaManual,
      })
      .from(facturas)
      .where(eq(facturas.ordenId, ordenId))
      .limit(1);

    // ── 6. Fetch latest Thinkcar scan for DTC + health score ──
    // FIX #5: Sync healthScore and DTC history from diagnostic imports
    const [latestScan] = await db()
      .select({
        dtcCodes: thinkcarImports.dtcCodes,
        healthScore: thinkcarImports.healthScore,
        scanDate: thinkcarImports.scanDate,
      })
      .from(thinkcarImports)
      .where(eq(thinkcarImports.vehicleId, ordenRow.vehicleId))
      .orderBy(desc(thinkcarImports.scanDate))
      .limit(1);

    // Merge DTC codes: order-level + vehicle-level + latest scan
    const allDtcCodes = [
      ...(ordenRow.dtcCodes || []),
      ...(vehicleRow?.dtcCodes || []),
      ...(latestScan?.dtcCodes || []),
    ];
    const uniqueDtcCodes = [...new Set(allDtcCodes)].filter(Boolean);
    const dtcCodesStr =
      uniqueDtcCodes.length > 0 ? uniqueDtcCodes.join(", ") : undefined;

    // ── 7. Accumulate totalVisits / totalSpent ──
    // FIX #3: Query actual counts instead of hardcoding
    const [accumulation] = await db()
      .select({
        totalVisits: count(),
        totalSpent: sql<string>`COALESCE(SUM(${ordenesTrabajo.totalCost}::numeric), 0)`,
      })
      .from(ordenesTrabajo)
      .where(
        and(
          eq(ordenesTrabajo.clientId, ordenRow.clientId),
          eq(ordenesTrabajo.status, "Listo"),
        ),
      );

    const totalVisits = Number(accumulation?.totalVisits ?? 1);
    const totalSpent = Number(accumulation?.totalSpent ?? 0);

    // ── 8. Build invoice number ──
    const invoiceNumber =
      facturaRow?.numeroFacturaManual ||
      facturaRow?.id?.substring(0, 8).toUpperCase() ||
      undefined;

    // ── 9. Perform UPSERT to Twenty CRM ──
    const upsertResult = await upsertContact(
      {
        name: clientRow.name,
        phone: normalizedPhone,
        email: clientRow.email || undefined,
        documentId: clientRow.ruc || undefined,
      },
      {
        plate: vehicleRow?.plate || "S/N",
        brand: vehicleRow?.brand || "N/A",
        model: vehicleRow?.model || "N/A",
        vin: vehicleRow?.vin || undefined,
        mileage: vehicleRow?.kilometraje || undefined,
        year: vehicleRow?.year || undefined,
        engineType: vehicleRow?.engineType || undefined,
        dtcCodes: dtcCodesStr,
        healthScore: latestScan?.healthScore ?? undefined,
      },
      ordenId,
      {
        type: structuredServiceType,
        totalCost: Number(ordenRow.totalCost || 0),
        invoiceNumber,
        totalVisits,
        totalSpent,
      },
    );

    // ── 10. Log the sync ──
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
        phone: normalizedPhone,
        vehicle: vehicleRow
          ? `${vehicleRow.brand} ${vehicleRow.model} (${vehicleRow.year || "?"})`
          : "N/A",
        plate: vehicleRow?.plate,
        serviceType: structuredServiceType,
        dtcCodes: dtcCodesStr,
        healthScore: latestScan?.healthScore,
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
  } finally {
    // Release DB advisory lock
    await db().execute(sql`SELECT pg_advisory_unlock(${lockKey})`);
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
  // FIX: Filter by tenantSlug to prevent cross-tenant data access
  const failedSyncs = await db()
    .select()
    .from(crmSyncLog)
    .where(
      and(
        eq(crmSyncLog.status, "failed"),
        eq(crmSyncLog.tenantSlug, tenantSlug),
      ),
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
  const [stats] = await db()
    .select({
      total: sql<number>`COUNT(*)::int`,
      success: sql<number>`COUNT(CASE WHEN ${crmSyncLog.status} = 'success' THEN 1 END)::int`,
      failed: sql<number>`COUNT(CASE WHEN ${crmSyncLog.status} = 'failed' THEN 1 END)::int`,
      pending: sql<number>`COUNT(CASE WHEN ${crmSyncLog.status} = 'pending' THEN 1 END)::int`,
    })
    .from(crmSyncLog)
    .where(eq(crmSyncLog.tenantSlug, tenantSlug));

  return {
    total: stats?.total ?? 0,
    success: stats?.success ?? 0,
    failed: stats?.failed ?? 0,
    pending: stats?.pending ?? 0,
  };
}
