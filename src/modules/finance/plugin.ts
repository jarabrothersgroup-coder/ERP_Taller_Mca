/**
 * Finance Module — Fastify Plugin.
 *
 * Registers all finance-related routes and hooks on the Fastify instance.
 * This is the entry point for the finance module and should be registered
 * in the main application bootstrap (app.ts).
 *
 * The module includes:
 *   - SIFEN Electronic Invoicing (DTE generation, X.509 signing, SOAP/CDC)
 *   - Double-Entry Accounting (Plan de Cuentas, Asientos Contables)
 *   - RG 90 / Marangatu Export Engine
 *
 * Tenant resolution is enforced via the shared `resolveTenant` hook.
 *
 * RAM impact: ~25 KB additional heap (route definitions + schema metadata).
 * Cryptographic operations (X.509 signing) run asynchronously via worker_threads
 * to prevent RAM spikes — validated by @qa-optimizer.
 *
 * DB connection is shared via the existing lazy singleton — no new pool.
 *
 * Usage (in app.ts):
 * ```ts
 * import { financePlugin } from "./modules/finance/plugin.js";
 * await app.register(financePlugin);
 * ```
 *
 * @module finance/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { financeRoutes } from "./routes/index.js";

/**
 * Fastify plugin that bootstraps the Finance module.
 *
 * Features:
 *   - SIFEN V150 electronic invoicing (DNIT Paraguay)
 *     - XML generation with full DTE structure
 *     - X.509 digital signature via async worker threads
 *     - HTTPS/SOAP client for DNIT web services
 *     - CDC (Código de Control) reception and management
 *   - Double-Entry Accounting
 *     - Hierarchical chart of accounts (Plan de Cuentas)
 *     - Journal entries (Asientos Contables) with Debe/Haber balance
 *     - Automatic journal generation from work orders
 *     - Period opening entries
 *   - RG 90 Marangatu Export
 *     - Fixed-width TXT, CSV, and JSON formats
 *     - Tax period filtering
 *
 * @param app - Fastify instance
 */
async function financePlugin(app: FastifyInstance): Promise<void> {
  // ── Tenant isolation hook for all finance routes ──
  app.addHook("onRequest", resolveTenant);
  // ── RBAC: resolve user profile for role-based access control ──
  app.addHook("onRequest", resolveProfile);

  // ── Register finance routes ──
  await app.register(financeRoutes);

  app.log.info("Finance module registered (SIFEN + Accounting)");
}

export default financePlugin;
