import { test, expect } from "@playwright/test";

/**
 * API-level E2E tests for Asignación Inteligente de Mecánicos.
 *
 * Tests POST /workshop/mechanic-assignment/assign.
 */
test.describe("API: Asignación Inteligente de Mecánicos", () => {
  const baseUrl = "http://localhost:4000";

  test("POST /workshop/mechanic-assignment/assign requires ordenId", async ({ request }) => {
    const res = await request.post(`${baseUrl}/workshop/mechanic-assignment/assign`, {
      headers: { "X-Tenant-Slug": "demo", "Content-Type": "application/json" },
      data: {},
    });
    expect(res.ok()).toBeFalsy();
  });

  test("POST /workshop/mechanic-assignment/assign rejects invalid ordenId", async ({ request }) => {
    const res = await request.post(`${baseUrl}/workshop/mechanic-assignment/assign`, {
      headers: { "X-Tenant-Slug": "demo", "Content-Type": "application/json" },
      data: { ordenId: "00000000-0000-0000-0000-000000000000" },
    });
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
