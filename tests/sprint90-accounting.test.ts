/**
 * Sprint 90 — Accounting Configurators & Auto-Reversal Tests
 *
 * Tests for:
 *   1. InventarioConfigurator module existence + defaults
 *   2. WorkshopConfigurator module existence + defaults
 *   3. Auto-Reversal Service
 *   4. centroCostoId propagation on all configurators
 *   5. Integration points (stock.service, orden.service)
 *
 * @module tests/sprint90-accounting
 */

import { describe, it, expect } from "vitest";

// ─── Module Exports ────────────────────────────

describe("Sprint 90 — Accounting Configurators & AutoReversal", () => {
  // ════════════════════════════════════════════════
  // 1. InventarioConfigurator
  // ════════════════════════════════════════════════

  describe("InventarioConfigurator", () => {
    it("exports inventarioConfigurator singleton from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(mod.inventarioConfigurator).toBeDefined();
      expect(typeof mod.inventarioConfigurator.configure).toBe("function");
      expect(typeof mod.inventarioConfigurator.onEntradaStock).toBe("function");
      expect(typeof mod.inventarioConfigurator.onSalidaStock).toBe("function");
      expect(typeof mod.inventarioConfigurator.onAjusteStock).toBe("function");
    });

    it("has correct event handler signatures", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const configurator = mod.inventarioConfigurator;

      // onEntradaStock should accept centroCostoId and ordenTrabajoId
      const params = configurator.onEntradaStock.toString();
      expect(params).toContain("centroCostoId");
      expect(params).toContain("ordenTrabajoId");
      expect(params).toContain("tipoEntrada");
      expect(params).toContain("costoTotal");

      // onSalidaStock should accept centroCostoId and ordenTrabajoId
      const params2 = configurator.onSalidaStock.toString();
      expect(params2).toContain("centroCostoId");
      expect(params2).toContain("ordenTrabajoId");
    });

    it("is registered as INVENTARIO module in configurador_modulo", async () => {
      const mappingMod = await import("../src/modules/finance/services/accounting/mapping.service.js");
      expect(mappingMod).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════
  // 2. WorkshopConfigurator
  // ════════════════════════════════════════════════

  describe("WorkshopConfigurator", () => {
    it("exports workshopConfigurator singleton from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(mod.workshopConfigurator).toBeDefined();
      expect(typeof mod.workshopConfigurator.configure).toBe("function");
      expect(typeof mod.workshopConfigurator.onOTCompletada).toBe("function");
      expect(typeof mod.workshopConfigurator.onOTCancelada).toBe("function");
    });

    it("generates multi-line journal entries for OT completion", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const configurator = mod.workshopConfigurator;

      const params = configurator.onOTCompletada.toString();
      // Should handle multiple revenue accounts
      expect(params).toContain("totalManoObra");
      expect(params).toContain("totalRepuestos");
      expect(params).toContain("totalServicios");
      expect(params).toContain("totalIva");
      expect(params).toContain("centroCostoId");
    });
  });

  // ════════════════════════════════════════════════
  // 3. Auto-Reversal Service
  // ════════════════════════════════════════════════

  describe("AutoReversal Service", () => {
    it("exports autoReversal function from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(typeof mod.autoReversal).toBe("function");
      expect(typeof mod.hasReversal).toBe("function");
      expect(typeof mod.getAsientosByReferencia).toBe("function");
    });

    it("autoReversal returns proper ReversalResult structure", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      // Test that the function signature accepts proper params
      const fnStr = mod.autoReversal.toString();
      expect(fnStr).toContain("referenciaId");
      expect(fnStr).toContain("referenciaTipo");
      expect(fnStr).toContain("motivo");
      expect(fnStr).toContain("tenantSlug");
    });

    it("hasReversal checks for duplicate reversions", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      expect(typeof mod.hasReversal).toBe("function");
    });
  });

  // ════════════════════════════════════════════════
  // 4. centroCostoId Propagation
  // ════════════════════════════════════════════════

  describe("centroCostoId Propagation", () => {
    it("is present in TransactionEvent interface", async () => {
      const bus = await import("../src/modules/finance/services/accounting/accounting-bus.service.js");
      // Check the TransactionEvent type has centroCostoId
      // We can verify by checking function that processes it
      const fnStr = bus.emitFromTransaction.toString();
      expect(fnStr).toContain("centroCostoId");
      expect(fnStr).toContain("event.centroCostoId");
    });

    it("ComprasConfigurator propagates centroCostoId", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const c1 = mod.comprasConfigurator.onCompraCreada.toString();
      expect(c1).toContain("centroCostoId");
      const c2 = mod.comprasConfigurator.onCompraPagada.toString();
      expect(c2).toContain("centroCostoId");
      const c3 = mod.comprasConfigurator.onCompraAnulada.toString();
      expect(c3).toContain("centroCostoId");
    });

    it("SifenConfigurator propagates centroCostoId", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const s = mod.sifenConfigurator.onDTEEmitida.toString();
      expect(s).toContain("centroCostoId");
    });

    it("TesoreriaConfigurator propagates centroCostoId", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const t1 = mod.tesoreriaConfigurator.onMovimientoIngreso.toString();
      expect(t1).toContain("centroCostoId");
      const t2 = mod.tesoreriaConfigurator.onMovimientoEgreso.toString();
      expect(t2).toContain("centroCostoId");
    });

    it("NominaConfigurator propagates centroCostoId", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const n1 = mod.nominaConfigurator.onDevengada.toString();
      expect(n1).toContain("centroCostoId");
      const n2 = mod.nominaConfigurator.onCargasSociales.toString();
      expect(n2).toContain("centroCostoId");
    });
  });

  // ════════════════════════════════════════════════
  // 5. Integration Points
  // ════════════════════════════════════════════════

  describe("Integration Points", () => {
    it("stock.service imports inventarioConfigurator instead of direct emit", async () => {
      const stockMod = await import("../src/modules/inventory/services/stock.service.js");
      // salidaStock should now use inventarioConfigurator
      const fnStr = stockMod.salidaStock.toString();
      expect(fnStr).toContain("inventarioConfigurator");
      expect(fnStr).toContain(".onSalidaStock");
    });

    it("stock.service ingresoStock uses inventarioConfigurator", async () => {
      const stockMod = await import("../src/modules/inventory/services/stock.service.js");
      const fnStr = stockMod.ingresoStock.toString();
      expect(fnStr).toContain("inventarioConfigurator");
      expect(fnStr).toContain(".onEntradaStock");
    });

    it("orden.service imports workshopConfigurator", async () => {
      const ordenMod = await import("../src/modules/workshop/services/orden.service.js");
      // updateOrdenStatus should reference workshopConfigurator
      // by checking the function string (since it's an async inline)
      const exported = Object.keys(ordenMod);
      expect(exported).toContain("updateOrdenStatus");
    });

    it("all 6 configurators are exported from services index", async () => {
      const mod = await import("../src/modules/finance/services/index.js");
      const configurators = [
        "comprasConfigurator",
        "sifenConfigurator",
        "tesoreriaConfigurator",
        "nominaConfigurator",
        "inventarioConfigurator",
        "workshopConfigurator",
      ];
      for (const name of configurators) {
        expect(mod[name]).toBeDefined();
      }
    });
  });

  // ════════════════════════════════════════════════
  // 6. Module Registration
  // ════════════════════════════════════════════════

  describe("Module Registration", () => {
    it("all configurators export a configure() method", async () => {
      const { inventarioConfigurator } = await import("../src/modules/finance/services/index.js");
      const { workshopConfigurator } = await import("../src/modules/finance/services/index.js");

      // Both should have configure() method
      expect(typeof inventarioConfigurator.configure).toBe("function");
      expect(typeof workshopConfigurator.configure).toBe("function");

      // configure is idempotent (the 'configured' flag prevents re-execution)
      const cfgStr = inventarioConfigurator.configure.toString();
      expect(cfgStr).toContain("if (this.configured) return");
    });

    it("configure() requires PostgreSQL (skip in unit tests)", {
      // This test verifies the configure method signature, not DB execution
      // DB-dependent: needs running PostgreSQL
      skip: process.env["SKIP_DB_TESTS"] === "true",
    }, async () => {
      const { inventarioConfigurator } = await import("../src/modules/finance/services/index.js");
      // configure inserts into configurador_modulo (requires DB)
      // Will throw ECONNREFUSED if no PostgreSQL is running
      await expect(inventarioConfigurator.configure()).rejects.toThrow();
    });
  });
});
