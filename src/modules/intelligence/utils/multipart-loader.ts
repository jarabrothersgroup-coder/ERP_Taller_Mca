/**
 * Multipart File Upload Loader.
 *
 * Thin wrapper around @fastify/multipart for handling file uploads
 * in the Intelligence module. This is loaded dynamically to avoid
 * crashing if the plugin is not registered.
 *
 * RAM discipline: files are streamed through chunks; only the
 * caller decides when to buffer (small files) or stream (large files).
 *
 * @module intelligence/utils/multipart-loader
 */

import type { FastifyRequest } from "fastify";

/**
 * Result of loading a multipart upload.
 */
export interface MultipartLoadResult {
  /** Text fields from the form */
  fields: Record<string, string>;
  /** The uploaded file (first file found) */
  file: {
    /** Field name in the form */
    fieldname: string;
    /** Original filename */
    filename: string;
    /** MIME type */
    mimetype: string;
    /** Readable stream of file content */
    file: NodeJS.ReadableStream;
  } | null;
}

/**
 * Processes a multipart request and extracts the file and fields.
 *
 * Uses @fastify/multipart's `request.file()` or `request.files()` API.
 * If the plugin is not available, throws a descriptive error.
 *
 * @param request - Fastify request with multipart content
 * @returns Fields and file from the upload
 */
export async function loadMultipart(
  request: FastifyRequest,
): Promise<MultipartLoadResult> {
  const fields: Record<string, string> = {};

  // Check if @fastify/multipart is available
  const mp = (request as any).server?.hasContentTypeParser?.("multipart/form-data");

  if (!mp) {
    // Try to use the raw request
    throw new Error(
      "multipart parser not available. Ensure @fastify/multipart is registered.",
    );
  }

  try {
    // Use the multipart plugin's file iterator API
    const files = (request as any).files?.();

    if (!files) {
      // Fallback: try single file API
      const file = await (request as any).file();
      if (file) {
        return {
          fields,
          file: {
            fieldname: file.fieldname,
            filename: file.filename,
            mimetype: file.mimetype,
            file: file.file,
          },
        };
      }
      return { fields, file: null };
    }

    // Iterate over all files
    let firstFile: MultipartLoadResult["file"] = null;

    for await (const part of files) {
      if (part.type === "file" && !firstFile) {
        firstFile = {
          fieldname: part.fieldname,
          filename: part.filename,
          mimetype: part.mimetype,
          file: part.file,
        };
      } else if (part.type === "field") {
        fields[part.fieldname] = part.value;
      }
    }

    return { fields, file: firstFile };
  } catch (err) {
    throw new Error(
      `Multipart processing error: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}
