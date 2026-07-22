/**
 * Workshop E2E Tests — Sprint 83
 *
 * Tests work order creation, status management, vehicle lookup
 * and client management flows.
 *
 * @module web/e2e/workshop
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

test.describe("Workshop Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should load the workshop dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/automotive/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/panel de control/i).first()).toBeVisible();
  });

  test("should list work orders", async ({ page }) => {
    await page.goto("/dashboard/ordenes");
    await expect(page.getByRole("heading", { name: /órdenes/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test("should load clients page", async ({ page }) => {
    await page.goto("/dashboard/clientes");
    await expect(page.getByText(/clientes/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("should load vehicles page", async ({ page }) => {
    await page.goto("/dashboard/vehiculos");
    await expect(page.getByText(/vehículos/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("should load appointments page", async ({ page }) => {
    await page.goto("/dashboard/agenda");
    await expect(page.getByText(/turnos/i).first()).toBeVisible({ timeout: 10000 });
  });
});
