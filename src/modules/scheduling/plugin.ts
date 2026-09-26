/**
 * Scheduling Plugin — Fastify plugin for appointment management.
 *
 * Registers all scheduling routes under /scheduling prefix.
 *
 * @module scheduling/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { schedulingRoutes } from "./routes/scheduling.routes.js";

export async function schedulingPlugin(app: FastifyInstance): Promise<void> {
  // Tenant isolation + profile resolution.
  // FIX: previously missing — every scheduling route read
  // `request.tenantSlug` which was always undefined without resolveTenant,
  // so appointments were neither tenant-isolated nor resolvable.
  app.addHook("onRequest", resolveTenant);
  app.addHook("onRequest", resolveProfile);

  // schedulingRoutes declara las rutas con la raíz completa
  // (/scheduling/appointments, …). El prefijo aquí duplicaba la raíz
  // (/scheduling/scheduling/*) y rompía el contrato con la FE.
  await app.register(schedulingRoutes);
  app.log.info("Scheduling plugin registered (/scheduling)");
}
