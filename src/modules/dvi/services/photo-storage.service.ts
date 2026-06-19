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

  // Validate
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`Tipo de archivo no permitido: ${contentType}`);
  }
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`Archivo excede el límite de ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const supabase = getSupabaseAdmin();

  // Build storage path: {tenant}/{inspection}/{photo_id}.{ext}
  const ext = filename.split(".").pop() || "jpg";
  const storagePath = `${tenantSlug}/${inspectionId}/${photoId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
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
    size: fileBuffer.length,
    contentType,
  };
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
