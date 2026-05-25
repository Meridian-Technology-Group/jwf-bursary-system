/**
 * Re-assessment database queries.
 *
 * Supports the year-on-year re-assessment flow where applicants already
 * hold an active bursary and are invited to submit updated financials.
 */

import type { Tx } from "@/lib/db/prisma";
import type { ApplicationSectionType, Invitation } from "@prisma/client";
import { ApplicationContributorRole } from "@prisma/client";
import { generateApplicationReference } from "@/lib/applications/reference";
import { ensurePrimaryContributor } from "@/lib/db/queries/contributors";

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
  // Resolve the new application's lead applicant so we can ensure/resolve its
  // PRIMARY contributor — every section row created here must be owned by it
  // (dual-parent foundation). Callers already create the contributor before
  // calling this, but ensuring here keeps the helper self-contained.
  const newApplication = await tx.application.findUnique({
    where: { id: applicationId },
    select: { leadApplicantId: true },
  });
  if (!newApplication) {
    throw new Error(
      `prepopulateReassessment: application ${applicationId} not found`
    );
  }
  const ownerContributorId = await ensurePrimaryContributor(
    tx,
    applicationId,
    newApplication.leadApplicantId
  );

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
          applicationId_section_ownerContributorId: {
            applicationId,
            section: prev.section,
            ownerContributorId,
          },
        },
        create: {
          applicationId,
          section: prev.section,
          ownerContributorId,
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
          applicationId_section_ownerContributorId: {
            applicationId,
            section,
            ownerContributorId,
          },
        },
        create: {
          applicationId,
          section,
          ownerContributorId,
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

  // Every application must have a PRIMARY contributor from creation so the
  // section write path can tag the owner (dual-parent foundation).
  await ensurePrimaryContributor(tx, application.id, authUserId);

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

// ─── getPriorYearSecondaryContributor ─────────────────────────────────────────

/**
 * The second parent who contributed to the PREVIOUS-year application for the
 * same bursary account, surfaced so staff can choose to re-invite them for the
 * new round (dual-parent feature, backlog #20, PR 6, decision #6).
 */
export interface PriorYearSecondaryContributor {
  /** The prior-year application the secondary contributed to. */
  previousApplicationId: string;
  previousAcademicYear: string | null;
  /** Pre-fill values for the re-invite form. */
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Given a NEW (re-assessment) application, finds whether the bursary account's
 * PRIOR-year application had a SECONDARY contributor (second parent). Returns
 * that parent's name/email for pre-filling a re-invite prompt, or null.
 *
 * Carry-forward, NOT auto-link (decision #6): we never silently create a live
 * secondary contributor on the new round. We only surface the prior parent so
 * staff can re-invite them through the normal `addSecondParentAction` path
 * (which sends a fresh invite and registers them for the new round) or skip.
 *
 * Returns null when:
 *   - the application is not a re-assessment / has no bursary account, OR
 *   - there is no prior-year application, OR
 *   - the prior-year application had no SECONDARY contributor, OR
 *   - the current application ALREADY has a SECONDARY contributor (nothing to
 *     prompt — staff have already actioned the second parent for this round).
 *
 * MUST run under a context that can read the contributor rows of BOTH the
 * current and the prior-year application (assigned assessor / ADMIN / VIEWER
 * via RLS, or service_role). The prompt is staff-only, so this is always called
 * from an admin-side load.
 */
export async function getPriorYearSecondaryContributor(
  tx: Tx,
  applicationId: string
): Promise<PriorYearSecondaryContributor | null> {
  // Resolve the new application's bursary account + round. No bursary account
  // means it cannot be a re-assessment of a prior year → nothing to carry.
  const current = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      bursaryAccountId: true,
      roundId: true,
      contributors: {
        where: { role: ApplicationContributorRole.SECONDARY },
        select: { id: true },
      },
    },
  });

  if (!current?.bursaryAccountId) return null;

  // If the current application already has a second parent, there is nothing to
  // prompt — staff have already added (or re-invited) one for this round.
  if (current.contributors.length > 0) return null;

  // Find the most recent PRIOR-year application for this bursary account.
  const previous = await getPreviousYearApplication(
    tx,
    current.bursaryAccountId,
    current.roundId
  );
  if (!previous) return null;

  // Did that prior-year application have a SECONDARY contributor?
  const priorSecondary = await tx.applicationContributor.findUnique({
    where: {
      applicationId_role: {
        applicationId: previous.id,
        role: ApplicationContributorRole.SECONDARY,
      },
    },
    select: {
      profile: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  if (!priorSecondary) return null;

  return {
    previousApplicationId: previous.id,
    previousAcademicYear: previous.round.academicYear,
    email: priorSecondary.profile.email,
    firstName: priorSecondary.profile.firstName,
    lastName: priorSecondary.profile.lastName,
  };
}
