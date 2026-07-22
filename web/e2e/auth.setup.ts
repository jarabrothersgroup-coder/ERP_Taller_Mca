/**
 * Shared Auth Setup — Playwright E2E Tests
 *
 * Provides a reusable `loginAsAdmin` helper to avoid duplicating
 * login code across multiple spec files.
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
  const password = options?.password ?? "password123";

  await page.goto("/sign-in");
  await page.getByLabel(/taller/i).fill(tenant);
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/);
}
