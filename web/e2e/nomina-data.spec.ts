import { test, expect } from "@playwright/test";
import { loginAsAdmin, getApiAuthHeaders, BACKEND_URL } from "./auth.setup";
import { EXPECTED, guaranies, percent } from "./expected-data";

/**
 * T-62 — Nómina con assert del CÁLCULO.
 *
 * El criterio es "verificar cálculo": no que la pantalla exista, sino que los
 * números de break-even provengan de la operación aritmética sobre el
 * `payroll_summary` del seed, no de un valor hardcodeado en el componente.
 *
 * Contrato: `GET /api/v1/finance/dashboard/break-even` →
 * `{ ok, percentage, currentRevenue, threshold, remaining, breakevenHit, month, year }`
 * (ver `getBreakevenProgress` en `FinancialOrchestratorService.ts`).
 *
 * Invariante comprobada: `remaining === max(0, threshold - currentRevenue)` y
 * `percentage === currentRevenue / threshold * 100`. Si alguien cambia la
 * fórmula, este test falla en vez de dejar que la UI muestre números que nadie
 * reconcilia con el balance.
 */
test.describe("Nómina — cálculo de break-even", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("muestra los valores reales del payroll_summary, no ceros", async ({ page }) => {
    await page.goto("/dashboard/nomina");

    // `nomina/page.tsx` usa `?? 0` en cada campo: un contrato roto NO rompe la
    // página, la deja mostrando ₲ 0. Por eso el primer assert es que no haya
    // un ₲ 0 en pantalla — es la diferencia entre "funciona" y "parece".
    await expect(page.getByText("₲ 0", { exact: true })).toHaveCount(0, {
      timeout: 25000,
    });

    const { percentage, netLaborRevenue, breakevenThreshold } = EXPECTED.payroll;

    // El porcentaje va suelto en un <p className="text-3xl font-bold">.
    await expect(page.getByText(percent(percentage), { exact: true })).toBeVisible({
      timeout: 25000,
    });

    // "Ingresos Netos" y "Umbral" son tarjetas distintas (`data-testid`): se
    // ancla cada valor a su tarjeta para que "₲ 50.000.000" no pueda cumplirse
    // solo con el texto de la línea "₲ 30.000.000 de ₲ 50.000.000".
    await expect(
      page.getByTestId("break-even-current").getByText(guaranies(netLaborRevenue), { exact: true }),
    ).toBeVisible({ timeout: 25000 });

    await expect(
      page.getByTestId("break-even-threshold").getByText(guaranies(breakevenThreshold), { exact: true }),
    ).toBeVisible({ timeout: 25000 });
  });

  test("el backend es internamente consistente con el seed", async ({ page }) => {
    // Verifica la aritmética en el servidor, no el render. Si el cálculo del
    // backend cambia, este assert falla aunque la UI siga "bonita".
    const headers = await getApiAuthHeaders(page.request);
    const res = await page.request.get(
      `${BACKEND_URL}/api/v1/finance/dashboard/break-even`,
      { headers },
    );
    expect(res.status()).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      percentage: number;
      currentRevenue: number;
      threshold: number;
      remaining: number;
      month: number;
      year: number;
    };

    const { netLaborRevenue, breakevenThreshold, remaining, percentage } =
      EXPECTED.payroll;

    expect(body.ok).toBe(true);
    expect(body.currentRevenue).toBe(netLaborRevenue);
    expect(body.threshold).toBe(breakevenThreshold);
    expect(body.remaining).toBe(remaining);
    expect(body.percentage).toBe(percentage);

    // Las tres invariantes que explican de dónde sale cada número en pantalla.
    expect(body.remaining).toBe(
      Math.max(0, body.threshold - body.currentRevenue),
    );
    expect(body.percentage).toBeCloseTo(
      (body.currentRevenue / body.threshold) * 100,
      0,
    );

    // El resumen debe ser el del mes en curso, no uno histórico.
    const now = new Date();
    expect(body.month).toBe(now.getMonth() + 1);
    expect(body.year).toBe(now.getFullYear());
  });
});
