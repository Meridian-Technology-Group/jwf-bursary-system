/**
 * Client-side upload transports for the portal FileUpload widget (A1).
 *
 * Lives outside the component so the two transports and — more importantly —
 * the error mapping can be tested directly, rather than only through a
 * rendered drop-zone.
 *
 * **Presigned** (the applicant portal) is three steps:
 *   1. `POST {signUrl}` — auth, contributor resolution and declared
 *      slot/MIME/size validation happen server-side; returns a single-use
 *      Supabase upload URL plus an HMAC-signed ticket.
 *   2. PUT the bytes straight to Supabase Storage. This is the whole point: the
 *      file never transits a Next.js route, so Vercel's ~4.5 MB request-body
 *      cap no longer holds uploads to a fifth of the advertised 20 MB (CF-14).
 *   3. `POST {confirmUrl}` — the server reads the stored bytes back, runs the
 *      magic-byte sniff (docs/security-audit.md §2.10) and creates the
 *      Document row.
 *
 * **Multipart** (staff edit-on-behalf, `/api/admin/documents`) is the original
 * single POST, unchanged and out of A1's scope.
 *
 * Both resolve to the same `UploadedDocument`, so callers cannot tell them
 * apart.
 */

import { FILE_TOO_LARGE_MESSAGE } from "@/lib/uploads/accepted-types";
import type { UploadEndpoints } from "@/components/portal/upload-endpoints";

/** The document shape both transports return — mirrors the confirm route's. */
export interface UploadedDocument {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedAt: string;
  applicationId: string;
  slot: string;
}

/**
 * Turns a failed response into the message the parent sees.
 *
 * 413 (payload too large) and 507 (insufficient storage) get plain copy no
 * matter which leg produced them — our own sign/confirm routes, or Supabase
 * Storage rejecting the direct PUT. Before A1 these surfaced as the opaque
 * string `Upload failed (413)`, which told a parent nothing about what to do
 * (CF-14). Everything else keeps the server's own message when it sends one.
 */
export async function uploadErrorFrom(
  response: Response,
  fallbackLabel: string
): Promise<Error> {
  if (response.status === 413 || response.status === 507) {
    return new Error(FILE_TOO_LARGE_MESSAGE);
  }
  // Our routes answer with `{ error }` and Supabase Storage with `{ message }`,
  // but never assume JSON at all — a proxy or gateway in front of either leg
  // may return HTML.
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  return new Error(
    body.error ?? body.message ?? `${fallbackLabel} (${response.status})`
  );
}

/** Uploads one file over whichever transport `endpoints` declares. */
export async function uploadFile(
  file: File,
  applicationId: string,
  slot: string,
  endpoints: UploadEndpoints
): Promise<UploadedDocument> {
  if (endpoints.transport.kind === "multipart") {
    return uploadFileMultipart(
      file,
      applicationId,
      slot,
      endpoints.transport.uploadUrl
    );
  }
  return uploadFilePresigned(
    file,
    applicationId,
    slot,
    endpoints.transport.signUrl,
    endpoints.transport.confirmUrl
  );
}

async function uploadFilePresigned(
  file: File,
  applicationId: string,
  slot: string,
  signUrl: string,
  confirmUrl: string
): Promise<UploadedDocument> {
  // ── 1. Sign ────────────────────────────────────────────────────────────────
  const signResponse = await fetch(signUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicationId,
      slot,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!signResponse.ok) {
    throw await uploadErrorFrom(signResponse, "Upload failed");
  }

  const { signedUrl, contentType, uploadTicket } =
    (await signResponse.json()) as {
      signedUrl: string;
      contentType: string;
      uploadTicket: string;
    };

  // ── 2. PUT the bytes straight to Supabase Storage ──────────────────────────
  // `contentType` is the server's echo of the MIME it allowlisted, not
  // `file.type` — the confirm leg rejects an object stored under any other
  // Content-Type, so sending the server's value is what keeps a legitimate
  // upload from being mistaken for a masquerade.
  const putResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "x-upsert": "false" },
    body: file,
  });

  if (!putResponse.ok) {
    throw await uploadErrorFrom(putResponse, "Upload failed");
  }

  // ── 3. Confirm — server-side content verification + Document row ───────────
  const confirmResponse = await fetch(confirmUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadTicket }),
  });

  if (!confirmResponse.ok) {
    throw await uploadErrorFrom(confirmResponse, "Upload failed");
  }

  return (await confirmResponse.json()) as UploadedDocument;
}

async function uploadFileMultipart(
  file: File,
  applicationId: string,
  slot: string,
  uploadUrl: string
): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("applicationId", applicationId);
  formData.append("slot", slot);

  const response = await fetch(uploadUrl, { method: "POST", body: formData });

  if (!response.ok) {
    throw await uploadErrorFrom(response, "Upload failed");
  }

  return (await response.json()) as UploadedDocument;
}
