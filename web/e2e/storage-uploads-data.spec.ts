import { test, expect } from "@playwright/test";
import { loginAsAdmin, getApiAuthHeaders, BACKEND_URL } from "./auth.setup";

/**
 * (a) Storage/uploads — E2E con asserts de datos (T-19 / OPS-06).
 *
 * El break original: `<img src={/uploads/${path}}>` no tenía ruta backend ni
 * rewrite, y los adjuntos usaban `/api/storage/…` que tampoco existe → las
 * fotos de recepción/checklist no se veían. El criterio de aceptación es
 * explícito: "Imágenes de checklist y adjuntos renderizan (E2E con
 * expect(img).toBeVisible())".
 *
 * Por eso el test sube una foto de verdad (POST multipart del flujo de
 * recepción), la sirve por `/storage/:bucket/*` **a través del rewrite de
 * Next** (la capa donde el break original vivía) y la pinta en la página de
 * checklist.
 *
 * El backend de la suite usa `STORAGE_PATH` escribible (ver playwright.config);
 * si se reutiliza un backend arrancado a mano con `/data/erp-storage` sin
 * volumen, la suba falla y el test se salta con el motivo a la vista.
 *
 * @module web/e2e/storage-uploads-data
 */

/** PNG mínimo (1×1) válido para el chequeo de magic bytes del backend. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const SEED_PLATE = "e2e-A123";

test.describe("Storage/uploads — fotos que sí se ven", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("sube una foto de recepción y la sirve por /storage (rewrite incluido)", async ({
    page,
  }) => {
    const headers = await getApiAuthHeaders(page.request);
    // multipart pone su propio Content-Type con boundary.
    const multipart = { ...headers };
    delete multipart["Content-Type"];

    // ── Vehículo sembrado ──
    const vehRes = await page.request.get(`${BACKEND_URL}/workshop/vehiculos?limit=50`, {
      headers,
    });
    expect(vehRes.status()).toBe(200);
    const vehiculos = ((await vehRes.json()).items ?? []) as Array<{ id: string; plate: string }>;
    const vehiculo = vehiculos.find((v) => v.plate === SEED_PLATE);
    expect(vehiculo, `el seed debe crear el vehículo ${SEED_PLATE}`).toBeTruthy();

    // ── Ingreso (check-in) sin crear OT: no mueve los KPIs del resto ──
    const ingresoRes = await page.request.post(`${BACKEND_URL}/workshop/ingresos`, {
      headers,
      data: { vehicleId: vehiculo!.id, kilometraje: 1000, crearOrden: false },
    });
    expect(ingresoRes.status()).toBe(201);
    const ingresoId = ((await ingresoRes.json()).ingreso as { id: string }).id;
    expect(ingresoId).toBeTruthy();

    // ── Subida real (el mismo multipart que usa la página) ──
    const up = await page.request.post(`${BACKEND_URL}/workshop/ingresos/${ingresoId}/fotos`, {
      headers: multipart,
      multipart: { file: { name: "e2e-foto.png", mimeType: "image/png", buffer: PNG_1PX } },
    });
    if (up.status() === 500) {
      test.skip(
        true,
        `el backend no pudo escribir en STORAGE_PATH (¿backend reutilizado sin ` +
          `E2E_STORAGE_PATH=/tmp/erp-e2e-storage?): ${(await up.text()).slice(0, 200)}`,
      );
    }
    expect(up.status()).toBe(201);

    // ── Listado: la página renderiza `path` del GET, no de la subida ──
    const list = await page.request.get(`${BACKEND_URL}/workshop/ingresos/${ingresoId}/fotos`, {
      headers,
    });
    expect(list.status()).toBe(200);
    const fotos = (await list.json()) as Array<{ name: string; path: string }>;
    expect(fotos.length).toBe(1);
    const path = fotos[0].path;
    expect(path).toContain(ingresoId);

    // ── Servida por /storage/:bucket/* A TRAVÉS del rewrite de Next ──
    // (antes la img apuntaba a /uploads/… que no tiene rewrite ni ruta).
    const servida = await page.request.get(`/storage/ingreso-photos/${path}`);
    expect(servida.status()).toBe(200);
    expect(servida.headers()["content-type"]).toContain("image/png");
    expect(Buffer.from(await servida.body()).equals(PNG_1PX)).toBe(true);

    // ── La variante rota del contrato sigue sin existir ──
    const apiStorage = await page.request.get(`/api/storage/ingreso-photos/${path}`);
    expect(apiStorage.status(), "/api/storage no debe volver como alias roto").toBe(404);

    // ── Criterio de T-19: la imagen se ve en la página de checklist ──
    await page.goto(`/dashboard/taller/checklist/${ingresoId}`);
    const img = page.locator(`img[src="/storage/ingreso-photos/${path}"]`);
    await expect(img).toBeVisible({ timeout: 25000 });
    // "Se ve" es además que el navegador la decodifique: una 404 con el
    // atributo puesto deja naturalWidth en 0.
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 25000 })
      .toBe(1);
  });

  test("no sirve rutas que escapen del root de storage", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);
    const res = await page.request.get(
      `${BACKEND_URL}/storage/ingreso-photos/..%2F..%2F..%2Fetc%2Fpasswd`,
      { headers },
    );
    // Depende de si Fastify decodifica %2F antes de resolver la ruta: 403 si
    // detecta el traversal, 404 si el archivo no existe. Nunca 200. 401 si la
    // ruta no existe y el auth-gate responde antes que el resolver de tenant.
    expect([401, 403, 404]).toContain(res.status());
    expect(await res.text()).not.toContain("root:");
  });
});
