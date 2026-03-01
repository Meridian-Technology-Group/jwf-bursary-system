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
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { uploadDocument } from "@/lib/storage/documents";

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

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

  // ── Ownership check: application must belong to the current user ───────────
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, leadApplicantId: true, status: true },
  });

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }
  if (application.leadApplicantId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (application.status === "SUBMITTED") {
    return NextResponse.json(
      { error: "Cannot upload documents to a submitted application" },
      { status: 409 }
    );
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const { storagePath, error: storageError } = await uploadDocument(
    file,
    applicationId,
    slot
  );

  if (storageError || !storagePath) {
    return NextResponse.json(
      { error: storageError ?? "Storage upload failed" },
      { status: 500 }
    );
  }

  // ── Create Prisma Document record ──────────────────────────────────────────
  try {
    const document = await prisma.document.create({
      data: {
        applicationId,
        slot,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        storagePath,
        uploadedBy: user.id,
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
    });

    return NextResponse.json(document, { status: 201 });
  } catch (err) {
    // Roll back storage upload on DB failure
    console.error("[documents/POST] DB error after storage upload:", err);
    return NextResponse.json(
      { error: "Failed to record document. Please try again." },
      { status: 500 }
    );
  }
}
