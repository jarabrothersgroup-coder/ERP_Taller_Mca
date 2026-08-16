import { test, expect } from "@playwright/test";

/**
 * Login flow E2E tests.
 *
 * Tests the authentication flow: sign-in page rendering, form submission,
 * error states, and successful login redirect to dashboard.
 */
test.describe("Login Flow", () => {
  test("sign-in page loads with all form fields", async ({ page }) => {
    await page.goto("/sign-in");

    // Wait for the page to be fully loaded
    await expect(page.getByRole("heading", { name: /iniciar sesión/i })).toBeVisible();

    // Verify all form fields exist (labels are associated via htmlFor/id)
    await expect(page.getByLabel(/taller/i)).toBeVisible();
    await expect(page.getByLabel(/correo/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();

    // Verify submit button
    await expect(page.getByRole("button", { name: /ingresar/i })).toBeVisible();

    // Verify logo/title (use the heading — the footer also contains "AutomotiveOS")
    await expect(page.getByRole("heading", { name: "AutomotiveOS" })).toBeVisible();
  });

  test("shows error on empty form submission", async ({ page }) => {
    await page.goto("/sign-in");

    // Click submit without filling anything
    await page.getByRole("button", { name: /ingresar/i }).click();

    // The form should still be on the sign-in page (no redirect)
    await expect(page.getByRole("heading", { name: /iniciar sesión/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");

    // Fill with invalid credentials
    await page.getByLabel(/taller/i).fill("demo");
    await page.getByLabel(/correo/i).fill("test@invalid.com");
    await page.getByLabel(/contraseña/i).fill("wrong");

    // Submit
    await page.getByRole("button", { name: /ingresar/i }).click();

    // Should show error message (destructive alert)
    await expect(page.locator("[class*='destructive']").first()).toBeVisible({ timeout: 5000 });
  });

  test("redirects to dashboard on successful login", async ({ page }) => {
    await page.goto("/sign-in");

    // Demo seed user (scripts/seed-auth-users.ts); override via SEED_ADMIN_PASSWORD
    const password = process.env["SEED_ADMIN_PASSWORD"] || "password123";
    await page.getByLabel(/taller/i).fill("demo");
    await page.getByLabel(/correo/i).fill("admin@demo.com");
    await page.getByLabel(/contraseña/i).fill(password);

    // Submit
    await page.getByRole("button", { name: /ingresar/i }).click();

    // Should redirect to dashboard (which redirects to the Ejecutivo panel)
    await expect(page).toHaveURL(/\/(dashboard|dashboard\/ejecutivo)/, { timeout: 10000 });
  });
});
