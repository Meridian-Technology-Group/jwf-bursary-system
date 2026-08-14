/**
 * WP-10: Assessment Tab Page
 *
 * Server component. Fetches application + assessment data.
 *
 * States:
 *  1. No assessment record → shows "Begin Assessment" button (ASSESSOR only)
 *  2. Assessment exists → renders full split-screen workspace with form
 *
 * Requires ASSESSOR or VIEWER role. VIEWERs see a read-only form.
 *
 * Note on Decimal: All Prisma Decimal fields are converted to plain numbers
 * before being passed to client components (no Decimal objects cross the
 * server/client boundary).
 */

import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { Decimal } from "@prisma/client/runtime/library";
import { requireRole, Role, type CurrentUser } from "@/lib/auth/roles";
import {
  getApplicationWithDetails,
  getSectionData,
} from "@/lib/db/queries/applications";
import { getApplicationContributors } from "@/lib/db/queries/contributors";
import { buildContributorLabelMap } from "@/lib/contributors/dual-view";
import { getAssessment } from "@/lib/db/queries/assessments";
import {
  getConfigsForAssessment,
  getReferenceBundleRows,
} from "@/lib/db/queries/reference-tables";
import { resolveReferenceBundle } from "@/lib/assessment/v2/reference-bundle";
import { selectEngineVersion } from "@/lib/assessment/engine-version";
import {
  parentIncomeToAssessorRecord,
  assetsToPropertyAssets,
  assetsToDebts,
  derivePortfolioType,
  assetsToSavings,
  assetsToTransport,
} from "@/lib/assessment/v2/prefill";
import {
  AssessmentFormV2,
  type SerialisedAssessmentV2,
  type AssessmentV2Prefill,
} from "@/components/admin/assessment-form-v2";
import type {
  AssessorIncomeRecord,
  PropertyAssetsRecord,
  DebtsRecord,
} from "@/types/assessment-v2";
import type {
  ParentsIncomeData,
  AssetsLiabilitiesData,
} from "@/types/application";
import type { EntryYearGroupCode } from "@/lib/assessment/schooling-years";
import { feeYearLabels } from "@/lib/assessment/fee-year";
import {
  getPreviousAssessment,
  getPreviousWatchOutNotes,
} from "@/lib/db/queries/reassessment";
import { getSiblingLinks } from "@/lib/db/queries/siblings";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { YearComparison } from "@/components/admin/year-comparison";
import { BenchmarkDisplay } from "@/components/admin/benchmark-display";
import { SplitScreen } from "@/components/admin/split-screen";
import { AssessmentForm, type SerialisedAssessment } from "@/components/admin/assessment-form";
import { AssessmentSynopsis } from "@/components/admin/assessment-synopsis";
import { HouseholdDecisionAid } from "@/components/admin/household-decision-aid";
import { deriveHouseholdFromSources, type HouseholdSources } from "@/lib/household/from-sections";
import { deriveReviewPhase } from "@/lib/applications/status";
import { BeginAssessmentButton } from "@/components/admin/begin-assessment-button";
import { ReopenAssessmentBanner } from "@/components/admin/reopen-assessment-banner";
import { SecondParentGate } from "@/components/admin/second-parent-gate";
import { DocumentListClient } from "@/components/admin/document-list-client";
import { ClipboardList, Lightbulb } from "lucide-react";

export const metadata = {
  title: "Assessment",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(
  value: Decimal | string | number | null | undefined
): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

// ─── Re-assessment context panels (server components) ─────────────────────────

interface ReassessmentContextProps {
  applicationId: string;
  bursaryAccountId: string;
  roundId: string;
  academicYear: string;
  user: CurrentUser;
}

async function ReassessmentContext({
  applicationId: _applicationId,
  bursaryAccountId,
  roundId,
  academicYear,
  user,
}: ReassessmentContextProps) {
  const [previousAssessment, bursaryAccount] = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      Promise.all([
        getPreviousAssessment(tx, bursaryAccountId, roundId),
        tx.bursaryAccount.findUnique({
          where: { id: bursaryAccountId },
          select: {
            benchmarkPayableFees: true,
            firstAssessmentYear: true,
          },
        }),
      ])
  );

  const benchmarkPayableFees = toNumber(bursaryAccount?.benchmarkPayableFees);

  // Build current-year figure stub (no live assessment yet shown here; from DB)
  const current = {
    totalHouseholdNetIncome: null,
    netAssetsYearlyValuation: null,
    hndiAfterNs: null,
    requiredBursary: null,
    grossFees: null,
    bursaryAward: null,
    yearlyPayableFees: null,
    monthlyPayableFees: null,
  };

  return (
    <div className="space-y-4 mb-5">
      {benchmarkPayableFees != null && (
        <BenchmarkDisplay
          benchmarkPayableFees={benchmarkPayableFees}
          currentYearlyPayableFees={undefined}
        />
      )}
      <YearComparison
        previous={previousAssessment}
        current={current}
        currentAcademicYear={academicYear}
      />
    </div>
  );
}

// ─── Account context bar (CALC-10) ─────────────────────────────────────────────

interface AccountContextBarProps {
  applicationId: string;
  bursaryAccountId: string;
  user: CurrentUser;
}

/**
 * CALC-10 — the "Assessor's wizard" callout: the most recently COMPLETED
 * assessment's `watchOutNotes` for this bursary account, excluding the current
 * application. Renders nothing when there is no previous note, so it never adds
 * empty chrome to the page.
 *
 * Epic 13 (C4b / D13-1a): this bar also carried a read-only fees-account-code
 * field. That column is gone — reconciliation now rides on
 * `Application.reference` — so the account lookup and the two-way render guard
 * went with it, leaving the callout as the bar's only content.
 */
async function AccountContextBar({
  applicationId,
  bursaryAccountId,
  user,
}: AccountContextBarProps) {
  const watchOut = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => getPreviousWatchOutNotes(tx, bursaryAccountId, applicationId)
  );

  if (!watchOut) return null;

  return (
    <div className="mb-5">
      <div
        role="note"
        aria-label="Assessor's wizard"
        className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
      >
        <Lightbulb
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Assessor&apos;s wizard — from {watchOut.academicYear}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">
            {watchOut.watchOutNotes}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default async function AssessmentPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  const isViewer = user.role === Role.VIEWER;

  const { application, assessment, contributors, householdSources } =
    await withUserContext(
      user.id,
      user.role as RlsRole,
      async (tx) => {
        const app = await getApplicationWithDetails(tx, params.id);
        if (!app)
          return {
            application: null,
            assessment: null,
            contributors: [],
            householdSources: null as HouseholdSources | null,
          };
        const a = await getAssessment(tx, params.id);
        const ctribs = await getApplicationContributors(tx, params.id);

        // Epic 09: read the PRIMARY contributor's PARENT_DETAILS + OTHER_INFO
        // JSONB so the household decision aid can derive the scenario from the
        // same data the form branches on. Defensive — degrades to single
        // sole-parent when the primary or a section is absent.
        const primary = ctribs.find((c) => c.role === "PRIMARY");
        let household: HouseholdSources | null = null;
        if (primary) {
          const [pd, oi] = await Promise.all([
            getSectionData(tx, app.id, "PARENT_DETAILS", primary.id),
            getSectionData(tx, app.id, "OTHER_INFO", primary.id),
          ]);
          household = {
            parentDetails: (pd?.data ?? null) as HouseholdSources["parentDetails"],
            otherInfo: (oi?.data ?? null) as HouseholdSources["otherInfo"],
            applicationCustodyArrangement: app.custodyArrangement ?? null,
          };
        }

        return {
          application: app,
          assessment: a,
          contributors: ctribs,
          householdSources: household,
        };
      }
    );
  if (!application) notFound();

  // B1 — assessment-begin gate. A draft (not-yet-submitted) application reached
  // via the direct workspace URL must NOT render the begin/assessment workspace.
  // Funnel the lifecycle facts through `deriveReviewPhase` (the single source of
  // truth, also used by the server actions) rather than comparing formStatus by
  // hand: a PRE_SUBMISSION phase means the form has not been submitted, so send
  // the assessor back to the application detail page.
  const reviewPhase = deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: assessment?.status ?? null,
    outcome: assessment?.outcome ?? null,
    closedAt: application.closedAt,
  });
  if (reviewPhase === "PRE_SUBMISSION") {
    redirect(`/applications/${params.id}`);
  }

  // Derive the household scenario + handling (Epic 09) for the decision aid.
  const householdHandling = householdSources
    ? deriveHouseholdFromSources(householdSources)
    : null;

  // ── Dual-parent context ────────────────────────────────────────────────────
  // The SECONDARY contributor (second parent), if any, plus the PRIMARY's id
  // (used to anchor NULL-uploader legacy documents to "Parent 1"). When there
  // is NO secondary, everything below collapses to the single-parent behaviour.
  const primaryContributor = contributors.find((c) => c.role === "PRIMARY");
  const secondaryContributor = contributors.find((c) => c.role === "SECONDARY");
  const hasSubmittedSecondary =
    secondaryContributor?.status === "SUBMITTED";
  const hasUnsubmittedSecondary =
    !!secondaryContributor && secondaryContributor.status !== "SUBMITTED";

  // Document grouping passed to the workspace document list. Only built when a
  // secondary exists, so single-parent applications render exactly as before.
  const contributorGroups = secondaryContributor
    ? {
        labelByContributorId: Object.fromEntries(
          Object.entries(buildContributorLabelMap(contributors)).map(
            ([id, v]) => [id, v.shortLabel]
          )
        ),
        primaryContributorId: primaryContributor?.id ?? null,
      }
    : undefined;

  const { documents, isReassessment, bursaryAccountId, round } = application;

  // ── No assessment record yet ───────────────────────────────────────────────

  if (!assessment) {
    return (
      <div className="space-y-5">
        {/* CALC-10 — fees account code + assessor's-wizard callout */}
        {bursaryAccountId && (
          <AccountContextBar
            applicationId={params.id}
            bursaryAccountId={bursaryAccountId}
            user={user}
          />
        )}

        {/* Re-assessment context (if applicable) */}
        {isReassessment && bursaryAccountId && (
          <ReassessmentContext
            applicationId={params.id}
            bursaryAccountId={bursaryAccountId}
            roundId={application.roundId}
            academicYear={round.academicYear}
            user={user}
          />
        )}

        {/* Begin assessment CTA. When a second parent was invited but has not
            submitted and there is no override yet, the gate blocks Begin and
            offers the "proceed without second parent" control instead. */}
        {!isViewer && hasUnsubmittedSecondary && secondaryContributor ? (
          <SecondParentGate
            applicationId={params.id}
            secondaryStatus={secondaryContributor.status}
            secondaryName={
              [secondaryContributor.firstName, secondaryContributor.lastName]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              secondaryContributor.email ||
              "Second parent"
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <ClipboardList
              className="h-12 w-12 text-slate-200"
              aria-hidden="true"
            />
            <div>
              <p className="text-base font-semibold text-slate-700">
                Assessment not yet started
              </p>
              <p className="mt-1.5 text-sm text-slate-400">
                Begin the assessment to open the workspace with all documents
                and income entry forms.
              </p>
            </div>

            {!isViewer && <BeginAssessmentButton applicationId={params.id} />}

            {isViewer && hasUnsubmittedSecondary && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                Awaiting the second parent&apos;s submission
              </p>
            )}

            {isViewer && (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
                Viewer access — assessment can only be started by an Assessor
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Assessment exists — build full workspace ───────────────────────────────

  // Load reference configs + sibling links under RLS context
  const { configs, siblingPayableFees } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const cfgs = await getConfigsForAssessment(
        tx,
        application.school,
        assessment.familyTypeCategory ?? undefined,
        // Epic 07: the round's academic year anchors the fee-year resolution
        // (current + next-year fees). D5 nominates Round.academicYear as the
        // canonical year source.
        round.academicYear
      );

      // Load sibling payable fees for sequential income absorption.
      // Only siblings with a lower priority order than this child are used —
      // i.e., siblings that come before this child in the family group.
      const siblingFees: number[] = [];
      if (bursaryAccountId) {
        const siblingLinks = await getSiblingLinks(tx, bursaryAccountId);
        const ownLink = siblingLinks.find((s) => s.bursaryAccountId === bursaryAccountId);
        if (ownLink) {
          const olderSiblings = siblingLinks.filter(
            (s) =>
              s.bursaryAccountId !== bursaryAccountId &&
              s.priorityOrder < ownLink.priorityOrder
          );
          for (const sibling of olderSiblings) {
            if (sibling.bursaryAccount.latestPayableFees !== null) {
              siblingFees.push(sibling.bursaryAccount.latestPayableFees);
            }
          }
        }
      }
      return { configs: cfgs, siblingPayableFees: siblingFees };
    }
  );

  // ── CALC-07 — engine dispatch. v1 assessments keep the OLD form/engine/save
  // path byte-for-byte; only `calculationVersion: 2` assessments get the v2
  // form. The branch lives here at the page level (implementation-plan §CALC-07).
  const engineVersion = selectEngineVersion(assessment.calculationVersion);

  // For v2, additionally load the ReferenceBundle for the round's academic year
  // and the family's submitted income/assets sections (for first-load pre-fill).
  const v2Sources =
    engineVersion === "v2"
      ? await withUserContext(user.id, user.role as RlsRole, async (tx) => {
          const rows = await getReferenceBundleRows(tx);
          const primaryId = primaryContributor?.id;
          const [incomeSec, assetsSec] = primaryId
            ? await Promise.all([
                getSectionData(tx, application.id, "PARENTS_INCOME", primaryId),
                getSectionData(tx, application.id, "ASSETS_LIABILITIES", primaryId),
              ])
            : [null, null];
          // A submitted second parent supplies Parent 2's income from their own
          // PARENTS_INCOME section; otherwise the primary's parent2Income is used.
          const secondaryIncomeSec =
            hasSubmittedSecondary && secondaryContributor
              ? await getSectionData(
                  tx,
                  application.id,
                  "PARENTS_INCOME",
                  secondaryContributor.id
                )
              : null;
          return { rows, incomeSec, assetsSec, secondaryIncomeSec };
        })
      : null;

  // Normalise assessment data: convert all Decimal → number for client.
  // This avoids Prisma Decimal objects crossing the server/client boundary.
  const serialisedAssessment: SerialisedAssessment = {
    id: assessment.id,
    applicationId: assessment.applicationId,
    assessorId: assessment.assessorId,
    familyTypeCategory: assessment.familyTypeCategory,
    notionalRent: toNumber(assessment.notionalRent),
    utilityCosts: toNumber(assessment.utilityCosts),
    foodCosts: toNumber(assessment.foodCosts),
    annualFees: toNumber(assessment.annualFees),
    councilTax: toNumber(assessment.councilTax),
    schoolingYearsRemaining: assessment.schoolingYearsRemaining,
    totalHouseholdNetIncome: toNumber(assessment.totalHouseholdNetIncome),
    netAssetsYearlyValuation: toNumber(assessment.netAssetsYearlyValuation),
    hndiAfterNs: toNumber(assessment.hndiAfterNs),
    requiredBursary: toNumber(assessment.requiredBursary),
    grossFees: toNumber(assessment.grossFees),
    scholarshipPct: toNumber(assessment.scholarshipPct),
    bursaryAward: toNumber(assessment.bursaryAward),
    netYearlyFees: toNumber(assessment.netYearlyFees),
    vatRate: toNumber(assessment.vatRate),
    yearlyPayableFees: toNumber(assessment.yearlyPayableFees),
    monthlyPayableFees: toNumber(assessment.monthlyPayableFees),
    manualAdjustment: toNumber(assessment.manualAdjustment),
    manualAdjustmentReason: assessment.manualAdjustmentReason,
    synopsis: assessment.synopsis,
    propertyCategory: assessment.propertyCategory,
    propertyExceedsThreshold: assessment.propertyExceedsThreshold,
    dishonestyFlag: assessment.dishonestyFlag,
    creditRiskFlag: assessment.creditRiskFlag,
    secondaryParentOverride: assessment.secondaryParentOverride,
    secondaryParentOverrideReason: assessment.secondaryParentOverrideReason,
    status: assessment.status,
    outcome: assessment.outcome,
    completedAt: assessment.completedAt,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
    earners: assessment.earners.map((e) => ({
      id: e.id,
      assessmentId: e.assessmentId,
      earnerLabel: e.earnerLabel,
      employmentStatus: e.employmentStatus,
      netPay: toNumber(e.netPay) ?? 0,
      netDividends: toNumber(e.netDividends) ?? 0,
      netSelfEmployedProfit: toNumber(e.netSelfEmployedProfit) ?? 0,
      pensionAmount: toNumber(e.pensionAmount) ?? 0,
      benefitsIncluded: toNumber(e.benefitsIncluded) ?? 0,
      benefitsIncludedDetail: e.benefitsIncludedDetail,
      benefitsExcluded: toNumber(e.benefitsExcluded) ?? 0,
      benefitsExcludedDetail: e.benefitsExcludedDetail,
      totalIncome: toNumber(e.totalIncome) ?? 0,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    property: assessment.property
      ? {
          id: assessment.property.id,
          assessmentId: assessment.property.assessmentId,
          isMortgageFree: assessment.property.isMortgageFree,
          additionalPropertyCount: assessment.property.additionalPropertyCount,
          additionalPropertyIncome:
            toNumber(assessment.property.additionalPropertyIncome) ?? 0,
          cashSavings: toNumber(assessment.property.cashSavings) ?? 0,
          isasPepsShares: toNumber(assessment.property.isasPepsShares) ?? 0,
          schoolAgeChildrenCount: assessment.property.schoolAgeChildrenCount,
          derivedSavingsAnnualTotal:
            toNumber(assessment.property.derivedSavingsAnnualTotal) ?? 0,
          createdAt: assessment.property.createdAt,
          updatedAt: assessment.property.updatedAt,
        }
      : null,
    checklists: assessment.checklists.map((c) => ({
      id: c.id,
      assessmentId: c.assessmentId,
      tab: c.tab,
      notes: c.notes,
      updatedAt: c.updatedAt,
    })),
  };

  // A SUBMITTED secondary forces two-earner mode (primary = Parent 1,
  // secondary = Parent 2) and the form hides/disables the sole-parent toggle.
  // The assessor override (secondary did not respond) falls back to
  // primary-only / single-earner — so two-earner is only forced while the
  // secondary is SUBMITTED *and* no override is in effect.
  const forceTwoEarner =
    hasSubmittedSecondary && !serialisedAssessment.secondaryParentOverride;

  // Build the form panel — v1 (untouched) or v2 (full notional model).
  let formPanel: ReactNode;
  if (engineVersion === "v2" && v2Sources) {
    const resolved = resolveReferenceBundle(v2Sources.rows);

    if (!resolved.isComplete) {
      // Fail-soft: reference data not yet seeded on this environment. Render a
      // clear callout instead of crashing (expected on nonprod until
      // `seed:reference` has run) — implementation-plan §CALC-07 item 2.
      formPanel = (
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-6 py-16 text-center">
          <ClipboardList className="h-12 w-12 text-amber-300" aria-hidden="true" />
          <div>
            <p className="text-base font-semibold text-amber-800">
              Reference data not seeded
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-amber-700">
              The v2 calculation needs the notional-cost and profiling reference
              tables, which are not yet populated on this environment. An
              administrator must run <code>npm run seed:reference</code> before this
              assessment can be calculated.
            </p>
            <p className="mt-3 text-xs text-amber-600">
              Missing: {resolved.missingTables.join(", ")}
            </p>
          </div>
        </div>
      );
    } else {
      const incomeData = (v2Sources.incomeSec?.data ?? null) as ParentsIncomeData | null;
      const assetsData = (v2Sources.assetsSec?.data ?? null) as AssetsLiabilitiesData | null;
      const secondaryIncomeData = (v2Sources.secondaryIncomeSec?.data ??
        null) as ParentsIncomeData | null;

      const savings = assetsToSavings(assetsData);
      const transport = assetsToTransport(assetsData);
      const prefill: AssessmentV2Prefill = {
        parent1Income: parentIncomeToAssessorRecord(incomeData?.parent1Income),
        parent2Income: parentIncomeToAssessorRecord(
          secondaryIncomeData?.parent1Income ?? incomeData?.parent2Income
        ),
        propertyAssets: assetsToPropertyAssets(assetsData),
        debts: assetsToDebts(assetsData),
        portfolioType: derivePortfolioType(assetsData),
        cashSavings: savings.cashSavings,
        isasPepsShares: savings.isasPepsShares,
        usesCar: transport.usesCar,
        usesPublicTransport: transport.usesPublicTransport,
      };

      const serialisedV2: SerialisedAssessmentV2 = {
        id: assessment.id,
        applicationId: assessment.applicationId,
        calculationVersion: assessment.calculationVersion,
        status: assessment.status,
        familyTypeCategory: assessment.familyTypeCategory,
        annualFees: toNumber(assessment.annualFees),
        schoolingYearsRemaining: assessment.schoolingYearsRemaining,
        scholarshipPct: toNumber(assessment.scholarshipPct),
        vatRate: toNumber(assessment.vatRate),
        rentAddBackType: assessment.rentAddBackType,
        multiPropertyRentAddBack: assessment.multiPropertyRentAddBack,
        councilTaxSupport: assessment.councilTaxSupport,
        usesCar: assessment.usesCar,
        usesPublicTransport: assessment.usesPublicTransport,
        feeInsuranceAnnual: toNumber(assessment.feeInsuranceAnnual),
        behindOnFees: assessment.behindOnFees,
        // Epic 13 / C2 — the manual income-adjustment line.
        manualAdjustment: toNumber(assessment.manualAdjustment),
        manualAdjustmentReason: assessment.manualAdjustmentReason,
        dishonestyFlag: assessment.dishonestyFlag,
        watchOutNotes: assessment.watchOutNotes,
        earners: assessment.earners
          .filter((e) => e.earnerLabel === "PARENT_1" || e.earnerLabel === "PARENT_2")
          .map((e) => ({
            earnerLabel: e.earnerLabel as "PARENT_1" | "PARENT_2",
            employmentStatus: e.employmentStatus,
            incomeDetail: (e.incomeDetail ?? null) as AssessorIncomeRecord | null,
          })),
        property: assessment.property
          ? {
              propertyAssets:
                (assessment.property.propertyAssets ?? null) as PropertyAssetsRecord | null,
              debts: (assessment.property.debts ?? null) as DebtsRecord | null,
              cashSavings: toNumber(assessment.property.cashSavings),
              isasPepsShares: toNumber(assessment.property.isasPepsShares),
              schoolAgeChildrenCount: assessment.property.schoolAgeChildrenCount,
            }
          : null,
      };

      formPanel = (
        <AssessmentFormV2
          assessment={serialisedV2}
          applicationId={params.id}
          referenceBundle={resolved.bundle}
          prefill={prefill}
          defaultAnnualFees={configs.annualFees}
          defaultNextYearAnnualFees={configs.nextYearAnnualFees}
          applicationEntryYear={application.entryYear}
          applicationEntryYearGroup={
            application.entryYearGroup as EntryYearGroupCode | null
          }
          siblingPayableFees={siblingPayableFees}
          forceTwoEarner={forceTwoEarner}
          secondaryParentOverride={serialisedAssessment.secondaryParentOverride}
          readOnly={isViewer}
        />
      );
    }
  } else {
    formPanel = (
      <AssessmentForm
        assessment={serialisedAssessment}
        applicationId={params.id}
        school={application.school}
        applicationEntryYear={application.entryYear}
        applicationEntryYearGroup={application.entryYearGroup}
        familyTypeConfigs={configs.familyTypeConfigs}
        defaultAnnualFees={configs.annualFees}
        defaultNextYearAnnualFees={configs.nextYearAnnualFees}
        currentFeeYearLabel={feeYearLabels(round.academicYear).current ?? undefined}
        nextFeeYearLabel={feeYearLabels(round.academicYear).next ?? undefined}
        defaultCouncilTax={configs.councilTax}
        siblingPayableFees={siblingPayableFees}
        forceTwoEarner={forceTwoEarner}
        secondaryParentOverride={serialisedAssessment.secondaryParentOverride}
      />
    );
  }

  // Build the document panel (left side of split-screen).
  // The client component owns its own toolbar / empty state. When a second
  // parent exists, documents are labelled by uploading contributor.
  const documentListPanel = (
    <DocumentListClient
      documents={documents}
      contributorGroups={contributorGroups}
    />
  );

  return (
    <div className="space-y-5">
      {/* CALC-10 — fees account code + assessor's-wizard callout */}
      {bursaryAccountId && (
        <AccountContextBar
          applicationId={params.id}
          bursaryAccountId={bursaryAccountId}
          user={user}
        />
      )}

      {/* Re-assessment context (if applicable) */}
      {isReassessment && bursaryAccountId && (
        <ReassessmentContext
          applicationId={params.id}
          bursaryAccountId={bursaryAccountId}
          roundId={application.roundId}
          academicYear={round.academicYear}
          user={user}
        />
      )}

      {/* Epic 13 / C1 — completed assessments render read-only; say so, and
          offer the way back while no outcome has been recorded (D13-2). */}
      {assessment.status === "COMPLETED" && (
        <ReopenAssessmentBanner
          assessmentId={assessment.id}
          applicationId={params.id}
          canReopen={!isViewer && assessment.outcome == null}
        />
      )}

      {/* Household decision aid (Epic 09) — derived scenario + expected
          handling; H7/H9 surface as advisory flags, never auto-decline. */}
      {householdHandling && (
        <HouseholdDecisionAid handling={householdHandling} />
      )}

      {/* Split-screen workspace */}
      <div className="h-[calc(100vh-220px)] min-h-[600px]">
        <SplitScreen
          leftPanel={documentListPanel}
          rightPanel={formPanel}
        />
      </div>

      {/* Single qualitative synopsis — docked below the workspace, always
          visible, and editable even after the assessment is COMPLETED. */}
      <AssessmentSynopsis
        assessmentId={serialisedAssessment.id}
        applicationId={params.id}
        synopsis={serialisedAssessment.synopsis}
        assessmentCompleted={serialisedAssessment.status === "COMPLETED"}
      />
    </div>
  );
}

