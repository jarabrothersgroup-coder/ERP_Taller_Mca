import { test, expect } from "@playwright/test";
import { loginAsAdmin, getApiAuthHeaders, BACKEND_URL } from "./auth.setup";
import { EXPECTED } from "./expected-data";

test.describe("Label Printing — datos reales", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("API label templates responde con estructura válida", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);
    const res = await page.request.get(`${BACKEND_URL}/workshop/label-templates`, {
      headers,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("UI label printing carga sin error boundary", async ({ page }) => {
    await page.goto("/dashboard/taller/label-printing");
    await expect(page.getByRole("heading", { name: "Algo salió mal" })).toHaveCount(0, {
      timeout: 25000,
    });
  });
});
