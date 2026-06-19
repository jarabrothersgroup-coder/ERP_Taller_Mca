/**
 * Sprint 38 Tests — Role-Based UI + Marketing/Fleet Frontend Polish.
 *
 * Tests for:
 *   - RBAC View Visibility (role hierarchy, view protection)
 *   - Marketing Module (campaign modal, loyalty tiers, reviews)
 *   - Fleet Module (create modal, stats)
 *
 * @module tests/sprint38
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock database ────────────────────────────
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue([]);
const mockReturning = vi.fn().mockResolvedValue([{ id: "test-id" }]);
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({ returning: mockReturning }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockReturning }),
  }),
});

const mockDb = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  execute: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock("../../src/shared/database/drizzle.js", () => ({
  db: mockDb,
}));

// ─── RBAC Middleware ─────────────────────────

describe("Sprint 38 — RBAC Middleware", () => {
  it("exports requireRole function", async () => {
    const mod = await import("../../src/shared/middleware/rbac.js");
    expect(typeof mod.requireRole).toBe("function");
  });

  it("exports requireAdmin hook", async () => {
    const mod = await import("../../src/shared/middleware/rbac.js");
    expect(typeof mod.requireAdmin).toBe("function");
  });

  it("exports requireManager hook", async () => {
    const mod = await import("../../src/shared/middleware/rbac.js");
    expect(typeof mod.requireManager).toBe("function");
  });

  it("exports requireMechanic hook", async () => {
    const mod = await import("../../src/shared/middleware/rbac.js");
    expect(typeof mod.requireMechanic).toBe("function");
  });

  it("exports resolveProfile function", async () => {
    const mod = await import("../../src/shared/middleware/rbac.js");
    expect(typeof mod.resolveProfile).toBe("function");
  });

  it("exports registerGlobalRBAC function", async () => {
    const mod = await import("../../src/shared/middleware/rbac.js");
    expect(typeof mod.registerGlobalRBAC).toBe("function");
  });
});

// ─── RBAC Frontend Validation ────────────────

describe("Sprint 38 — RBAC Frontend", () => {
  it("app.js has ROLE_HIERARCHY definition", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/app.js", "utf-8");
    expect(content).toContain("ROLE_HIERARCHY");
    expect(content).toContain("user: 0");
    expect(content).toContain("mechanic: 1");
    expect(content).toContain("manager: 2");
    expect(content).toContain("admin: 3");
  });

  it("app.js has VIEW_ROLES mapping", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/app.js", "utf-8");
    expect(content).toContain("VIEW_ROLES");
    expect(content).toContain("marketing: 'admin'");
    expect(content).toContain("fleet: 'admin'");
    expect(content).toContain("nomina: 'admin'");
    expect(content).toContain("dvi: 'mechanic'");
    expect(content).toContain("calendario: 'manager'");
  });

  it("app.js has canAccessView function", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/app.js", "utf-8");
    expect(content).toContain("function canAccessView");
    expect(content).toContain("function applyRoleVisibility");
  });

  it("app.js calls applyRoleVisibility on login", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/app.js", "utf-8");
    expect(content).toContain("applyRoleVisibility()");
  });
});

// ─── Marketing Module ────────────────────────

describe("Sprint 38 — Marketing Module", () => {
  it("marketing.js has campaign creation modal", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/js/marketing.js", "utf-8");
    expect(content).toContain("marketingOpenCampaignModal");
    expect(content).toContain("marketingCloseCampaignModal");
    expect(content).toContain("marketing-campaign-modal");
  });

  it("marketing.js has loyalty tier display", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/js/marketing.js", "utf-8");
    expect(content).toContain("BRONCE");
    expect(content).toContain("PLATA");
    expect(content).toContain("ORO");
    expect(content).toContain("PLATINO");
  });

  it("marketing.js has reviews with average rating", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/js/marketing.js", "utf-8");
    expect(content).toContain("reviews-avg-rating");
    expect(content).toContain("★");
  });

  it("marketing.js has character counter", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/js/marketing.js", "utf-8");
    expect(content).toContain("campaign-char-count");
    expect(content).toContain("2000 caracteres");
  });
});

// ─── Fleet Module ────────────────────────────

describe("Sprint 38 — Fleet Module", () => {
  it("fleet.js has create modal", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/js/fleet.js", "utf-8");
    expect(content).toContain("fleetOpenCreateModal");
    expect(content).toContain("fleetCloseModal");
    expect(content).toContain("fleet-modal");
  });

  it("fleet.js has contract fields", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/js/fleet.js", "utf-8");
    expect(content).toContain("fleet-contract-start");
    expect(content).toContain("fleet-contract-end");
    expect(content).toContain("fleet-discount");
  });

  it("fleet.js has stats display", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/js/fleet.js", "utf-8");
    expect(content).toContain("fleet-total");
    expect(content).toContain("fleet-vehicles");
    expect(content).toContain("fleet-contracts");
  });

  it("fleet.js has edit function", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/js/fleet.js", "utf-8");
    expect(content).toContain("function fleetEdit");
  });
});

// ─── Sidebar View Registration ───────────────

describe("Sprint 38 — Sidebar View Registration", () => {
  it("index.html has DVI sidebar button", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/index.html", "utf-8");
    expect(content).toContain('data-view="dvi"');
    expect(content).toContain('data-view="calendario"');
    expect(content).toContain('data-view="marketing"');
    expect(content).toContain('data-view="fleet"');
  });

  it("app.js routes DVI, calendario, marketing, fleet views", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("src/shared/public/app.js", "utf-8");
    expect(content).toContain("renderDVI");
    expect(content).toContain("renderCalendario");
    expect(content).toContain("renderMarketing");
    expect(content).toContain("renderFleet");
  });
});
