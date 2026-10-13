/**
 * Epic 21 F3 (CR-002 Phase 4) — who gets a re-assessment invitation.
 *
 * An account is invited to a round only if it is ACTIVE and its schedule has a
 * SCHEDULED year for that round. Before this, every ACTIVE account not yet
 * invited was eligible, ignoring the schedule entirely: a Year 13 family (no
 * 2027-28 year) or an account whose schedule an ADMIN ended (Epic 21 #4) would
 * still have been invited next spring.
 *
 * One predicate, used by the batch and selective invite actions and the
 * queue's "re-assessment eligible" filter (all via `getActiveBursaryHolders`),
 * and checked again by `createReassessmentApplicationAction`.
 */

import { BursaryAccountStatus, ScheduleEntryStatus, type Prisma } from "@prisma/client";
import { scheduleYearLabels } from "@/lib/bursary-accounts/lifecycle";

export function reassessmentEligibleWhere(
  roundAcademicYear: string
): Prisma.BursaryAccountWhereInput {
  return {
    status: BursaryAccountStatus.ACTIVE,
    scheduleEntries: {
      some: {
        status: ScheduleEntryStatus.SCHEDULED,
        // Rounds say "2026/27", schedule rows "2026-27": match either spelling.
        academicYear: { in: scheduleYearLabels(roundAcademicYear) },
      },
    },
  };
}
