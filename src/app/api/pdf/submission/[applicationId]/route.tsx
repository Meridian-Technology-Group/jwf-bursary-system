/**
 * GET /api/pdf/submission/[applicationId] — Epic 05 (plan §5.2), made a
 * ONE-TIME download by Epic 13 D1 (decision D13-4).
 *
 * Streams a parent-facing PDF of a SUBMITTED application (section answers +
 * documents + recorded T&Cs acceptance). Applicant-scoped: a lead applicant may
 * fetch ONLY their own submitted application's PDF — ownership is enforced by
 * the loader (`leadApplicantId` + RLS), which returns null for anything that is
 * not the caller's submitted application.
 *
 * **The download may be taken exactly once.** CF-27: applicants must not be
 * able to browse or re-fetch everything they submitted, so the on-screen answer
 * summary and the History page are gone and this route self-closes after one
 * success. `Application.submissionPdfDownloadedAt` is the consumed-flag.
 *
 * Ordering is the whole correctness of the feature and reads top-to-bottom:
 *
 *   1. Authenticate.
 *   2. Load (ownership + SUBMITTED gate).
 *   3. Fast-path 410 if the flag is already set — so a repeat request costs no
 *      render. This is an optimisation, NOT the gate.
 *   4. Render. A failure here returns 500 with the flag still NULL: a broken
 *      render must never consume the applicant's single download.
 *   5. Only now, claim the download with a conditional update. If the claim
 *      loses (a concurrent request got there first, or the flag was set between
 *      steps 3 and 5), answer 410 and DO NOT serve the bytes — otherwise two
 *      simultaneous clicks would both succeed and "once" would be a lie.
 *   6. Serve the bytes.
 *
 * The claim is the only authoritative gate; see
 * `lib/portal/submission-pdf-download.ts` for its concurrency contract.
 *
 * Returns:
 *   200  application/pdf  — rendered PDF (first and only time)
 *   401  Unauthorized     — no session
 *   404  Not Found        — not the caller's submitted application
 *   410  Gone             — the single download has already been taken
 *   500  Internal         — rendering failure (download NOT consumed)
 *
 * Runtime: nodejs (required — @react-pdf/renderer is not edge-compatible).
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/roles";
import type { RlsRole } from "@/lib/db/prisma";
import { loadSubmittedApplication } from "@/lib/portal/submission-loader";
import { claimSubmissionPdfDownload } from "@/lib/portal/submission-pdf-download";
import { submittedLabel } from "@/lib/portal/status-projection";
import { SubmissionPDF } from "@/lib/pdf/submission-pdf";
import { formatLondonDate } from "@/lib/datetime";

interface RouteParams {
  params: Promise<{ applicationId: string }>;
}

/** Shared 410 body — the copy the portal shows mirrors this wording. */
function alreadyDownloaded(): NextResponse {
  return NextResponse.json(
    {
      error:
        "This submission PDF has already been downloaded. It can only be downloaded once — please contact the bursary team at fees@johnwhitgiftfoundation.org if you need another copy.",
      code: "SUBMISSION_PDF_ALREADY_DOWNLOADED",
    },
    { status: 410 }
  );
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
  const caller = { id: user.id, role: user.role as RlsRole };

  // Ownership + submitted-state enforced by the loader (RLS-scoped). Returns
  // null for anything that is not the caller's own submitted application.
  const submission = await loadSubmittedApplication(caller, applicationId);

  if (!submission) {
    return NextResponse.json(
      { error: "Submitted application not found" },
      { status: 404 }
    );
  }

  // Fast path: already spent. Skips the render entirely. The claim below is
  // still the authoritative gate — this check alone would be a TOCTOU hole.
  if (submission.submissionPdfDownloadedAt) {
    return alreadyDownloaded();
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
    // The download is NOT consumed: the flag is still NULL, so the applicant
    // can try again. Never move the claim above this catch.
    console.error("[pdf/submission] renderToBuffer failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }

  // Render succeeded — now, and only now, spend the download. A conditional
  // update: exactly one of any number of concurrent requests gets `true`.
  const claimed = await claimSubmissionPdfDownload(caller, applicationId);
  if (!claimed) {
    return alreadyDownloaded();
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
