/**
 * POST /api/documents
 *
 * Accepts a multipart/form-data request with:
 *   - file          (File)
 *   - applicationId (string)
 *   - slot          (string)
 *
 * Server-side validation → Supabase Storage upload → Prisma Document record.
 * Returns the created Document on success.
 *
 * Contributor-aware authorization (dual-parent, PR 4b):
 *   - The lead applicant (PRIMARY contributor) uploads to the legacy
 *     `documents/{appId}/{slot}/...` namespace; the document is tagged with
 *     their PRIMARY contributor id.
 *   - A SECONDARY contributor uploads to `documents/{appId}/secondary/{slot}/...`
 *     and the document is tagged with their SECONDARY contributor id, so the
 *     route handlers (the enforcing layer) can later isolate it from the
 *     primary. The role is RESOLVED server-side from the session — never trusted
 *     from the request — and an applicant who is neither contributor is rejected.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, withAdminContext, type RlsRole } from "@/lib/db/prisma";
import { uploadDocument } from "@/lib/storage/documents";
import { sniffContentType } from "@/lib/storage/sniff";
import { ensurePrimaryContributor } from "@/lib/db/queries/contributors";
import { logError } from "@/lib/log";
import { ApplicationContributorRole } from "@prisma/client";
import {
  ACCEPTED_MIME,
  MAX_SIZE_MB,
  MAX_SIZE_BYTES,
  isWordDocument,
  UNSUPPORTED_TYPE_MESSAGE,
  WORD_DOCUMENT_MESSAGE,
} from "@/lib/uploads/accepted-types";

const SECONDARY_NAMESPACE = "secondary";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  // so the parent gets the specific convert-to-PDF guidance rather than the
  // generic message. This is a defence-in-depth backstop to the client-side
  // check in file-upload.tsx — the authoritative one for this endpoint.
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
  const headerBuf = Buffer.from(await file.slice(0, 8).arrayBuffer());
  const { contentType: verifiedContentType } = sniffContentType(headerBuf);
  if (!verifiedContentType) {
    // Catches e.g. a Word file renamed to .pdf with a spoofed Content-Type —
    // isWordDocument() above can't detect that case (nothing about the
    // filename/declared MIME looks like Word), so it falls through to here.
    // Surfaced as the same shared generic message so the parent still learns
    // the accepted formats (item 14, Story 14.1's last acceptance criterion).
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

  // ── Authorization: resolve the caller's contributor role on this application ─
  // The application is fetched (status guard + existence). Whether the caller is
  // the PRIMARY (lead) or the SECONDARY contributor is resolved server-side from
  // their contributor row; an applicant who is neither is forbidden. This is the
  // enforcing layer — the storage RLS namespace is only a backstop.
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findUnique({
        where: { id: applicationId },
        select: { id: true, leadApplicantId: true, formStatus: true },
      })
  );

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }
  // PR-6a: the submission guard reads form_status, not the deprecated fused
  // applications.status.
  if (application.formStatus === "SUBMITTED") {
    return NextResponse.json(
      { error: "Cannot upload documents to a submitted application" },
      { status: 409 }
    );
  }

  const isLeadApplicant = application.leadApplicantId === user.id;

  // Resolve which contributor the caller owns (PRIMARY for the lead applicant;
  // SECONDARY for the second parent). Under RLS the caller may SELECT their own
  // contributor row.
  const contributor = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.applicationContributor.findUnique({
        where: {
          applicationId_profileId: { applicationId, profileId: user.id },
        },
        select: { id: true, role: true },
      })
  );

  const isSecondary =
    contributor?.role === ApplicationContributorRole.SECONDARY;

  if (!isLeadApplicant && !isSecondary) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Determine the owning contributor id + storage namespace. The contributor
  // row resolved above (keyed on applicationId+profileId) IS the caller's own
  // row — their PRIMARY row for the lead applicant, their SECONDARY row for the
  // second parent.
  let uploadedByContributorId: string | null = contributor?.id ?? null;
  if (isLeadApplicant && !uploadedByContributorId) {
    // Self-heal the (should-be-impossible) missing PRIMARY contributor under
    // admin context — the applicant cannot upsert the contributor row by policy.
    uploadedByContributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, applicationId, user.id)
    );
  }

  const subNamespace = isSecondary ? SECONDARY_NAMESPACE : undefined;

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const { storagePath, error: storageError } = await uploadDocument(
    file,
    applicationId,
    slot,
    { verifiedContentType, subNamespace }
  );

  if (storageError || !storagePath) {
    return NextResponse.json(
      { error: storageError ?? "Storage upload failed" },
      { status: 500 }
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
            applicationId,
            slot,
            filename: file.name,
            mimeType: verifiedContentType,
            fileSize: file.size,
            storagePath,
            uploadedBy: user.id,
            uploadedByContributorId,
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
    // Roll back storage upload on DB failure
    logError("documents/POST", err);
    return NextResponse.json(
      { error: "Failed to record document. Please try again." },
      { status: 500 }
    );
  }
}
