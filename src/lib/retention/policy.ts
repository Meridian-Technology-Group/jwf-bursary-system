/**
 * Data retention — the DPO-signed rules (16 Oct 2026; Charlotte's
 * clarifications 7 Oct; Epic 23 T10, D-20).
 *
 * The SINGLE source of truth for "what happens to this application's data,
 * and when?". The weekly cron, the staff close, the erasure request, the
 * manual GDPR button and the Retention panel all read `planRetention`, so they
 * can never disagree. Pure date arithmetic; no DB.
 *
 * ── The rules ──────────────────────────────────────────────────────────────
 *
 *  1. Bursary account closed (an application on an account):
 *       closing date + 1 year  → the form + documents are purged;
 *       closing date + 6 years → the named assessment is purged.
 *  2. Unsuccessful application (no account: waiting list, not offered, offer
 *     declined …), closed by staff whenever they choose — no fixed timer:
 *       at the close           → the form + documents are purged;
 *       close + 6 years        → the (still named) assessment is purged.
 *     "The close" is the staff close (`applications.closed_at`) or, when the
 *     assessment was archived instead, `assessments.archived_at`.
 *  3. Parent erasure request at the new-application stage:
 *       at once                → the form + documents go and the name and
 *                                reference are anonymised ("XXXX");
 *       request + 6 years      → the anonymous assessment is purged.
 *
 * The anchor is always a CLOSING date (or the erasure date) — never
 * `submittedAt`, never a financial-year end, never a 30-day timer. An account
 * reopened (closedAt cleared by reopen / re-award / "Add a year") is simply
 * not closed any more → keep. Every primitive re-checks its plan inside its
 * own transaction.
 *
 * NOTE: policy, not enforcement. Nothing is deleted unless
 * `RETENTION_PURGE_ENABLED === "true"` (Brian's decision, after the dry run).
 */

import type { AssessmentStatus } from "@prisma/client";

export const RETENTION_STAGES = ["FORM_DOCS_PURGED", "ANONYMISED", "ASSESSMENT_PURGED"] as const;
export type RetentionStage = (typeof RETENTION_STAGES)[number];

/** The next action the plan calls for. */
export type RetentionAction = "keep" | "purge-form-docs" | "purge-assessment" | "anonymise-now";

export type RetentionRule = "account-closed" | "unsuccessful" | "erasure-request" | null;

/** Years each rule keeps data (the signed figures). */
export const RETENTION_YEARS = {
  accountClosedFormDocs: 1,
  accountClosedAssessment: 6,
  unsuccessfulAssessment: 6,
  erasureAssessment: 6,
} as const;

/** What the planner reads about one application. */
export interface RetentionRecord {
  /** The application's bursary account, if it has one (rule 1). */
  bursaryAccount: { closedAt: Date | null } | null;
  /** The staff close (`applications.closed_at`). */
  closedAt: Date | null;
  assessment: { status: AssessmentStatus; archivedAt: Date | null } | null;
  retentionStage: string | null;
  retentionStageAt: Date | null;
}

export interface RetentionPlan {
  action: RetentionAction;
  /** When the action is due (null for keep). */
  dueAt: Date | null;
  /** True once `now` is at or past `dueAt`. */
  due: boolean;
  rule: RetentionRule;
  /** The closing (or erasure) date the plan is anchored on. */
  anchor: Date | null;
  reason: string;
}

/** Whole years later, UTC calendar date preserved. */
export function addYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

function stageOf(r: RetentionRecord): RetentionStage | null {
  return (RETENTION_STAGES as readonly string[]).includes(r.retentionStage ?? "") ? (r.retentionStage as RetentionStage) : null;
}

function plan(action: RetentionAction, rule: RetentionRule, anchor: Date | null, dueAt: Date | null, now: Date, reason: string): RetentionPlan {
  return { action, rule, anchor, dueAt, due: dueAt != null && now.getTime() >= dueAt.getTime(), reason };
}

/** The unsuccessful-application anchor: the staff close, else the archive. */
export function unsuccessfulAnchor(r: RetentionRecord): Date | null {
  if (r.closedAt) return r.closedAt;
  if (r.assessment?.status === "CLOSED_ARCHIVED") return r.assessment.archivedAt;
  return null;
}

/** The plan for one application. Pure. */
export function planRetention(r: RetentionRecord, now: Date): RetentionPlan {
  const stage = stageOf(r);
  if (stage === "ASSESSMENT_PURGED") {
    return plan("keep", null, null, null, now, "Already purged — nothing left to remove.");
  }

  // Rule 3 — erased at the parent's request: the anonymous assessment goes 6 years on.
  if (stage === "ANONYMISED") {
    const anchor = r.retentionStageAt;
    if (!anchor) return plan("keep", "erasure-request", null, null, now, "Erased, but the erasure date is missing — retained.");
    return plan(
      "purge-assessment",
      "erasure-request",
      anchor,
      addYears(anchor, RETENTION_YEARS.erasureAssessment),
      now,
      "Erasure request: the anonymous assessment is kept 6 years from the request.",
    );
  }

  // Rule 1 — an application on a bursary account follows the account's close.
  if (r.bursaryAccount) {
    const closed = r.bursaryAccount.closedAt;
    if (!closed) return plan("keep", "account-closed", null, null, now, "The bursary account is active — kept until it closes.");
    if (stage === "FORM_DOCS_PURGED") {
      return plan(
        "purge-assessment",
        "account-closed",
        closed,
        addYears(closed, RETENTION_YEARS.accountClosedAssessment),
        now,
        "Account closed: the named assessment is kept 6 years from the closing date.",
      );
    }
    return plan(
      "purge-form-docs",
      "account-closed",
      closed,
      addYears(closed, RETENTION_YEARS.accountClosedFormDocs),
      now,
      "Account closed: the form and documents are kept 1 year from the closing date.",
    );
  }

  // Rule 2 — no account: unsuccessful once staff close (or archive) it.
  const closed = unsuccessfulAnchor(r);
  if (!closed) return plan("keep", null, null, null, now, "Not closed — kept while the application is live.");
  if (stage === "FORM_DOCS_PURGED") {
    return plan(
      "purge-assessment",
      "unsuccessful",
      closed,
      addYears(closed, RETENTION_YEARS.unsuccessfulAssessment),
      now,
      "Unsuccessful: the named assessment is kept 6 years from the close.",
    );
  }
  return plan("purge-form-docs", "unsuccessful", closed, closed, now, "Unsuccessful: the form and documents go at the close.");
}

/**
 * Rule 3's gate: an erasure request is for an application at the
 * new-application stage — no bursary account — that has not already been
 * erased or purged.
 */
export function canRequestErasure(r: RetentionRecord): { ok: true } | { ok: false; reason: string } {
  if (r.bursaryAccount) return { ok: false, reason: "This child has a bursary account: retention follows the account's close." };
  const stage = stageOf(r);
  if (stage === "ANONYMISED" || stage === "ASSESSMENT_PURGED") return { ok: false, reason: "This application has already been erased." };
  return { ok: true };
}

// ─── The manual GDPR button (whole-family erasure) ───────────────────────────

export interface PurgeEvaluation {
  purgeable: boolean;
  eligibleFrom: Date | null;
  reason: string;
}

/**
 * Whether everything about the application may be erased now — the last
 * stage of its plan (the assessment purge) is due. The manual GDPR button
 * (staff-initiated, whole-family) reads this, so it can never run sooner than
 * the signed rules allow. An unsuccessful application whose form has not yet
 * been purged is judged on its 6-year assessment date.
 */
export function isPurgeable(r: RetentionRecord, now: Date = new Date()): PurgeEvaluation {
  let p = planRetention(r, now);
  if (p.action === "purge-form-docs") {
    p = planRetention({ ...r, retentionStage: "FORM_DOCS_PURGED" }, now);
  }
  if (p.action !== "purge-assessment") return { purgeable: false, eligibleFrom: null, reason: p.reason };
  return { purgeable: p.due, eligibleFrom: p.dueAt, reason: p.reason };
}

/** The manual button's message when a record is not yet erasable. */
export function notYetPurgeableMessage(evaluation: PurgeEvaluation): string {
  if (evaluation.eligibleFrom == null) return `This application cannot be deleted yet. ${evaluation.reason}`;
  const date = evaluation.eligibleFrom.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  return `This application cannot be deleted yet. Under the retention rules it must be kept until ${date}.`;
}

/** Destructive retention runs ONLY when this is exactly "true". Stays unset until Brian decides. */
export function isRetentionPurgeEnabled(): boolean {
  return process.env.RETENTION_PURGE_ENABLED === "true";
}

/** What the Retention panel calls each step. */
export const RETENTION_ACTION_LABELS: Record<RetentionAction, string> = {
  keep: "Kept",
  "purge-form-docs": "Form and documents deleted",
  "purge-assessment": "Assessment deleted",
  "anonymise-now": "Anonymised",
};

/**
 * The close reason an erased application shows (Charlotte, 22 Oct 2026):
 * *"Should the close reason not show by default as 'EOR' = Erased on Request
 * rather than a blank."* Erasure records no close reason of its own.
 */
export const ERASED_ON_REQUEST_LABEL = "EOR – Erased on request";

export const RETENTION_RULE_LABELS: Record<Exclude<RetentionRule, null>, string> = {
  "account-closed": "Bursary account closed",
  unsuccessful: "Unsuccessful application",
  "erasure-request": "Erasure request",
};
