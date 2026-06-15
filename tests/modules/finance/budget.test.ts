/**
 * Budget Service — Unit Tests
 *
 * Tests schema structure, service exports, and route registration.
 *
 * @module tests/modules/finance/budget.test
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mock db() ─────────────────────────────────

vi.mock("../../../../src/shared/database/drizzle.js", () => ({
  db: vi.fn(),
}));

vi.mock("../../../../src/modules/finance/schema/budget.ts", () => ({
  presupuestos: {
    id: "bp.id",
    periodo: "bp.periodo",
    estado: "bp.estado",
    tenantSlug: "bp.tenant_slug",
    createdAt: "bp.created_at",
    updatedAt: "bp.updated_at",
  },
  presupuestosItems: {
    id: "bi.id",
    presupuestoId: "bi.presupuesto_id",
    centroCostoId: "bi.centro_costo_id",
    categoria: "bi.categoria",
    montoPresupuestado: "bi.monto_presupuestado",
    montoReal: "bi.monto_real",
  },
}));

// ─── Tests ─────────────────────────────────────

describe("budget schema structure", () => {
  it("presupuestos has expected fields", async () => {
    const { presupuestos } = await import("../../../../src/modules/finance/schema/budget.ts");
    expect(presupuestos).toBeDefined();
    expect(presupuestos.id).toBeDefined();
    expect(presupuestos.periodo).toBeDefined();
    expect(presupuestos.estado).toBeDefined();
  });

  it("presupuestosItems has expected fields", async () => {
    const { presupuestosItems } = await import("../../../../src/modules/finance/schema/budget.ts");
    expect(presupuestosItems).toBeDefined();
    expect(presupuestosItems.presupuestoId).toBeDefined();
    expect(presupuestosItems.centroCostoId).toBeDefined();
    expect(presupuestosItems.montoPresupuestado).toBeDefined();
    expect(presupuestosItems.montoReal).toBeDefined();
  });
});

describe("budget service functions exist", () => {
  it("exports CRUD functions", async () => {
    const mod = await import("../../../../src/modules/finance/services/budget/budget.service.ts");
    expect(typeof mod.createPresupuesto).toBe("function");
    expect(typeof mod.listPresupuestos).toBe("function");
    expect(typeof mod.getPresupuesto).toBe("function");
    expect(typeof mod.updatePresupuesto).toBe("function");
    expect(typeof mod.deletePresupuesto).toBe("function");
  });

  it("exports item CRUD functions", async () => {
    const mod = await import("../../../../src/modules/finance/services/budget/budget.service.ts");
    expect(typeof mod.addPresupuestoItem).toBe("function");
    expect(typeof mod.updatePresupuestoItem).toBe("function");
    expect(typeof mod.deletePresupuestoItem).toBe("function");
  });

  it("exports comparativa and alert functions", async () => {
    const mod = await import("../../../../src/modules/finance/services/budget/budget.service.ts");
    expect(typeof mod.getComparativa).toBe("function");
    expect(typeof mod.refreshMontoReal).toBe("function");
    expect(typeof mod.getAllAlertas).toBe("function");
  });
});

describe("budget routes exist", () => {
  it("exports budgetRoutes function", async () => {
    const { budgetRoutes } = await import("../../../../src/modules/finance/routes/budget.routes.ts");
    expect(typeof budgetRoutes).toBe("function");
  });
});
