"use client";

/**
 * WP-10: Assessment Form
 *
 * Main data entry form for assessors. Five sections:
 *   A. Reference Data (family type, fees, council tax, schooling years)
 *   B. Income Entry (per earner: Parent 1 / Parent 2)
 *   C. Property & Savings
 *   D. Payable Fees (scholarship, VAT, manual adjustment)
 *   E. Flags (dishonesty, credit risk)
 *
 * Auto-saves on blur. Runs live calculation via CalculationDisplay.
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EarnerForm, type EarnerFormValues } from "@/components/admin/earner-form";
import { CalculationDisplay } from "@/components/admin/calculation-display";
import {
  saveAssessmentAction,
  completeAssessmentAction,
  pauseAssessmentAction,
} from "@/app/(admin)/applications/[id]/assessment/actions";
import type { AssessmentInput } from "@/lib/assessment/types";
import { calculateDerivedSavings } from "@/lib/assessment/calculator";
import type { FamilyTypeConfigRow } from "@/lib/db/queries/reference-tables";
import { cn } from "@/lib/utils";
import type {
  AssessmentStatus,
  EarnerLabel,
  EmploymentStatus,
  Prisma,
} from "@prisma/client";

type JsonValue = Prisma.JsonValue;

// ─── Serialised Types (Decimal → number) ──────────────────────────────────────
// These mirror the DB types but with all Decimal fields converted to number.
// This avoids passing Prisma Decimal objects across the server/client boundary.

export interface SerialisedEarner {
  id: string;
  assessmentId: string;
  earnerLabel: EarnerLabel;
  employmentStatus: EmploymentStatus;
  netPay: number;
  netDividends: number;
  netSelfEmployedProfit: number;
  pensionAmount: number;
  benefitsIncluded: number;
  benefitsIncludedDetail: JsonValue;
  benefitsExcluded: number;
  benefitsExcludedDetail: JsonValue;
  totalIncome: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerialisedProperty {
  id: string;
  assessmentId: string;
  isMortgageFree: boolean;
  additionalPropertyCount: number;
  additionalPropertyIncome: number;
  cashSavings: number;
  isasPepsShares: number;
  schoolAgeChildrenCount: number;
  derivedSavingsAnnualTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerialisedAssessment {
  id: string;
  applicationId: string;
  assessorId: string;
  familyTypeCategory: number | null;
  notionalRent: number | null;
  utilityCosts: number | null;
  foodCosts: number | null;
  annualFees: number | null;
  councilTax: number | null;
  schoolingYearsRemaining: number | null;
  totalHouseholdNetIncome: number | null;
  netAssetsYearlyValuation: number | null;
  hndiAfterNs: number | null;
  requiredBursary: number | null;
  grossFees: number | null;
  scholarshipPct: number | null;
  bursaryAward: number | null;
  netYearlyFees: number | null;
  vatRate: number | null;
  yearlyPayableFees: number | null;
  monthlyPayableFees: number | null;
  manualAdjustment: number | null;
  manualAdjustmentReason: string | null;
  propertyCategory: number | null;
  propertyExceedsThreshold: boolean;
  dishonestyFlag: boolean;
  creditRiskFlag: boolean;
  status: AssessmentStatus;
  outcome: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  earners: SerialisedEarner[];
  property: SerialisedProperty | null;
  checklists: { id: string; assessmentId: string; tab: string; notes: string; updatedAt: Date }[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssessmentFormProps {
  assessment: SerialisedAssessment;
  applicationId: string;
  school: "WHITGIFT" | "TRINITY";
  applicationEntryYear: number | null;
  familyTypeConfigs: FamilyTypeConfigRow[];
  defaultAnnualFees: number;
  defaultCouncilTax: number;
  /** Payable fees of older siblings (priority-ordered). Used for sequential income absorption. */
  siblingPayableFees?: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

function parseCurrency(raw: string): number {
  const cleaned = raw.replace(/[£,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.max(0, n);
}

function formatCurrency(value: number): string {
  if (value === 0) return "";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Calculate schooling years remaining from entry year
// Formula: 13 - (currentAcademicYear - entryYear + 1)
// Clamped to [0, 13]
function calcSchoolingYears(entryYear: number | null): number {
  if (!entryYear) return 7; // sensible default
  const now = new Date();
  const academicYear =
    now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const yearInSchool = academicYear - entryYear + 1;
  const remaining = 13 - yearInSchool;
  return Math.max(0, Math.min(13, remaining));
}

const DEFAULT_EARNER: EarnerFormValues = {
  employmentStatus: "PAYE",
  netPay: 0,
  netDividends: 0,
  netSelfEmployedProfit: 0,
  pensionAmount: 0,
  benefitsIncluded: 0,
  benefitsIncludedDetail: "",
  benefitsExcluded: 0,
  benefitsExcludedDetail: "",
};

// ─── Currency Input ───────────────────────────────────────────────────────────

interface CurrencyInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

function CurrencyInput({
  id,
  value,
  onChange,
  onBlur,
  disabled,
}: CurrencyInputProps) {
  const [display, setDisplay] = React.useState(
    value > 0 ? formatCurrency(value) : ""
  );
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDisplay(value > 0 ? formatCurrency(value) : "");
  }, [value, focused]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none select-none">
        £
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => setDisplay(e.target.value)}
        onFocus={() => {
          setFocused(true);
          setDisplay(value > 0 ? String(value) : "");
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseCurrency(display);
          onChange(parsed);
          setDisplay(parsed > 0 ? formatCurrency(parsed) : "");
          onBlur?.();
        }}
        disabled={disabled}
        className="pl-7 font-mono text-right h-9 border-slate-200 text-sm"
      />
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  htmlFor,
  children,
  hint,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-slate-600">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function FormSection({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer select-none border-b border-neutral-100 bg-neutral-50 px-5 py-3.5 hover:bg-neutral-100 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-700">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronDown
              className="h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
          )}
        </div>
      </CardHeader>
      {open && <CardContent className="px-5 py-4">{children}</CardContent>}
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AssessmentForm({
  assessment,
  applicationId,
  school: _school,
  applicationEntryYear,
  familyTypeConfigs,
  defaultAnnualFees,
  defaultCouncilTax,
  siblingPayableFees: siblingPayableFeesFromProps = [],
}: AssessmentFormProps) {
  const router = useRouter();
  const isReadOnly = assessment.status === "COMPLETED";

  // ── Section A: Reference Data ──────────────────────────────────────────────

  const [familyTypeCategory, setFamilyTypeCategory] = React.useState<number>(
    assessment.familyTypeCategory ?? 1
  );

  // Derive family type config values from selected category
  const activeFamilyConfig = React.useMemo(() => {
    return (
      familyTypeConfigs.find((c) => c.category === familyTypeCategory) ??
      familyTypeConfigs[0]
    );
  }, [familyTypeConfigs, familyTypeCategory]);

  const [notionalRent, setNotionalRent] = React.useState<number>(
    Number(assessment.notionalRent ?? activeFamilyConfig?.notionalRent ?? 0)
  );
  const [utilityCosts, setUtilityCosts] = React.useState<number>(
    Number(assessment.utilityCosts ?? activeFamilyConfig?.utilityCosts ?? 0)
  );
  const [foodCosts, setFoodCosts] = React.useState<number>(
    Number(assessment.foodCosts ?? activeFamilyConfig?.foodCosts ?? 0)
  );
  const [annualFees, setAnnualFees] = React.useState<number>(
    Number(assessment.annualFees ?? defaultAnnualFees)
  );
  const [councilTax, setCouncilTax] = React.useState<number>(
    Number(assessment.councilTax ?? defaultCouncilTax)
  );
  const [schoolingYearsRemaining, setSchoolingYearsRemaining] =
    React.useState<number>(
      assessment.schoolingYearsRemaining ??
        calcSchoolingYears(applicationEntryYear)
    );
  const [entryYearDisplay, setEntryYearDisplay] = React.useState<string>(
    applicationEntryYear ? String(applicationEntryYear) : ""
  );

  // Update family config values when category changes (if not yet manually overridden)
  const handleFamilyCategoryChange = (category: number) => {
    setFamilyTypeCategory(category);
    const config = familyTypeConfigs.find((c) => c.category === category);
    if (config) {
      setNotionalRent(config.notionalRent);
      setUtilityCosts(config.utilityCosts);
      setFoodCosts(config.foodCosts);
    }
  };

  // ── Section B: Income (Earners) ────────────────────────────────────────────

  const getEarnerFromDB = (label: "PARENT_1" | "PARENT_2"): EarnerFormValues => {
    const dbEarner = assessment.earners.find((e) => e.earnerLabel === label);
    if (!dbEarner) return { ...DEFAULT_EARNER };
    return {
      employmentStatus: dbEarner.employmentStatus as EarnerFormValues["employmentStatus"],
      netPay: Number(dbEarner.netPay),
      netDividends: Number(dbEarner.netDividends),
      netSelfEmployedProfit: Number(dbEarner.netSelfEmployedProfit),
      pensionAmount: Number(dbEarner.pensionAmount),
      benefitsIncluded: Number(dbEarner.benefitsIncluded),
      benefitsIncludedDetail:
        typeof dbEarner.benefitsIncludedDetail === "object" &&
        dbEarner.benefitsIncludedDetail !== null
          ? String(
              (dbEarner.benefitsIncludedDetail as Record<string, unknown>)
                .detail ?? ""
            )
          : "",
      benefitsExcluded: Number(dbEarner.benefitsExcluded),
      benefitsExcludedDetail:
        typeof dbEarner.benefitsExcludedDetail === "object" &&
        dbEarner.benefitsExcludedDetail !== null
          ? String(
              (dbEarner.benefitsExcludedDetail as Record<string, unknown>)
                .detail ?? ""
            )
          : "",
    };
  };

  const [parent1, setParent1] = React.useState<EarnerFormValues>(
    getEarnerFromDB("PARENT_1")
  );
  const [parent2, setParent2] = React.useState<EarnerFormValues>(
    getEarnerFromDB("PARENT_2")
  );

  // ── Section C: Property & Savings ─────────────────────────────────────────

  const [isMortgageFree, setIsMortgageFree] = React.useState<boolean>(
    assessment.property?.isMortgageFree ?? false
  );
  const [additionalPropertyCount, setAdditionalPropertyCount] =
    React.useState<number>(assessment.property?.additionalPropertyCount ?? 0);
  const [additionalPropertyIncome, setAdditionalPropertyIncome] =
    React.useState<number>(
      Number(assessment.property?.additionalPropertyIncome ?? 0)
    );
  const [cashSavings, setCashSavings] = React.useState<number>(
    Number(assessment.property?.cashSavings ?? 0)
  );
  const [isasPepsShares, setIsasPepsShares] = React.useState<number>(
    Number(assessment.property?.isasPepsShares ?? 0)
  );
  const [schoolAgeChildrenCount, setSchoolAgeChildrenCount] =
    React.useState<number>(assessment.property?.schoolAgeChildrenCount ?? 1);

  // ── Section D: Payable Fees ────────────────────────────────────────────────

  const [scholarshipPct, setScholarshipPct] = React.useState<number>(
    Number(assessment.scholarshipPct ?? 0)
  );
  const [scholarshipDisplay, setScholarshipDisplay] = React.useState<string>(
    String(Number(assessment.scholarshipPct ?? 0))
  );
  const [vatRate, setVatRate] = React.useState<number>(
    Number(assessment.vatRate ?? 20)
  );
  const [manualAdjustment, setManualAdjustment] = React.useState<number>(
    Number(assessment.manualAdjustment ?? 0)
  );
  const [manualAdjustmentReason, setManualAdjustmentReason] =
    React.useState<string>(assessment.manualAdjustmentReason ?? "");

  // ── Section E: Flags ───────────────────────────────────────────────────────

  const [dishonestyFlag, setDishonestyFlag] = React.useState<boolean>(
    assessment.dishonestyFlag ?? false
  );
  const [creditRiskFlag, setCreditRiskFlag] = React.useState<boolean>(
    assessment.creditRiskFlag ?? false
  );

  // ── Saving state ───────────────────────────────────────────────────────────

  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isPausing, setIsPausing] = React.useState(false);

  // ── Assessment input for live calculation ──────────────────────────────────

  const assessmentInput: AssessmentInput = React.useMemo(() => {
    return {
      earners: [
        {
          earnerLabel: "PARENT_1",
          employmentStatus: parent1.employmentStatus,
          netPay: parent1.netPay,
          netDividends: parent1.netDividends,
          netSelfEmployedProfit: parent1.netSelfEmployedProfit,
          pensionAmount: parent1.pensionAmount,
          benefitsIncluded: parent1.benefitsIncluded,
          benefitsExcluded: parent1.benefitsExcluded,
        },
        {
          earnerLabel: "PARENT_2",
          employmentStatus: parent2.employmentStatus,
          netPay: parent2.netPay,
          netDividends: parent2.netDividends,
          netSelfEmployedProfit: parent2.netSelfEmployedProfit,
          pensionAmount: parent2.pensionAmount,
          benefitsIncluded: parent2.benefitsIncluded,
          benefitsExcluded: parent2.benefitsExcluded,
        },
      ],
      familyTypeCategory,
      notionalRent,
      utilityCosts,
      foodCosts,
      annualFees,
      councilTax,
      schoolingYearsRemaining,
      isMortgageFree,
      additionalPropertyIncome,
      cashSavings,
      isasPepsShares,
      schoolAgeChildrenCount,
      scholarshipPct,
      vatRate,
      manualAdjustment,
      siblingPayableFees: siblingPayableFeesFromProps,
    };
  }, [
    parent1,
    parent2,
    familyTypeCategory,
    notionalRent,
    utilityCosts,
    foodCosts,
    annualFees,
    councilTax,
    schoolingYearsRemaining,
    isMortgageFree,
    additionalPropertyIncome,
    cashSavings,
    isasPepsShares,
    schoolAgeChildrenCount,
    scholarshipPct,
    vatRate,
    manualAdjustment,
    siblingPayableFeesFromProps,
  ]);

  // ── Save handler ───────────────────────────────────────────────────────────

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

    const result = await saveAssessmentAction(
      assessment.id,
      applicationId,
      {
        familyTypeCategory,
        notionalRent,
        utilityCosts,
        foodCosts,
        annualFees,
        councilTax,
        schoolingYearsRemaining,
        scholarshipPct,
        vatRate,
        manualAdjustment,
        manualAdjustmentReason,
        dishonestyFlag,
        creditRiskFlag,
        earners: [
          {
            earnerLabel: "PARENT_1",
            employmentStatus: parent1.employmentStatus,
            netPay: parent1.netPay,
            netDividends: parent1.netDividends,
            netSelfEmployedProfit: parent1.netSelfEmployedProfit,
            pensionAmount: parent1.pensionAmount,
            benefitsIncluded: parent1.benefitsIncluded,
            benefitsExcluded: parent1.benefitsExcluded,
          },
          {
            earnerLabel: "PARENT_2",
            employmentStatus: parent2.employmentStatus,
            netPay: parent2.netPay,
            netDividends: parent2.netDividends,
            netSelfEmployedProfit: parent2.netSelfEmployedProfit,
            pensionAmount: parent2.pensionAmount,
            benefitsIncluded: parent2.benefitsIncluded,
            benefitsExcluded: parent2.benefitsExcluded,
          },
        ],
        property: {
          isMortgageFree,
          additionalPropertyCount,
          additionalPropertyIncome,
          cashSavings,
          isasPepsShares,
          schoolAgeChildrenCount,
          derivedSavingsAnnualTotal: derivedSavings,
        },
      }
    );

    setIsSaving(false);
    if (result.success) {
      setLastSaved(new Date());
    } else {
      setSaveError(result.error);
    }
  }, [
    assessment.id,
    applicationId,
    isReadOnly,
    familyTypeCategory,
    notionalRent,
    utilityCosts,
    foodCosts,
    annualFees,
    councilTax,
    schoolingYearsRemaining,
    scholarshipPct,
    vatRate,
    manualAdjustment,
    manualAdjustmentReason,
    dishonestyFlag,
    creditRiskFlag,
    parent1,
    parent2,
    isMortgageFree,
    additionalPropertyCount,
    additionalPropertyIncome,
    cashSavings,
    isasPepsShares,
    schoolAgeChildrenCount,
  ]);

  // Auto-save on blur — debounced 300 ms
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSave = React.useCallback(() => {
    if (isReadOnly) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave();
    }, 300);
  }, [handleSave, isReadOnly]);

  // ── Complete / Pause handlers ──────────────────────────────────────────────

  const handleComplete = async () => {
    setIsCompleting(true);
    await handleSave();
    const result = await completeAssessmentAction(assessment.id, applicationId);
    setIsCompleting(false);
    if (result.success) {
      router.refresh();
    } else {
      setSaveError(result.error);
    }
  };

  const handlePause = async () => {
    setIsPausing(true);
    await handleSave();
    const result = await pauseAssessmentAction(assessment.id, applicationId);
    setIsPausing(false);
    if (result.success) {
      router.refresh();
    } else {
      setSaveError(result.error);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left: form sections */}
      <div className="space-y-4">
        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                assessment.status === "COMPLETED"
                  ? "bg-success-50 text-success-600"
                  : assessment.status === "PAUSED"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  assessment.status === "COMPLETED"
                    ? "bg-success-600"
                    : assessment.status === "PAUSED"
                    ? "bg-amber-500"
                    : "bg-slate-400"
                )}
              />
              {assessment.status === "COMPLETED"
                ? "Completed"
                : assessment.status === "PAUSED"
                ? "Paused"
                : "In Progress"}
            </span>
            {lastSaved && (
              <span className="text-xs text-slate-400">
                Saved{" "}
                {lastSaved.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
            {saveError && (
              <span className="flex items-center gap-1 text-xs text-error-600">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {saveError}
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
                className="h-8 px-3 text-xs border-slate-200"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {isSaving ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                disabled={isSaving || isCompleting || isPausing}
                className="h-8 px-3 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <PauseCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {isPausing ? "Pausing…" : "Pause"}
              </Button>
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={isSaving || isCompleting || isPausing || annualFees === 0}
                className="h-8 px-3 text-xs bg-success-600 hover:bg-success-600/90 text-white"
              >
                <CheckCircle2
                  className="mr-1.5 h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {isCompleting ? "Completing…" : "Complete"}
              </Button>
            </div>
          )}
        </div>

        {/* Section A: Reference Data */}
        <FormSection
          title="A. Reference Data"
          subtitle="Family type, fees, and housing costs"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Family type category */}
            <FieldRow
              label="Family Type Category"
              htmlFor="family-type-category"
              hint="Auto-populates notional rent, utilities, and food costs"
            >
              <Select
                value={String(familyTypeCategory)}
                onValueChange={(v) => {
                  handleFamilyCategoryChange(Number(v));
                  scheduleAutoSave();
                }}
                disabled={isReadOnly}
              >
                <SelectTrigger
                  id="family-type-category"
                  className="h-9 border-slate-200 text-sm"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {familyTypeConfigs.map((c) => (
                    <SelectItem key={c.id} value={String(c.category)}>
                      {c.category}. {c.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            {/* School fees (annual) */}
            <FieldRow
              label="Annual School Fees"
              htmlFor="annual-fees"
              hint="Pre-VAT annual fees for this school"
            >
              <CurrencyInput
                id="annual-fees"
                value={annualFees}
                onChange={setAnnualFees}
                onBlur={scheduleAutoSave}
                disabled={isReadOnly}
              />
            </FieldRow>

            {/* Entry year + schooling years remaining */}
            <FieldRow
              label="Entry Year"
              htmlFor="entry-year"
              hint="Academic year of school entry (e.g. 2019)"
            >
              <Input
                id="entry-year"
                type="number"
                min={2000}
                max={2040}
                value={entryYearDisplay}
                onChange={(e) => setEntryYearDisplay(e.target.value)}
                onBlur={() => {
                  const yr = parseInt(entryYearDisplay, 10);
                  if (!isNaN(yr)) {
                    setSchoolingYearsRemaining(calcSchoolingYears(yr));
                  }
                  scheduleAutoSave();
                }}
                disabled={isReadOnly}
                className="h-9 border-slate-200 text-sm"
                placeholder="e.g. 2019"
              />
            </FieldRow>

            <FieldRow
              label="Schooling Years Remaining"
              htmlFor="schooling-years"
              hint="Calculated from entry year (0–13)"
            >
              <Input
                id="schooling-years"
                type="number"
                min={0}
                max={13}
                value={schoolingYearsRemaining}
                onChange={(e) =>
                  setSchoolingYearsRemaining(
                    Math.max(0, Math.min(13, parseInt(e.target.value, 10) || 0))
                  )
                }
                onBlur={scheduleAutoSave}
                disabled={isReadOnly}
                className="h-9 border-slate-200 text-sm"
              />
            </FieldRow>

            {/* Council tax */}
            <FieldRow
              label="Council Tax (annual)"
              htmlFor="council-tax"
              hint="Default: Band D Croydon"
            >
              <CurrencyInput
                id="council-tax"
                value={councilTax}
                onChange={setCouncilTax}
                onBlur={scheduleAutoSave}
                disabled={isReadOnly}
              />
            </FieldRow>
          </div>

          {/* Auto-populated family type costs */}
          {activeFamilyConfig && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Notional Rent
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-700">
                  {fmt(notionalRent)}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Utility Costs
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-700">
                  {fmt(utilityCosts)}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Food Costs
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-700">
                  {fmt(foodCosts)}
                </p>
              </div>
            </div>
          )}
        </FormSection>

        {/* Section B: Income Entry */}
        <FormSection
          title="B. Income Entry"
          subtitle="Parent 1 and Parent 2 income details"
        >
          <Tabs defaultValue="parent1">
            <TabsList className="mb-4 h-9 border border-slate-200 bg-slate-50">
              <TabsTrigger
                value="parent1"
                className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Parent 1
              </TabsTrigger>
              <TabsTrigger
                value="parent2"
                className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Parent 2
              </TabsTrigger>
            </TabsList>
            <TabsContent value="parent1">
              <EarnerForm
                label="Parent 1"
                values={parent1}
                onChange={(v) => {
                  setParent1(v);
                  scheduleAutoSave();
                }}
                readOnly={isReadOnly}
              />
            </TabsContent>
            <TabsContent value="parent2">
              <EarnerForm
                label="Parent 2"
                values={parent2}
                onChange={(v) => {
                  setParent2(v);
                  scheduleAutoSave();
                }}
                readOnly={isReadOnly}
              />
            </TabsContent>
          </Tabs>
        </FormSection>

        {/* Section C: Property & Savings */}
        <FormSection
          title="C. Property &amp; Savings"
          subtitle="Housing situation and financial assets"
        >
          <div className="space-y-4">
            {/* Mortgage-free toggle */}
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <Label
                  htmlFor="mortgage-free"
                  className="cursor-pointer text-sm font-medium text-slate-700"
                >
                  Mortgage-free property
                </Label>
                <p className="mt-0.5 text-xs text-slate-400">
                  If checked, notional rent is added back to income
                </p>
              </div>
              <Switch
                id="mortgage-free"
                checked={isMortgageFree}
                onCheckedChange={(v) => {
                  setIsMortgageFree(v);
                  scheduleAutoSave();
                }}
                disabled={isReadOnly}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Additional properties */}
              <FieldRow
                label="Additional Property Count"
                htmlFor="add-property-count"
                hint="Number of additional properties owned"
              >
                <Input
                  id="add-property-count"
                  type="number"
                  min={0}
                  value={additionalPropertyCount}
                  onChange={(e) =>
                    setAdditionalPropertyCount(
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    )
                  }
                  onBlur={scheduleAutoSave}
                  disabled={isReadOnly}
                  className="h-9 border-slate-200 text-sm"
                />
              </FieldRow>

              <FieldRow
                label="Additional Property Income (annual)"
                htmlFor="add-property-income"
                hint="Total rental income from additional properties"
              >
                <CurrencyInput
                  id="add-property-income"
                  value={additionalPropertyIncome}
                  onChange={setAdditionalPropertyIncome}
                  onBlur={scheduleAutoSave}
                  disabled={isReadOnly || additionalPropertyCount === 0}
                />
              </FieldRow>

              {/* Savings */}
              <FieldRow
                label="Cash Savings"
                htmlFor="cash-savings"
                hint="Total cash savings (bank accounts, etc.)"
              >
                <CurrencyInput
                  id="cash-savings"
                  value={cashSavings}
                  onChange={setCashSavings}
                  onBlur={scheduleAutoSave}
                  disabled={isReadOnly}
                />
              </FieldRow>

              <FieldRow
                label="ISAs / PEPs / Shares"
                htmlFor="isas-peps-shares"
                hint="Total value of investment holdings"
              >
                <CurrencyInput
                  id="isas-peps-shares"
                  value={isasPepsShares}
                  onChange={setIsasPepsShares}
                  onBlur={scheduleAutoSave}
                  disabled={isReadOnly}
                />
              </FieldRow>

              {/* School-age children count */}
              <FieldRow
                label="School-Age Children Count"
                htmlFor="school-age-children"
                hint="Number of school-age children (used as savings divisor)"
              >
                <Input
                  id="school-age-children"
                  type="number"
                  min={1}
                  value={schoolAgeChildrenCount}
                  onChange={(e) =>
                    setSchoolAgeChildrenCount(
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                  onBlur={scheduleAutoSave}
                  disabled={isReadOnly}
                  className="h-9 border-slate-200 text-sm"
                />
              </FieldRow>
            </div>
          </div>
        </FormSection>

        {/* Section D: Payable Fees */}
        <FormSection
          title="D. Payable Fees"
          subtitle="Scholarship, VAT, and manual adjustments"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Scholarship percentage */}
            <FieldRow
              label="Scholarship Percentage (%)"
              htmlFor="scholarship-pct"
              hint="School scholarship applied before bursary (0–100)"
            >
              <div className="flex items-center gap-3">
                <Input
                  id="scholarship-pct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={scholarshipDisplay}
                  onChange={(e) => setScholarshipDisplay(e.target.value)}
                  onBlur={() => {
                    const v = Math.max(
                      0,
                      Math.min(100, parseFloat(scholarshipDisplay) || 0)
                    );
                    setScholarshipPct(v);
                    setScholarshipDisplay(String(v));
                    scheduleAutoSave();
                  }}
                  disabled={isReadOnly}
                  className="h-9 border-slate-200 text-sm font-mono"
                />
                <span className="shrink-0 text-sm text-slate-500">%</span>
              </div>
            </FieldRow>

            {/* VAT rate */}
            <FieldRow
              label="VAT Rate (%)"
              htmlFor="vat-rate"
              hint="Default: 20%"
            >
              <div className="flex items-center gap-3">
                <Input
                  id="vat-rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={vatRate}
                  onChange={(e) =>
                    setVatRate(
                      Math.max(
                        0,
                        Math.min(100, parseFloat(e.target.value) || 0)
                      )
                    )
                  }
                  onBlur={scheduleAutoSave}
                  disabled={isReadOnly}
                  className="h-9 border-slate-200 text-sm font-mono"
                />
                <span className="shrink-0 text-sm text-slate-500">%</span>
              </div>
            </FieldRow>

            {/* Manual adjustment */}
            <FieldRow
              label="Manual Adjustment"
              htmlFor="manual-adjustment"
              hint="Positive = increase fees; Negative = reduce fees"
            >
              <CurrencyInput
                id="manual-adjustment"
                value={manualAdjustment}
                onChange={setManualAdjustment}
                onBlur={scheduleAutoSave}
                disabled={isReadOnly}
              />
            </FieldRow>

            {manualAdjustment !== 0 && (
              <FieldRow
                label="Manual Adjustment Reason"
                htmlFor="manual-adjustment-reason"
              >
                <Input
                  id="manual-adjustment-reason"
                  type="text"
                  value={manualAdjustmentReason}
                  onChange={(e) =>
                    setManualAdjustmentReason(e.target.value)
                  }
                  onBlur={scheduleAutoSave}
                  disabled={isReadOnly}
                  placeholder="Reason for manual adjustment"
                  className="h-9 border-slate-200 text-sm"
                />
              </FieldRow>
            )}
          </div>
        </FormSection>

        {/* Section E: Flags */}
        <FormSection
          title="E. Flags"
          subtitle="Risk indicators for this assessment"
          defaultOpen
        >
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 px-4 py-3 hover:bg-slate-50 transition-colors">
              <Checkbox
                id="dishonesty-flag"
                checked={dishonestyFlag}
                onCheckedChange={(v) => {
                  setDishonestyFlag(Boolean(v));
                  scheduleAutoSave();
                }}
                disabled={isReadOnly}
                className="mt-0.5 border-slate-300 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">
                  Dishonesty flag
                </span>
                <p className="mt-0.5 text-xs text-slate-400">
                  Raise if evidence of misleading or inaccurate information
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 px-4 py-3 hover:bg-slate-50 transition-colors">
              <Checkbox
                id="credit-risk-flag"
                checked={creditRiskFlag}
                onCheckedChange={(v) => {
                  setCreditRiskFlag(Boolean(v));
                  scheduleAutoSave();
                }}
                disabled={isReadOnly}
                className="mt-0.5 border-slate-300 data-[state=checked]:border-error-600 data-[state=checked]:bg-error-600"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">
                  Credit risk flag
                </span>
                <p className="mt-0.5 text-xs text-slate-400">
                  Raise if there are concerns about financial stability or debt
                </p>
              </div>
            </label>
          </div>
        </FormSection>
      </div>

      {/* Right: sticky calculation display */}
      <div className="hidden lg:block">
        <div className="sticky top-6">
          <CalculationDisplay
            input={assessmentInput}
            dishonestyFlag={dishonestyFlag}
            creditRiskFlag={creditRiskFlag}
          />
        </div>
      </div>

      {/* Mobile calculation display — shown at bottom */}
      <div className="lg:hidden">
        <CalculationDisplay
          input={assessmentInput}
          dishonestyFlag={dishonestyFlag}
          creditRiskFlag={creditRiskFlag}
        />
      </div>
    </div>
  );
}
