/**
 * DTC (Diagnostic Trouble Codes) Routes.
 *
 * Endpoints for parsing scanner reports and generating
 * automatic diagnoses using the OpenCode engine.
 *
 * @module intelligence/routes/dtc
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { parseReport, parseReportFromBuffer } from "../services/dtc-parser.service.js";
import { generateDiagnosisFromCodes } from "../services/diagnostic-engine.service.js";
import type {
  DiagnoseRequest,
  DiagnoseResponse,
  ParseDtcRequest,
  ParseDtcResponse,
} from "../types.js";
import { BadRequestError } from "../../../shared/errors/app-error.js";

/**
 * Registers DTC-related routes under the `/intelligence/dtc` prefix.
 *
 * Routes:
 *   POST /intelligence/dtc/parse      — Parse raw scanner report text
 *   POST /intelligence/dtc/diagnose   — Generate diagnosis from DTC codes
 *   POST /intelligence/dtc/parse-file  — Parse uploaded scanner report file
 *
 * @param app - Fastify instance
 */
export async function dtcRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /intelligence/dtc/parse ─────────────────
  /**
   * POST /intelligence/dtc/parse
   *
   * Parses a raw text report from a Launch X431 or Thinkcar scanner.
   * Accepts the full report text and returns structured DTC data.
   *
   * Request body:
   *   { "reportText": "...", "scannerBrand": "Launch X431" }
   *
   * Response: { "report": ScanReport }
   *
   * RAM discipline: text reports are typically < 100KB.
   * For larger reports, the parser uses a line-by-line generator.
   */
  app.post<{
    Body: ParseDtcRequest;
    Reply: ParseDtcResponse;
  }>(
    "/intelligence/dtc/parse",
    {
      schema: {
        body: {
          type: "object",
          required: ["reportText"],
          properties: {
            reportText: { type: "string", minLength: 1 },
            scannerBrand: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ParseDtcRequest }>, reply: FastifyReply) => {
      const { reportText, scannerBrand } = request.body;

      if (!reportText || reportText.trim().length === 0) {
        throw new BadRequestError("reportText must be a non-empty string");
      }

      const report = await parseReport(reportText, scannerBrand ?? null);

      return reply.status(200).send({ report });
    },
  );

  // ─── POST /intelligence/dtc/diagnose ──────────────
  /**
   * POST /intelligence/dtc/diagnose
   *
   * Generates a structured automatic diagnosis from a set of DTC codes.
   * Uses the OpenCode diagnostic engine to analyze codes against the
   * built-in DTC database and generates findings, root cause analysis,
   * and repair recommendations in Spanish.
   *
   * Request body:
   *   {
   *     "codes": ["P0171", "P0300"],
   *     "brand": "Toyota",
   *     "model": "Corolla",
   *     "engineType": "Nafta",
   *     "customerComplaint": "El motor tiembla en ralentí"
   *   }
   *
   * Response: { "diagnosis": DiagnosticResult }
   */
  app.post<{
    Body: DiagnoseRequest;
    Reply: DiagnoseResponse;
  }>(
    "/intelligence/dtc/diagnose",
    {
      schema: {
        body: {
          type: "object",
          required: ["codes", "brand", "model"],
          properties: {
            codes: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
            brand: { type: "string", minLength: 1 },
            model: { type: "string", minLength: 1 },
            engineType: { type: "string", nullable: true },
            customerComplaint: { type: "string", nullable: true },
            vehicleHistory: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: DiagnoseRequest }>, reply: FastifyReply) => {
      const { codes, brand, model, engineType, customerComplaint } = request.body;

      if (!codes || codes.length === 0) {
        throw new BadRequestError("codes must be a non-empty array of DTC strings");
      }

      // Normalize codes
      const normalized = codes
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[PBCU][0-9][0-9A-F]{3}$/.test(c));

      if (normalized.length === 0) {
        throw new BadRequestError("No valid DTC codes provided. Expected format: P0171, U0100, etc.");
      }

      const diagnosis = await generateDiagnosisFromCodes(
        normalized,
        brand,
        model,
        engineType ?? null,
        customerComplaint ?? null,
      );

      return reply.status(200).send({ diagnosis });
    },
  );

  // ─── POST /intelligence/dtc/parse-file ────────────
  /**
   * POST /intelligence/dtc/parse-file
   *
   * Parses an uploaded scanner report file. Supports .txt, .log, and .csv
   * file formats from Launch/Thinkcar scanners.
   *
   * RAM discipline: files are read into a buffer. Max file size: 1MB.
   * For larger files, use the async OCR endpoint instead.
   *
   * Request: multipart/form-data with field "file"
   * Response: { "report": ScanReport }
   */
  app.post(
    "/intelligence/dtc/parse-file",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Check if the multipart plugin is available
      const isMultipart = typeof (request as any).file !== "undefined";

      if (!isMultipart) {
        // Fallback: accept raw body as text
        const body = request.body as any;
        const text = body?.file ?? body?.text ?? "";
        if (!text || typeof text !== "string") {
          throw new BadRequestError(
            "Send file as multipart/form-data (field: 'file') or raw text body",
          );
        }
        const report = await parseReport(text);
        return reply.status(200).send({ report });
      }

      // ─── Multipart handling (registered via @fastify/multipart) ──
      try {
        const { loadMultipart } = await import("../utils/multipart-loader.js");
        const { file } = await loadMultipart(request);

        if (!file || !file.file) {
          throw new BadRequestError("No file uploaded. Use field name 'file'.");
        }

        // Read file content as string
        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
          chunks.push(chunk as Buffer);
          // Safety limit: 1MB for text files
          if (Buffer.byteLength(Buffer.concat(chunks)) > 1024 * 1024) {
            throw new BadRequestError("File too large. Maximum size: 1MB for text reports.");
          }
        }

        const content = Buffer.concat(chunks).toString("utf-8");

        if (!content.trim()) {
          throw new BadRequestError("Uploaded file is empty");
        }

        const report = await parseReportFromBuffer(content);

        return reply.status(200).send({ report });
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        throw new BadRequestError(
          `Failed to parse uploaded file: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );
}
