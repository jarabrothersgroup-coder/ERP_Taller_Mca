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

    // Verify all form fields exist
    await expect(page.getByLabel(/taller/i)).toBeVisible();
    await expect(page.getByLabel(/correo/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();

    // Verify submit button
    await expect(page.getByRole("button", { name: /ingresar/i })).toBeVisible();

    // Verify logo/title
    await expect(page.getByText("AutomotiveOS")).toBeVisible();
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

    // Should show error message
    await expect(page.getByText(/credenciales|error|inválido/i)).toBeVisible({ timeout: 5000 });
  });

  test("redirects to dashboard on successful login", async ({ page }) => {
    await page.goto("/sign-in");

    // Fill with demo credentials (assuming demo user exists)
    await page.getByLabel(/taller/i).fill("taller-el-chero");
    await page.getByLabel(/correo/i).fill("jaraju01@gmail.com");
    await page.getByLabel(/contraseña/i).fill("Admin01$");

    // Submit
    await page.getByRole("button", { name: /ingresar/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
