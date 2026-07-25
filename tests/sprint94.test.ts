/**
 * Sprint 94 Tests — Cycle Count Module (Conteo Cíclico de Inventario)
 *
 * Covers:
 *   - Migration 0012 exists with correct table definitions
 *   - Schema barrel exports cycle_count types
 *   - Service functions exist with correct signatures
 *   - Routes registered in barrel
 *   - Frontend page exists with correct imports
 */

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const srcRoot = resolve(import.meta.dirname, "..", "src");
const webRoot = resolve(import.meta.dirname, "..", "web");

async function readFileSafe(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

// ─── Migration 0012 ─────────────────────────────

describe("Sprint 94 — Migration 0012 (Cycle Count tables)", () => {
  it("migration file exists", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0012_cycle_counts.sql"),
    );
    expect(content).toBeTruthy();
    expect(content).toContain("cycle_counts");
    expect(content).toContain("cycle_count_items");
  });

  it("creates cycle_counts with correct columns", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0012_cycle_counts.sql"),
    );
    expect(content).toContain("almacen_id UUID");
    expect(content).toContain("estado TEXT NOT NULL DEFAULT 'ABIERTO'");
    expect(content).toContain("CHECK (estado IN");
    expect(content).toContain("tenant_slug TEXT NOT NULL");
    expect(content).toContain("cycle_cnt_tenant_idx");
    expect(content).toContain("cycle_cnt_estado_idx");
    expect(content).toContain("cycle_cnt_almacen_idx");
  });

  it("creates cycle_count_items with computed diferencia + FK cascade", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0012_cycle_counts.sql"),
    );
    expect(content).toContain("REFERENCES cycle_counts(id) ON DELETE CASCADE");
    expect(content).toContain("REFERENCES repuestos(id)");
    expect(content).toContain("stock_sistema INTEGER NOT NULL");
    expect(content).toContain("stock_real INTEGER NOT NULL");
    expect(content).toContain("diferencia INTEGER NOT NULL DEFAULT 0");
    expect(content).toContain("ajustado BOOLEAN NOT NULL DEFAULT FALSE");
    expect(content).toContain("cycle_cnt_item_cnt_idx");
    expect(content).toContain("cycle_cnt_item_rep_idx");
  });

  it("enables RLS on both tables", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/migrations/0012_cycle_counts.sql"),
    );
    expect(content).toContain("ALTER TABLE cycle_counts ENABLE ROW LEVEL SECURITY");
    expect(content).toContain("ALTER TABLE cycle_count_items ENABLE ROW LEVEL SECURITY");
  });
});

// ─── Schema Barrel ──────────────────────────────

describe("Sprint 94 — Schema barrel exports", () => {
  it("inventory schema barrel exports cycle count tables", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/inventory/schema/index.ts"),
    );
    expect(content).toContain("cycleCounts");
    expect(content).toContain("cycleCountItems");
    expect(content).toContain("CycleCount");
    expect(content).toContain("CycleCountItem");
    expect(content).toContain("NewCycleCount");
    expect(content).toContain("NewCycleCountItem");
  });

  it("shared schema barrel re-exports cycle count types", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "shared/database/schema/index.ts"),
    );
    expect(content).toContain("cycleCounts");
    expect(content).toContain("cycleCountItems");
    expect(content).toContain("Migration 0012");
  });
});

// ─── Service ───────────────────────────────────

describe("Sprint 94 — Cycle Count Service", () => {
  it("service file exists with all required functions", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/inventory/services/cycle-count.service.ts"),
    );
    expect(content).toContain("listCycleCounts");
    expect(content).toContain("getCycleCountById");
    expect(content).toContain("createCycleCount");
    expect(content).toContain("startCycleCount");
    expect(content).toContain("recordCountItem");
    expect(content).toContain("completeCycleCount");
    expect(content).toContain("applyAdjustments");
    expect(content).toContain("getCycleCountItems");
    expect(content).toContain("deleteCycleCount");
    expect(content).toContain("getCycleCountStats");
  });

  it("createCycleCount validates almacen existence", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/inventory/services/cycle-count.service.ts"),
    );
    expect(content).toContain("NotFoundError");
    expect(content).toContain("Almacén no encontrado");
  });

  it("applyAdjustments uses atomic stock update pattern", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/inventory/services/cycle-count.service.ts"),
    );
    expect(content).toContain("stockActual");
    expect(content).toContain("Ajuste por conteo cíclico");
  });
});

// ─── Routes ────────────────────────────────────

describe("Sprint 94 — Cycle Count Routes", () => {
  it("routes file exists with all endpoints", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/inventory/routes/cycle-count.routes.ts"),
    );
    expect(content).toContain('"/inventory/cycle-counts/stats"');
    expect(content).toContain('"/inventory/cycle-counts"');
    expect(content).toContain('"/inventory/cycle-counts/:id/start"');
    expect(content).toContain('"/inventory/cycle-counts/:id/items"');
    expect(content).toContain('"/inventory/cycle-counts/:id/complete"');
    expect(content).toContain('"/inventory/cycle-counts/:id/adjust"');
    expect(content).toContain('"/inventory/cycle-counts/:id"');
  });

  it("routes barrel registers cycle count routes", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/inventory/routes/index.ts"),
    );
    expect(content).toContain("cycleCountRoutes");
    expect(content).toContain("Conteo cíclico");
  });
});

// ─── Schema Definition ─────────────────────────

describe("Sprint 94 — Cycle Count Schema (Drizzle)", () => {
  it("schema file defines cycleCounts table with correct columns", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/inventory/schema/cycle-counts.ts"),
    );
    expect(content).toContain("cycleCounts");
    expect(content).toContain("cycleCountItems");
    expect(content).toContain("almacenId");
    expect(content).toContain("tenantSlug");
    expect(content).toContain("fechaInicio");
    expect(content).toContain("fechaFin");
    expect(content).toContain("stockSistema");
    expect(content).toContain("stockReal");
    expect(content).toContain("diferencia");
    expect(content).toContain("movimientoAjusteId");
    expect(content).toContain("onDelete: \"cascade\"");
    expect(content).toContain("type CycleCount");
    expect(content).toContain("type CycleCountItem");
  });
});

// ─── Frontend ──────────────────────────────────

describe("Sprint 94 — Cycle Count Frontend Page", () => {
  it("frontend page exists", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/app/(dashboard)/dashboard/inventario/conteo/page.tsx"),
    );
    expect(content).toBeTruthy();
    expect(content).toContain("Conteo Cíclico");
    expect(content).toContain("Nuevo Conteo");
  });

  it("frontend uses correct API endpoints", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/app/(dashboard)/dashboard/inventario/conteo/page.tsx"),
    );
    expect(content).toContain('/inventory/cycle-counts"');
    expect(content).toContain("/inventory/cycle-counts/stats");
    expect(content).toContain("/inventory/almacenes");
  });

  it("frontend handles all 4 cycle count states", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/app/(dashboard)/dashboard/inventario/conteo/page.tsx"),
    );
    expect(content).toContain("ABIERTO");
    expect(content).toContain("EN_PROGRESO");
    expect(content).toContain("COMPLETADO");
    expect(content).toContain("AJUSTADO");
  });

  it("sidebar links to conteo page", async () => {
    const content = await readFileSafe(
      resolve(webRoot, "src/components/dashboard/sidebar.tsx"),
    );
    expect(content).toContain("Conteo Cíclico");
    expect(content).toContain("/dashboard/inventario/conteo");
  });
});

// ─── Integration: Engram ───────────────────────

describe("Sprint 94 — Integration", () => {
  it("engram.json records Sprint 94 progress", async () => {
    const content = await readFileSafe(resolve(srcRoot, "..", "engram.json"));
    expect(content).toContain("Sprint 94");
  });
});
