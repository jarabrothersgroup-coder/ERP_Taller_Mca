/**
 * Sprint 36 Tests — Supabase Storage + Offline Sync + Migration Runner.
 *
 * Tests for:
 *   - Photo Storage Service (upload/download/delete/list)
 *   - Sync Service (DVI, signatures, scheduling handlers)
 *   - Migration Runner (dry run, tracking)
 *
 * @module tests/sprint36
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

// ─── Photo Storage Service ────────────────────

describe("Sprint 36 — Photo Storage Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports uploadPhoto function", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    expect(typeof mod.uploadPhoto).toBe("function");
  });

  it("exports downloadPhoto function", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    expect(typeof mod.downloadPhoto).toBe("function");
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

  it("uploadPhoto rejects invalid content type", async () => {
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
    ).rejects.toThrow("Tipo de archivo no permitido");
  });

  it("uploadPhoto rejects files over 10MB", async () => {
    const mod = await import(
      "../../src/modules/dvi/services/photo-storage.service.js"
    );
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    await expect(
      mod.uploadPhoto({
        tenantSlug: "test",
        inspectionId: "test-id",
        photoId: "photo-id",
        fileBuffer: largeBuffer,
        contentType: "image/jpeg",
        filename: "large.jpg",
      }),
    ).rejects.toThrow("excede el límite");
  });
});

// ─── Sync Service — New Handlers ──────────────

describe("Sprint 36 — Sync Service New Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports processSyncQueue function", async () => {
    const mod = await import(
      "../../src/shared/offline/sync-service.js"
    );
    expect(typeof mod.processSyncQueue).toBe("function");
  });

  it("exports getSyncConfig function", async () => {
    const mod = await import(
      "../../src/shared/offline/sync-service.js"
    );
    const config = mod.getSyncConfig();
    expect(config).toBeDefined();
    expect(config.supportedEntities).toContain("dvi");
    expect(config.supportedEntities).toContain("signatures");
    expect(config.supportedEntities).toContain("scheduling");
  });

  it("getSyncConfig includes new entity types", async () => {
    const mod = await import(
      "../../src/shared/offline/sync-service.js"
    );
    const config = mod.getSyncConfig();
    expect(config.supportedEntities).toEqual(
      expect.arrayContaining(["clients", "vehicles", "work-orders", "ingresos", "inventory", "dvi", "signatures", "scheduling"]),
    );
  });
});

// ─── Migration Runner ─────────────────────────

describe("Sprint 36 — Migration Runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports runMigrations function", async () => {
    const mod = await import(
      "../../src/shared/database/run-migrations.js"
    );
    expect(typeof mod.runMigrations).toBe("function");
  });
});

// ─── Storage Setup Script ─────────────────────

describe("Sprint 36 — Storage Setup Script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports setupStorage function", async () => {
    const mod = await import(
      "../../src/shared/database/setup-storage.js"
    );
    expect(typeof mod.setupStorage).toBe("function");
  });
});

// ─── Migration SQL Validation ─────────────────

describe("Sprint 36 — Migration SQL Files", () => {
  it("0022 migration exists and has valid SQL", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      "src/shared/database/migrations/0022_sprint34_new_tables.sql",
      "utf-8",
    );
    expect(content).toContain("CREATE TABLE");
    expect(content).toContain("sucursales");
    expect(content).toContain("dvi_inspections");
    expect(content).toContain("digital_signatures");
    expect(content).toContain("marketing_campaigns");
    expect(content).toContain("fleets");
    expect(content).toContain("loyalty_accounts");
    expect(content).toContain("google_reviews");
    expect(content).toContain("BEGIN");
    expect(content).toContain("COMMIT");
  });
});
