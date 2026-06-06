/**
 * Epic 08 — outcome → rolling-account promotion interface (the Epic 10 seam).
 *
 * When an application is AWARDED it becomes the entry point into the rolling
 * BursaryAccount lifecycle: continue the existing account (a re-assessment that
 * already carries one) or create a new ACTIVE account, recording the granted
 * bursary AND scholarship awards the account carries forward.
 *
 * The *forward round-schedule generation* on award is owned by **Epic 10**.
 * This module defines the interface 08 calls and ships a DEFAULT implementation
 * that preserves today's behaviour exactly — "create an ACTIVE account, no
 * schedule". Epic 10 replaces `promoteToActiveAccount` (or wraps it) to add the
 * schedule without touching the outcome writer.
 *
 * Idempotency contract: the caller must only invoke this when the outcome is
 * AWARDED. The implementation MUST NOT create a second account when one is
 * already linked (`application.bursaryAccountId != null`) — a re-assessment
 * continues its existing account. It returns whether an account was created and
 * the resolved account id, so the caller can derive the AWARDED-vs-not signal
 * and write audit metadata without re-querying.
 */

import type { Tx } from "@/lib/db/prisma";
import { generateBursaryAccountReference } from "@/lib/bursary-accounts/reference";
import type { School, EntryYearGroup } from "@prisma/client";

/** The bursary + scholarship awards an AWARDED outcome grants. */
export interface AwardFigures {
  /** Means-tested bursary award (£). */
  bursaryAward: number | null;
  /** Distinct merit/academic scholarship award (£), Decision D9. */
  scholarshipAward: number | null;
}

/** The application fields the promotion needs (a narrow, query-shaped view). */
export interface PromotionApplication {
  id: string;
  school: School;
  childName: string;
  childDob: Date | null;
  entryYear: number | null;
  entryYearGroup: EntryYearGroup | null;
  bursaryAccountId: string | null;
  leadApplicantId: string;
  round: { academicYear: string };
  assessment: { yearlyPayableFees: unknown } | null;
}

export interface PromotionResult {
  /** The bursary account this award resolves to (existing or freshly created). */
  bursaryAccountId: string;
  /** True when a new account was created (vs continuing an existing one). */
  created: boolean;
}

/**
 * Promote an AWARDED application onto its rolling ACTIVE BursaryAccount.
 *
 * Default (Epic 08) behaviour:
 *   - existing account linked → continue it (no new account); returns created=false.
 *   - no account linked       → create an ACTIVE account, link the application,
 *                               carry the bursary + scholarship awards forward.
 *
 * Epic 10 extends this behind the same signature to also generate the forward
 * round schedule; the outcome writer (set-outcome-core) is unaffected.
 */
export async function promoteToActiveAccount(
  tx: Tx,
  application: PromotionApplication,
  awards: AwardFigures
): Promise<PromotionResult> {
  // Idempotent: a re-assessment already carries its rolling account — continue it.
  if (application.bursaryAccountId != null) {
    return { bursaryAccountId: application.bursaryAccountId, created: false };
  }

  const reference = await generateBursaryAccountReference(
    tx,
    application.round.academicYear
  );

  // BursaryAccount.entryYear is required; fall back to the round's starting
  // academic year (e.g. "2025/2026" -> 2025) when the application did not
  // capture an explicit entry year.
  const entryYear =
    application.entryYear ??
    parseInt(application.round.academicYear.slice(0, 4), 10);

  const benchmarkPayableFees =
    application.assessment?.yearlyPayableFees != null
      ? (application.assessment.yearlyPayableFees as never)
      : null;

  const account = await tx.bursaryAccount.create({
    data: {
      reference,
      school: application.school,
      childName: application.childName,
      childDob: application.childDob,
      entryYear,
      entryYearGroup: application.entryYearGroup,
      firstAssessmentYear: application.round.academicYear,
      benchmarkPayableFees,
      leadApplicantId: application.leadApplicantId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await tx.application.update({
    where: { id: application.id },
    data: { bursaryAccountId: account.id },
  });

  // NOTE (Epic 10 seam): the granted bursary + scholarship awards (`awards`) are
  // recorded on the Recommendation (Epic 08) and will be persisted onto the
  // BursaryAccount + drive the forward schedule here once Epic 10 adds the
  // account-side columns. Referenced now so the interface is stable.
  void awards;

  return { bursaryAccountId: account.id, created: true };
}
