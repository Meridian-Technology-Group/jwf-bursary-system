/**
 * Re-assessment database queries.
 *
 * Supports the year-on-year re-assessment flow where applicants already
 * hold an active bursary and are invited to submit updated financials.
 */

import type { Tx } from "@/lib/db/prisma";
import type { ApplicationSectionType, Invitation } from "@prisma/client";
import { generateApplicationReference } from "@/lib/applications/reference";

// ─── Section types that are pre-populated from the previous year ─────────────

/**
 * Sections that carry over personal/family data from the previous year.
 * These are pre-populated for re-assessments.
 */
export const PREPOPULATED_SECTIONS: ApplicationSectionType[] = [
  "CHILD_DETAILS",
  "PARENT_DETAILS",
  "DEPENDENT_CHILDREN",
  "DEPENDENT_ELDERLY",
];

/**
 * Sections that must be completed fresh for re-assessments (no pre-population).
 */
export const FINANCIAL_SECTIONS: ApplicationSectionType[] = [
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
];

/**
 * Section hidden entirely during re-assessments (documents already on file).
 */
export const HIDDEN_REASSESSMENT_SECTIONS: ApplicationSectionType[] = [
  "FAMILY_ID",
];

// ─── getPreviousYearApplication ───────────────────────────────────────────────

export interface PreviousYearApplication {
  id: string;
  reference: string;
  roundId: string;
  round: { academicYear: string };
  sections: {
    section: ApplicationSectionType;
    data: unknown;
    isComplete: boolean;
  }[];
  assessment: {
    totalHouseholdNetIncome: string | null;
    netAssetsYearlyValuation: string | null;
    requiredBursary: string | null;
    yearlyPayableFees: string | null;
    monthlyPayableFees: string | null;
    bursaryAward: string | null;
    schoolingYearsRemaining: number | null;
  } | null;
}

/**
 * Returns the most recent application for a bursary account that is NOT in
 * the current round. Includes section data and assessment snapshot for
 * year-on-year comparison.
 */
export async function getPreviousYearApplication(
  tx: Tx,
  bursaryAccountId: string,
  currentRoundId: string
): Promise<PreviousYearApplication | null> {
  const application = await tx.application.findFirst({
    where: {
      bursaryAccountId,
      roundId: { not: currentRoundId },
      status: {
        in: ["SUBMITTED", "COMPLETED", "QUALIFIES", "DOES_NOT_QUALIFY"],
      },
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      reference: true,
      roundId: true,
      round: {
        select: { academicYear: true },
      },
      sections: {
        select: { section: true, data: true, isComplete: true },
      },
      assessment: {
        select: {
          totalHouseholdNetIncome: true,
          netAssetsYearlyValuation: true,
          requiredBursary: true,
          yearlyPayableFees: true,
          monthlyPayableFees: true,
          bursaryAward: true,
          schoolingYearsRemaining: true,
        },
      },
    },
  });

  if (!application) return null;

  return {
    id: application.id,
    reference: application.reference,
    roundId: application.roundId,
    round: application.round,
    sections: application.sections.map((s) => ({
      section: s.section,
      data: s.data,
      isComplete: s.isComplete,
    })),
    assessment: application.assessment
      ? {
          totalHouseholdNetIncome:
            application.assessment.totalHouseholdNetIncome?.toString() ?? null,
          netAssetsYearlyValuation:
            application.assessment.netAssetsYearlyValuation?.toString() ?? null,
          requiredBursary:
            application.assessment.requiredBursary?.toString() ?? null,
          yearlyPayableFees:
            application.assessment.yearlyPayableFees?.toString() ?? null,
          monthlyPayableFees:
            application.assessment.monthlyPayableFees?.toString() ?? null,
          bursaryAward:
            application.assessment.bursaryAward?.toString() ?? null,
          schoolingYearsRemaining:
            application.assessment.schoolingYearsRemaining ?? null,
        }
      : null,
  };
}

// ─── prepopulateReassessment ──────────────────────────────────────────────────

/**
 * Copies personal section data from a previous application to the current one.
 *
 * - Copies: CHILD_DETAILS, PARENT_DETAILS, DEPENDENT_CHILDREN, DEPENDENT_ELDERLY
 * - Skips: FAMILY_ID (hidden), PARENTS_INCOME, ASSETS_LIABILITIES (must be fresh)
 * - Marks financial sections as not complete so applicant must fill them in
 *
 * This is idempotent — safe to call multiple times (uses upsert).
 */
export async function prepopulateReassessment(
  tx: Tx,
  applicationId: string,
  previousApplicationId: string
): Promise<void> {
  // Load previous year's personal sections
  const previousSections = await tx.applicationSection.findMany({
    where: {
      applicationId: previousApplicationId,
      section: { in: PREPOPULATED_SECTIONS },
    },
    select: { section: true, data: true },
  });

  if (previousSections.length === 0) return;

  // Upsert each section into the current application
  await Promise.all(
    previousSections.map((prev) =>
      tx.applicationSection.upsert({
        where: {
          applicationId_section: {
            applicationId,
            section: prev.section,
          },
        },
        create: {
          applicationId,
          section: prev.section,
          data: prev.data as never,
          isComplete: true,
        },
        update: {
          // Only pre-populate if the section has not been saved yet
          // (do not overwrite data the applicant has already entered)
          data: prev.data as never,
          isComplete: true,
        },
      })
    )
  );

  // Ensure financial sections exist but are marked incomplete
  await Promise.all(
    FINANCIAL_SECTIONS.map((section) =>
      tx.applicationSection.upsert({
        where: {
          applicationId_section: { applicationId, section },
        },
        create: {
          applicationId,
          section,
          data: {},
          isComplete: false,
        },
        update: {
          // Leave data unchanged if the applicant has already started it
        },
      })
    )
  );
}

// ─── createReassessmentApplicationFromInvitation ──────────────────────────────

/**
 * Creates a re-assessment application from a re-assessment invitation and
 * pre-populates the personal sections from the previous year.
 *
 * Shared by both applicant-side entry points (the `/register?token=…` accept
 * path and the portal "Begin re-assessment" card) so they produce an
 * identical, fully prepopulated PRE_SUBMISSION application linked to the
 * holder's existing bursary account.
 *
 * Idempotent: if the lead applicant already has a PRE_SUBMISSION application
 * for this round it is returned unchanged rather than duplicated.
 *
 * The caller must have already validated that `invitation.bursaryAccountId`
 * and `invitation.roundId` are set (this is a re-assessment invite). Must run
 * inside an admin context — `prepopulateReassessment` reads the previous
 * application's sections across applications.
 */
export async function createReassessmentApplicationFromInvitation(
  tx: Tx,
  invitation: Pick<
    Invitation,
    "authUserId" | "bursaryAccountId" | "roundId" | "school" | "childName"
  >
): Promise<{ id: string; created: boolean }> {
  const { authUserId, bursaryAccountId, roundId } = invitation;
  if (!authUserId || !bursaryAccountId || !roundId) {
    throw new Error(
      "createReassessmentApplicationFromInvitation requires authUserId, bursaryAccountId and roundId"
    );
  }

  // Idempotency: reuse an existing in-progress application for this round.
  const existing = await tx.application.findFirst({
    where: {
      leadApplicantId: authUserId,
      roundId,
      status: "PRE_SUBMISSION",
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  // Resolve school + childName, preferring the invitation, falling back to
  // the bursary account so the application always has them.
  const account = await tx.bursaryAccount.findUnique({
    where: { id: bursaryAccountId },
    select: {
      school: true,
      childName: true,
      childDob: true,
      entryYear: true,
    },
  });

  const school = invitation.school ?? account?.school;
  const childName = invitation.childName ?? account?.childName;
  if (!school || !childName) {
    throw new Error(
      "Could not resolve school / child name for the re-assessment application"
    );
  }

  const round = await tx.round.findUnique({
    where: { id: roundId },
    select: { academicYear: true },
  });
  const reference = await generateApplicationReference(
    tx,
    school,
    round?.academicYear ?? ""
  );

  const application = await tx.application.create({
    data: {
      reference,
      roundId,
      leadApplicantId: authUserId,
      bursaryAccountId,
      school,
      childName,
      childDob: account?.childDob ?? null,
      entryYear: account?.entryYear ?? null,
      isReassessment: true,
      status: "PRE_SUBMISSION",
    },
  });

  // Pre-populate personal sections from the most recent previous-year app.
  const previous = await getPreviousYearApplication(
    tx,
    bursaryAccountId,
    roundId
  );
  if (previous) {
    await prepopulateReassessment(tx, application.id, previous.id);
  }

  return { id: application.id, created: true };
}

// ─── getPreviousAssessment ────────────────────────────────────────────────────

export interface PreviousAssessmentSnapshot {
  applicationReference: string;
  academicYear: string;
  totalHouseholdNetIncome: string | null;
  netAssetsYearlyValuation: string | null;
  hndiAfterNs: string | null;
  requiredBursary: string | null;
  grossFees: string | null;
  bursaryAward: string | null;
  yearlyPayableFees: string | null;
  monthlyPayableFees: string | null;
  schoolingYearsRemaining: number | null;
}

/**
 * Returns the assessment from the previous year for a given bursary account.
 * Used in the admin year-on-year comparison component.
 */
export async function getPreviousAssessment(
  tx: Tx,
  bursaryAccountId: string,
  currentRoundId: string
): Promise<PreviousAssessmentSnapshot | null> {
  const previous = await tx.application.findFirst({
    where: {
      bursaryAccountId,
      roundId: { not: currentRoundId },
      assessment: { isNot: null },
    },
    orderBy: { submittedAt: "desc" },
    select: {
      reference: true,
      round: { select: { academicYear: true } },
      assessment: {
        select: {
          totalHouseholdNetIncome: true,
          netAssetsYearlyValuation: true,
          hndiAfterNs: true,
          requiredBursary: true,
          grossFees: true,
          bursaryAward: true,
          yearlyPayableFees: true,
          monthlyPayableFees: true,
          schoolingYearsRemaining: true,
        },
      },
    },
  });

  if (!previous?.assessment) return null;

  const a = previous.assessment;
  return {
    applicationReference: previous.reference,
    academicYear: previous.round.academicYear,
    totalHouseholdNetIncome: a.totalHouseholdNetIncome?.toString() ?? null,
    netAssetsYearlyValuation: a.netAssetsYearlyValuation?.toString() ?? null,
    hndiAfterNs: a.hndiAfterNs?.toString() ?? null,
    requiredBursary: a.requiredBursary?.toString() ?? null,
    grossFees: a.grossFees?.toString() ?? null,
    bursaryAward: a.bursaryAward?.toString() ?? null,
    yearlyPayableFees: a.yearlyPayableFees?.toString() ?? null,
    monthlyPayableFees: a.monthlyPayableFees?.toString() ?? null,
    schoolingYearsRemaining: a.schoolingYearsRemaining ?? null,
  };
}
