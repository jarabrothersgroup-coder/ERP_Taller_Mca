/**
 * SSO (OpenID Connect) Routes — Admin-only endpoints for SSO configuration.
 *
 * @module enterprise/routes/sso.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAdmin } from "../../../shared/middleware/rbac.js";
import {
  fetchOidcDiscovery,
  buildAuthorizationUrl,
  generateOidcState,
  buildLogoutUrl,
  getProviderDefaults,
  isEmailDomainAllowed,
} from "../services/sso-oidc.service.js";

/**
 * Register SSO routes.
 */
export async function ssoRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  /**
   * POST /enterprise/sso/discover — Fetch OIDC discovery document
   */
  app.post(
    "/discover",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { issuer, provider } = request.body as {
        issuer?: string;
        provider?: string;
      };

      if (!issuer) {
        return reply.status(400).send({
          error: "El campo 'issuer' es requerido",
        });
      }

      try {
        const discovery = await fetchOidcDiscovery(issuer, provider);
        const defaults = getProviderDefaults(provider ?? "custom");

        return reply.send({
          discovery,
          defaults,
          message: "Discovery OIDC exitoso",
        });
      } catch (err) {
        return reply.status(400).send({
          error: `Error en OIDC Discovery: ${(err as Error).message}`,
        });
      }
    },
  );

  /**
   * POST /enterprise/sso/authorize — Generate authorization URL
   */
  app.post(
    "/authorize",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { issuer, clientId, redirectUri, scopes, provider } =
        request.body as {
          issuer?: string;
          clientId?: string;
          redirectUri?: string;
          scopes?: string[];
          provider?: string;
        };

      if (!issuer || !clientId || !redirectUri) {
        return reply.status(400).send({
          error: "Faltan parámetros: issuer, clientId y redirectUri son requeridos",
        });
      }

      try {
        const discovery = await fetchOidcDiscovery(issuer, provider);
        const defaults = getProviderDefaults(provider ?? "custom");
        const { state, nonce } = generateOidcState();
        const finalScopes = scopes ?? defaults.scopes ?? ["openid", "profile", "email"];

        const authorizationUrl = buildAuthorizationUrl(
          discovery,
          clientId,
          redirectUri,
          finalScopes,
          state,
          nonce,
        );

        return reply.send({
          authorizationUrl,
          state,
          nonce,
          message: "Redirige al usuario a esta URL para autenticarse",
        });
      } catch (err) {
        return reply.status(400).send({
          error: `Error generando URL de autorización: ${(err as Error).message}`,
        });
      }
    },
  );

  /**
   * POST /enterprise/sso/logout — Generate logout URL
   */
  app.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    const { issuer, clientId, postLogoutRedirectUri, provider } =
      request.body as {
        issuer?: string;
        clientId?: string;
        postLogoutRedirectUri?: string;
        provider?: string;
      };

    if (!issuer || !clientId) {
      return reply.status(400).send({
        error: "Faltan parámetros: issuer y clientId son requeridos",
      });
    }

    try {
      const discovery = await fetchOidcDiscovery(issuer, provider);
      const logoutUrl = buildLogoutUrl(
        discovery,
        clientId,
        postLogoutRedirectUri,
      );

      return reply.send({
        logoutUrl,
        message: logoutUrl
          ? "Redirige al usuario a esta URL para cerrar sesión"
          : "El proveedor no soporta end_session_endpoint",
      });
    } catch (err) {
      return reply.status(400).send({
        error: `Error generando URL de logout: ${(err as Error).message}`,
      });
    }
  });

  /**
   * POST /enterprise/sso/validate-domain — Check if email domain is allowed
   */
  app.post(
    "/validate-domain",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, allowedDomains } = request.body as {
        email?: string;
        allowedDomains?: string[];
      };

      if (!email) {
        return reply.status(400).send({
          error: "El campo 'email' es requerido",
        });
      }

      const allowed = isEmailDomainAllowed(email, allowedDomains ?? []);

      return reply.send({
        email,
        allowed,
        domain: email.split("@")[1],
        message: allowed
          ? "Dominio permitido"
          : "Dominio no está en la lista de permitidos",
      });
    },
  );
}
