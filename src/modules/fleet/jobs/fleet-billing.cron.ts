/**
 * Fleet Billing Cron — Monthly check for due fleet contracts.
 *
 * Runs every 24 hours (configurable via FLEET_BILLING_INTERVAL_MS).
 * Generates invoices for contracts where proxima_factura <= now().
 *
 * @module fleet/jobs/fleet-billing.cron
 */

import { generateMonthlyInvoices } from "../services/recurring-billing.service.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ─── Cron Configuration ────────────────────────

const INTERVAL_MS = Number(process.env.FLEET_BILLING_INTERVAL_MS) || 24 * 60 * 60 * 1000;

let _running = false;
let _timer: ReturnType<typeof setInterval> | null = null;

// ─── Helpers ───────────────────────────────────

async function listTenantSlugs(): Promise<string[]> {
  try {
    const raw = await readFile(join(process.cwd(), "config", "tenants.json"), "utf-8");
    const tenants = JSON.parse(raw) as Array<Record<string, unknown>>;
    return tenants.map((t) => String(t.slug || "")).filter(Boolean);
  } catch {
    return ["default"];
  }
}

// ─── Cron Cycle ────────────────────────────────

async function runBilling(): Promise<void> {
  if (_running) {
    console.warn("[fleet-billing] Already running, skipping cycle");
    return;
  }
  _running = true;

  try {
    const tenants = await listTenantSlugs();
    let totalGenerated = 0;

    for (const tenantSlug of tenants) {
      try {
        const results = await generateMonthlyInvoices(tenantSlug);
        totalGenerated += results.length;
      } catch (err) {
        console.warn(
          `[fleet-billing] Error processing tenant "${tenantSlug}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (totalGenerated > 0) {
      console.log(
        `[fleet-billing] Cycle complete: ${totalGenerated} invoice(s) across ${tenants.length} tenant(s)`,
      );
    }
  } finally {
    _running = false;
  }
}

// ─── Public API ────────────────────────────────

/**
 * Starts the fleet billing cron job.
 */
export function startFleetBillingCron(): void {
  if (_timer) {
    console.warn("[fleet-billing] Cron already started");
    return;
  }

  console.log(`[fleet-billing] Cron started (interval: ${INTERVAL_MS / 3_600_000}h)`);

  _timer = setInterval(() => {
    runBilling().catch((err) => {
      console.warn("[fleet-billing] Periodic check failed:", err instanceof Error ? err.message : err);
    });
  }, INTERVAL_MS);
}

/**
 * Stops the fleet billing cron job.
 */
export function stopFleetBillingCron(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log("[fleet-billing] Cron stopped");
  }
}
