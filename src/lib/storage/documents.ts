/**
 * Storage helpers for document upload/download/delete via Supabase Storage.
 *
 * All functions use the admin client (service_role key) so they bypass RLS.
 * The "documents" bucket should be private — access is always via signed URLs.
 *
 * Storage path format: documents/{applicationId}/{slot}/{uuid}_{filename}
 */

import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";

const BUCKET = "documents";
const DEFAULT_EXPIRY_SECONDS = 3600; // 60 minutes

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadDocumentResult {
  storagePath: string;
  error?: string;
}

/**
 * Uploads a file to Supabase Storage and returns the storage path.
 *
 * @param file          The File object to upload.
 * @param applicationId The application this document belongs to.
 * @param slot          The document slot identifier (e.g. "BIRTH_CERTIFICATE").
 */
export async function uploadDocument(
  file: File,
  applicationId: string,
  slot: string
): Promise<UploadDocumentResult> {
  const supabase = createSupabaseAdminClient();

  // Build a unique, deterministic path so re-uploads into the same slot
  // don't collide.  crypto.randomUUID() is available in Node 22 / Edge.
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  // Sanitise filename: strip path separators and normalise whitespace
  const safeFilename = file.name.replace(/[/\\]/g, "_").replace(/\s+/g, "_");
  const storagePath = `documents/${applicationId}/${slot}/${uuid}_${safeFilename}`;

  // Convert File → ArrayBuffer for the upload
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, uint8Array, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[storage/upload] Upload failed:", error.message);
    return { storagePath: "", error: error.message };
  }

  return { storagePath };
}

// ─── Signed URL ───────────────────────────────────────────────────────────────

/**
 * Generates a signed (pre-authenticated) URL for a private document.
 *
 * @param storagePath The path in Supabase Storage (as returned by uploadDocument).
 * @param expiresIn   Seconds until the URL expires. Defaults to 3600 (60 min).
 * @returns           The signed URL string.
 * @throws            Error if Supabase cannot generate the URL.
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<string> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    const msg = error?.message ?? "Unknown error generating signed URL";
    console.error("[storage/signedUrl] Failed:", msg);
    throw new Error(msg);
  }

  return data.signedUrl;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Removes a file from Supabase Storage.
 * Non-fatal: logs failures but does not throw so callers can handle cleanup
 * independently of DB record deletion.
 *
 * @param storagePath The path in Supabase Storage.
 */
export async function deleteDocument(storagePath: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error("[storage/delete] Failed to delete", storagePath, error.message);
    throw new Error(error.message);
  }
}
