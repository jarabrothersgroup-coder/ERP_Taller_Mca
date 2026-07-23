import { test, expect } from "@playwright/test";

/**
 * API-level E2E tests for Pagos Online (Stripe/PagosPy).
 *
 * Tests POST /finance/payments/link and
 * POST /finance/payments/webhook validation.
 */
test.describe("API: Pagos Online", () => {
  const baseUrl = "http://localhost:4000";

  test("POST /finance/payments/link rejects non-existent invoice", async ({ request }) => {
    const res = await request.post(`${baseUrl}/finance/payments/link`, {
      headers: { "X-Tenant-Slug": "demo", "Content-Type": "application/json" },
      data: {
        facturaId: "00000000-0000-0000-0000-000000000000",
        provider: "STRIPE",
      },
    });
    expect(res.ok()).toBeFalsy();
  });

  test("POST /finance/payments/link requires valid provider", async ({ request }) => {
    const res = await request.post(`${baseUrl}/finance/payments/link`, {
      headers: { "X-Tenant-Slug": "demo", "Content-Type": "application/json" },
      data: {
        facturaId: "00000000-0000-0000-0000-000000000000",
        provider: "INVALID",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /finance/payments/webhook processes Stripe payload gracefully", async ({ request }) => {
    const res = await request.post(`${baseUrl}/finance/payments/webhook`, {
      headers: { "X-Payment-Provider": "STRIPE", "Content-Type": "application/json" },
      data: {
        data: { object: { client_reference_id: "00000000-0000-0000-0000-000000000000", amount_total: 10000 } },
      },
    });
    const body = await res.json();
    expect(body).toHaveProperty("ok");
  });
});
