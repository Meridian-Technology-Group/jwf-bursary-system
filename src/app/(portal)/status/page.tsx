/**
 * Application status page.
 *
 * Shows the applicant their:
 *   - Application reference
 *   - Current status with StatusBadge
 *   - Status timeline (Draft → Submitted → Under Review → Outcome Available)
 *   - Assessment outcome if available
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
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Application Status",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type AppStatus =
  | "PRE_SUBMISSION"
  | "SUBMITTED"
  | "NOT_STARTED"
  | "PAUSED"
  | "COMPLETED"
  | "QUALIFIES"
  | "DOES_NOT_QUALIFY";

// ─── Status configuration ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<AppStatus, string> = {
  PRE_SUBMISSION: "Draft",
  SUBMITTED: "Submitted",
  NOT_STARTED: "Under Review",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  QUALIFIES: "Qualifies",
  DOES_NOT_QUALIFY: "Does Not Qualify",
};

const STATUS_COLOURS: Record<
  AppStatus,
  { container: string; icon: string; badge: string }
> = {
  PRE_SUBMISSION: {
    container: "bg-neutral-100 border-neutral-300",
    icon: "text-neutral-500",
    badge: "bg-neutral-100 text-neutral-700 border-neutral-300",
  },
  SUBMITTED: {
    container: "bg-blue-50 border-blue-300",
    icon: "text-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-300",
  },
  NOT_STARTED: {
    container: "bg-orange-50 border-orange-300",
    icon: "text-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-300",
  },
  PAUSED: {
    container: "bg-yellow-50 border-yellow-300",
    icon: "text-yellow-600",
    badge: "bg-yellow-50 text-yellow-700 border-yellow-300",
  },
  COMPLETED: {
    container: "bg-slate-50 border-slate-300",
    icon: "text-slate-500",
    badge: "bg-slate-50 text-slate-700 border-slate-300",
  },
  QUALIFIES: {
    container: "bg-green-50 border-green-300",
    icon: "text-green-500",
    badge: "bg-green-50 text-green-700 border-green-300",
  },
  DOES_NOT_QUALIFY: {
    container: "bg-rose-50 border-rose-300",
    icon: "text-rose-500",
    badge: "bg-rose-50 text-rose-700 border-rose-300",
  },
};

// ─── Timeline step definitions ────────────────────────────────────────────────

interface TimelineStep {
  id: string;
  label: string;
  description: string;
  statuses: AppStatus[]; // Application statuses that correspond to this step being "reached"
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: "draft",
    label: "Draft",
    description: "Application started",
    statuses: [
      "PRE_SUBMISSION",
      "SUBMITTED",
      "NOT_STARTED",
      "PAUSED",
      "COMPLETED",
      "QUALIFIES",
      "DOES_NOT_QUALIFY",
    ],
  },
  {
    id: "submitted",
    label: "Submitted",
    description: "Application submitted for review",
    statuses: [
      "SUBMITTED",
      "NOT_STARTED",
      "PAUSED",
      "COMPLETED",
      "QUALIFIES",
      "DOES_NOT_QUALIFY",
    ],
  },
  {
    id: "review",
    label: "Under Review",
    description: "Financial assessment in progress",
    statuses: [
      "NOT_STARTED",
      "PAUSED",
      "COMPLETED",
      "QUALIFIES",
      "DOES_NOT_QUALIFY",
    ],
  },
  {
    id: "outcome",
    label: "Outcome Available",
    description: "Assessment complete",
    statuses: ["COMPLETED", "QUALIFIES", "DOES_NOT_QUALIFY"],
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function isStepReached(step: TimelineStep, status: AppStatus): boolean {
  return (step.statuses as string[]).includes(status);
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "Pending";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Load the user's most recent application (any status)
  const application = await prisma.application.findFirst({
    where: { leadApplicantId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      reference: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      childName: true,
      round: {
        select: { academicYear: true, decisionDate: true },
      },
      assessment: {
        select: {
          status: true,
          outcome: true,
          completedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!application) redirect("/");

  const appStatus = application.status as AppStatus;
  const colours = STATUS_COLOURS[appStatus] ?? STATUS_COLOURS["PRE_SUBMISSION"];
  const statusLabel = STATUS_LABELS[appStatus] ?? appStatus;

  // Determine dates for each timeline step
  const stepDates: Record<string, Date | null | undefined> = {
    draft: application.createdAt,
    submitted: application.submittedAt,
    review: application.assessment?.createdAt ?? null,
    outcome: application.assessment?.completedAt ?? null,
  };

  const outcomeAvailable =
    appStatus === "QUALIFIES" || appStatus === "DOES_NOT_QUALIFY";

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Application status
        </div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Application Status
        </h1>
      </div>

      {/* Reference + current status card */}
      <div
        className={cn(
          "rounded-xl border p-6 shadow-sm",
          colours.container
        )}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
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

          {/* Status badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
              colours.badge
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Status timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Progress
        </h2>

        <ol className="relative space-y-0" aria-label="Application progress">
          {TIMELINE_STEPS.map((step, idx) => {
            const reached = isStepReached(step, appStatus);
            const isLast = idx === TIMELINE_STEPS.length - 1;
            const stepDate = stepDates[step.id];

            return (
              <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-4 top-8 -bottom-0 w-0.5",
                      reached ? "bg-accent-400" : "bg-slate-200"
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Step indicator */}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    reached
                      ? "border-accent-400 bg-accent-50"
                      : "border-slate-200 bg-white"
                  )}
                  aria-hidden="true"
                >
                  {reached ? (
                    step.id === "draft" ? (
                      <FileEdit className="h-3.5 w-3.5 text-accent-600" />
                    ) : step.id === "submitted" ? (
                      <Send className="h-3.5 w-3.5 text-accent-600" />
                    ) : step.id === "review" ? (
                      <Search className="h-3.5 w-3.5 text-accent-600" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent-600" />
                    )
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-slate-300" />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      reached ? "text-slate-900" : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className={cn(
                      "text-xs",
                      reached ? "text-slate-500" : "text-slate-300"
                    )}
                  >
                    {step.description}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-xs font-medium",
                      reached ? "text-slate-700" : "text-slate-300"
                    )}
                  >
                    {reached ? formatDate(stepDate) : "Pending"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Outcome card (only shown when outcome is available) */}
      {outcomeAvailable && application.assessment?.outcome && (
        <div
          className={cn(
            "rounded-xl border p-6 shadow-sm",
            application.assessment.outcome === "QUALIFIES"
              ? "border-green-200 bg-green-50"
              : "border-rose-200 bg-rose-50"
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                application.assessment.outcome === "QUALIFIES"
                  ? "bg-green-100"
                  : "bg-rose-100"
              )}
            >
              {application.assessment.outcome === "QUALIFIES" ? (
                <CheckCircle2
                  className="h-6 w-6 text-green-600"
                  aria-hidden="true"
                />
              ) : (
                <XCircle
                  className="h-6 w-6 text-rose-600"
                  aria-hidden="true"
                />
              )}
            </div>
            <div>
              <h2
                className={cn(
                  "text-base font-semibold",
                  application.assessment.outcome === "QUALIFIES"
                    ? "text-green-900"
                    : "text-rose-900"
                )}
              >
                {application.assessment.outcome === "QUALIFIES"
                  ? "Your application qualifies for a bursary"
                  : "Your application does not qualify at this time"}
              </h2>
              <p
                className={cn(
                  "mt-1 text-sm",
                  application.assessment.outcome === "QUALIFIES"
                    ? "text-green-700"
                    : "text-rose-700"
                )}
              >
                {application.assessment.outcome === "QUALIFIES"
                  ? "Congratulations. The John Whitgift Foundation will be in touch with further details about your bursary award."
                  : "We regret to inform you that your application has not met the criteria for a bursary at this time. You will receive a letter with further information."}
              </p>
              {application.assessment.completedAt && (
                <p
                  className={cn(
                    "mt-2 text-xs",
                    application.assessment.outcome === "QUALIFIES"
                      ? "text-green-600"
                      : "text-rose-600"
                  )}
                >
                  Assessed on{" "}
                  {formatDate(application.assessment.completedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision date notice */}
      {!outcomeAvailable && application.round.decisionDate && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Decisions for the {application.round.academicYear} round are
            expected by{" "}
            <span className="font-semibold">
              {formatDate(application.round.decisionDate)}
            </span>
            . You will be notified by email when your outcome is available.
          </p>
        </div>
      )}

      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>
    </div>
  );
}
