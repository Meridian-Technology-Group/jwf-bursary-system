/**
 * Post-submission read-only summary (Epic 05 §3.3).
 *
 * Expanded from the old confirmation card into a read-only render of WHAT was
 * submitted — section-by-section answers + uploaded documents + recorded T&Cs
 * acceptance — with a dismissible "Download submission (PDF)" offer. The
 * submitted application is immutable (Epic 01), so the displayed submission date
 * never changes even after a later document request. The parent-safe label is
 * "Submitted" (new) / "Received" (rolling) per the signed bursary-flow diagram.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { loadSubmittedApplication } from "@/lib/portal/submission-loader";
import { submittedLabel } from "@/lib/portal/status-projection";
import { SubmittedSummary } from "@/components/portal/submitted-summary";
import { PortalPage } from "@/components/portal/portal-page";
import { formatLondonDate } from "@/lib/datetime";

export const metadata = {
  title: "Application Submitted",
};

export default async function SubmittedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Most-recently submitted application for this user (any round).
  const latest = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
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
              Thank you. A copy of the details you submitted is shown below — you
              can download it as a PDF for your records. You will receive a
              confirmation email shortly.
            </p>
          </div>
        </div>
      </div>

      {/* Read-only submitted summary + PDF offer */}
      <SubmittedSummary
        applicationId={submission.id}
        reference={submission.reference}
        submittedLabel={label}
        submittedDate={submittedDate}
        childName={submission.childName}
        academicYear={submission.academicYear}
        summary={submission.summary}
        termsAccepted={
          submission.termsAcceptedAt
            ? {
                date: formatLondonDate(submission.termsAcceptedAt),
                version: submission.termsVersion,
              }
            : null
        }
      />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
        <Link
          href="/status"
          className="inline-flex items-center gap-2 rounded-md bg-primary-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          View application status
        </Link>
      </div>
    </PortalPage>
  );
}
