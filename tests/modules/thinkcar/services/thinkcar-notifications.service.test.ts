/**
 * Thinkcar Notification Service — Manual Review Alert Tests
 *
 * Validates the alert dispatcher aborts cleanly when credentials are missing
 * and returns `false` without throwing or making real SMTP connections.
 *
 * @module tests/modules/thinkcar/services/thinkcar-notifications.service.test
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  ThinkcarNotificationService,
  type ManualReviewNotificationPayload,
} from "../../../../src/modules/thinkcar/services/thinkcar-notifications.service.js";

const samplePayload: ManualReviewNotificationPayload = {
  tenantSlug: "taller_jara_demo",
  dtcCount: 4,
  detectedVin: "1HGCR2F8XHAXXXXXX",
  importSource: "EMAIL",
};

function cleanEnv() {
  delete process.env["THINKCAR_EMAIL_USER"];
  delete process.env["THINKCAR_EMAIL_PASSWORD"];
  delete process.env["THINKCAR_ALERT_RECIPIENT"];
}

describe("🟠 [HIGH RISK] Capa 1: Notificaciones Automáticas — Thinkcar", () => {
  afterEach(() => {
    cleanEnv();
  });

  it("TC-005-TEST: Debería abortar limpiamente si no hay contraseña", async () => {
    process.env["THINKCAR_EMAIL_USER"] = "test@example.com";
    process.env["THINKCAR_EMAIL_PASSWORD"] = "";

    const status =
      await ThinkcarNotificationService.sendManualReviewAlert(samplePayload);
    expect(status).toBe(false);
  });

  it("Devuelve false si faltan ambas variables de entorno", async () => {
    cleanEnv();

    const status =
      await ThinkcarNotificationService.sendManualReviewAlert(samplePayload);
    expect(status).toBe(false);
  });

  it("Devuelve false si el payload tiene VIN vacío (no explota)", async () => {
    process.env["THINKCAR_EMAIL_USER"] = "test@example.com";
    process.env["THINKCAR_EMAIL_PASSWORD"] = "";

    const status = await ThinkcarNotificationService.sendManualReviewAlert({
      tenantSlug: "test",
      dtcCount: 0,
      detectedVin: "",
      importSource: "USB",
    });
    expect(status).toBe(false);
  });
});
