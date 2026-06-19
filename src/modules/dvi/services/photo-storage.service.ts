/**
 * DVI Photo Storage Service — Upload/download via Supabase Storage.
 *
 * Handles photo upload to Supabase Storage with tenant isolation.
 * Path structure: {tenant_slug}/{inspection_id}/{photo_id}.{ext}
 *
 * @module dvi/services/photo-storage.service
 */

import { getSupabaseAdmin } from "../../../shared/database/supabase.js";

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
 * Uploads a DVI photo to Supabase Storage.
 *
 * @param params.tenantSlug - Tenant identifier (used as folder prefix)
 * @param params.inspectionId - DVI inspection ID
 * @param params.photoId - Unique photo ID (UUID)
 * @param params.fileBuffer - File content as Buffer
 * @param params.contentType - MIME type of the file
 * @param params.filename - Original filename
 * @returns Upload result with public URL
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
  const cleanedBuffer = stripExifMetadata(fileBuffer, contentType);

  const supabase = getSupabaseAdmin();

  // Build storage path: {tenant}/{inspection}/{photo_id}.{ext}
  const ext = filename.split(".").pop() || "jpg";
  const storagePath = `${tenantSlug}/${inspectionId}/${photoId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, cleanedBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Error subiendo foto: ${error.message}`);
  }

  // Get signed URL (expires in 1 hour)
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600);

  if (urlError) {
    throw new Error(`Error generando URL: ${urlError.message}`);
  }

  return {
    url: urlData.signedUrl,
    path: storagePath,
    size: cleanedBuffer.length,
    contentType,
  };
}

// ─── EXIF Stripping ───────────────────────────

/**
 * Sprint 57: Strips EXIF metadata from image buffers.
 * Prevents leakage of GPS coordinates, timestamps, and device info.
 *
 * For JPEG: Removes APP1 (EXIF) marker segment.
 * For PNG: Removes tEXt/iTXt/zTXt chunks containing metadata.
 * For WEBP/HEIC: Returns buffer as-is (EXIF handled differently).
 *
 * @param buffer - Original image buffer
 * @param contentType - MIME type of the image
 * @returns Cleaned buffer without EXIF metadata
 */
function stripExifMetadata(buffer: Buffer, contentType: string): Buffer {
  if (contentType === "image/jpeg") {
    return stripJpegExif(buffer);
  }
  if (contentType === "image/png") {
    return stripPngMetadata(buffer);
  }
  // WEBP and HEIC: EXIF stripping requires native libraries (sharp/libheif)
  // For now, return as-is. TODO: Integrate sharp for production.
  return buffer;
}

/**
 * Strips EXIF data from JPEG buffer by removing APP1 marker segment.
 *
 * JPEG structure: FF D8 (SOI) → FF E1 (APP1/EXIF) → ... → FF DA (SOS)
 * We remove everything between SOI and the first non-APP1 marker.
 */
function stripJpegExif(buffer: Buffer): Buffer {
  // JPEG must start with FF D8
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;

  let offset = 2; // Skip SOI marker

  // Scan for markers
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    // APP1 marker (0xE1) = EXIF data — skip it
    if (marker === 0xe1) {
      const segmentLength = (buffer[offset + 2] << 8) | buffer[offset + 3];
      const segmentEnd = offset + 2 + segmentLength;
      // Remove this segment: keep bytes before offset and after segmentEnd
      const before = buffer.subarray(0, offset);
      const after = buffer.subarray(segmentEnd);
      return Buffer.concat([before, after]);
    }

    // SOS marker (0xDA) — start of scan, stop looking
    if (marker === 0xda) break;

    // Other markers — skip them
    const segmentLength = (buffer[offset + 2] << 8) | buffer[offset + 3];
    offset += 2 + segmentLength;
  }

  return buffer;
}

/**
 * Strips metadata chunks from PNG buffer.
 * Removes tEXt, iTXt, zTXt chunks (which contain EXIF, comments, etc.).
 */
function stripPngMetadata(buffer: Buffer): Buffer {
  // PNG must start with 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return buffer;

  // PNG chunks: 4 bytes length + 4 bytes type + data + 4 bytes CRC
  const METADATA_CHUNKS = ["tEXt", "iTXt", "zTXt", "gAMA", "sRGB", "iCCP"];
  const result: Buffer[] = [];
  let offset = 8; // Skip PNG signature

  while (offset < buffer.length - 12) {
    const chunkLength = (buffer[offset] << 24) | (buffer[offset + 1] << 16) |
                        (buffer[offset + 2] << 8) | buffer[offset + 3];
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");

    if (METADATA_CHUNKS.includes(chunkType)) {
      // Skip this metadata chunk (length + type + data + CRC)
      offset += 12 + chunkLength;
    } else {
      // Keep this chunk (IHDR, IDAT, IEND, etc.)
      const chunkEnd = offset + 12 + chunkLength;
      result.push(buffer.subarray(offset, chunkEnd));
      offset = chunkEnd;
    }
  }

  return result.length > 0 ? Buffer.concat(result) : buffer;
}

// ─── Download ─────────────────────────────────

/**
 * Downloads a DVI photo from Supabase Storage.
 *
 * @param path - Storage path of the photo
 * @returns File buffer and metadata
 */
export async function downloadPhoto(path: string): Promise<{
  buffer: Buffer;
  contentType: string;
  size: number;
}> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);

  if (error) {
    throw new Error(`Error descargando foto: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: data.type || "image/jpeg",
    size: arrayBuffer.byteLength,
  };
}

// ─── Delete ───────────────────────────────────

/**
 * Deletes a DVI photo from Supabase Storage.
 *
 * @param path - Storage path of the photo
 * @returns Deletion result
 */
export async function deletePhoto(path: string): Promise<PhotoDeleteResult> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`Error eliminando foto: ${error.message}`);
  }

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
  const supabase = getSupabaseAdmin();
  const prefix = `${tenantSlug}/${inspectionId}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(prefix);

  if (error) {
    throw new Error(`Error listando fotos: ${error.message}`);
  }

  return (data || []).map(file => ({
    name: file.name,
    path: `${prefix}/${file.name}`,
    size: file.metadata?.size || 0,
    createdAt: file.created_at || "",
  }));
}

// ─── Signed URL ───────────────────────────────

/**
 * Gets a signed URL for viewing a photo (expires in 1 hour).
 *
 * @param path - Storage path
 * @returns Signed URL
 */
export async function getSignedUrl(path: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 3600);

  if (error) {
    throw new Error(`Error generando URL firmada: ${error.message}`);
  }

  return data.signedUrl;
}
