/**
 * POST /api/documents/confirm — step 3 of 3 of the presigned upload flow (A1).
 *
 * Accepts `{ uploadTicket }` — the HMAC-signed ticket `/api/documents/sign`
 * issued — and, once the client has PUT the bytes straight to Supabase Storage,
 * turns that object into a `Document` row. Returns today's `UploadedDocument`
 * shape, so the client contract is unchanged from the old multipart route.
 *
 * **This is where the magic-byte sniff lives now.** Moving the bytes off the
 * API route must not lose the security property that motivated the sniff in the
 * first place (docs/security-audit.md §2.10 — a standing requirement): the
 * uploaded object is read back and inspected before any Document row exists, so
 * a file whose contents do not match its declared type is deleted from Storage
 * and rejected with 415. Only the leading bytes are fetched (a Range request) —
 * pulling whole 20 MB files back into the route would defeat the point of the
 * presigned transport.
 *
 * The checks, in order, each of which deletes the orphaned object on failure:
 *   1. Ticket signature + expiry + subject — the client cannot name an
 *      arbitrary storage path, MIME or namespace.
 *   2. Auth + contributor resolution, re-run from scratch. Authorisation is
 *      never inherited from the ticket.
 *   3. Stored byte length ≤ MAX_SIZE_BYTES — the sign leg could only see a
 *      *declared* size; this is the authoritative one.
 *   4. Stored Content-Type equals the declared MIME. The direct PUT lets the
 *      client set this header, and `/api/documents/[id]/url` serves documents
 *      inline by default, so a spoofed Content-Type is exactly the masquerade
 *      the sniff exists to stop.
 *   5. Magic-byte sniff of the leading bytes, which must match the declared
 *      MIME.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import {
  deleteDocument,
  getStoredObjectInfo,
  readObjectHead,
} from "@/lib/storage/documents";
import { sniffContentType } from "@/lib/storage/sniff";
import { authorizeDocumentUpload } from "@/lib/documents/upload-authorization";
import { verifyUploadTicket } from "@/lib/uploads/upload-ticket";
import { logError } from "@/lib/log";
import {
  MAX_SIZE_BYTES,
  FILE_TOO_LARGE_MESSAGE,
  UNSUPPORTED_TYPE_MESSAGE,
} from "@/lib/uploads/accepted-types";

/**
 * Best-effort cleanup of an object that failed verification. Never throws — a
 * failed delete must not turn a clean 415 into a 500, it just leaves an
 * unreferenced object behind for storage lifecycle rules to reap.
 */
async function discardOrphan(storagePath: string): Promise<void> {
  try {
    await deleteDocument(storagePath);
  } catch (err) {
    logError("documents/confirm:orphan-cleanup", err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { uploadTicket?: unknown };
  try {
    body = (await request.json()) as { uploadTicket?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── 1. Ticket ───────────────────────────────────────────────────────────────
  const verified = verifyUploadTicket(body?.uploadTicket);
  if (!verified.ok) {
    return NextResponse.json(
      {
        error:
          verified.reason === "expired"
            ? "This upload took too long to complete. Please try again."
            : "Invalid upload ticket",
      },
      { status: verified.reason === "expired" ? 410 : 400 }
    );
  }

  const claims = verified.claims;

  // The ticket is an integrity mechanism, not an authorisation one: it must
  // belong to the caller presenting it.
  if (claims.sub !== user.id) {
    await discardOrphan(claims.storagePath);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 2. Re-run authorisation from scratch ───────────────────────────────────
  // The application may have been submitted, or the contributor row revoked,
  // between sign and confirm. Nothing is inherited from the ticket.
  const auth = await authorizeDocumentUpload(user, claims.applicationId);
  if (!auth.ok) {
    await discardOrphan(claims.storagePath);
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.namespace !== claims.ns) {
    // The caller's contributor role changed since signing; the object sits in
    // the wrong namespace for who they are now.
    await discardOrphan(claims.storagePath);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 3+4. Stored object metadata ────────────────────────────────────────────
  const info = await getStoredObjectInfo(claims.storagePath);
  if (info.error) {
    return NextResponse.json(
      { error: "Upload not found. Please try again." },
      { status: 404 }
    );
  }

  if (info.size !== null && info.size > MAX_SIZE_BYTES) {
    await discardOrphan(claims.storagePath);
    return NextResponse.json({ error: FILE_TOO_LARGE_MESSAGE }, { status: 413 });
  }

  if (info.contentType !== null && info.contentType !== claims.mime) {
    // The client PUT a different Content-Type than it declared and we
    // allowlisted. Since documents are served inline by default, a stored
    // `text/html` labelled at sign time as `application/pdf` would be a stored
    // XSS — reject it outright rather than repairing it.
    await discardOrphan(claims.storagePath);
    return NextResponse.json(
      { error: UNSUPPORTED_TYPE_MESSAGE },
      { status: 415 }
    );
  }

  // ── 5. Magic-byte sniff (docs/security-audit.md §2.10) ─────────────────────
  const { bytes, error: readError } = await readObjectHead(claims.storagePath);
  if (readError || !bytes) {
    logError("documents/confirm:read-head", readError ?? "No bytes returned");
    await discardOrphan(claims.storagePath);
    return NextResponse.json(
      { error: "Could not verify the uploaded file. Please try again." },
      { status: 500 }
    );
  }

  const { contentType: verifiedContentType } = sniffContentType(bytes);
  if (!verifiedContentType || verifiedContentType !== claims.mime) {
    // Catches e.g. a Word file renamed to .pdf with a spoofed Content-Type —
    // `isWordDocument()` in the sign leg can't detect that case (nothing about
    // the filename/declared MIME looks like Word), so it falls through to here.
    // Surfaced as the same shared generic message so the parent still learns
    // the accepted formats (item 14, Story 14.1's last acceptance criterion).
    await discardOrphan(claims.storagePath);
    return NextResponse.json(
      { error: UNSUPPORTED_TYPE_MESSAGE },
      { status: 415 }
    );
  }

  // ── Create Prisma Document record ──────────────────────────────────────────
  try {
    const document = await withUserContext(
      user.id,
      user.role as RlsRole,
      (tx) =>
        tx.document.create({
          data: {
            applicationId: claims.applicationId,
            slot: claims.slot,
            filename: claims.filename,
            mimeType: verifiedContentType,
            fileSize: info.size ?? bytes.length,
            storagePath: claims.storagePath,
            uploadedBy: user.id,
            uploadedByContributorId: auth.contributorId,
          },
          select: {
            id: true,
            applicationId: true,
            slot: true,
            filename: true,
            mimeType: true,
            fileSize: true,
            storagePath: true,
            isVerified: true,
            uploadedBy: true,
            uploadedAt: true,
          },
        })
    );

    return NextResponse.json(document, { status: 201 });
  } catch (err) {
    // Roll back the storage object on DB failure — with the presigned flow the
    // bytes are already in the bucket, so nothing else would ever reap them.
    logError("documents/confirm", err);
    await discardOrphan(claims.storagePath);
    return NextResponse.json(
      { error: "Failed to record document. Please try again." },
      { status: 500 }
    );
  }
}
