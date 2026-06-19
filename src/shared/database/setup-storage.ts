/**
 * Supabase Storage Setup — DVI Photos Bucket + RLS Policies.
 *
 * Run this script to create the storage bucket and policies:
 *   npx tsx src/shared/database/setup-storage.ts
 *
 * Creates:
 *   - Bucket: dvi-photos (private, 10MB limit, image types only)
 *   - Policies: tenant-isolated read/write via RLS
 *
 * @module shared/database/setup-storage
 */

import { getSupabaseAdmin } from "./supabase.js";

const BUCKET_NAME = "dvi-photos";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function setupStorage(): Promise<void> {
  const supabase = getSupabaseAdmin();

  console.log("[Storage] Setting up Supabase Storage...");

  // ── Create bucket ──
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("[Storage] Error listing buckets:", listError.message);
    return;
  }

  const existing = buckets?.find(b => b.name === BUCKET_NAME);
  if (existing) {
    console.log(`[Storage] Bucket '${BUCKET_NAME}' already exists`);
  } else {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });

    if (createError) {
      console.error("[Storage] Error creating bucket:", createError.message);
      return;
    }
    console.log(`[Storage] Bucket '${BUCKET_NAME}' created`);
  }

  // ── RLS Policies ──
  // Note: Supabase Storage policies are managed via the dashboard or SQL.
  // The following SQL can be run in the Supabase SQL Editor:

  const policies = `
-- Allow authenticated users to upload to their tenant folder
CREATE POLICY "tenant_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = '${BUCKET_NAME}'
    AND (storage.foldername(name))[1] = current_setting('request.jwt.claims', true)::json->>'tenant'
  );

-- Allow authenticated users to read their tenant's files
CREATE POLICY "tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = '${BUCKET_NAME}'
    AND (storage.foldername(name))[1] = current_setting('request.jwt.claims', true)::json->>'tenant'
  );

-- Allow authenticated users to delete their tenant's files
CREATE POLICY "tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = '${BUCKET_NAME}'
    AND (storage.foldername(name))[1] = current_setting('request.jwt.claims', true)::json->>'tenant'
  );
`;

  console.log("[Storage] RLS Policies SQL (run in Supabase SQL Editor):");
  console.log(policies);
  console.log("[Storage] Setup complete");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupStorage().catch(console.error);
}
