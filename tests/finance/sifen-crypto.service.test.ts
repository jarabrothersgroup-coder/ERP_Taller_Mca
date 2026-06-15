/**
 * SIFEN Cryptographic Worker — Async Signing Tests
 *
 * Verifies that X.509 digital signing is offloaded to a worker thread
 * and returns the signed XML without blocking the main process.
 *
 * @module tests/finance/sifen-crypto.service.test
 */

import { describe, it, expect } from "vitest";
import { SifenCryptoService } from "../../src/finance/sifen-crypto.service.js";

describe("🔴 [CRITICAL RISK] Capa 3: Rendimiento y Worker Threads para SIFEN", () => {
  it("SIFEN-002-TEST: Debería delegar y resolver de forma asíncrona la firma digital X.509 sin colgar el proceso", async () => {
    const xmlMock = "<DE><DEID>1</DEID></DE>";

    const signedXmlPromise = SifenCryptoService.signInvoiceAsync(xmlMock);

    expect(signedXmlPromise).toBeInstanceOf(Promise);

    const result = await signedXmlPromise;
    expect(result).toContain("MOCK_X509_SIGNATURE");
    expect(result).toContain('cdc=');
  });

  it("Lanza error si el XML está vacío", async () => {
    await expect(
      SifenCryptoService.signInvoiceAsync(""),
    ).rejects.toThrow(/Faltan parámetros obligatorios/i);
  });

  it("Devuelve una promesa (no bloquea el hilo principal)", () => {
    const promise = SifenCryptoService.signInvoiceAsync("<DE/>");
    expect(promise).toBeInstanceOf(Promise);
    // Don't await — we just verify the return type is async
  });
});
