"use client";

/**
 * WP-10: Earner Form Sub-component
 *
 * Reusable per-earner income entry form.
 * Shows/hides fields based on employment status.
 * Currency formatting for all money fields.
 * Labels: "Parent 1" / "Parent 2" (anonymised).
 */

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EmploymentStatus } from "@/lib/assessment/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EarnerFormValues {
  employmentStatus: EmploymentStatus;
  netPay: number;
  netDividends: number;
  netSelfEmployedProfit: number;
  pensionAmount: number;
  benefitsIncluded: number;
  benefitsIncludedDetail: string;
  benefitsExcluded: number;
  benefitsExcludedDetail: string;
}

interface EarnerFormProps {
  label: "Parent 1" | "Parent 2";
  values: EarnerFormValues;
  onChange: (values: EarnerFormValues) => void;
  /** If true, all inputs are read-only */
  readOnly?: boolean;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  PAYE: "PAYE (Employed)",
  BENEFITS: "Benefits only",
  SELF_EMPLOYED_DIRECTOR: "Self-employed (Director)",
  SELF_EMPLOYED_SOLE: "Self-employed (Sole Trader)",
  OLD_AGE_PENSION: "Old Age Pension",
  PAST_PENSION: "Past Employment Pension",
  UNEMPLOYED: "Unemployed",
};

// Field visibility rules per employment status
function showNetPay(status: EmploymentStatus): boolean {
  return status === "PAYE";
}

function showNetDividends(status: EmploymentStatus): boolean {
  return status === "SELF_EMPLOYED_DIRECTOR";
}

function showNetSelfEmployedProfit(status: EmploymentStatus): boolean {
  return (
    status === "SELF_EMPLOYED_DIRECTOR" || status === "SELF_EMPLOYED_SOLE"
  );
}

function showPension(status: EmploymentStatus): boolean {
  return status === "OLD_AGE_PENSION" || status === "PAST_PENSION";
}

function showBenefits(status: EmploymentStatus): boolean {
  return status !== "UNEMPLOYED";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats a number as currency display (£1,234.00) */
function formatCurrency(value: number): string {
  if (value === 0) return "";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Parses a currency string back to a number */
function parseCurrency(raw: string): number {
  const cleaned = raw.replace(/[£,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.max(0, n);
}

/** Calculate total income shown for this earner */
function calcEarnerTotal(v: EarnerFormValues): number {
  return (
    v.netPay +
    v.netDividends +
    v.netSelfEmployedProfit +
    v.pensionAmount +
    v.benefitsIncluded
  );
}

// ─── Currency Input ───────────────────────────────────────────────────────────

interface CurrencyInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function CurrencyInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder = "0.00",
  disabled,
  className,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(
    value > 0 ? formatCurrency(value) : ""
  );
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync external value changes when not focused
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value > 0 ? formatCurrency(value) : "");
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number on focus for easy editing
    setDisplayValue(value > 0 ? String(value) : "");
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseCurrency(displayValue);
    onChange(parsed);
    setDisplayValue(parsed > 0 ? formatCurrency(parsed) : "");
    onBlur?.();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none select-none">
        £
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("pl-7 font-mono text-right", className)}
        aria-label="Currency amount"
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
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-slate-600"
      >
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EarnerForm({
  label,
  values,
  onChange,
  readOnly = false,
  className,
}: EarnerFormProps) {
  const idPrefix = label.toLowerCase().replace(" ", "-");

  const update = (patch: Partial<EarnerFormValues>) => {
    onChange({ ...values, ...patch });
  };

  const total = calcEarnerTotal(values);
  const status = values.employmentStatus;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Employment status */}
      <FieldRow label="Employment Status" htmlFor={`${idPrefix}-status`}>
        <Select
          value={values.employmentStatus}
          onValueChange={(val) =>
            update({ employmentStatus: val as EmploymentStatus })
          }
          disabled={readOnly}
        >
          <SelectTrigger
            id={`${idPrefix}-status`}
            className="h-9 text-sm border-slate-200 bg-white"
          >
            <SelectValue placeholder="Select employment status" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(EMPLOYMENT_STATUS_LABELS) as EmploymentStatus[]).map(
              (s) => (
                <SelectItem key={s} value={s} className="text-sm">
                  {EMPLOYMENT_STATUS_LABELS[s]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </FieldRow>

      {/* Net pay — PAYE only */}
      {showNetPay(status) && (
        <FieldRow
          label="Net Pay (annual)"
          htmlFor={`${idPrefix}-net-pay`}
          hint="Total net salary after tax and NI"
        >
          <CurrencyInput
            id={`${idPrefix}-net-pay`}
            value={values.netPay}
            onChange={(v) => update({ netPay: v })}
            disabled={readOnly}
          />
        </FieldRow>
      )}

      {/* Net self-employed profit — Director + Sole Trader */}
      {showNetSelfEmployedProfit(status) && (
        <FieldRow
          label="Net Self-Employed Profit (annual)"
          htmlFor={`${idPrefix}-se-profit`}
          hint="Net profit after allowable expenses"
        >
          <CurrencyInput
            id={`${idPrefix}-se-profit`}
            value={values.netSelfEmployedProfit}
            onChange={(v) => update({ netSelfEmployedProfit: v })}
            disabled={readOnly}
          />
        </FieldRow>
      )}

      {/* Net dividends — Director only */}
      {showNetDividends(status) && (
        <FieldRow
          label="Net Dividends (annual)"
          htmlFor={`${idPrefix}-dividends`}
          hint="Net dividends received from company"
        >
          <CurrencyInput
            id={`${idPrefix}-dividends`}
            value={values.netDividends}
            onChange={(v) => update({ netDividends: v })}
            disabled={readOnly}
          />
        </FieldRow>
      )}

      {/* Pension — Old Age + Past Pension */}
      {showPension(status) && (
        <FieldRow
          label="Pension Amount (annual)"
          htmlFor={`${idPrefix}-pension`}
          hint="Annual pension income"
        >
          <CurrencyInput
            id={`${idPrefix}-pension`}
            value={values.pensionAmount}
            onChange={(v) => update({ pensionAmount: v })}
            disabled={readOnly}
          />
        </FieldRow>
      )}

      {/* Benefits included — most statuses */}
      {showBenefits(status) && (
        <>
          <FieldRow
            label="Benefits Included (annual)"
            htmlFor={`${idPrefix}-benefits-inc`}
            hint="DLA, ESA, PIP, Carer's (included in calculation)"
          >
            <CurrencyInput
              id={`${idPrefix}-benefits-inc`}
              value={values.benefitsIncluded}
              onChange={(v) => update({ benefitsIncluded: v })}
              disabled={readOnly}
            />
          </FieldRow>
          {values.benefitsIncluded > 0 && (
            <FieldRow
              label="Benefits Included — Detail"
              htmlFor={`${idPrefix}-benefits-inc-detail`}
            >
              <Input
                id={`${idPrefix}-benefits-inc-detail`}
                type="text"
                value={values.benefitsIncludedDetail}
                onChange={(e) =>
                  update({ benefitsIncludedDetail: e.target.value })
                }
                placeholder="e.g. DLA £4,500, PIP £2,100"
                disabled={readOnly}
                className="h-9 text-sm border-slate-200"
              />
            </FieldRow>
          )}

          <FieldRow
            label="Benefits Excluded (annual)"
            htmlFor={`${idPrefix}-benefits-exc`}
            hint="Child disability benefits — recorded only, not included in income"
          >
            <CurrencyInput
              id={`${idPrefix}-benefits-exc`}
              value={values.benefitsExcluded}
              onChange={(v) => update({ benefitsExcluded: v })}
              disabled={readOnly}
            />
          </FieldRow>
          {values.benefitsExcluded > 0 && (
            <FieldRow
              label="Benefits Excluded — Detail"
              htmlFor={`${idPrefix}-benefits-exc-detail`}
            >
              <Input
                id={`${idPrefix}-benefits-exc-detail`}
                type="text"
                value={values.benefitsExcludedDetail}
                onChange={(e) =>
                  update({ benefitsExcludedDetail: e.target.value })
                }
                placeholder="e.g. Child DLA £3,200"
                disabled={readOnly}
                className="h-9 text-sm border-slate-200"
              />
            </FieldRow>
          )}
        </>
      )}

      {/* Per-earner total */}
      <div className="mt-2 flex items-center justify-between rounded-md border border-primary-100 bg-primary-50 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-700">
          {label} Total Income
        </span>
        <span className="font-mono text-sm font-bold text-primary-900">
          {new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
          }).format(total)}
        </span>
      </div>
    </div>
  );
}
