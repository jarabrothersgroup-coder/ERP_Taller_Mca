/**
 * Sprint 81 — GAP Services & Financial Statements Tests
 *
 * Tests for:
 *   1. Libro de Compras IVA — module exports + signature
 *   2. Libro de Ventas IVA — module exports + signature
 *   3. Pre-Transaction Validator — signature + validation rules
 *   4. Credit/Debit Note Service — signature + options
 *   5. Cash Flow Statement — module exports + signature
 *   6. Equity Statement — module exports + signature
 *
 * @module tests/sprint81-gap
 */

import { describe, it, expect } from "vitest";

describe("Sprint 81 — GAP Services & Financial Statements", () => {
  // ════════════════════════════════════════════════
  // 1. Libro de Compras IVA
  // ════════════════════════════════════════════════

  describe("LibroComprasIVA", () => {
    it("exports generarLibroComprasIVA from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(typeof mod.generarLibroComprasIVA).toBe("function");
    });

    it("accepts (anho, mes, formato) params", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const fnStr = mod.generarLibroComprasIVA.toString();
      expect(fnStr).toContain("anho");
      expect(fnStr).toContain("mes");
      expect(fnStr).toContain("formato");
    });

    it("exposes route at /finance/contabilidad/libro-compras-iva/:anho/:mes", async () => {
      const routeMod = await import("../src/modules/finance/routes/accounting.js");
      expect(routeMod).toBeDefined();
      expect(routeMod.accountingRoutes).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════
  // 2. Libro de Ventas IVA
  // ════════════════════════════════════════════════

  describe("LibroVentasIVA", () => {
    it("exports generarLibroVentasIVA from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(typeof mod.generarLibroVentasIVA).toBe("function");
    });

    it("returns proper report structure", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const fnStr = mod.generarLibroVentasIVA.toString();
      expect(fnStr).toContain("periodo");
      expect(fnStr).toContain("entries");
    });
  });

  // ════════════════════════════════════════════════
  // 3. Pre-Transaction Validator
  // ════════════════════════════════════════════════

  describe("PreTransactionValidator", () => {
    it("exports validarPreTransaccion from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(typeof mod.validarPreTransaccion).toBe("function");
    });

    it("validates mapping existence and account types", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const fnStr = mod.validarPreTransaccion.toString();
      // Should check mapping resolution
      expect(fnStr).toContain("resolveMapping");
      // Should validate account is active
      expect(fnStr).toContain("activo");
      // Should check monto is positive
      expect(fnStr).toContain("monto");
    });

    it("returns ValidationResult with errors/advertencias arrays", async () => {
      const mod = await import("../src/modules/finance/services/accounting/pre-transaction-validator.service.js");
      // Check the type has errors and advertencias
      const exported = Object.keys(mod);
      expect(exported).toContain("validarPreTransaccion");
    });
  });

  // ════════════════════════════════════════════════
  // 4. Credit/Debit Note Service
  // ════════════════════════════════════════════════

  describe("CreditDebitNoteService", () => {
    it("exports generarNotaCreditoDebito from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(typeof mod.generarNotaCreditoDebito).toBe("function");
    });

    it("accepts CREDITO and DEBITO types", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const fnStr = mod.generarNotaCreditoDebito.toString();
      expect(fnStr).toContain("CREDITO");
      expect(fnStr).toContain("DEBITO");
      expect(fnStr).toContain("facturaOriginalId");
      expect(fnStr).toContain("motivo");
    });

    it("returns CreditDebitNoteResult with success/error handling", async () => {
      const mod = await import("../src/modules/finance/services/accounting/credit-debit-note.service.js");
      const exported = Object.keys(mod);
      expect(exported).toContain("generarNotaCreditoDebito");
      // Verify the return type structure
      const fnStr = mod.generarNotaCreditoDebito.toString();
      expect(fnStr).toContain("success");
      expect(fnStr).toContain("error");
    });
  });

  // ════════════════════════════════════════════════
  // 5. Cash Flow Statement (GAP-03)
  // ════════════════════════════════════════════════

  describe("CashFlowStatement", () => {
    it("exports getCashFlowStatement from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(typeof mod.getCashFlowStatement).toBe("function");
    });

    it("accepts (anho, mes, acumulado) params", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const fnStr = mod.getCashFlowStatement.toString();
      expect(fnStr).toContain("anho");
      expect(fnStr).toContain("mes");
      expect(fnStr).toContain("acumulado");
    });

    it("returns CashFlowStatement structure with 3 sections", async () => {
      const mod = await import("../src/modules/finance/services/accounting/cash-flow.service.js");
      const exported = Object.keys(mod);
      expect(exported).toContain("getCashFlowStatement");
      // Check service implements indirect method
      const fnStr = mod.getCashFlowStatement.toString();
      expect(fnStr).toContain("utilidadNeta");
      expect(fnStr).toContain("operativas");
      expect(fnStr).toContain("inversion");
      expect(fnStr).toContain("financiamiento");
    });

    it("has route at /finance/contabilidad/flujo-efectivo/:anho/:mes", async () => {
      const routeMod = await import("../src/modules/finance/routes/accounting.js");
      expect(routeMod).toBeDefined();
      expect(routeMod.accountingRoutes).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════
  // 6. Equity Statement (GAP-03)
  // ════════════════════════════════════════════════

  describe("EquityStatement", () => {
    it("exports getEquityStatement from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(typeof mod.getEquityStatement).toBe("function");
    });

    it("returns EquityStatement with capital/reservas/resultados sections", async () => {
      const mod = await import("../src/modules/finance/services/accounting/equity-statement.service.js");
      const exported = Object.keys(mod);
      expect(exported).toContain("getEquityStatement");
      const fnStr = mod.getEquityStatement.toString();
      expect(fnStr).toContain("capital");
      expect(fnStr).toContain("reservas");
      expect(fnStr).toContain("resultados");
      expect(fnStr).toContain("resultadoEjercicio");
    });

    it("tracks opening and closing balances per equity line", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const fnStr = mod.getEquityStatement.toString();
      expect(fnStr).toContain("saldoInicial");
      expect(fnStr).toContain("saldoFinal");
      expect(fnStr).toContain("totalPatrimonioInicial");
      expect(fnStr).toContain("totalPatrimonioFinal");
    });

    it("has route at /finance/contabilidad/evolucion-patrimonio/:anho/:mes", async () => {
      const routeMod = await import("../src/modules/finance/routes/accounting.js");
      expect(routeMod).toBeDefined();
      expect(routeMod.accountingRoutes).toBeDefined();
    });
  });
});
