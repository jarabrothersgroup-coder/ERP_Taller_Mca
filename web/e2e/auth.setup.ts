/**
 * Shared Auth Setup — Playwright E2E Tests
 *
 * Provides a reusable `loginAsAdmin` helper to avoid duplicating
 * login code across multiple spec files.
 *
 * Passwords read from env var SEED_ADMIN_PASSWORD (consistent with
 * seed-auth-users.ts security fix) with "password123" as dev fallback.
 *
 * @module web/e2e/auth.setup
 */

import { type Page } from "@playwright/test";

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
  const tenant = options?.tenant ?? "demo";
  const email = options?.email ?? "admin@demo.com";
  const password = options?.password ??
    (typeof process !== "undefined" ? process.env["SEED_ADMIN_PASSWORD"] : undefined) ??
    "password123";

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
  const res = await request.post("http://localhost:4000/api/auth/login", {
    data: { tenantSlug: "demo", email: "admin@demo.com", password: "password123" },
  });
  const body = (await res.json()) as { token?: string };
  return {
    "X-Tenant-Slug": "demo",
    "Content-Type": "application/json",
    ...(body.token ? { Authorization: `Bearer ${body.token}` } : {}),
  };
}
