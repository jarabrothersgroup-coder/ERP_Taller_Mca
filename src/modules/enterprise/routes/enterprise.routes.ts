/**
 * Enterprise Routes — SSO, White-Label, Data Retention.
 *
 * Uses Drizzle ORM via db() from shared/database/drizzle.js.
 * All queries are tenant-isolated via X-Tenant-Slug header.
 *
 * Endpoints:
 *   GET    /enterprise/sso              — Get SSO config for current tenant
 *   PUT    /enterprise/sso              — Update SSO config (upsert)
 *   GET    /enterprise/white-label      — Get white-label settings
 *   PUT    /enterprise/white-label      — Update white-label settings (upsert)
 *   GET    /enterprise/data-retention   — Get data retention policy
 *   PUT    /enterprise/data-retention   — Update data retention policy (upsert)
 *   POST   /enterprise/data-retention/cleanup — Trigger manual cleanup
 *
 * @module enterprise/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db, sql } from "../../../shared/database/drizzle.js";
import { ssoConfig, whiteLabelConfig, dataRetentionPolicy } from "../schema/index.js";

export async function enterpriseRoutes(app: FastifyInstance): Promise<void> {
  const d = db();

  // ── SSO Configuration ─────────────────────────

  app.get("/enterprise/sso", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (req.headers["x-tenant-slug"] as string) || "demo";

    const rows = await d
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.tenantSlug, tenantSlug))
      .limit(1);

    if (rows.length === 0) {
      return reply.send({
        tenantSlug,
        samlEnabled: false,
        oidcEnabled: false,
        enforceSso: false,
        defaultRole: "user",
      });
    }

    const r = rows[0]!;
    return reply.send({
      id: r.id,
      tenantSlug: r.tenantSlug,
      samlEnabled: r.samlEnabled,
      samlMetadataUrl: r.samlMetadataUrl,
      samlEntityId: r.samlEntityId,
      samlAcsUrl: r.samlAcsUrl,
      samlCertificate: r.samlCertificate,
      oidcEnabled: r.oidcEnabled,
      oidcIssuer: r.oidcIssuer,
      oidcClientId: r.oidcClientId,
      oidcClientSecret: r.oidcClientSecret,
      oidcScopes: r.oidcScopes,
      enforceSso: r.enforceSso,
      defaultRole: r.defaultRole,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  });

  app.put("/enterprise/sso", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (req.headers["x-tenant-slug"] as string) || "demo";
    const body = req.body as Record<string, unknown>;

    const values = {
      id: `sso-${tenantSlug}-${Date.now()}`,
      tenantSlug,
      samlEnabled: Boolean(body.samlEnabled ?? false),
      samlMetadataUrl: (body.samlMetadataUrl as string) ?? null,
      samlEntityId: (body.samlEntityId as string) ?? null,
      samlAcsUrl: (body.samlAcsUrl as string) ?? null,
      samlCertificate: (body.samlCertificate as string) ?? null,
      oidcEnabled: Boolean(body.oidcEnabled ?? false),
      oidcIssuer: (body.oidcIssuer as string) ?? null,
      oidcClientId: (body.oidcClientId as string) ?? null,
      oidcClientSecret: (body.oidcClientSecret as string) ?? null,
      oidcScopes: (body.oidcScopes as string) ?? "openid email profile",
      enforceSso: Boolean(body.enforceSso ?? false),
      defaultRole: (body.defaultRole as string) ?? "user",
    };

    // Check if exists
    const existing = await d
      .select({ id: ssoConfig.id })
      .from(ssoConfig)
      .where(eq(ssoConfig.tenantSlug, tenantSlug))
      .limit(1);

    if (existing.length > 0) {
      // Update
      await d
        .update(ssoConfig)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(ssoConfig.tenantSlug, tenantSlug));
    } else {
      // Insert
      await d.insert(ssoConfig).values(values);
    }

    app.log.info({ tenantSlug }, "SSO config upserted");

    return reply.send({
      ok: true,
      tenantSlug,
      samlEnabled: values.samlEnabled,
      oidcEnabled: values.oidcEnabled,
      enforceSso: values.enforceSso,
      defaultRole: values.defaultRole,
      updatedAt: new Date().toISOString(),
    });
  });

  // ── White-Label Settings ───────────────────────

  app.get("/enterprise/white-label", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (req.headers["x-tenant-slug"] as string) || "demo";

    const rows = await d
      .select()
      .from(whiteLabelConfig)
      .where(eq(whiteLabelConfig.tenantSlug, tenantSlug))
      .limit(1);

    if (rows.length === 0) {
      return reply.send({
        tenantSlug,
        customDomain: null,
        sslEnabled: true,
        companyName: null,
        logoUrl: null,
        faviconUrl: null,
        primaryColor: "#f97316",
        secondaryColor: "#1e293b",
        accentColor: "#3b82f6",
        footerText: null,
        privacyPolicyUrl: null,
        termsOfServiceUrl: null,
        emailFromName: null,
        emailFromAddress: null,
        emailHeaderHtml: null,
        emailFooterHtml: null,
        iosAppId: null,
        androidPackageId: null,
      });
    }

    const r = rows[0]!;
    return reply.send({
      id: r.id,
      tenantSlug: r.tenantSlug,
      customDomain: r.customDomain,
      sslEnabled: r.sslEnabled,
      companyName: r.companyName,
      logoUrl: r.logoUrl,
      faviconUrl: r.faviconUrl,
      primaryColor: r.primaryColor,
      secondaryColor: r.secondaryColor,
      accentColor: r.accentColor,
      footerText: r.footerText,
      privacyPolicyUrl: r.privacyPolicyUrl,
      termsOfServiceUrl: r.termsOfServiceUrl,
      emailFromName: r.emailFromName,
      emailFromAddress: r.emailFromAddress,
      emailHeaderHtml: r.emailHeaderHtml,
      emailFooterHtml: r.emailFooterHtml,
      iosAppId: r.iosAppId,
      androidPackageId: r.androidPackageId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  });

  app.put("/enterprise/white-label", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (req.headers["x-tenant-slug"] as string) || "demo";
    const body = req.body as Record<string, unknown>;

    const values = {
      id: `wl-${tenantSlug}-${Date.now()}`,
      tenantSlug,
      customDomain: (body.customDomain as string) ?? null,
      sslEnabled: body.sslEnabled !== false,
      companyName: (body.companyName as string) ?? null,
      logoUrl: (body.logoUrl as string) ?? null,
      faviconUrl: (body.faviconUrl as string) ?? null,
      primaryColor: (body.primaryColor as string) ?? "#f97316",
      secondaryColor: (body.secondaryColor as string) ?? "#1e293b",
      accentColor: (body.accentColor as string) ?? "#3b82f6",
      footerText: (body.footerText as string) ?? null,
      privacyPolicyUrl: (body.privacyPolicyUrl as string) ?? null,
      termsOfServiceUrl: (body.termsOfServiceUrl as string) ?? null,
      emailFromName: (body.emailFromName as string) ?? null,
      emailFromAddress: (body.emailFromAddress as string) ?? null,
      emailHeaderHtml: (body.emailHeaderHtml as string) ?? null,
      emailFooterHtml: (body.emailFooterHtml as string) ?? null,
      iosAppId: (body.iosAppId as string) ?? null,
      androidPackageId: (body.androidPackageId as string) ?? null,
    };

    const existing = await d
      .select({ id: whiteLabelConfig.id })
      .from(whiteLabelConfig)
      .where(eq(whiteLabelConfig.tenantSlug, tenantSlug))
      .limit(1);

    if (existing.length > 0) {
      await d
        .update(whiteLabelConfig)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(whiteLabelConfig.tenantSlug, tenantSlug));
    } else {
      await d.insert(whiteLabelConfig).values(values);
    }

    app.log.info({ tenantSlug }, "White-label config upserted");

    return reply.send({
      ok: true,
      tenantSlug,
      companyName: values.companyName,
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
      accentColor: values.accentColor,
      updatedAt: new Date().toISOString(),
    });
  });

  // ── Data Retention Policy ──────────────────────

  app.get("/enterprise/data-retention", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (req.headers["x-tenant-slug"] as string) || "demo";

    const rows = await d
      .select()
      .from(dataRetentionPolicy)
      .where(eq(dataRetentionPolicy.tenantSlug, tenantSlug))
      .limit(1);

    if (rows.length === 0) {
      return reply.send({
        tenantSlug,
        auditLogRetentionDays: "2555",
        emailLogRetentionDays: "365",
        backupRetentionDays: "90",
        sessionRetentionDays: "30",
        autoCleanupEnabled: true,
        lastCleanupAt: null,
        encryptionAtRest: true,
        encryptionInTransit: true,
        gdprCompliant: true,
        dataExportEnabled: true,
        rightToErasure: true,
      });
    }

    const r = rows[0]!;
    return reply.send({
      id: r.id,
      tenantSlug: r.tenantSlug,
      auditLogRetentionDays: r.auditLogRetentionDays,
      emailLogRetentionDays: r.emailLogRetentionDays,
      backupRetentionDays: r.backupRetentionDays,
      sessionRetentionDays: r.sessionRetentionDays,
      autoCleanupEnabled: r.autoCleanupEnabled,
      lastCleanupAt: r.lastCleanupAt,
      encryptionAtRest: r.encryptionAtRest,
      encryptionInTransit: r.encryptionInTransit,
      gdprCompliant: r.gdprCompliant,
      dataExportEnabled: r.dataExportEnabled,
      rightToErasure: r.rightToErasure,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  });

  app.put("/enterprise/data-retention", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (req.headers["x-tenant-slug"] as string) || "demo";
    const body = req.body as Record<string, unknown>;

    const values = {
      id: `dr-${tenantSlug}-${Date.now()}`,
      tenantSlug,
      auditLogRetentionDays: String(body.auditLogRetentionDays ?? "2555"),
      emailLogRetentionDays: String(body.emailLogRetentionDays ?? "365"),
      backupRetentionDays: String(body.backupRetentionDays ?? "90"),
      sessionRetentionDays: String(body.sessionRetentionDays ?? "30"),
      autoCleanupEnabled: body.autoCleanupEnabled !== false,
      encryptionAtRest: body.encryptionAtRest !== false,
      encryptionInTransit: body.encryptionInTransit !== false,
      gdprCompliant: body.gdprCompliant !== false,
      dataExportEnabled: body.dataExportEnabled !== false,
      rightToErasure: body.rightToErasure !== false,
    };

    const existing = await d
      .select({ id: dataRetentionPolicy.id })
      .from(dataRetentionPolicy)
      .where(eq(dataRetentionPolicy.tenantSlug, tenantSlug))
      .limit(1);

    if (existing.length > 0) {
      await d
        .update(dataRetentionPolicy)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(dataRetentionPolicy.tenantSlug, tenantSlug));
    } else {
      await d.insert(dataRetentionPolicy).values(values);
    }

    app.log.info({ tenantSlug }, "Data retention policy upserted");

    return reply.send({
      ok: true,
      tenantSlug,
      auditLogRetentionDays: values.auditLogRetentionDays,
      emailLogRetentionDays: values.emailLogRetentionDays,
      backupRetentionDays: values.backupRetentionDays,
      sessionRetentionDays: values.sessionRetentionDays,
      autoCleanupEnabled: values.autoCleanupEnabled,
      encryptionAtRest: values.encryptionAtRest,
      encryptionInTransit: values.encryptionInTransit,
      gdprCompliant: values.gdprCompliant,
      dataExportEnabled: values.dataExportEnabled,
      rightToErasure: values.rightToErasure,
      updatedAt: new Date().toISOString(),
    });
  });

  // ── Manual Cleanup Trigger ─────────────────────

  app.post("/enterprise/data-retention/cleanup", async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantSlug = (req.headers["x-tenant-slug"] as string) || "demo";

    // Get retention policy
    const policies = await d
      .select()
      .from(dataRetentionPolicy)
      .where(eq(dataRetentionPolicy.tenantSlug, tenantSlug))
      .limit(1);

    if (policies.length === 0) {
      return reply.code(404).send({ error: "No data retention policy found for this tenant" });
    }

    const policy = policies[0]!;
    const auditDays = parseInt(policy.auditLogRetentionDays, 10);
    const emailDays = parseInt(policy.emailLogRetentionDays, 10);

    let auditLogDeleted = 0;
    let emailLogDeleted = 0;

    // Delete old audit logs (table may not exist)
    try {
      const auditResult = await d.execute(sql`
        DELETE FROM audit_log
        WHERE tenant_slug = ${tenantSlug}
          AND created_at < NOW() - INTERVAL '1 day' * ${auditDays}
      `);
      auditLogDeleted = (auditResult as { rowCount?: number }).rowCount ?? 0;
    } catch {
      // Table may not exist — skip
    }

    // Delete old email logs (table may not exist)
    try {
      const emailResult = await d.execute(sql`
        DELETE FROM email_log
        WHERE tenant_slug = ${tenantSlug}
          AND created_at < NOW() - INTERVAL '1 day' * ${emailDays}
      `);
      emailLogDeleted = (emailResult as { rowCount?: number }).rowCount ?? 0;
    } catch {
      // Table may not exist — skip
    }

    // Update last_cleanup_at
    await d
      .update(dataRetentionPolicy)
      .set({ lastCleanupAt: new Date(), updatedAt: new Date() })
      .where(eq(dataRetentionPolicy.tenantSlug, tenantSlug));

    app.log.info({ tenantSlug, auditLogDeleted, emailLogDeleted }, "Manual cleanup completed");

    return reply.send({
      ok: true,
      tenantSlug,
      cleanedAt: new Date().toISOString(),
      stats: {
        auditLogDeleted,
        emailLogDeleted,
        sessionsExpired: 0,
      },
    });
  });

  app.log.info("Enterprise module registered");
}
