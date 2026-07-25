/**
 * Reorder Check Cron — Periodically checks for low-stock items
 * and generates automatic purchase orders from pending reorder alerts.
 *
 * Runs every 6 hours (configurable via REORDER_CHECK_INTERVAL_MS).
 *
 * @module inventory/jobs/reorder-check.cron
 */

import { generateAutoPOs } from "../services/auto-po.service.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ─── Cron Configuration ────────────────────────

const INTERVAL_MS = Number(process.env.REORDER_CHECK_INTERVAL_MS) || 6 * 60 * 60 * 1000;

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

async function checkReorders(): Promise<void> {
  if (_running) {
    console.warn("[reorder-check] Already running, skipping cycle");
    return;
  }
  _running = true;

  try {
    const tenants = await listTenantSlugs();
    let totalGenerated = 0;

    for (const tenantSlug of tenants) {
      try {
        const results = await generateAutoPOs(tenantSlug);
        if (results.length > 0) {
          console.log(
            `[reorder-check] Tenant "${tenantSlug}": ${results.length} PO(s) generated`,
          );
          totalGenerated += results.length;
        }
      } catch (err) {
        console.warn(
          `[reorder-check] Error processing tenant "${tenantSlug}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (totalGenerated > 0) {
      console.log(
        `[reorder-check] Cycle complete: ${totalGenerated} PO(s) across ${tenants.length} tenant(s)`,
      );
    }
  } finally {
    _running = false;
  }
}

// ─── Public API ────────────────────────────────

/**
 * Starts the reorder check cron job.
 * Runs immediately on startup, then every INTERVAL_MS.
 */
export function startReorderCheckCron(): void {
  if (_timer) {
    console.warn("[reorder-check] Cron already started");
    return;
  }

  console.log(`[reorder-check] Cron started (interval: ${INTERVAL_MS / 60_000} min)`);

  // Run immediately on startup
  checkReorders().catch((err) => {
    console.warn(
      "[reorder-check] Initial check failed:",
      err instanceof Error ? err.message : err,
    );
  });

  _timer = setInterval(() => {
    checkReorders().catch((err) => {
      console.warn(
        "[reorder-check] Periodic check failed:",
        err instanceof Error ? err.message : err,
      );
    });
  }, INTERVAL_MS);
}

/**
 * Stops the reorder check cron job.
 */
export function stopReorderCheckCron(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log("[reorder-check] Cron stopped");
  }
}
