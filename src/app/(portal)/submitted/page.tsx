/**
 * Post-submission confirmation (Epic 05 §3.3, narrowed by Epic 13 D1 / D13-4).
 *
 * Epic 05 made this a read-only render of WHAT was submitted — every section's
 * answers, on screen, forever. CF-27 reverses that: applicants must not be able
 * to browse everything they submitted (the "tailor-made application" risk), so
 * the section-by-section summary and the History page are gone and this page is
 * a confirmation, not an archive.
 *
 * What remains is identification and status — reference, child, round, the
 * submitted date — plus the ONE-TIME PDF offer. The submitted application is
 * immutable (Epic 01), so the displayed submission date never changes even
 * after a later document request. The parent-safe label is "Submitted" (new) /
 * "Received" (rolling) per the signed bursary-flow diagram.
 *
 * The full answer set still exists in the PDF, which the parent may download
 * exactly once; after that their route to a copy is the bursary team.
 */

import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { loadSubmittedApplication } from "@/lib/portal/submission-loader";
import { getActiveApplicationId } from "@/lib/portal/active-application";
import { submittedLabel } from "@/lib/portal/status-projection";
import { SubmissionDownloadOffer } from "@/components/portal/submission-download-offer";
import { PortalPage } from "@/components/portal/portal-page";
import { formatLondonDate } from "@/lib/datetime";

export const metadata = {
  title: "Application Submitted",
};

export default async function SubmittedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Most-recently submitted application for this user (any round). E2: the
  // active-application preference wins when it points at a SUBMITTED app of
  // the caller's own (the status filter stays on both branches).
  const activeApplicationId = await getActiveApplicationId();
  const latest = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) =>
      (activeApplicationId
        ? await tx.application.findFirst({
            where: {
              id: activeApplicationId,
              leadApplicantId: user.id,
              formStatus: "SUBMITTED",
            },
            select: { id: true },
          })
        : null) ??
      tx.application.findFirst({
        where: { leadApplicantId: user.id, formStatus: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        select: { id: true },
      })
  );

  if (!latest) redirect("/");

  const submission = await loadSubmittedApplication(
    { id: user.id, role: user.role as RlsRole },
    latest.id
  );

  if (!submission) redirect("/");

  const label = submittedLabel(submission.applicationType);
  const submittedDate = submission.submittedAt
    ? formatLondonDate(submission.submittedAt)
    : "—";

  return (
    <PortalPage className="space-y-8">
      {/* Success banner */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2
              className="h-6 w-6 text-green-600"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-green-900">
              {submission.applicationType === "NEW"
                ? "Your application has been submitted"
                : "Your re-assessment has been received"}
            </h1>
            <p className="mt-1 text-sm text-green-700">
              Thank you. You will receive a confirmation email shortly, and you
              can follow progress from your application status page at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Identification / status meta — no answers (D13-4). */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {label}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-primary-900">
              {submission.reference}
            </p>
            {submission.childName && (
              <p className="mt-1 text-sm text-slate-600">
                {submission.childName}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {submission.academicYear} assessment round
            </p>
          </div>
          <dl className="text-right text-sm">
            <dt className="text-xs uppercase tracking-wider text-slate-400">
              Submitted
            </dt>
            <dd className="font-medium text-slate-800">{submittedDate}</dd>
          </dl>
        </div>
        {submission.termsAcceptedAt && (
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
            You confirmed the bursary Terms &amp; Conditions when you submitted
            this application on{" "}
            <span className="font-medium">
              {formatLondonDate(submission.termsAcceptedAt)}
            </span>
            {submission.termsVersion ? (
              <>
                {" "}
                (terms version{" "}
                <span className="font-mono text-xs">
                  {submission.termsVersion}
                </span>
                )
              </>
            ) : null}
            .
          </p>
        )}
      </div>

      {/* CG-13/LA-1 — the bare download beat: `DOWNLOAD MY COPY` + `Continue`
          during the live post-submit flow (no explanatory copy), the normal
          bottom navigation otherwise. The one-download rule (D13-4) is
          unchanged server-side. */}
      <SubmissionDownloadOffer
        applicationId={submission.id}
        downloadedAt={
          submission.submissionPdfDownloadedAt
            ? formatLondonDate(submission.submissionPdfDownloadedAt)
            : null
        }
      />
    </PortalPage>
  );
}
