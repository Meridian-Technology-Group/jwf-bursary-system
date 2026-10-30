/**
 * Shared value helpers for the three export sections (Epic 23 T4).
 *
 * Every rule a section column applies lives here once, so Section 1, 2 and 3
 * agree: money as numbers (never strings), v2-only values blank (never zero)
 * on v1 assessments (D-10), the two household counts blank on migrated
 * applications (D-9), siblings flattened to three slots (D-15).
 *
 * Pure: no DB, no React.
 */

import type {
  ApplicationFormStatus,
  ApplicationType,
  AssessmentStatus,
  AwardFundType,
  BursaryAccountStatus,
} from "@prisma/client";
import { AWARD_FUND_LABELS } from "@/lib/assessment/award-fund";
import {
  formatPostcodeAreaLabel,
  normalisePostcodeDistrict,
  type PostcodeAreaRow,
} from "@/lib/assessment/postcode-area";
import { schoolYearForEntryYearGroup } from "@/lib/assessment/schooling-years";
import { schoolName } from "@/lib/schools";

/** A Prisma Decimal / number / numeric string → number; null/undefined/NaN → null. */
export function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Round to pennies (money columns built from arithmetic). */
export function money(value: number | null): number | null {
  return value == null ? null : Math.round(value * 100) / 100;
}

/** D-10: a v2-only figure is blank on a v1 assessment, whatever the column holds. */
export function v2Only<T>(calculationVersion: number | null | undefined, value: T | null): T | null {
  return calculationVersion === 2 ? value : null;
}

/** D-9: the household counts are blank for Grant Tracker (or any migrated) applications. */
export function inSystemOnly<T>(migrationSource: string | null | undefined, value: T | null): T | null {
  return migrationSource ? null : value;
}

export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  NEW: "New Application",
  ROLLING_OVER: "Rolling-Over Application",
};

export function applicationTypeLabel(t: ApplicationType | null | undefined): string {
  return t ? APPLICATION_TYPE_LABELS[t] : "";
}

/** Assessment statuses as staff read them on the assessment page. */
export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PAUSED: "Paused",
  COMPLETED: "Stored as complete",
  NEW_AWARD: "New award",
  ROLLED_OVER: "Rolled over",
  WAITING_LIST: "Waiting list",
  CLOSED_ARCHIVED: "Closed & archived",
};

export function assessmentStatusLabel(s: AssessmentStatus | null | undefined): string {
  return s ? ASSESSMENT_STATUS_LABELS[s] : "";
}

/** D-8: an application's account state, including "no account yet" (pre-award). */
export type AccountState = "ACTIVE" | "CLOSED" | "NONE";

export const ACCOUNT_STATE_LABELS: Record<AccountState, string> = {
  ACTIVE: "Active",
  CLOSED: "Closed",
  NONE: "No account yet",
};

export function accountState(status: BursaryAccountStatus | null | undefined): AccountState {
  return status ?? "NONE";
}

export function accountStateLabel(status: BursaryAccountStatus | null | undefined): string {
  return ACCOUNT_STATE_LABELS[accountState(status)];
}

/** D-5: the fund the award is paid from, with the app's labels. */
export function awardFundLabel(fund: AwardFundType | null | undefined): string {
  return fund ? AWARD_FUND_LABELS[fund] : "";
}

/** "Trinity", "Whitgift", "OP partner" — the short names used across admin tables. */
export function schoolLabel(school: string | null | undefined): string {
  return schoolName(school, "short");
}

/** Y8 → 8; OTHER / unknown → null. */
export function schoolYearNumber(group: string | null | undefined): number | null {
  return schoolYearForEntryYearGroup(group);
}

/** "SM4 5AB" / "sm4" → "SM4"; blank → "". */
export function postcodeOutward(postcode: string | null | undefined): string {
  return normalisePostcodeDistrict(postcode);
}

/**
 * The postcode as the assessment page shows it, with the neighbourhood name
 * from Settings' postcode areas: "SW19" → "SW19-WIMBLEDON" (Charlotte, 17 Oct
 * 2026). Without the area list (a caller that hasn't loaded it) it falls back
 * to the outward code rather than inventing "-OTHER". Blank → "".
 */
export function postcodeAreaLabel(
  postcode: string | null | undefined,
  areas?: readonly PostcodeAreaRow[],
): string {
  if (!areas) return postcodeOutward(postcode);
  return formatPostcodeAreaLabel(postcode, areas) ?? "";
}

/** "code – label" joined, in the order given (callers sort by the code list's order). */
export function codeLabels(codes: readonly { code: number; label: string }[]): string {
  return codes.map((c) => `${c.code} – ${c.label}`).join(", ");
}

export interface SiblingSlot {
  name: string;
  school: string;
  payableFees: number | null;
}

/**
 * D-15: `Assessment.siblingDetails` (Part 1 name + award-tab school / net
 * payable fees, up to three) → exactly three slots, blanks where absent.
 * Tolerates any JSON: non-arrays and malformed entries read as empty.
 */
export function flattenSiblings(details: unknown): [SiblingSlot, SiblingSlot, SiblingSlot] {
  const list = Array.isArray(details) ? details : [];
  const slot = (i: number): SiblingSlot => {
    const d = list[i];
    if (!d || typeof d !== "object") return { name: "", school: "", payableFees: null };
    const o = d as { name?: unknown; school?: unknown; netPayableFees?: unknown };
    return {
      name: typeof o.name === "string" ? o.name.trim() : "",
      school: typeof o.school === "string" ? schoolLabel(o.school) : "",
      payableFees: num(o.netPayableFees),
    };
  };
  return [slot(0), slot(1), slot(2)];
}

/** D-9: parents counted from the assessment's earner rows (PARENT_1 / PARENT_2). */
export function parentCount(earners: readonly { earnerLabel: string }[]): number {
  return new Set(earners.map((e) => e.earnerLabel).filter((l) => l === "PARENT_1" || l === "PARENT_2")).size;
}

/** D-13: Section 1's three submission states. */
export type SubmissionStatus = "Not yet started" | "Started" | "Submitted";

export function submissionStatus(formStatus: ApplicationFormStatus | null | undefined): SubmissionStatus {
  switch (formStatus) {
    case "SUBMITTED":
      return "Submitted";
    case "IN_PROGRESS":
    case "FILLED_IN":
      return "Started";
    default:
      return "Not yet started";
  }
}

/** End of a "YYYY-MM-DD" day in UTC, for inclusive date-range filters. */
export function endOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export function startOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}
