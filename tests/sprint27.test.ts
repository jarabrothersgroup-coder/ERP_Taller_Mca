/**
 * Sprint 27 — Bulk Operations + CSV Import + Advanced Filtering
 *
 * Tests:
 *  1. POST /workshop/ordenes/batch/status validates input
 *  2. POST /workshop/ordenes/batch/status rejects > 50 IDs
 *  3. POST /workshop/ordenes/batch/status rejects invalid status
 *  4. POST /workshop/ordenes/batch/delete validates input
 *  5. POST /workshop/ordenes/batch/delete rejects > 50 IDs
 *  6. POST /import/:table/template returns CSV template
 *  7. POST /import/:table rejects empty CSV
 *  8. POST /import/:table rejects missing required columns
 *  9. POST /import/:table parses valid CSV correctly
 * 10. GET /presets lists empty presets
 * 11. POST /presets creates a preset
 * 12. POST /presets validates required fields
 * 13. DELETE /presets/:id deletes a preset
 * 14. GET /presets/quick/ordenes returns quick filters
 * 15. buildFilterCondition handles eq operator
 * 16. buildFilterCondition handles between operator
 * 17. parseCsv handles quoted fields correctly
 * 18. createPreset / listPresets / deletePreset CRUD
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";

// ─── Import utility functions for unit tests ─────
import {
  createPreset,
  listPresets,
  deletePreset,
  buildFilterCondition,
  QUICK_FILTERS,
} from "../src/shared/services/filter-presets.service.js";

let app: any;

beforeAll(async () => {
  app = Fastify({ logger: false });

  // Register tenant resolver (needed for tenantSlug)
  const { resolveTenant } = await import("../src/shared/middleware/tenant-resolver.js");
  app.addHook("onRequest", resolveTenant);

  // Register bulk operations routes
  const { bulkOperationsRoutes } = await import("../src/modules/workshop/routes/bulk-operations.routes.js");
  await app.register(bulkOperationsRoutes);

  // Register import routes
  const { importRoutes } = await import("../src/shared/routes/import.routes.js");
  await app.register(importRoutes);

  // Register filter preset routes
  const { filterPresetRoutes } = await import("../src/shared/routes/filter-presets.routes.js");
  await app.register(filterPresetRoutes);

  await app.ready();
});

afterAll(async () => {
  if (app) await app.close();
});

// ─── Bulk Operations Tests ──────────────────────

describe("Sprint 27 — Bulk Operations", () => {
  it("POST /workshop/ordenes/batch/status validates input", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/ordenes/batch/status",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { ids: [], status: "En_Proceso" },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    // Fastify schema validation rejects empty array
    expect(body.message).toBeDefined();
  });

  it("POST /workshop/ordenes/batch/status rejects > 50 IDs", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    const res = await app.inject({
      method: "POST",
      url: "/workshop/ordenes/batch/status",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { ids, status: "En_Proceso" },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    // Fastify schema validation rejects > 50 items
    expect(body.message).toBeDefined();
  });

  it("POST /workshop/ordenes/batch/status rejects invalid status", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/ordenes/batch/status",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { ids: ["test-id"], status: "InvalidStatus" },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    // Fastify schema validation rejects invalid enum value
    expect(body.message).toBeDefined();
  });

  it("POST /workshop/ordenes/batch/delete validates input", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/ordenes/batch/delete",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { ids: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /workshop/ordenes/batch/delete rejects > 50 IDs", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    const res = await app.inject({
      method: "POST",
      url: "/workshop/ordenes/batch/delete",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { ids },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── CSV Import Tests ───────────────────────────

describe("Sprint 27 — CSV Import", () => {
  it("GET /import/:table/template returns CSV template", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/import/vehiculos/template",
      headers: { "x-tenant-slug": "taller-el-chero" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("vehiculos_template.csv");
    expect(res.payload).toContain("chapa");
    expect(res.payload).toContain("marca");
  });

  it("POST /import/:table rejects empty CSV", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/import/vehiculos",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { csv: "" },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain("CSV vacío");
  });

  it("POST /import/:table rejects missing required columns", async () => {
    const csv = "chapa\nABC123";
    const res = await app.inject({
      method: "POST",
      url: "/import/vehiculos",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { csv },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain("Columna requerida faltante");
  });

  it("POST /import/:table parses valid CSV correctly", async () => {
    const csv = "chapa,marca,modelo\nTEST001,Toyota,Corolla\nTEST002,Honda,Civic";
    const res = await app.inject({
      method: "POST",
      url: "/import/vehiculos",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { csv },
    });
    // Should succeed (200) or fail due to DB constraints (400), but not crash (500)
    expect([200, 400]).toContain(res.statusCode);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty("totalRows", 2);
    expect(body).toHaveProperty("inserted");
    expect(body).toHaveProperty("errors");
  });

  it("POST /import/:table rejects unsupported table", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/import/unsupported_table",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { csv: "col1\nval1" },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain("Tabla no soportada");
  });
});

// ─── Filter Presets Tests ───────────────────────

describe("Sprint 27 — Filter Presets API", () => {
  it("GET /presets lists empty presets initially", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/presets",
      headers: { "x-tenant-slug": "taller-el-chero" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty("presets");
    expect(Array.isArray(body.presets)).toBe(true);
  });

  it("POST /presets creates a preset", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/presets",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: {
        name: "Órdenes Activas",
        entity: "ordenes",
        filters: [{ field: "status", operator: "in", value: ["Presupuestado", "Aprobado"] }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.ok).toBe(true);
    expect(body.preset).toHaveProperty("id");
    expect(body.preset.name).toBe("Órdenes Activas");
  });

  it("POST /presets validates required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/presets",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { name: "", entity: "ordenes", filters: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("DELETE /presets/:id deletes a preset", async () => {
    // Create first
    const createRes = await app.inject({
      method: "POST",
      url: "/presets",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: {
        name: "To Delete",
        entity: "ordenes",
        filters: [{ field: "status", operator: "eq", value: "Listo" }],
      },
    });
    const { preset } = JSON.parse(createRes.payload);

    // Delete
    const delRes = await app.inject({
      method: "DELETE",
      url: `/presets/${preset.id}`,
      headers: { "x-tenant-slug": "taller-el-chero" },
    });
    expect(delRes.statusCode).toBe(200);
    const body = JSON.parse(delRes.payload);
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(true);
  });

  it("GET /presets/quick/:entity returns quick filters", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/presets/quick/ordenes",
      headers: { "x-tenant-slug": "taller-el-chero" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty("quickFilters");
    expect(Array.isArray(body.quickFilters)).toBe(true);
    expect(body.quickFilters.length).toBeGreaterThan(0);
    expect(body.quickFilters[0]).toHaveProperty("key");
    expect(body.quickFilters[0]).toHaveProperty("name");
    expect(body.quickFilters[0]).toHaveProperty("filters");
  });
});

// ─── Filter Presets Unit Tests ──────────────────

describe("Sprint 27 — Filter Presets Unit Tests", () => {
  it("createPreset / listPresets / deletePreset CRUD", () => {
    const preset = createPreset("test-tenant", "Test Preset", "ordenes", [
      { field: "status", operator: "eq", value: "Listo" },
    ]);
    expect(preset).toHaveProperty("id");
    expect(preset.tenantSlug).toBe("test-tenant");
    expect(preset.name).toBe("Test Preset");

    const listed = listPresets("test-tenant", "ordenes");
    expect(listed.some((p) => p.id === preset.id)).toBe(true);

    const deleted = deletePreset(preset.id);
    expect(deleted).toBe(true);

    const listedAfter = listPresets("test-tenant", "ordenes");
    expect(listedAfter.some((p) => p.id === preset.id)).toBe(false);
  });

  it("buildFilterCondition handles eq operator", () => {
    const table = { status: { name: "status" } };
    const condition = buildFilterCondition(table, [
      { field: "status", operator: "eq", value: "Listo" },
    ]);
    expect(condition).toBeDefined();
  });

  it("buildFilterCondition handles between operator", () => {
    const table = { stockActual: { name: "stock_actual" } };
    const condition = buildFilterCondition(table, [
      { field: "stockActual", operator: "between", value: 5, value2: 20 },
    ]);
    expect(condition).toBeDefined();
  });

  it("buildFilterCondition returns undefined for empty filters", () => {
    const table = { status: { name: "status" } };
    const condition = buildFilterCondition(table, []);
    expect(condition).toBeUndefined();
  });

  it("buildFilterCondition skips unknown fields", () => {
    const table = { status: { name: "status" } };
    const condition = buildFilterCondition(table, [
      { field: "unknownField", operator: "eq", value: "test" },
    ]);
    expect(condition).toBeUndefined();
  });
});

// ─── CSV Parser Tests ───────────────────────────

describe("Sprint 27 — CSV Parser", () => {
  it("parseCsv handles quoted fields correctly", async () => {
    // We test the parseCsv function indirectly via the import endpoint
    const csv = 'chapa,marca,modelo\n"ABC,123",Toyota,"Corolla"';
    const res = await app.inject({
      method: "POST",
      url: "/import/vehiculos",
      headers: { "x-tenant-slug": "taller-el-chero", "content-type": "application/json" },
      payload: { csv },
    });
    // Should parse without crashing
    expect([200, 400]).toContain(res.statusCode);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty("totalRows", 1);
  });

  it("QUICK_FILTERS has expected entities", () => {
    expect(QUICK_FILTERS).toHaveProperty("ordenes");
    expect(QUICK_FILTERS).toHaveProperty("repuestos");
    expect(QUICK_FILTERS).toHaveProperty("facturas");
    expect(QUICK_FILTERS.ordenes).toHaveProperty("activas");
    expect(QUICK_FILTERS.repuestos).toHaveProperty("bajo_stock");
    expect(QUICK_FILTERS.facturas).toHaveProperty("pendientes");
  });
});
