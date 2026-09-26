/**
 * 2FA (TOTP) Routes — Admin-only endpoints for 2FA management.
 *
 * @module enterprise/routes/two-factor.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAdmin } from "../../../shared/middleware/rbac.js";
import {
  generateTwoFactorSecret,
  verifyTotp,
  generateBackupCodes,
  getTotpTimeRemaining,
  enrollTwoFactor,
  hasTwoFactorEnrollment,
  verifyTwoFactorCode,
} from "../services/two-factor.service.js";

/**
 * Register 2FA routes.
 */
export async function twoFactorRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  /**
   * POST /2fa/setup — Generate 2FA secret, provisioning URI and persist enrollment
   */
  app.post("/setup", async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountName } = request.body as { accountName?: string };
    const name = accountName ?? request.profile?.email ?? "user";

    const { secret, otpauthUrl } = generateTwoFactorSecret(
      "AutomotiveOS ERP",
      name,
    );

    const backupCodes = generateBackupCodes(10);

    // Persist the enrollment (SEG-03): encrypted secret + hashed backup codes.
    // Without this, destructive backup endpoints stay fail-closed (403).
    const profileId = request.profile?.id;
    if (profileId) {
      await enrollTwoFactor(request.tenantSlug, profileId, secret, backupCodes);
    }

    return reply.send({
      secret,
      otpauthUrl,
      backupCodes,
      message:
        "Escanea el código QR con tu app de autenticación. Guarda los códigos de respaldo en un lugar seguro.",
    });
  });

  /**
   * GET /2fa/status — Is 2FA enrolled for the current admin? (never leaks the secret)
   */
  app.get("/status", async (request: FastifyRequest, reply: FastifyReply) => {
    const profileId = request.profile?.id;
    const enabled = profileId
      ? await hasTwoFactorEnrollment(request.tenantSlug, profileId)
      : false;

    return reply.send({ enabled });
  });

  /**
   * POST /2fa/verify — Verify a TOTP code.
   * `secret` is optional: when omitted, the code is checked against the
   * persisted enrollment for the current admin (backup codes accepted).
   */
  app.post("/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const { secret, code } = request.body as { secret?: string; code?: string };

    if (!code) {
      return reply.status(400).send({
        error: "Faltan parámetros: code es requerido",
      });
    }

    let isValid: boolean;
    if (secret) {
      isValid = verifyTotp(secret, code);
    } else {
      const result = await verifyTwoFactorCode(
        request.tenantSlug,
        request.profile!.id,
        code,
      );
      isValid = result.ok;
    }

    return reply.send({
      valid: isValid,
      message: isValid
        ? "Código 2FA verificado correctamente"
        : "Código 2FA inválido o expirado",
    });
  });

  /**
   * GET /enterprise/2fa/time-remaining — Seconds until TOTP refresh
   */
  app.get(
    "/time-remaining",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const remaining = getTotpTimeRemaining();
      return reply.send({ remaining });
    },
  );
}
