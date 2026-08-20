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
 *   6. Duplicate detection (CF-28, hardened for CG-09). The leading bytes read
 *      for the sniff are ALSO hashed — one Range request serves both — and the
 *      resulting digest is looked up against the other documents on the same
 *      application. On a UC slot a duplicate in another UC slot is refused
 *      (409, naming the clashing file); anywhere else it is stored and
 *      reported back as a non-blocking `duplicateWarning`. Rows that predate
 *      the digest column (or came via the staff multipart path) carry a NULL
 *      digest that equality can never match, so on the UC path they are
 *      digested on the fly and healed in place before the decision is made.
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
import {
  DIGEST_SAMPLE_BYTES,
  computeContentDigest,
  duplicateUcMessage,
  duplicateWarningMessage,
  isUniversalCreditSlot,
} from "@/lib/documents/content-digest";
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
  const auth = await authorizeDocumentUpload(user, claims.applicationId, claims.slot);
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
  // One Range read, two consumers: the sniff below looks at the first few
  // bytes, and the CF-28 duplicate fingerprint hashes the whole sample. Asking
  // for DIGEST_SAMPLE_BYTES instead of the sniff's default 64 costs one 64 KB
  // request and saves ever downloading the object a second time.
  const { bytes, error: readError } = await readObjectHead(
    claims.storagePath,
    DIGEST_SAMPLE_BYTES
  );
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

  // ── 6. Duplicate detection (CF-28, hardened for CG-09) ─────────────────────
  // Fingerprint the bytes we already hold — see content-digest.ts for what the
  // digest covers and why it is a prefix hash rather than a whole-file one.
  const contentDigest = computeContentDigest(bytes, info.size);
  const uploadingToUcSlot = isUniversalCreditSlot(claims.slot);

  let duplicateWarning: string | null = null;
  // Refuse only when the same bytes are already sitting in ANOTHER Universal
  // Credit slot — the exact CF-28 case, where "3 monthly UC payments" was
  // satisfied with one file uploaded three times and the assessor is left
  // with a single month. Re-uploading into the SAME slot is a replace, and a
  // repeat outside the UC slots is plausible enough (one letter that genuinely
  // evidences two lines) that blocking it would punish honest applicants, so
  // both fall through to the warning below.
  let ucDuplicate: { slot: string; filename: string } | null = null;
  try {
    // Scoped to THIS application by the query itself (and by RLS): a digest is
    // never compared across families.
    const matches = await withUserContext(
      user.id,
      user.role as RlsRole,
      (tx) =>
        tx.document.findMany({
          where: { applicationId: claims.applicationId, contentDigest },
          select: { id: true, slot: true, filename: true },
          orderBy: { uploadedAt: "asc" },
          take: 10,
        })
    );

    ucDuplicate =
      (uploadingToUcSlot
        ? matches.find(
            (m) => m.slot !== claims.slot && isUniversalCreditSlot(m.slot)
          )
        : null) ?? null;

    // CG-09 — a digest-equality lookup can never see documents whose
    // content_digest is NULL, and every row created before CF-28 shipped (or
    // via the staff multipart path) is exactly that. Charlotte's 16 Aug repro:
    // "Dec 2025 UC.pdf" sat undigested in the legacy UC_MONTHLY slot, so
    // re-uploading the same file into UC_MONTHLY_2 sailed through. Heal those
    // rows now: an application holds at most a handful of UC documents, so
    // this is a few 64 KB Range reads once — after which the digests are
    // persisted and this branch never runs again for them.
    if (uploadingToUcSlot && !ucDuplicate) {
      const undigested = await withUserContext(
        user.id,
        user.role as RlsRole,
        (tx) =>
          tx.document.findMany({
            where: {
              applicationId: claims.applicationId,
              contentDigest: null,
              slot: { startsWith: "UC_", not: claims.slot },
            },
            select: {
              id: true,
              slot: true,
              filename: true,
              storagePath: true,
              fileSize: true,
            },
            orderBy: { uploadedAt: "asc" },
            take: 20,
          })
      );

      for (const legacy of undigested) {
        const head = await readObjectHead(
          legacy.storagePath,
          DIGEST_SAMPLE_BYTES
        );
        if (head.error || !head.bytes) {
          // Unreadable object — leave the row unhealed rather than failing
          // the whole upload over someone else's stale document.
          logError(
            "documents/confirm:legacy-digest-read",
            head.error ?? "No bytes returned"
          );
          continue;
        }
        const legacyDigest = computeContentDigest(head.bytes, legacy.fileSize);
        await withUserContext(user.id, user.role as RlsRole, (tx) =>
          tx.document.update({
            where: { id: legacy.id },
            data: { contentDigest: legacyDigest },
          })
        );
        if (!ucDuplicate && legacyDigest === contentDigest) {
          ucDuplicate = legacy;
        }
      }
    }

    if (matches.length > 0) {
      duplicateWarning = duplicateWarningMessage(matches[0].filename);
    }
  } catch (err) {
    logError("documents/confirm:duplicate-lookup", err);
    if (uploadingToUcSlot) {
      // On the UC slots the duplicate check is a GATE (CG-09), not a
      // convenience — silently accepting when the lookup fails is precisely
      // the acceptance Charlotte reported. Fail closed; the applicant retries.
      await discardOrphan(claims.storagePath);
      return NextResponse.json(
        { error: "Could not verify the uploaded file. Please try again." },
        { status: 500 }
      );
    }
    // Outside the UC slots duplicate detection stays a convenience: the upload
    // completes (with the digest stored, so a later upload can still be
    // matched against it).
  }

  if (ucDuplicate) {
    await discardOrphan(claims.storagePath);
    return NextResponse.json(
      {
        error: duplicateUcMessage(ucDuplicate.filename),
        duplicateOf: {
          slot: ucDuplicate.slot,
          filename: ucDuplicate.filename,
        },
      },
      { status: 409 }
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
            contentDigest,
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

    // `duplicateWarning` is additive and null on the happy path, so the client
    // contract is unchanged for every caller that ignores it.
    return NextResponse.json({ ...document, duplicateWarning }, { status: 201 });
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
