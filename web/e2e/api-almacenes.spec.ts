import { test, expect } from "@playwright/test";

/**
 * API-level E2E tests for Multi-almacén (warehouse) endpoints.
 *
 * Tests actual POST/GET/DELETE operations on /inventory/almacenes/*
 * and /inventory/almacenes/transferir.
 */
test.describe("API: Multi-almacén", () => {
  const baseUrl = "http://localhost:4000";
  const headers = {
    "X-Tenant-Slug": "demo",
    "Content-Type": "application/json",
  };

  test("POST /inventory/almacenes creates and returns a warehouse", async ({ request }) => {
    const res = await request.post(`${baseUrl}/inventory/almacenes`, {
      headers,
      data: {
        codigo: `TEST-${Date.now()}`,
        nombre: "Test Warehouse E2E",
        direccion: "Av. Test 123",
        responsable: "Test User",
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.codigo).toContain("TEST-");
    expect(body.nombre).toBe("Test Warehouse E2E");
  });

  test("GET /inventory/almacenes lists warehouses", async ({ request }) => {
    const res = await request.get(`${baseUrl}/inventory/almacenes`, { headers });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test("GET /inventory/almacenes/:id returns single warehouse", async ({ request }) => {
    // First create one
    const create = await request.post(`${baseUrl}/inventory/almacenes`, {
      headers,
      data: { codigo: `GET-TEST-${Date.now()}`, nombre: "Get Test" },
    });
    const created = await create.json();

    const res = await request.get(`${baseUrl}/inventory/almacenes/${created.id}`, { headers });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBe(created.id);
  });

  test("POST /inventory/almacenes/transferir rejects with invalid data", async ({ request }) => {
    const res = await request.post(`${baseUrl}/inventory/almacenes/transferir`, {
      headers,
      data: { repuestoId: "00000000-0000-0000-0000-000000000000", cantidad: -1, almacenDestinoId: "00000000-0000-0000-0000-000000000000" },
    });
    // Should fail validation (negative quantity)
    expect(res.ok()).toBeFalsy();
  });
});
