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

import { notFound } from "next/navigation";
import type { Decimal } from "@prisma/client/runtime/library";
import { requireRole, Role } from "@/lib/auth/roles";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAssessment } from "@/lib/db/queries/assessments";
import { getConfigsForAssessment } from "@/lib/db/queries/reference-tables";
import { getPreviousAssessment } from "@/lib/db/queries/reassessment";
import { getSiblingLinks } from "@/lib/db/queries/siblings";
import { prisma } from "@/lib/db/prisma";
import { YearComparison } from "@/components/admin/year-comparison";
import { BenchmarkDisplay } from "@/components/admin/benchmark-display";
import { SplitScreen } from "@/components/admin/split-screen";
import { AssessmentForm, type SerialisedAssessment } from "@/components/admin/assessment-form";
import { AssessmentChecklist } from "@/components/admin/assessment-checklist";
import { BeginAssessmentButton } from "@/components/admin/begin-assessment-button";
import { ClipboardList } from "lucide-react";

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
}

async function ReassessmentContext({
  applicationId: _applicationId,
  bursaryAccountId,
  roundId,
  academicYear,
}: ReassessmentContextProps) {
  const [previousAssessment, bursaryAccount] = await Promise.all([
    getPreviousAssessment(bursaryAccountId, roundId),
    prisma.bursaryAccount.findUnique({
      where: { id: bursaryAccountId },
      select: {
        benchmarkPayableFees: true,
        firstAssessmentYear: true,
      },
    }),
  ]);

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

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default async function AssessmentPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  const isViewer = user.role === Role.VIEWER;

  const application = await getApplicationWithDetails(params.id);
  if (!application) notFound();

  const { documents, isReassessment, bursaryAccountId, round } = application;

  // Fetch assessment with full relations (earners, property, checklists)
  const assessment = await getAssessment(params.id);

  // ── No assessment record yet ───────────────────────────────────────────────

  if (!assessment) {
    return (
      <div className="space-y-5">
        {/* Re-assessment context (if applicable) */}
        {isReassessment && bursaryAccountId && (
          <ReassessmentContext
            applicationId={params.id}
            bursaryAccountId={bursaryAccountId}
            roundId={application.roundId}
            academicYear={round.academicYear}
          />
        )}

        {/* Begin assessment CTA */}
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

          {!isViewer && (
            <BeginAssessmentButton applicationId={params.id} />
          )}

          {isViewer && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
              Viewer access — assessment can only be started by an Assessor
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Assessment exists — build full workspace ───────────────────────────────

  // Load reference configs for the form
  const configs = await getConfigsForAssessment(
    application.school,
    assessment.familyTypeCategory ?? undefined
  );

  // Load sibling payable fees for sequential income absorption.
  // Only siblings with a lower priority order than this child are used —
  // i.e., siblings that come before this child in the family group.
  const siblingPayableFees: number[] = [];
  if (bursaryAccountId) {
    const siblingLinks = await getSiblingLinks(bursaryAccountId);
    const ownLink = siblingLinks.find((s) => s.bursaryAccountId === bursaryAccountId);
    if (ownLink) {
      const olderSiblings = siblingLinks.filter(
        (s) =>
          s.bursaryAccountId !== bursaryAccountId &&
          s.priorityOrder < ownLink.priorityOrder
      );
      for (const sibling of olderSiblings) {
        if (sibling.bursaryAccount.latestPayableFees !== null) {
          siblingPayableFees.push(sibling.bursaryAccount.latestPayableFees);
        }
      }
    }
  }

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
    propertyCategory: assessment.propertyCategory,
    propertyExceedsThreshold: assessment.propertyExceedsThreshold,
    dishonestyFlag: assessment.dishonestyFlag,
    creditRiskFlag: assessment.creditRiskFlag,
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

  // Build the form panel
  const formPanel = (
    <AssessmentForm
      assessment={serialisedAssessment}
      applicationId={params.id}
      school={application.school}
      applicationEntryYear={application.entryYear}
      familyTypeConfigs={configs.familyTypeConfigs}
      defaultAnnualFees={configs.annualFees}
      defaultCouncilTax={configs.councilTax}
      siblingPayableFees={siblingPayableFees}
    />
  );

  // Build the document list panel (left side of split-screen)
  const documentListPanel = (
    <DocumentListForSplitScreen documents={documents} />
  );

  return (
    <div className="space-y-5">
      {/* Re-assessment context (if applicable) */}
      {isReassessment && bursaryAccountId && (
        <ReassessmentContext
          applicationId={params.id}
          bursaryAccountId={bursaryAccountId}
          roundId={application.roundId}
          academicYear={round.academicYear}
        />
      )}

      {/* Split-screen workspace */}
      <div className="h-[calc(100vh-220px)] min-h-[600px]">
        <SplitScreen
          leftPanel={documentListPanel}
          rightPanel={formPanel}
        />
      </div>

      {/* Qualitative checklist — separate section below the workspace */}
      <AssessmentChecklist
        assessmentId={serialisedAssessment.id}
        applicationId={params.id}
        checklists={serialisedAssessment.checklists}
        readOnly={serialisedAssessment.status === "COMPLETED"}
      />
    </div>
  );
}

// ─── Document List Panel (server component — no interactivity needed here) ────

import type { Document } from "@prisma/client";

function DocumentListForSplitScreen({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <ClipboardList className="h-10 w-10 text-slate-200" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-slate-400">No documents uploaded</p>
          <p className="mt-0.5 text-xs text-slate-300">
            Documents uploaded by the applicant will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Panel header */}
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Documents ({documents.length})
        </p>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        <DocumentListClient documents={documents} />
      </div>
    </div>
  );
}

// ─── Client document list (handles click-to-view) ─────────────────────────────

import { DocumentListClient } from "@/components/admin/document-list-client";
