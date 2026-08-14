"use client";

/**
 * CALC-07 — v2 per-earner income capture.
 *
 * Status-driven sub-table inputs mirroring the parent portal
 * (`ParentIncomeRecord`): the assessor toggles which income sub-blocks apply and
 * edits the numeric cells within each. The captured shape is `AssessorIncomeRecord`
 * (CALC-02) — the parent record plus two assessor-only extras
 * (`divorcedSeparated.newSpouseIncomePortion`, `thirdParty.numberOfKidsDivisor`).
 * Labels are reused from the portal income form for consistency.
 *
 * Pre-filled once from the family's submitted income (auto-populate-then-confirm,
 * handled by the parent form); this component only edits the working record.
 */

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { AssessorIncomeRecord } from "@/types/assessment-v2";
import { calculateEarnerIncome } from "@/lib/assessment/v2/income";

// ─── Currency input (shared with the v2 main form) ────────────────────────────

function formatCurrency(value: number): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseCurrency(raw: string, allowNegative = false): number {
  const cleaned = raw.replace(/[£,\s]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return allowNegative ? n : Math.max(0, n);
}

export function CurrencyInput({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  className,
  prefix = "£",
  allowNegative = false,
  ariaLabel = "Currency amount",
  ariaInvalid,
  ariaDescribedBy,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  /** Fired after the parsed value has been committed on blur (e.g. to schedule an auto-save). */
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  prefix?: string;
  /**
   * Epic 13 / C2 — allows a SIGNED amount. Off by default so every existing
   * (always-positive) money cell keeps its `Math.max(0, …)` clamp verbatim;
   * only the manual income-adjustment line opts in.
   */
  allowNegative?: boolean;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  // A signed field must still render a negative value, so "is there a value to
  // show?" is `!== 0`, not `> 0`, once negatives are allowed.
  const hasValue = React.useCallback(
    (v: number) => (allowNegative ? v !== 0 : v > 0),
    [allowNegative]
  );
  const [display, setDisplay] = React.useState(hasValue(value) ? formatCurrency(value) : "");
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDisplay(hasValue(value) ? formatCurrency(value) : "");
  }, [value, focused, hasValue]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-slate-400">
        {prefix}
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        disabled={disabled}
        onFocus={() => {
          setFocused(true);
          setDisplay(hasValue(value) ? String(value) : "");
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseCurrency(display, allowNegative);
          onChange(parsed);
          setDisplay(hasValue(parsed) ? formatCurrency(parsed) : "");
          onBlur?.();
        }}
        onChange={(e) => setDisplay(e.target.value)}
        className={cn("pl-7 text-right font-mono", className)}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  );
}

// ─── Sub-block definitions (data-driven) ──────────────────────────────────────

type BlockKey = keyof Pick<
  AssessorIncomeRecord,
  | "employed"
  | "selfEmployed"
  | "benefits"
  | "unemployed"
  | "retired"
  | "divorcedSeparated"
  | "thirdParty"
>;

interface FieldDef {
  key: string;
  label: string;
  /** Plain (non-currency) numeric input, e.g. a divisor. */
  plain?: boolean;
}

interface BlockDef {
  key: BlockKey;
  label: string;
  fields: FieldDef[];
}

const INCOME_BLOCKS: BlockDef[] = [
  {
    key: "employed",
    label: "Employed (PAYE)",
    fields: [{ key: "annualSalaryPaye", label: "Annual salary (PAYE)" }],
  },
  {
    key: "selfEmployed",
    label: "Self-employed",
    fields: [
      { key: "grossSalaried", label: "Gross earned income" },
      { key: "propertyIncome", label: "Property income" },
      { key: "dividends", label: "Dividends" },
      { key: "otherInvestmentIncome", label: "Other investment income" },
    ],
  },
  {
    key: "benefits",
    label: "Benefits",
    fields: [
      { key: "universalCredit", label: "Universal Credit" },
      { key: "housingBenefit", label: "Housing Benefit" },
      { key: "childBenefit", label: "Child Benefit" },
      { key: "childWorkingTaxCredit", label: "Child / Working Tax Credit" },
      { key: "esa", label: "ESA" },
      { key: "pipOrDla", label: "Disability Allowance / PIP" },
      { key: "carersAllowance", label: "Carer's Allowance" },
      { key: "childcareSupport", label: "Childcare Support" },
      { key: "other", label: "Other benefits" },
    ],
  },
  {
    key: "unemployed",
    label: "Unemployed",
    fields: [
      { key: "finalGrossPay", label: "Final gross pay" },
      { key: "redundancy", label: "Redundancy / severance" },
      { key: "jsa", label: "Job Seeker's Allowance" },
      { key: "grantSupport", label: "Grant / support" },
      { key: "leavePay", label: "Parental / adoption / sickness pay" },
    ],
  },
  {
    key: "retired",
    label: "Retired",
    fields: [
      { key: "statePension", label: "State Pension" },
      { key: "privatePension", label: "Private Pension & other plan" },
    ],
  },
  {
    key: "divorcedSeparated",
    label: "Divorced / separated",
    fields: [
      { key: "maintenanceReceived", label: "Child maintenance received" },
      { key: "newSpouseIncomePortion", label: "New spouse income portion (assessor)" },
    ],
  },
  {
    key: "thirdParty",
    label: "Third-party support",
    fields: [
      { key: "incomeSupportReceived", label: "Additional income support (last 12 months)" },
      { key: "numberOfKidsDivisor", label: "Number of children (divisor)", plain: true },
    ],
  },
];

/** Empty sub-block factory — supplies the required non-numeric fields so the record stays valid. */
function emptyBlock(key: BlockKey): Record<string, unknown> {
  switch (key) {
    case "divorcedSeparated":
      return { maintenanceReceived: 0, sharedCustodyNote: "" };
    case "thirdParty":
      return { incomeSupportReceived: 0, supportNote: "" };
    default:
      return {};
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EarnerFormV2Props {
  label: string;
  value: AssessorIncomeRecord;
  onChange: (next: AssessorIncomeRecord) => void;
  readOnly?: boolean;
  className?: string;
}

export function EarnerFormV2({ label, value, onChange, readOnly, className }: EarnerFormV2Props) {
  const idPrefix = label.toLowerCase().replace(/\s+/g, "-");

  const toggleBlock = (key: BlockKey, enabled: boolean) => {
    const next: AssessorIncomeRecord = { ...value };
    if (enabled) {
      (next as unknown as Record<string, unknown>)[key] = emptyBlock(key);
    } else {
      delete (next as unknown as Record<string, unknown>)[key];
    }
    next.total = calculateEarnerIncome(next);
    onChange(next);
  };

  const setField = (blockKey: BlockKey, fieldKey: string, fieldValue: number) => {
    const block = { ...((value as unknown as Record<string, unknown>)[blockKey] as Record<string, unknown>) };
    block[fieldKey] = fieldValue;
    const next: AssessorIncomeRecord = { ...value, [blockKey]: block };
    next.total = calculateEarnerIncome(next);
    onChange(next);
  };

  const total = calculateEarnerIncome(value);

  return (
    <div className={cn("space-y-3", className)}>
      {INCOME_BLOCKS.map((block) => {
        const active = (value as unknown as Record<string, unknown>)[block.key] != null;
        const blockData = (value as unknown as Record<string, unknown>)[block.key] as
          | Record<string, unknown>
          | undefined;
        return (
          <div
            key={block.key}
            className={cn(
              "rounded-lg border px-4 py-3",
              active ? "border-primary-100 bg-white" : "border-slate-200 bg-slate-50/50"
            )}
          >
            <label className="flex items-center gap-2">
              <Checkbox
                checked={active}
                disabled={readOnly}
                onCheckedChange={(c) => toggleBlock(block.key, c === true)}
                aria-label={`Toggle ${block.label}`}
              />
              <span className="text-sm font-semibold text-slate-700">{block.label}</span>
            </label>

            {active && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {block.fields.map((field) => {
                  const id = `${idPrefix}-${block.key}-${field.key}`;
                  const raw = Number((blockData?.[field.key] as number | undefined) ?? 0);
                  return (
                    <div key={field.key} className="grid gap-1.5">
                      <Label htmlFor={id} className="text-xs font-medium text-slate-600">
                        {field.label}
                      </Label>
                      {field.plain ? (
                        <Input
                          id={id}
                          type="number"
                          min={1}
                          value={raw > 0 ? raw : ""}
                          disabled={readOnly}
                          onChange={(e) =>
                            setField(block.key, field.key, Math.max(0, Number(e.target.value) || 0))
                          }
                          className="text-right font-mono"
                          placeholder="1"
                        />
                      ) : (
                        <CurrencyInput
                          id={id}
                          value={raw}
                          disabled={readOnly}
                          onChange={(v) => setField(block.key, field.key, v)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between rounded-md border border-primary-100 bg-primary-50 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-700">
          {label} — computed income
        </span>
        <span className="font-mono text-sm font-bold text-primary-900">
          {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(total)}
        </span>
      </div>
    </div>
  );
}
