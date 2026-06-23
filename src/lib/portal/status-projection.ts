/**
 * Parent-safe status projection — Epic 05 (plan §3.6, §5.2; D2).
 *
 * The SINGLE place the parent portal turns internal lifecycle columns into what
 * a parent is allowed to see. It consumes the Epic-01 lifecycle columns
 * (`form_status`, `application_type`, `assessment.status`, `assessment.outcome`)
 * and collapses the entire post-submission assessment machinery (IN_PROGRESS,
 * PAUSED, raw outcome enum names) into a small parent-meaningful step model:
 *
 *     Draft → Submitted/Received → Being assessed → Outcome
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

/** The ordered parent-facing steps. */
export type ParentStep = "draft" | "submitted" | "assessing" | "outcome";

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
  /** Whether a parent-meaningful outcome is available to show. */
  showOutcome: boolean;
  /**
   * The parent-facing outcome view, present only when `showOutcome`. Never
   * exposes the raw outcome enum name — only an awarded / not-awarded shape
   * with parent copy.
   */
  outcome?: {
    awarded: boolean;
    title: string;
    body: string;
  };
  /** The full four-step timeline for the status page. */
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
 * Projects the internal lifecycle onto the parent-safe view. The only inputs
 * that matter to a parent: are they still drafting, have they submitted, is it
 * being assessed, and is there a decision. The assessment's internal status
 * (NOT_STARTED / IN_PROGRESS / PAUSED) is deliberately NOT surfaced — to a
 * parent, anything submitted-but-undecided reads as "Being assessed".
 */
export function projectParentStatus(
  input: ParentStatusInput
): ParentStatusProjection {
  const { formStatus, applicationType, outcome } = input;

  const isSubmitted = formStatus === "SUBMITTED";
  const isDecided = isSubmitted && outcome != null;

  // Determine the current step.
  let step: ParentStep;
  if (!isSubmitted) {
    step = "draft";
  } else if (isDecided) {
    step = "outcome";
  } else {
    // Submitted but no decision yet — to the parent this is "being assessed",
    // regardless of whether the assessor has opened it / paused it internally.
    step = "assessing";
  }

  // Current label + tone. Note: the parent never sits on a bare "submitted"
  // step — once submitted, the projection moves them straight to "assessing"
  // (the assessment begins at submission). The "submitted" timeline node is
  // therefore always reached-but-not-current.
  let label: string;
  let tone: ParentTone;
  if (step === "draft") {
    label = draftLabel(formStatus);
    tone = formStatus === "FILLED_IN" ? "info" : "neutral";
  } else if (step === "assessing") {
    label = "Being assessed";
    tone = "progress";
  } else {
    // outcome
    const awarded = outcome === "AWARDED";
    label = awarded ? "Bursary awarded" : "Decision available";
    tone = awarded ? "success" : "muted";
  }

  // Parent-facing outcome view (never the enum name).
  let outcomeView: ParentStatusProjection["outcome"];
  if (isDecided) {
    const awarded = outcome === "AWARDED";
    outcomeView = awarded
      ? {
          awarded: true,
          title: "Your application has been awarded a bursary",
          body: "Congratulations. The John Whitgift Foundation will be in touch with further details about your bursary award.",
        }
      : {
          awarded: false,
          title: "A decision has been made on your application",
          body: "Thank you for your application. The Foundation will be in touch with the outcome and any next steps. If you have questions, please contact the bursaries team.",
        };
  }

  // Build the four-step timeline. "reached" is cumulative; "current" marks the
  // active step.
  const reachedSubmitted = isSubmitted;
  const reachedAssessing = isSubmitted; // assessment begins at submission
  const reachedOutcome = isDecided;

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
      reached: reachedSubmitted,
      // Never current — submitted collapses into "assessing" for the parent.
      current: false,
    },
    {
      id: "assessing",
      label: "Being assessed",
      description: "The Foundation is reviewing your application.",
      reached: reachedAssessing,
      current: step === "assessing",
    },
    {
      id: "outcome",
      label: "Outcome",
      description: "A decision has been made.",
      reached: reachedOutcome,
      current: step === "outcome",
    },
  ];

  return {
    label,
    tone,
    step,
    showOutcome: isDecided,
    outcome: outcomeView,
    timeline,
  };
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
