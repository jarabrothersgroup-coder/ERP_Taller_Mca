/**
 * Sync Service — Unit Tests
 *
 * Tests the entity routing, retry logic, error handling,
 * and configuration export of the offline sync service.
 *
 * @module tests/shared/offline/sync-service.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all service dependencies ─────────────

vi.mock("../../../src/modules/workshop/services/client.service.js", () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));

vi.mock("../../../src/modules/workshop/services/vehicle.service.js", () => ({
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
}));

vi.mock("../../../src/modules/workshop/services/ingreso.service.js", () => ({
  createIngreso: vi.fn(),
}));

vi.mock("../../../src/modules/workshop/services/orden.service.js", () => ({
  updateOrdenStatus: vi.fn(),
}));

vi.mock("../../../src/shared/database/drizzle.js", () => ({
  db: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve({ returning: vi.fn() })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn() })),
    })),
  })),
}));

// Now import after mocks are set up
const { processSyncQueue, getSyncConfig } = await import(
  "../../../src/shared/offline/sync-service.js"
);

const {
  createClient,
  updateClient,
  deleteClient,
} = await import("../../../src/modules/workshop/services/client.service.js");

const {
  createVehicle,
  updateVehicle,
  deleteVehicle,
} = await import("../../../src/modules/workshop/services/vehicle.service.js");

const { createIngreso } = await import(
  "../../../src/modules/workshop/services/ingreso.service.js"
);

const { updateOrdenStatus } = await import(
  "../../../src/modules/workshop/services/orden.service.js"
);

// ─── Helpers ───────────────────────────────────

function makeOp(overrides: Record<string, unknown> = {}) {
  return {
    id: "op-001",
    tenant: "taller-el-chero",
    entity: "clients",
    action: "create" as const,
    payload: { name: "Test Client" },
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────

describe("processSyncQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("entity routing", () => {
    it("routes 'clients' create to createClient", async () => {
      vi.mocked(createClient).mockResolvedValue({} as any);

      const results = await processSyncQueue([makeOp()]);

      expect(createClient).toHaveBeenCalledTimes(1);
      expect(createClient).toHaveBeenCalledWith({ name: "Test Client" }, "taller-el-chero");
      expect(results[0]).toMatchObject({
        operationId: "op-001",
        status: "applied",
      });
    });

    it("routes 'clients' update to updateClient with id", async () => {
      vi.mocked(updateClient).mockResolvedValue({} as any);

      const results = await processSyncQueue([
        makeOp({
          action: "update",
          payload: { id: "client-1", name: "Updated Name" },
        }),
      ]);

      expect(updateClient).toHaveBeenCalledTimes(1);
      expect(updateClient).toHaveBeenCalledWith("client-1", {
        id: "client-1",
        name: "Updated Name",
      }, "taller-el-chero");
      expect(results[0].status).toBe("applied");
    });

    it("routes 'clients' delete to deleteClient with id", async () => {
      vi.mocked(deleteClient).mockResolvedValue({ deleted: true });

      const results = await processSyncQueue([
        makeOp({
          action: "delete",
          payload: { id: "client-1" },
        }),
      ]);

      expect(deleteClient).toHaveBeenCalledTimes(1);
      expect(deleteClient).toHaveBeenCalledWith("client-1", "taller-el-chero");
      expect(results[0].status).toBe("applied");
    });

    it("fails clients update if payload has no id", async () => {
      const results = await processSyncQueue([
        makeOp({
          action: "update",
          payload: { name: "No ID" },
        }),
      ]);

      expect(results[0]).toMatchObject({
        operationId: "op-001",
        status: "failed",
      });
      expect(results[0].error).toContain("id");
    });

    it("routes 'vehicles' create to createVehicle with tenant", async () => {
      vi.mocked(createVehicle).mockResolvedValue({} as any);

      const results = await processSyncQueue([
        makeOp({
          entity: "vehicles",
          payload: { brand: "Toyota", model: "Corolla", clientId: "c-1" },
        }),
      ]);

      expect(createVehicle).toHaveBeenCalledTimes(1);
      expect(createVehicle).toHaveBeenCalledWith(
        expect.objectContaining({ brand: "Toyota" }), "taller-el-chero",
      );
      expect(results[0].status).toBe("applied");
    });

    it("routes 'vehicles' update to updateVehicle", async () => {
      vi.mocked(updateVehicle).mockResolvedValue({} as any);

      const results = await processSyncQueue([
        makeOp({
          entity: "vehicles",
          action: "update",
          payload: { id: "v-1", brand: "Honda" },
        }),
      ]);

      expect(updateVehicle).toHaveBeenCalledTimes(1);
      expect(updateVehicle).toHaveBeenCalledWith("v-1", {
        id: "v-1",
        brand: "Honda",
      }, "taller-el-chero");
      expect(results[0].status).toBe("applied");
    });

    it("routes 'vehicles' delete to deleteVehicle", async () => {
      vi.mocked(deleteVehicle).mockResolvedValue({ deleted: true });

      const results = await processSyncQueue([
        makeOp({
          entity: "vehicles",
          action: "delete",
          payload: { id: "v-1" },
        }),
      ]);

      expect(deleteVehicle).toHaveBeenCalledTimes(1);
      expect(deleteVehicle).toHaveBeenCalledWith("v-1", "taller-el-chero");
      expect(results[0].status).toBe("applied");
    });

    it("routes 'work-orders' create", async () => {
      const results = await processSyncQueue([
        makeOp({
          entity: "work-orders",
          action: "create",
          payload: {
            vehicleId: "v-1",
            clientId: "c-1",
            description: "Oil change",
          },
        }),
      ]);

      expect(results[0].status).toBe("applied");
    });

    it("routes 'work-orders' update with status", async () => {
      vi.mocked(updateOrdenStatus).mockResolvedValue({ id: "wo-1", status: "En_Proceso" });

      const results = await processSyncQueue([
        makeOp({
          entity: "work-orders",
          action: "update",
          payload: { id: "wo-1", status: "En_Proceso" },
        }),
      ]);

      expect(updateOrdenStatus).toHaveBeenCalledWith("wo-1", "En_Proceso", "taller-el-chero");
      expect(results[0].status).toBe("applied");
    });

    it("rejects work-orders delete with descriptive error", async () => {
      const results = await processSyncQueue([
        makeOp({
          entity: "work-orders",
          action: "delete",
          payload: { id: "wo-1" },
        }),
      ]);

      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("no se eliminan");
    });

    it("routes 'ingresos' create to createIngreso", async () => {
      vi.mocked(createIngreso).mockResolvedValue({} as any);

      const results = await processSyncQueue([
        makeOp({
          entity: "ingresos",
          payload: { vehicleId: "v-1" },
        }),
      ]);

      expect(createIngreso).toHaveBeenCalledTimes(1);
      expect(createIngreso).toHaveBeenCalledWith(
        expect.objectContaining({ vehicleId: "v-1" }), "taller-el-chero",
      );
      expect(results[0].status).toBe("applied");
    });

    it("rejects ingresos update/delete", async () => {
      const results = await processSyncQueue([
        makeOp({
          entity: "ingresos",
          action: "update",
          payload: {},
        }),
      ]);

      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("no soportada");
    });
  });

  describe("error handling", () => {
    it("fails operations beyond max retries", async () => {
      const results = await processSyncQueue([
        makeOp({ retryCount: 6 }),
      ]);

      expect(results[0]).toMatchObject({
        operationId: "op-001",
        status: "failed",
        error: "Max retries exceeded",
      });
      expect(createClient).not.toHaveBeenCalled();
    });

    it("returns failed for unknown entity", async () => {
      const results = await processSyncQueue([
        makeOp({ entity: "gadgets" }),
      ]);

      expect(results[0]).toMatchObject({
        operationId: "op-001",
        status: "failed",
      });
      expect(results[0].error).toContain("Unknown entity");
    });

    it("catches errors thrown by handlers", async () => {
      vi.mocked(createClient).mockRejectedValue(new Error("DB connection lost"));

      const results = await processSyncQueue([makeOp()]);

      expect(results[0]).toMatchObject({
        operationId: "op-001",
        status: "failed",
        error: "DB connection lost",
      });
    });

    it("processes remaining operations after one failure", async () => {
      vi.mocked(createClient).mockRejectedValue(new Error("Fail first"));
      vi.mocked(createVehicle).mockResolvedValue({} as any);

      const ops = [
        makeOp({ id: "op-1", entity: "clients" }),
        makeOp({ id: "op-2", entity: "vehicles", payload: { brand: "Toyota", model: "Corolla", clientId: "c-1" } }),
      ];

      const results = await processSyncQueue(ops);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("failed");
      expect(results[1].status).toBe("applied");
    });
  });

  describe("getSyncConfig", () => {
    it("returns config with expected defaults", () => {
      const config = getSyncConfig();

      expect(config).toMatchObject({
        maxBatchSize: 50,
        retryMaxAttempts: 5,
        retryBackoffBaseMs: 1000,
        strategy: "last-write-wins",
      });
      expect(config.supportedEntities).toContain("clients");
      expect(config.supportedEntities).toContain("vehicles");
      expect(config.supportedEntities).toContain("work-orders");
      expect(config.supportedEntities).toContain("ingresos");
    });
  });
});
