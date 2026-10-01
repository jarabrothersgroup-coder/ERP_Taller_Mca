import { test, expect } from "@playwright/test";
import { loginAsAdmin, getApiAuthHeaders, BACKEND_URL } from "./auth.setup";
import {
  EXPECTED,
  guaraniesCompact,
  percent,
  plain,
  defaultRange,
} from "./expected-data";

/**
 * T-62 — Analytics con asserts de DATOS.
 *
 * Antes de T-62 el spec era `expect(pageTitle("Analytics")).toBeVisible()`: una
 * página que pintara cuatro ceros, un spinner atascado o un error HTTP pasaba
 * igual. Estos tests verifican que cada KPI muestre el número que el backend
 * calculó sobre el dataset de `scripts/seed-e2e.ts`.
 *
 * El contrato vive en `GET /analytics/kpis`, que devuelve
 * `{ kpis: [{label, value, unit, change}], range }`.
 */
test.describe("Analytics — KPIs calculados", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("muestra los 4 KPIs con el importe real, no un placeholder", async ({ page }) => {
    await page.goto("/dashboard/analytics");

    // Si el contrato se rompe, la página cae en el error boundary y ninguna
    // tarjeta existe: por eso el primer assert sobre el propio error boundary
    // convierte un fallo confuso ("no encontré ₲ 500K") en uno legible.
    await expect(
      page.getByRole("heading", { name: "Algo salió mal" }),
    ).toHaveCount(0, { timeout: 25000 });

    // Cada tarjeta es un `Card` con `CardTitle` = label y `p.text-2xl` = valor.
    // Se ancla por el título y se busca el hermano del valor dentro de la
    // tarjeta, nunca en toda la página (evita matchear textos ajenos).
    const cards = [
      { label: "Ingresos", value: guaraniesCompact(EXPECTED.revenue) },
      { label: "Órdenes de Trabajo", value: plain(EXPECTED.orderCount) },
      { label: "Ticket Promedio", value: guaraniesCompact(EXPECTED.avgOrderValue) },
      { label: "Tasa de Finalización", value: percent(EXPECTED.completionRate) },
    ];

    for (const { label, value } of cards) {
      // `data-testid="kpi-card"` + filter por label: ancla el valor a SU
      // tarjeta, así "₲ 500K" no puede satisfacerse con el número de otra.
      const card = page.getByTestId("kpi-card").filter({ hasText: label });
      await expect(card).toHaveCount(1, { timeout: 25000 });
      await expect(card.getByText(value, { exact: true })).toBeVisible({
        timeout: 25000,
      });
    }
  });

  test("ningún KPI queda en cero, vacío ni en guion", async ({ page }) => {
    await page.goto("/dashboard/analytics");

    // El fallo silencioso de este módulo antes era mostrar ₲ 0 sin avisar. Este
    // assert convierte "se rompió el cálculo" en un fallo de test explícito.
    const zeroes = page
      .getByText(/^₲\s?0(K|M|B)?$/)
      .or(page.getByText("—", { exact: true }));
    await expect(zeroes).toHaveCount(0, { timeout: 25000 });
  });

  test("el backend devuelve los mismos valores que la pantalla", async ({ page }) => {
    // Compara la API contra la UI para detectar drift entre lo que el backend
    // calcula y lo que el front renderiza (redondeos, abreviaturas, mapeo).
    await page.goto("/dashboard/analytics");

    const headers = await getApiAuthHeaders(page.request);
    const range = defaultRange();
    const res = await page.request.get(
      `${BACKEND_URL}/analytics/kpis?from=${range.from}&to=${range.to}`,
      { headers },
    );
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      kpis: Array<{ label: string; value: number }>;
      range: { from: string; to: string };
    };

    const valueOf = (label: string) =>
      body.kpis.find((k) => k.label === label)?.value;

    expect(valueOf("Ingresos")).toBe(EXPECTED.revenue);
    expect(valueOf("Órdenes de Trabajo")).toBe(EXPECTED.orderCount);
    expect(valueOf("Ticket Promedio")).toBe(EXPECTED.avgOrderValue);
    expect(valueOf("Tasa de Finalización")).toBe(EXPECTED.completionRate);

    // El backend devuelve el rango que usó, no un rango inventado por el front.
    expect(body.range.from).toBe(range.from);
    expect(body.range.to).toBe(range.to);
  });
});
