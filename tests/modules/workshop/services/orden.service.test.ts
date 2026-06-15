/**
 * Orden Service — Unit Tests
 *
 * Tests listOrdenes, getOrden, and existing status operations.
 *
 * @module tests/modules/workshop/services/orden.service.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock db() ─────────────────────────────────

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../../../../src/shared/database/drizzle.js", () => ({
  db: vi.fn(() => mockDb),
}));

vi.mock("../../../../src/shared/database/schema/clients.js", () => ({
  clients: { id: "clients.id", name: "clients.name" },
}));

vi.mock("../../../../src/modules/workshop/schema/index.js", () => ({
  ordenesTrabajo: {
    id: "ot.id", vehicleId: "ot.vehicleId", clientId: "ot.clientId",
    status: "ot.status", hvAlert: "ot.hvAlert", hvLockoutSigned: "ot.hvLockoutSigned",
    description: "ot.description", dtcCodes: "ot.dtcCodes",
    createdAt: "ot.createdAt", updatedAt: "ot.updatedAt",
  },
  vehiculos: { id: "v.id", brand: "v.brand", model: "v.model", plate: "v.plate" },
}));

const { listOrdenes, getOrden } = await import(
  "../../../../src/modules/workshop/services/orden.service.js"
);

// ─── Helpers ───────────────────────────────────

function makeOrdenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ot-001",
    vehicleId: "v-001",
    clientId: "c-001",
    description: "Cambio de aceite",
    status: "En_Proceso",
    hvAlert: false,
    hvLockoutSigned: false,
    dtcCodes: null,
    createdAt: new Date("2026-06-09T10:00:00Z"),
    updatedAt: new Date("2026-06-09T12:00:00Z"),
    vehiculo: "Toyota Corolla",
    plate: "ABC-1234",
    cliente: "Juan Pérez",
    ...overrides,
  };
}

/**
 * Creates a mock chain for Drizzle select queries.
 *
 * Supports two call patterns:
 *   .limit(1)                     → thenable for direct await (getOrden)
 *   .limit(n).offset(m)           → chain to offset (listOrdenes)
 *
 * The `limit()` result is both thenable (has `then`) and
 * has an `offset()` method.
 */
function makeSelectQuery(returnValue: unknown[]) {
  const limitResult = {
    offset: vi.fn(() => Promise.resolve(returnValue)),
    then: vi.fn((resolve: (v: unknown) => void) => { resolve(returnValue); }),
  };

  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => limitResult),
  };

  return chain;
}

// ─── Tests ─────────────────────────────────────

describe("Orden Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("listOrdenes", () => {
    it("returns all ordenes without filters", async () => {
      const rows = [makeOrdenRow()];
      mockDb.select.mockReturnValue(makeSelectQuery(rows));

      const result = await listOrdenes();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "ot-001",
        vehiculo: "Toyota Corolla",
        cliente: "Juan Pérez",
        status: "En_Proceso",
      });
      expect(result[0].createdAt).toBe("2026-06-09T10:00:00.000Z");
    });

    it("filters by status", async () => {
      const rows = [makeOrdenRow({ status: "Presupuestado" })];
      mockDb.select.mockReturnValue(makeSelectQuery(rows));

      const result = await listOrdenes({ status: "Presupuestado" });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("Presupuestado");
    });

    it("returns empty array when no matching orders", async () => {
      mockDb.select.mockReturnValue(makeSelectQuery([]));

      const result = await listOrdenes({ status: "Listo" });

      expect(result).toEqual([]);
    });

    it("respects limit and offset", async () => {
      const rows = [makeOrdenRow({ id: "ot-001" })];
      mockDb.select.mockReturnValue(makeSelectQuery(rows));

      const result = await listOrdenes({ limit: 1, offset: 5 });

      expect(result).toHaveLength(1);
    });
  });

  describe("getOrden", () => {
    it("returns orden when found", async () => {
      const row = makeOrdenRow();
      mockDb.select.mockReturnValue(makeSelectQuery([row]));

      const result = await getOrden("ot-001");

      expect(result).toMatchObject({
        id: "ot-001",
        vehiculo: "Toyota Corolla",
      });
    });

    it("throws NotFoundError when orden not found", async () => {
      mockDb.select.mockReturnValue(makeSelectQuery([]));

      await expect(getOrden("nonexistent")).rejects.toThrow(
        "no encontrada",
      );
    });
  });
});
