import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { analyzeVehicleSafety, parseDtcError } from "../services/vehicle-intelligence.service.js";
import { BadRequestError } from "../../../shared/errors/app-error.js";

interface DecodeSafetyBody {
  vin?: string;
  brand: string;
  model: string;
  year: number;
}

interface ParseDtcBody {
  dtcCode: string;
}

export async function vehicleIntelligenceRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: DecodeSafetyBody }>(
    "/intelligence/decode-safety",
    {
      schema: {
        body: {
          type: "object",
          required: ["brand", "model", "year"],
          properties: {
            vin: { type: "string", minLength: 11, maxLength: 17 },
            brand: { type: "string", minLength: 1 },
            model: { type: "string", minLength: 1 },
            year: { type: "number", minimum: 1900, maximum: 2030 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: DecodeSafetyBody }>, reply: FastifyReply) => {
      const { vin, brand, model, year } = request.body;
      if (!brand || brand.trim().length === 0) throw new BadRequestError("brand is required");

      const result = await analyzeVehicleSafety({ vin, brand, model, year });
      return reply.send(result);
    },
  );

  app.post<{ Body: ParseDtcBody }>(
    "/intelligence/parse-dtc",
    {
      schema: {
        body: {
          type: "object",
          required: ["dtcCode"],
          properties: {
            dtcCode: {
              type: "string",
              pattern: "^[PBCU]\\d{4}$",
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ParseDtcBody }>, reply: FastifyReply) => {
      const { dtcCode } = request.body;
      if (!dtcCode || dtcCode.trim().length === 0) {
        throw new BadRequestError("dtcCode is required");
      }
      const result = parseDtcError(dtcCode.toUpperCase());
      return reply.send(result);
    },
  );
}
