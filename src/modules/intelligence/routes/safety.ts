/**
 * High-Voltage Safety Protocol Routes.
 *
 * Endpoint for generating HV safety disconnect protocols for
 * BEV (Battery Electric Vehicle) and HEV (Hybrid Electric Vehicle)
 * repair procedures, compliant with Ley 1034/83 (Paraguay),
 * ISO 6469, and NFPA 70E standards.
 *
 * @module intelligence/routes/safety
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { generateHvProtocol } from "../services/hv-safety.service.js";
import type {
  SafetyProtocolRequest,
  SafetyProtocolResponse,
} from "../types.js";
import { BadRequestError } from "../../../shared/errors/app-error.js";

/**
 * Registers safety protocol routes under the `/intelligence/safety` prefix.
 *
 * Routes:
 *   POST /intelligence/safety/protocol  — Generate HV safety protocol
 *
 * @param app - Fastify instance
 */
export async function safetyRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /intelligence/safety/protocol ──────────
  /**
   * POST /intelligence/safety/protocol
   *
   * Generates a complete High-Voltage safety disconnect protocol
   * for EV/HEV repair interventions. The protocol includes:
   *   - Risk assessment
   *   - Required Personal Protective Equipment (PPE)
   *   - Step-by-step HV disconnect procedure
   *   - Voltage verification steps
   *   - Emergency contact information
   *
   * Request body:
   *   {
   *     "brand": "Toyota",
   *     "model": "Prius",
   *     "year": 2022,
   *     "plate": "ABC 1234",
   *     "hvBatteryVoltage": 201.6,
   *     "batteryType": "NiMH"
   *   }
   *
   * Response: { "protocol": HvSafetyProtocol }
   *
   * ⚠️ IMPORTANT: This protocol is a guideline. The responsible
   *    technician must verify all steps against the manufacturer's
   *    service manual for the specific vehicle model.
   */
  app.post<{
    Body: SafetyProtocolRequest;
    Reply: SafetyProtocolResponse;
  }>(
    "/intelligence/safety/protocol",
    {
      schema: {
        body: {
          type: "object",
          required: ["brand", "model", "hvBatteryVoltage"],
          properties: {
            brand: { type: "string", minLength: 1 },
            model: { type: "string", minLength: 1 },
            year: { type: "number", nullable: true },
            plate: { type: "string", nullable: true },
            hvBatteryVoltage: { type: "number", minimum: 1 },
            batteryType: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SafetyProtocolRequest }>, reply: FastifyReply) => {
      const { brand, model, hvBatteryVoltage } = request.body;

      if (!brand || brand.trim().length === 0) {
        throw new BadRequestError("Vehicle brand is required");
      }
      if (!model || model.trim().length === 0) {
        throw new BadRequestError("Vehicle model is required");
      }
      if (!hvBatteryVoltage || hvBatteryVoltage <= 0) {
        throw new BadRequestError("HV battery voltage must be a positive number");
      }
      if (hvBatteryVoltage > 1500) {
        throw new BadRequestError(
          `Voltage ${hvBatteryVoltage}V exceeds known EV/HEV systems. ` +
          `Verify the battery voltage specification.`,
        );
      }

      const protocol = await generateHvProtocol(request.body);

      return reply.status(200).send({ protocol });
    },
  );
}
