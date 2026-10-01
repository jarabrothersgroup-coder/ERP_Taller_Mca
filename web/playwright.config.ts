import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for AutomotiveOS ERP E2E tests.
 *
 * T-62 — la suite dejó de ser "el spec corre si alguien se acuerda": ahora
 * Playwright levanta las DOS dependencias (backend y web) y espera a que
 * ambas respondan antes de correr un solo test.
 *
 * Por qué `next start` y no `next dev`: el dev server compila cada ruta bajo
 * demanda, así que el primer request a /dashboard/analytics se come el timeout
 * y el resultado depende del caché de compilación de la máquina. La build de
 * producción hace que el tiempo sea función del código, no del estado del disco.
 *
 * Los asserts de datos (analytics, calendario, nómina) necesitan una BD con el
 * dataset de `scripts/seed-e2e.ts`. Sin ese seed el login falla y los tests
 * mienten; por eso `globalSetup` lo corre siempre antes de la suite.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

const BACKEND_PORT = process.env.BACKEND_PORT || "4000";
const WEB_PORT = process.env.WEB_PORT || "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 1 worker en CI: los tests comparten una única BD sembrada y varios workers
  // se pisan los datos del calendario entre sí.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "html",

  /* Shared settings for all projects */
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    locale: "es-PY",
    timezoneId: "America/Asuncion",
  },

  /* Configure projects for different browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * T-62 — dataset determinista. Corre antes de los tests y se encarga de que
   * exista el tenant `demo` con el admin y las cifras que los asserts comparan.
   */
  globalSetup: "./e2e/global-setup.ts",

  /**
   * Las dos dependencias de la suite. `cwd` es relativo al directorio de este
   * archivo (`web/`), así que el backend se lanza desde `..`.
   */
  webServer: [
    {
      command: "npm run start:dev",
      cwd: "..",
      // /health responde 401 sin token (protegido a propósito); Playwright
      // considera "listo" cualquier respuesta que no sea conexión rechazada.
      url: `http://localhost:${BACKEND_PORT}/health`,
      env: { PORT: BACKEND_PORT },
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run build && npm run start",
      url: `http://localhost:${WEB_PORT}/sign-in`,
      env: { BACKEND_PORT, BACKEND_HOST: "localhost" },
      reuseExistingServer: !process.env.CI,
      // La build de Next tarda; 5 min deja margen en CI frío.
      timeout: 300 * 1000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
