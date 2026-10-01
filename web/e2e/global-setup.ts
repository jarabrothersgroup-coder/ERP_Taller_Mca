/**
 * Global setup E2E (T-62).
 *
 * Corre el seed determinista antes de cualquier test. Sin esto la suite miente:
 * `loginAsAdmin` no encuentra el tenant `demo`, los KPI salen vacíos y los
 * asserts de datos pasarían por la razón equivocada (o fallarían sin decir qué
 * falta).
 *
 * El seed es idempotente, así que esto se puede correr tantas veces como haga
 * falta — included en local, donde se re-lanza el backend a mano.
 *
 * @module web/e2e/global-setup
 */

import { spawn } from "node:child_process";
import path from "node:path";

// `web/package.json` no declara "type": "module", así que Playwright compila
// este archivo a CJS y `import.meta` no existe. `__dirname` sí.
const HERE = __dirname;
/** `web/e2e` → raíz del repo. */
const REPO_ROOT = path.resolve(HERE, "..", "..");

function runSeed(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", "scripts/seed-e2e.ts"], {
      cwd: REPO_ROOT,
      // El seed hereda DATABASE_URL del entorno: en CI apunta a la DB del
      // servicio, en local a la que exporta el shell.
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (d) => {
      output += String(d);
    });
    child.stderr.on("data", (d) => {
      output += String(d);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        console.log("[global-setup] seed E2E aplicado");
        resolve();
      } else {
        reject(new Error(`seed-e2e.ts terminó con código ${code}:\n${output}`));
      }
    });
  });
}

export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está definido. La suite E2E necesita la BD migrada y " +
        "sembrada; en local es la de :5433 (erp_user).",
    );
  }
  await runSeed();
}