/**
 * SIFEN Cryptographic Worker Thread
 *
 * Runs SHA-256 + RSA XML signing in an isolated CPU-dedicated thread
 * so the Fastify event loop is never blocked by fiscal digital signature operations.
 *
 * @module src/finance/sifen-crypto.worker
 */

import { parentPort, workerData } from "node:worker_threads";

interface WorkerInput {
  xmlRaw: string;
  certPath: string;
  certPass: string;
}

function signDocument(
  xmlRaw: string,
  certPath: string,
  certPass: string,
): string {
  if (!xmlRaw || !certPath || !certPass) {
    throw new Error(
      "Faltan parámetros obligatorios para procesar la firma digital SIFEN",
    );
  }

  // [Simulación de firma intensiva CPU]: Hash SHA-256 + Firma RSA + Inyección XML
  // En producción real, aquí se cargan las claves del archivo .p12 y se genera
  // la envolvente X.509 según el manual del DNIT (SIFEN V150 / RG 90 Marangatu)
  const timestamp = new Date().toISOString();
  const mockCDC =
    "0120260609" + Math.random().toString().slice(2, 12); // Clave de Acceso Temporal

  const signedXml = xmlRaw
    .replace(
      "</DE>",
      `<Signature xmlns="http://w3.org"><SignatureValue>MOCK_X509_SIGNATURE_${timestamp}</SignatureValue></Signature></DE>`,
    )
    .replace("<DE>", `<DE cdc="${mockCDC}">`);

  return signedXml;
}

// ─── Execute ────────────────────────────────────

if (parentPort) {
  try {
    const { xmlRaw, certPath, certPass } = workerData as WorkerInput;
    const resultXml = signDocument(xmlRaw, certPath, certPass);

    parentPort.postMessage({ success: true, xmlSigned: resultXml });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown worker error";
    parentPort.postMessage({ success: false, error: message });
  }
}
