import { test, expect } from "@playwright/test";
import { loginAsAdmin, getApiAuthHeaders, BACKEND_URL } from "./auth.setup";

test.describe("Storage/Uploads — datos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("Storage health/paths responden correctamente", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);
    const res = await page.request.get(`${BACKEND_URL}/workshop/ingresos`, {
      headers,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test("Página de uploads no muestra error boundary", async ({ page }) => {
    await page.goto("/dashboard/taller");
    await expect(page.getByRole("heading", { name: "Algo salió mal" })).toHaveCount(0, {
      timeout: 25000,
    });
  });
});
