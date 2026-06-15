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

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
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
    function makeListQuery(returnValue: unknown[]) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => Promise.resolve(returnValue)),
              })),
            })),
          })),
        })),
      };
    }

    it("returns all vehicles without filters", async () => {
      const vehicles = [makeVehicle({ id: "v-001", brand: "Toyota" })];
      mockDb.select.mockReturnValue(makeListQuery(vehicles));

      const result = await listVehicles({});
      expect(result).toHaveLength(1);
      expect(result[0].brand).toBe("Toyota");
    });

    it("returns empty array when no match", async () => {
      mockDb.select.mockReturnValue(makeListQuery([]));
      const result = await listVehicles({ brand: "Nonexistent" });
      expect(result).toEqual([]);
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
