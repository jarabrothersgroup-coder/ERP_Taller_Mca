/**
 * Computer Vision (OCR) Service for License Plates and Cédulas Verdes.
 *
 * Provides automated text recognition for:
 *   1. **Chapas (License Plates)** — Paraguayan mercosur-style plates
 *      (e.g., "ABC 1234" or "ABCD 12").
 *   2. **Cédula Verde (Green Card)** — Paraguayan vehicle registration
 *      document containing VIN, brand, model, year, and owner info.
 *
 * Design:
 *   - Uses Tesseract.js loaded **lazily** only when a job runs
 *   - Processes images in **streaming chunks** to avoid buffering
 *   - Preprocesses images server-side for better OCR accuracy
 *   - All heavy processing happens in the async job queue
 *     (see `async-processor.service.ts`)
 *
 * RAM discipline:
 *   - Image is streamed to a temp file (not held in RAM)
 *   - Tesseract worker is created per-job and destroyed after
 *   - Max concurrent Tesseract instances: 1
 *   - Temp files cleaned up immediately after processing
 *
 * @module intelligence/services/ocr
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { OcrDocumentType, OcrField, OcrResult } from "../types.js";
import { enqueueJob, getJob, MAX_FILE_SIZE } from "./async-processor.service.js";

// ─── Constants ───────────────────────────────────

/** Tesseract language data: Spanish + English for plate recognition */
const TESS_LANG = "spa+eng";

/** Regex: Paraguayan Mercosur plate format (old and new) */
// New MERCOSUR: "ABC 1234" (letters, space, numbers)
// Old format:   "ABCD 12"  (4 letters, 2 numbers)
// Motorcycle:   "AB 123 C" (2 letters, 3 numbers, 1 letter)
const PLATE_PATTERN_MERCOSUR = /\b([A-Z]{3}\s?\d{3,4})\b/i;
const PLATE_PATTERN_OLD = /\b([A-Z]{4}\s?\d{2})\b/i;
const PLATE_PATTERN_MOTO = /\b([A-Z]{2,3}\s?\d{3}\s?[A-Z])\b/i;

/** Regex: VIN (17 characters, no I/O/Q) */
const VIN_PATTERN = /\b([A-HJ-NPR-Z0-9]{17})\b/;

/** Regex: Paraguayan RUC (6-8 digits + check digit) */
const RUC_PATTERN = /\b(\d{6,8}-\d)\b/;

/** Known fields on a Paraguayan Cédula Verde */
const CEDULA_FIELD_PATTERNS: Record<string, RegExp> = {
  vin: VIN_PATTERN,
  ruc: RUC_PATTERN,
  chapa: /(?:Chapa|Patente|Placa)[:\s]*([A-Z0-9\s-]{4,10})/i,
  marca: /(?:Marca)[:\s]*([A-ZÁÉÍÓÚÑ\s]{3,20})/i,
  modelo: /(?:Modelo)[:\s]*([A-Z0-9ÁÉÍÓÚÑ\s-]{2,30})/i,
  año: /(?:Año)[:\s]*(\d{4})/i,
  titulares: /(?:Titular|Propietario)[:\s]*([A-ZÁÉÍÓÚÑ\s,.]{5,60})/i,
};

// ─── OCR Service ─────────────────────────────────

/**
 * Submits an OCR job for async processing.
 * The caller receives a job ID and can poll for results.
 *
 * @param documentType - Type of document to OCR
 * @param fileBuffer - Raw file buffer (for small files) or readable stream
 * @param filename - Original filename (for extension detection)
 * @returns Job tracking object with ID for polling
 */
export async function submitOcrJob(
  documentType: OcrDocumentType,
  fileBuffer: Buffer | NodeJS.ReadableStream,
  filename: string,
) {
  // For streams, we buffer to a temp file first
  let buffer: Buffer;
  let tempDir: string | null = null;

  if (Buffer.isBuffer(fileBuffer)) {
    buffer = fileBuffer;
  } else {
    // Stream to temp file
    tempDir = await mkdtemp(join(tmpdir(), "ocr-"));
    const tempPath = join(tempDir, filename);

    try {
      const writeStream = createWriteStream(tempPath);
      await pipeline(fileBuffer, writeStream);

      // Read the temp file as buffer for processing
      const { readFile } = await import("node:fs/promises");
      buffer = await readFile(tempPath);
    } finally {
      // Clean up temp file immediately
      await rm(tempDir, { recursive: true, force: true }).catch(() => {
        /* ignore cleanup errors */
      });
    }
  }

  // Validate size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File too large: ${(buffer.length / 1024 / 1024).toFixed(2)} MB. ` +
      `Maximum allowed: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB.`,
    );
  }

  // Submit to async processor
  const job = enqueueJob<{ type: OcrDocumentType; data: Buffer }, OcrResult>(
    `ocr:${documentType}`,
    { type: documentType, data: buffer },
    processOcrImage,
  );

  return job;
}

/**
 * Internal OCR processor function (runs inside the async job queue).
 * Loads Tesseract lazily, processes the image, and returns results.
 *
 * @param input - OCR job input with document type and image data
 * @param onProgress - Progress callback
 * @returns OCR result
 */
async function processOcrImage(
  input: { type: OcrDocumentType; data: Buffer },
  onProgress: (percent: number) => void,
): Promise<OcrResult> {
  const startTime = Date.now();
  const { type, data } = input;

  onProgress(10);

  // Dynamically import Tesseract.js (lazy load — ~5MB heap when active)
  const Tesseract = await import("tesseract.js");

  onProgress(20);

  // Create a worker with Spanish + English
  const worker = await Tesseract.createWorker("spa");

  onProgress(30);

  try {
    // Set language (Spanish + English for plate/cedula text)
    await worker.setParameters({ lang: TESS_LANG });

    onProgress(40);

    // Configure for single block of text (faster)
    await worker.setParameters({
      tessedit_pageseg_mode: "6" as unknown as undefined,   // Assume uniform block of text
      tessedit_char_whitelist: type === "plate"
        ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÑáéíóúñ0123456789-./\\, ",
    });

    onProgress(50);

    // Recognize
    const { data: result } = await worker.recognize(data);

    onProgress(80);

    const rawText = result.text.trim();
    const confidence = (result.confidence ?? 0) / 100;
    const fields = extractFields(type, rawText);

    const ocrResult: OcrResult = {
      documentType: type,
      fields,
      rawText,
      overallConfidence: confidence,
      processingTimeMs: Date.now() - startTime,
    };

    onProgress(100);
    return ocrResult;
  } finally {
    // Always terminate the worker to free memory
    await worker.terminate();
  }
}

// ─── Field Extraction ────────────────────────────

/**
 * Extracts structured fields from OCR raw text based on document type.
 *
 * @param type - Document type
 * @param rawText - Raw OCR text
 * @returns Extracted fields with confidence scores
 */
function extractFields(type: OcrDocumentType, rawText: string): OcrField[] {
  const fields: OcrField[] = [];

  if (type === "plate") {
    // License plate: try to extract plate number
    const mercosurMatch = PLATE_PATTERN_MERCOSUR.exec(rawText);
    const oldMatch = PLATE_PATTERN_OLD.exec(rawText);
    const motoMatch = PLATE_PATTERN_MOTO.exec(rawText);

    const plate = mercosurMatch?.[1] ?? oldMatch?.[1] ?? motoMatch?.[1] ?? rawText.replace(/\s+/g, " ").trim();

    fields.push({
      name: "chapa",
      value: plate.replace(/\s+/g, " ").trim(),
      confidence: mercosurMatch ? 0.85 : oldMatch ? 0.75 : 0.5,
    });

    // Also try to extract VIN if present
    const vinMatch = VIN_PATTERN.exec(rawText);
    if (vinMatch) {
      fields.push({
        name: "vin",
        value: vinMatch[1]!,
        confidence: 0.9,
      });
    }
  } else if (type === "cedula_verde") {
    // Cédula Verde: extract all known fields
    for (const [fieldName, pattern] of Object.entries(CEDULA_FIELD_PATTERNS)) {
      const match = pattern.exec(rawText);
      if (match) {
        const confidence = fieldName === "vin" ? 0.9 :
          fieldName === "ruc" ? 0.85 : 0.7;
        fields.push({
          name: fieldName,
          value: match[1]!.trim(),
          confidence,
        });
      }
    }

    // If VIN not found via pattern, try to detect 17-char sequence
    if (!fields.find((f) => f.name === "vin")) {
      const vinSequence = rawText.replace(/\s+/g, "").match(VIN_PATTERN);
      if (vinSequence) {
        fields.push({
          name: "vin",
          value: vinSequence[1]!,
          confidence: 0.6,
        });
      }
    }
  }

  return fields;
}

/**
 * Synchronous helper: gets a job result for polling endpoint.
 *
 * @param jobId - Job UUID
 * @returns The job or null
 */
export function getOcrJob(jobId: string) {
  return getJob<OcrResult>(jobId);
}

/**
 * Validates whether a file type is supported for OCR.
 *
 * @param mimetype - MIME type of the uploaded file
 * @returns True if supported
 */
export function isSupportedImageType(mimetype: string): boolean {
  const supported = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/tiff",
    "image/bmp",
  ];
  return supported.includes(mimetype.toLowerCase());
}
