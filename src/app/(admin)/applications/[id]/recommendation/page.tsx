/**
 * WP-12: Recommendation Tab Page
 *
 * Server component. Fetches application, assessment, recommendation, and
 * reason codes. Renders the RecommendationForm for completed assessments.
 *
 * Epic 08 (D7): the assessor-side recommendation PDF (route + renderer +
 * Download button) was removed — it exposed assessor-internal figures and was
 * unused. The applicant-facing submission PDF (Epic 05,
 * /api/pdf/submission/[id]) is a separate, parent-safe artefact and is
 * unaffected.
 *
 * States:
 *  1. No assessment, or assessment not COMPLETED → gate message
 *  2. Assessment COMPLETED → full recommendation form
 *
 * Requires ASSESSOR or VIEWER role.
 *
 * Note on Decimal: all Decimal fields are converted to plain numbers before
 * being passed to client components.
 */

import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import type { Decimal } from "@prisma/client/runtime/library";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAssessment } from "@/lib/db/queries/assessments";
import {
  getRecommendation,
  getReasonCodes,
} from "@/lib/db/queries/recommendations";
import { getSiblingLinks } from "@/lib/db/queries/siblings";
import { buildOptionScenarios } from "@/lib/assessment/recommendation-options";
import {
  RecommendationForm,
  type SerialisedRecommendation,
  type SiblingContextRow,
} from "@/components/admin/recommendation-form";
import type { OptionScenario } from "@/lib/assessment/recommendation-options";
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
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const { application, assessment } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const app = await getApplicationWithDetails(tx, params.id);
      if (!app) return { application: null, assessment: null };
      const a = await getAssessment(tx, params.id);
      return { application: app, assessment: a };
    }
  );
  if (!application) notFound();

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

  // ── Assessment COMPLETED — load recommendation, reason codes, siblings ─────

  const [recommendation, reasonCodes, siblingLinks] = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      Promise.all([
        getRecommendation(tx, assessment.id),
        getReasonCodes(tx),
        application.bursaryAccountId
          ? getSiblingLinks(tx, application.bursaryAccountId)
          : Promise.resolve([]),
      ])
  );

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
          scholarshipAward: toNumber(recommendation.scholarshipAward),
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

  // ── Sibling context (read-only) — the linked accounts and absorbed fees the
  // calc already consumed, surfaced at decision time (Epic 08 §5.1c). The
  // current child's own account is excluded from the context list.
  const siblingContext: SiblingContextRow[] = siblingLinks
    .filter((l) => l.bursaryAccountId !== application.bursaryAccountId)
    .map((l) => ({
      reference: l.bursaryAccount.reference,
      childName: l.bursaryAccount.childName,
      school: l.bursaryAccount.school,
      priorityOrder: l.priorityOrder,
      absorbedPayableFees: l.bursaryAccount.latestPayableFees,
    }));

  // ── Options comparison — projected from the pure engine over the assessment's
  // own figures (Epic 08 §5.1c). No new maths; one engine call per scenario so
  // the scholarship is never double-applied.
  const grossFees = toNumber(assessment.grossFees) ?? 0;
  const optionScenarios: OptionScenario[] = buildOptionScenarios({
    grossFees,
    scholarshipPct: toNumber(assessment.scholarshipPct) ?? 0,
    bursaryAward: assessmentValues.bursaryAward ?? 0,
    vatRate: toNumber(assessment.vatRate) ?? 20,
    manualAdjustment: toNumber(assessment.manualAdjustment) ?? 0,
    hasSiblings: siblingContext.length > 0,
    // The standalone (no-absorption) bursary is not separately persisted; the
    // without-siblings row is omitted until the engine exposes it (Epic 10).
    standaloneBursaryAward: null,
  });

  return (
    <div className="space-y-4">
      {/* ── Recommendation form ───────────────────────────────────────── */}
      <RecommendationForm
        applicationId={params.id}
        assessmentOutcome={assessment.outcome}
        assessmentId={assessment.id}
        synopsis={assessment.synopsis}
        assessmentValues={assessmentValues}
        recommendation={serialisedRecommendation}
        reasonCodes={serialisedReasonCodes}
        siblingContext={siblingContext}
        optionScenarios={optionScenarios}
      />
    </div>
  );
}
