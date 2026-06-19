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

describe("📝 [Sprint 20] Migration 0021 Structure", () => {
  it("migration file exists", async () => {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    expect(
      existsSync(join(process.cwd(), "src/shared/database/migrations/0021_factura_detalles.sql"))
    ).toBe(true);
  });

  it("creates factura_detalles table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0021_factura_detalles.sql"),
      "utf-8"
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS factura_detalles");
    expect(sql).toContain("factura_id UUID NOT NULL REFERENCES facturas(id)");
    expect(sql).toContain("numero_linea INT NOT NULL");
    expect(sql).toContain("tipo_linea TEXT NOT NULL");
    expect(sql).toContain("descripcion TEXT NOT NULL");
    expect(sql).toContain("cantidad NUMERIC(12,2) NOT NULL");
    expect(sql).toContain("precio_unitario NUMERIC(14,2) NOT NULL");
    expect(sql).toContain("subtotal NUMERIC(14,2) NOT NULL");
    expect(sql).toContain("orden_servicio_id UUID");
    expect(sql).toContain("orden_repuesto_id UUID");
    expect(sql).toContain("tenant_slug TEXT NOT NULL");
  });

  it("creates indexes on factura_detalles", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0021_factura_detalles.sql"),
      "utf-8"
    );
    expect(sql).toContain("factura_detalles_factura_id_idx");
    expect(sql).toContain("factura_detalles_tenant_slug_idx");
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
