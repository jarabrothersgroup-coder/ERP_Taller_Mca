import { test, expect } from "@playwright/test";
import { getApiAuthHeaders } from "./auth.setup";

/**
 * API-level E2E tests for Nota de Crédito SIFEN.
 *
 * Tests POST /finance/sifen/nota-credito validation logic.
 * Full emission requires valid original DTE — tested separately.
 */
test.describe("API: Nota de Crédito SIFEN", () => {
  const baseUrl = "http://localhost:4000";
  let headers: Record<string, string>;

  test.beforeEach(async ({ request }) => {
    headers = await getApiAuthHeaders(request);
  });

  test("POST /finance/sifen/nota-credito rejects invalid CDC", async ({ request }) => {
    const res = await request.post(`${baseUrl}/finance/sifen/nota-credito`, {
      headers,
      data: {
        cdcOriginal: "00000000000000000000000000000000000000000000",
        motivo: "Test NC E2E",
      },
    });
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("no encontrado");
  });

  test("POST /finance/sifen/nota-credito validates required fields", async ({ request }) => {
    const res = await request.post(`${baseUrl}/finance/sifen/nota-credito`, {
      headers,
      data: { cdcOriginal: "" },
    });
    // Should return 400 validation error
    expect(res.status()).toBe(400);
  });
});
