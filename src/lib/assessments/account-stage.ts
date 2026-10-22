/**
 * account-stage.ts — the "Bursary account" column of the Assessments list.
 *
 * Charlotte, 22 Oct 2026, after the retention trial: an application closed
 * before it became an award and one still being assessed both read "No
 * account", *"so now the system tells me that a completed application that is
 * complete and not yet closed, is showing with the same account status as one
 * that has been closed and archived. Maybe we could have 'Pre-bursary Open' &
 * 'Pre-Bursary Closed' and then Active and Closed."*
 *
 * An account's own status always wins. Without one, the application is
 * pre-bursary CLOSED once staff closed it, archived it (or its assessment), or
 * it was erased on request — any retention stage means it is finished.
 *
 * Pure module — no DB, no React.
 */

import type { AssessmentStatus, BursaryAccountStatus } from "@prisma/client";

export type AccountStage = BursaryAccountStatus | "PRE_OPEN" | "PRE_CLOSED";

export const ACCOUNT_STAGES: readonly AccountStage[] = ["ACTIVE", "CLOSED", "PRE_OPEN", "PRE_CLOSED"];

export const ACCOUNT_STAGE_LABELS: Record<AccountStage, string> = {
  ACTIVE: "Active",
  CLOSED: "Closed",
  PRE_OPEN: "Pre-bursary open",
  PRE_CLOSED: "Pre-bursary closed",
};

export interface AccountStageInput {
  /** The bursary account's status, or null when there is no account. */
  accountStatus: BursaryAccountStatus | null;
  closedAt: Date | null;
  archivedAt: Date | null;
  assessmentStatus: AssessmentStatus | null;
  /** `Application.retentionStage` — set by any purge or erasure. */
  retentionStage: string | null;
}

export function deriveAccountStage(input: AccountStageInput): AccountStage {
  if (input.accountStatus) return input.accountStatus;
  const finished =
    input.closedAt != null ||
    input.archivedAt != null ||
    input.assessmentStatus === "CLOSED_ARCHIVED" ||
    input.retentionStage != null;
  return finished ? "PRE_CLOSED" : "PRE_OPEN";
}

export function isAccountStage(value: string | undefined): value is AccountStage {
  return value != null && (ACCOUNT_STAGES as readonly string[]).includes(value);
}
