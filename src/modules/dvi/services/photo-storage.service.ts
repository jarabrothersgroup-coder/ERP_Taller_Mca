/**
 * DVI Photo Storage Service — Upload/download via local filesystem.
 *
 * Handles photo upload with tenant isolation.
 * Path structure: {tenant_slug}/{inspection_id}/{photo_id}.{ext}
 *
 * Replaces Supabase Storage with local filesystem storage.
 *
 * @module dvi/services/photo-storage.service
 */

import {
  uploadFile,
  downloadFile,
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

// ─── Configuration ────────────────────────────

const BUCKET_NAME = "dvi-photos";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

// ─── Magic Byte Validation ────────────────────

/**
 * File magic bytes for validating actual file type (prevents MIME spoofing).
 * CRITICAL SECURITY: Always validate magic bytes, never trust client-provided contentType.
 */
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png":  [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header (bytes 0-3)
  // HEIC starts with ftyp at offset 4
};

/**
 * Validates that file buffer starts with expected magic bytes for the declared MIME type.
 * Prevents upload of executable files disguised as images.
 *
 * @param buffer - File content buffer
 * @param declaredType - MIME type declared by client
 * @returns true if magic bytes match declared type
 */
function validateMagicBytes(buffer: Buffer, declaredType: string): boolean {
  if (buffer.length < 12) return false; // Need at least 12 bytes for full check

  const magicPatterns = MAGIC_BYTES[declaredType];
  if (!magicPatterns) return false;

  // Check primary magic bytes
  const primaryMatch = magicPatterns[0].every((byte, i) => buffer[i] === byte);
  if (primaryMatch) return true;

  // Special case: HEIC checks ftyp at offset 4
  if (declaredType === "image/heic") {
    const ftyp = buffer.slice(4, 8).toString("ascii");
    return ftyp === "ftyp";
  }

  // Special case: WEBP checks RIFF at 0 and WEBP at 8
  if (declaredType === "image/webp") {
    const riff = buffer.slice(0, 4).toString("ascii");
    const webp = buffer.slice(8, 12).toString("ascii");
    return riff === "RIFF" && webp === "WEBP";
  }

  return false;
}

// ─── Upload ───────────────────────────────────

/**
 * Uploads a DVI photo to local filesystem storage.
 *
 * @param params.tenantSlug - Tenant identifier (used as folder prefix)
 * @param params.inspectionId - DVI inspection ID
 * @param params.photoId - Unique photo ID (UUID)
 * @param params.fileBuffer - File content as Buffer
 * @param params.contentType - MIME type of the file
 * @param params.filename - Original filename
 * @returns Upload result with URL
 */
export async function uploadPhoto(params: {
  tenantSlug: string;
  inspectionId: string;
  photoId: string;
  fileBuffer: Buffer;
  contentType: string;
  filename: string;
}): Promise<PhotoUploadResult> {
  const { tenantSlug, inspectionId, photoId, fileBuffer, contentType, filename } = params;

  // Validate MIME type
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`Tipo de archivo no permitido: ${contentType}`);
  }
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`Archivo excede el límite de ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // CRITICAL SECURITY: Validate magic bytes (prevents MIME spoofing attacks)
  if (!validateMagicBytes(fileBuffer, contentType)) {
    throw new Error(`El archivo no coincide con el tipo declarado (${contentType}). Posible intento de upload malicioso.`);
  }

  // Sprint 57: Strip EXIF metadata to prevent location/timestamp leakage
  const cleanedBuffer = await stripExifMetadata(fileBuffer, contentType);

  // Build storage path: {tenant}/{inspection}/{photo_id}.{ext}
  const ext = filename.split(".").pop() || "jpg";
  const storagePath = `${tenantSlug}/${inspectionId}/${photoId}.${ext}`;

  await uploadFile({
    bucket: BUCKET_NAME,
    path: storagePath,
    data: cleanedBuffer,
    contentType,
  });

  return {
    url: getFileUrl(BUCKET_NAME, storagePath),
    path: storagePath,
    size: cleanedBuffer.length,
    contentType,
  };
}

// ─── EXIF Stripping ───────────────────────────

/**
 * Sprint 57+58: Strips EXIF metadata from image buffers.
 * Prevents leakage of GPS coordinates, timestamps, and device info.
 *
 * Uses `exif-be-gone` (zero-dependency) for all formats:
 *   - JPEG: Removes APP1 (EXIF), APP2 (FlashPix), APP12, APP13 (IPTC), COM
 *   - PNG: Removes tEXt, iTXt, zTXt, eXIf, dSIG chunks
 *   - WEBP: Removes EXIF and XMP RIFF chunks
 *   - HEIC/HEIF: Zeroes EXIF and XMP item data within ISOBMFF container
 *
 * @param buffer - Original image buffer
 * @param contentType - MIME type of the image
 * @returns Cleaned buffer without EXIF metadata
 */
async function stripExifMetadata(buffer: Buffer, contentType: string): Promise<Buffer> {
  // Only process image types that exif-be-gone supports
  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!supportedTypes.includes(contentType)) {
    return buffer;
  }

  try {
    return await stripExifWithLibrary(buffer);
  } catch (err) {
    // If library fails, return original buffer (don't reject upload)
    console.warn("[photo-storage] EXIF stripping failed, uploading original:", err);
    return buffer;
  }
}

/**
 * Strips EXIF metadata using exif-be-gone library.
 * Handles JPEG, PNG, WEBP, HEIC, GIF, TIFF, AVIF, PDF.
 *
 * @param buffer - Original image buffer
 * @returns Cleaned buffer
 */
function stripExifWithLibrary(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const readable = Readable.from(buffer);
    const transformer = new ExifTransformer();

    readable.pipe(transformer);

    transformer.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    transformer.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    transformer.on("error", (err: Error) => {
      reject(err);
    });
  });
}

// ─── Download ─────────────────────────────────

/**
 * Downloads a DVI photo from local filesystem storage.
 *
 * @param path - Storage path of the photo
 * @returns File buffer and metadata
 */
export async function downloadPhoto(path: string): Promise<{
  buffer: Buffer;
  contentType: string;
  size: number;
}> {
  return downloadFile(BUCKET_NAME, path);
}

// ─── Delete ───────────────────────────────────

/**
 * Deletes a DVI photo from local filesystem storage.
 *
 * @param path - Storage path of the photo
 * @returns Deletion result
 */
export async function deletePhoto(path: string): Promise<PhotoDeleteResult> {
  await deleteFile(BUCKET_NAME, path);
  return { deleted: true, path };
}

// ─── List ─────────────────────────────────────

/**
 * Lists all photos for an inspection.
 *
 * @param tenantSlug - Tenant identifier
 * @param inspectionId - DVI inspection ID
 * @returns Array of file metadata
 */
export async function listPhotos(
  tenantSlug: string,
  inspectionId: string,
): Promise<Array<{ name: string; path: string; size: number; createdAt: string }>> {
  const prefix = `${tenantSlug}/${inspectionId}`;
  const files = await listFiles(BUCKET_NAME, prefix);

  return files.map(file => ({
    name: file.name,
    path: file.path,
    size: file.size,
    createdAt: "",
  }));
}

// ─── Signed URL ───────────────────────────────

/**
 * Gets a URL for viewing a photo.
 * For local storage, returns the relative path served by the storage plugin.
 *
 * @param path - Storage path
 * @returns URL string
 */
export function getPhotoSignedUrl(path: string): string {
  return getFileUrl(BUCKET_NAME, path);
}

// Alias for backward compatibility with tests
export const getSignedUrl = getPhotoSignedUrl;
