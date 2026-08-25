/**
 * RecommendationSurface — the award/outcome decision surface (Epic 08 WP-12 /
 * CALC-08), extracted from the Recommendation tab page for Epic 14 C7 so the
 * SAME surface renders on both the Recommendation step and the assessment
 * workspace's BURSARY AWARD CALCULATION (5) tab — one implementation, one set
 * of save/lock rules (CG-16/CG-14: the outcome's explicit home is the award
 * tab; the Recommendation route keeps working unchanged).
 *
 * States:
 *  1. No assessment, or assessment not COMPLETED → gate message
 *  2. Assessment COMPLETED → full recommendation form (v1/v2 by calc stamp)
 *
 * Auth is the CALLER's job (both routes requireRole first); the surface takes
 * the resolved user for RLS context.
 */

import { notFound } from "next/navigation";
import { ClipboardCheck, AlertTriangle, PencilRuler } from "lucide-react";
import type { Decimal } from "@prisma/client/runtime/library";
import type { CurrentUser } from "@/lib/auth/roles";
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
import {
  resolveAwardSurfaceState,
  type AwardSurfaceMode,
} from "@/lib/assessment/award-surface-state";
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

function toNumber(
  value: Decimal | string | number | null | undefined
): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

export interface RecommendationSurfaceProps {
  applicationId: string;
  user: CurrentUser;
  /**
   * Epic 15 M6 (CI-11, LA15-4): "workspace" (the BURSARY AWARD CALCULATION
   * tab) renders the v2 form for an IN-PROGRESS assessment too — Part 6 as
   * the natural continuation of Part 5 — with the outcome actions locked
   * until COMPLETE. "gated" (default; the Recommendation route) keeps the
   * completed-first behaviour.
   */
  mode?: AwardSurfaceMode;
}

export async function RecommendationSurface({
  applicationId,
  user,
  mode = "gated",
}: RecommendationSurfaceProps) {
    const { application, assessment } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const app = await getApplicationWithDetails(tx, applicationId);
      if (!app) return { application: null, assessment: null };
      const a = await getAssessment(tx, applicationId);
      return { application: app, assessment: a };
    }
  );
  if (!application) notFound();

  // ── Surface state (Epic 15 M6 / CI-11) ─────────────────────────────────────
  const engineVersion = assessment
    ? selectEngineVersion(assessment.calculationVersion)
    : "v1";
  const surfaceState = resolveAwardSurfaceState({
    mode,
    assessmentStatus: assessment?.status ?? null,
    engineVersion,
    hasSnapshot: assessment?.recommendedPayableFees != null,
  });

  if (surfaceState === "NO_ASSESSMENT" || surfaceState === "GATE") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <ClipboardCheck
          className="h-12 w-12 text-slate-200"
          aria-hidden="true"
        />
        <div>
          <p className="text-base font-semibold text-slate-700">
            {surfaceState === "NO_ASSESSMENT"
              ? "No assessment yet"
              : "Assessment must be completed first"}
          </p>
          <p className="mt-1.5 text-sm text-slate-400">
            {surfaceState === "NO_ASSESSMENT"
              ? "No assessment has been started for this application yet. Begin from the ASSESSMENT MODEL tab."
              : "The assessment is currently in progress. Complete it before recording a recommendation."}
          </p>
        </div>
      </div>
    );
  }

  // Workspace mode, v2, in progress but never saved — nothing to calculate
  // from yet. A soft prompt, NOT the completion gate (CI-11).
  if (surfaceState === "NO_SAVED_CALCULATION") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <PencilRuler className="h-12 w-12 text-slate-200" aria-hidden="true" />
        <div>
          <p className="text-base font-semibold text-slate-700">
            No saved calculation yet
          </p>
          <p className="mt-1.5 max-w-md text-sm text-slate-400">
            Fill in the ASSESSMENT MODEL tab and Save — the award calculation
            fills itself from your saved figures. You do not need to complete
            the assessment to work here.
          </p>
        </div>
      </div>
    );
  }

  // ── CALC-15 — refuse a null v2 snapshot on a COMPLETED assessment ──────────
  // Never fall through to rendering the form with an implicit £0 leg; show a
  // clear remediation callout instead.
  if (surfaceState === "SNAPSHOT_INCOMPLETE") {
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

  // Below here the assessment row exists and the form renders.
  if (!assessment) notFound(); // type narrowing — unreachable
  const outcomeLocked = surfaceState === "FORM_OUTCOME_LOCKED";

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
            scholarshipSpendBeforeVat: toNumber(
              recommendation.scholarshipSpendBeforeVat
            ),
            netFeesBeforeVat: toNumber(recommendation.netFeesBeforeVat),
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
        {outcomeLocked && (
          <div
            className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800"
            role="status"
          >
            Working values from your last save — everything here can be entered
            and saved now; complete the assessment to record the outcome.
          </div>
        )}
        <RecommendationFormV2
          applicationId={applicationId}
          assessmentId={assessment.id}
          assessmentOutcome={assessment.outcome}
          synopsis={assessment.synopsis}
          snapshot={snapshot}
          recommendation={serialisedRecommendationV2}
          reasonCodes={serialisedReasonCodes}
          gapReasons={serialisedGapReasons}
          lastPayableFees={lastPayableFees}
          siblingContext={siblingContext}
          outcomeLocked={outcomeLocked}
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
        applicationId={applicationId}
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
