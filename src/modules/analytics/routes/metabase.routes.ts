/**
 * Metabase Embed Routes — Embedded analytics dashboards.
 *
 * Provides signed URLs for embedding Metabase dashboards
 * and a configuration endpoint for the frontend.
 *
 * Routes:
 *   GET  /analytics/metabase/config     — Get Metabase embed config
 *   POST /analytics/metabase/embed-url  — Generate signed embed URL
 *   GET  /analytics/metabase/health     — Check Metabase connectivity
 *
 * @module analytics/routes/metabase.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// ─── Configuration ──────────────────────────────────────────────────────

const METABASE_URL = process.env.METABASE_URL || "";
const METABASE_SECRET_KEY = process.env.METABASE_SECRET_KEY || "";


/**
 * Check if Metabase is configured.
 */
function isMetabaseConfigured(): boolean {
  return Boolean(METABASE_URL && METABASE_SECRET_KEY);
}

/**
 * Generate a signed embed URL for a Metabase question/dashboard.
 */
async function generateSignedUrl(
  resourceType: "dashboard" | "question",
  resourceId: number,
  params?: Record<string, any>,
): Promise<string | null> {
  if (!isMetabaseConfigured()) return null;

  // Simple HMAC-SHA384 signing for Metabase embed URLs
  const crypto = await import("crypto");
  const resourceKey = resourceType === "question" ? "question" : "dashboard";
  const payload = JSON.stringify({
    resource: { [resourceKey]: resourceId },
    params: params ?? {},
    exp: Math.round(Date.now() / 1000) + 60 * 60, // 1 hour expiry
  });

  const hmac = crypto.createHmac("sha384", METABASE_SECRET_KEY);
  hmac.update(payload);
  const signature = hmac.digest("hex");

  const encodedPayload = Buffer.from(payload).toString("base64url");
  return `${METABASE_URL}/embed/${resourceType}/${resourceId}#${encodedPayload}.${signature}`;
}

// ─── Routes ─────────────────────────────────────────────────────────────

export async function metabaseRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /analytics/metabase/config — Embed configuration ──
  app.get(
    "/analytics/metabase/config",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get Metabase embed configuration",
        description: "Returns whether Metabase is configured and available dashboards.",
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const configured = isMetabaseConfigured();

      return reply.send({
        configured,
        url: configured ? METABASE_URL : null,
        dashboards: configured
          ? [
              { id: 1, name: "Workshop Overview", description: "KPIs and trends" },
              { id: 2, name: "Financial Summary", description: "Revenue and expenses" },
              { id: 3, name: "Inventory Analytics", description: "Stock levels and turnover" },
            ]
          : [],
      });
    },
  );

  // ── POST /analytics/metabase/embed-url — Generate signed URL ──
  app.post(
    "/analytics/metabase/embed-url",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Generate a signed Metabase embed URL",
        description: "Creates a time-limited signed URL for embedding a Metabase dashboard or question.",
        body: {
          type: "object",
          required: ["resourceType", "resourceId"],
          properties: {
            resourceType: { type: "string", enum: ["dashboard", "question"] },
            resourceId: { type: "number" },
            params: { type: "object", description: "Filter parameters" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!isMetabaseConfigured()) {
        return reply.status(503).send({
          error: "ServiceUnavailable",
          message: "Metabase is not configured. Set METABASE_URL and METABASE_SECRET_KEY.",
        });
      }

      const { resourceType, resourceId, params } = request.body as {
        resourceType: "dashboard" | "question";
        resourceId: number;
        params?: Record<string, any>;
      };

      const url = await generateSignedUrl(resourceType, resourceId, params);
      if (!url) {
        return reply.status(500).send({ error: "Failed to generate embed URL" });
      }

      return reply.send({ url, expiresIn: "1h" });
    },
  );

  // ── GET /analytics/metabase/health — Connectivity check ──
  app.get(
    "/analytics/metabase/health",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Check Metabase connectivity",
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      if (!isMetabaseConfigured()) {
        return reply.send({ status: "not_configured", configured: false });
      }

      try {
        const response = await fetch(`${METABASE_URL}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });
        return reply.send({
          status: response.ok ? "healthy" : "unhealthy",
          configured: true,
          statusCode: response.status,
        });
      } catch {
        return reply.send({ status: "unreachable", configured: true });
      }
    },
  );
}
