/**
 * Onboarding Routes — Create new tenant with initial configuration.
 *
 * POST /api/onboarding/setup — Create tenant with business info
 *   Also auto-configures accounting modules (configuradores + mappings).
 */

import type { FastifyInstance } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { tenantConfig, librosObligatorios } from "../schema/index.js";
import { clasificarMIC, determinarRegimenIRE, activarLibrosObligatorios } from "../services/tenant-classifier.service.js";
import { autoConfigureAccounting } from "../../finance/services/accounting/auto-configure.service.js";
import { eq } from "drizzle-orm";

interface OnboardingBody {
  tenantSlug: string;
  ruc: string;
  dv: string;
  razonSocial: string;
  formaJuridica?: string;
  cantidadPersonal?: number;
  ingresosAnuales?: number;
}

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/onboarding/setup
   *
   * Creates a new tenant with initial configuration.
   * This is called after user registers via Clerk.
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
    } = request.body;

    // Validate required fields
    if (!tenantSlug || !ruc || !dv || !razonSocial) {
      return reply.status(400).send({
        error: "Campos requeridos: tenantSlug, ruc, dv, razonSocial",
      });
    }

    // Validate slug format
    if (!/^[a-zA-Z0-9_-]+$/.test(tenantSlug)) {
      return reply.status(400).send({
        error: "El slug solo puede contener letras, números, guiones y guiones bajos",
      });
    }

    // Check if tenant already exists
    const existing = await db()
      .select()
      .from(tenantConfig)
      .where(eq(tenantConfig.tenantSlug, tenantSlug))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({
        error: "Ya existe un taller con ese slug",
      });
    }

    // Classify MIC based on inputs
    const clasificacion = clasificarMIC(ingresosAnuales, cantidadPersonal);
    const regimen = determinarRegimenIRE(clasificacion);

    // Create tenant config
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

    // Activate mandatory books
    const librosRequeridos = activarLibrosObligatorios(formaJuridica, regimen);
    for (const lr of librosRequeridos) {
      await db().insert(librosObligatorios).values({
        tenantSlug,
        libro: lr.libro,
        obligatorio: lr.obligatorio,
      });
    }

    // Auto-configure accounting modules (idempotent: safe to call multiple times)
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
