/**
 * Epic 23 T7 — Reject RETURNS the form (Charlotte, 16 Oct 2026, decision 4;
 * D-16).
 *
 * Before: Reject and restart hard-deleted the application (sections,
 * documents, assessment) and created a blank one. Now the SAME application
 * goes back to the family with every answer and document kept, a message
 * saying it was returned and must be corrected, and a NEW Submit by (the
 * original has usually passed). Staff then remove the specific bad items (a
 * wrong-year P60, a blurry statement, a wrong figure) so the gaps show.
 *
 *   form            SUBMITTED → IN_PROGRESS; submitted_at → NULL (the next
 *                   submission records its own date: Submitted → Rejected →
 *                   Submitted); submissionDeadlineAt → the new Submit by
 *   sections/docs   kept, isComplete flags unchanged
 *   assessment      a live (IN_PROGRESS / PAUSED) one is reset to NOT_STARTED
 *                   via `discardAssessment` — status only, nothing deleted
 *   rejection row   old submittedAt, the note, the new Submit by,
 *                   replacementApplicationId = the same application
 *   schedule row    back to SCHEDULED, receivedOn NULL, same application
 *
 * No row or storage object is deleted. Pure seams first, then the one
 * transaction body (`returnApplicationForCorrection`).
 */

import type { ApplicationFormStatus } from "@prisma/client";
import type { Tx } from "@/lib/db/prisma";
import { discardAssessment, type ReviewPhase } from "@/lib/applications/status";
import { recordRejection } from "@/lib/applications/rejection-record";
import { dateOnlyKey, endOfLondonDay, londonDateKey } from "@/lib/invitations/submit-by";

/** The phases a form can be returned from: submitted, before a final outcome. */
export const RETURNABLE_PHASES: readonly ReviewPhase[] = ["SUBMITTED", "NOT_STARTED", "PAUSED"];

export function canReturnForCorrection(phase: ReviewPhase): boolean {
  return RETURNABLE_PHASES.includes(phase);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export type ReturnSubmitByResult = { ok: true; submitBy: Date } | { ok: false; error: string };

/**
 * The dialog's "New submit-by date" (`yyyy-MM-dd`, required): a real date
 * AFTER today in Europe/London, stored as the end of that day.
 */
export function parseReturnSubmitBy(raw: string | null | undefined, now: Date): ReturnSubmitByResult {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "Enter the new submit-by date." };
  if (!YMD.test(value)) return { ok: false, error: "Enter the new submit-by date as a full date." };
  const [y, m, d] = value.split("-").map(Number);
  if (dateOnlyKey(new Date(Date.UTC(y, m - 1, d))) !== value) {
    return { ok: false, error: "Enter the new submit-by date as a real date." };
  }
  if (value <= londonDateKey(now)) return { ok: false, error: "The new submit-by date must be in the future." };
  return { ok: true, submitBy: endOfLondonDay(value) };
}

/**
 * The dialog's pre-filled date: the later of the form's current effective
 * deadline and today + 7 days, as `yyyy-MM-dd` (Europe/London).
 */
export function defaultReturnSubmitBy(currentDeadline: Date | null | undefined, now: Date): string {
  const week = londonDateKey(new Date(now.getTime() + 7 * DAY_MS));
  const current = currentDeadline ? londonDateKey(currentDeadline) : null;
  return current && current > week ? current : week;
}

export interface LatestRejection {
  rejectedAt: Date;
  replacementApplicationId: string | null;
  newSubmitBy: Date | null;
  message: string | null;
}

/**
 * Whether the family should see "returned to you for correction": the latest
 * rejection returned THIS application, and it has not been submitted since.
 */
export function isReturnedForCorrection(
  app: { id: string; formStatus: ApplicationFormStatus; submittedAt: Date | null },
  latest: LatestRejection | null | undefined,
): boolean {
  if (!latest || latest.replacementApplicationId !== app.id) return false;
  if (app.formStatus === "SUBMITTED") return false;
  return app.submittedAt == null || app.submittedAt < latest.rejectedAt;
}

export interface ReturnNotice {
  returnedOn: Date;
  submitBy: Date | null;
  message: string | null;
}

/** The banner's content, or null when there is nothing to show. */
export function returnNotice(
  app: { id: string; formStatus: ApplicationFormStatus; submittedAt: Date | null; submissionDeadlineAt: Date | null },
  latest: LatestRejection | null | undefined,
): ReturnNotice | null {
  if (!latest || !isReturnedForCorrection(app, latest)) return null;
  return {
    returnedOn: latest.rejectedAt,
    submitBy: app.submissionDeadlineAt ?? latest.newSubmitBy,
    message: latest.message?.trim() || null,
  };
}

/** The latest rejection that returned this application (parent RLS reads its own rows). */
export async function getLatestReturn(tx: Tx, applicationId: string): Promise<LatestRejection | null> {
  return tx.applicationRejection.findFirst({
    where: { replacementApplicationId: applicationId },
    orderBy: { rejectedAt: "desc" },
    select: { rejectedAt: true, replacementApplicationId: true, newSubmitBy: true, message: true },
  });
}

// ─── The transaction body ─────────────────────────────────────────────────────

export interface ReturnApplicationInput {
  application: {
    id: string;
    reference: string;
    roundId: string;
    academicYear: string;
    leadApplicantId: string;
    bursaryAccountId: string | null;
    childName: string;
    submittedAt: Date | null;
    formStatus: ApplicationFormStatus;
  };
  phase: ReviewPhase;
  newSubmitBy: Date;
  message: string | null;
  staffId: string;
}

export interface ReturnApplicationResult {
  rejectionId: string;
  assessmentReset: boolean;
}

/**
 * Returns the form. Runs inside the caller's service-role transaction (the
 * rejection insert policy is service-role only). Never deletes anything.
 */
export async function returnApplicationForCorrection(
  tx: Tx,
  input: ReturnApplicationInput,
): Promise<ReturnApplicationResult> {
  const { application: app } = input;
  if (!canReturnForCorrection(input.phase)) {
    throw new Error(`Cannot return an application from status ${input.phase}.`);
  }
  if (app.formStatus !== "SUBMITTED") {
    throw new Error(`Cannot return an application that is not submitted (form status ${app.formStatus}).`);
  }

  // The rejection row and the schedule reset (Submitted → Rejected → …).
  const { rejectionId } = await recordRejection(tx, {
    rejectedApplicationId: app.id,
    newApplicationId: app.id,
    roundId: app.roundId,
    academicYear: app.academicYear,
    leadApplicantId: app.leadApplicantId,
    bursaryAccountId: app.bursaryAccountId,
    childName: app.childName,
    reference: app.reference,
    submittedAt: app.submittedAt,
    rejectedById: input.staffId,
    fromPhase: input.phase,
    message: input.message,
    newSubmitBy: input.newSubmitBy,
  });

  // Back to the family: the next submission stamps its own date (the
  // write-once trigger allows a set date to be CLEARED, never rewritten).
  await tx.application.update({
    where: { id: app.id },
    data: { formStatus: "IN_PROGRESS", submittedAt: null, submissionDeadlineAt: input.newSubmitBy },
  });

  // A live review is stale once the form is back with the family. Status
  // only: assessor notes, figures and the synopsis are kept.
  const assessmentReset = await discardAssessment(tx, app.id, input.staffId, {
    reason: "Application returned to the family for correction",
  });

  return { rejectionId, assessmentReset };
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** The banner's words (her 16 Oct wording), then staff's note on its own. */
export function returnNoticeText(notice: ReturnNotice): { headline: string; message: string | null } {
  const by = notice.submitBy ? ` and resubmit by ${LONG_DATE.format(notice.submitBy)}` : " and resubmit";
  return {
    headline:
      `This application was returned to you for correction on ${LONG_DATE.format(notice.returnedOn)}. ` +
      `Please correct the sections without a green tick${by}.`,
    message: notice.message,
  };
}
