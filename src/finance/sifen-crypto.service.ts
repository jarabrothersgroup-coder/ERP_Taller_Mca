/**
 * SIFEN Cryptographic Service
 *
 * Delegates X.509 digital signing of DTE (Documento Tributario Electrónico) XML
 * to a dedicated worker thread. The main Fastify event loop is never blocked
 * by SHA-256 + RSA operations on large fiscal documents.
 *
 * On-demand worker lifecycle: spawn → sign → terminate → free RAM.
 *
 * @module src/finance/sifen-crypto.service
 */

import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Pick the worker file that exists at runtime.
 * - Production (compiled .js in dist/): uses .js
 * - Dev/test (tsx): falls back to .ts, registers tsx loader for the worker
 */
function resolveWorkerPath(): string {
  const jsPath = resolve(__dirname, "sifen-crypto.worker.js");
  const tsPath = resolve(__dirname, "sifen-crypto.worker.ts");
  return existsSync(jsPath) ? jsPath : tsPath;
}

const WORKER_PATH = resolveWorkerPath();
const IS_TS_WORKER = WORKER_PATH.endsWith(".ts");

export class SifenCryptoService {
  /**
   * Signs a DTE XML document in a background worker thread.
   *
   * @param xmlRaw - Raw XML string of the DTE (without signature)
   * @returns Promise resolving to the signed XML with X.509 envelope
   */
  public static signInvoiceAsync(xmlRaw: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const certPath =
        process.env.SIFEN_CERT_PATH || "/etc/sifen/cert.p12";
      const certPass =
        process.env.SIFEN_CERT_PASS || "default_pass";

      // Spawn worker — keeps CPU-heavy crypto off the event loop
      const worker = new Worker(WORKER_PATH, {
        workerData: { xmlRaw, certPath, certPass },
        execArgv: IS_TS_WORKER
          ? ["--import", "tsx/esm"]
          : [],
      });

      worker.on("message", (response: { success: boolean; xmlSigned?: string; error?: string }) => {
        if (response.success) {
          resolve(response.xmlSigned!);
        } else {
          reject(
            new Error(
              `[SIFEN_WORKER_FAIL] ${response.error ?? "Unknown worker error"}`,
            ),
          );
        }
        void worker.terminate(); // Free heap immediately
      });

      worker.on("error", (err: Error) => {
        reject(err);
        void worker.terminate();
      });

      worker.on("exit", (code: number) => {
        if (code !== 0) {
          reject(
            new Error(
              `El worker criptográfico SIFEN finalizó abruptamente con código ${code}`,
            ),
          );
        }
      });
    });
  }
}
