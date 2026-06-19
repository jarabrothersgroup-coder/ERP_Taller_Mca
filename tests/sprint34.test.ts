/**
 * Sprint 34 Tests — Phase 2 Implementation.
 *
 * Tests for:
 *   - Block 5: OT Stock Consumer (reorder alerts on OT close)
 *   - Block 3: Flat Rate (time tracking, efficiency)
 *   - Block 4: Multi-branch (sucursales CRUD)
 *   - Block 2: DVI (Digital Vehicle Inspection)
 *   - Block 1: WhatsApp Queue (retry persistence)
 *
 * @module tests/sprint34
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock database ────────────────────────────
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue([]);
const mockReturning = vi.fn().mockResolvedValue([{ id: "test-id" }]);
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({ returning: mockReturning }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockReturning }),
  }),
});

const mockDb = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}));

vi.mock("../../src/shared/database/drizzle.js", () => ({
  db: mockDb,
}));

// ─── Block 5: OT Stock Consumer ────────────────

describe("Sprint 34 — Block 5: OT Stock Consumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports consumeStockOnOTClose function", async () => {
    const mod = await import(
      "../../src/modules/inventory/services/ot-stock-consumer.js"
    );
    expect(typeof mod.consumeStockOnOTClose).toBe("function");
  });

  it("exports previewStockConsumption function", async () => {
    const mod = await import(
      "../../src/modules/inventory/services/ot-stock-consumer.js"
    );
    expect(typeof mod.previewStockConsumption).toBe("function");
  });
});

// ─── Block 3: Flat Rate Service ────────────────

describe("Sprint 34 — Block 3: Flat Rate Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports clockIn function", async () => {
    const mod = await import(
      "../../src/modules/workshop/services/flat-rate.service.js"
    );
    expect(typeof mod.clockIn).toBe("function");
  });

  it("exports clockOut function", async () => {
    const mod = await import(
      "../../src/modules/workshop/services/flat-rate.service.js"
    );
    expect(typeof mod.clockOut).toBe("function");
  });

  it("exports getTechnicianEfficiency function", async () => {
    const mod = await import(
      "../../src/modules/workshop/services/flat-rate.service.js"
    );
    expect(typeof mod.getTechnicianEfficiency).toBe("function");
  });

  it("exports getBayProfitability function", async () => {
    const mod = await import(
      "../../src/modules/workshop/services/flat-rate.service.js"
    );
    expect(typeof mod.getBayProfitability).toBe("function");
  });
});

// ─── Block 4: Sucursal Service ────────────────

describe("Sprint 34 — Block 4: Sucursal Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports createSucursal function", async () => {
    const mod = await import(
      "../../src/modules/config/services/sucursal.service.js"
    );
    expect(typeof mod.createSucursal).toBe("function");
  });

  it("exports listSucursales function", async () => {
    const mod = await import(
      "../../src/modules/config/services/sucursal.service.js"
    );
    expect(typeof mod.listSucursales).toBe("function");
  });

  it("exports getSucursalById function", async () => {
    const mod = await import(
      "../../src/modules/config/services/sucursal.service.js"
    );
    expect(typeof mod.getSucursalById).toBe("function");
  });

  it("exports updateSucursal function", async () => {
    const mod = await import(
      "../../src/modules/config/services/sucursal.service.js"
    );
    expect(typeof mod.updateSucursal).toBe("function");
  });

  it("exports deleteSucursal function", async () => {
    const mod = await import(
      "../../src/modules/config/services/sucursal.service.js"
    );
    expect(typeof mod.deleteSucursal).toBe("function");
  });
});

// ─── Block 2: DVI Service ─────────────────────

describe("Sprint 34 — Block 2: DVI Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports createDvi function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.createDvi).toBe("function");
  });

  it("exports getDviById function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.getDviById).toBe("function");
  });

  it("exports listDviByOrden function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.listDviByOrden).toBe("function");
  });

  it("exports addPhoto function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.addPhoto).toBe("function");
  });

  it("exports updatePhotoMarkup function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.updatePhotoMarkup).toBe("function");
  });

  it("exports addItem function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.addItem).toBe("function");
  });

  it("exports updateItemStatus function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.updateItemStatus).toBe("function");
  });

  it("exports calculateHealthScore function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.calculateHealthScore).toBe("function");
  });

  it("exports shareViaWhatsApp function", async () => {
    const mod = await import("../../src/modules/dvi/services/dvi.service.js");
    expect(typeof mod.shareViaWhatsApp).toBe("function");
  });
});

// ─── Block 1: WhatsApp Queue ──────────────────

describe("Sprint 34 — Block 1: WhatsApp Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports enqueueMessage function", async () => {
    const mod = await import(
      "../../src/modules/whatsapp/services/whatsapp-queue.service.js"
    );
    expect(typeof mod.enqueueMessage).toBe("function");
  });

  it("exports processPendingMessages function", async () => {
    const mod = await import(
      "../../src/modules/whatsapp/services/whatsapp-queue.service.js"
    );
    expect(typeof mod.processPendingMessages).toBe("function");
  });

  it("exports retryFailedMessages function", async () => {
    const mod = await import(
      "../../src/modules/whatsapp/services/whatsapp-queue.service.js"
    );
    expect(typeof mod.retryFailedMessages).toBe("function");
  });

  it("exports getQueueStats function", async () => {
    const mod = await import(
      "../../src/modules/whatsapp/services/whatsapp-queue.service.js"
    );
    expect(typeof mod.getQueueStats).toBe("function");
  });
});

// ─── Schema Validation ────────────────────────

describe("Sprint 34 — Schema Validation", () => {
  it("orden_servicios has new time tracking columns", async () => {
    const mod = await import(
      "../../src/modules/workshop/schema/orden-servicios.js"
    );
    // Drizzle tables expose column names via Symbol or column config
    const table = mod.ordenServicios;
    expect(table).toBeDefined();
    // Check column exists by accessing it
    expect(table.duracionEstimada).toBeDefined();
    expect(table.duracionReal).toBeDefined();
    expect(table.horaInicioReal).toBeDefined();
    expect(table.horaFinReal).toBeDefined();
    expect(table.tecnicoId).toBeDefined();
  });

  it("ordenes_trabajo has sucursalId column", async () => {
    const mod = await import(
      "../../src/modules/workshop/schema/ordenes-trabajo.js"
    );
    const table = mod.ordenesTrabajo;
    expect(table).toBeDefined();
    expect(table.sucursalId).toBeDefined();
  });

  it("agendamientos has sucursalId column", async () => {
    const mod = await import(
      "../../src/modules/scheduling/schema/agendamientos.js"
    );
    const table = mod.agendamientos;
    expect(table).toBeDefined();
    expect(table.sucursalId).toBeDefined();
  });

  it("sucursales schema exists", async () => {
    const mod = await import("../../src/modules/config/schema/sucursales.js");
    expect(mod.sucursales).toBeDefined();
    expect(mod.sucursales.nombre).toBeDefined();
    expect(mod.sucursales.codigo).toBeDefined();
  });

  it("dvi schema has all tables", async () => {
    const mod = await import("../../src/modules/dvi/schema/dvi.js");
    expect(mod.dviInspections).toBeDefined();
    expect(mod.dviPhotos).toBeDefined();
    expect(mod.dviItems).toBeDefined();
  });
});
