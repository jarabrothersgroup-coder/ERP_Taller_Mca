/**
 * Shared Auth Setup — Playwright E2E Tests
 *
 * Provides a reusable `loginAsAdmin` helper to avoid duplicating
 * login code across multiple spec files.
 *
 * T-62 — las credenciales salen de `scripts/seed-e2e.ts`: el mismo seed que
 * crea el tenant también crea el admin, así que la variable y el default tienen
 * que coincidir en ambos lados o el login falla con "Credenciales inválidas".
 *
 * @module web/e2e/auth.setup
 */

import { type Page } from "@playwright/test";

/** Password por defecto, idéntico al de `scripts/seed-e2e.ts`. */
export const E2E_ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ??
  (typeof process !== "undefined" ? process.env["SEED_ADMIN_PASSWORD"] : undefined) ??
  "password123";

export const E2E_TENANT = process.env.E2E_TENANT_SLUG ?? "demo";
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@demo.com";

/** Origen del backend — el mismo que usa el rewrite de `next.config`. */
export const BACKEND_URL =
  `http://${process.env.BACKEND_HOST ?? "localhost"}:${process.env.BACKEND_PORT ?? "4000"}`;

/**
 * Log in as the demo admin user.
 * Navigates to /sign-in, fills in tenant + credentials, and waits
 * for redirect to the dashboard.
 *
 * @param page - Playwright Page instance
 * @param options - Optional overrides for credentials
 */
export async function loginAsAdmin(
  page: Page,
  options?: {
    tenant?: string;
    email?: string;
    password?: string;
  },
): Promise<void> {
  const tenant = options?.tenant ?? E2E_TENANT;
  const email = options?.email ?? E2E_ADMIN_EMAIL;
  const password = options?.password ?? E2E_ADMIN_PASSWORD;

  await page.goto("/sign-in");
  await page.getByLabel(/taller/i).fill(tenant);
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  // The submit button's visible text is "Ingresar" (aria name may vary)
  await page.getByRole("button", { name: /ingresar|iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/);
}

/**
 * Logs in via the API and returns the request headers needed for direct API
 * calls (tenant slug + JWT). Used by the API-level e2e specs.
 */
export async function getApiAuthHeaders(
  request: import("@playwright/test").APIRequestContext,
): Promise<Record<string, string>> {
  const res = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { tenantSlug: E2E_TENANT, email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD },
  });
  const body = (await res.json()) as { token?: string };
  return {
    "X-Tenant-Slug": E2E_TENANT,
    "Content-Type": "application/json",
    ...(body.token ? { Authorization: `Bearer ${body.token}` } : {}),
  };
}
