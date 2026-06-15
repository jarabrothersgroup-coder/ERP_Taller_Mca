/**
 * Client Service — Unit Tests
 *
 * Tests CRUD operations for the clients entity service.
 * Dependencies on `db()` are mocked at the module level.
 *
 * @module tests/modules/workshop/services/client.service.test
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

// Mock the clients schema so the service import resolves
vi.mock("../../../../src/shared/database/schema/clients.js", () => ({
  clients: { id: "clients.id", name: "clients.name" },
}));

const { createClient, updateClient, deleteClient, listClients, getClient } = await import(
  "../../../../src/modules/workshop/services/client.service.js"
);

// ─── Helpers ───────────────────────────────────

function mockQuery(returnValue: unknown[]) {
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

// ─── Tests ─────────────────────────────────────

describe("Client Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createClient", () => {
    it("creates a client with valid name", async () => {
      const now = new Date();
      const fakeClient = {
        id: "c-001",
        name: "Juan Pérez",
        email: null,
        phone: null,
        ruc: null,
        address: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };

      mockDb.insert.mockReturnValue(mockInsert([fakeClient]));

      const result = await createClient({ name: "Juan Pérez" });

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ id: "c-001", name: "Juan Pérez" });
    });

    it("throws if name is empty", async () => {
      await expect(createClient({ name: "" })).rejects.toThrow(
        "El nombre del cliente es obligatorio",
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("throws if name is missing", async () => {
      await expect(createClient({})).rejects.toThrow(
        "El nombre del cliente es obligatorio",
      );
    });

    it("passes optional fields when provided", async () => {
      const now = new Date();
      mockDb.insert.mockReturnValue(
        mockInsert([
          {
            id: "c-002",
            name: "ACME SRL",
            email: "acme@example.com",
            phone: "+595981000000",
            ruc: "80000000-1",
            address: "Av. San Martín 123",
            notes: "Cliente corporativo",
            createdAt: now,
            updatedAt: now,
          },
        ]),
      );

      const result = await createClient({
        name: "ACME SRL",
        email: "acme@example.com",
        phone: "+595981000000",
        ruc: "80000000-1",
        address: "Av. San Martín 123",
        notes: "Cliente corporativo",
      });

      expect(result.email).toBe("acme@example.com");
      expect(result.ruc).toBe("80000000-1");
    });
  });

  describe("updateClient", () => {
    it("updates an existing client's fields", async () => {
      // First call: existence check
      mockDb.select.mockReturnValue(
        mockQuery([{ id: "c-001" }]),
      );
      // Second call: update
      const now = new Date();
      mockDb.update.mockReturnValue(
        mockUpdate([
          {
            id: "c-001",
            name: "Juan Pablo Pérez",
            email: "jpp@example.com",
            phone: null,
            ruc: "80000000-1",
            address: null,
            notes: "Actualizado",
            createdAt: now,
            updatedAt: now,
          },
        ]),
      );

      const result = await updateClient("c-001", {
        name: "Juan Pablo Pérez",
        email: "jpp@example.com",
        ruc: "80000000-1",
        notes: "Actualizado",
      });

      expect(result.name).toBe("Juan Pablo Pérez");
      expect(result.email).toBe("jpp@example.com");
    });

    it("throws NotFoundError if client does not exist", async () => {
      mockDb.select.mockReturnValue(mockQuery([]));

      await expect(
        updateClient("nonexistent", { name: "Test" }),
      ).rejects.toThrow("no encontrado");
    });

    it("throws ValidationError if name is empty", async () => {
      mockDb.select.mockReturnValue(mockQuery([{ id: "c-001" }]));

      await expect(
        updateClient("c-001", { name: "" }),
      ).rejects.toThrow("no puede estar vacío");
    });

    it("throws ValidationError if no valid fields to update", async () => {
      mockDb.select.mockReturnValue(mockQuery([{ id: "c-001" }]));

      await expect(updateClient("c-001", {})).rejects.toThrow(
        "No hay campos válidos",
      );
    });
  });

  describe("deleteClient", () => {
    it("deletes an existing client", async () => {
      mockDb.select.mockReturnValue(mockQuery([{ id: "c-001" }]));
      mockDb.delete.mockReturnValue(mockDelete());

      const result = await deleteClient("c-001");

      expect(result).toEqual({ deleted: true });
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });

    it("throws NotFoundError if client does not exist", async () => {
      mockDb.select.mockReturnValue(mockQuery([]));

      await expect(deleteClient("nonexistent")).rejects.toThrow(
        "no encontrado",
      );
    });
  });

  describe("listClients", () => {
    it("returns all clients ordered by createdAt desc", async () => {
      const now = new Date();
      const clientsData = [
        { id: "c-001", name: "Juan", email: null, phone: null, ruc: null, address: null, notes: null, createdAt: now, updatedAt: now },
        { id: "c-002", name: "María", email: null, phone: null, ruc: null, address: null, notes: null, createdAt: now, updatedAt: now },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve(clientsData)),
          })),
        })),
      });

      const result = await listClients();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Juan");
      expect(result[1].name).toBe("María");
    });

    it("returns empty array when no clients", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
      });

      const result = await listClients();
      expect(result).toEqual([]);
    });
  });

  describe("getClient", () => {
    it("returns client when found", async () => {
      const now = new Date();
      mockDb.select.mockReturnValue(mockQuery([{ id: "c-001", name: "Juan Pérez", email: null, phone: null, ruc: null, address: null, notes: null, createdAt: now, updatedAt: now }]));

      const result = await getClient("c-001");
      expect(result.id).toBe("c-001");
      expect(result.name).toBe("Juan Pérez");
    });

    it("throws NotFoundError when not found", async () => {
      mockDb.select.mockReturnValue(mockQuery([]));
      await expect(getClient("nonexistent")).rejects.toThrow("no encontrado");
    });
  });
});
