/**
 * Pricing Suggest Route — returns the recommended price for a service on a vehicle.
 *
 * Joins service_pricing_rules + rh_service_hours + vehicle_types to produce a
 * single suggested price and estimated hours for a given service × vehicle × complexity.
 *
 * @module workshop/routes/pricing-suggest
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../../../shared/database/drizzle.js";
import { eq, and } from "drizzle-orm";
import { servicePricingRules, rhServiceHours } from "../schema/service-pricing.js";
import { vehicleTypes } from "../schema/vehicle-reference.js";

export async function pricingSuggestRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { servicioId?: string; vehicleTypeId?: string; complejidad?: string } }>(
    "/workshop/pricing-suggest",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["servicioId", "vehicleTypeId"],
          properties: {
            servicioId: { type: "string", format: "uuid" },
            vehicleTypeId: { type: "string", format: "uuid" },
            complejidad: { type: "string", enum: ["BAJA", "NORMAL", "ALTA"], default: "NORMAL" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { servicioId, vehicleTypeId, complejidad = "NORMAL" } = request.query as any;

      // 1. Get matching pricing rule (flat price from service_pricing_rules)
      const [pricingRule] = await db()
        .select()
        .from(servicePricingRules)
        .where(
          and(
            eq(servicePricingRules.servicioId, servicioId),
            eq(servicePricingRules.vehicleTypeId, vehicleTypeId),
            eq(servicePricingRules.tenantSlug, request.tenantSlug),
          ),
        )
        .limit(1);

      // 2. Get estimated hours from rh_service_hours
      const [rhEntry] = await db()
        .select()
        .from(rhServiceHours)
        .where(
          and(
            eq(rhServiceHours.servicioId, servicioId),
            eq(rhServiceHours.vehicleTypeId, vehicleTypeId),
            eq(rhServiceHours.complejidad, complejidad),
            eq(rhServiceHours.tenantSlug, request.tenantSlug),
          ),
        )
        .limit(1);

      // 3. Get vehicle type multiplier
      const [vType] = await db()
        .select()
        .from(vehicleTypes)
        .where(eq(vehicleTypes.id, vehicleTypeId))
        .limit(1);

      if (!pricingRule && !rhEntry) {
        return reply.status(404).send({
          error: "No se encontraron datos de precios ni horas para esta combinación servicio × vehículo × complejidad",
        });
      }

      return reply.send({
        servicioId,
        vehicleTypeId,
        complejidad,
        // Pricing data from service_pricing_rules
        precioVentaPyg: pricingRule?.precioVentaPyg ?? null,
        precioCostoPyg: pricingRule?.precioCostoPyg ?? null,
        impuestoIvaPct: pricingRule?.impuestoIvaPct ?? "10",
        tiempoEstimadoMin: pricingRule?.tiempoEstimadoMin ?? null,
        // Hours data from rh_service_hours
        horasEstimadas: rhEntry?.horasEstimadas ?? null,
        horasMinimas: rhEntry?.horasMinimas ?? null,
        horasMaximas: rhEntry?.horasMaximas ?? null,
        requiereEspecialista: rhEntry?.requiereEspecialista ?? false,
        // Vehicle type metadata
        vehicleTypeNombre: vType?.nombre ?? null,
      });
    },
  );
}
