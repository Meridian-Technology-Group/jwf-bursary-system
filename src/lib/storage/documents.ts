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

// ─── Bucket Initialisation ───────────────────────────────────────────────────

let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
  });
  // "already exists" is fine — any other error is a real problem
  if (error && !error.message.includes("already exists")) {
    console.error("[storage/ensureBucket] Failed:", error.message);
    throw new Error(error.message);
  }
  bucketReady = true;
}

// ─── Path construction ────────────────────────────────────────────────────────

/**
 * Builds the object key for a document upload.
 *
 * `documents/{applicationId}[/{subNamespace}]/{slot}/{uuid}_{safeFilename}`
 *
 * The `{uuid}_` prefix is what makes the (sanitised) filename safe to
 * interpolate: even a filename of `..` cannot escape the slot directory,
 * because the final segment is always `{uuid}_..` rather than `..`.
 *
 * Shared by {@link uploadDocument} (multipart, admin route) and
 * {@link uploadDocumentSigned} (presigned, applicant portal) so the two
 * transports can never drift into producing different paths.
 */
function buildStoragePath(
  filename: string,
  applicationId: string,
  slot: string,
  subNamespace?: string
): string {
  // Unique, so re-uploads into the same slot don't collide.
  // crypto.randomUUID() is available in Node 22 / Edge.
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  // Sanitise filename: strip path separators and normalise whitespace
  const safeFilename = filename.replace(/[/\\]/g, "_").replace(/\s+/g, "_");
  const prefix = subNamespace
    ? `documents/${applicationId}/${subNamespace}/${slot}`
    : `documents/${applicationId}/${slot}`;
  return `${prefix}/${uuid}_${safeFilename}`;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadDocumentResult {
  storagePath: string;
  error?: string;
}

export interface UploadDocumentOptions {
  /**
   * Server-verified MIME type (from magic-byte sniffing). When provided, this
   * is used as the Storage object's contentType instead of the client-supplied
   * `file.type`. See docs/security-audit.md §2.10.
   */
  verifiedContentType?: string;
  /**
   * Optional storage sub-namespace inserted between the applicationId and the
   * slot, e.g. "secondary" → `documents/{appId}/secondary/{slot}/...`. Used by
   * the dual-parent feature (PR 4b) to keep the SECONDARY contributor's files
   * under their own prefix so the storage-RLS backstop can isolate them. Must
   * contain no path separators (validated by the caller). When omitted the
   * path is the legacy `documents/{appId}/{slot}/...`.
   */
  subNamespace?: string;
}

/**
 * Uploads a file to Supabase Storage and returns the storage path.
 *
 * @param file          The File object to upload.
 * @param applicationId The application this document belongs to.
 * @param slot          The document slot identifier (e.g. "BIRTH_CERTIFICATE").
 * @param options       Verified MIME type and optional storage sub-namespace.
 *                      For backwards compatibility a bare string is accepted and
 *                      treated as `verifiedContentType`.
 */
export async function uploadDocument(
  file: File,
  applicationId: string,
  slot: string,
  options?: string | UploadDocumentOptions
): Promise<UploadDocumentResult> {
  const opts: UploadDocumentOptions =
    typeof options === "string" ? { verifiedContentType: options } : options ?? {};
  const { verifiedContentType, subNamespace } = opts;

  await ensureBucket();

  const supabase = createSupabaseAdminClient();

  const storagePath = buildStoragePath(file.name, applicationId, slot, subNamespace);

  // Convert File → ArrayBuffer for the upload
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, uint8Array, {
      contentType: verifiedContentType ?? file.type,
      upsert: false,
    });

  if (error) {
    console.error("[storage/upload] Upload failed:", error.message);
    return { storagePath: "", error: error.message };
  }

  return { storagePath };
}

// ─── Presigned direct-to-Storage upload (A1) ─────────────────────────────────

export interface SignedUploadTarget {
  /** The object key the client's PUT will land on. */
  storagePath: string;
  /** Absolute, single-use Supabase upload URL (token embedded). */
  signedUrl: string;
  /** The signed-upload token, exposed for `uploadToSignedUrl()`-style clients. */
  token: string;
}

export interface SignedUploadResult {
  target?: SignedUploadTarget;
  error?: string;
}

/**
 * Mints a single-use Supabase **signed upload URL** so the browser can PUT the
 * file bytes straight to Storage, bypassing the API route entirely.
 *
 * Why this exists (A1 / CF-14): Vercel caps a serverless request body at
 * ~4.5 MB, so any file above that 413s before our handler runs — while the app
 * advertises MAX_SIZE_MB (20 MB). No config fixes that; the bytes have to
 * stop transiting the route.
 *
 * The URL is minted with the service-role admin client and is single-use, so
 * the bucket stays private and **no storage RLS policy change is required**.
 * Authorisation is enforced by the caller (the /api/documents/sign route)
 * before this is ever reached.
 *
 * This does NOT verify the file's contents — the magic-byte sniff
 * (docs/security-audit.md §2.10) moves to /api/documents/confirm, which reads
 * the leading bytes back out of Storage and deletes the object on mismatch.
 *
 * @param filename      Client-supplied filename, sanitised here exactly as
 *                      {@link uploadDocument} sanitises it.
 * @param applicationId The application this document belongs to.
 * @param slot          The document slot identifier (validated by the caller).
 * @param options       Optional storage sub-namespace (see
 *                      {@link UploadDocumentOptions.subNamespace}).
 */
export async function uploadDocumentSigned(
  filename: string,
  applicationId: string,
  slot: string,
  options?: Pick<UploadDocumentOptions, "subNamespace">
): Promise<SignedUploadResult> {
  const { subNamespace } = options ?? {};

  await ensureBucket();

  const supabase = createSupabaseAdminClient();
  const storagePath = buildStoragePath(filename, applicationId, slot, subNamespace);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    const msg = error?.message ?? "Unknown error creating signed upload URL";
    console.error("[storage/signedUpload] Failed:", msg);
    return { error: msg };
  }

  return {
    target: { storagePath, signedUrl: data.signedUrl, token: data.token },
  };
}

export interface StoredObjectInfo {
  /** Byte length of the stored object, or null when Storage did not report it. */
  size: number | null;
  /** The object's stored Content-Type, parameters stripped and lower-cased. */
  contentType: string | null;
  error?: string;
}

/**
 * Reads an object's metadata (size + Content-Type) WITHOUT downloading it.
 *
 * Used by the confirm endpoint to enforce MAX_SIZE_BYTES against the
 * bytes actually stored (the sign step could only check a *declared* size) and
 * to detect a client that PUT a Content-Type other than the one it declared.
 */
export async function getStoredObjectInfo(
  storagePath: string
): Promise<StoredObjectInfo> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.storage.from(BUCKET).info(storagePath);

  if (error || !data) {
    const msg = error?.message ?? "Object not found";
    return { size: null, contentType: null, error: msg };
  }

  return {
    size: typeof data.size === "number" ? data.size : null,
    contentType: normaliseContentType(data.contentType),
  };
}

/**
 * Downloads only the LEADING bytes of a stored object, for the magic-byte
 * sniff. Deliberately a Range request — pulling a whole 20 MB file into the
 * route would reintroduce the memory/latency cost the presigned flow exists to
 * avoid.
 *
 * @param storagePath The object key.
 * @param byteCount   How many leading bytes to fetch (default 64; the longest
 *                    signature checked by `sniffContentType` is 8 bytes).
 */
export async function readObjectHead(
  storagePath: string,
  byteCount = 64
): Promise<{ bytes: Buffer | null; error?: string }> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error || !data?.signedUrl) {
    return {
      bytes: null,
      error: error?.message ?? "Could not sign a read URL for the upload",
    };
  }

  const response = await fetch(data.signedUrl, {
    headers: { Range: `bytes=0-${byteCount - 1}` },
  });

  // 206 is the expected Range response; 200 means the server ignored Range and
  // returned the whole (small) object, which is still fine to sniff.
  if (!response.ok) {
    return { bytes: null, error: `Storage read failed (${response.status})` };
  }

  const buf = Buffer.from(await response.arrayBuffer());
  return { bytes: buf.subarray(0, byteCount) };
}

/** Strips `; charset=…` parameters and lower-cases, for content-type equality. */
export function normaliseContentType(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const base = value.split(";")[0]?.trim().toLowerCase();
  return base ? base : null;
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
