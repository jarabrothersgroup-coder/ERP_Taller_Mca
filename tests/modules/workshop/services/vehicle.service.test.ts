/**
 * Vehicle Service — Unit Tests
 *
 * Tests CRUD operations for the vehicles entity service.
 * Dependencies on `db()` are mocked at the module level.
 *
 * @module tests/modules/workshop/services/vehicle.service.test
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

// The workshop schema barrel re-exports vehiculos — mock the whole barrel
vi.mock("../../../../src/modules/workshop/schema/index.js", () => ({
  vehiculos: { id: "vehiculos.id", clientId: "vehiculos.clientId" },
}));

const { createVehicle, updateVehicle, deleteVehicle, listVehicles, getVehicle } = await import(
  "../../../../src/modules/workshop/services/vehicle.service.js"
);

// ─── Helpers ───────────────────────────────────

function mockSelectQuery(returnValue: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(returnValue)),
      })),
    })),
  };
}

function mockInsert(returnValue: unknown[]) {
  return {
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve(returnValue)),
    })),
  };
}

function mockUpdate(returnValue: unknown[]) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(returnValue)),
      })),
    })),
  };
}

function mockDelete() {
  return {
    where: vi.fn(() => Promise.resolve()),
  };
}

function makeVehicle(overrides: Record<string, unknown> = {}) {
  return {
    id: "v-001",
    clientId: "c-001",
    plate: "ABC-1234",
    vin: "1HGCM82633A004352",
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    engineType: "Nafta",
    kilometraje: 50000,
    hvBatteryVoltage: null,
    hvSafetyDisabled: false,
    dtcCodes: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────

describe("Vehicle Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // T-33: every mutation writes an entity audit row → default insert chain
    // so logEntityAudit() resolves without per-test configuration.
    mockDb.insert.mockReturnValue(mockInsert([]));
  });

  describe("createVehicle", () => {
    it("creates a vehicle with required fields", async () => {
      // Client existence check succeeds
      mockDb.select.mockReturnValue(mockSelectQuery([{ id: "c-001" }]));
      mockDb.insert.mockReturnValue(mockInsert([makeVehicle()]));

      const result = await createVehicle({
        brand: "Toyota",
        model: "Corolla",
        clientId: "c-001",
      });

      // 2 inserts: the vehicle row + its T-33 audit entry
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({ brand: "Toyota", model: "Corolla" });
    });

    it("throws if brand is missing", async () => {
      await expect(
        createVehicle({ model: "Corolla", clientId: "c-001" }),
      ).rejects.toThrow("marca");
    });

    it("throws if model is missing", async () => {
      await expect(
        createVehicle({ brand: "Toyota", clientId: "c-001" }),
      ).rejects.toThrow("modelo");
    });

    it("throws if clientId is missing", async () => {
      await expect(
        createVehicle({ brand: "Toyota", model: "Corolla" }),
      ).rejects.toThrow("ID del cliente");
    });

    it("throws if client does not exist", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([]));

      await expect(
        createVehicle({ brand: "Toyota", model: "Corolla", clientId: "nonexistent" }),
      ).rejects.toThrow("no encontrado");
    });

    it("accepts optional HEV fields", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([{ id: "c-001" }]));

      const hevVehicle = makeVehicle({
        engineType: "HEV",
        hvBatteryVoltage: 355,
        hvSafetyDisabled: false,
      });
      mockDb.insert.mockReturnValue(mockInsert([hevVehicle]));

      const result = await createVehicle({
        brand: "Toyota",
        model: "Prius",
        clientId: "c-001",
        engineType: "HEV",
        hvBatteryVoltage: 355,
      });

      expect(result.engineType).toBe("HEV");
      expect(result.hvBatteryVoltage).toBe(355);
    });

    it("rejects invalid engine type", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([{ id: "c-001" }]));

      await expect(
        createVehicle({
          brand: "Tesla",
          model: "Model 3",
          clientId: "c-001",
          engineType: "Nuclear",
        }),
      ).rejects.toThrow("Tipo de motor inválido");
    });
  });

  describe("updateVehicle", () => {
    it("updates an existing vehicle", async () => {
      mockDb.select
        .mockReturnValueOnce(mockSelectQuery([{ id: "v-001" }]))
        .mockReturnValueOnce(mockSelectQuery([{ id: "c-001" }]));
      mockDb.update.mockReturnValue(
        mockUpdate([makeVehicle({ brand: "Honda", model: "Civic" })]),
      );

      const result = await updateVehicle("v-001", {
        brand: "Honda",
        model: "Civic",
      });

      expect(result.brand).toBe("Honda");
    });

    it("throws NotFoundError if vehicle does not exist", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([]));

      await expect(
        updateVehicle("nonexistent", { brand: "Honda" }),
      ).rejects.toThrow("no encontrado");
    });

    it("throws ValidationError if no valid fields", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([{ id: "v-001" }]));

      await expect(
        updateVehicle("v-001", {}),
      ).rejects.toThrow("No hay campos válidos");
    });
  });

  describe("deleteVehicle", () => {
    it("deletes an existing vehicle", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([{ id: "v-001" }]));
      mockDb.delete.mockReturnValue(mockDelete());

      const result = await deleteVehicle("v-001");

      expect(result).toEqual({ deleted: true });
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });

    it("throws NotFoundError if vehicle does not exist", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([]));

      await expect(deleteVehicle("nonexistent")).rejects.toThrow(
        "no encontrado",
      );
    });
  });

  describe("listVehicles", () => {
    /**
     * Mock de las 2 queries de `listVehicles` (T-54): count primero, luego la
     * página de datos. Devuelve los spies de limit/offset.
     */
    function mockPaginated(rows: unknown[], total: number) {
      const offset = vi.fn(() => Promise.resolve(rows));
      const limit = vi.fn(() => ({ offset }));
      const dataChain = { where: vi.fn(), orderBy: vi.fn(), limit };
      dataChain.where.mockReturnValue(dataChain);
      dataChain.orderBy.mockReturnValue(dataChain);
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([{ total }])) })),
        })
        .mockReturnValueOnce({ from: vi.fn(() => dataChain) });
      return { limit, offset };
    }

    it("returns the requested page of vehicles", async () => {
      const vehicles = [makeVehicle({ id: "v-001", brand: "Toyota" })];
      const { limit, offset } = mockPaginated(vehicles, 1);

      const result = await listVehicles({});
      expect(result.items).toHaveLength(1);
      expect(result.items[0].brand).toBe("Toyota");
      expect(result).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(limit).toHaveBeenCalledWith(20);
      expect(offset).toHaveBeenCalledWith(0);
    });

    it("applies page/limit on the server and computes totalPages", async () => {
      const { limit, offset } = mockPaginated([makeVehicle({ id: "v-011" })], 34);

      const result = await listVehicles({ page: 2, limit: 10 });

      expect(result).toMatchObject({ page: 2, limit: 10, total: 34, totalPages: 4 });
      expect(limit).toHaveBeenCalledWith(10);
      expect(offset).toHaveBeenCalledWith(10);
    });

    it("caps limit at 100", async () => {
      const { limit } = mockPaginated([], 0);

      const result = await listVehicles({ limit: 9999 });

      expect(result.limit).toBe(100);
      expect(limit).toHaveBeenCalledWith(100);
    });

    it("returns an empty page when no match", async () => {
      mockPaginated([], 0);
      const result = await listVehicles({ brand: "Nonexistent" });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("getVehicle", () => {
    it("returns vehicle when found", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([makeVehicle({ id: "v-001" })]));
      const result = await getVehicle("v-001");
      expect(result.id).toBe("v-001");
    });

    it("throws NotFoundError when not found", async () => {
      mockDb.select.mockReturnValue(mockSelectQuery([]));
      await expect(getVehicle("nonexistent")).rejects.toThrow("no encontrado");
    });
  });
});
