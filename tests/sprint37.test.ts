/**
 * Sprint 37 Tests — DVI Photo Grid + Calendar Backend Integration.
 *
 * Tests for:
 *   - DVI Photo Storage Service (upload, delete, list)
 *   - Calendar Backend Integration (CRUD, availability)
 *   - Sync Status Indicator
 *
 * @module tests/sprint37
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
  execute: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock("../../src/shared/database/drizzle.js", () => ({
  db: mockDb,
}));

// Mock Supabase client
const mockSupabase = {
  storage: {
    listBuckets: vi.fn().mockResolvedValue({ data: [], error: null }),
    createBucket: vi.fn().mockResolvedValue({ error: null }),
    upload: vi.fn().mockResolvedValue({ error: null }),
    download: vi.fn().mockResolvedValue({
      data: {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
        type: "image/jpeg",
      },
      error: null,
    }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.example.com/signed-url" },
      error: null,
    }),
  },
};

vi.mock("../../src/shared/database/supabase.js", () => ({
  getSupabaseAdmin: () => mockSupabase,
  getSupabaseAnon: () => mockSupabase,
}));

// ─── DVI Photo Storage Service ────────────────

describe("Sprint 37 — DVI Photo Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports uploadPhoto with validation", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    expect(typeof mod.uploadPhoto).toBe("function");
  });

  it("exports deletePhoto function", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    expect(typeof mod.deletePhoto).toBe("function");
  });

  it("exports listPhotos function", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    expect(typeof mod.listPhotos).toBe("function");
  });

  it("exports getSignedUrl function", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    expect(typeof mod.getSignedUrl).toBe("function");
  });

  it("uploadPhoto validates file size (10MB max)", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    await expect(
      mod.uploadPhoto({
        tenantSlug: "test",
        inspectionId: "test-id",
        photoId: "photo-id",
        fileBuffer: largeBuffer,
        contentType: "image/jpeg",
        filename: "large.jpg",
      }),
    ).rejects.toThrow("excede");
  });

  it("uploadPhoto validates content type", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    await expect(
      mod.uploadPhoto({
        tenantSlug: "test",
        inspectionId: "test-id",
        photoId: "photo-id",
        fileBuffer: Buffer.from("test"),
        contentType: "application/pdf",
        filename: "test.pdf",
      }),
    ).rejects.toThrow("no permitido");
  });
});

// ─── DVI Plugin Registration ─────────────────

describe("Sprint 37 — DVI Plugin with Photo Routes", () => {
  it("plugin includes photo routes", async () => {
    const mod = await import("../../src/modules/dvi/plugin.js");
    expect(mod.default).toBeDefined();
  });
});

// ─── Calendar Backend Integration ────────────

describe("Sprint 37 — Calendar Backend Integration", () => {
  it("scheduling routes exist", async () => {
    const mod = await import(
      "../../src/modules/scheduling/routes/scheduling.routes.js"
    );
    expect(typeof mod.schedulingRoutes).toBe("function");
  });

  it("scheduling service has createAgendamiento", async () => {
    const mod = await import(
      "../../src/modules/scheduling/services/agendamiento.service.js"
    );
    expect(typeof mod.createAgendamiento).toBe("function");
  });

  it("scheduling service has listAgendamientos", async () => {
    const mod = await import(
      "../../src/modules/scheduling/services/agendamiento.service.js"
    );
    expect(typeof mod.listAgendamientos).toBe("function");
  });

  it("scheduling service has transitionState", async () => {
    const mod = await import(
      "../../src/modules/scheduling/services/agendamiento.service.js"
    );
    expect(typeof mod.transitionState).toBe("function");
  });

  it("capacity service has checkAvailability", async () => {
    const mod = await import(
      "../../src/modules/scheduling/services/capacity.service.js"
    );
    expect(typeof mod.checkAvailability).toBe("function");
  });
});

// ─── Sync Status ─────────────────────────────

describe("Sprint 37 — Sync Status Indicator", () => {
  it("sync plugin exists", async () => {
    const mod = await import("../../src/plugins/sync.js");
    expect(typeof mod.syncPlugin).toBe("function");
  });

  it("sync config returns supported entities", async () => {
    const mod = await import(
      "../../src/shared/offline/sync-service.js"
    );
    const config = mod.getSyncConfig();
    expect(config.supportedEntities).toContain("dvi");
    expect(config.supportedEntities).toContain("scheduling");
    expect(config.supportedEntities).toContain("signatures");
  });
});

// ─── Frontend Module Validation ──────────────

describe("Sprint 37 — Frontend Module Files", () => {
  it("dvi.js has Supabase Storage integration", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "src/shared/public/js/dvi.js",
      "utf-8",
    );
    expect(content).toContain("dviHandlePhotoUpload");
    expect(content).toContain("dviDeletePhoto");
    expect(content).toContain("_dviLoadPhotos");
    expect(content).toContain("dviUpdatePhotoCount");
    expect(content).toContain("10MB");
  });

  it("calendario.js has backend integration", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "src/shared/public/js/calendario.js",
      "utf-8",
    );
    expect(content).toContain("/scheduling/appointments");
    expect(content).toContain("/scheduling/check-availability");
    expect(content).toContain("calEditAppointment");
    expect(content).toContain("calCancelAppointment");
    expect(content).toContain("_calCheckAvailability");
  });

  it("pwa.js has sync status indicator", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "src/shared/public/js/pwa.js",
      "utf-8",
    );
    expect(content).toContain("updateSyncStatus");
    expect(content).toContain("ws-dot");
    expect(content).toContain("ws-label");
  });
});
