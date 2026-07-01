/**
 * Local Filesystem Storage — Replaces Supabase Storage.
 *
 * Provides upload/download/delete/list operations for files
 * on the local filesystem. Designed for on-premise deployment
 * with low disk I/O overhead.
 *
 * Storage structure: {STORAGE_PATH}/{bucket}/{path}
 *
 * @module shared/storage/local-storage
 */

import { readFile, writeFile, mkdir, readdir, unlink, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";

const STORAGE_ROOT = resolve(process.env["STORAGE_PATH"] || "/data/erp-storage");

// ─── Types ────────────────────────────────────

export interface StorageResult {
  path: string;
  size: number;
  contentType: string;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
}

// ─── MIME Detection ───────────────────────────

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  pdf: "application/pdf",
  csv: "text/csv",
  json: "application/json",
};

function detectContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME_MAP[ext] || "application/octet-stream";
}

// ─── Path Security ────────────────────────────

/**
 * Validates that a resolved path is within the storage root.
 * Prevents path traversal attacks (e.g., ../../etc/passwd).
 */
function assertSafePath(path: string): string {
  const resolved = resolve(STORAGE_ROOT, path);
  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error(`Path traversal detected: ${path}`);
  }
  return resolved;
}

// ─── Upload ───────────────────────────────────

/**
 * Upload a file to local filesystem storage.
 *
 * @param params.bucket - Storage bucket (e.g., "dvi-photos")
 * @param params.path - Relative path within the bucket
 * @param params.data - File content as Buffer
 * @param params.contentType - MIME type
 * @returns Storage result with path and size
 */
export async function uploadFile(params: {
  bucket: string;
  path: string;
  data: Buffer;
  contentType: string;
}): Promise<StorageResult> {
  const fullPath = assertSafePath(join(params.bucket, params.path));

  // Ensure parent directory exists
  await mkdir(dirname(fullPath), { recursive: true });

  // Write file
  await writeFile(fullPath, params.data);

  return {
    path: params.path,
    size: params.data.length,
    contentType: params.contentType,
  };
}

// ─── Download ─────────────────────────────────

/**
 * Download a file from local filesystem storage.
 *
 * @param bucket - Storage bucket
 * @param path - Relative path within the bucket
 * @returns File buffer and metadata
 */
export async function downloadFile(
  bucket: string,
  path: string,
): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  const fullPath = assertSafePath(join(bucket, path));

  const buffer = await readFile(fullPath);
  const stats = await stat(fullPath);

  return {
    buffer,
    contentType: detectContentType(path),
    size: stats.size,
  };
}

// ─── Delete ───────────────────────────────────

/**
 * Delete a file from local filesystem storage.
 *
 * @param bucket - Storage bucket
 * @param path - Relative path within the bucket
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const fullPath = assertSafePath(join(bucket, path));
  await unlink(fullPath);
}

// ─── List ─────────────────────────────────────

/**
 * List files in a directory within the storage bucket.
 *
 * @param bucket - Storage bucket
 * @param prefix - Directory prefix to list
 * @returns Array of file metadata
 */
export async function listFiles(
  bucket: string,
  prefix: string,
): Promise<FileInfo[]> {
  const dirPath = assertSafePath(join(bucket, prefix));

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    const files: FileInfo[] = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = join(dirPath, entry.name);
        const stats = await stat(filePath);
        files.push({
          name: entry.name,
          path: `${prefix}/${entry.name}`,
          size: stats.size,
        });
      }
    }

    return files;
  } catch (err: unknown) {
    // Directory doesn't exist yet — return empty list
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

// ─── URL Generation ──────────────────────────

/**
 * Generate a URL for accessing a stored file.
 *
 * For local storage, this returns a relative path that
 * the ERP's Fastify storage plugin serves directly.
 *
 * @param bucket - Storage bucket
 * @param path - Relative path within the bucket
 * @returns URL string (relative to ERP base)
 */
export function getFileUrl(bucket: string, path: string): string {
  return `/storage/${bucket}/${path}`;
}

/**
 * Validate that a file exists in storage.
 *
 * @param bucket - Storage bucket
 * @param path - Relative path within the bucket
 * @returns true if file exists
 */
export async function fileExists(bucket: string, path: string): Promise<boolean> {
  try {
    const fullPath = assertSafePath(join(bucket, path));
    await stat(fullPath);
    return true;
  } catch {
    return false;
  }
}
