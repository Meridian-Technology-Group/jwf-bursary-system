/**
 * Parent-safe status projection — Epic 05 (plan §3.6, §5.2; D2).
 *
 * The SINGLE place the parent portal turns internal lifecycle columns into what
 * a parent is allowed to see. It consumes the Epic-01 lifecycle columns
 * (`form_status`, `application_type`, `assessment.status`, `assessment.outcome`)
 * and collapses the entire post-submission assessment machinery (IN_PROGRESS,
 * PAUSED, raw outcome enum names) into a small parent-meaningful step model:
 *
 *     Not started → In Progress → Ready to Submit → Submitted/Received
 *
 * These are exactly the canonical Application-track states (state-model.md §3)
 * from the applicant's point of view. The Assessment track (Not Started / In
 * Progress / Paused / Complete) and the decision outcome are Foundation-side and
 * are NEVER shown to the applicant — a submitted application simply stays on
 * "Submitted"/"Received"; a document request surfaces only as an action (the
 * /respond CTA), not a status; and an awarded family's portal switches to the
 * rounds view separately.
 *
 * No internal enum name ever crosses into a portal view through this module.
 * `status/page.tsx` and the dashboard read ONLY this projection (replacing the
 * old inline maps + the stale status-badge shim).
 *
 * Submitted-state label (per the signed bursary-flow diagram): a single
 * submitted state, with the label derived from the application type —
 * "Submitted" for a NEW application, "Received" for a ROLLING_OVER one. This
 * `submittedLabel` helper is the canonical mapping; the lifecycle badges and
 * the submission PDF derive from it rather than re-encoding the rule.
 *
 * (Was inverted under the since-reversed Decision D2, which had NEW→"Received"
 * / ROLLING_OVER→"Submitted"; gap A2 flipped it to the signed diagram.)
 */

import type {
  ApplicationFormStatus,
  ApplicationType,
  AssessmentStatus,
  AssessmentOutcome,
} from "@prisma/client";

/**
 * The ordered parent-facing steps. The applicant only ever sees THEIR OWN
 * state — drafting or submitted. The Foundation's assessment progress and the
 * decision outcome are deliberately NOT parent-facing steps (an awarded family's
 * portal switches to the rounds view separately).
 */
export type ParentStep = "draft" | "submitted";

export type ParentTone = "neutral" | "info" | "progress" | "success" | "muted";

export interface ParentStatusInput {
  formStatus: ApplicationFormStatus;
  applicationType: ApplicationType;
  /** Assessment lifecycle status, or null if no assessment row exists yet. */
  assessmentStatus?: AssessmentStatus | null;
  /** Assessment outcome, or null if not yet decided. */
  outcome?: AssessmentOutcome | null;
}

/** A single step in the parent-facing timeline. */
export interface ParentTimelineStep {
  id: ParentStep;
  label: string;
  description: string;
  /** True when the application has reached (or passed) this step. */
  reached: boolean;
  /** True when this is the step the application is currently sitting on. */
  current: boolean;
}

export interface ParentStatusProjection {
  /** The single current parent-facing status label (the badge text). */
  label: string;
  tone: ParentTone;
  /** Which step the application is currently on. */
  step: ParentStep;
  /** The applicant-facing timeline (Application started → Submitted). */
  timeline: ParentTimelineStep[];
}

/**
 * Canonical parent-safe submitted-state label (per the signed bursary-flow
 * diagram): a NEW application shows "Submitted"; a ROLLING_OVER re-assessment
 * shows "Received". The single source of truth for this mapping — the lifecycle
 * badges and the submission PDF derive from it.
 */
export function submittedLabel(applicationType: ApplicationType): string {
  return applicationType === "NEW" ? "Submitted" : "Received";
}

/**
 * Pre-submission, plain-English progress label. Mirrors
 * projectFormStatusForApplicant (lifecycle-badges) for the non-submitted states
 * so the dashboard and status page agree, but lives here so every portal status
 * read funnels through one module.
 */
function draftLabel(formStatus: ApplicationFormStatus): string {
  switch (formStatus) {
    case "FILLED_IN":
      return "Ready to Submit";
    case "IN_PROGRESS":
      return "In Progress";
    case "CREATED":
    case "NOT_STARTED":
    default:
      return "Not Started";
  }
}

/**
 * Projects the internal lifecycle onto the applicant-safe view. The only thing
 * an applicant ever sees is THEIR OWN Application-track state: are they still
 * drafting (Not started / In Progress / Ready to Submit) or have they submitted
 * (Submitted / Received). The Assessment track and the decision outcome are
 * Foundation-side and are never surfaced here — a submitted application simply
 * stays on "Submitted"/"Received" until the portal moves to the rounds view on
 * award (handled separately).
 */
export function projectParentStatus(
  input: ParentStatusInput
): ParentStatusProjection {
  const { formStatus, applicationType } = input;

  const isSubmitted = formStatus === "SUBMITTED";
  const step: ParentStep = isSubmitted ? "submitted" : "draft";

  const label = isSubmitted
    ? submittedLabel(applicationType)
    : draftLabel(formStatus);
  const tone: ParentTone = isSubmitted
    ? "success"
    : formStatus === "FILLED_IN"
      ? "info"
      : "neutral";

  const timeline: ParentTimelineStep[] = [
    {
      id: "draft",
      label: "Application started",
      description: "You began your bursary application.",
      reached: true,
      current: step === "draft",
    },
    {
      id: "submitted",
      label: submittedLabel(applicationType),
      description:
        applicationType === "NEW"
          ? "Your application has been submitted."
          : "Your re-assessment has been received.",
      reached: isSubmitted,
      current: step === "submitted",
    },
  ];

  return { label, tone, step, timeline };
}

/** Tailwind classes for a parent badge tone (kept here so callers stay dumb). */
export function parentToneBadgeClass(tone: ParentTone): string {
  switch (tone) {
    case "success":
      return "bg-green-50 border-green-300 text-green-700";
    case "progress":
      return "bg-amber-50 border-amber-300 text-amber-700";
    case "info":
      return "bg-blue-50 border-blue-300 text-blue-700";
    case "muted":
      return "bg-slate-100 border-slate-300 text-slate-600";
    case "neutral":
    default:
      return "bg-primary-50 border-primary-200 text-primary-800";
  }
}
