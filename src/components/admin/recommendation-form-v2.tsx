"use client";

/**
 * CALC-08 — v2 recommendation surface (min-of-three award + gap tracking).
 *
 * Rendered by the recommendation page ONLY for `calculationVersion: 2`
 * assessments (v1 keeps the untouched `recommendation-form.tsx`). It:
 *  - shows the THREE award legs (actual / theoretical / affordability-adjusted)
 *    read straight from the completed assessment's snapshot columns (never
 *    recomputed), with the minimum highlighted — that min (floored at £0) is
 *    `recommendedPayableFees`;
 *  - lets the assessor enter a scholarship %, a BEFORE-VAT bursary award, and a
 *    confirmed payable-fees figure, deriving the before-VAT scholarship spend,
 *    before-VAT net fees and the VAT-inclusive yearly payable fees LIVE via the
 *    engine's `awardSummary` (CH-36 — VAT applied once, at the end);
 *  - requires ≥1 reason-for-gap whenever confirmed ≠ recommended (beyond a
 *    £0.01 tolerance) — enforced here AND server-side;
 *  - pre-fills `last payable fees` from the account's previous recommendation;
 *  - shows the DERIVED income/property categories + debt status (display-only),
 *    replacing v1's free-text income category and manual property dropdown.
 *
 * The award decision (Award / Qualifies / Decline) reuses the shared dialog +
 * `setApplicationAwardAction` from the v1 form.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  ShieldAlert,
  DollarSign,
  Scale,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReasonCodeSelector } from "@/components/admin/reason-code-selector";
import type { ReasonCodeOption } from "@/components/admin/reason-code-selector";
import { AssessmentSynopsis } from "@/components/admin/assessment-synopsis";
import {
  AWARD_DECISIONS,
  AwardDialog,
  ReadOnlyBanner,
  RedFlagBanner,
  SiblingContextPanel,
  formatCurrency,
  isTerminalOutcome,
  type AwardDecision,
  type SiblingContextRow,
} from "@/components/admin/recommendation-form";
import {
  saveRecommendationAction,
  setApplicationAwardAction,
  type SaveRecommendationData,
} from "@/app/(admin)/applications/[id]/recommendation/actions";
import { completeAssessmentAction } from "@/app/(admin)/applications/[id]/assessment/actions";
import {
  computeGapAmount,
  deriveRecommendationAward,
  gapReasonSelectionValid,
  hasMaterialGap,
  resolveNextYearFees,
} from "@/lib/assessment/recommendation-v2";
import { buildV2AwardLegs } from "@/lib/assessment/recommendation-options";
import { cn } from "@/lib/utils";
import type { AssessmentOutcome } from "@prisma/client";

// ─── Serialised shapes (Decimal→number) handed in from the server component ────

/** The v2 assessment snapshot the recommendation reads (all persisted, read-only). */
export interface V2AssessmentSnapshot {
  actualRemainingDi: number | null;
  theoreticalBenchmarkDi: number | null;
  affordabilityAdjustedDi: number | null;
  recommendedPayableFees: number | null;
  annualFees: number | null;
  nextYearAnnualFees: number | null;
  vatRate: number | null;
  scholarshipPct: number | null;
  incomeCategory: number | null;
  /** CH-44 — the family category, shown on the categories panel. */
  familyTypeCategory: number | null;
  propertyCategoryDerived: number | null;
  propertyEquityCategory: number | null;
  financialEquityLabel: string | null;
  debtStatusLabel: string | null;
  lifestyleSqueezeRatio: number | null;
  lifestyleSqueezeLabel: string | null;
  dishonestyFlag: boolean;
  /**
   * Epic 13 / C2 — the household net income the three legs were computed from,
   * plus the assessor's manual income-adjustment line and its reason. Carried
   * onto the recommendation so the figure the decision rests on is never
   * unexplained at decision time.
   */
  totalHouseholdNetIncome: number | null;
  manualAdjustment: number | null;
  manualAdjustmentReason: string | null;
}

/** Existing v2 recommendation (null if first save). */
export interface SerialisedRecommendationV2 {
  bursaryAward: number | null;
  scholarshipAward: number | null;
  confirmedPayableFees: number | null;
  scholarshipSpendBeforeVat: number | null;
  netFeesBeforeVat: number | null;
  bursarySpendBeforeVat: number | null;
  gapAmount: number | null;
  lastPayableFees: number | null;
  selectedReasonCodeIds: string[];
  selectedGapReasonIds: string[];
}

export interface RecommendationFormV2Props {
  applicationId: string;
  assessmentId: string;
  assessmentOutcome: AssessmentOutcome | null;
  synopsis: string | null;
  snapshot: V2AssessmentSnapshot;
  recommendation: SerialisedRecommendationV2 | null;
  reasonCodes: ReasonCodeOption[];
  gapReasons: ReasonCodeOption[];
  /** Previous recommendation's payable fees (null = first assessment). */
  lastPayableFees: number | null;
  siblingContext: SiblingContextRow[];
  /**
   * Epic 15 M6 (LA15-4): the assessment is not yet COMPLETE — working data
   * saves normally, but the formal Award-decision actions are withheld (the
   * server's set-outcome-core enforces the same rule).
   */
  outcomeLocked?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toInput(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function parseNum(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

// ─── Award-legs panel ─────────────────────────────────────────────────────────

/**
 * Epic 13 / C2 — the household net income the legs were computed from, with
 * the assessor's manual adjustment and its mandatory reason spelled out
 * underneath whenever one was applied. The figure the whole decision rests on
 * must never appear here unexplained.
 */
function HouseholdIncomeLine({ snapshot }: { snapshot: V2AssessmentSnapshot }) {
  const income = snapshot.totalHouseholdNetIncome;
  const adjustment = snapshot.manualAdjustment ?? 0;
  if (income == null && adjustment === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-slate-500">Household net income (C40)</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-slate-800">
          {income == null ? "—" : formatCurrency(income)}
        </span>
      </div>
      {adjustment !== 0 && (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-amber-700">
              Includes a manual income adjustment
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-amber-700">
              {adjustment > 0 ? "+" : "−"}
              {formatCurrency(Math.abs(adjustment))}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Reason:{" "}
            {snapshot.manualAdjustmentReason?.trim() || (
              <span className="italic text-slate-400">not recorded</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function AwardLegsPanel({
  snapshot,
  recommendedPayableFees,
}: {
  snapshot: V2AssessmentSnapshot;
  recommendedPayableFees: number;
}) {
  const legs = buildV2AwardLegs({
    actualRemainingDi: snapshot.actualRemainingDi ?? 0,
    theoreticalBenchmarkDi: snapshot.theoreticalBenchmarkDi ?? 0,
    affordabilityAdjustedDi: snapshot.affordabilityAdjustedDi ?? 0,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Award legs — minimum is recommended
        </CardTitle>
        <p className="text-sm text-slate-500">
          The three disposable-income legs from the completed assessment. The
          smallest (floored at £0) is the recommended payable fees.
        </p>
      </CardHeader>
      <CardContent>
        <HouseholdIncomeLine snapshot={snapshot} />
        <div className="space-y-1.5">
          {legs.map((leg) => (
            <div
              key={leg.key}
              className={cn(
                "flex items-baseline justify-between gap-2 rounded-md px-3 py-2",
                leg.isMin
                  ? "bg-primary-50 font-semibold text-primary-900"
                  : "text-slate-600"
              )}
            >
              <span className="text-sm">{leg.label}</span>
              <span className="font-mono text-sm tabular-nums">
                {formatCurrency(leg.value)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-baseline justify-between rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
          <span className="text-sm font-semibold text-primary-700">
            Recommended payable fees
          </span>
          <span className="font-mono text-lg font-bold text-primary-900">
            {formatCurrency(recommendedPayableFees)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Derived profiling strip (display-only) ────────────────────────────────────

function ProfilingStrip({ snapshot }: { snapshot: V2AssessmentSnapshot }) {
  const items: Array<{ label: string; value: string }> = [
    // CH-44 — "Could you add the family category as well?" It leads the list
    // because it is the input the other categories are derived against.
    {
      label: "Family category",
      value: snapshot.familyTypeCategory?.toString() ?? "—",
    },
    { label: "Income category", value: snapshot.incomeCategory?.toString() ?? "—" },
    {
      label: "Property category",
      value: snapshot.propertyCategoryDerived?.toString() ?? "—",
    },
    {
      label: "Property equity category",
      value: snapshot.propertyEquityCategory?.toString() ?? "—",
    },
    { label: "Financial equity", value: snapshot.financialEquityLabel ?? "—" },
    { label: "Debt status", value: snapshot.debtStatusLabel ?? "—" },
    {
      // CH-42 — status only. Charlotte: "I find odd the 7631% for the
      // lifestyle squeeze, maybe better to keep only the status displayed
      // there." The 7631% was itself a bug (the ratio is already in whole
      // percentage points, and was being multiplied by 100 again), but she
      // does not want the number on this panel either way. The figure stays
      // available in SEE COMPUTATION, with the units fixed.
      label: "Lifestyle squeeze",
      value: snapshot.lifestyleSqueezeLabel ?? "—",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Derived profiling (from the assessment)
        </CardTitle>
        <p className="text-sm text-slate-500">
          Computed by the v2 engine — replaces the manual income/property inputs.
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {items.map((it) => (
            <div key={it.label} className="flex items-baseline justify-between gap-2">
              <dt className="text-sm text-slate-500">{it.label}</dt>
              <dd className="text-sm font-medium text-slate-800">{it.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function RecommendationFormV2({
  applicationId,
  assessmentId,
  assessmentOutcome,
  synopsis,
  snapshot,
  recommendation,
  reasonCodes,
  gapReasons,
  lastPayableFees,
  siblingContext,
  outcomeLocked = false,
}: RecommendationFormV2Props) {
  const router = useRouter();
  const isReadOnly = isTerminalOutcome(assessmentOutcome);

  // CH-35 — completing the assessment from this tab, so the "complete the
  // assessment" instruction below is not a dead end. The server action carries
  // its own snapshot guard (CALC-15), which is what makes this safe to offer
  // away from the assessment form's client-side save-gate.
  const [isCompletingAssessment, setIsCompletingAssessment] =
    React.useState(false);
  const [completeError, setCompleteError] = React.useState<string | null>(null);

  const handleCompleteAssessment = async () => {
    setIsCompletingAssessment(true);
    setCompleteError(null);
    const result = await completeAssessmentAction(assessmentId, applicationId);
    setIsCompletingAssessment(false);
    if (result.success) {
      router.refresh();
    } else {
      setCompleteError(result.error);
    }
  };

  const recommendedPayableFees = snapshot.recommendedPayableFees ?? 0;
  const vatRate = snapshot.vatRate ?? 20;
  const { fees: nextYearFees, usingCurrentYearFee } = resolveNextYearFees({
    nextYearAnnualFees: snapshot.nextYearAnnualFees,
    annualFees: snapshot.annualFees,
  });

  // ── Assessor inputs ─────────────────────────────────────────────────────────
  const [scholarshipPctInput, setScholarshipPctInput] = React.useState<string>(
    toInput(snapshot.scholarshipPct ?? 0)
  );
  const [bursaryAwardInput, setBursaryAwardInput] = React.useState<string>(
    toInput(recommendation?.bursaryAward ?? 0)
  );
  const [confirmedInput, setConfirmedInput] = React.useState<string>(
    // Default confirmed to the recommended figure so the gap starts at £0.
    toInput(recommendation?.confirmedPayableFees ?? recommendedPayableFees)
  );
  const [selectedReasonCodeIds, setSelectedReasonCodeIds] = React.useState<string[]>(
    recommendation?.selectedReasonCodeIds ?? []
  );
  const [selectedGapReasonIds, setSelectedGapReasonIds] = React.useState<string[]>(
    recommendation?.selectedGapReasonIds ?? []
  );

  const scholarshipPct = parseNum(scholarshipPctInput);
  const bursaryAwardBeforeVat = parseNum(bursaryAwardInput);
  const confirmedPayableFees = parseNum(confirmedInput);

  // ── Live derivation via the engine's awardSummary (CH-36) ───────────────────
  const summary = React.useMemo(
    () =>
      deriveRecommendationAward({
        nextYearFees,
        scholarshipPct,
        bursaryAwardBeforeVat,
        confirmedPayableFees,
        recommendedPayableFees,
        vatRate,
      }),
    [
      nextYearFees,
      scholarshipPct,
      bursaryAwardBeforeVat,
      confirmedPayableFees,
      recommendedPayableFees,
      vatRate,
    ]
  );

  const gapAmount = computeGapAmount(confirmedPayableFees, recommendedPayableFees);
  const gapIsMaterial = hasMaterialGap(gapAmount);
  const gapValid = gapReasonSelectionValid(gapAmount, selectedGapReasonIds);

  // ── Save state ──────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ── Award decision dialog ─────────────────────────────────────────────────
  const [pendingDecision, setPendingDecision] = React.useState<AwardDecision | null>(
    null
  );
  const [isSettingOutcome, setIsSettingOutcome] = React.useState(false);

  async function handleSave() {
    if (!gapValid) {
      setSaveMessage({
        type: "error",
        text: "Select at least one reason for the gap between the recommended and confirmed payable fees.",
      });
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);

    const monthly = Math.round((confirmedPayableFees / 12) * 100) / 100;

    const payload: SaveRecommendationData = {
      // v2 drops the v1 free-text/manual inputs; derived values are persisted
      // below from the assessment snapshot for downstream (exports/reports).
      familySynopsis: null,
      accommodationStatus: null,
      incomeCategory: snapshot.incomeCategory?.toString() ?? null,
      propertyCategory: snapshot.propertyCategoryDerived ?? null,
      // Legacy award columns carry the confirmed figures so recommendation-
      // sourced readers (exports, reports) stay coherent for v2 rows.
      bursaryAward: bursaryAwardBeforeVat,
      scholarshipAward: summary.scholarshipSpendBeforeVat,
      yearlyPayableFees: confirmedPayableFees,
      monthlyPayableFees: monthly,
      dishonestyFlag: snapshot.dishonestyFlag,
      creditRiskFlag: false,
      summary: null,
      reasonCodeIds: selectedReasonCodeIds,
      // v2 min-of-three + gap tracking.
      recommendedPayableFees,
      confirmedPayableFees,
      gapAmount,
      lastPayableFees,
      scholarshipSpendBeforeVat: summary.scholarshipSpendBeforeVat,
      netFeesBeforeVat: summary.netFeesBeforeVat,
      bursarySpendBeforeVat: bursaryAwardBeforeVat,
      gapReasonIds: selectedGapReasonIds,
      // CALC-16 — persist the entered % back onto Assessment.scholarshipPct
      // (the v1 column this form derives from) so it round-trips on reload
      // instead of resetting to 0 and silently zeroing on the next save.
      scholarshipPct,
    };

    const result = await saveRecommendationAction(applicationId, payload);
    setIsSaving(false);
    if (result.success) {
      setSaveMessage({ type: "success", text: "Recommendation saved." });
      router.refresh();
    } else {
      setSaveMessage({ type: "error", text: result.error });
    }
  }

  async function handleConfirmDecision() {
    if (!pendingDecision) return;
    setIsSettingOutcome(true);
    const result = await setApplicationAwardAction(applicationId, pendingDecision, {
      bursaryAward: bursaryAwardBeforeVat,
      scholarshipAward: summary.scholarshipSpendBeforeVat,
    });
    setIsSettingOutcome(false);
    setPendingDecision(null);
    if (result.success) {
      router.refresh();
    } else {
      setSaveMessage({ type: "error", text: result.error });
    }
  }

  return (
    <div className="space-y-6">
      {isReadOnly && assessmentOutcome && (
        <ReadOnlyBanner outcome={assessmentOutcome} />
      )}

      {snapshot.dishonestyFlag && (
        <RedFlagBanner
          icon={ShieldAlert}
          title="Dishonesty Flag Active"
          description="A dishonesty concern was flagged during the assessment. Review carefully before setting an outcome."
        />
      )}

      {/* Award legs + recommended */}
      <AwardLegsPanel
        snapshot={snapshot}
        recommendedPayableFees={recommendedPayableFees}
      />

      {/* Sibling context (read-only, shared with v1) */}
      <SiblingContextPanel rows={siblingContext} />

      {/* Derived profiling (display-only) */}
      <ProfilingStrip snapshot={snapshot} />

      {/* ── Award summary (CH-36) — her six fields, her labels, in her order ──
          Everything before VAT; VAT applied ONCE at the end, to the payable
          line, because that is the only figure the parent actually pays. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Award summary
          </CardTitle>
          <p className="text-sm text-slate-500">
            School fees, the scholarship and the bursary award are all handled{" "}
            <span className="font-medium text-slate-700">before VAT</span>. VAT
            is applied once, to the yearly payable fees — the only line the
            parent pays.
            {usingCurrentYearFee && (
              <span className="text-amber-600">
                {" "}
                Using the current-year fee — no next-year figure is recorded yet.
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* autofill 1 */}
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-1 text-xs text-slate-500">
              Fees for next year (or applicable year) — before VAT
            </p>
            <p className="text-base font-semibold text-primary-900">
              {formatCurrency(nextYearFees)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* manual fill 1 */}
            <div className="space-y-1.5">
              <Label htmlFor="scholarship-pct">Scholarship Award (%)</Label>
              <Input
                id="scholarship-pct"
                type="number"
                min={0}
                max={100}
                step="0.5"
                inputMode="decimal"
                value={scholarshipPctInput}
                onChange={(e) => setScholarshipPctInput(e.target.value)}
                disabled={isReadOnly}
                placeholder="0"
              />
            </div>
            {/* manual fill 2 */}
            <div className="space-y-1.5">
              <Label htmlFor="bursary-award">
                Bursary Award / Spend (£) — before VAT
              </Label>
              <Input
                id="bursary-award"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={bursaryAwardInput}
                onChange={(e) => setBursaryAwardInput(e.target.value)}
                disabled={isReadOnly}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* autofill 4, 2, 3 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1 text-xs text-slate-500">
                Scholarship Spend — before VAT
              </p>
              <p className="text-base font-semibold text-primary-900">
                {formatCurrency(summary.scholarshipSpendBeforeVat)}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1 text-xs text-slate-500">
                Net fees (or applicable year) — before VAT
              </p>
              <p className="text-base font-semibold text-primary-900">
                {formatCurrency(summary.netFeesBeforeVat)}
              </p>
            </div>
            <div className="rounded-md border border-primary-200 bg-primary-50 px-4 py-3">
              <p className="mb-1 text-xs text-slate-500">
                Yearly Payable fees — including VAT
              </p>
              <p className="text-base font-semibold text-primary-900">
                {formatCurrency(summary.yearlyPayableFeesInclVat)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Confirmed payable fees + gap tracking ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirmed payable fees &amp; gap</CardTitle>
          <p className="text-sm text-slate-500">
            Last payable fees:{" "}
            <span className="font-medium text-slate-700">
              {lastPayableFees == null
                ? "first assessment"
                : formatCurrency(lastPayableFees)}
            </span>
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1 text-xs text-slate-500">Recommended (min-of-three)</p>
              <p className="text-base font-semibold text-slate-800">
                {formatCurrency(recommendedPayableFees)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmed-payable">Confirmed payable fees (£)</Label>
              <Input
                id="confirmed-payable"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={confirmedInput}
                onChange={(e) => setConfirmedInput(e.target.value)}
                disabled={isReadOnly}
                placeholder="0.00"
              />
            </div>
            <div
              className={cn(
                "rounded-md border px-4 py-3",
                gapIsMaterial
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-slate-50"
              )}
            >
              <p className="mb-1 text-xs text-slate-500">Gap (confirmed − recommended)</p>
              <p
                className={cn(
                  "text-base font-semibold",
                  gapIsMaterial ? "text-amber-800" : "text-slate-800"
                )}
              >
                {formatCurrency(gapAmount)}
              </p>
            </div>
          </div>

          {gapIsMaterial && (
            <div className="space-y-2">
              <Label>
                Reason(s) for the gap{" "}
                <span className="font-normal text-amber-600">
                  (required — at least one)
                </span>
              </Label>
              <ReasonCodeSelector
                reasonCodes={gapReasons}
                selectedIds={selectedGapReasonIds}
                onChange={setSelectedGapReasonIds}
                disabled={isReadOnly}
                // CALC-16 — gap_reasons (codes 1–10) is a separate taxonomy
                // from reason_codes; the YoY category grouping would bucket
                // every one of these under "Legacy (deprecated)".
                grouped={false}
                flatGroupLabel="Reasons for gap"
              />
              {!gapValid && (
                <p className="text-xs text-red-600" role="alert">
                  A material gap requires at least one reason.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Single assessment synopsis (Epic 06) ─────────────────────────── */}
      <AssessmentSynopsis
        assessmentId={assessmentId}
        applicationId={applicationId}
        synopsis={synopsis}
        assessmentCompleted
      />

      {/* ── Reason codes (year-on-year) ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reason codes (year-on-year)</CardTitle>
        </CardHeader>
        <CardContent>
          <ReasonCodeSelector
            reasonCodes={reasonCodes}
            selectedIds={selectedReasonCodeIds}
            onChange={setSelectedReasonCodeIds}
            disabled={isReadOnly}
          />
        </CardContent>
      </Card>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      {!isReadOnly && (
        <div className="flex items-center gap-4">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !gapValid}
            className="bg-primary-700 hover:bg-primary-800 text-white"
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? "Saving..." : "Save Recommendation"}
          </Button>
          {saveMessage && (
            <p
              className={cn(
                "text-sm",
                saveMessage.type === "success" ? "text-green-700" : "text-red-600"
              )}
              role="status"
              aria-live="polite"
            >
              {saveMessage.text}
            </p>
          )}
        </div>
      )}

      {/* ── Award decision ───────────────────────────────────────────────── */}
      {/* CH-35 — this used to be a bare instruction with no control anywhere on
          the tab: the assessment's Complete button lives on the model tab, and
          the header lifecycle strip only LOOKS clickable. Charlotte read the
          note, clicked the header's COMPLETE chip, and nothing happened. The
          instruction now carries the action it asks for. */}
      {!isReadOnly && outcomeLocked && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-slate-700">
                Complete the assessment to record the outcome.
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                Save the recommendation above first — the award figures are
                recorded with the decision.
              </p>
              {completeError && (
                <p
                  className="mt-1.5 text-sm font-medium text-red-600"
                  role="alert"
                >
                  {completeError}
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={handleCompleteAssessment}
              disabled={isCompletingAssessment}
              className="bg-success-600 text-white hover:bg-success-600/90"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {isCompletingAssessment
                ? "Completing…"
                : "Complete assessment"}
            </Button>
          </CardContent>
        </Card>
      )}
      {!isReadOnly && !outcomeLocked && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Award decision</CardTitle>
            <p className="text-sm text-slate-500">
              Record the panel&apos;s decision. Once set, the matching outcome
              email is sent and this recommendation becomes read-only. Save the
              recommendation first so the award figures are recorded with the
              decision.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(
                ["AWARDED", "QUALIFIES_NOT_AWARDED", "DOES_NOT_QUALIFY"] as const
              ).map((decision) => {
                const meta = AWARD_DECISIONS[decision];
                const Icon = meta.icon;
                return (
                  <Button
                    key={decision}
                    type="button"
                    onClick={() => setPendingDecision(decision)}
                    className={meta.buttonClass}
                  >
                    <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {meta.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <AwardDialog
        open={pendingDecision !== null}
        decision={pendingDecision}
        scholarshipAward={summary.scholarshipSpendBeforeVat}
        bursaryAward={bursaryAwardBeforeVat}
        isPending={isSettingOutcome}
        onConfirm={handleConfirmDecision}
        onCancel={() => setPendingDecision(null)}
      />
    </div>
  );
}
