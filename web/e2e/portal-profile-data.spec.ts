import { test, expect } from "@playwright/test";
import { loginAsAdmin, getApiAuthHeaders, BACKEND_URL } from "./auth.setup";

test.describe("Portal/Profile — datos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("Perfil de usuario responde con datos válidos", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);
    const res = await page.request.get(`${BACKEND_URL}/auth/me`, {
      headers,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("email");
    expect(body.email).toBeTruthy();
  });

  test("Rutas de portal no devuelven error inesperado", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);
    const res = await page.request.get(`${BACKEND_URL}/portal/ingresos`, {
      headers,
    });
    expect([200, 401, 403, 404]).toContain(res.status());
  });
});
