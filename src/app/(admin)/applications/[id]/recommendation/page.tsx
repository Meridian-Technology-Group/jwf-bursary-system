/**
 * WP-12 + WP-21: Recommendation Tab Page
 *
 * Server component. Fetches application, assessment, recommendation, and
 * reason codes. Renders the RecommendationForm for completed assessments.
 *
 * WP-21 addition: "Download PDF" button when a recommendation exists,
 * linking to /api/pdf/recommendation/[applicationId].
 *
 * States:
 *  1. No assessment, or assessment not COMPLETED → gate message
 *  2. Assessment COMPLETED → full recommendation form + optional PDF button
 *
 * Requires ASSESSOR or VIEWER role.
 *
 * Note on Decimal: all Decimal fields are converted to plain numbers before
 * being passed to client components.
 */

import { notFound } from "next/navigation";
import { ClipboardCheck, FileDown } from "lucide-react";
import type { Decimal } from "@prisma/client/runtime/library";
import { requireRole, Role } from "@/lib/auth/roles";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAssessment } from "@/lib/db/queries/assessments";
import {
  getRecommendation,
  getReasonCodes,
} from "@/lib/db/queries/recommendations";
import {
  RecommendationForm,
  type SerialisedRecommendation,
} from "@/components/admin/recommendation-form";
import type { ReasonCodeOption } from "@/components/admin/reason-code-selector";

export const metadata = {
  title: "Recommendation",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(
  value: Decimal | string | number | null | undefined
): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default async function RecommendationPage({ params }: Props) {
  await requireRole([Role.ASSESSOR, Role.VIEWER]);

  const application = await getApplicationWithDetails(params.id);
  if (!application) notFound();

  const assessment = await getAssessment(params.id);

  // ── Gate: no assessment or assessment not completed ────────────────────────

  if (!assessment || assessment.status !== "COMPLETED") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <ClipboardCheck
          className="h-12 w-12 text-slate-200"
          aria-hidden="true"
        />
        <div>
          <p className="text-base font-semibold text-slate-700">
            Assessment must be completed first
          </p>
          <p className="mt-1.5 text-sm text-slate-400">
            {!assessment
              ? "No assessment has been started for this application yet. Begin the assessment from the Assessment tab."
              : "The assessment is currently in progress. Complete it before recording a recommendation."}
          </p>
        </div>
      </div>
    );
  }

  // ── Assessment COMPLETED — load recommendation and reason codes ────────────

  const [recommendation, reasonCodes] = await Promise.all([
    getRecommendation(assessment.id),
    getReasonCodes(),
  ]);

  // Serialise recommendation for the client boundary
  const serialisedRecommendation: SerialisedRecommendation | null =
    recommendation
      ? {
          id: recommendation.id,
          assessmentId: recommendation.assessmentId,
          familySynopsis: recommendation.familySynopsis,
          accommodationStatus: recommendation.accommodationStatus,
          incomeCategory: recommendation.incomeCategory,
          propertyCategory: recommendation.propertyCategory,
          bursaryAward: toNumber(recommendation.bursaryAward),
          yearlyPayableFees: toNumber(recommendation.yearlyPayableFees),
          monthlyPayableFees: toNumber(recommendation.monthlyPayableFees),
          dishonestyFlag: recommendation.dishonestyFlag,
          creditRiskFlag: recommendation.creditRiskFlag,
          summary: recommendation.summary,
          selectedReasonCodeIds: recommendation.reasonCodes.map(
            (rc) => rc.reasonCode.id
          ),
        }
      : null;

  // Serialise reason codes
  const serialisedReasonCodes: ReasonCodeOption[] = reasonCodes.map((rc) => ({
    id: rc.id,
    code: rc.code,
    label: rc.label,
  }));

  // Assessment values pre-populate the form (read-only display)
  const assessmentValues = {
    bursaryAward: toNumber(assessment.bursaryAward),
    yearlyPayableFees: toNumber(assessment.yearlyPayableFees),
    monthlyPayableFees: toNumber(assessment.monthlyPayableFees),
    dishonestyFlag: assessment.dishonestyFlag,
    creditRiskFlag: assessment.creditRiskFlag,
  };

  return (
    <div className="space-y-4">
      {/* ── Page header with optional PDF download button ─────────────── */}
      {recommendation && (
        <div className="flex items-center justify-end">
          <a
            href={`/api/pdf/recommendation/${params.id}`}
            download
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8862A] focus-visible:ring-offset-2"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Download PDF
          </a>
        </div>
      )}

      {/* ── Recommendation form ───────────────────────────────────────── */}
      <RecommendationForm
        applicationId={params.id}
        applicationStatus={application.status}
        assessmentValues={assessmentValues}
        recommendation={serialisedRecommendation}
        reasonCodes={serialisedReasonCodes}
      />
    </div>
  );
}
