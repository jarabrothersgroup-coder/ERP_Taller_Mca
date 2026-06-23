/**
 * Sprint 42+43 Tests — Real-time Notifications + Advanced Analytics.
 *
 * Sprint 42 Tests:
 *   - Notification Push Service (create, push, mark read)
 *   - Notification WebSocket Gateway (connection management)
 *   - Notification Push Routes (API endpoints)
 *   - Frontend Notification Bell (UI structure, WS connection)
 *
 * Sprint 43 Tests:
 *   - Analytics Service (KPIs, trends, distribution, mechanics)
 *   - Analytics Routes (API endpoints)
 *   - Report Builder (CSV export, report generation)
 *   - Frontend Analytics Dashboard (UI structure, charts)
 *
 * @module tests/sprint42-43
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mock database ────────────────────────────
const mockReturning = vi.fn().mockResolvedValue([{ id: "test-id" }]);
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({ returning: mockReturning }),
});
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      }),
      limit: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    }),
  }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockReturning }),
  }),
});
const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});

vi.mock("../../src/shared/database/drizzle.js", () => ({
  db: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  })),
}));

// ═══════════════════════════════════════════
// Sprint 42 — Notifications
// ═══════════════════════════════════════════

describe("Sprint 42 — Notification Push Service", () => {
  it("exports crearNotificacionPush function", async () => {
    const mod = await import("../../src/modules/workshop/services/notification-push.service.js");
    expect(typeof mod.crearNotificacionPush).toBe("function");
  });

  it("exports listNotifications function", async () => {
    const mod = await import("../../src/modules/workshop/services/notification-push.service.js");
    expect(typeof mod.listNotifications).toBe("function");
  });

  it("exports getUnreadCount function", async () => {
    const mod = await import("../../src/modules/workshop/services/notification-push.service.js");
    expect(typeof mod.getUnreadCount).toBe("function");
  });

  it("exports markAsRead function", async () => {
    const mod = await import("../../src/modules/workshop/services/notification-push.service.js");
    expect(typeof mod.markAsRead).toBe("function");
  });

  it("exports markAllAsRead function", async () => {
    const mod = await import("../../src/modules/workshop/services/notification-push.service.js");
    expect(typeof mod.markAllAsRead).toBe("function");
  });

  it("exports cleanupOldNotifications function", async () => {
    const mod = await import("../../src/modules/workshop/services/notification-push.service.js");
    expect(typeof mod.cleanupOldNotifications).toBe("function");
  });
});

describe("Sprint 42 — Notification WebSocket Gateway", () => {
  it("exports registerNotificationWS function", async () => {
    const mod = await import("../../src/modules/workshop/ws/notification-gateway.js");
    expect(typeof mod.registerNotificationWS).toBe("function");
  });

  it("exports pushNotification function", async () => {
    const mod = await import("../../src/modules/workshop/ws/notification-gateway.js");
    expect(typeof mod.pushNotification).toBe("function");
  });

  it("exports pushToUser function", async () => {
    const mod = await import("../../src/modules/workshop/ws/notification-gateway.js");
    expect(typeof mod.pushToUser).toBe("function");
  });

  it("exports getConnectionCount function", async () => {
    const mod = await import("../../src/modules/workshop/ws/notification-gateway.js");
    expect(typeof mod.getConnectionCount).toBe("function");
  });

  it("exports getTotalConnections function", async () => {
    const mod = await import("../../src/modules/workshop/ws/notification-gateway.js");
    expect(typeof mod.getTotalConnections).toBe("function");
  });

  it("getConnectionCount returns 0 for unknown tenant", async () => {
    const { getConnectionCount } = await import("../../src/modules/workshop/ws/notification-gateway.js");
    const count = getConnectionCount("nonexistent-tenant");
    expect(count).toBe(0);
  });
});

describe("Sprint 42 — Notification Push Routes", () => {
  it("exports notificationPushRoutes function", async () => {
    const mod = await import("../../src/modules/workshop/routes/notification-push.routes.js");
    expect(typeof mod.notificationPushRoutes).toBe("function");
  });
});

describe("Sprint 42 — Notification Schema", () => {
  it("notification_priorities schema has required fields", async () => {
    const fs = await import("fs");
    const schemaPath = new URL(
      "../src/modules/workshop/schema/notification-priority.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(schemaPath, "utf-8");

    expect(content).toContain("notification_priorities");
    expect(content).toContain("tenant_slug");
    expect(content).toContain("tipo");
    expect(content).toContain("priority");
    expect(content).toContain("titulo");
    expect(content).toContain("mensaje");
    expect(content).toContain("target_user");
    expect(content).toContain("delivered");
    expect(content).toContain("leido");
    expect(content).toContain("action_url");
  });
});

describe("Sprint 42 — Frontend Notification Bell", () => {
  it("has valid file structure", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/notification-bell.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("@module js/notification-bell");
    expect(content).toContain("/* global api, esc");
  });

  it("exports initNotificationBell function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/notification-bell.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function initNotificationBell");
    expect(content).toContain("window.initNotificationBell");
  });

  it("has WebSocket connection logic", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/notification-bell.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("connectNotificationWS");
    expect(content).toContain("new WebSocket");
    expect(content).toContain("ws/notifications");
  });

  it("has badge update logic", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/notification-bell.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("updateBadge");
    expect(content).toContain("notif-badge");
    expect(content).toContain("99+");
  });

  it("has mark all read function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/notification-bell.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("notifMarkAllRead");
    expect(content).toContain("window.notifMarkAllRead");
  });

  it("has priority-based toast for URGENT/HIGH", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/notification-bell.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("URGENT");
    expect(content).toContain("HIGH");
    expect(content).toContain("showNotificationToast");
  });

  it("has heartbeat ping", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/notification-bell.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain('"ping"');
    expect(content).toContain("30000");
  });

  it("has auto-reconnect on disconnect", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/notification-bell.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("setTimeout(connectNotificationWS, 5000)");
  });

  it("is included in index.html", async () => {
    const fs = await import("fs");
    const indexPath = new URL(
      "../src/shared/public/index.html",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(indexPath, "utf-8");

    expect(content).toContain('src="js/notification-bell.js"');
  });
});

// ═══════════════════════════════════════════
// Sprint 43 — Analytics
// ═══════════════════════════════════════════

describe("Sprint 43 — Analytics Service", () => {
  it("exports getRevenueKPI function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.getRevenueKPI).toBe("function");
  });

  it("exports getOTCountKPI function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.getOTCountKPI).toBe("function");
  });

  it("exports getAvgOrderValueKPI function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.getAvgOrderValueKPI).toBe("function");
  });

  it("exports getCompletionRateKPI function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.getCompletionRateKPI).toBe("function");
  });

  it("exports getDailyRevenueTrend function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.getDailyRevenueTrend).toBe("function");
  });

  it("exports getDailyOTTrend function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.getDailyOTTrend).toBe("function");
  });

  it("exports getOTStatusDistribution function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.getOTStatusDistribution).toBe("function");
  });

  it("exports getTopMechanics function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.getTopMechanics).toBe("function");
  });

  it("exports generateReport function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.generateReport).toBe("function");
  });

  it("exports toCSV function", async () => {
    const mod = await import("../../src/modules/analytics/services/analytics.service.js");
    expect(typeof mod.toCSV).toBe("function");
  });
});

describe("Sprint 43 — Analytics Routes", () => {
  it("exports analyticsRoutes function", async () => {
    const mod = await import("../../src/modules/analytics/routes/analytics.routes.js");
    expect(typeof mod.analyticsRoutes).toBe("function");
  });
});

describe("Sprint 43 — Analytics Plugin", () => {
  it("analytics plugin imports routes", async () => {
    const fs = await import("fs");
    const pluginPath = new URL(
      "../src/modules/analytics/plugin.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(pluginPath, "utf-8");

    expect(content).toContain("analyticsRoutes");
    expect(content).toContain("analytics.routes.js");
  });
});

describe("Sprint 43 — CSV Export", () => {
  it("toCSV generates correct header", async () => {
    const { toCSV } = await import("../../src/modules/analytics/services/analytics.service.js");
    const csv = toCSV([], ["date", "value"]);
    expect(csv).toBe("date,value");
  });

  it("toCSV generates correct rows", async () => {
    const { toCSV } = await import("../../src/modules/analytics/services/analytics.service.js");
    const csv = toCSV(
      [
        { date: "2026-06-01", value: 1000 },
        { date: "2026-06-02", value: 2000 },
      ],
      ["date", "value"],
    );
    expect(csv).toContain("date,value");
    expect(csv).toContain("2026-06-01,1000");
    expect(csv).toContain("2026-06-02,2000");
  });

  it("toCSV handles commas in values", async () => {
    const { toCSV } = await import("../../src/modules/analytics/services/analytics.service.js");
    const csv = toCSV([{ name: "Toyota, Hilux" }], ["name"]);
    expect(csv).toContain('"Toyota, Hilux"');
  });

  it("toCSV handles empty data", async () => {
    const { toCSV } = await import("../../src/modules/analytics/services/analytics.service.js");
    const csv = toCSV([], ["col1", "col2"]);
    expect(csv).toBe("col1,col2");
  });
});

describe("Sprint 43 — Frontend Analytics Dashboard", () => {
  it("has valid file structure", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/analytics-dashboard.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("@module js/analytics-dashboard");
    expect(content).toContain("/* global api, esc, authHeaders, Chart");
  });

  it("exports renderAnalyticsView function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/analytics-dashboard.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function renderAnalyticsView");
    expect(content).toContain("window.renderAnalyticsView");
  });

  it("has date range selector", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/analytics-dashboard.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("analytics-from");
    expect(content).toContain("analytics-to");
    expect(content).toContain('type="date"');
  });

  it("has KPI rendering", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/analytics-dashboard.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("renderKPIs");
    expect(content).toContain("analytics-kpis");
  });

  it("has Chart.js integration", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/analytics-dashboard.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("new Chart");
    expect(content).toContain("analytics-revenue-chart");
    expect(content).toContain("analytics-ot-chart");
    expect(content).toContain("analytics-status-chart");
  });

  it("has report builder", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/analytics-dashboard.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("analyticsGenerateReport");
    expect(content).toContain("analyticsExportReportCSV");
    expect(content).toContain("analytics-report-type");
  });

  it("has CSV export", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/analytics-dashboard.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("analyticsExportCSV");
    expect(content).toContain("window.analyticsExportCSV");
    expect(content).toContain(".csv");
  });

  it("has mechanics ranking", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/analytics-dashboard.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("renderMechanics");
    expect(content).toContain("analytics-mechanics-list");
  });

  it("is included in index.html", async () => {
    const fs = await import("fs");
    const indexPath = new URL(
      "../src/shared/public/index.html",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(indexPath, "utf-8");

    expect(content).toContain('src="js/analytics-dashboard.js"');
  });
});

describe("Sprint 43 — App Registration", () => {
  it("app.ts imports analytics plugin", async () => {
    const fs = await import("fs");
    const appPath = new URL("../src/app.ts", import.meta.url).pathname;
    const content = fs.readFileSync(appPath, "utf-8");

    expect(content).toContain("analytics/plugin.js");
    expect(content).toContain("Analytics Module");
  });

  it("workshop routes index imports notification push routes", async () => {
    const fs = await import("fs");
    const indexPath = new URL(
      "../src/modules/workshop/routes/index.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(indexPath, "utf-8");

    expect(content).toContain("notificationPushRoutes");
    expect(content).toContain("notification-push.routes.js");
  });
});
