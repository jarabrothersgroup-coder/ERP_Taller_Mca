/**
 * Sprint 101 — HUB technician filter + terminal OT state + assigned_to.
 *
 * Structural tests (no DB): pin the code contracts that closed the
 * silent breaks found in the 2026-09-06 total audit:
 *   1. estado_orden enum includes the terminal state Finalizado_Retirado
 *   2. ordenes_trabajo has assigned_to (was missing → dead filter)
 *   3. GET /workshop/tecnicos exists (was 404 → empty dropdown)
 *   4. GET /workshop/ordenes supports excludeStatus (HUB board query)
 *   5. HUB sidebar offers the "Retirar" exit action
 *   6. Web vitest forces NODE_ENV=test (React 19 act() available)
 *
 * @module tests/sprint101
 */

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

const read = (p: string) => readFile(p, "utf8");

// ═══════════════════════════════════════════════
// 1. Terminal state in the DB enum
// ═══════════════════════════════════════════════
describe("Sprint 101 — Terminal OT state", () => {
  it("estadoOrdenEnum includes Finalizado_Retirado", async () => {
    const mod = await import("../src/modules/workshop/schema/ordenes-trabajo.js");
    expect(mod.estadoOrdenEnum.enumValues).toContain("Finalizado_Retirado");
    expect(mod.estadoOrdenEnum.enumValues).toHaveLength(6);
  });

  it("migration 0023 adds the enum value, assigned_to and the HUB index", async () => {
    const sql = await read(
      "src/shared/database/migrations/0023_orden_finalizado_retirado_assigned_to.sql",
    );
    expect(sql).toContain("ALTER TYPE \"estado_orden\" ADD VALUE 'Finalizado_Retirado'");
    expect(sql).toContain('ADD COLUMN "assigned_to" text');
    expect(sql).toContain("ordenes_trabajo_tenant_status_created_idx");
  });

  it("migration 0023 is registered in the drizzle journal", async () => {
    const journal = JSON.parse(
      await read("src/shared/database/migrations/meta/_journal.json"),
    );
    const tags: string[] = journal.entries.map((e: { tag: string }) => e.tag);
    // 0023 must be present; do NOT pin it as the last entry — later
    // migrations (0024_ingreso_checklist, …) legitimately append after it.
    expect(tags).toContain("0023_orden_finalizado_retirado_assigned_to");
    // Journal indices must be contiguous (drizzle-kit invariant).
    journal.entries.forEach((e: { idx: number }, i: number) => {
      expect(e.idx).toBe(i);
    });
  });

  it("updateOrdenStatus accepts the terminal state", async () => {
    const service = await read("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain('"Finalizado_Retirado"');
    expect(service).not.toContain('Finalizado: "FINALIZADO_RETIRADO"');
  });
});

// ═══════════════════════════════════════════════
// 2. Mechanic assignment (HUB technician filter)
// ═══════════════════════════════════════════════
describe("Sprint 101 — assigned_to", () => {
  it("ordenes_trabajo schema declares assignedTo", async () => {
    const schema = await read("src/modules/workshop/schema/ordenes-trabajo.ts");
    expect(schema).toContain('assignedTo: text("assigned_to")');
  });

  it("listOrdenes/getOrden select assignedTo", async () => {
    const service = await read("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("assignedTo: ordenesTrabajo.assignedTo");
  });

  it("service exposes setAssignedTo", async () => {
    const mod = await import("../src/modules/workshop/services/orden.service.js");
    expect(typeof mod.setAssignedTo).toBe("function");
  });

  it("routes expose POST /workshop/ordenes/:id/assign", async () => {
    const routes = await read("src/modules/workshop/routes/ordenes.ts");
    expect(routes).toContain('"/workshop/ordenes/:id/assign"');
  });
});

// ═══════════════════════════════════════════════
// 3. HUB backend endpoints
// ═══════════════════════════════════════════════
describe("Sprint 101 — HUB endpoints", () => {
  it("GET /workshop/tecnicos exists (was silently missing)", async () => {
    const routes = await read("src/modules/workshop/routes/ordenes.ts");
    expect(routes).toContain('"/workshop/tecnicos"');
  });

  it("GET /workshop/ordenes supports excludeStatus", async () => {
    const routes = await read("src/modules/workshop/routes/ordenes.ts");
    expect(routes).toContain("excludeStatus");
    const service = await read("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("notInArray");
  });
});

// ═══════════════════════════════════════════════
// 4. HUB frontend wiring
// ═══════════════════════════════════════════════
describe("Sprint 101 — HUB frontend", () => {
  it("technician filter uses the real assignedTo field (no phantom keys)", async () => {
    const page = await read("web/src/app/(dashboard)/dashboard/hub/page.tsx");
    expect(page).toContain("ot.assignedTo === tecnicoFilter");
    expect(page).not.toContain("(ot as any).tecnicoId");
  });

  it("HUB board excludes the terminal state server-side", async () => {
    const page = await read("web/src/app/(dashboard)/dashboard/hub/page.tsx");
    expect(page).toContain("excludeStatus: TERMINAL_STATUS");
  });

  it("sidebar card offers the Retirar action", async () => {
    const sidebar = await read("web/src/components/hub/hub-sidebar.tsx");
    expect(sidebar).toContain("Retirar");
    expect(sidebar).toContain("onRetirar");
  });

  it("detail panel can close the OT as Finalizado_Retirado", async () => {
    const panel = await read("web/src/components/hub/ot-detail-panel.tsx");
    expect(panel).toContain("TERMINAL_STATUS");
    expect(panel).toContain("Marcar Retirado");
  });

  it("api client exposes listWorkOrders.excludeStatus and assignWorkOrder", async () => {
    const api = await read("web/src/lib/api.ts");
    expect(api).toContain("excludeStatus?: string");
    expect(api).toContain("assignWorkOrder:");
  });
});

// ═══════════════════════════════════════════════
// 5. Test environment regression guard
// ═══════════════════════════════════════════════
describe("Sprint 101 — web test environment", () => {
  it("web vitest config forces NODE_ENV=test (React 19 act)", async () => {
    const config = await read("web/vitest.config.ts");
    expect(config).toContain('env: { NODE_ENV: "test" }');
  });
});
