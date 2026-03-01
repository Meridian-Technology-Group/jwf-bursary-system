/**
 * POST /api/admin/documents
 *
 * Assessor-side document upload endpoint. Allows ASSESSOR role users to upload
 * documents on behalf of applicants, bypassing the lead-applicant ownership
 * check that applies to the public /api/documents route.
 *
 * Accepts multipart/form-data with:
 *   - file          (File)   — PDF, JPEG, or PNG, max 20 MB
 *   - applicationId (string) — target application UUID
 *   - slot          (string) — document slot identifier (e.g. BIRTH_CERTIFICATE)
 *
 * Returns the created Document record on success (201).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { uploadDocument } from "@/lib/storage/documents";
import { createAuditLog } from "@/lib/audit/log";

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth: ASSESSOR only ──────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== Role.ASSESSOR) {
    return NextResponse.json(
      { error: "Forbidden — ASSESSOR role required" },
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

  // ── Verify application exists ─────────────────────────────────────────────
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, reference: true },
  });

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
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

    // Audit log the assessor upload
    await createAuditLog({
      userId: user.id,
      action: "DOCUMENT_UPLOADED_BY_ASSESSOR",
      entityType: "Document",
      entityId: document.id,
      context: `Assessor uploaded document for slot: ${slot}`,
      metadata: {
        applicationId,
        reference: application.reference,
        slot,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (err) {
    console.error("[admin/documents POST] DB error after storage upload:", err);
    return NextResponse.json(
      { error: "Failed to record document. Please try again." },
      { status: 500 }
    );
  }
}
