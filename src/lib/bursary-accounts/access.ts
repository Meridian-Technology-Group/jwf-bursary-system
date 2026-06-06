/**
 * Epic 10 — portal-access revocation keyed on account state (Decision D18).
 *
 * A parent retains live portal access iff they have:
 *   - at least one ACTIVE BursaryAccount, OR
 *   - an in-flight application (no terminal outcome yet — still being assessed).
 *
 * A parent whose only account is CLOSED, or whose application was declined /
 * archived with no other active relationship, loses portal access and is sent
 * to a read-only "your bursary has concluded" page. This is an ACCESS state
 * change, NOT erasure — `Profile.role = DELETED` is reserved for true GDPR
 * erasure (D18). Revocation is reversible: a re-award re-activates the account
 * (see promoteToActiveAccount) and access returns automatically.
 *
 * Implemented as a layout/server-component guard (it needs Prisma, which Edge
 * middleware lacks) rather than a JWT claim — simpler, no refresh races, easy to
 * revert. The pure predicate below is unit-tested; the DB read lives in
 * `loadPortalAccessState`.
 */

import type { Tx } from "@/lib/db/prisma";
import type { AssessmentOutcome, BursaryAccountStatus } from "@prisma/client";

/** Outcomes that mean an application is finished (no longer in-flight). */
const TERMINAL_OUTCOMES: AssessmentOutcome[] = [
  "DOES_NOT_QUALIFY",
  "QUALIFIES_NOT_AWARDED",
  "AWARDED",
  // Legacy QUALIFIES is treated as terminal for access purposes.
  "QUALIFIES",
];

/** The minimal facts the access predicate reasons over. */
export interface PortalAccessInput {
  /** Statuses of every BursaryAccount the parent leads. */
  accountStatuses: BursaryAccountStatus[];
  /**
   * For each application the parent leads: its assessment outcome (null when no
   * assessment / no outcome yet). A null outcome ⇒ the application is in-flight.
   */
  applicationOutcomes: (AssessmentOutcome | null)[];
}

/** True iff at least one application is still being assessed (no terminal outcome). */
function hasInFlightApplication(outcomes: (AssessmentOutcome | null)[]): boolean {
  return outcomes.some((o) => o == null || !TERMINAL_OUTCOMES.includes(o));
}

/**
 * Pure: decide whether a parent keeps live portal access.
 * Access iff ≥1 ACTIVE account OR ≥1 in-flight application.
 */
export function hasPortalAccess(input: PortalAccessInput): boolean {
  const hasActiveAccount = input.accountStatuses.some((s) => s === "ACTIVE");
  return hasActiveAccount || hasInFlightApplication(input.applicationOutcomes);
}

/**
 * Loads the access-relevant facts for a lead applicant and decides access.
 * Runs under the caller's RLS context (the portal layout passes the user's tx).
 */
export async function loadPortalAccessState(
  tx: Tx,
  leadApplicantId: string
): Promise<{ hasAccess: boolean; input: PortalAccessInput }> {
  const [accounts, applications] = await Promise.all([
    tx.bursaryAccount.findMany({
      where: { leadApplicantId },
      select: { status: true },
    }),
    tx.application.findMany({
      where: { leadApplicantId },
      select: { assessment: { select: { outcome: true } } },
    }),
  ]);

  const input: PortalAccessInput = {
    accountStatuses: accounts.map((a) => a.status),
    applicationOutcomes: applications.map((a) => a.assessment?.outcome ?? null),
  };

  return { hasAccess: hasPortalAccess(input), input };
}
