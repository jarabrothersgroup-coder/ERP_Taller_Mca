/**
 * Trabajo Tercero Adjuntos Service — upload/list/delete invoices from suppliers.
 *
 * Handles file uploads for third-party job invoices (proveedor invoices).
 * Path structure: {tenant_slug}/trabajos-terceros/{trabajo_id}/{adjunto_id}.{ext}
 *
 * @module workshop/services/trabajo-tercero-adjunto
 */

import {
  uploadFile,
  deleteFile,
  listFiles,
  getFileUrl,
} from "../../../shared/storage/local-storage.js";

// ─── Types ──

export interface AdjuntoUploadResult {
  url: string;
  path: string;
  size: number;
  contentType: string;
  filename: string;
}

export interface AdjuntoListItem {
  name: string;
  path: string;
  size: number;
}

// ─── Configuration ──

const BUCKET_NAME = "trabajo-tercero-adjuntos";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ─── Upload ──

export async function uploadAdjunto(
  trabajoId: string,
  tenantSlug: string,
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
): Promise<AdjuntoUploadResult> {
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`Tipo de archivo no permitido: ${contentType}`);
  }

  const ext = filename.split(".").pop() || "bin";
  const adjuntoId = crypto.randomUUID();
  const path = `${tenantSlug}/trabajos-terceros/${trabajoId}/${adjuntoId}.${ext}`;

  await uploadFile({ bucket: BUCKET_NAME, path, data: fileBuffer, contentType });

  return {
    url: getFileUrl(BUCKET_NAME, path),
    path,
    size: fileBuffer.length,
    contentType,
    filename,
  };
}

// ─── List ──

export async function listAdjuntos(
  trabajoId: string,
  tenantSlug: string,
): Promise<AdjuntoListItem[]> {
  const prefix = `${tenantSlug}/trabajos-terceros/${trabajoId}/`;
  return listFiles(BUCKET_NAME, prefix);
}

// ─── Delete ──

export async function deleteAdjunto(
  trabajoId: string,
  adjuntoPath: string,
  tenantSlug: string,
): Promise<{ deleted: boolean }> {
  const expectedPrefix = `${tenantSlug}/trabajos-terceros/${trabajoId}/`;
  if (!adjuntoPath.startsWith(expectedPrefix)) {
    throw new Error("Ruta de adjunto inválida");
  }
  await deleteFile(BUCKET_NAME, adjuntoPath);
  return { deleted: true };
}
