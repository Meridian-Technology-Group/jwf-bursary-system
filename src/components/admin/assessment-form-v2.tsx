"use client";

/**
 * CALC-07 — v2 assessor form (full notional model capture + live calculation).
 *
 * Rendered by the assessment page ONLY for `calculationVersion: 2` assessments
 * (v1 assessments keep the untouched `assessment-form.tsx`). Captures the
 * status-driven income records, the six notional blocks with their conditional
 * add-backs/toggles, the itemised property + debt records, savings, and the
 * award inputs, running `calculateAssessmentV2` live via the v2 hook and
 * persisting every v2 snapshot column + JSONB record on save.
 *
 * All fields are pre-filled ONCE from the family's submitted income/assets
 * (auto-populate-then-confirm): the page seeds `prefill` from the submitted
 * sections when a stored record is absent; thereafter the stored record wins.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  PauseCircle,
  Save,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AssessmentStatus, EmploymentStatus, RentAddBackType } from "@prisma/client";
import type { AssessorIncomeRecord, PropertyAssetsRecord, DebtsRecord } from "@/types/assessment-v2";
import type { ReferenceBundle } from "@/lib/assessment/v2/types";
import type { PropertyPortfolioType } from "@/lib/assessment/v2/profiling";
import type { AssessmentV2Input } from "@/lib/assessment/v2/orchestrator";
import { getNotionalCostAmount, getFamilyCategoryMeta } from "@/lib/assessment/reference-bands";
import { calculateSchoolingYearsRemainingFromEntry, type EntryYearGroupCode } from "@/lib/assessment/schooling-years";
import { calculateDerivedSavings } from "@/lib/assessment/stage2-assets";
import { applyFamilyTypeDefaults, type OverridableField } from "@/lib/assessment/auto-populate";
import { useAssessmentCalculationV2 } from "@/hooks/use-assessment-calculation-v2";
import { EarnerFormV2, CurrencyInput } from "@/components/admin/earner-form-v2";
import { AssessmentCalcStripV2 } from "@/components/admin/assessment-calc-strip-v2";
import {
  saveAssessmentAction,
  completeAssessmentAction,
  pauseAssessmentAction,
} from "@/app/(admin)/applications/[id]/assessment/actions";
import type { AssessmentSaveInput } from "@/lib/db/queries/assessments";

// ─── Serialised (Decimal→number) shapes handed in from the server component ────

export interface SerialisedEarnerV2 {
  earnerLabel: "PARENT_1" | "PARENT_2";
  employmentStatus: EmploymentStatus;
  incomeDetail: AssessorIncomeRecord | null;
}

export interface SerialisedAssessmentV2 {
  id: string;
  applicationId: string;
  calculationVersion: number;
  status: AssessmentStatus;
  familyTypeCategory: number | null;
  annualFees: number | null;
  schoolingYearsRemaining: number | null;
  scholarshipPct: number | null;
  vatRate: number | null;
  rentAddBackType: RentAddBackType | null;
  multiPropertyRentAddBack: boolean | null;
  councilTaxSupport: boolean | null;
  usesCar: boolean | null;
  usesPublicTransport: boolean | null;
  feeInsuranceAnnual: number | null;
  behindOnFees: boolean | null;
  dishonestyFlag: boolean;
  earners: SerialisedEarnerV2[];
  property: {
    propertyAssets: PropertyAssetsRecord | null;
    debts: DebtsRecord | null;
    cashSavings: number | null;
    isasPepsShares: number | null;
    schoolAgeChildrenCount: number | null;
  } | null;
}

/** First-load pre-fill sourced from the family's submitted sections (see prefill.ts). */
export interface AssessmentV2Prefill {
  parent1Income: AssessorIncomeRecord;
  parent2Income: AssessorIncomeRecord;
  propertyAssets: PropertyAssetsRecord;
  debts: DebtsRecord;
  portfolioType: PropertyPortfolioType;
  cashSavings: number;
  isasPepsShares: number;
  usesCar: boolean;
  usesPublicTransport: boolean;
}

interface AssessmentFormV2Props {
  assessment: SerialisedAssessmentV2;
  applicationId: string;
  referenceBundle: ReferenceBundle;
  prefill: AssessmentV2Prefill;
  defaultAnnualFees: number;
  applicationEntryYear: number | null;
  applicationEntryYearGroup: EntryYearGroupCode | null;
  siblingPayableFees?: number[];
  forceTwoEarner?: boolean;
  secondaryParentOverride?: boolean;
  readOnly?: boolean;
}

const RENT_ADD_BACK_OPTIONS: { value: RentAddBackType; label: string }[] = [
  { value: "NONE", label: "No add-back" },
  { value: "FULL_MORTGAGE_FREE", label: "Full — mortgage-free (+100%)" },
  { value: "FULL_RENT_FREE", label: "Full — rent-free (+100%)" },
  { value: "PARTIAL_LOWER_RENT", label: "Partial — lower rent (+25%)" },
];

const PORTFOLIO_OPTIONS: { value: PropertyPortfolioType; label: string }[] = [
  { value: "RENTING", label: "Renting (no owned property)" },
  { value: "SINGLE", label: "Single property (home only)" },
  { value: "DOUBLE", label: "Double (home + one other)" },
  { value: "MULTIPLE", label: "Multiple (home + two or more)" },
];

const MULTI_PROPERTY_HELPER =
  "Add back the notional rent again when ANY of: (1) an additional property is mortgage-free; " +
  "OR (2) an additional property generates rental income; OR (3) additional properties collectively " +
  "hold substantial equity. Assessor judgement (assumption CALC-A7).";

const EMPTY_INCOME: AssessorIncomeRecord = { total: 0, documentsConfirmed: false };

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(v);
}

/** Best-effort dominant employment status for the (non-null) `employmentStatus` column — back-compat display only. */
function dominantEmploymentStatus(rec: AssessorIncomeRecord): EmploymentStatus {
  if (rec.selfEmployed) return rec.selfEmployed.dividends > 0 ? "SELF_EMPLOYED_DIRECTOR" : "SELF_EMPLOYED_SOLE";
  if (rec.retired) return "OLD_AGE_PENSION";
  if (rec.unemployed) return "UNEMPLOYED";
  if (rec.benefits && !rec.employed) return "BENEFITS";
  return "PAYE";
}

// ─── Collapsible section (local, mirrors v1 FormSection) ──────────────────────

function FormSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card className="border-slate-200">
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
          {title}
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
          )}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="space-y-4 pt-0">{children}</CardContent>}
    </Card>
  );
}

function FieldRow({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-slate-600">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssessmentFormV2({
  assessment,
  applicationId,
  referenceBundle,
  prefill,
  defaultAnnualFees,
  applicationEntryYear,
  applicationEntryYearGroup,
  siblingPayableFees = [],
  forceTwoEarner = false,
  secondaryParentOverride = false,
  readOnly: readOnlyProp = false,
}: AssessmentFormV2Props) {
  const router = useRouter();
  const isReadOnly = readOnlyProp || assessment.status === "COMPLETED";

  // Two-earner mode: forced by a submitted secondary, unless the assessor has
  // overridden to proceed without them. Otherwise single-earner.
  const twoEarner = forceTwoEarner && !secondaryParentOverride;

  // ── State: family / fees / schooling ────────────────────────────────────────
  const [familyTypeCategory, setFamilyTypeCategory] = React.useState<number>(
    assessment.familyTypeCategory ?? 1
  );
  const [annualFees, setAnnualFees] = React.useState<number>(
    Number(assessment.annualFees ?? defaultAnnualFees) || 0
  );
  const [schoolingYearsRemaining, setSchoolingYearsRemaining] = React.useState<number>(
    assessment.schoolingYearsRemaining ??
      calculateSchoolingYearsRemainingFromEntry(applicationEntryYearGroup, applicationEntryYear) ??
      7
  );

  // ── State: earners (status-driven records) ──────────────────────────────────
  const earnerFromStore = React.useCallback(
    (label: "PARENT_1" | "PARENT_2", fallback: AssessorIncomeRecord): AssessorIncomeRecord => {
      const stored = assessment.earners.find((e) => e.earnerLabel === label)?.incomeDetail;
      return stored ?? fallback;
    },
    [assessment.earners]
  );
  const [parent1, setParent1] = React.useState<AssessorIncomeRecord>(() =>
    earnerFromStore("PARENT_1", prefill.parent1Income)
  );
  const [parent2, setParent2] = React.useState<AssessorIncomeRecord>(() =>
    earnerFromStore("PARENT_2", prefill.parent2Income)
  );

  // ── State: notional toggles ─────────────────────────────────────────────────
  const [rentAddBackType, setRentAddBackType] = React.useState<RentAddBackType>(
    assessment.rentAddBackType ?? "NONE"
  );
  const [multiPropertyRentAddBack, setMultiPropertyRentAddBack] = React.useState<boolean>(
    assessment.multiPropertyRentAddBack ?? false
  );
  const [councilTaxSupport, setCouncilTaxSupport] = React.useState<boolean>(
    assessment.councilTaxSupport ?? false
  );
  const [usesCar, setUsesCar] = React.useState<boolean>(
    assessment.usesCar ?? prefill.usesCar
  );
  const [usesPublicTransport, setUsesPublicTransport] = React.useState<boolean>(
    assessment.usesPublicTransport ?? prefill.usesPublicTransport
  );
  const [feeInsuranceAnnual, setFeeInsuranceAnnual] = React.useState<number>(
    Number(assessment.feeInsuranceAnnual ?? 0) || 0
  );

  // ── State: property / debt / savings ────────────────────────────────────────
  const [propertyAssets, setPropertyAssets] = React.useState<PropertyAssetsRecord>(
    assessment.property?.propertyAssets ?? prefill.propertyAssets
  );
  const [debts, setDebts] = React.useState<DebtsRecord>(
    assessment.property?.debts ?? prefill.debts
  );
  const [portfolioType, setPortfolioType] = React.useState<PropertyPortfolioType>(
    prefill.portfolioType
  );
  const [cashSavings, setCashSavings] = React.useState<number>(
    Number(assessment.property?.cashSavings ?? prefill.cashSavings) || 0
  );
  const [isasPepsShares, setIsasPepsShares] = React.useState<number>(
    Number(assessment.property?.isasPepsShares ?? prefill.isasPepsShares) || 0
  );
  const [behindOnFees, setBehindOnFees] = React.useState<boolean>(assessment.behindOnFees ?? false);
  const [dishonestyFlag, setDishonestyFlag] = React.useState<boolean>(assessment.dishonestyFlag);

  // school-age children default from FamilyCategoryMeta, overridable (CALC-07).
  const metaDefaultChildren = React.useMemo(
    () => getFamilyCategoryMeta(referenceBundle.familyCategoryMetas, familyTypeCategory)?.schoolAgeChildren ?? 1,
    [referenceBundle.familyCategoryMetas, familyTypeCategory]
  );
  const [schoolAgeChildrenCount, setSchoolAgeChildrenCount] = React.useState<number>(
    assessment.property?.schoolAgeChildrenCount ?? metaDefaultChildren
  );
  // Seed the overridden set: a stored count differing from the meta default is a prior override.
  const [overridden, setOverridden] = React.useState<Set<OverridableField>>(() => {
    const set = new Set<OverridableField>();
    const stored = assessment.property?.schoolAgeChildrenCount;
    if (stored != null && stored !== metaDefaultChildren) set.add("schoolAgeChildrenCount");
    return set;
  });

  // ── Live calculation input ──────────────────────────────────────────────────
  const input: AssessmentV2Input = React.useMemo(() => {
    const earners = twoEarner ? [parent1, parent2] : [parent1];
    return {
      earners,
      familyTypeCategory,
      rentAddBackType,
      multiPropertyRentAddBack,
      councilTaxSupport,
      usesCar,
      usesPublicTransport,
      feeInsuranceAnnual,
      cashSavings,
      isasPepsShares,
      schoolAgeChildrenCount,
      schoolingYearsRemaining,
      propertyAssets,
      portfolioType,
      debts,
      siblingPayableFees,
      annualFees,
      scholarshipPct: Number(assessment.scholarshipPct ?? 0) || 0,
      vatRate: Number(assessment.vatRate ?? 20) || 20,
    };
  }, [
    twoEarner,
    parent1,
    parent2,
    familyTypeCategory,
    rentAddBackType,
    multiPropertyRentAddBack,
    councilTaxSupport,
    usesCar,
    usesPublicTransport,
    feeInsuranceAnnual,
    cashSavings,
    isasPepsShares,
    schoolAgeChildrenCount,
    schoolingYearsRemaining,
    propertyAssets,
    portfolioType,
    debts,
    siblingPayableFees,
    annualFees,
    assessment.scholarshipPct,
    assessment.vatRate,
  ]);

  const output = useAssessmentCalculationV2(input, referenceBundle);

  // Auto notional values (for the per-line display) + savings cushion, from the bundle.
  const savingsCushion = getNotionalCostAmount(referenceBundle.notionalCosts, familyTypeCategory, "SAVINGS_CUSHION");
  const notionalAuto = (costType: Parameters<typeof getNotionalCostAmount>[2]) =>
    getNotionalCostAmount(referenceBundle.notionalCosts, familyTypeCategory, costType);

  // ── Save / complete / pause ─────────────────────────────────────────────────
  const [isSaving, setIsSaving] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isPausing, setIsPausing] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  const handleSave = React.useCallback(async () => {
    if (isReadOnly) return;
    setIsSaving(true);
    setSaveError(null);

    const derivedSavings = calculateDerivedSavings(
      cashSavings,
      isasPepsShares,
      schoolAgeChildrenCount,
      schoolingYearsRemaining
    );

    // Snapshot the orchestrator output 1:1 onto the v2 columns (only when it
    // computed — leave nulls otherwise so a half-entered row isn't misleading).
    const snapshot: Partial<AssessmentSaveInput> = output
      ? {
          totalHouseholdNetIncome: output.householdNetIncome,
          notionalEssentials: output.notionalEssentials,
          notionalCar: output.notionalCar,
          notionalPublicTransport: output.notionalPublicTransport,
          notionalJwfAllowance: output.notionalJwfAllowance,
          notionalSavingsBenchmark: output.notionalSavingsBenchmark,
          savingsTestNumber: output.savingsTestNumber,
          totalNotionalSpend: output.totalNotionalSpend,
          ndiAfterNotionalSpend: output.ndiAfterNotionalSpend,
          derivedYearlyDebtRepayments: output.derivedYearlyDebtRepayments,
          yearlyDebtExposure: output.yearlyDebtExposure,
          debtOverNdiRatio: output.debtOverNdiRatio,
          debtStatusLabel: output.debtStatusLabel,
          incomeCategory: output.incomeCategory,
          propertyCategoryDerived: output.propertyCategoryDerived,
          propertyEquityCategory: output.propertyEquityCategory,
          financialEquityLabel: output.financialEquityLabel,
          lifestyleSqueezeRatio: output.lifestyleSqueezeRatio,
          lifestyleSqueezeLabel: output.lifestyleSqueezeLabel,
          actualRemainingDi: output.actualRemainingDi,
          theoreticalBenchmarkDi: output.theoreticalBenchmarkDi,
          affordabilityAdjustedDi: output.affordabilityAdjustedDi,
          recommendedPayableFees: output.recommendedPayableFees,
        }
      : {};

    const earnersV2 = (twoEarner ? [parent1, parent2] : [parent1]).map((rec, idx) => ({
      earnerLabel: (idx === 0 ? "PARENT_1" : "PARENT_2") as "PARENT_1" | "PARENT_2",
      employmentStatus: dominantEmploymentStatus(rec),
      incomeDetail: rec,
    }));

    const payload: AssessmentSaveInput = {
      familyTypeCategory,
      annualFees,
      schoolingYearsRemaining,
      rentAddBackType,
      multiPropertyRentAddBack,
      councilTaxSupport,
      usesCar,
      usesPublicTransport,
      feeInsuranceAnnual,
      behindOnFees,
      dishonestyFlag,
      ...snapshot,
      earnersV2,
      propertyV2: {
        propertyAssets,
        debts,
        cashSavings,
        isasPepsShares,
        schoolAgeChildrenCount,
        derivedSavingsAnnualTotal: derivedSavings,
      },
    };

    const result = await saveAssessmentAction(assessment.id, applicationId, payload);
    setIsSaving(false);
    if (result.success) setLastSaved(new Date());
    else setSaveError(result.error);
  }, [
    isReadOnly,
    output,
    assessment.id,
    applicationId,
    twoEarner,
    parent1,
    parent2,
    familyTypeCategory,
    annualFees,
    schoolingYearsRemaining,
    rentAddBackType,
    multiPropertyRentAddBack,
    councilTaxSupport,
    usesCar,
    usesPublicTransport,
    feeInsuranceAnnual,
    behindOnFees,
    dishonestyFlag,
    propertyAssets,
    debts,
    cashSavings,
    isasPepsShares,
    schoolAgeChildrenCount,
  ]);

  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSave = React.useCallback(() => {
    if (isReadOnly) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave();
    }, 400);
  }, [handleSave, isReadOnly]);

  const handleComplete = async () => {
    setIsCompleting(true);
    await handleSave();
    const result = await completeAssessmentAction(assessment.id, applicationId);
    setIsCompleting(false);
    if (result.success) router.refresh();
    else setSaveError(result.error);
  };

  const handlePause = async () => {
    setIsPausing(true);
    await handleSave();
    const result = await pauseAssessmentAction(assessment.id, applicationId);
    setIsPausing(false);
    if (result.success) router.refresh();
    else setSaveError(result.error);
  };

  // ── Family-type change: refresh non-overridden school-age children default ──
  const handleFamilyCategoryChange = (category: number) => {
    setFamilyTypeCategory(category);
    const nextMeta = getFamilyCategoryMeta(referenceBundle.familyCategoryMetas, category)?.schoolAgeChildren ?? 1;
    const merged = applyFamilyTypeDefaults(
      { schoolAgeChildrenCount },
      { schoolAgeChildrenCount: nextMeta },
      overridden
    );
    setSchoolAgeChildrenCount(merged.schoolAgeChildrenCount ?? nextMeta);
    scheduleAutoSave();
  };

  const markChildrenOverridden = (value: number) => {
    setSchoolAgeChildrenCount(value);
    setOverridden((prev) => new Set(prev).add("schoolAgeChildrenCount"));
  };

  // ── Property/debt field helpers ─────────────────────────────────────────────
  const setPropertyField = (slot: keyof PropertyAssetsRecord, key: "value" | "mortgageBalance", val: number) => {
    setPropertyAssets((prev) => ({ ...prev, [slot]: { ...prev[slot], [key]: val } }));
  };
  const setDebtField = (key: keyof DebtsRecord, val: number) => {
    setDebts((prev) => ({ ...prev, [key]: val }));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <AssessmentCalcStripV2 output={output} savingsCushion={savingsCushion} />

      {/* Status bar + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              assessment.status === "COMPLETED"
                ? "bg-success-50 text-success-600"
                : assessment.status === "PAUSED"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
            )}
          >
            {assessment.status === "COMPLETED"
              ? "Completed"
              : assessment.status === "PAUSED"
                ? "Paused"
                : assessment.status === "IN_PROGRESS"
                  ? "In progress"
                  : "Not started"}
          </span>
          <span className="rounded-full bg-primary-50 px-2 py-0.5 font-semibold text-primary-700">
            Engine v2
          </span>
          {lastSaved && <span>Saved {lastSaved.toLocaleTimeString("en-GB")}</span>}
          {saveError && (
            <span className="flex items-center gap-1 text-error-600" role="alert">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {saveError}
            </span>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isCompleting || isPausing}
            >
              <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isSaving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={handlePause}
              disabled={isSaving || isCompleting || isPausing}
            >
              <PauseCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isPausing ? "Pausing…" : "Pause"}
            </Button>
            <Button
              size="sm"
              className="bg-success-600 text-white hover:bg-success-600/90"
              onClick={handleComplete}
              disabled={isSaving || isCompleting || isPausing || annualFees <= 0}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isCompleting ? "Completing…" : "Complete"}
            </Button>
          </div>
        )}
      </div>

      {/* A. Family & fees */}
      <FormSection title="A. Family type & fees">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldRow label="Family type category" htmlFor="v2-family-type">
            <Select
              value={String(familyTypeCategory)}
              onValueChange={(v) => handleFamilyCategoryChange(Number(v))}
              disabled={isReadOnly}
            >
              <SelectTrigger id="v2-family-type" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {referenceBundle.familyCategoryMetas.map((m) => (
                  <SelectItem key={m.category} value={String(m.category)} className="text-sm">
                    {m.category} — {m.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Annual school fees (current year)" htmlFor="v2-annual-fees">
            <CurrencyInput
              id="v2-annual-fees"
              value={annualFees}
              disabled={isReadOnly}
              onChange={(v) => {
                setAnnualFees(v);
                scheduleAutoSave();
              }}
            />
          </FieldRow>
          <FieldRow label="Schooling years remaining" htmlFor="v2-schooling-years">
            <Input
              id="v2-schooling-years"
              type="number"
              min={0}
              value={schoolingYearsRemaining}
              disabled={isReadOnly}
              onChange={(e) => setSchoolingYearsRemaining(Math.max(0, Number(e.target.value) || 0))}
              onBlur={scheduleAutoSave}
              className="text-right font-mono"
            />
          </FieldRow>
          <FieldRow
            label="School-age children (savings-test divisor)"
            htmlFor="v2-school-age-children"
            hint={`Default for this family type: ${metaDefaultChildren}`}
          >
            <Input
              id="v2-school-age-children"
              type="number"
              min={1}
              value={schoolAgeChildrenCount}
              disabled={isReadOnly}
              onChange={(e) => markChildrenOverridden(Math.max(1, Number(e.target.value) || 1))}
              onBlur={scheduleAutoSave}
              className="text-right font-mono"
            />
          </FieldRow>
        </div>
      </FormSection>

      {/* B. Income */}
      <FormSection title="B. Income entry">
        <p className="text-xs text-slate-400">
          Pre-filled from the family&apos;s submitted income — review, confirm and adjust. The computed
          income feeds the household net income (C40).
        </p>
        <div className="rounded-lg border border-slate-100 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Parent 1</p>
          <EarnerFormV2
            label="Parent 1"
            value={parent1}
            readOnly={isReadOnly}
            onChange={(v) => {
              setParent1(v);
              scheduleAutoSave();
            }}
          />
        </div>
        {twoEarner && (
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Parent 2</p>
            <EarnerFormV2
              label="Parent 2"
              value={parent2}
              readOnly={isReadOnly}
              onChange={(v) => {
                setParent2(v);
                scheduleAutoSave();
              }}
            />
          </div>
        )}
      </FormSection>

      {/* C. Notional spend toggles */}
      <FormSection title="C. Notional spend">
        <p className="text-xs text-slate-400">
          Auto values are drawn from the reference tables for family type {familyTypeCategory}. Use the
          toggles to apply the workbook&apos;s conditional add-backs and to include car / public-transport
          spend.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs sm:grid-cols-3">
          <div>Rent: <span className="font-mono">{fmtMoney(notionalAuto("RENT"))}</span></div>
          <div>Council tax: <span className="font-mono">{fmtMoney(notionalAuto("COUNCIL_TAX"))}</span></div>
          <div>Essentials: <span className="font-mono">{fmtMoney(notionalAuto("ESSENTIALS"))}</span></div>
          <div>Car: <span className="font-mono">{fmtMoney(notionalAuto("CAR"))}</span></div>
          <div>Public transport: <span className="font-mono">{fmtMoney(notionalAuto("PUBLIC_TRANSPORT"))}</span></div>
          <div>JWF allowance: <span className="font-mono">{fmtMoney(notionalAuto("JWF_ALLOWANCE"))}</span></div>
          <div>Notional savings: <span className="font-mono">{fmtMoney(notionalAuto("NOTIONAL_SAVINGS"))}</span></div>
        </div>

        <FieldRow label="Rent add-back type" htmlFor="v2-rent-add-back">
          <Select
            value={rentAddBackType}
            onValueChange={(v) => {
              setRentAddBackType(v as RentAddBackType);
              scheduleAutoSave();
            }}
            disabled={isReadOnly}
          >
            <SelectTrigger id="v2-rent-add-back" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RENT_ADD_BACK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <label className="flex items-start gap-2">
          <Checkbox
            checked={multiPropertyRentAddBack}
            disabled={isReadOnly}
            onCheckedChange={(c) => {
              setMultiPropertyRentAddBack(c === true);
              scheduleAutoSave();
            }}
            className="mt-0.5"
          />
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-700">Multi-property rent add-back</span>
            <br />
            {MULTI_PROPERTY_HELPER}
          </span>
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={councilTaxSupport}
              disabled={isReadOnly}
              onCheckedChange={(c) => {
                setCouncilTaxSupport(c === true);
                scheduleAutoSave();
              }}
            />
            <span className="text-xs text-slate-600">Council-tax support (full add-back)</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={usesCar}
              disabled={isReadOnly}
              onCheckedChange={(c) => {
                setUsesCar(c === true);
                scheduleAutoSave();
              }}
            />
            <span className="text-xs text-slate-600">Uses a car (deduct notional car spend)</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={usesPublicTransport}
              disabled={isReadOnly}
              onCheckedChange={(c) => {
                setUsesPublicTransport(c === true);
                scheduleAutoSave();
              }}
            />
            <span className="text-xs text-slate-600">
              Uses public transport (deduct notional public-transport spend)
            </span>
          </label>
        </div>

        <FieldRow
          label="Fee insurance (annual)"
          htmlFor="v2-fee-insurance"
          hint="Yearly insured school-fee total — added back in full (C83)."
        >
          <CurrencyInput
            id="v2-fee-insurance"
            value={feeInsuranceAnnual}
            disabled={isReadOnly}
            onChange={(v) => {
              setFeeInsuranceAnnual(v);
              scheduleAutoSave();
            }}
          />
        </FieldRow>
      </FormSection>

      {/* D. Property, debt & savings */}
      <FormSection title="D. Property, debt & savings">
        <FieldRow label="Property portfolio type" htmlFor="v2-portfolio">
          <Select
            value={portfolioType}
            onValueChange={(v) => {
              setPortfolioType(v as PropertyPortfolioType);
              scheduleAutoSave();
            }}
            disabled={isReadOnly}
          >
            <SelectTrigger id="v2-portfolio" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PORTFOLIO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        {(["home", "second", "other"] as const).map((slot) => (
          <div key={slot} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldRow
              label={`${slot === "home" ? "Home" : slot === "second" ? "Second property" : "Other properties (aggregate)"} — value`}
              htmlFor={`v2-prop-${slot}-value`}
            >
              <CurrencyInput
                id={`v2-prop-${slot}-value`}
                value={propertyAssets[slot]?.value ?? 0}
                disabled={isReadOnly}
                onChange={(v) => {
                  setPropertyField(slot, "value", v);
                  scheduleAutoSave();
                }}
              />
            </FieldRow>
            <FieldRow label="Mortgage balance" htmlFor={`v2-prop-${slot}-mortgage`}>
              <CurrencyInput
                id={`v2-prop-${slot}-mortgage`}
                value={propertyAssets[slot]?.mortgageBalance ?? 0}
                disabled={isReadOnly}
                onChange={(v) => {
                  setPropertyField(slot, "mortgageBalance", v);
                  scheduleAutoSave();
                }}
              />
            </FieldRow>
          </div>
        ))}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow label="Credit cards + overdraft" htmlFor="v2-debt-credit">
            <CurrencyInput
              id="v2-debt-credit"
              value={debts.creditCards ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setDebtField("creditCards", v);
                scheduleAutoSave();
              }}
            />
          </FieldRow>
          <FieldRow label="Loans" htmlFor="v2-debt-loans">
            <CurrencyInput
              id="v2-debt-loans"
              value={debts.loans ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setDebtField("loans", v);
                scheduleAutoSave();
              }}
            />
          </FieldRow>
          <FieldRow label="Lease balances" htmlFor="v2-debt-lease">
            <CurrencyInput
              id="v2-debt-lease"
              value={debts.leaseBalances ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setDebtField("leaseBalances", v);
                scheduleAutoSave();
              }}
            />
          </FieldRow>
          <FieldRow label="School fees owed / other" htmlFor="v2-debt-fees">
            <CurrencyInput
              id="v2-debt-fees"
              value={debts.schoolFeesOwedOrOther ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setDebtField("schoolFeesOwedOrOther", v);
                scheduleAutoSave();
              }}
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow label="Cash savings" htmlFor="v2-cash">
            <CurrencyInput
              id="v2-cash"
              value={cashSavings}
              disabled={isReadOnly}
              onChange={(v) => {
                setCashSavings(v);
                scheduleAutoSave();
              }}
            />
          </FieldRow>
          <FieldRow label="ISAs / PEPs / shares" htmlFor="v2-isas">
            <CurrencyInput
              id="v2-isas"
              value={isasPepsShares}
              disabled={isReadOnly}
              onChange={(v) => {
                setIsasPepsShares(v);
                scheduleAutoSave();
              }}
            />
          </FieldRow>
        </div>

        <div className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-500">
          Savings test (display only): {fmtMoney(output?.savingsTestNumber)} · adjusted savings{" "}
          {fmtMoney(output?.adjustedSavings)} · savings-cushion allowance {fmtMoney(savingsCushion)}
        </div>

        <label className="flex items-center gap-2">
          <Checkbox
            checked={behindOnFees}
            disabled={isReadOnly}
            onCheckedChange={(c) => {
              setBehindOnFees(c === true);
              scheduleAutoSave();
            }}
          />
          <span className="text-xs text-slate-600">Family is behind on fees</span>
        </label>
      </FormSection>

      {/* E. Flags */}
      <FormSection title="E. Flags" defaultOpen={false}>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={dishonestyFlag}
            disabled={isReadOnly}
            onCheckedChange={(c) => {
              setDishonestyFlag(c === true);
              scheduleAutoSave();
            }}
          />
          <span className="text-xs text-slate-600">Dishonesty flag</span>
        </label>
        <p className="text-xs text-slate-400">
          Credit risk is derived from the debt module (see the profiling strip); it is no longer a manual
          flag for v2 assessments.
        </p>
      </FormSection>
    </div>
  );
}
