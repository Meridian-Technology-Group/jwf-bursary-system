/**
 * GET /api/pdf/submission/[applicationId] — Epic 05 (plan §5.2).
 *
 * Streams a parent-facing PDF of a SUBMITTED application (section answers +
 * documents + recorded T&Cs acceptance). Applicant-scoped: a lead applicant may
 * fetch ONLY their own submitted application's PDF — ownership is enforced by
 * the loader (`leadApplicantId` + RLS), which returns null for anything that is
 * not the caller's submitted application.
 *
 * Generated on demand (no storage), mirroring the recommendation PDF route's
 * shape.
 *
 * Returns:
 *   200  application/pdf  — rendered PDF
 *   401  Unauthorized     — no session
 *   404  Not Found        — not the caller's submitted application
 *   500  Internal         — rendering failure
 *
 * Runtime: nodejs (required — @react-pdf/renderer is not edge-compatible).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/roles";
import type { RlsRole } from "@/lib/db/prisma";
import { loadSubmittedApplication } from "@/lib/portal/submission-loader";
import { submittedLabel } from "@/lib/portal/status-projection";
import { SubmissionPDF } from "@/lib/pdf/submission-pdf";
import { formatLondonDate } from "@/lib/datetime";

interface RouteParams {
  params: Promise<{ applicationId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { applicationId } = await params;

  // Ownership + submitted-state enforced by the loader (RLS-scoped). Returns
  // null for anything that is not the caller's own submitted application.
  const submission = await loadSubmittedApplication(
    { id: user.id, role: user.role as RlsRole },
    applicationId
  );

  if (!submission) {
    return NextResponse.json(
      { error: "Submitted application not found" },
      { status: 404 }
    );
  }

  const generatedAt = formatLondonDate(new Date());
  const submittedDate = submission.submittedAt
    ? formatLondonDate(submission.submittedAt)
    : "—";

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      <SubmissionPDF
        reference={submission.reference}
        school={submission.school}
        academicYear={submission.academicYear}
        childName={submission.childName}
        submittedDate={submittedDate}
        submittedLabel={submittedLabel(submission.applicationType)}
        summary={submission.summary}
        termsAccepted={
          submission.termsAcceptedAt
            ? {
                date: formatLondonDate(submission.termsAcceptedAt),
                version: submission.termsVersion,
              }
            : null
        }
        generatedAt={generatedAt}
      />
    );
  } catch (err) {
    console.error("[pdf/submission] renderToBuffer failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }

  const safeRef = submission.reference.replace(/[^a-zA-Z0-9-]/g, "-");
  const filename = `bursary-application-${safeRef}.pdf`;
  const body = new Uint8Array(pdfBuffer);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Generated-By": user.id,
    },
  });
}
