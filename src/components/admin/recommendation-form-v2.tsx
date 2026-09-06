"use client";

/**
 * CALC-08 — v2 recommendation surface (actual-leg award + gap tracking).
 *
 * Rendered by the recommendation page ONLY for `calculationVersion: 2`
 * assessments (v1 keeps the untouched `recommendation-form.tsx`). It:
 *  - shows the THREE award legs (actual / theoretical / affordability-adjusted)
 *    read straight from the completed assessment's snapshot columns (never
 *    recomputed), with the ACTUAL leg highlighted — that leg (floored at £0)
 *    is `recommendedPayableFees` (5 Sep 2026: min-of-three retired; the other
 *    two legs are comparison views);
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
  Award,
  Clock3,
  Archive,
  Undo2,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReasonCodeSelector } from "@/components/admin/reason-code-selector";
import {
  gapGroupHeadingForCode,
  GAP_CODE_GROUP_HEADINGS,
} from "@/lib/reason-codes/gap-category";
import type { ReasonCodeOption } from "@/components/admin/reason-code-selector";
import { AssessmentSynopsis } from "@/components/admin/assessment-synopsis";
import {
  ReadOnlyBanner,
  RedFlagBanner,
  SiblingContextPanel,
  formatCurrency,
  isTerminalOutcome,
  type SiblingContextRow,
} from "@/components/admin/recommendation-form";
import {
  saveRecommendationAction,
  setPostAssessmentStateAction,
  revertPostAssessmentStateAction,
  type SaveRecommendationData,
} from "@/app/(admin)/applications/[id]/recommendation/actions";
import type { PostAssessmentFinalState } from "@/lib/applications/status";
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
import type {
  ApplicationType,
  AssessmentOutcome,
  AssessmentStatus,
  AwardFundType,
  School,
} from "@prisma/client";
import {
  AWARD_FUND_LABELS,
  awardFundOptionsForSchool,
} from "@/lib/assessment/award-fund";

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
  /** CH-43 — the joined "SM4-MORDEN" label, resolved server-side. */
  postcodeAreaLabel: string | null;
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
  /** Epic 18 — the assessment's lifecycle status; drives the decision card and the read-only lock. */
  assessmentStatus: AssessmentStatus;
  /** Epic 18b — NEW locks as New Award (+ waiting list); ROLLING_OVER locks as Rolled-over. */
  applicationType: ApplicationType;
  /** Epic 18b — the assessed school; constrains the award-fund options. */
  school: School;
  /** Epic 18b — the fund recorded at a previous lock, pre-filling the picker. */
  awardFundType: AwardFundType | null;
  /** Epic 18b — active close reasons for the archive prompt. */
  closeReasons: Array<{ id: string; label: string }>;
  /** Epic 18 (Q14) — the current application reference, pre-filling the advisory prompt at New Award. */
  applicationReference: string;
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

// ─── Epic 18 — the post-assessment decisions ────────────────────────────────
//
// Charlotte's model (docs/diagrams/epic-18-post-assessment-lifecycle.md). No
// decision sends an email (Q11 — she writes to families herself once the
// governors have approved), and every one has a way back to Stored as
// Complete (Q15/Q16). CLOSED_PURGED is deliberately absent until Q10b is
// agreed in writing (WP-B6).
const POST_ASSESSMENT_META: Record<
  PostAssessmentFinalState,
  {
    label: string;
    icon: typeof Award;
    buttonClass: string;
    bannerClass: string;
    bannerText: string;
    dialogTitle: string;
    dialogBody: string;
    confirmLabel: string;
    revertLabel: string;
  }
> = {
  NEW_AWARD: {
    label: "Lock as new award",
    icon: Award,
    buttonClass: "bg-success-600 text-white hover:bg-success-600/90",
    bannerClass: "border-success-300 bg-success-50 text-success-800",
    bannerText:
      "Locked as a new award. The active bursary account is set up and the admin page is live; the assessment can no longer be amended.",
    dialogTitle: "Lock as new award?",
    dialogBody:
      "This locks the assessment as final, sets up the active bursary account and activates the admin page. No email is sent — you notify the family once the governors have approved.",
    confirmLabel: "Lock as new award",
    revertLabel: "Reverse new award",
  },
  ROLLED_OVER: {
    label: "Lock rolled-over award",
    icon: Award,
    buttonClass: "bg-success-600 text-white hover:bg-success-600/90",
    bannerClass: "border-success-300 bg-success-50 text-success-800",
    bannerText:
      "Locked as a rolled-over award. The active bursary account continues; the assessment can no longer be amended.",
    dialogTitle: "Lock rolled-over award?",
    dialogBody:
      "This locks the assessment as final and continues the active bursary account. The account, reference and admin page already exist, so nothing new is created. No email is sent.",
    confirmLabel: "Lock rolled-over award",
    revertLabel: "Reverse rolled-over award",
  },
  WAITING_LIST: {
    label: "Waiting list",
    icon: Clock3,
    buttonClass: "bg-amber-500 text-white hover:bg-amber-500/90",
    bannerClass: "border-amber-300 bg-amber-50 text-amber-800",
    bannerText:
      "On the bursary waiting list while the admission team works through accepted and declined place offers.",
    dialogTitle: "Move to the waiting list?",
    dialogBody:
      "The assessment is held while the admission team works through the accepted and declined place offers. It can move on to a new award or a close, or come back to stored, at any time. No email is sent.",
    confirmLabel: "Move to waiting list",
    revertLabel: "Return to stored as complete",
  },
  CLOSED_ARCHIVED: {
    label: "Close & archive",
    icon: Archive,
    buttonClass: "bg-slate-600 text-white hover:bg-slate-600/90",
    bannerClass: "border-slate-300 bg-slate-100 text-slate-700",
    bannerText:
      "Closed and archived. The record is retained and the assessment can be reopened if needed.",
    dialogTitle: "Close and archive?",
    dialogBody:
      "The assessment closes with the record retained. It can be reopened back to stored as complete later. No email is sent.",
    confirmLabel: "Close & archive",
    revertLabel: "Reopen (back to stored)",
  },
};

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
          Award legs — actual is recommended
        </CardTitle>
        <p className="text-sm text-slate-500">
          The actual remaining DI (floored at £0) is the recommended payable
          fees. The theoretical benchmark and affordability legs are shown for
          comparison only.
        </p>
      </CardHeader>
      <CardContent>
        <HouseholdIncomeLine snapshot={snapshot} />
        <div className="space-y-1.5">
          {/* 5 Sep 2026 — min-of-three retired: the ACTUAL leg IS the
              recommendation ("the Actual remaining DI should remain the
              recommended payable fees value as this is derived from the
              applied deductions"), so the CH-59 accent emphasis and the
              recommended-row tint now coincide on it by design. The other two
              legs stay visible as her end-of-assessment comparison views. */}
          {legs.map((leg) => {
            const isActual = leg.isRecommendedSource;
            return (
              <div
                key={leg.key}
                className={cn(
                  "flex items-baseline justify-between gap-2 rounded-md px-3 py-2",
                  isActual
                    ? "bg-primary-50 text-base font-bold text-accent-700"
                    : "text-slate-600"
                )}
              >
                <span className={isActual ? "text-base" : "text-sm"}>
                  {leg.label}
                </span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    isActual ? "text-base font-bold" : "text-sm"
                  )}
                >
                  {formatCurrency(leg.value)}
                </span>
              </div>
            );
          })}
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
    // CH-43 — "Could you add the post code field there as well?" The area is
    // resolved from reference data at read time, never stored beside the code,
    // so correcting her lookup table fixes every assessment at once.
    { label: "Postcode", value: snapshot.postcodeAreaLabel ?? "—" },
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
  assessmentStatus,
  applicationType,
  school,
  awardFundType: savedAwardFundType,
  closeReasons,
  applicationReference,
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
  // Epic 18 — a post-assessment final state locks the form; so does a legacy
  // 3-value outcome on old rows. (Local union check rather than importing the
  // server-side status module into this client component.)
  const finalState: PostAssessmentFinalState | null =
    assessmentStatus === "NEW_AWARD" ||
    assessmentStatus === "ROLLED_OVER" ||
    assessmentStatus === "WAITING_LIST" ||
    assessmentStatus === "CLOSED_ARCHIVED"
      ? assessmentStatus
      : null;
  const isReadOnly = isTerminalOutcome(assessmentOutcome) || finalState != null;

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

  // ── Epic 18 — post-assessment decision dialog ────────────────────────────
  const [pendingState, setPendingState] =
    React.useState<PostAssessmentFinalState | null>(null);
  const [isSettingState, setIsSettingState] = React.useState(false);
  const [isReverting, setIsReverting] = React.useState(false);
  // Q14 — the advisory reference prompt inside the New Award dialog.
  const [awardReference, setAwardReference] = React.useState(applicationReference);
  // Epic 18b — the fund picker (both locks) and the archive close reason.
  const fundOptions = awardFundOptionsForSchool(school);
  const [selectedFund, setSelectedFund] = React.useState<AwardFundType>(
    savedAwardFundType && fundOptions.includes(savedAwardFundType)
      ? savedAwardFundType
      : fundOptions[0]
  );
  const [selectedCloseReasonId, setSelectedCloseReasonId] = React.useState<string>("");

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
      // v2 actual-leg recommendation + gap tracking.
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

  async function handleConfirmState() {
    if (!pendingState) return;
    setIsSettingState(true);
    const isAwardLock = pendingState === "NEW_AWARD" || pendingState === "ROLLED_OVER";
    const result = await setPostAssessmentStateAction(applicationId, pendingState, {
      amendedReference: pendingState === "NEW_AWARD" ? awardReference : undefined,
      awardFundType: isAwardLock ? selectedFund : undefined,
      closeReasonId:
        pendingState === "CLOSED_ARCHIVED" ? selectedCloseReasonId || undefined : undefined,
    });
    setIsSettingState(false);
    setPendingState(null);
    if (result.success) {
      router.refresh();
    } else {
      setSaveMessage({ type: "error", text: result.error });
    }
  }

  async function handleRevertState() {
    setIsReverting(true);
    const result = await revertPostAssessmentStateAction(applicationId);
    setIsReverting(false);
    if (result.success) {
      router.refresh();
    } else {
      setSaveMessage({ type: "error", text: result.error });
    }
  }

  return (
    <div className="space-y-6">
      {/* Epic 18 — the final-state banner carries its own way back (Q15/Q16)
          and, from the waiting list, the two onward moves. */}
      {finalState && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3",
            POST_ASSESSMENT_META[finalState].bannerClass
          )}
          role="status"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-sm font-medium">
                {POST_ASSESSMENT_META[finalState].bannerText}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {finalState === "WAITING_LIST" && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setPendingState("NEW_AWARD")}
                    className={POST_ASSESSMENT_META.NEW_AWARD.buttonClass}
                  >
                    <Award className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Lock as new award
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setPendingState("CLOSED_ARCHIVED")}
                    className={POST_ASSESSMENT_META.CLOSED_ARCHIVED.buttonClass}
                  >
                    <Archive className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Close & archive
                  </Button>
                </>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRevertState}
                disabled={isReverting}
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {isReverting
                  ? "Reverting…"
                  : POST_ASSESSMENT_META[finalState].revertLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
      {!finalState && isReadOnly && assessmentOutcome && (
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
              <p className="mb-1 text-xs text-slate-500">Recommended (actual remaining DI)</p>
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
                // D4 (6 Sep 2026) — her definitive gap list ships in four
                // named groups, rendered via the taxonomy-specific heading
                // props (gap codes never share the reason_codes numbering).
                headingFor={gapGroupHeadingForCode}
                headingOrder={GAP_CODE_GROUP_HEADINGS}
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
      {/* Epic 18 (WP-B7) — the three award-decision buttons are GONE. What
          replaces them is her post-assessment model: New Award / Waiting list /
          Close & archive, none of which sends an email (Q11). */}
      {!isReadOnly && !outcomeLocked && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Post-assessment decision</CardTitle>
            <p className="text-sm text-slate-500">
              Move this stored assessment to its final stage. No email is sent
              — you write to families once the governors have approved. Save
              the recommendation first so the award figures are recorded with
              the assessment.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {/* Epic 18b — each track offers its own decisions (her
                  illustration): NEW gets the waiting list; ROLLING_OVER locks
                  as rolled-over; purge stays unbuilt on both. */}
              {(applicationType === "ROLLING_OVER"
                ? (["ROLLED_OVER", "CLOSED_ARCHIVED"] as const)
                : (["NEW_AWARD", "WAITING_LIST", "CLOSED_ARCHIVED"] as const)
              ).map((state) => {
                const meta = POST_ASSESSMENT_META[state];
                const Icon = meta.icon;
                return (
                  <Button
                    key={state}
                    type="button"
                    onClick={() => setPendingState(state)}
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

      <Dialog
        open={pendingState !== null}
        onOpenChange={(open) => {
          if (!open) setPendingState(null);
        }}
      >
        <DialogContent>
          {pendingState && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {POST_ASSESSMENT_META[pendingState].dialogTitle}
                </DialogTitle>
                <DialogDescription>
                  {POST_ASSESSMENT_META[pendingState].dialogBody}
                </DialogDescription>
              </DialogHeader>
              {(pendingState === "NEW_AWARD" || pendingState === "ROLLED_OVER") && (
                <div className="space-y-1.5">
                  {/* Epic 18b — which fund pays this year's award; options
                      constrained by the assessed school. */}
                  <Label htmlFor="award-fund">Funded by</Label>
                  <Select
                    value={selectedFund}
                    onValueChange={(v) => setSelectedFund(v as AwardFundType)}
                  >
                    <SelectTrigger id="award-fund">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fundOptions.map((fund) => (
                        <SelectItem key={fund} value={fund}>
                          {AWARD_FUND_LABELS[fund]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {pendingState === "NEW_AWARD" && (
                <div className="space-y-1.5">
                  {/* Q14 — advisory, never blocking: confirm or amend, then lock.
                      Editable here by assessors and admins alike. */}
                  <Label htmlFor="award-reference">Bursary reference</Label>
                  <Input
                    id="award-reference"
                    value={awardReference}
                    onChange={(e) => setAwardReference(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Check the reference before locking — amend it here if
                    needed, or leave it as it is.
                  </p>
                </div>
              )}
              {pendingState === "CLOSED_ARCHIVED" && (
                <div className="space-y-1.5">
                  {/* Epic 18b — her illustration's "prompt asking for close
                      reasons". Required. */}
                  <Label htmlFor="archive-close-reason">Close reason</Label>
                  <Select
                    value={selectedCloseReasonId}
                    onValueChange={setSelectedCloseReasonId}
                  >
                    <SelectTrigger id="archive-close-reason">
                      <SelectValue placeholder="Select a reason…" />
                    </SelectTrigger>
                    <SelectContent>
                      {closeReasons.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingState(null)}
                  disabled={isSettingState}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmState}
                  disabled={
                    isSettingState ||
                    (pendingState === "CLOSED_ARCHIVED" && !selectedCloseReasonId)
                  }
                  className={POST_ASSESSMENT_META[pendingState].buttonClass}
                >
                  {isSettingState
                    ? "Applying…"
                    : POST_ASSESSMENT_META[pendingState].confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
