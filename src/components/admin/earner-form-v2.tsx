"use client";

/**
 * CurrencyInput — the shared money cell for the v2 assessor surfaces.
 *
 * Epic 14 C5 (CG-20) retired the per-earner sub-block capture that used to
 * live here (EarnerFormV2) — income entry is now the single two-column
 * workbook table (`income-table-v2.tsx`). This module keeps the currency
 * input both consumers share.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
