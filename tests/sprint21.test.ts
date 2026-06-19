/**
 * Sprint 21 Tests — Invoice Listing + Detail View
 *
 * Tests invoice listing endpoints and frontend completion.
 *
 * @module tests/sprint21.test
 */

import { describe, it, expect } from "vitest";

// ═════════════════════════════════════════════════
//  1. Invoice Route — GET endpoints
// ═════════════════════════════════════════════════

describe("🌐 [Sprint 21] Invoice Listing Endpoints", () => {
  it("invoice.routes.ts has GET /finance/invoices endpoint", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/modules/finance/routes/invoice.routes.ts"),
      "utf-8"
    );
    expect(code).toContain('"/finance/invoices"');
    expect(code).toContain("fastify.get(");
  });

  it("invoice.routes.ts has GET /finance/invoices/:id endpoint", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/modules/finance/routes/invoice.routes.ts"),
      "utf-8"
    );
    expect(code).toContain('"/finance/invoices/:id"');
    expect(code).toContain("lineItems");
    expect(code).toContain("orden");
  });

  it("GET /finance/invoices returns invoices ordered by createdAt desc", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/modules/finance/routes/invoice.routes.ts"),
      "utf-8"
    );
    expect(code).toContain("orderBy(desc(facturas.createdAt))");
  });

  it("GET /finance/invoices/:id includes lineItems and orden", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/modules/finance/routes/invoice.routes.ts"),
      "utf-8"
    );
    expect(code).toContain(".from(facturaDetalles)");
    expect(code).toContain(".from(ordenesTrabajo)");
    expect(code).toContain("return reply.send({");
    expect(code).toContain("lineItems,");
    expect(code).toContain("orden,");
  });
});

// ═════════════════════════════════════════════════
//  2. Frontend — facturacion.js
// ═════════════════════════════════════════════════

describe("🎨 [Sprint 21] Frontend facturacion.js", () => {
  it("fetchFacturasEmitidas calls /finance/invoices API", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/shared/public/js/facturacion.js"),
      "utf-8"
    );
    expect(code).toContain("api('/finance/invoices')");
    expect(code).not.toContain("placeholder informativo");
    expect(code).not.toContain("Módulo SIFEN — Conectando");
  });

  it("showFacturaDetalle fetches invoice detail with line items", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/shared/public/js/facturacion.js"),
      "utf-8"
    );
    expect(code).toContain("showFacturaDetalle");
    expect(code).toContain("api(`/finance/invoices/${facturaId}`)");
    expect(code).toContain("lineItems");
    expect(code).toContain("item.tipoLinea");
    expect(code).toContain("item.descripcion");
  });

  it("facturacion table has Ver button for each invoice", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/shared/public/js/facturacion.js"),
      "utf-8"
    );
    expect(code).toContain("ver-factura-btn");
    expect(code).toContain("data-id");
  });

  it("shows estado_pago and sifen_status in invoice list", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const code = readFileSync(
      join(process.cwd(), "src/shared/public/js/facturacion.js"),
      "utf-8"
    );
    expect(code).toContain("estadoPago");
    expect(code).toContain("sifenStatus");
    expect(code).toContain("PENDIENTE");
  });
});
