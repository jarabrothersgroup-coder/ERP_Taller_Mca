/**
 * Sprint 73 Tests — Frontend SSE Notifications + Migration + Notification Bell.
 *
 * Tests cover:
 *   - Analytics events migration SQL correctness
 *   - SSE hook file structure and exports
 *   - Notification bell component file structure and exports
 *   - Integration with existing notification infrastructure
 */

import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const srcRoot = resolve(root, "src");
const webRoot = resolve(root, "web");

async function readFileSafe(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

// ─── Migration 0003 (analytics_events) ────────────────────────────────

describe("Sprint 73 — Migration 0003 (analytics_events)", () => {
  it("migration file exists", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0003_analytics_events.sql"),
    );
    expect(content.length).toBeGreaterThan(100);
  });

  it("creates analytics_events table", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0003_analytics_events.sql"),
    );
    expect(content).toContain("analytics_events");
    expect(content).toContain("CREATE TABLE");
  });

  it("has required columns", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0003_analytics_events.sql"),
    );
    expect(content).toContain('"id" uuid');
    expect(content).toContain('"tenant_slug" text');
    expect(content).toContain('"event_type" text');
    expect(content).toContain('"event_name" text');
    expect(content).toContain('"user_id" text');
    expect(content).toContain('"properties" jsonb');
    expect(content).toContain('"metadata" jsonb');
    expect(content).toContain('"created_at" timestamp');
  });

  it("has tenant isolation index", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0003_analytics_events.sql"),
    );
    expect(content).toContain("idx_analytics_events_tenant");
    expect(content).toContain("idx_analytics_events_type");
    expect(content).toContain("idx_analytics_events_created");
  });

  it("has composite index for common query pattern", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0003_analytics_events.sql"),
    );
    expect(content).toContain("idx_analytics_events_tenant_type_date");
  });

  it("has RLS policy for multi-tenant isolation", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0003_analytics_events.sql"),
    );
    expect(content).toContain("ENABLE ROW LEVEL SECURITY");
    expect(content).toContain("analytics_events_tenant_isolation");
    expect(content).toContain("current_setting");
  });
});

// ─── SSE Hook (use-sse.ts) ───────────────────────────────────────────

describe("Sprint 73 — SSE Hook (use-sse.ts)", () => {
  it("SSE hook file exists", async () => {
    const content = await readFileSafe(resolve(webRoot, "src/hooks/use-sse.ts"));
    expect(content.length).toBeGreaterThan(100);
  });

  it("exports useSse hook", async () => {
    const content = await readFileSafe(resolve(webRoot, "src/hooks/use-sse.ts"));
    expect(content).toContain("export function useSse");
  });

  it("exports SseNotification interface", async () => {
    const content = await readFileSafe(resolve(webRoot, "src/hooks/use-sse.ts"));
    expect(content).toContain("export interface SseNotification");
    expect(content).toContain("id: string");
    expect(content).toContain("tipo: string");
    expect(content).toContain("titulo: string");
    expect(content).toContain("mensaje: string");
  });

  it("exports SseConnectionStatus type", async () => {
    const content = await readFileSafe(resolve(webRoot, "src/hooks/use-sse.ts"));
    expect(content).toContain("export type SseConnectionStatus");
    expect(content).toContain('"connecting"');
    expect(content).toContain('"connected"');
    expect(content).toContain('"disconnected"');
    expect(content).toContain('"error"');
  });

  it("has auto-reconnect with exponential backoff", async () => {
    const content = await readFileSafe(resolve(webRoot, "src/hooks/use-sse.ts"));
    expect(content).toContain("retryCountRef");
    expect(content).toContain("BASE_DELAY_MS");
    expect(content).toContain("MAX_DELAY_MS");
    expect(content).toContain("Math.pow");
  });

  it("has heartbeat monitoring", async () => {
    const content = await readFileSafe(resolve(webRoot, "src/hooks/use-sse.ts"));
    expect(content).toContain("heartbeatTimerRef");
    expect(content).toContain("HEARTBEAT_TIMEOUT_MS");
    expect(content).toContain("resetHeartbeat");
  });

  it("has cleanup on unmount", async () => {
    const content = await readFileSafe(resolve(webRoot, "src/hooks/use-sse.ts"));
    expect(content).toContain("mountedRef");
    expect(content).toContain("cleanup");
    expect(content).toContain("return () =>");
  });

  it("returns status, notifications, and control functions", async () => {
    const content = await readFileSafe(resolve(webRoot, "src/hooks/use-sse.ts"));
    expect(content).toContain("return {");
    expect(content).toContain("status,");
    expect(content).toContain("lastNotification,");
    expect(content).toContain("notifications,");
    expect(content).toContain("connect,");
    expect(content).toContain("disconnect,");
    expect(content).toContain("clearNotifications,");
  });
});

// ─── Notification Bell Component ──────────────────────────────────────

describe("Sprint 73 — Notification Bell Component", () => {
  it("notification bell file exists", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content.length).toBeGreaterThan(100);
  });

  it("exports NotificationBell component", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain("export function NotificationBell");
  });

  it("has 'use client' directive", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain('"use client"');
  });

  it("uses useSse hook", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain("useSse");
  });

  it("shows unread count badge", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain("unreadCount");
    expect(content).toContain("Badge");
  });

  it("has SSE connection status indicator", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain("sseStatus");
    expect(content).toContain("bg-green-500");
  });

  it("has mark as read functionality", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain("markAsRead");
    expect(content).toContain("markAllAsRead");
  });

  it("has clear all functionality", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain("clearAll");
  });

  it("limits displayed notifications", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain("maxVisible");
    expect(content).toContain("slice(0, maxVisible)");
  });

  it("has priority-based styling", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(content).toContain("priorityColor");
    expect(content).toContain("urgent");
    expect(content).toContain("high");
  });
});

// ─── Integration ──────────────────────────────────────────────────────

describe("Sprint 73 — Integration", () => {
  it("event-tracker schema matches migration columns", async () => {
    const tracker = await readFileSafe(
      resolve(srcRoot, "modules/analytics/services/event-tracker.ts"),
    );
    const migration = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0003_analytics_events.sql"),
    );
    // Both should reference the same columns
    expect(tracker).toContain("tenant_slug");
    expect(migration).toContain("tenant_slug");
    expect(tracker).toContain("event_type");
    expect(migration).toContain("event_type");
    expect(tracker).toContain("event_name");
    expect(migration).toContain("event_name");
  });

  it("SSE hook imported by notification bell", async () => {
    const bell = await readFileSafe(
      resolve(webRoot, "src/components/notifications/notification-bell.tsx"),
    );
    expect(bell).toContain('from "@/hooks/use-sse"');
  });

  it("notification-sse.routes.ts has SSE stream endpoint", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    expect(content).toContain("/stream");
    expect(content).toContain("/poll");
    expect(content).toContain("text/event-stream");
  });

  it("Sprint 72 openapi-schemas still exist", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/schemas/openapi-schemas.ts"),
    );
    expect(content).toContain("ClientSchema");
    expect(content).toContain("VehicleSchema");
    expect(content).toContain("OrdenTrabajoSchema");
  });

  it("engram.json updated with current sprint (>= 73)", async () => {
    const content = await readFileSafe(resolve(root, "engram.json"));
    const match = content.match(/Sprint (\d+)/);
    const current = match ? parseInt(match[1], 10) : 0;
    expect(current).toBeGreaterThanOrEqual(73);
  });
});
