/**
 * Mechanic Assignment Routes — Asignación Inteligente de Mecánicos.
 *
 * Sprint 85 — P1-4.
 *
 * Endpoints:
 *   POST /workshop/mechanic-assignment/assign — Assign optimal mechanic to an OT
 *
 * @module workshop/routes/mechanic-assignment.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assignOptimalMechanic } from "../services/mechanic-assignment.service.js";

export async function mechanicAssignmentRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /workshop/mechanic-assignment/assign — Assign optimal mechanic ──
  app.post<{
    Body: {
      ordenId: string;
      hvAlert?: boolean;
      requiredCertificaciones?: string[];
      preferredMechanicId?: string;
    };
  }>(
    "/workshop/mechanic-assignment/assign",
    {
      schema: {
        body: {
          type: "object",
          required: ["ordenId"],
          properties: {
            ordenId: { type: "string", format: "uuid" },
            hvAlert: { type: "boolean", nullable: true },
            requiredCertificaciones: { type: "array", items: { type: "string" }, nullable: true },
            preferredMechanicId: { type: "string", nullable: true },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { ordenId: string; hvAlert?: boolean; requiredCertificaciones?: string[]; preferredMechanicId?: string } }>,
      reply: FastifyReply,
    ) => {
      const result = await assignOptimalMechanic({
        ...request.body,
        tenantSlug: request.tenantSlug,
      });
      return reply.send(result);
    },
  );
}
