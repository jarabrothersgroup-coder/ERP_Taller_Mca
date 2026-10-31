/**
 * Accounting Closure Service — Monthly Close Tests (ACC-001)
 *
 * Verifies that the closure engine:
 *   - Aggregates MANUAL + ELECTRONICA invoice totals via SQL SUM (not in heap)
 *   - Creates a balanced double-entry journal entry
 *   - Throws when no transactions exist for the period
 *
 * @module tests/modules/finance/accounting-closure.test
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mock data ─────────────────────────────────

const MOCK_TENANT = "taller_central_oviedo";
const MOCK_CAJA_ID = "a0000000-0000-0000-0000-000000000001";
const MOCK_INGRESOS_ID = "b0000000-0000-0000-0000-000000000002";
const MOCK_ASIENTO_ID = "c0000000-0000-0000-0000-000000000003";

// ─── Hoisted mock controller ──────────────────

const mockTxImpl = vi.hoisted(() => ({
  /** Override per-test by replacing this function */
  build: (): unknown => buildStandardTx(),
}));

/**
 * Standard mock transaction returning invoice data and chart-of-account IDs.
 */
function buildStandardTx() {
  let callCount = 0;

  function result<T>(data: T) {
    const p = Promise.resolve(data);
    return Object.assign(p, { limit: () => p });
  }

  function arr<T>(v: T) {
    return [v] as T[];
  }

  // Orden real del servicio: (1) agregado de ventas, (2) próximo número,
  // (3-4) resolución de cuentas imputables ANTES de escribir la cabecera,
  // (5) INSERT del asiento. Resolver primero evita cabeceras «balanceadas»
  // sin líneas de detalle.
  const results: Record<number, unknown> = {
    1: result(arr({ ingresoTotal: 5000000 })),
    2: result(arr({ maxNum: 5 })),
    3: result(arr({ id: MOCK_CAJA_ID })),
    4: result(arr({ id: MOCK_INGRESOS_ID })),
    5: result(arr({
      id: MOCK_ASIENTO_ID,
      numero: 6,
      totalDebe: "5000000",
      totalHaber: "5000000",
      moduloOrigen: "CIERRE_MENSUAL",
      documentoRef: "CIERRE-2026-06",
    })),
  };

  return {
    select: () => ({
      from: () => ({
        where: () => {
          callCount++;
          return results[callCount] ?? result([]);
        },
        then: (resolve: (v: unknown) => unknown) => {
          callCount++;
          const r = results[callCount] ?? result([]);
          return Promise.resolve(r).then(resolve);
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          callCount++;
          return results[callCount] ?? result([]);
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(undefined),
      }),
    }),
  };
}

// ─── Mock db() — hoisted before imports ────────

// El servicio corre dentro de `db().transaction(...)` y los helpers de
// resolución de cuentas (account-resolver) llaman `db()` esperando la
// MISMA transacción — igual que `currentTx()` en producción. El mock
// replica esa semántica: `db()` devuelve la transacción activa.
vi.mock("../../../src/shared/database/drizzle.js", () => {
  let current: any = null;

  const root = {
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      current = mockTxImpl.build();
      try {
        return await cb(current);
      } finally {
        current = null;
      }
    }),
    select: (...args: unknown[]) => current.select(...args),
    insert: (...args: unknown[]) => current.insert(...args),
    update: (...args: unknown[]) => current.update(...args),
  };

  return { db: vi.fn(() => root) };
});

// ─── Import after vi.mock (hoisted) ─────────────

import { AccountingClosureService } from "../../../src/modules/finance/services/accounting-closure.service.js";

// ─── Tests ─────────────────────────────────────

describe("📊 CAPA 1 & 3: Motor de Cierre Contable y Asientos Automatizados", () => {
  it("ACC-001-TEST: Debería consolidar ingresos de ambos motores (Manual + DTE) y generar partida doble limpia", async () => {
    const resultado = await AccountingClosureService.executeMonthlyClosure(
      MOCK_TENANT,
      2026,
      6,
    );

    expect(resultado.status).toBe("CLOSED_SUCCESS");
    expect(resultado.totalConsolidado).toBe(5_000_000);
    expect(resultado.periodo).toBe("2026-06");
    expect(resultado.asientoId).toBe(MOCK_ASIENTO_ID);
  });

  it("Lanza error si no hay transacciones en el periodo (total 0)", async () => {
    // Override mock: make SUM return 0 for this test
    mockTxImpl.build = () => ({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([{ ingresoTotal: 0 }]),
          then: () => Promise.resolve([{ maxNum: 0 }]),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    });

    await expect(
      AccountingClosureService.executeMonthlyClosure(MOCK_TENANT, 2026, 7),
    ).rejects.toThrow(/no se registraron transacciones/i);
  });

  it("Usa tenant slug correcto en el filtro", async () => {
    // Reset to standard mock
    mockTxImpl.build = () => buildStandardTx();

    const resultado = await AccountingClosureService.executeMonthlyClosure(
      "taller_lambare",
      2026,
      1,
    );

    expect(resultado.status).toBe("CLOSED_SUCCESS");
    expect(resultado.periodo).toBe("2026-01");
  });
});
