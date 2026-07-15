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
} from "../services/two-factor.service.js";

/**
 * Register 2FA routes.
 */
export async function twoFactorRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  /**
   * POST /enterprise/2fa/setup — Generate 2FA secret and provisioning URI
   */
  app.post("/setup", async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountName } = request.body as { accountName?: string };
    const name = accountName ?? request.profile?.email ?? "user";

    const { secret, otpauthUrl } = generateTwoFactorSecret(
      "AutomotiveOS ERP",
      name,
    );

    const backupCodes = generateBackupCodes(10);

    return reply.send({
      secret,
      otpauthUrl,
      backupCodes,
      message:
        "Escanea el código QR con tu app de autenticación. Guarda los códigos de respaldo en un lugar seguro.",
    });
  });

  /**
   * POST /enterprise/2fa/verify — Verify a TOTP code
   */
  app.post("/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const { secret, code } = request.body as { secret?: string; code?: string };

    if (!secret || !code) {
      return reply.status(400).send({
        error: "Faltan parámetros: secret y code son requeridos",
      });
    }

    const isValid = verifyTotp(secret, code);

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
