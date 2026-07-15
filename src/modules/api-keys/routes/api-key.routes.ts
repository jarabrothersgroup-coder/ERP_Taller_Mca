/**
 * API Key Management Routes — CRUD for external API keys.
 *
 * Endpoints:
 *   POST   /api-keys          — Create new API key
 *   GET    /api-keys          — List all API keys
 *   GET    /api-keys/:id      — Get API key details
 *   PATCH  /api-keys/:id      — Update API key (name, scopes, rate limit)
 *   DELETE /api-keys/:id      — Revoke (disable) API key
 *   DELETE /api-keys/:id/permanent — Delete permanently
 *   GET    /api-keys/:id/usage — Get usage statistics
 *
 * @module api-keys/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createApiKey,
  listApiKeys,
  getApiKey,
  revokeApiKey,
  getApiKeyUsage,
} from "../services/api-key.service.js";
import { type ApiScope, API_SCOPES } from "../schema/api-keys.js";

/**
 * Register API key management routes.
 */
export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // ─── Create API Key ───────────────────────────────────────
  app.post(
    "/",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Create a new API key",
        description:
          "Generate a new API key for external integrations. The raw key is only returned in this response — store it securely.",
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Human-readable key name" },
            scopes: {
              type: "array",
              items: { type: "string" },
              description: "Permission scopes (e.g., ['read:workshop', 'write:inventory'])",
            },
            rateLimit: {
              type: "number",
              description: "Rate limit override (requests per minute)",
            },
            dailyLimit: {
              type: "number",
              description: "Maximum requests per day",
            },
            ipWhitelist: {
              type: "array",
              items: { type: "string" },
              description: "IP whitelist (empty = allow all)",
            },
            expiresAt: {
              type: "string",
              format: "date-time",
              description: "Expiration date (null = never)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              apiKey: { type: "string", description: "Raw API key — store this securely!" },
              keyPrefix: { type: "string" },
              scopes: { type: "array", items: { type: "string" } },
              rateLimit: { type: ["number", "null"] },
              dailyLimit: { type: ["number", "null"] },
              ipWhitelist: { type: "array", items: { type: "string" } },
              isActive: { type: "boolean" },
              expiresAt: { type: ["string", "null"] },
              createdAt: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const body = request.body as {
        name: string;
        scopes?: ApiScope[];
        rateLimit?: number | null;
        dailyLimit?: number | null;
        ipWhitelist?: string[];
        expiresAt?: string | null;
      };

      // Validate scopes
      if (body.scopes) {
        for (const scope of body.scopes) {
          if (!(scope in API_SCOPES)) {
            return reply.status(400).send({
              error: "ValidationError",
              message: `Invalid scope: ${scope}. Valid scopes: ${Object.keys(API_SCOPES).join(", ")}`,
            });
          }
        }
      }

      const result = await createApiKey({
        tenantSlug,
        name: body.name,
        scopes: body.scopes,
        rateLimit: body.rateLimit,
        dailyLimit: body.dailyLimit,
        ipWhitelist: body.ipWhitelist,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      });

      return reply.status(201).send(result);
    },
  );

  // ─── List API Keys ────────────────────────────────────────
  app.get(
    "/",
    {
      schema: {
        tags: ["API Keys"],
        summary: "List all API keys for the tenant",
        description: "Returns all API keys (without exposing hashes).",
        response: {
          200: {
            type: "object",
            properties: {
              keys: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    keyPrefix: { type: "string" },
                    scopes: { type: "array", items: { type: "string" } },
                    rateLimit: { type: ["number", "null"] },
                    dailyLimit: { type: ["number", "null"] },
                    isActive: { type: "boolean" },
                    lastUsedAt: { type: ["string", "null"] },
                    usageCount: { type: "number" },
                    expiresAt: { type: ["string", "null"] },
                    createdAt: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const keys = await listApiKeys(tenantSlug);
      return reply.send({ keys });
    },
  );

  // ─── Get API Key Details ──────────────────────────────────
  app.get(
    "/:id",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Get API key details",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { id } = request.params as { id: string };

      const key = await getApiKey(tenantSlug, id);
      if (!key) {
        return reply.status(404).send({ error: "NotFound", message: "API key not found" });
      }

      return reply.send(key);
    },
  );

  // ─── Revoke API Key ───────────────────────────────────────
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Revoke (disable) an API key",
        description: "Disables the API key without deleting it. The key can be re-enabled later.",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: { ok: { type: "boolean" }, message: { type: "string" } },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { id } = request.params as { id: string };

      const revoked = await revokeApiKey(tenantSlug, id);
      if (!revoked) {
        return reply.status(404).send({ error: "NotFound", message: "API key not found" });
      }

      return reply.send({ ok: true, message: "API key revoked" });
    },
  );

  // ─── Get Usage Statistics ─────────────────────────────────
  app.get(
    "/:id/usage",
    {
      schema: {
        tags: ["API Keys"],
        summary: "Get API key usage statistics",
        description: "Returns request counts, error rates, and top endpoints for this key.",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { id } = request.params as { id: string };

      const stats = await getApiKeyUsage(tenantSlug, id);
      return reply.send(stats);
    },
  );
}
