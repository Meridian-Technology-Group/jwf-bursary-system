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
import { Textarea } from "@/components/ui/textarea";
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
import type { AssessorIncomeRecord, PropertyAssetsRecord, DebtsRecord, SiblingDetail } from "@/types/assessment-v2";
import type { ReferenceBundle } from "@/lib/assessment/v2/types";
import type { PropertyPortfolioType } from "@/lib/assessment/v2/profiling";
import {
  propertyEquityTotals,
  netFinancialEquity,
  lifestyleSqueeze,
} from "@/lib/assessment/v2/profiling";
import type { AssessmentV2Input } from "@/lib/assessment/v2/orchestrator";
import { getNotionalCostAmount, getFamilyCategoryMeta } from "@/lib/assessment/reference-bands";
import { resolveChildNameParts } from "@/lib/applications/child-name";
import {
  calculateSchoolingYearsRemainingFromEntry,
  remainingYearsForEntrySchoolYear,
  type EntryYearGroupCode,
} from "@/lib/assessment/schooling-years";
import { calculateDerivedSavings } from "@/lib/assessment/stage2-assets";
import { applyFamilyTypeDefaults, type OverridableField } from "@/lib/assessment/auto-populate";
import { shouldEnableSecondEarner } from "@/lib/assessment/v2/prefill";
import {
  isManualAdjustmentApplied,
  validateManualAdjustment,
} from "@/lib/assessment/v2/manual-adjustment";
import {
  useAssessmentCalculationV2,
  runAssessmentV2,
} from "@/hooks/use-assessment-calculation-v2";
import { CurrencyInput } from "@/components/admin/earner-form-v2";
import { IncomeTableV2 } from "@/components/admin/income-table-v2";
import { AssessmentCalcStripV2 } from "@/components/admin/assessment-calc-strip-v2";
import { SeeComputationToggle } from "@/components/admin/see-computation-toggle";
import {
  saveAssessmentAction,
  completeAssessmentAction,
  pauseAssessmentAction,
} from "@/app/(admin)/applications/[id]/assessment/actions";
import type { AssessmentSaveInput } from "@/lib/db/queries/assessments";
import { reduceSaveError, canProceedAfterSave, type SaveOutcome } from "@/lib/assessment/v2/save-gate";
import { toast } from "@/hooks/use-toast";

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
  /** Epic 15 M1 — assessor-picked school + entry school year (CH-10..14). */
  assessmentSchool: "TRINITY" | "WHITGIFT" | null;
  entrySchoolYear: number | null;
  familyTypeCategory: number | null;
  annualFees: number | null;
  schoolingYearsRemaining: number | null;
  scholarshipPct: number | null;
  vatRate: number | null;
  rentAddBackType: RentAddBackType | null;
  /** CH-21/22 — manual £ overrides; null = engine-derived figure. */
  rentAddBackOverride: number | null;
  councilTaxOverride: number | null;
  multiPropertyRentAddBack: boolean | null;
  councilTaxSupport: boolean | null;
  usesCar: boolean | null;
  usesPublicTransport: boolean | null;
  feeInsuranceAnnual: number | null;
  behindOnFees: boolean | null;
  /**
   * Epic 13 / C2 — the SIGNED manual income-adjustment line and its mandatory
   * reason (`Assessment.manualAdjustment` / `manualAdjustmentReason`).
   */
  manualAdjustment: number | null;
  manualAdjustmentReason: string | null;
  dishonestyFlag: boolean;
  /** CALC-10 — "Assessor's wizard" forward-looking note for next year's assessor. */
  watchOutNotes: string | null;
  /** Epic 14 C4/C7 (CG-22) — the workbook's three sibling rows. */
  siblingDetails: SiblingDetail[] | null;
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
  /**
   * Epic 15 M1 (CH-11/14): fee-year-resolved current/next-year gross fees for
   * BOTH schools, so the assessor's school switch recalculates instantly.
   * The effective fee is `feesBySchool[assessmentSchool]` — no school picked,
   * no fee (and Complete stays gated).
   */
  feesBySchool: Record<
    "TRINITY" | "WHITGIFT",
    { annual: number | null; nextYear: number | null }
  >;
  applicationEntryYear: number | null;
  applicationEntryYearGroup: EntryYearGroupCode | null;
  /** Part 1 rows 1–2 — the recipient's name from the application (CG-22). */
  childName?: string | null;
  /** Split identity when the application carries it (Epic 15 G2 / CH-09);
   *  falls back to a whitespace split of `childName` on legacy rows. */
  childFirstName?: string | null;
  childLastName?: string | null;
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

// Part 4 property-structure selector — Charlotte's labels verbatim (CG-16).
const PORTFOLIO_OPTIONS: { value: PropertyPortfolioType; label: string }[] = [
  { value: "RENTING", label: "NO PROPERTY, RENTING" },
  { value: "SINGLE", label: "SINGLE PROPERTY - FAMILY HOME" },
  { value: "DOUBLE", label: "TWO PROPERTY PORTFOLIO" },
  { value: "MULTIPLE", label: "MULTIPLE PROPERTY PORTFOLIO" },
];

const MULTI_PROPERTY_HELPER =
  "Add back the notional rent again when ANY of: (1) an additional property is mortgage-free; " +
  "OR (2) an additional property generates rental income; OR (3) additional properties collectively " +
  "hold substantial equity. Assessor judgement.";

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(v);
}

/** Whole-percentage display for the lifestyle-squeeze rows (null → n/a). */
function pct(v: number | null | undefined): string {
  if (v == null) return "n/a";
  return `${v.toFixed(1)}%`;
}

// ─── Workbook-table primitives (Epic 14 C6) ───────────────────────────────────
// Plain label | control | AUTO-value rows mirroring Charlotte's sheets.

function WorkbookTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function WBRow({
  label,
  sublabel,
  note,
  auto,
  emphasis = false,
  children,
}: {
  /** Workbook row label, verbatim. */
  label: string;
  /** Second-column workbook label when the row carries both (condition + action). */
  sublabel?: string;
  note?: string;
  /** Computed (AUTO) display value. */
  auto?: string;
  /** Highlights the workbook's total/category rows. */
  emphasis?: boolean;
  /** Manual-fill control, when the row has one. */
  children?: React.ReactNode;
}) {
  return (
    <tr
      className={cn(
        "border-b border-slate-100 last:border-b-0",
        emphasis && "bg-primary-50/60"
      )}
    >
      <td className="w-[55%] px-3 py-2 align-top">
        <span
          className={cn(
            "block text-xs font-medium leading-snug",
            emphasis ? "font-semibold text-primary-900" : "text-slate-700"
          )}
        >
          {label}
        </span>
        {sublabel && (
          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {sublabel}
          </span>
        )}
        {note && (
          <span className="mt-0.5 block text-[11px] leading-tight text-slate-400">{note}</span>
        )}
      </td>
      <td className="w-[25%] px-3 py-2 align-top">{children}</td>
      <td
        className={cn(
          "w-[20%] px-3 py-2 text-right align-top font-mono text-sm",
          emphasis ? "font-bold text-primary-900" : "text-slate-700"
        )}
      >
        {auto ?? ""}
      </td>
    </tr>
  );
}

/** The workbook's MANUAL FILL YES/NO cells. */
function YesNo({
  checked,
  disabled,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => onChange(c === true)}
        aria-label={ariaLabel}
      />
      <span className="text-xs font-medium text-slate-600">{checked ? "YES" : "NO"}</span>
    </label>
  );
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
  feesBySchool,
  applicationEntryYear,
  applicationEntryYearGroup,
  childName = null,
  childFirstName = null,
  childLastName = null,
  siblingPayableFees = [],
  forceTwoEarner = false,
  secondaryParentOverride = false,
  readOnly: readOnlyProp = false,
}: AssessmentFormV2Props) {
  const router = useRouter();
  const isReadOnly = readOnlyProp || assessment.status === "COMPLETED";

  // Two-earner mode (review fix #1 — data-driven, never contributor-only):
  //  - LOCKED ON while a submitted secondary contributor exists with no
  //    proceed-without-second-parent override.
  //  - Otherwise ENABLED whenever the stored PARENT_2 record or the prefilled
  //    `parent2Income` (two-parent household submitted by a single primary)
  //    carries income data — a populated Parent 2 record is never silently
  //    discarded.
  //  - PLUS a manual assessor toggle (below, section B), mirroring v1's
  //    sole-parent-toggle philosophy — covering e.g. the override-but-still-
  //    two-earner case.
  const forcedTwoEarner = forceTwoEarner && !secondaryParentOverride;
  const storedParent2Detail =
    assessment.earners.find((e) => e.earnerLabel === "PARENT_2")?.incomeDetail ?? null;
  const [secondEarnerEnabled, setSecondEarnerEnabled] = React.useState<boolean>(() =>
    shouldEnableSecondEarner(forcedTwoEarner, storedParent2Detail, prefill.parent2Income)
  );
  const twoEarner = forcedTwoEarner || secondEarnerEnabled;

  // ── State: family / fees / schooling ────────────────────────────────────────
  const [familyTypeCategory, setFamilyTypeCategory] = React.useState<number>(
    assessment.familyTypeCategory ?? 1
  );
  // Epic 15 M1 (CH-11/14): the assessment's OWN school — empty until the
  // assessor picks (no prefill; pre-M1 rows arrive backfilled), switchable at
  // any time to recalculate for the other school.
  const [assessmentSchool, setAssessmentSchool] = React.useState<
    "TRINITY" | "WHITGIFT" | ""
  >(assessment.assessmentSchool ?? "");
  // The fees are DERIVED from the picked school (CG-22 row 11: autofilled +
  // HIDDEN — they feed the engine and the Complete gate, not the screen).
  // No school → no fee → Complete gated: that is the mandatory enforcement.
  const annualFees = assessmentSchool
    ? Number(feesBySchool[assessmentSchool]?.annual ?? 0) || 0
    : 0;
  const nextYearAnnualFees = assessmentSchool
    ? feesBySchool[assessmentSchool]?.nextYear ?? null
    : null;

  // Epic 15 M1 (CH-13): the recipient's scholarship %, manual 1–100 — the
  // same column the award tab's % SCHOLARSHIP reads/writes (CALC-16).
  const [scholarshipPct, setScholarshipPct] = React.useState<number | "">(
    assessment.scholarshipPct != null && Number(assessment.scholarshipPct) !== 0
      ? Number(assessment.scholarshipPct)
      : ""
  );

  // ── Part 1 (CG-22 / CH-10/12) ───────────────────────────────────────────────
  // Entry SCHOOL year (Year 6–13, not a calendar year) — empty until picked;
  // selection autofills the remaining-years row from Charlotte's matrix
  // (Y6→8 … Y13→1). The persisted engine input stays
  // `schoolingYearsRemaining` (still editable).
  const [entrySchoolYear, setEntrySchoolYear] = React.useState<number | "">(
    assessment.entrySchoolYear ?? ""
  );
  // The three "sibling at the school" rows — names here; the award tab adds
  // school + net payable fees (C7). Stored as `Assessment.siblingDetails`.
  const [siblingDetails, setSiblingDetails] = React.useState<SiblingDetail[]>(
    () => {
      const stored = Array.isArray(assessment.siblingDetails)
        ? assessment.siblingDetails
        : [];
      return [0, 1, 2].map((i) => stored[i] ?? {});
    }
  );
  const setSiblingName = (i: number, name: string) => {
    setSiblingDetails((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, name } : d))
    );
    scheduleAutoSave();
  };
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

  // ── State: manual income adjustment (Epic 13 / C2, D13-3) ───────────────────
  // ONE signed line on top of the aggregated earner income — not a per-field
  // override of any calculated cell. Its reason is mandatory while the amount
  // is non-zero (same rule server-side, `saveAssessmentAction`).
  const [manualAdjustment, setManualAdjustment] = React.useState<number>(
    Number(assessment.manualAdjustment ?? 0) || 0
  );
  const [manualAdjustmentReason, setManualAdjustmentReason] = React.useState<string>(
    assessment.manualAdjustmentReason ?? ""
  );
  const manualAdjustmentError = React.useMemo(() => {
    const result = validateManualAdjustment({
      amount: manualAdjustment,
      reason: manualAdjustmentReason,
    });
    return result.ok ? null : result.error;
  }, [manualAdjustment, manualAdjustmentReason]);

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
  // CH-21/22 — manual £ overrides. 0 = "no override" (the CurrencyInput's
  // empty state), matching the manual-adjustment idiom; persisted as null.
  const [rentAddBackOverride, setRentAddBackOverride] = React.useState<number>(
    Number(assessment.rentAddBackOverride ?? 0) || 0
  );
  const [councilTaxOverride, setCouncilTaxOverride] = React.useState<number>(
    Number(assessment.councilTaxOverride ?? 0) || 0
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
  // Portfolio type is persisted inside the property_assets JSONB (review fix
  // #3): stored-first so an assessor override survives reloads instead of
  // reverting to the parent-derived prefill.
  const [portfolioType, setPortfolioType] = React.useState<PropertyPortfolioType>(
    assessment.property?.propertyAssets?.portfolioType ?? prefill.portfolioType
  );
  const [cashSavings, setCashSavings] = React.useState<number>(
    Number(assessment.property?.cashSavings ?? prefill.cashSavings) || 0
  );
  const [isasPepsShares, setIsasPepsShares] = React.useState<number>(
    Number(assessment.property?.isasPepsShares ?? prefill.isasPepsShares) || 0
  );
  const [behindOnFees, setBehindOnFees] = React.useState<boolean>(assessment.behindOnFees ?? false);
  const [dishonestyFlag, setDishonestyFlag] = React.useState<boolean>(assessment.dishonestyFlag);

  // Epic 15 M1 (CH-15): NO default — the count is empty until the assessor
  // enters it (1–20). Stored values round-trip; the engine sees 0 while empty.
  const [schoolAgeChildrenCount, setSchoolAgeChildrenCount] = React.useState<
    number | ""
  >(assessment.property?.schoolAgeChildrenCount ?? "");

  // ── Live calculation input ──────────────────────────────────────────────────
  const input: AssessmentV2Input = React.useMemo(() => {
    const earners = twoEarner ? [parent1, parent2] : [parent1];
    return {
      earners,
      manualAdjustment,
      familyTypeCategory,
      rentAddBackType,
      rentAddBackOverride: rentAddBackOverride > 0 ? rentAddBackOverride : null,
      multiPropertyRentAddBack,
      councilTaxSupport,
      councilTaxOverride: councilTaxOverride > 0 ? councilTaxOverride : null,
      usesCar,
      usesPublicTransport,
      feeInsuranceAnnual,
      cashSavings,
      isasPepsShares,
      schoolAgeChildrenCount:
        typeof schoolAgeChildrenCount === "number" ? schoolAgeChildrenCount : 0,
      schoolingYearsRemaining,
      propertyAssets,
      portfolioType,
      debts,
      siblingPayableFees,
      annualFees,
      scholarshipPct: typeof scholarshipPct === "number" ? scholarshipPct : 0,
      vatRate: Number(assessment.vatRate ?? 20) || 20,
    };
  }, [
    twoEarner,
    parent1,
    parent2,
    manualAdjustment,
    familyTypeCategory,
    rentAddBackType,
    rentAddBackOverride,
    multiPropertyRentAddBack,
    councilTaxSupport,
    councilTaxOverride,
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
    scholarshipPct,
    assessment.vatRate,
  ]);

  const output = useAssessmentCalculationV2(input, referenceBundle);

  // ── Epic 14 C6 — derived display values for the Parts 3–5 tables ───────────
  // All computed by the UNCHANGED engine helpers; zero new maths (D14-4).
  const lineAmt = (key: string): number | null =>
    output?.notionalSpendLines.find((l) => l.key === key)?.amount ?? null;
  // Epic 15 M4 (CH-24): the workbook's ± column — DEDUCT lines display as
  // negative totals, ADD BACK lines as explicit positives. Pure display of
  // the engine's existing `signedAmount`; totals unchanged.
  const lineSigned = (key: string): string => {
    const line = output?.notionalSpendLines.find((l) => l.key === key);
    if (!line) return "—";
    if (line.direction === "ADD_BACK" && line.amount > 0) {
      return `+${fmtMoney(line.amount)}`;
    }
    return fmtMoney(line.signedAmount);
  };
  const equityTotals = propertyEquityTotals(propertyAssets);
  const financialEquity = netFinancialEquity(cashSavings + isasPepsShares, debts);
  const squeeze = output
    ? lifestyleSqueeze(
        {
          ndiAfterNotionalSpend: output.ndiAfterNotionalSpend,
          householdNetIncome: output.householdNetIncome,
          yearlyDebtExposure: output.yearlyDebtExposure,
          feesBenchmarkPct: output.feesBenchmarkPct ?? 0,
        },
        referenceBundle.lifestyleSqueezeBands
      )
    : null;

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

  // CALC-15 — returns whether the save round-trip SUCCEEDED so callers
  // (Complete/Pause, below) can gate the status flip on it instead of firing
  // it and forgetting the result. The "last save failed" banner (`saveError`)
  // is driven by the same outcome via `reduceSaveError`, which only ever
  // CLEARS it on success — it is never optimistically cleared beforehand, so
  // it stays visible across the "Saving…" window of a retry until a save
  // actually succeeds.
  const handleSave = React.useCallback(async (): Promise<boolean> => {
    if (isReadOnly) return true;

    // A manual/explicit save supersedes any pending debounced autosave — a
    // stale timer firing after this save must never overwrite it.
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    // Epic 13 / C2 — refuse locally before the round-trip so the assessor gets
    // the message inline instead of a failed save. The server enforces the
    // same rule regardless (`saveAssessmentAction`); this is the courtesy.
    if (manualAdjustmentError) {
      setSaveError(manualAdjustmentError);
      toast({
        variant: "destructive",
        title: "Manual adjustment needs a reason",
        description: manualAdjustmentError,
      });
      return false;
    }

    setIsSaving(true);

    const derivedSavings = calculateDerivedSavings(
      cashSavings,
      isasPepsShares,
      typeof schoolAgeChildrenCount === "number" ? schoolAgeChildrenCount : 0,
      schoolingYearsRemaining
    );

    // Review fix #4: recompute SYNCHRONOUSLY from the current input at save
    // time instead of reading the debounced hook output — Complete/Pause
    // clicked inside the 150 ms debounce window must persist the calc for the
    // data on screen, never a pre-edit stale one.
    const freshOutput = runAssessmentV2(input, referenceBundle);

    // Snapshot the orchestrator output 1:1 onto the v2 columns (only when it
    // computed — leave nulls otherwise so a half-entered row isn't misleading).
    const snapshot: Partial<AssessmentSaveInput> = freshOutput
      ? {
          totalHouseholdNetIncome: freshOutput.householdNetIncome,
          notionalEssentials: freshOutput.notionalEssentials,
          notionalCar: freshOutput.notionalCar,
          notionalPublicTransport: freshOutput.notionalPublicTransport,
          notionalJwfAllowance: freshOutput.notionalJwfAllowance,
          notionalSavingsBenchmark: freshOutput.notionalSavingsBenchmark,
          savingsTestNumber: freshOutput.savingsTestNumber,
          totalNotionalSpend: freshOutput.totalNotionalSpend,
          ndiAfterNotionalSpend: freshOutput.ndiAfterNotionalSpend,
          derivedYearlyDebtRepayments: freshOutput.derivedYearlyDebtRepayments,
          yearlyDebtExposure: freshOutput.yearlyDebtExposure,
          debtOverNdiRatio: freshOutput.debtOverNdiRatio,
          debtStatusLabel: freshOutput.debtStatusLabel,
          incomeCategory: freshOutput.incomeCategory,
          propertyCategoryDerived: freshOutput.propertyCategoryDerived,
          propertyEquityCategory: freshOutput.propertyEquityCategory,
          financialEquityLabel: freshOutput.financialEquityLabel,
          lifestyleSqueezeRatio: freshOutput.lifestyleSqueezeRatio,
          lifestyleSqueezeLabel: freshOutput.lifestyleSqueezeLabel,
          actualRemainingDi: freshOutput.actualRemainingDi,
          theoreticalBenchmarkDi: freshOutput.theoreticalBenchmarkDi,
          affordabilityAdjustedDi: freshOutput.affordabilityAdjustedDi,
          recommendedPayableFees: freshOutput.recommendedPayableFees,
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
      // CALC-08: snapshot the fee-year-resolved next-year gross fee (for the
      // PICKED school) so the recommendation's award summary uses the real
      // next-year figure; explicit null is a valid clear when none exists.
      nextYearAnnualFees,
      // Epic 15 M1 — the assessor-owned Part 1 fields (CH-10..14).
      assessmentSchool: assessmentSchool || null,
      entrySchoolYear: typeof entrySchoolYear === "number" ? entrySchoolYear : null,
      scholarshipPct: typeof scholarshipPct === "number" ? scholarshipPct : 0,
      schoolingYearsRemaining,
      rentAddBackType,
      // CH-21/22 — persisted as null when unset so stored rows read as "no
      // override" (an explicit null is a valid clear in the save whitelist).
      rentAddBackOverride: rentAddBackOverride > 0 ? rentAddBackOverride : null,
      multiPropertyRentAddBack,
      councilTaxSupport,
      councilTaxOverride: councilTaxOverride > 0 ? councilTaxOverride : null,
      usesCar,
      usesPublicTransport,
      feeInsuranceAnnual,
      behindOnFees,
      // Epic 13 / C2 — the adjustment line. The reason is cleared alongside a
      // zeroed amount so a stale explanation can never outlive the figure it
      // explained.
      manualAdjustment,
      manualAdjustmentReason: isManualAdjustmentApplied(manualAdjustment)
        ? manualAdjustmentReason.trim()
        : null,
      dishonestyFlag,
      // Epic 14 C4/C7 (CG-22) — the three sibling rows (names now; the award
      // tab adds school + fees). Persist null when every row is blank.
      siblingDetails: siblingDetails.some(
        (d) => (d.name ?? "").trim() || d.school || d.netPayableFees != null
      )
        ? siblingDetails
        : null,
      ...snapshot,
      earnersV2,
      propertyV2: {
        // Review fix #3: the assessor's portfolio-type selection is persisted
        // inside the property_assets JSONB so it survives reloads.
        propertyAssets: { ...propertyAssets, portfolioType },
        debts,
        cashSavings,
        isasPepsShares,
        schoolAgeChildrenCount:
          typeof schoolAgeChildrenCount === "number" ? schoolAgeChildrenCount : 0,
        derivedSavingsAnnualTotal: derivedSavings,
      },
    };

    const result = await saveAssessmentAction(assessment.id, applicationId, payload);
    setIsSaving(false);

    const outcome: SaveOutcome = result.success
      ? { success: true }
      : { success: false, error: result.error };
    setSaveError(reduceSaveError(outcome));

    if (outcome.success) {
      setLastSaved(new Date());
    } else {
      // CALC-15 — surface the failure visibly: a stale/broken save must never
      // pass silently. Toast is transient; the inline banner (rendered from
      // `saveError`, above) persists until the next successful save.
      toast({
        variant: "destructive",
        title: "Save failed",
        description: `${outcome.error} Your changes were NOT saved.`,
      });
    }
    return canProceedAfterSave(outcome);
  }, [
    isReadOnly,
    input,
    referenceBundle,
    assessment.id,
    applicationId,
    twoEarner,
    parent1,
    parent2,
    familyTypeCategory,
    annualFees,
    nextYearAnnualFees,
    schoolingYearsRemaining,
    rentAddBackType,
    rentAddBackOverride,
    multiPropertyRentAddBack,
    councilTaxSupport,
    councilTaxOverride,
    usesCar,
    usesPublicTransport,
    feeInsuranceAnnual,
    behindOnFees,
    manualAdjustment,
    manualAdjustmentReason,
    manualAdjustmentError,
    dishonestyFlag,
    siblingDetails,
    propertyAssets,
    portfolioType,
    debts,
    cashSavings,
    isasPepsShares,
    schoolAgeChildrenCount,
  ]);

  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Epic 14 C4 fix — the debounced timer used to close over the handleSave
  // memoised at SCHEDULE time, i.e. one render behind the setState that
  // triggered it: the autosave fired with state missing the very change it
  // was scheduled for, and a pending stale timer could even fire AFTER a
  // manual Save and overwrite it (observed losing a just-typed value). The
  // ref always points at the latest closure, so the timer saves what is on
  // screen when it fires.
  const handleSaveRef = React.useRef(handleSave);
  handleSaveRef.current = handleSave;
  const scheduleAutoSave = React.useCallback(() => {
    if (isReadOnly) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSaveRef.current();
    }, 400);
  }, [isReadOnly]);

  const handleComplete = async () => {
    setIsCompleting(true);
    // Review fix #4: cancel any pending debounced auto-save, then persist a
    // synchronously recomputed snapshot (handleSave recomputes from `input`)
    // so the completed row provably matches the data on screen.
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    // CALC-15 — save-gated: Complete must NEVER fire when the save it depends
    // on failed (that is exactly how a stale-client save failure previously
    // produced a COMPLETED assessment with a null v2 snapshot). handleSave
    // has already surfaced the failure (toast + persistent banner); bail out
    // here without touching status.
    const saved = await handleSave();
    if (!saved) {
      setIsCompleting(false);
      return;
    }
    const result = await completeAssessmentAction(assessment.id, applicationId);
    setIsCompleting(false);
    if (result.success) {
      router.refresh();
    } else {
      setSaveError(result.error);
      toast({ variant: "destructive", title: "Complete failed", description: result.error });
    }
  };

  const handlePause = async () => {
    setIsPausing(true);
    // Review fix #4 — same flush-before-persist as Complete.
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    // CALC-15 — same save-gating as Complete: never pause over a failed save.
    const saved = await handleSave();
    if (!saved) {
      setIsPausing(false);
      return;
    }
    const result = await pauseAssessmentAction(assessment.id, applicationId);
    setIsPausing(false);
    if (result.success) {
      router.refresh();
    } else {
      setSaveError(result.error);
      toast({ variant: "destructive", title: "Pause failed", description: result.error });
    }
  };

  // ── Family-type change: refresh non-overridden school-age children default ──
  // Epic 15 M1 (CH-15): a family-category change no longer reseeds the
  // children count from the meta default — the count is assessor-entered only.
  const handleFamilyCategoryChange = (category: number) => {
    setFamilyTypeCategory(category);
    scheduleAutoSave();
  };

  const markChildrenOverridden = (value: number | "") => {
    setSchoolAgeChildrenCount(value);
  };

  // ── Property/debt field helpers ─────────────────────────────────────────────
  const setPropertyField = (
    slot: "home" | "second" | "other",
    key: "value" | "mortgageBalance",
    val: number
  ) => {
    setPropertyAssets((prev) => ({ ...prev, [slot]: { ...prev[slot], [key]: val } }));
  };
  const setDebtField = (key: keyof DebtsRecord, val: number) => {
    setDebts((prev) => ({ ...prev, [key]: val }));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Epic 14 C2 (CG-21): the actions banner leads, level with the tab
          titles; the live computation sits BEHIND the SEE COMPUTATION
          disclosure below it (collapsed by default, preference persisted). */}

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
            // CALC-15 — persistent until a save succeeds (see `reduceSaveError`);
            // never silently cleared by a subsequent in-flight save attempt.
            <span className="flex items-center gap-1 font-medium text-error-600" role="alert">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Last save failed — data NOT saved. {saveError}
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
              disabled={
                isSaving ||
                isCompleting ||
                isPausing ||
                !assessmentSchool ||
                typeof entrySchoolYear !== "number" ||
                annualFees <= 0
              }
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isCompleting ? "Completing…" : "Complete"}
            </Button>
          </div>
        )}
      </div>

      {/* CG-21 — live calculation behind SEE COMPUTATION (collapsed default). */}
      <SeeComputationToggle>
        <AssessmentCalcStripV2 output={output} savingsCushion={savingsCushion} />
      </SeeComputationToggle>

      {/* PART 1 (CG-22, Epic 14 C4) — the workbook's 11-row table, labels
          verbatim. Autofill = names / year of entry (LA-5, editable) /
          remaining-years derivation / annual fees (reference data, HIDDEN —
          feeds the engine, not displayed). Everything else assessor-entered. */}
      <FormSection title="PART 1 - BURSARY RECIPIENT'S & FAMILY DETAILS">
        {(() => {
          const { firstName, lastName: surname } = resolveChildNameParts({
            childName,
            childFirstName,
            childLastName,
          });
          const rowClass = "grid grid-cols-1 items-center gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:grid-cols-[minmax(260px,1fr)_minmax(200px,1fr)]";
          const labelClass = "text-xs font-medium text-slate-500";
          return (
            <div>
              <div className={rowClass}>
                <span className={labelClass}>Bursary recipient&apos;s First name</span>
                <span className="text-sm text-slate-700">{firstName || "—"}</span>
              </div>
              <div className={rowClass}>
                <span className={labelClass}>Bursary recipient&apos;s Surname</span>
                <span className="text-sm text-slate-700">{surname || "—"}</span>
              </div>
              {/* CH-11/14 — the assessment's school: manual dropdown, no
                  prefill, switchable mid-assessment (Trinity → Whitgift
                  recalculation). Drives the hidden annual-fees autofill. */}
              <div className={rowClass}>
                <label className={labelClass} htmlFor="v2-assessment-school">
                  Bursary recipient&apos;s school
                </label>
                <Select
                  value={assessmentSchool}
                  onValueChange={(v) => {
                    setAssessmentSchool(v as "TRINITY" | "WHITGIFT");
                    scheduleAutoSave();
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger id="v2-assessment-school" className="h-9 text-sm">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRINITY" className="text-sm">
                      Trinity School
                    </SelectItem>
                    <SelectItem value="WHITGIFT" className="text-sm">
                      Whitgift School
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* CH-10/12 — entry SCHOOL year (Year 6–13, never a calendar
                  year); selection autofills remaining-years from the matrix
                  (Y6→8 … Y13→1), which stays editable below. */}
              <div className={rowClass}>
                <label className={labelClass} htmlFor="v2-entry-school-year">
                  Bursary award year of entry:
                </label>
                <Select
                  value={entrySchoolYear === "" ? "" : String(entrySchoolYear)}
                  onValueChange={(v) => {
                    const year = Number(v);
                    setEntrySchoolYear(year);
                    const derived = remainingYearsForEntrySchoolYear(year);
                    if (derived != null) setSchoolingYearsRemaining(derived);
                    scheduleAutoSave();
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger id="v2-entry-school-year" className="h-9 text-sm">
                    <SelectValue placeholder="Select year of entry" />
                  </SelectTrigger>
                  <SelectContent>
                    {[6, 7, 8, 9, 10, 11, 12, 13].map((y) => (
                      <SelectItem key={y} value={String(y)} className="text-sm">
                        Year {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* CH-13 — scholarship %: manual 1–100, key at the start of a
                  rolling-over assessment; same column the award tab edits. */}
              <div className={rowClass}>
                <label className={labelClass} htmlFor="v2-scholarship-pct">
                  Bursary recipient&apos;s Scholarship
                </label>
                <div className="relative w-32">
                  <Input
                    id="v2-scholarship-pct"
                    type="number"
                    min={0}
                    max={100}
                    value={scholarshipPct}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setScholarshipPct("");
                        return;
                      }
                      const n = Number(raw);
                      if (isNaN(n)) return;
                      setScholarshipPct(Math.min(100, Math.max(0, n)));
                    }}
                    onBlur={scheduleAutoSave}
                    className="w-32 pr-7 text-right font-mono"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    %
                  </span>
                </div>
              </div>
              {[0, 1, 2].map((i) => (
                <div className={rowClass} key={i}>
                  <label className={labelClass} htmlFor={`v2-sibling-${i + 1}`}>
                    Bursary recipient&apos;s sibling {i + 1} at the school
                  </label>
                  <Input
                    id={`v2-sibling-${i + 1}`}
                    value={siblingDetails[i]?.name ?? ""}
                    disabled={isReadOnly}
                    onChange={(e) => setSiblingName(i, e.target.value)}
                    onBlur={scheduleAutoSave}
                    placeholder="—"
                    className="text-sm"
                  />
                </div>
              ))}
              <div className={rowClass}>
                <label className={labelClass} htmlFor="v2-family-type">
                  Family category
                </label>
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
              </div>
              <div className={rowClass}>
                <label className={labelClass} htmlFor="v2-schooling-years">
                  Remaining years at the school
                </label>
                <Input
                  id="v2-schooling-years"
                  type="number"
                  min={0}
                  value={schoolingYearsRemaining}
                  disabled={isReadOnly}
                  onChange={(e) => setSchoolingYearsRemaining(Math.max(0, Number(e.target.value) || 0))}
                  onBlur={scheduleAutoSave}
                  className="w-32 text-right font-mono"
                />
              </div>
              <div className={rowClass}>
                <label className={labelClass} htmlFor="v2-school-age-children">
                  Number of schooling age children
                </label>
                <Input
                  id="v2-school-age-children"
                  type="number"
                  min={1}
                  max={20}
                  value={schoolAgeChildrenCount}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      markChildrenOverridden("");
                      return;
                    }
                    const n = Number(raw);
                    if (isNaN(n)) return;
                    markChildrenOverridden(Math.min(20, Math.max(1, Math.round(n))));
                  }}
                  onBlur={scheduleAutoSave}
                  className="w-32 text-right font-mono"
                />
              </div>
              {/* Row 11 — Annual school fees: autofill + HIDDEN (feeds the
                  engine only). Surfaced ONLY when the reference figure is
                  missing, because Complete is gated on it. */}
              {annualFees <= 0 && (
                <div className={rowClass}>
                  <span className={labelClass}>Annual school fees</span>
                  <span className="text-xs font-medium text-amber-700">
                    {assessmentSchool
                      ? "Missing from reference data — Complete is disabled until the school-fees reference row exists for this school and year."
                      : "Select the recipient's school — the annual fee fills from reference data and Complete stays disabled until then."}
                  </span>
                </div>
              )}
            </div>
          );
        })()}
      </FormSection>

      {/* PART 2 (CG-20, Epic 14 C5) — one Excel-style table, workbook rows
          verbatim, Parent 1 · Parent 2 as two value columns, closing in the
          AUTO household total. No commentary copy. */}
      <FormSection title="PART 2 - HOUSEHOLD INCOME">
        {/* Second-earner toggle (review fix #1) — assessor-controlled unless a
            submitted secondary contributor locks two-earner mode ON. */}
        <label className="flex items-center gap-2">
          <Checkbox
            checked={twoEarner}
            disabled={isReadOnly || forcedTwoEarner}
            onCheckedChange={(c) => {
              setSecondEarnerEnabled(c === true);
              scheduleAutoSave();
            }}
            aria-label="Include a second earner (Parent 2)"
          />
          <span className="text-xs text-slate-600">
            Include a second earner (Parent 2)
            {forcedTwoEarner && (
              <span className="text-slate-400"> — locked: the second parent has submitted</span>
            )}
          </span>
        </label>

        <IncomeTableV2
          parent1={parent1}
          parent2={parent2}
          twoEarner={twoEarner}
          manualAdjustment={manualAdjustment}
          readOnly={isReadOnly}
          onChangeParent1={(v) => {
            setParent1(v);
            scheduleAutoSave();
          }}
          onChangeParent2={(v) => {
            setParent2(v);
            scheduleAutoSave();
          }}
          onCellBlur={scheduleAutoSave}
        />

        {/* Epic 15 M3 (CH-20, LA15-6): the MANUAL INCOME ADJUSTMENT entry
            block is REMOVED at client request — the divorced-parents capture
            already covers the second parent's income. The engine input
            remains: a previously-saved adjustment still flows into the
            computation and shows as the amber line in the table above. */}
      </FormSection>

      {/* PART 3 (CG-16/CG-21, Epic 14 C6) — notional spend benchmarking as
          a plain workbook table: labels verbatim ("STUCTURE" included), AUTO
          cells from the engine's notional-spend lines, manual cells editable. */}
      <FormSection title="PART 3 - NOTIONAL SPEND BENCHMARKING">
        <WorkbookTable>
          <WBRow label="SELECT FAMILY STUCTURE" note="Autofilled from the Part 1 family-category selection.">
            <span className="text-xs text-slate-700">
              {referenceBundle.familyCategoryMetas.find((m) => m.category === familyTypeCategory)?.description ?? "—"}
            </span>
          </WBRow>
          <WBRow label="FAMILY CATEGORY" auto={String(familyTypeCategory)} />
          <WBRow label="DEDUCT NOTIONAL RENT" auto={lineSigned("rent")} />
          <WBRow
            label="IF THE FAMILY HOME IS MORTGAGE FREE/ or LIVING RENT FREE, ADD FULL NOTIONAL BACK IN - or if FAMILY HAS A LOWER RENT, ADD 25% BACK IN OF THE NOTIONAL RENT"
            sublabel="ADD BACK IN NOTIONAL RENT APPLIED"
            auto={lineSigned("rentAddBack")}
            note={
              rentAddBackOverride > 0
                ? "Manual override applied — clear the £ field to return to the dropdown value."
                : undefined
            }
          >
            {/* CH-21 — the dropdown stays; a filled £ field overrides its derived value. */}
            <div className="space-y-1.5">
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
              <CurrencyInput
                id="v2-rent-add-back-override"
                value={rentAddBackOverride}
                disabled={isReadOnly}
                ariaLabel="Rent add-back manual £ override"
                onChange={(v) => {
                  setRentAddBackOverride(v);
                  scheduleAutoSave();
                }}
              />
              <span className="block text-[11px] leading-tight text-slate-400">
                Manual £ override — leave empty to use the dropdown value.
              </span>
            </div>
          </WBRow>
          <WBRow
            label="IF HOUSEHOLD OWNS AT LEAST TWO PROPERTIES AND EITHER 1- PROPERTY INCOME IS NOT MAIN INCOME OR 2- EVIDENCE OF STABLE (PAYE OVER S-E) MEDIUM TO HIGH OR HIGH INCOME 3- CASH DRAWDOWN NOT SOLELY TO DEBT CONSOLIDATE"
            sublabel="ADD BACK NOTIONAL RENT"
            auto={lineSigned("multiPropertyRentAddBack")}
            note={MULTI_PROPERTY_HELPER}
          >
            <YesNo
              checked={multiPropertyRentAddBack}
              disabled={isReadOnly}
              ariaLabel="Multi-property rent add-back"
              onChange={(c) => {
                setMultiPropertyRentAddBack(c);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow
            label="DEDUCT ANNUAL COUNCIL TAX"
            auto={lineSigned("councilTax")}
            note={
              councilTaxOverride > 0
                ? "Manual figure applied — clear the £ field to return to the notional default."
                : undefined
            }
          >
            {/* CH-22 — manual, fully editable £ figure; "Apply default" fills
                it with the reference notional (still editable afterwards).
                Empty = the notional default applies, exactly as before. */}
            <div className="space-y-1.5">
              <CurrencyInput
                id="v2-council-tax-override"
                value={councilTaxOverride}
                disabled={isReadOnly}
                ariaLabel="Annual council tax manual £ figure"
                onChange={(v) => {
                  setCouncilTaxOverride(v);
                  scheduleAutoSave();
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={isReadOnly}
                onClick={() => {
                  setCouncilTaxOverride(notionalAuto("COUNCIL_TAX") ?? 0);
                  scheduleAutoSave();
                }}
              >
                Apply default
              </Button>
              <span className="block text-[11px] leading-tight text-slate-400">
                Manual £ figure — leave empty to use the notional default.
              </span>
            </div>
          </WBRow>
          <WBRow
            label="IF HOUSEHOLD RECEIVES FULL COUNCIL TAX SUPPORT"
            sublabel="ADD BACK IN COUNCIL TAX NOTIONAL"
            auto={lineSigned("councilTaxAddBack")}
          >
            <YesNo
              checked={councilTaxSupport}
              disabled={isReadOnly}
              ariaLabel="Council tax support add-back"
              onChange={(c) => {
                setCouncilTaxSupport(c);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DEDUCT NOTIONAL ESSENTIALS" auto={lineSigned("essentials")} />
          <WBRow label="DOES THE FAMILY USE A CAR?">
            <YesNo
              checked={usesCar}
              disabled={isReadOnly}
              ariaLabel="Does the family use a car?"
              onChange={(c) => {
                setUsesCar(c);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="IF YES, DEDUCT NOTIONAL CAR SPEND" auto={lineSigned("car")} />
          <WBRow label="DOES THE FAMILY USE PUBLIC TRANSPORT?">
            <YesNo
              checked={usesPublicTransport}
              disabled={isReadOnly}
              ariaLabel="Does the family use public transport?"
              onChange={(c) => {
                setUsesPublicTransport(c);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="IF YES, DEDUCT NOTIONAL PUBLIC TRANSPORT SPEND" auto={lineSigned("publicTransport")} />
          <WBRow label="DEDUCT NOTIONAL JWF BURSARY RECIPIENT ALLOWANCE" auto={lineSigned("jwfAllowance")} />
          <WBRow label="DISPLAY ONLY - ENTER TOTAL CASH HELD">
            <CurrencyInput
              id="v2-cash"
              value={cashSavings}
              disabled={isReadOnly}
              onChange={(v) => {
                setCashSavings(v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - ENTER TOTAL SAVINGS">
            <CurrencyInput
              id="v2-isas"
              value={isasPepsShares}
              disabled={isReadOnly}
              onChange={(v) => {
                setIsasPepsShares(v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - TOTAL CASH & SAVINGS" auto={fmtMoney(cashSavings + isasPepsShares)} />
          <WBRow label="TOTAL NUMBER OF CHILDREN OF SCHOOL AGE" auto={schoolAgeChildrenCount === "" ? "—" : String(schoolAgeChildrenCount)} note="From the Part 1 entry." />
          <WBRow label="NUMBER OF SCHOOL YEARS LEFT FOR THE BURSARY RECIPIENT" auto={String(schoolingYearsRemaining)} note="From the Part 1 entry." />
          <WBRow label="DISPLAY ONLY - ADJUSTED SAVINGS TOTAL" auto={fmtMoney(output?.adjustedSavings)} />
          <WBRow label="DEDUCT NOTIONAL SAVINGS" auto={lineSigned("notionalSavingsBenchmark")} />
          <WBRow
            label="DISPLAY ONLY - SAVINGS CUSHION ALLOWANCE"
            auto={fmtMoney(savingsCushion)}
            note="Reference value only — feeds no calculation."
          />
          <WBRow label="DISPLAY ONLY - SAVINGS TEST NUMBER" auto={fmtMoney(output?.savingsTestNumber)} />
          <WBRow label="IF SAVINGS TEST NUMBER IS POSITIVE, ADD IT IN" auto={lineSigned("savingsTestAddBack")} />
          <WBRow label="IF THE APPLICANT HAS INSURED SCHOOL FEES PAYMENT, ADD YEARLY INSURED TOTAL BACK IN">
            <CurrencyInput
              id="v2-fee-insurance"
              value={feeInsuranceAnnual}
              disabled={isReadOnly}
              onChange={(v) => {
                setFeeInsuranceAnnual(v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="TOTAL DEDUCTED NOTIONAL SPEND" auto={fmtMoney(output?.totalNotionalSpend)} emphasis />
          <WBRow label="HOUSEHOLD'S NET DISPOSABLE INCOME AFTER NOTIONAL SPEND" auto={fmtMoney(output?.ndiAfterNotionalSpend)} emphasis />
          <WBRow label="HOUSEHOLD'S INCOME CATEGORY IS:" auto={output?.incomeCategory != null ? String(output.incomeCategory) : "—"} emphasis />
        </WorkbookTable>
      </FormSection>

      {/* PART 4 (CG-16, Epic 14 C6) — assets categories, workbook rows verbatim. */}
      <FormSection title="PART 4 - HOUSEHOLD'S ASSETS CATEGORIES">
        <WorkbookTable>
          <WBRow label="Property asset structure">
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
          </WBRow>
          <WBRow label="DISPLAY ONLY - TOTAL FAMILY HOME MARKET VALUE">
            <CurrencyInput
              id="v2-prop-home-value"
              value={propertyAssets.home?.value ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setPropertyField("home", "value", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - TOTAL FAMILY HOME MORTGAGE BALANCE">
            <CurrencyInput
              id="v2-prop-home-mortgage"
              value={propertyAssets.home?.mortgageBalance ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setPropertyField("home", "mortgageBalance", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - TOTAL SECOND PROPERTY MARKET VALUE">
            <CurrencyInput
              id="v2-prop-second-value"
              value={propertyAssets.second?.value ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setPropertyField("second", "value", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - TOTAL SECOND PROPERTY MORTGAGE BALANCE">
            <CurrencyInput
              id="v2-prop-second-mortgage"
              value={propertyAssets.second?.mortgageBalance ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setPropertyField("second", "mortgageBalance", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - TOTAL OTHER PROPERTY (IES) MARKET VALUE">
            <CurrencyInput
              id="v2-prop-other-value"
              value={propertyAssets.other?.value ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setPropertyField("other", "value", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - TOTAL OTHER PROPERTY (IES) MORTGAGE BALANCE">
            <CurrencyInput
              id="v2-prop-other-mortgage"
              value={propertyAssets.other?.mortgageBalance ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setPropertyField("other", "mortgageBalance", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - HOUSEHOLD'S TOTAL PROPERTY VALUE" auto={fmtMoney(equityTotals.totalValue)} />
          <WBRow label="DISPLAY ONLY - HOUSEHOLD'S EQUITY ON FAMILY HOME" auto={fmtMoney(equityTotals.homeEquity)} />
          <WBRow label="DISPLAY ONLY - HOUSEHOLD'S EQUITY ON SECOND PROPERTY" auto={fmtMoney(equityTotals.secondEquity)} />
          <WBRow label="DISPLAY ONLY - HOUSEHOLD'S EQUITY ON OTHER PROPERTIES" auto={fmtMoney(equityTotals.otherEquity)} />
          <WBRow label="HOUSEHOLD'S PROPERTY CATEGORY IS:" auto={output ? String(output.propertyCategoryDerived) : "—"} emphasis />
          <WBRow label="HOUSEHOLD'S TOTAL EQUITY HELD ON PROPERTY ASSETS" auto={fmtMoney(equityTotals.totalEquity)} />
          <WBRow label="HOUSEHOLD'S PROPERTY EQUITY CATEGORY IS:" auto={output?.propertyEquityCategory != null ? String(output.propertyEquityCategory) : "—"} emphasis />
          <WBRow label="HOUSEHOLD'S TOTAL EQUITY HELD ON FINANCIAL ASSETS" auto={fmtMoney(financialEquity)} />
          <WBRow label="HOUSEHOLD'S FINANCIAL EQUITY CATEGORY IS:" auto={output?.financialEquityLabel ?? "—"} emphasis />
        </WorkbookTable>
      </FormSection>

      {/* "PART 5" personal debt + lifestyle squeeze — lives on the MODEL tab
          per LA-6 (the award sheet is the other "PART 5"). Rows verbatim. */}
      <FormSection title="PART 5 - HOUSEHOLD'S PERSONAL DEBT (NON-PROPERTY)">
        <WorkbookTable>
          <WBRow label="DISPLAY ONLY - ENTER TOTAL CREDIT CARD DEBT">
            <CurrencyInput
              id="v2-debt-credit"
              value={debts.creditCards ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setDebtField("creditCards", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - ENTER TOTAL LOAN BALANCES">
            <CurrencyInput
              id="v2-debt-loans"
              value={debts.loans ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setDebtField("loans", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - ENTER TOTAL OWED LEASE BALANCES">
            <CurrencyInput
              id="v2-debt-lease"
              value={debts.leaseBalances ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setDebtField("leaseBalances", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="DISPLAY ONLY - ENTER OWED OTHER SCHOOL FEES BALANCES OR OTHER DEBT">
            <CurrencyInput
              id="v2-debt-fees"
              value={debts.schoolFeesOwedOrOther ?? 0}
              disabled={isReadOnly}
              onChange={(v) => {
                setDebtField("schoolFeesOwedOrOther", v);
                scheduleAutoSave();
              }}
            />
          </WBRow>
          <WBRow label="NUMBER OF SCHOOL YEARS LEFT FOR THE BURSARY RECIPIENT" auto={String(schoolingYearsRemaining)} note="From the Part 1 entry — one stored value." />
          <WBRow label="DISPLAY ONLY - DERIVED YEARLY DEBT REPAYMENTS" auto={fmtMoney(output?.derivedYearlyDebtRepayments)} />
          <WBRow label="YEARLY DEBT EXPOSURE (NETTED OFF YEARLY SAVINGS)" auto={fmtMoney(output?.yearlyDebtExposure)} />
          <WBRow label="DEBT OVER NET DISPOSABLE INCOME RATIO" auto={output ? output.debtOverNdiRatio.toFixed(3) : "—"} />
          <WBRow label="Minimum Debt Repayment Duration in months without school fees payments" auto={output?.minRepaymentMonths != null ? String(output.minRepaymentMonths) : "—"} />
          <WBRow label="DEBT STATUS" auto={output?.debtStatusLabel ?? "—"} emphasis />
          <WBRow label="DEBT SITUATION WITH THE FOUNDATION — DISPLAY ONLY - IS THE FAMILY BEHIND WITH THEIR SCHOOL FEES PAYMENTS?">
            <YesNo
              checked={behindOnFees}
              disabled={isReadOnly}
              ariaLabel="Is the family behind with their school fees payments?"
              onChange={(c) => {
                setBehindOnFees(c);
                scheduleAutoSave();
              }}
            />
          </WBRow>
        </WorkbookTable>

        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          LIFESTYLE SQUEEZE AFFORDABILITY RATIO
        </p>
        <WorkbookTable>
          <WBRow label="CALCULATING NDI over NET INCOME %" auto={pct(squeeze?.ndiOverIncomePct)} />
          <WBRow label="CALCULATING (NDI after YEARLY DEBT EXPOSURE) over NET INCOME) LIFESTYLE RATIO %" auto={pct(squeeze?.postDebtLifestylePct)} />
          <WBRow label="SCHOOL FEES USE BENCHMARKING" auto={fmtMoney(squeeze?.feesBenchmarkAmount)} />
          <WBRow label="LIFESTYLE SQUEEZE AFFORDABILITY RATIO" auto={pct(squeeze?.squeezeRatio)} emphasis />
          <WBRow label="LIFESTYLE SQUEEZE AFFORDABILITY STATUS" auto={squeeze?.statusLabel ?? "—"} emphasis />
        </WorkbookTable>
      </FormSection>

      {/* Epic 15 M5 (CI-10): the E. Flags section is REMOVED at client request
          ("we will stop using the flags there"). The dishonestyFlag column and
          any previously-saved value are preserved but no longer surfaced or
          editable here. */}

    </div>
  );
}
