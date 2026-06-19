/**
 * Application status page (Epic 05 §3.6 — trimmed parent-safe view).
 *
 * Every status read goes through the parent-safe projection
 * (`projectParentStatus`) — NO internal workflow state (IN_PROGRESS, PAUSED,
 * raw outcome enum names) is ever shown to a parent. The timeline shows only
 * parent-meaningful steps: Application started → Received/Submitted → Being
 * assessed → Outcome.
 *
 * While the application is still an editable draft, the per-application
 * submission countdown / deadline-missed lockout is shown (Epic 03 deadline).
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FileEdit,
  Send,
  Search,
  CheckCircle2,
  XCircle,
  Circle,
  ArrowLeft,
  Upload,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import {
  projectParentStatus,
  parentToneBadgeClass,
  type ParentStep,
} from "@/lib/portal/status-projection";
import { getDeadlineStatus } from "@/lib/portal/deadline";
import { SubmissionCountdown } from "@/components/portal/submission-countdown";
import { PortalPage } from "@/components/portal/portal-page";
import { formatLondonDate } from "@/lib/datetime";

export const metadata = {
  title: "Application Status",
};

const STEP_ICON: Record<ParentStep, React.ElementType> = {
  draft: FileEdit,
  submitted: Send,
  assessing: Search,
  outcome: CheckCircle2,
};

export default async function StatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findFirst({
        where: { leadApplicantId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          reference: true,
          formStatus: true,
          applicationType: true,
          submittedAt: true,
          createdAt: true,
          childName: true,
          submissionDeadlineAt: true,
          round: {
            select: {
              academicYear: true,
              decisionDate: true,
              closeDate: true,
            },
          },
          assessment: {
            select: { status: true, outcome: true, completedAt: true },
          },
        },
      })
  );

  if (!application) redirect("/");

  const projection = projectParentStatus({
    formStatus: application.formStatus,
    applicationType: application.applicationType,
    assessmentStatus: application.assessment?.status ?? null,
    outcome: application.assessment?.outcome ?? null,
  });

  const isDraft = application.formStatus !== "SUBMITTED";
  const deadline = isDraft
    ? getDeadlineStatus(
        { submissionDeadlineAt: application.submissionDeadlineAt },
        { closeDate: application.round.closeDate }
      )
    : null;

  // Per-step date labels (parent-meaningful only).
  const stepDates: Record<ParentStep, Date | null | undefined> = {
    draft: application.createdAt,
    submitted: application.submittedAt,
    assessing: application.submittedAt,
    outcome: application.assessment?.completedAt ?? null,
  };

  return (
    <PortalPage className="space-y-8">
      {/* Page header */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Application status
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Application Status
        </h1>
      </div>

      {/* Countdown / lockout (only while editable) */}
      {deadline && (
        <SubmissionCountdown deadlineIso={deadline.deadline.toISOString()} />
      )}

      {/* Reference + current parent-safe status card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Reference
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-primary-900">
              {application.reference}
            </p>
            {application.childName && (
              <p className="mt-1 text-sm text-slate-600">
                {application.childName}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {application.round.academicYear} assessment round
            </p>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
              parentToneBadgeClass(projection.tone)
            )}
          >
            {projection.label}
          </span>
        </div>
      </div>

      {/* Continue / respond CTAs — never expose internal assessment state.
          A paused assessment surfaces to the parent only as an action to take
          (respond), not as a "Paused" status. */}
      {application.assessment?.status === "PAUSED" && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-100">
              <Upload className="h-6 w-6 text-yellow-700" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-yellow-900">
                The bursary team needs more from you
              </h2>
              <p className="mt-1 text-sm text-yellow-800">
                We&rsquo;re reviewing your application and need a few more
                documents to continue. Uploading them keeps your submission date
                unchanged.
              </p>
              <Link
                href="/respond"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                Upload the requested documents
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Status timeline (parent-safe steps only) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Progress
        </h2>

        <ol className="relative space-y-0" aria-label="Application progress">
          {projection.timeline.map((step, idx) => {
            const isLast = idx === projection.timeline.length - 1;
            const Icon = STEP_ICON[step.id];
            const stepDate = stepDates[step.id];
            return (
              <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-4 top-8 -bottom-0 w-0.5",
                      step.reached ? "bg-accent-400" : "bg-slate-200"
                    )}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    step.reached
                      ? "border-accent-400 bg-accent-50"
                      : "border-slate-200 bg-white"
                  )}
                  aria-hidden="true"
                >
                  {step.reached ? (
                    <Icon className="h-3.5 w-3.5 text-accent-600" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.reached ? "text-slate-900" : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className={cn(
                      "text-xs",
                      step.reached ? "text-slate-500" : "text-slate-300"
                    )}
                  >
                    {step.description}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-xs font-medium",
                      step.reached ? "text-slate-700" : "text-slate-300"
                    )}
                  >
                    {step.reached && stepDate
                      ? formatLondonDate(stepDate)
                      : "Pending"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Outcome card — parent-safe outcome view (no enum names) */}
      {projection.showOutcome && projection.outcome && (
        <div
          className={cn(
            "rounded-xl border p-6 shadow-sm",
            projection.outcome.awarded
              ? "border-green-200 bg-green-50"
              : "border-slate-200 bg-slate-50"
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                projection.outcome.awarded ? "bg-green-100" : "bg-slate-200"
              )}
            >
              {projection.outcome.awarded ? (
                <CheckCircle2
                  className="h-6 w-6 text-green-600"
                  aria-hidden="true"
                />
              ) : (
                <XCircle className="h-6 w-6 text-slate-500" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2
                className={cn(
                  "text-base font-semibold",
                  projection.outcome.awarded
                    ? "text-green-900"
                    : "text-slate-800"
                )}
              >
                {projection.outcome.title}
              </h2>
              <p
                className={cn(
                  "mt-1 text-sm",
                  projection.outcome.awarded
                    ? "text-green-700"
                    : "text-slate-600"
                )}
              >
                {projection.outcome.body}
              </p>
              {application.assessment?.completedAt && (
                <p
                  className={cn(
                    "mt-2 text-xs",
                    projection.outcome.awarded
                      ? "text-green-600"
                      : "text-slate-500"
                  )}
                >
                  Decided on {formatLondonDate(application.assessment.completedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision date notice (only before an outcome is available) */}
      {!projection.showOutcome && application.round.decisionDate && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Decisions for the {application.round.academicYear} round are expected
            by{" "}
            <span className="font-semibold">
              {formatLondonDate(application.round.decisionDate)}
            </span>
            . You will be notified by email when your outcome is available.
          </p>
        </div>
      )}

      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>
    </PortalPage>
  );
}
