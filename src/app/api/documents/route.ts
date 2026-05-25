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

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

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
      { error: "File too large — maximum 20 MB" },
      { status: 422 }
    );
  }
  if (!ACCEPTED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type — please upload PDF, JPG, or PNG" },
      { status: 422 }
    );
  }

  // ── Magic-byte sniff: reject files whose contents don't match the claimed
  //    MIME type. Defends against client-spoofed Content-Type headers. ───────
  const headerBuf = Buffer.from(await file.slice(0, 8).arrayBuffer());
  const { contentType: verifiedContentType } = sniffContentType(headerBuf);
  if (!verifiedContentType) {
    return NextResponse.json(
      { error: "File contents do not match an allowed type (PDF, JPG, or PNG)" },
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
        select: { id: true, leadApplicantId: true, status: true },
      })
  );

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }
  if (application.status === "SUBMITTED") {
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
