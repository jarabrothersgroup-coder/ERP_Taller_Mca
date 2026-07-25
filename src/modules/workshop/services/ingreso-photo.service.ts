/**
 * Ingreso Photo Service — Upload/download/list/delete reception photos.
 *
 * Handles vehicle photo uploads during check-in (ingreso) with
 * tenant isolation and security validation (magic bytes, EXIF stripping).
 * Path structure: {tenant_slug}/{ingreso_id}/{photo_id}.{ext}
 *
 * @module workshop/services/ingreso-photo
 */

import {
  uploadFile,
  deleteFile,
  listFiles,
  getFileUrl,
} from "../../../shared/storage/local-storage.js";
import ExifTransformer from "exif-be-gone";
import { Readable } from "node:stream";

// ─── Types ────────────────────────────────────

export interface PhotoUploadResult {
  url: string;
  path: string;
  size: number;
  contentType: string;
}

export interface PhotoDeleteResult {
  deleted: boolean;
  path: string;
}

export interface PhotoListItem {
  name: string;
  path: string;
  size: number;
}

// ─── Configuration ────────────────────────────

const BUCKET_NAME = "ingreso-photos";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ─── Magic Byte Validation ────────────────────

const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

/**
 * Validates file magic bytes against declared MIME type.
 * Prevents upload of executables disguised as images.
 */
function validateMagicBytes(buffer: Buffer, declaredType: string): boolean {
  if (buffer.length < 12) return false;
  const patterns = MAGIC_BYTES[declaredType];
  if (!patterns) return false;

  const primaryMatch = patterns[0].every((byte, i) => buffer[i] === byte);
  if (primaryMatch) return true;

  if (declaredType === "image/webp") {
    const riff = buffer.slice(0, 4).toString("ascii");
    const webp = buffer.slice(8, 12).toString("ascii");
    return riff === "RIFF" && webp === "WEBP";
  }

  return false;
}

// ─── EXIF Stripping ───────────────────────────

/**
 * Strips EXIF metadata to prevent GPS/timestamp leakage.
 * Uses exif-be-gone for JPEG, PNG, WEBP.
 */
async function stripExifMetadata(buffer: Buffer, contentType: string): Promise<Buffer> {
  const supported = ["image/jpeg", "image/png", "image/webp"];
  if (!supported.includes(contentType)) return buffer;

  try {
    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const readable = Readable.from(buffer);
      const transformer = new ExifTransformer();
      readable.pipe(transformer);
      transformer.on("data", (chunk: Buffer) => chunks.push(chunk));
      transformer.on("end", () => resolve(Buffer.concat(chunks)));
      transformer.on("error", reject);
    });
  } catch {
    return buffer;
  }
}

// ─── Upload ───────────────────────────────────

/**
 * Upload a reception photo to local filesystem storage.
 *
 * @param params.tenantSlug - Tenant identifier
 * @param params.ingresoId - Ingreso (check-in) UUID
 * @param params.photoId - Unique photo UUID
 * @param params.fileBuffer - Image content
 * @param params.contentType - MIME type
 * @param params.filename - Original filename
 */
export async function uploadIngresoPhoto(params: {
  tenantSlug: string;
  ingresoId: string;
  photoId: string;
  fileBuffer: Buffer;
  contentType: string;
  filename: string;
}): Promise<PhotoUploadResult> {
  const { tenantSlug, ingresoId, photoId, fileBuffer, contentType, filename } = params;

  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`Tipo de archivo no permitido: ${contentType}`);
  }
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`Archivo excede el límite de ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  if (!validateMagicBytes(fileBuffer, contentType)) {
    throw new Error(
      `El archivo no coincide con el tipo declarado (${contentType}).`,
    );
  }

  const cleaned = await stripExifMetadata(fileBuffer, contentType);
  const ext = filename.split(".").pop() || "jpg";
  const storagePath = `${tenantSlug}/${ingresoId}/${photoId}.${ext}`;

  await uploadFile({
    bucket: BUCKET_NAME,
    path: storagePath,
    data: cleaned,
    contentType,
  });

  return {
    url: getFileUrl(BUCKET_NAME, storagePath),
    path: storagePath,
    size: cleaned.length,
    contentType,
  };
}

// ─── List ─────────────────────────────────────

/**
 * List all reception photos for an ingreso.
 */
export async function listIngresoPhotos(
  tenantSlug: string,
  ingresoId: string,
): Promise<PhotoListItem[]> {
  const prefix = `${tenantSlug}/${ingresoId}`;
  const files = await listFiles(BUCKET_NAME, prefix);
  return files.map((f) => ({ name: f.name, path: f.path, size: f.size }));
}

// ─── Delete ───────────────────────────────────

/**
 * Delete a reception photo.
 */
export async function deleteIngresoPhoto(
  path: string,
): Promise<PhotoDeleteResult> {
  await deleteFile(BUCKET_NAME, path);
  return { deleted: true, path };
}

// ─── URL ──────────────────────────────────────

/**
 * Get the URL for a stored photo.
 */
export function getIngresoPhotoUrl(path: string): string {
  return getFileUrl(BUCKET_NAME, path);
}
