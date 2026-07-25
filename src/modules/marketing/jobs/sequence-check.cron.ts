/**
 * Sequence Check Cron — hourly processing of marketing automation sequences.
 *
 * Runs every hour (configurable via SEQUENCE_CHECK_INTERVAL_MS).
 * Processes enrollments where next_action_at <= now().
 *
 * @module marketing/jobs/sequence-check.cron
 */

import { processSequences } from "../services/sequence.service.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const INTERVAL_MS = Number(process.env.SEQUENCE_CHECK_INTERVAL_MS) || 60 * 60 * 1000;

let _running = false;
let _timer: ReturnType<typeof setInterval> | null = null;

async function listTenantSlugs(): Promise<string[]> {
  try {
    const raw = await readFile(join(process.cwd(), "config", "tenants.json"), "utf-8");
    const tenants = JSON.parse(raw) as Array<Record<string, unknown>>;
    return tenants.map((t) => String(t.slug || "")).filter(Boolean);
  } catch {
    return ["default"];
  }
}

async function checkSequences(): Promise<void> {
  if (_running) {
    console.warn("[sequence-check] Already running, skipping cycle");
    return;
  }
  _running = true;

  try {
    const tenants = await listTenantSlugs();
    let totalProcessed = 0;

    for (const tenantSlug of tenants) {
      try {
        const count = await processSequences(tenantSlug);
        totalProcessed += count;
      } catch (err) {
        console.warn(
          `[sequence-check] Error processing tenant "${tenantSlug}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (totalProcessed > 0) {
      console.log(
        `[sequence-check] Cycle complete: ${totalProcessed} enrollment(s) processed across ${tenants.length} tenant(s)`,
      );
    }
  } finally {
    _running = false;
  }
}

export function startSequenceCheckCron(): void {
  if (_timer) {
    console.warn("[sequence-check] Cron already started");
    return;
  }
  console.log(`[sequence-check] Cron started (interval: ${INTERVAL_MS / 60_000} min)`);
  _timer = setInterval(() => {
    checkSequences().catch((err) => {
      console.warn("[sequence-check] Periodic check failed:", err instanceof Error ? err.message : err);
    });
  }, INTERVAL_MS);
}

export function stopSequenceCheckCron(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log("[sequence-check] Cron stopped");
  }
}
