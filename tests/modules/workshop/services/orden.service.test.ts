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
    createdAt: "ot.createdAt", updatedAt: "ot.updatedAt", assignedTo: "ot.assignedTo",
    tenantSlug: "ot.tenantSlug",
  },
  vehiculos: { id: "v.id", brand: "v.brand", model: "v.model", plate: "v.plate" },
  estadoOrdenEnum: { enumValues: ["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo", "Finalizado_Retirado"] },
}));

vi.mock("../../../../src/modules/finance/services/accounting/audit-log.service.js", () => ({
  logEntityAudit: vi.fn(() => Promise.resolve()),
}));

const { listOrdenes, getOrden, deleteOrden } = await import(
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
    assignedTo: null,
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

/**
 * Mock chain for `select({ total: count() }).from(T).where(...)` — the
 * `where()` terminal resolves directly to a count row.
 */
function makeCountQuery(total: number) {
  const chain: { from: ReturnType<typeof vi.fn>; where?: ReturnType<typeof vi.fn> } = {
    from: vi.fn(() => chain),
  };
  chain.where = vi.fn(() => Promise.resolve([{ total }]));
  return chain;
}

// ─── Tests ─────────────────────────────────────

describe("Orden Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("listOrdenes", () => {
    /**
     * Mock de las 2 queries de `listOrdenes` (T-54): count primero, luego la
     * página de datos. Devuelve los spies de limit/offset.
     */
    function mockPaginated(rows: unknown[], total: number) {
      const offset = vi.fn(() => Promise.resolve(rows));
      const limit = vi.fn(() => ({ offset }));
      const dataChain = {
        leftJoin: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        limit,
      };
      dataChain.leftJoin.mockReturnValue(dataChain);
      dataChain.where.mockReturnValue(dataChain);
      dataChain.orderBy.mockReturnValue(dataChain);
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn(() => {
            const countChain = { leftJoin: vi.fn(), where: vi.fn() };
            countChain.leftJoin.mockReturnValue(countChain);
            countChain.where.mockReturnValue(Promise.resolve([{ total }]));
            return countChain;
          }),
        })
        .mockReturnValueOnce({ from: vi.fn(() => dataChain) });
      return { limit, offset };
    }

    it("returns the requested page of ordenes without filters", async () => {
      const rows = [makeOrdenRow()];
      const { limit, offset } = mockPaginated(rows, 1);

      const result = await listOrdenes();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: "ot-001",
        vehiculo: "Toyota Corolla",
        cliente: "Juan Pérez",
        status: "En_Proceso",
      });
      expect(result.items[0].createdAt).toBe("2026-06-09T10:00:00.000Z");
      expect(result).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(limit).toHaveBeenCalledWith(20);
      expect(offset).toHaveBeenCalledWith(0);
    });

    it("filters by status", async () => {
      const rows = [makeOrdenRow({ status: "Presupuestado" })];
      mockPaginated(rows, 1);

      const result = await listOrdenes({ status: "Presupuestado" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe("Presupuestado");
    });

    it("returns an empty page when no matching orders", async () => {
      mockPaginated([], 0);

      const result = await listOrdenes({ status: "Listo" });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("applies page/limit on the server and computes totalPages", async () => {
      const rows = [makeOrdenRow({ id: "ot-001" })];
      const { limit, offset } = mockPaginated(rows, 95);

      const result = await listOrdenes({ page: 2, limit: 20 });

      expect(result).toMatchObject({ page: 2, limit: 20, total: 95, totalPages: 5 });
      expect(result.items).toHaveLength(1);
      expect(limit).toHaveBeenCalledWith(20);
      expect(offset).toHaveBeenCalledWith(20);
    });

    it("caps limit at 100", async () => {
      const { limit } = mockPaginated([], 0);

      const result = await listOrdenes({ limit: 500 });

      expect(result.limit).toBe(100);
      expect(limit).toHaveBeenCalledWith(100);
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

  describe("deleteOrden", () => {
    function mockDelete() {
      mockDb.delete.mockReturnValue({ where: vi.fn(() => Promise.resolve()) });
    }

    it("deletes the orden when it has no related facturas or stock movements", async () => {
      mockDb.select
        .mockReturnValueOnce(makeSelectQuery([makeOrdenRow()]))
        .mockReturnValueOnce(makeCountQuery(0))
        .mockReturnValueOnce(makeCountQuery(0));
      mockDelete();

      const result = await deleteOrden("ot-001", "demo");

      expect(result).toEqual({ deleted: true });
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });

    it("throws NotFoundError when the orden does not exist", async () => {
      mockDb.select.mockReturnValueOnce(makeSelectQuery([]));

      await expect(deleteOrden("missing", "demo")).rejects.toThrow(
        "no encontrada",
      );
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("throws ConflictError (409) when the orden has facturas", async () => {
      mockDb.select
        .mockReturnValueOnce(makeSelectQuery([makeOrdenRow()]))
        .mockReturnValueOnce(makeCountQuery(2));

      await expect(deleteOrden("ot-001", "demo")).rejects.toThrow(
        /factura/,
      );
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("throws ConflictError (409) when the orden has stock movements", async () => {
      mockDb.select
        .mockReturnValueOnce(makeSelectQuery([makeOrdenRow()]))
        .mockReturnValueOnce(makeCountQuery(0))
        .mockReturnValueOnce(makeCountQuery(3));

      await expect(deleteOrden("ot-001", "demo")).rejects.toThrow(
        /movimiento/,
      );
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("conflict errors carry HTTP status 409", async () => {
      mockDb.select
        .mockReturnValueOnce(makeSelectQuery([makeOrdenRow()]))
        .mockReturnValueOnce(makeCountQuery(1));

      await expect(deleteOrden("ot-001", "demo")).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });
});
