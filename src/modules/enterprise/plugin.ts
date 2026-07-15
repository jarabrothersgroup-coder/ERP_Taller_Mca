/**
 * Enterprise Module — Fastify Plugin.
 *
 * Registers enterprise-grade features:
 *   - Enterprise audit trail (immutable, hash-chained)
 *   - 2FA (TOTP) management
 *   - SSO (OpenID Connect) configuration
 *
 * @module enterprise/plugin
 */

import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { enterpriseAuditRoutes } from "./routes/audit-enterprise.routes.js";
import { twoFactorRoutes } from "./routes/two-factor.routes.js";
import { ssoRoutes } from "./routes/sso.routes.js";

/**
 * Fastify plugin that bootstraps the Enterprise module.
 *
 * Features:
 *   - Immutable audit trail with cryptographic hash chain
 *   - TOTP-based 2FA with backup codes
 *   - OpenID Connect SSO integration
 *
 * @param app - Fastify instance
 */
async function enterprisePlugin(app: FastifyInstance): Promise<void> {
  // All enterprise routes require tenant context + admin role
  await app.register(async function enterpriseScopedRoutes(enterpriseApp) {
    enterpriseApp.addHook("onRequest", resolveTenant);

    // Enterprise audit routes — admin-only
    await enterpriseApp.register(enterpriseAuditRoutes, { prefix: "/audit" });

    // 2FA routes — admin-only
    await enterpriseApp.register(twoFactorRoutes, { prefix: "/2fa" });

    // SSO routes — admin-only
    await enterpriseApp.register(ssoRoutes, { prefix: "/sso" });
  });

  app.log.info("Enterprise module registered (audit trail + 2FA + SSO)");
}

export default enterprisePlugin;
