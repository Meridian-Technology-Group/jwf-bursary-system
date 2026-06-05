/**
 * Typed per-lifecycle status badges — Epic 01 PR-4 (plan 01 §5.3).
 *
 * Replaces the stale, mislabelled `status-badge.tsx` (whose display union did
 * not match any Prisma enum). Each badge renders the REAL lifecycle value from
 * the Epic-01 columns:
 *   - FormStatusBadge       → applications.form_status   (ApplicationFormStatus)
 *   - AssessmentStatusBadge → assessments.status         (AssessmentStatus)
 *   - OutcomeBadge          → assessments.outcome         (AssessmentOutcome)
 *
 * These are ADMIN / ASSESSOR-facing — they show the true internal lifecycle.
 * Parent-facing surfaces must NOT use them directly; use
 * `projectFormStatusForApplicant` (below) for the safe label. The full
 * parent-portal visibility trim is Epic 05's job; PR-4 only provides the safe
 * projection and stops the obvious leakage.
 */

import {
  FilePlus2,
  FileEdit,
  FileClock,
  FileCheck2,
  Send,
  Search,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Award,
  Ban,
} from "lucide-react";
import type {
  ApplicationFormStatus,
  ApplicationType,
  AssessmentStatus,
  AssessmentOutcome,
} from "@prisma/client";
import { cn } from "@/lib/utils";

type BadgeConfig = {
  label: string;
  containerClass: string;
  iconClass: string;
  Icon: React.ElementType;
};

function Badge({
  config,
  className,
}: {
  config: BadgeConfig;
  className?: string;
}) {
  const { label, containerClass, iconClass, Icon } = config;
  return (
    <span
      className={cn("status-badge border", containerClass, className)}
      title={label}
    >
      <Icon className={cn("h-3 w-3 shrink-0", iconClass)} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

// ─── Form status ──────────────────────────────────────────────────────────────

const FORM_STATUS_CONFIG: Record<ApplicationFormStatus, BadgeConfig> = {
  CREATED: {
    label: "Created",
    containerClass: "bg-neutral-100 border-neutral-300 text-neutral-600",
    iconClass: "text-neutral-500",
    Icon: FilePlus2,
  },
  NOT_STARTED: {
    label: "Not Started",
    containerClass: "bg-slate-100 border-slate-300 text-slate-600",
    iconClass: "text-slate-500",
    Icon: FileEdit,
  },
  IN_PROGRESS: {
    label: "In Progress",
    containerClass: "bg-amber-50 border-amber-300 text-amber-700",
    iconClass: "text-amber-600",
    Icon: FileClock,
  },
  FILLED_IN: {
    label: "Filled In",
    containerClass: "bg-indigo-50 border-indigo-300 text-indigo-700",
    iconClass: "text-indigo-500",
    Icon: FileCheck2,
  },
  SUBMITTED: {
    label: "Submitted",
    containerClass: "bg-blue-50 border-blue-300 text-blue-700",
    iconClass: "text-blue-500",
    Icon: Send,
  },
};

/**
 * Internal (staff-facing) form-status badge. For a SUBMITTED form, the label is
 * derived from the application type: "Received" for a NEW application,
 * "Submitted" for a ROLLING_OVER one (decision D2). All other states render
 * their literal internal label.
 */
export function FormStatusBadge({
  status,
  applicationType,
  className,
}: {
  status: ApplicationFormStatus;
  applicationType?: ApplicationType;
  className?: string;
}) {
  const base = FORM_STATUS_CONFIG[status];
  const config =
    status === "SUBMITTED" && applicationType === "NEW"
      ? { ...base, label: "Received" }
      : base;
  return <Badge config={config} className={className} />;
}

// ─── Assessment status ────────────────────────────────────────────────────────

const ASSESSMENT_STATUS_CONFIG: Record<AssessmentStatus, BadgeConfig> = {
  NOT_STARTED: {
    label: "Not Started",
    containerClass: "bg-slate-100 border-slate-300 text-slate-600",
    iconClass: "text-slate-500",
    Icon: FileEdit,
  },
  IN_PROGRESS: {
    label: "In Progress",
    containerClass: "bg-orange-50 border-orange-300 text-orange-700",
    iconClass: "text-orange-500",
    Icon: Search,
  },
  PAUSED: {
    label: "Paused",
    containerClass: "bg-yellow-50 border-yellow-300 text-yellow-700",
    iconClass: "text-yellow-600",
    Icon: PauseCircle,
  },
  COMPLETED: {
    label: "Completed",
    containerClass: "bg-green-50 border-green-300 text-green-700",
    iconClass: "text-green-500",
    Icon: CheckCircle2,
  },
};

export function AssessmentStatusBadge({
  status,
  className,
}: {
  status: AssessmentStatus;
  className?: string;
}) {
  return <Badge config={ASSESSMENT_STATUS_CONFIG[status]} className={className} />;
}

// ─── Outcome ──────────────────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<AssessmentOutcome, BadgeConfig> = {
  AWARDED: {
    label: "Awarded",
    containerClass: "bg-emerald-50 border-emerald-300 text-emerald-700",
    iconClass: "text-emerald-600",
    Icon: Award,
  },
  QUALIFIES_NOT_AWARDED: {
    label: "Qualifies — Not Awarded",
    containerClass: "bg-teal-50 border-teal-300 text-teal-700",
    iconClass: "text-teal-600",
    Icon: CheckCircle2,
  },
  DOES_NOT_QUALIFY: {
    label: "Does Not Qualify",
    containerClass: "bg-rose-50 border-rose-300 text-rose-700",
    iconClass: "text-rose-500",
    Icon: XCircle,
  },
  // Legacy value retained until Epic 01 PR-6 remaps residual rows. Should not
  // appear on new outcomes (the service writes the 3-value enum) but is mapped
  // defensively so a pre-PR-3 row never renders blank.
  QUALIFIES: {
    label: "Qualifies",
    containerClass: "bg-teal-50 border-teal-300 text-teal-700",
    iconClass: "text-teal-600",
    Icon: CheckCircle2,
  },
};

export function OutcomeBadge({
  outcome,
  className,
}: {
  outcome: AssessmentOutcome;
  className?: string;
}) {
  const config = OUTCOME_CONFIG[outcome];
  if (!config) {
    return (
      <span
        className={cn(
          "status-badge border bg-slate-100 text-slate-600",
          className
        )}
      >
        {outcome}
      </span>
    );
  }
  return <Badge config={config} className={className} />;
}

// ─── Parent-safe projection (Epic 05 owns the full trim) ──────────────────────

/**
 * Projects an internal form status onto a parent-safe label. PR-4 stops the
 * obvious leakage (internal assessment/outcome states surfaced verbatim to the
 * applicant); Epic 05 owns the full portal status UX and visibility trimming.
 *
 * For the applicant, the entire post-submission machinery (review begun,
 * paused, completed, outcome) collapses to a single "Submitted/Received"
 * surface — they should never see internal assessment states. Pre-submission
 * states map to plain-English progress.
 */
export function projectFormStatusForApplicant(
  formStatus: ApplicationFormStatus,
  applicationType: ApplicationType
): string {
  switch (formStatus) {
    case "CREATED":
    case "NOT_STARTED":
      return "Not Started";
    case "IN_PROGRESS":
      return "In Progress";
    case "FILLED_IN":
      return "Ready to Submit";
    case "SUBMITTED":
      return applicationType === "NEW" ? "Received" : "Submitted";
    default:
      return "In Progress";
  }
}
