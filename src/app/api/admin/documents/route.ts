/**
 * POST /api/admin/documents
 *
 * Staff-side document upload endpoint. Allows ADMIN and ASSESSOR role users to
 * upload documents on behalf of applicants, bypassing the lead-applicant
 * ownership check that applies to the public /api/documents route.
 *
 * Accepts multipart/form-data with:
 *   - file          (File)   — PDF, JPEG, or PNG, max 20 MB
 *   - applicationId (string) — target application UUID
 *   - slot          (string) — document slot identifier (e.g. BIRTH_CERTIFICATE)
 *
 * Returns the created Document record on success (201).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireApplicationAccess } from "@/lib/auth/roles";
import { Role } from "@prisma/client";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { uploadDocument } from "@/lib/storage/documents";
import { sniffContentType } from "@/lib/storage/sniff";
import { createAuditLog } from "@/lib/audit/log";
import {
  DIGEST_SAMPLE_BYTES,
  computeContentDigest,
} from "@/lib/documents/content-digest";

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import {
  ACCEPTED_MIME,
  MAX_SIZE_MB,
  MAX_SIZE_BYTES,
  isWordDocument,
  UNSUPPORTED_TYPE_MESSAGE,
  WORD_DOCUMENT_MESSAGE,
} from "@/lib/uploads/accepted-types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth: staff (ADMIN or ASSESSOR) only ─────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== Role.ADMIN && user.role !== Role.ASSESSOR) {
    return NextResponse.json(
      { error: "Forbidden — staff role required" },
      { status: 403 }
    );
  }

  // ── Parse multipart form data ───────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const applicationId = formData.get("applicationId");
  const slot = formData.get("slot");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (typeof applicationId !== "string" || !applicationId.trim()) {
    return NextResponse.json(
      { error: "applicationId is required" },
      { status: 400 }
    );
  }
  if (typeof slot !== "string" || !slot.trim()) {
    return NextResponse.json({ error: "slot is required" }, { status: 400 });
  }

  // ── File validation ────────────────────────────────────────────────────────
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large — maximum ${MAX_SIZE_MB} MB` },
      { status: 422 }
    );
  }
  // Word (item 14, Story 14.2): checked BEFORE the generic allowlist rejection
  // so staff get the specific convert-to-PDF guidance rather than the generic
  // message. Defence-in-depth backstop to admin-upload.tsx's client-side check.
  if (isWordDocument(file.name, file.type)) {
    return NextResponse.json({ error: WORD_DOCUMENT_MESSAGE }, { status: 422 });
  }
  if (!ACCEPTED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: UNSUPPORTED_TYPE_MESSAGE },
      { status: 422 }
    );
  }

  // ── Magic-byte sniff: reject files whose contents don't match the claimed
  //    MIME type. Defends against client-spoofed Content-Type headers. ───────
  //
  // F9 — this read is 64 KB rather than 8 bytes so the SAME bytes serve the
  // sniff and the content digest below. The sniff only ever looks at the first
  // few bytes, so the larger slice costs it nothing, and reading once means the
  // two can never disagree about what they inspected. `DIGEST_SAMPLE_BYTES` is
  // exactly what the presigned confirm leg reads over its Range request, which
  // is what makes the two paths' digests comparable.
  const headerBuf = Buffer.from(
    await file.slice(0, DIGEST_SAMPLE_BYTES).arrayBuffer()
  );
  const { contentType: verifiedContentType } = sniffContentType(headerBuf);
  if (!verifiedContentType) {
    // Catches e.g. a Word file renamed to .pdf with a spoofed Content-Type —
    // isWordDocument() above can't detect that case. Surfaced as the same
    // shared generic message so staff still learn the accepted formats.
    return NextResponse.json(
      { error: UNSUPPORTED_TYPE_MESSAGE },
      { status: 422 }
    );
  }
  if (verifiedContentType !== file.type) {
    return NextResponse.json(
      { error: "File contents do not match the declared type" },
      { status: 422 }
    );
  }

  // ── Verify application exists ─────────────────────────────────────────────
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findUnique({
        where: { id: applicationId },
        select: { id: true, reference: true },
      })
  );

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }

  // ── Application access check (finding 2.12): ADMIN passes trivially,
  //    ASSESSOR must be assigned to the application. Redirects on failure. ───
  await requireApplicationAccess(user, applicationId);

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const { storagePath, error: storageError } = await uploadDocument(
    file,
    applicationId,
    slot,
    verifiedContentType
  );

  if (storageError || !storagePath) {
    return NextResponse.json(
      { error: storageError ?? "Storage upload failed" },
      { status: 500 }
    );
  }

  // ── Content digest (F9) ───────────────────────────────────────────────────
  // Staff uploads used to store NULL here, because D2 computed the digest in
  // the presigned confirm endpoint only. That left the duplicate check blind on
  // one path in both directions: a staff upload was never compared against
  // anything, and — the half that actually bites — an APPLICANT's later upload
  // could not be recognised as a duplicate of a document an assessor had
  // already uploaded for them. CF-28 is exactly that shape (one file used to
  // satisfy three monthly UC slots), so a blind spot on either path weakens it.
  //
  // Same function, same sample size and the same authoritative byte length as
  // the confirm leg, so a digest computed here is directly comparable with one
  // computed there. `file.size` is the multipart part's length, which is what
  // gets stored.
  const contentDigest = computeContentDigest(headerBuf, file.size);

  // ── Create Prisma Document record + audit log ─────────────────────────────
  try {
    const document = await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const doc = await tx.document.create({
          data: {
            applicationId,
            slot,
            filename: file.name,
            mimeType: verifiedContentType,
            fileSize: file.size,
            storagePath,
            uploadedBy: user.id,
            contentDigest,
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
            contentDigest: true,
          },
        });

        await createAuditLog(tx, {
          userId: user.id,
          action: AUDIT_ACTIONS.DOCUMENT_UPLOADED_BY_ASSESSOR,
          entityType: AUDIT_ENTITY_TYPES.Document,
          entityId: doc.id,
          context: `Staff uploaded document on the applicant's behalf for slot: ${slot}`,
          metadata: {
            applicationId,
            reference: application.reference,
            slot,
            filename: file.name,
            fileSize: file.size,
            mimeType: verifiedContentType,
          },
        });

        return doc;
      }
    );

    return NextResponse.json(document, { status: 201 });
  } catch (err) {
    console.error("[admin/documents POST] DB error after storage upload:", err);
    return NextResponse.json(
      { error: "Failed to record document. Please try again." },
      { status: 500 }
    );
  }
}
