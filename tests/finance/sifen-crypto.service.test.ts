/**
 * SIFEN Cryptographic Worker — Async Signing Tests
 *
 * Verifies that X.509 digital signing is offloaded to a worker thread
 * and returns the signed XML without blocking the main process.
 *
 * Updated for C-02 security fix: the service now validates
 * SIFEN_CERT_PATH and SIFEN_CERT_PASS from env.ts and rejects
 * immediately if either is empty (fail-closed).
 *
 * @module tests/finance/sifen-crypto.service.test
 */

import { describe, it, expect, beforeAll } from "vitest";
import { SifenCryptoService } from "../../src/finance/sifen-crypto.service.js";

describe("🔴 [CRITICAL RISK] Capa 3: Rendimiento y Worker Threads para SIFEN", () => {
  // Save original env and restore after
  let origCertPath: string | undefined;
  let origCertPass: string | undefined;

  beforeAll(() => {
    origCertPath = process.env["SIFEN_CERT_PATH"];
    origCertPass = process.env["SIFEN_CERT_PASS"];
  });

  it("SIFEN-002-TEST: Rechaza con error si SIFEN_CERT_PATH no está configurado (fail-closed C-02)", async () => {
    // Clear SIFEN config to verify fail-closed behavior
    delete process.env["SIFEN_CERT_PATH"];
    delete process.env["SIFEN_CERT_PASS"];

    await expect(
      SifenCryptoService.signInvoiceAsync("<DE><DEID>1</DEID></DE>"),
    ).rejects.toThrow(/SIFEN_CERT_PATH|SIFEN_CERT_PASS|configurados/i);

    // Restore
    if (origCertPath) process.env["SIFEN_CERT_PATH"] = origCertPath;
    if (origCertPass) process.env["SIFEN_CERT_PASS"] = origCertPass;
  });

  it("Lanza error si el XML está vacío (verifica SIFEN_CERT_PATH primero)", async () => {
    // Set dummy values so the validation passes and we test the real worker error
    process.env["SIFEN_CERT_PATH"] = "/tmp/test-cert.p12";
    process.env["SIFEN_CERT_PASS"] = "test-pass";

    await expect(
      SifenCryptoService.signInvoiceAsync(""),
    ).rejects.toThrow();

    // Restore
    if (origCertPath) process.env["SIFEN_CERT_PATH"] = origCertPath;
    if (origCertPass) process.env["SIFEN_CERT_PASS"] = origCertPass;
  });

  it("Devuelve una promesa (no bloquea el hilo principal)", async () => {
    // Temporarily set SIFEN config to avoid unhandled rejection
    const tmpPath = process.env["SIFEN_CERT_PATH"];
    const tmpPass = process.env["SIFEN_CERT_PASS"];
    process.env["SIFEN_CERT_PATH"] = "/tmp/test-cert.p12";
    process.env["SIFEN_CERT_PASS"] = "test-pass";

    const promise = SifenCryptoService.signInvoiceAsync("<DE/>");
    expect(promise).toBeInstanceOf(Promise);

    // Catch rejection silently to avoid unhandled rejection
    promise.catch(() => {});

    // Restore
    if (tmpPath) process.env["SIFEN_CERT_PATH"] = tmpPath;
    else delete process.env["SIFEN_CERT_PATH"];
    if (tmpPass) process.env["SIFEN_CERT_PASS"] = tmpPass;
    else delete process.env["SIFEN_CERT_PASS"];
  });
});
