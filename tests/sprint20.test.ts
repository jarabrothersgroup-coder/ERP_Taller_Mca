/**
 * Sprint 20 Tests — Invoice Line Items
 *
 * Tests invoice detail generation from OT services and repuestos.
 *
 * @module tests/sprint20.test
 */

import { describe, it, expect } from "vitest";

// ═════════════════════════════════════════════════
//  1. Schema — factura_detalles table
// ═════════════════════════════════════════════════

describe("📦 [Sprint 20] Schema Definitions", () => {
  it("facturaDetalles table is defined", async () => {
    const mod = await import("../src/modules/finance/schema/factura-detalle.js");
    expect(mod.facturaDetalles).toBeDefined();
    expect(mod.facturaDetalles[Symbol.for("drizzle:Name")]).toBe("factura_detalles");
  });

  it("facturaDetalles has expected columns", async () => {
    const mod = await import("../src/modules/finance/schema/factura-detalle.js");
    const cols = mod.facturaDetalles[Symbol.for("drizzle:Columns")];
    expect(cols).toBeDefined();
    const colNames = Object.keys(cols);
    expect(colNames).toContain("facturaId");
    expect(colNames).toContain("numeroLinea");
    expect(colNames).toContain("tipoLinea");
    expect(colNames).toContain("descripcion");
    expect(colNames).toContain("cantidad");
    expect(colNames).toContain("precioUnitario");
    expect(colNames).toContain("iva");
    expect(colNames).toContain("ivaMonto");
    expect(colNames).toContain("subtotal");
    expect(colNames).toContain("ordenServicioId");
    expect(colNames).toContain("ordenRepuestoId");
    expect(colNames).toContain("tenantSlug");
  });
});

// ═════════════════════════════════════════════════
//  2. Schema — Barrel Exports
// ═════════════════════════════════════════════════

describe("📦 [Sprint 20] Schema Barrel Exports", () => {
  it("finance schema barrel exports facturaDetalles", async () => {
    const mod = await import("../src/modules/finance/schema/index.js");
    expect(mod.facturaDetalles).toBeDefined();
  });

  it("shared database schema barrel exports facturaDetalles", async () => {
    const mod = await import("../src/shared/database/schema/index.js");
    expect(mod.facturaDetalles).toBeDefined();
  });

  it("shared database schema barrel exports ordenServicios and ordenRepuestos", async () => {
    const mod = await import("../src/shared/database/schema/index.js");
    expect(mod.ordenServicios).toBeDefined();
    expect(mod.ordenRepuestos).toBeDefined();
  });
});

// ═════════════════════════════════════════════════
//  3. Migration — 0021 Structure
// ═════════════════════════════════════════════════

describe("📝 [Sprint 20] Migration 0021 Structure (factura_detalles)", () => {
  it("factura_detalles table exists", async () => {
    const { getDb } = await import("../src/shared/database/connection.js");
    const rows = await getDb().unsafe(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='factura_detalles'`
    );
    expect((rows as unknown as any[]).length).toBeGreaterThan(0);
  });

  it("factura_detalles has expected columns", async () => {
    const { getDb } = await import("../src/shared/database/connection.js");
    const rows = await getDb().unsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='factura_detalles'`
    );
    const cols = (rows as unknown as any[]).map((r) => r.column_name);
    for (const c of [
      "factura_id", "numero_linea", "tipo_linea", "descripcion", "cantidad",
      "precio_unitario", "subtotal", "orden_servicio_id", "orden_repuesto_id", "tenant_slug",
    ]) {
      expect(cols).toContain(c);
    }
  });

  it("creates indexes on factura_detalles", async () => {
    const { getDb } = await import("../src/shared/database/connection.js");
    const rows = await getDb().unsafe(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='factura_detalles'`
    );
    const idx = (rows as unknown as any[]).map((r) => r.indexname);
    expect(idx).toContain("factura_detalles_factura_id_idx");
    expect(idx).toContain("factura_detalles_tenant_slug_idx");
  });
});

// ═════════════════════════════════════════════════
//  4. Invoice Route — Imports
// ═════════════════════════════════════════════════

describe("🌐 [Sprint 20] Invoice Route Imports", () => {
  it("invoice.routes.ts imports facturaDetalles, ordenServicios, ordenRepuestos", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/modules/finance/routes/invoice.routes.ts"),
      "utf-8"
    );
    expect(code).toContain("facturaDetalles");
    expect(code).toContain("ordenServicios");
    expect(code).toContain("ordenRepuestos");
  });

  it("invoice.routes.ts generates line items from OT services and repuestos", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/modules/finance/routes/invoice.routes.ts"),
      "utf-8"
    );
    expect(code).toContain("tipoLinea: \"SERVICIO\"");
    expect(code).toContain("tipoLinea: \"REPUESTO\"");
    expect(code).toContain("lineItems.push");
    expect(code).toContain("insert(facturaDetalles).values(lineItems)");
  });
});
