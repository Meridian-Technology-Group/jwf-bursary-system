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
import { ClipboardCheck, AlertTriangle } from "lucide-react";
import type { Decimal } from "@prisma/client/runtime/library";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAssessment } from "@/lib/db/queries/assessments";
import {
  getRecommendation,
  getReasonCodes,
  getGapReasons,
  getLastRecommendationPayable,
} from "@/lib/db/queries/recommendations";
import { getSiblingLinks } from "@/lib/db/queries/siblings";
import { mergeHistoricReasonCodeOptions } from "@/lib/reason-codes/merge-options";
import { buildOptionScenarios } from "@/lib/assessment/recommendation-options";
import { selectEngineVersion } from "@/lib/assessment/engine-version";
import { selectLastPayableFees } from "@/lib/assessment/recommendation-v2";
import {
  RecommendationForm,
  type SerialisedRecommendation,
  type SiblingContextRow,
} from "@/components/admin/recommendation-form";
import {
  RecommendationFormV2,
  type SerialisedRecommendationV2,
  type V2AssessmentSnapshot,
} from "@/components/admin/recommendation-form-v2";
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

  // ── Assessment COMPLETED — dispatch v1 vs v2 by the calculation stamp ──────
  const engineVersion = selectEngineVersion(assessment.calculationVersion);

  // ── CALC-15 — refuse a null v2 snapshot ─────────────────────────────────────
  // A COMPLETED v2 assessment should always carry its persisted snapshot (the
  // server-side complete guard now enforces this going forward), but a row
  // completed before that guard existed — e.g. via the stale-client save
  // failure this hardens against — can still have `recommendedPayableFees`
  // null. Never fall through to rendering the form with an implicit £0 leg;
  // show a clear remediation callout instead.
  if (engineVersion === "v2" && assessment.recommendedPayableFees == null) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-6 py-16 text-center shadow-sm">
        <AlertTriangle className="h-12 w-12 text-amber-400" aria-hidden="true" />
        <div>
          <p className="text-base font-semibold text-amber-900">
            Assessment snapshot incomplete
          </p>
          <p className="mt-1.5 max-w-md text-sm text-amber-700">
            This assessment is marked COMPLETED but its calculation snapshot
            was never saved (recommended payable fees is missing) — likely a
            failed save. Reopen the assessment and re-save it before recording
            a recommendation.
          </p>
        </div>
      </div>
    );
  }

  // ── Assessment COMPLETED — load recommendation, reason codes, siblings ─────
  // (plus, for v2, gap reasons + the previous recommendation's payable fees).

  const [
    recommendation,
    reasonCodes,
    siblingLinks,
    gapReasonRows,
    lastRecPayable,
  ] = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    Promise.all([
      getRecommendation(tx, assessment.id),
      getReasonCodes(tx),
      application.bursaryAccountId
        ? getSiblingLinks(tx, application.bursaryAccountId)
        : Promise.resolve([]),
      engineVersion === "v2" ? getGapReasons(tx) : Promise.resolve([]),
      engineVersion === "v2" && application.bursaryAccountId
        ? getLastRecommendationPayable(
            tx,
            application.bursaryAccountId,
            application.roundId
          )
        : Promise.resolve(null),
    ])
  );

  // Serialise reason codes. `getReasonCodes` returns only active
  // (non-deprecated) codes so the picker never offers a retired one for NEW
  // selections — but a recommendation saved before CALC-09 may already link a
  // now-deprecated code. Merge those in (by id) so the selector still shows
  // its label instead of silently hiding a previously-recorded reason.
  const linkedReasonCodes = recommendation
    ? recommendation.reasonCodes.map((rc) => rc.reasonCode)
    : [];
  const serialisedReasonCodes: ReasonCodeOption[] = mergeHistoricReasonCodeOptions(
    reasonCodes,
    linkedReasonCodes
  ).map((rc) => ({
    id: rc.id,
    code: rc.code,
    label: rc.label,
  }));

  // ── Sibling context (read-only) — the linked accounts and absorbed fees the
  // calc already consumed, surfaced at decision time (Epic 08 §5.1c). The
  // current child's own account is excluded from the context list. Shared v1/v2.
  const siblingContext: SiblingContextRow[] = siblingLinks
    .filter((l) => l.bursaryAccountId !== application.bursaryAccountId)
    .map((l) => ({
      bursaryAccountId: l.bursaryAccountId,
      childName: l.bursaryAccount.childName,
      school: l.bursaryAccount.school,
      priorityOrder: l.priorityOrder,
      absorbedPayableFees: l.bursaryAccount.latestPayableFees,
    }));

  // ── v2 recommendation surface (CALC-08) ────────────────────────────────────
  // Branch at the page level: v2 assessments render the min-of-three / gap
  // surface off the persisted snapshot columns; v1 falls through unchanged.
  if (engineVersion === "v2") {
    // Merge historic gap reasons (same pattern as reason codes) so a saved gap
    // reason that has since been deprecated still renders its label.
    const linkedGapReasons = recommendation
      ? recommendation.gapReasons.map((gr) => gr.gapReason)
      : [];
    const serialisedGapReasons: ReasonCodeOption[] = mergeHistoricReasonCodeOptions(
      gapReasonRows,
      linkedGapReasons
    ).map((gr) => ({ id: gr.id, code: gr.code, label: gr.label }));

    const snapshot: V2AssessmentSnapshot = {
      actualRemainingDi: toNumber(assessment.actualRemainingDi),
      theoreticalBenchmarkDi: toNumber(assessment.theoreticalBenchmarkDi),
      affordabilityAdjustedDi: toNumber(assessment.affordabilityAdjustedDi),
      recommendedPayableFees: toNumber(assessment.recommendedPayableFees),
      annualFees: toNumber(assessment.annualFees),
      nextYearAnnualFees: toNumber(assessment.nextYearAnnualFees),
      vatRate: toNumber(assessment.vatRate),
      scholarshipPct: toNumber(assessment.scholarshipPct),
      incomeCategory: assessment.incomeCategory,
      propertyCategoryDerived: assessment.propertyCategoryDerived,
      propertyEquityCategory: assessment.propertyEquityCategory,
      financialEquityLabel: assessment.financialEquityLabel,
      debtStatusLabel: assessment.debtStatusLabel,
      lifestyleSqueezeRatio: toNumber(assessment.lifestyleSqueezeRatio),
      lifestyleSqueezeLabel: assessment.lifestyleSqueezeLabel,
      dishonestyFlag: assessment.dishonestyFlag,
      // Epic 13 / C2 — the household income figure the legs were built on and
      // the manual adjustment (with its mandatory reason) baked into it.
      totalHouseholdNetIncome: toNumber(assessment.totalHouseholdNetIncome),
      manualAdjustment: toNumber(assessment.manualAdjustment),
      manualAdjustmentReason: assessment.manualAdjustmentReason,
    };

    const serialisedRecommendationV2: SerialisedRecommendationV2 | null =
      recommendation
        ? {
            bursaryAward: toNumber(recommendation.bursaryAward),
            scholarshipAward: toNumber(recommendation.scholarshipAward),
            confirmedPayableFees: toNumber(recommendation.confirmedPayableFees),
            scholarshipValueInclVat: toNumber(
              recommendation.scholarshipValueInclVat
            ),
            bursarySpendBeforeVat: toNumber(recommendation.bursarySpendBeforeVat),
            gapAmount: toNumber(recommendation.gapAmount),
            lastPayableFees: toNumber(recommendation.lastPayableFees),
            selectedReasonCodeIds: recommendation.reasonCodes.map(
              (rc) => rc.reasonCode.id
            ),
            selectedGapReasonIds: recommendation.gapReasons.map(
              (gr) => gr.gapReason.id
            ),
          }
        : null;

    // Last payable fees: a previously-saved value on the recommendation wins;
    // otherwise derive from the account's previous recommendation.
    const lastPayableFees =
      serialisedRecommendationV2?.lastPayableFees ??
      selectLastPayableFees(lastRecPayable);

    return (
      <div className="space-y-4">
        <RecommendationFormV2
          applicationId={params.id}
          assessmentId={assessment.id}
          assessmentOutcome={assessment.outcome}
          synopsis={assessment.synopsis}
          snapshot={snapshot}
          recommendation={serialisedRecommendationV2}
          reasonCodes={serialisedReasonCodes}
          gapReasons={serialisedGapReasons}
          lastPayableFees={lastPayableFees}
          siblingContext={siblingContext}
        />
      </div>
    );
  }

  // ── v1 recommendation surface (unchanged) ──────────────────────────────────

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

  // Assessment values pre-populate the form (read-only display)
  const assessmentValues = {
    bursaryAward: toNumber(assessment.bursaryAward),
    yearlyPayableFees: toNumber(assessment.yearlyPayableFees),
    monthlyPayableFees: toNumber(assessment.monthlyPayableFees),
    dishonestyFlag: assessment.dishonestyFlag,
    creditRiskFlag: assessment.creditRiskFlag,
  };

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
