import { test, expect } from "@playwright/test";
import { loginAsAdmin, getApiAuthHeaders, BACKEND_URL } from "./auth.setup";
import { EXPECTED_MOBILE } from "./expected-data";

/**
 * (a) Portal de clientes — E2E con asserts de datos (T-21 / FIN-06).
 *
 * El spec anterior iba a `/portal/profile`, una ruta que **no existe** en el
 * backend y aceptaba `[200,401,403,404]`, o sea que pasaba con la pantalla
 * rota. El fix real (T-21) fue que el portal deje de pegar a `/profile` y
 * use `/portal/summary`, que es el que trae el teléfono del cliente (lo
 * necesita el booking para las sugerencias de horario).
 *
 * Criterios de aceptación cubiertos:
 *  - "Booking con teléfono del cliente": `/portal/summary` devuelve
 *    `client.phone` y el booking de verdad lo manda a la API.
 *  - "Respetando auth mágica": sin sesión de portal → 401.
 *
 * @module web/e2e/portal-profile-data
 */

const SEED_CLIENT_EMAIL = "e2e-uno@example.test";
const PORTAL_PHONE = EXPECTED_MOBILE.portalPhone;

test.describe("Portal de clientes — datos reales", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("PIN → sesión → /portal/summary devuelve el teléfono sembrado", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);

    // El cliente lo crea el seed (sin esto el teléfono es poesía).
    const list = await page.request.get(
      `${BACKEND_URL}/workshop/clientes?search=${SEED_CLIENT_EMAIL}`,
      { headers },
    );
    expect(list.status()).toBe(200);
    const listBody = (await list.json()) as {
      items: Array<{ id: string; email: string | null; phone: string | null }>;
    };
    expect(listBody.items.length, "el seed debe crear e2e-uno@example.test").toBe(1);
    const cliente = listBody.items[0];
    expect(cliente.phone).toBe(PORTAL_PHONE);

    // Login de portal por PIN (el otro camino del auth mágica).
    const pinRes = await page.request.post(`${BACKEND_URL}/portal/auth/pin`, {
      headers,
      data: { clientId: cliente.id },
    });
    expect(pinRes.status()).toBe(200);
    const { pin } = (await pinRes.json()) as { pin?: string };
    expect(pin, "el backend debe devolver el PIN").toBeTruthy();

    const validate = await page.request.post(`${BACKEND_URL}/portal/auth/pin/validate`, {
      headers,
      data: { clientId: cliente.id, pin },
    });
    expect(validate.status()).toBe(200);
    const { session } = (await validate.json()) as { session: string };
    expect(session).toBeTruthy();

    // El payload que consume el perfil y el booking.
    const summary = await page.request.get(`${BACKEND_URL}/portal/summary`, {
      headers: { ...headers, "X-Portal-Session": session },
    });
    expect(summary.status()).toBe(200);
    const body = (await summary.json()) as {
      client: { id: string; name: string; phone: string | null };
      vehicles: unknown[];
      recentOrders: unknown[];
    };
    expect(body.client.id).toBe(cliente.id);
    expect(body.client.phone).toBe(PORTAL_PHONE);
    expect(Array.isArray(body.vehicles)).toBe(true);
    expect(Array.isArray(body.recentOrders)).toBe(true);
  });

  test("perfil y booking del portal usan el teléfono del cliente", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);

    // Auth mágica real: el backend devuelve el link en dev (no manda email).
    const magic = await page.request.post(`${BACKEND_URL}/portal/auth/magic`, {
      headers,
      data: { email: SEED_CLIENT_EMAIL },
    });
    expect(magic.status()).toBe(200);
    const { link } = (await magic.json()) as { link?: string };
    expect(link, "el link mágico debe venir en la respuesta").toBeTruthy();

    // Valida el token y deja la sesión de portal en localStorage.
    await page.goto(link!);
    await expect(page.getByText("¡Acceso concedido!")).toBeVisible({ timeout: 25000 });

    // ── Perfil: el teléfono real se pinta (no un placeholder) ──
    await page.goto("/portal/perfil");
    await expect(page.getByText(PORTAL_PHONE)).toBeVisible({ timeout: 25000 });

    // ── Booking: para sugerir horarios manda ese teléfono a la API ──
    await page.goto("/portal/booking");
    const phoneRequest = page.waitForRequest(
      (r) => r.url().includes("/scheduling/ai-suggestions") && r.url().includes("clientePhone="),
      { timeout: 25000 },
    );
    // Elegir fecha es lo que dispara la carga de sugerencias. Igual que en
    // label-printing: fill() puede correr antes de la hidratación y el input
    // controlado revierte el valor (React #418) → reintentar hasta que quede.
    const mañana = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    await expect(async () => {
      await page.locator('input[type="date"]').fill(mañana);
      await expect(page.locator('input[type="date"]')).toHaveValue(mañana);
    }).toPass({ timeout: 15000 });
    const req = await phoneRequest;
    expect(new URL(req.url()).searchParams.get("clientePhone")).toBe(PORTAL_PHONE);
  });

  test("auth mágica y contrato viejo: 401 sin sesión y /portal/profile muerto", async ({
    page,
  }) => {
    const headers = await getApiAuthHeaders(page.request);

    const anonimo = await page.request.get(`${BACKEND_URL}/portal/summary`, { headers });
    expect(anonimo.status(), "sin sesión de portal no se lee el perfil").toBe(401);

    // El break original: la app pegaba a /portal/profile, que nunca existió.
    const profile = await page.request.get(`${BACKEND_URL}/portal/profile`, { headers });
    expect(profile.status()).toBe(404);
  });
});
