/**
 * Tenant Configuration Routes — Perfil del Contribuyente.
 *
 * Permite obtener y actualizar la configuración del tenant, incluyendo
 * clasificación MIC, forma jurídica, régimen IRE y libros obligatorios.
 *
 * @module tenants/routes/tenants
 */

import type { FastifyInstance } from "fastify";
import { getTenantProfile, updateTenantProfile } from "../services/tenant-profile.service.js";

/**
 * Registra las rutas de configuración del tenant.
 * Se registran bajo /api/admin/tenant — siempre requieren tenant context.
 *
 * @param app - Fastify instance
 */
export async function tenantConfigRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /api/tenant/profile ──────────────────
  // Obtiene el perfil completo del tenant activo (config + libros)
  app.get("/api/tenant/profile", async (request, reply) => {
    const { tenantSlug } = request as unknown as { tenantSlug: string };
    if (!tenantSlug) {
      return reply.status(400).send({ error: "Tenant slug requerido" });
    }

    const profile = await getTenantProfile(tenantSlug);
    return reply.send(profile);
  });

  // ─── PATCH /api/tenant/profile ─────────────────
  // Actualiza datos del tenant y dispara reclasificación automática
  app.patch<{
    Body: {
      ruc?: string;
      dv?: string;
      razonSocial?: string;
      ingresosAnuales?: number;
      cantidadPersonal?: number;
      capitalIntegrado?: number;
      formaJuridica?: string;
    };
  }>("/api/tenant/profile", async (request, reply) => {
    const { tenantSlug } = request as unknown as { tenantSlug: string };
    if (!tenantSlug) {
      return reply.status(400).send({ error: "Tenant slug requerido" });
    }

    const profile = await updateTenantProfile(tenantSlug, request.body);
    return reply.send(profile);
  });
}
