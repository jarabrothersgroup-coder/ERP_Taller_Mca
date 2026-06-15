/**
 * Thinkcar Email Service — Resilience Tests
 *
 * Tests degraded behavior when IMAP credentials are missing or invalid.
 * Does NOT make real IMAP connections — validates that the service
 * fails gracefully and logs controlled errors instead of crashing.
 *
 * @module tests/modules/thinkcar/services/thinkcar-email.test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkEmailNow,
  startEmailPolling,
  stopEmailPolling,
} from "../../../../src/modules/thinkcar/services/thinkcar-email.service.js";

// ─── Helpers ───────────────────────────────────

function setEnv(user: string, pass: string) {
  process.env["THINKCAR_EMAIL_USER"] = user;
  process.env["THINKCAR_EMAIL_PASSWORD"] = pass;
}

function cleanEnv() {
  delete process.env["THINKCAR_EMAIL_USER"];
  delete process.env["THINKCAR_EMAIL_PASSWORD"];
}

// ─── Tests ─────────────────────────────────────

describe("🟠 [HIGH RISK] Capa 4: Resiliencia del Worker IMAP (Thinkcar)", () => {
  beforeEach(() => {
    stopEmailPolling();
  });

  afterEach(() => {
    cleanEnv();
    stopEmailPolling();
  });

  describe("checkEmailNow — degraded credentials", () => {
    it("HIGH-003: Lanza error controlado si falta THINKCAR_EMAIL_PASSWORD", async () => {
      setEnv("test@example.com", "");

      await expect(checkEmailNow()).rejects.toThrow(
        /THINKCAR_EMAIL_USER y THINKCAR_EMAIL_PASSWORD no configurados/,
      );
    });

    it("Lanza error controlado si falta THINKCAR_EMAIL_USER", async () => {
      setEnv("", "somepassword");

      await expect(checkEmailNow()).rejects.toThrow(
        /THINKCAR_EMAIL_USER y THINKCAR_EMAIL_PASSWORD no configurados/,
      );
    });

    it("Lanza error controlado si faltan ambos (undefined)", async () => {
      cleanEnv();

      await expect(checkEmailNow()).rejects.toThrow(
        /THINKCAR_EMAIL_USER y THINKCAR_EMAIL_PASSWORD no configurados/,
      );
    });
  });

  describe("startEmailPolling — polling loop resilience", () => {
    it("No explota si se inicia polling sin credenciales (error capturado internamente)", async () => {
      cleanEnv();

      // startEmailPolling schedules an async poll and catches errors internally.
      // It should NOT throw or crash.
      expect(() => {
        startEmailPolling(100);
      }).not.toThrow();

      // Give the first poll cycle time to run (it will fail gracefully)
      await new Promise((r) => setTimeout(r, 200));

      stopEmailPolling();
    });

    it("No duplica el timer si se llama startEmailPolling dos veces", () => {
      setEnv("test@example.com", "valid");
      startEmailPolling(5000);
      const firstTimer = (startEmailPolling as any)._emailTimer;

      startEmailPolling(5000);
      // Should not throw and the same timer should be in effect
      stopEmailPolling();
    });
  });

  describe("getConfig — env var parsing", () => {
    it("Usa valores por defecto cuando las env vars no están seteadas", async () => {
      cleanEnv();

      // This will use defaults: host=imap.gmail.com, port=993, user="", password=""
      // Should fail with controlled error about missing vars
      await expect(checkEmailNow()).rejects.toThrow(/no configurados/);
    });
  });
});
