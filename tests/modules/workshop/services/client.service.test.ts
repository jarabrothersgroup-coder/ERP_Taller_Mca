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
    // T-33: every mutation writes an entity audit row → default insert chain
    // so logEntityAudit() resolves without per-test configuration.
    mockDb.insert.mockReturnValue(mockInsert([]));
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

      // 2 inserts: the client row + its T-33 audit entry
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
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
    /**
     * Mock de las 2 queries de `listClients` (T-54): count primero, luego la
     * página de datos. Devuelve los spies de limit/offset para poder asertar
     * que la paginación se aplica en el servidor.
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

    it("returns the requested page of clients ordered by createdAt desc", async () => {
      const now = new Date();
      const clientsData = [
        { id: "c-001", name: "Juan", email: null, phone: null, ruc: null, address: null, notes: null, createdAt: now, updatedAt: now },
        { id: "c-002", name: "María", email: null, phone: null, ruc: null, address: null, notes: null, createdAt: now, updatedAt: now },
      ];

      const { limit, offset } = mockPaginated(clientsData, 2);

      const result = await listClients();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe("Juan");
      expect(result.items[1].name).toBe("María");
      expect(result).toMatchObject({ total: 2, page: 1, limit: 20, totalPages: 1 });
      expect(limit).toHaveBeenCalledWith(20);
      expect(offset).toHaveBeenCalledWith(0);
    });

    it("applies page/limit on the server and computes totalPages", async () => {
      const { limit, offset } = mockPaginated([{ id: "c-021" }], 45);

      const result = await listClients({ page: 3, limit: 10 });

      expect(result).toMatchObject({ page: 3, limit: 10, total: 45, totalPages: 5 });
      expect(result.items).toHaveLength(1);
      expect(limit).toHaveBeenCalledWith(10);
      expect(offset).toHaveBeenCalledWith(20);
    });

    it("caps limit at 100 and clamps page to 1-based minimum", async () => {
      const { limit, offset } = mockPaginated([], 0);

      const result = await listClients({ page: 0, limit: 5000 });

      expect(result).toMatchObject({ page: 1, limit: 100, total: 0, totalPages: 0 });
      expect(limit).toHaveBeenCalledWith(100);
      expect(offset).toHaveBeenCalledWith(0);
    });

    it("returns an empty page when no clients", async () => {
      mockPaginated([], 0);

      const result = await listClients();
      expect(result.items).toEqual([]);
      expect(result).toMatchObject({ total: 0, totalPages: 0 });
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
