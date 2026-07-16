/**
 * Mobile Module — Push token routes.
 *
 * Manages Expo push tokens per tenant/device so the backend can target a
 * workshop's mobile app instances for push notifications (OT assignments,
 * HV lockout reminders, etc.).
 *
 * Tenant isolation via X-Tenant-Slug (resolveTenant).
 *
 * Endpoints (all under /mobile):
 *   POST   /mobile/push-token   — upsert a device push token
 *   DELETE /mobile/push-token   — remove a device push token
 *   GET    /mobile/push-tokens  — list tokens for the tenant
 *   GET    /mobile/health       — lightweight module health check
 *
 * @module mobile/routes/mobile.routes
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { mobilePushTokens } from "../schema/index.js";
import { resolveTenant } from "../../../shared/middleware/tenant-resolver.js";
import { BadRequestError } from "../../../shared/errors/app-error.js";

interface PushTokenBody {
  deviceId?: string;
  pushToken?: string;
  platform?: "ios" | "android" | "web";
  profileEmail?: string;
}

export async function mobileRoutes(app: FastifyInstance): Promise<void> {
  // Resolve tenant (X-Tenant-Slug → custom domain → subdomain) for all routes.
  app.addHook("onRequest", resolveTenant);

  // ── POST /mobile/push-token ──────────────────────────────
  app.post("/mobile/push-token", async (request, reply) => {
    const tenantSlug = request.tenantSlug;
    const body = request.body as PushTokenBody | undefined;

    if (!body?.deviceId || !body?.pushToken) {
      throw new BadRequestError("deviceId y pushToken son requeridos");
    }

    const { deviceId, pushToken, platform = "ios", profileEmail } = body;

    const [existing] = await db()
      .select({ id: mobilePushTokens.id })
      .from(mobilePushTokens)
      .where(
        and(
          eq(mobilePushTokens.tenantSlug, tenantSlug),
          eq(mobilePushTokens.deviceId, deviceId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db()
        .update(mobilePushTokens)
        .set({
          pushToken,
          platform,
          profileEmail: profileEmail ?? null,
          updatedAt: new Date(),
        })
        .where(eq(mobilePushTokens.id, existing.id))
        .returning({ id: mobilePushTokens.id });
      return reply.send({ ok: true, id: updated?.id, updated: true });
    }

    const [inserted] = await db()
      .insert(mobilePushTokens)
      .values({
        id: crypto.randomUUID(),
        tenantSlug,
        deviceId,
        pushToken,
        platform,
        profileEmail: profileEmail ?? null,
      })
      .returning({ id: mobilePushTokens.id });

    return reply.send({ ok: true, id: inserted?.id, updated: false });
  });

  // ── DELETE /mobile/push-token ───────────────────────────
  app.delete("/mobile/push-token", async (request, reply) => {
    const tenantSlug = request.tenantSlug;
    const body = request.body as PushTokenBody | undefined;

    if (!body?.deviceId) {
      throw new BadRequestError("deviceId es requerido");
    }

    await db()
      .delete(mobilePushTokens)
      .where(
        and(
          eq(mobilePushTokens.tenantSlug, tenantSlug),
          eq(mobilePushTokens.deviceId, body.deviceId),
        ),
      );

    return reply.send({ ok: true });
  });

  // ── GET /mobile/push-tokens ─────────────────────────────
  app.get("/mobile/push-tokens", async (request, reply) => {
    const tenantSlug = request.tenantSlug;

    const tokens = await db()
      .select({
        id: mobilePushTokens.id,
        deviceId: mobilePushTokens.deviceId,
        platform: mobilePushTokens.platform,
        profileEmail: mobilePushTokens.profileEmail,
        createdAt: mobilePushTokens.createdAt,
      })
      .from(mobilePushTokens)
      .where(eq(mobilePushTokens.tenantSlug, tenantSlug))
      .orderBy(mobilePushTokens.createdAt);

    return reply.send({ tokens });
  });

  // ── GET /mobile/health ──────────────────────────────────
  app.get("/mobile/health", async (_request, reply) => {
    return reply.send({ ok: true, module: "mobile" });
  });
}
