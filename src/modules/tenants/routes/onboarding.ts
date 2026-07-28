/**
 * Onboarding Routes — Create new tenant with initial configuration.
 *
 * POST /api/onboarding/setup — Create tenant with business info + admin user
 *   Also auto-configures accounting modules (configuradores + mappings).
 */

import type { FastifyInstance } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { tenantConfig, librosObligatorios } from "../schema/index.js";
import { tenants } from "../../../shared/database/schema/index.js";
import { profiles } from "../../../shared/database/schema/index.js";
import { clasificarMIC, determinarRegimenIRE, activarLibrosObligatorios } from "../services/tenant-classifier.service.js";
import { autoConfigureAccounting } from "../../finance/services/accounting/auto-configure.service.js";
import { hashPassword } from "../../config/services/auth-utils.js";
import { eq } from "drizzle-orm";

interface OnboardingBody {
  tenantSlug: string;
  ruc: string;
  dv: string;
  razonSocial: string;
  formaJuridica?: string;
  cantidadPersonal?: number;
  ingresosAnuales?: number;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
}

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/onboarding/setup
   *
   * Creates a new tenant with initial configuration and admin user.
   * Creates: public.tenants + tenant_config + libros_obligatorios + profiles (admin)
   */
  app.post<{
    Body: OnboardingBody;
  }>("/api/onboarding/setup", async (request, reply) => {
    const {
      tenantSlug,
      ruc,
      dv,
      razonSocial,
      formaJuridica = "UNIPERSONAL",
      cantidadPersonal = 0,
      ingresosAnuales = 0,
      adminName = "Admin",
      adminEmail,
      adminPassword,
    } = request.body;

    // Validate required fields
    if (!tenantSlug || !ruc || !dv || !razonSocial) {
      return reply.status(400).send({
        error: "Campos requeridos: tenantSlug, ruc, dv, razonSocial",
      });
    }

    if (!adminEmail || !adminPassword) {
      return reply.status(400).send({
        error: "Campos requeridos: adminEmail, adminPassword",
      });
    }

    // Validate slug format
    if (!/^[a-zA-Z0-9_-]+$/.test(tenantSlug)) {
      return reply.status(400).send({
        error: "El slug solo puede contener letras, números, guiones y guiones bajos",
      });
    }

    // Check if tenant already exists (in tenants or tenant_config)
    const existingTenant = await db()
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    const existingConfig = await db()
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantSlug, tenantSlug))
      .limit(1);

    if (existingTenant.length > 0 || existingConfig.length > 0) {
      return reply.status(409).send({
        error: "Ya existe un taller con ese slug",
      });
    }

    // Check for duplicate admin email
    const existingProfile = await db()
      .select()
      .from(profiles)
      .where(eq(profiles.email, adminEmail))
      .limit(1);

    if (existingProfile.length > 0) {
      return reply.status(409).send({
        error: "Ya existe un usuario con ese email",
      });
    }

    // Classify MIC based on inputs
    const clasificacion = clasificarMIC(ingresosAnuales, cantidadPersonal);
    const regimen = determinarRegimenIRE(clasificacion);

    // 1. Create tenant in public.tenants
    const schemaName = `tenant_${tenantSlug.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const [tenant] = await db()
      .insert(tenants)
      .values({
        name: razonSocial,
        slug: tenantSlug,
        schemaName,
        ruc,
      })
      .returning();

    // 2. Create tenant config
    const [config] = await db()
      .insert(tenantConfig)
      .values({
        tenantSlug,
        ruc,
        dv,
        razonSocial,
        formaJuridica,
        clasificacionMic: clasificacion,
        regimenIre: regimen,
        ingresosAnuales: String(ingresosAnuales),
        cantidadPersonal,
      })
      .returning();

    // 3. Create admin user
    const passwordHash = hashPassword(adminPassword);
    const [admin] = await db()
      .insert(profiles)
      .values({
        tenantId: tenant.id,
        email: adminEmail,
        fullName: adminName,
        role: "admin",
        passwordHash,
      })
      .returning();

    // 4. Activate mandatory books
    const librosRequeridos = activarLibrosObligatorios(formaJuridica, regimen);
    for (const lr of librosRequeridos) {
      await db().insert(librosObligatorios).values({
        tenantSlug,
        libro: lr.libro,
        obligatorio: lr.obligatorio,
      });
    }

    // 5. Auto-configure accounting modules (idempotent: safe to call multiple times)
    const accountingConfig = await autoConfigureAccounting();

    return reply.status(201).send({
      success: true,
      tenant: {
        slug: config.tenantSlug,
        ruc: config.ruc,
        razonSocial: config.razonSocial,
        clasificacionMic: config.clasificacionMic,
        regimenIre: config.regimenIre,
      },
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      accounting: {
        configuradoresRegistrados: accountingConfig.configuradores,
        mappingsCreados: accountingConfig.mappings,
      },
    });
  });

  /**
   * GET /api/onboarding/check/:slug
   *
   * Check if a tenant slug is available.
   */
  app.get<{
    Params: { slug: string };
  }>("/api/onboarding/check/:slug", async (request, reply) => {
    const { slug } = request.params;

    const existing = await db()
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantSlug, slug))
      .limit(1);

    return reply.send({
      available: existing.length === 0,
    });
  });
}
