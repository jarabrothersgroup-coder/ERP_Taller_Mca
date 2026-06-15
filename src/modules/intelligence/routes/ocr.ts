/**
 * Computer Vision (OCR) Routes.
 *
 * Endpoints for automated text recognition of Paraguayan
 * license plates (chapas) and Cédulas Verdes (vehicle green cards).
 *
 * All heavy image processing is delegated to the async job queue
 * to keep the request-response cycle fast and RAM under 50MB.
 *
 * @module intelligence/routes/ocr
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  submitOcrJob,
  getOcrJob,
  isSupportedImageType,
} from "../services/ocr.service.js";
import { MAX_FILE_SIZE } from "../services/async-processor.service.js";
import type { OcrDocumentType, OcrJobPollResponse, OcrJobResponse } from "../types.js";
import { BadRequestError, NotFoundError } from "../../../shared/errors/app-error.js";

/**
 * Registers OCR-related routes under the `/intelligence/ocr` prefix.
 *
 * Routes:
 *   POST /intelligence/ocr/plate      — Submit license plate for OCR
 *   POST /intelligence/ocr/cedula     — Submit Cédula Verde for OCR
 *   GET  /intelligence/ocr/jobs/:id   — Poll job status / get result
 *
 * @param app - Fastify instance
 */
export async function ocrRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /intelligence/ocr/plate ────────────────
  /**
   * POST /intelligence/ocr/plate
   *
   * Submits an image of a Paraguayan license plate (chapa) for
   * optical character recognition. The image is processed asynchronously.
   *
   * Supported formats: JPEG, PNG, WebP, TIFF, BMP
   * Max file size: 10 MB
   * Max dimensions: 4096px on any side (images are resized server-side)
   *
   * Request: multipart/form-data with field "image"
   * Response: { "jobId": "...", "status": "queued", "pollUrl": ".../jobs/:id" }
   *
   * The client should poll the returned pollUrl until status changes
   * to "completed" or "failed".
   */
  app.post(
    "/intelligence/ocr/plate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return handleOcrUpload(request, reply, "plate");
    },
  );

  // ─── POST /intelligence/ocr/cedula ───────────────
  /**
   * POST /intelligence/ocr/cedula
   *
   * Submits an image of a Paraguayan Cédula Verde (vehicle green card)
   * for optical character recognition. The image is processed asynchronously.
   *
   * Extracts: VIN, chapa (plate), marca, modelo, año, titular, RUC
   *
   * Request: multipart/form-data with field "image"
   * Response: { "jobId": "...", "status": "queued", "pollUrl": ".../jobs/:id" }
   */
  app.post(
    "/intelligence/ocr/cedula",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return handleOcrUpload(request, reply, "cedula_verde");
    },
  );

  // ─── GET /intelligence/ocr/jobs/:id ──────────────
  /**
   * GET /intelligence/ocr/jobs/:id
   *
   * Polls the status of an OCR job. Returns the current job state
   * and the OCR result when completed.
   *
   * Response:
   *   - When queued/processing: { id, status: "queued"|"processing", progress }
   *   - When completed:         { id, status: "completed", result: OcrResult }
   *   - When failed:            { id, status: "failed", error: "..." }
   *
   * RAM discipline: job result is released after 30 minutes (see processor cleanup).
   */
  app.get<{
    Params: { id: string };
    Reply: OcrJobPollResponse | { error: string; message: string };
  }>(
    "/intelligence/ocr/jobs/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      if (!id || typeof id !== "string") {
        throw new BadRequestError("Job ID is required");
      }

      const job = getOcrJob(id);

      if (!job) {
        throw new NotFoundError(`OCR job not found: ${id}. Jobs expire after 30 minutes.`);
      }

      return reply.status(200).send(job);
    },
  );
}

// ─── Shared Upload Handler ────────────────────────

/**
 * Handles OCR image upload for both plate and cedula endpoints.
 *
 * Extracts the file from the multipart request, validates it,
 * and submits an async OCR job. If @fastify/multipart is not
 * registered, falls back to base64 encoding.
 *
 * RAM discipline: the file is streamed directly to the OCR
 * processor without being fully buffered in the request handler.
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @param docType - Document type to process
 */
async function handleOcrUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  docType: OcrDocumentType,
): Promise<void> {
  const contentType = request.headers["content-type"] ?? "";

  // ─── Multipart Upload ──────────────────────────
  if (contentType.includes("multipart/form-data")) {
    try {
      const { loadMultipart } = await import("../utils/multipart-loader.js");
      const { file } = await loadMultipart(request);

      if (!file || !file.file) {
        throw new BadRequestError("No image file uploaded. Use field name 'image'.");
      }

      const { filename, mimetype } = file;

      // Validate MIME type
      if (!isSupportedImageType(mimetype)) {
        throw new BadRequestError(
          `Unsupported image type: ${mimetype}. ` +
          `Supported types: JPEG, PNG, WebP, TIFF, BMP`,
        );
      }

      // Validate filename extension
      const ext = filename?.split(".").pop()?.toLowerCase();
      const allowedExts = ["jpg", "jpeg", "png", "webp", "tiff", "tif", "bmp"];
      if (ext && !allowedExts.includes(ext)) {
        throw new BadRequestError(
          `Unsupported file extension: .${ext}. Use: ${allowedExts.join(", ")}`,
        );
      }

      // Submit job with stream (processor handles buffering)
      const job = await submitOcrJob(docType, file.file, filename ?? "upload");

      const response: OcrJobResponse = {
        jobId: job.id,
        status: job.status,
        pollUrl: `/intelligence/ocr/jobs/${job.id}`,
      };

      return reply.status(202).send(response);
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      if (err instanceof Error && err.message.includes("multipart")) {
        throw new BadRequestError(
          "File upload error. Ensure @fastify/multipart is registered.",
        );
      }
      throw new BadRequestError(
        `Failed to process upload: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  // ─── Base64 Upload ─────────────────────────────
  // Fallback: accept base64-encoded image in JSON body
  const body = request.body as Record<string, unknown>;
  const base64Image = body?.image as string | undefined;
  const filename = (body?.filename as string) ?? "upload.png";

  if (!base64Image) {
    throw new BadRequestError(
      "Send image as multipart/form-data (field 'image') or " +
      "as JSON with base64-encoded 'image' field.",
    );
  }

  // Decode base64 to buffer
  let imageBuffer: Buffer;
  try {
    const raw = base64Image.replace(/^data:image\/\w+;base64,/, "");
    imageBuffer = Buffer.from(raw, "base64");
  } catch {
    throw new BadRequestError("Invalid base64 image data.");
  }

  if (imageBuffer.length === 0) {
    throw new BadRequestError("Image data is empty.");
  }

  if (imageBuffer.length > MAX_FILE_SIZE) {
    throw new BadRequestError(
      `Image too large: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB. ` +
      `Maximum: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB.`,
    );
  }

  const job = await submitOcrJob(docType, imageBuffer, filename);

  const response: OcrJobResponse = {
    jobId: job.id,
    status: job.status,
    pollUrl: `/intelligence/ocr/jobs/${job.id}`,
  };

  return reply.status(202).send(response);
}
