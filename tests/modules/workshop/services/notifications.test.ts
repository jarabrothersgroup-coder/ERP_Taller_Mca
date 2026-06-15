/**
 * Notifications Service — Unit Tests
 *
 * Tests CRUD operations and service structure.
 *
 * @module tests/modules/workshop/services/notifications.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock db() with full Drizzle chain ─────────

function createMockDb(defaultResult: any = []) {
  const chain: any = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(defaultResult),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(defaultResult),
    groupBy: vi.fn().mockReturnThis(),
    // Make chain thenable: when `await chain` is called, resolve with defaultResult
    then: vi.fn((resolve: any) => Promise.resolve(defaultResult).then(resolve)),
  };
  return chain;
}

let mockDbInstance = createMockDb();
const mockDbFn = vi.fn(() => mockDbInstance);

vi.mock("../../../../src/shared/database/drizzle.js", () => ({
  db: mockDbFn,
}));

vi.mock("../../../../src/shared/database/schema/notifications.js", () => ({
  notificaciones: {
    id: "n.id",
    tipo: "n.tipo",
    titulo: "n.titulo",
    mensaje: "n.mensaje",
    entityType: "n.entity_type",
    entityId: "n.entity_id",
    leido: "n.leido",
    tenantSlug: "n.tenant_slug",
    createdAt: "n.created_at",
    updatedAt: "n.updated_at",
  },
}));

const {
  crearNotificacion,
  listarNotificaciones,
  contarNoLeidas,
  marcarLeido,
  marcarTodoLeido,
} = await import("../../../../src/modules/workshop/services/notifications.service.js");

// ─── Tests ─────────────────────────────────────

describe("crearNotificacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDb();
    mockDbFn.mockReturnValue(mockDbInstance);
  });

  it("inserts notification and returns it", async () => {
    const fakeNotif = { id: "n1", tipo: "INVENTARIO", titulo: "Test", mensaje: "Msg", leido: false, tenantSlug: "t1" };
    mockDbInstance.returning.mockResolvedValue([fakeNotif]);

    const result = await crearNotificacion({
      tipo: "INVENTARIO",
      titulo: "Test",
      mensaje: "Msg",
      tenantSlug: "t1",
    });

    expect(mockDbInstance.insert).toHaveBeenCalled();
    expect(mockDbInstance.values).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "INVENTARIO",
      titulo: "Test",
      mensaje: "Msg",
      tenantSlug: "t1",
    }));
    expect(result).toEqual(fakeNotif);
  });
});

describe("listarNotificaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDb();
    mockDbFn.mockReturnValue(mockDbInstance);
  });

  it("queries with tenantSlug filter", async () => {
    const fakeList = [{ id: "n1" }, { id: "n2" }];
    mockDbInstance.offset.mockResolvedValue(fakeList);

    const result = await listarNotificaciones("t1");

    expect(mockDbInstance.select).toHaveBeenCalled();
    expect(mockDbInstance.from).toHaveBeenCalled();
    expect(mockDbInstance.where).toHaveBeenCalled();
    expect(result).toEqual(fakeList);
  });

  it("filters by leido when provided", async () => {
    mockDbInstance.offset.mockResolvedValue([]);

    await listarNotificaciones("t1", { leido: true });

    expect(mockDbInstance.where).toHaveBeenCalled();
  });

  it("filters by tipo when provided", async () => {
    mockDbInstance.offset.mockResolvedValue([]);

    await listarNotificaciones("t1", { tipo: "COBRO" });

    expect(mockDbInstance.where).toHaveBeenCalled();
  });
});

describe("contarNoLeidas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDb([]);
    mockDbFn.mockReturnValue(mockDbInstance);
  });

  it("returns count of unread notifications", async () => {
    // contarNoLeidas: select().from().where() — ends with .where() (terminal, no limit/offset)
    // The chain is thenable, so mock .then to return the count result
    mockDbInstance.then = vi.fn((resolve: any) => Promise.resolve([{ total: 5 }]).then(resolve));

    const result = await contarNoLeidas("t1");

    expect(result).toBe(5);
  });

  it("returns 0 when no results", async () => {
    mockDbInstance.then = vi.fn((resolve: any) => Promise.resolve([]).then(resolve));

    const result = await contarNoLeidas("t1");

    expect(result).toBe(0);
  });
});

describe("marcarLeido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDb();
    mockDbFn.mockReturnValue(mockDbInstance);
  });

  it("updates notification to leido=true", async () => {
    const updated = { id: "n1", leido: true };
    mockDbInstance.returning.mockResolvedValue([updated]);

    const result = await marcarLeido("n1");

    expect(mockDbInstance.update).toHaveBeenCalled();
    expect(mockDbInstance.set).toHaveBeenCalledWith(
      expect.objectContaining({ leido: true })
    );
    expect(result).toEqual(updated);
  });

  it("returns undefined when notification not found", async () => {
    mockDbInstance.returning.mockResolvedValue([]);

    const result = await marcarLeido("nonexistent");

    expect(result).toBeUndefined();
  });
});

describe("marcarTodoLeido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDb();
    mockDbFn.mockReturnValue(mockDbInstance);
  });

  it("updates all unread notifications for tenant", async () => {
    await marcarTodoLeido("t1");

    expect(mockDbInstance.update).toHaveBeenCalled();
    expect(mockDbInstance.set).toHaveBeenCalledWith(
      expect.objectContaining({ leido: true })
    );
  });
});
