"use client";

/**
 * Epic 06: Assessment Calculation Strip
 *
 * The live calculation, presented as a COLLAPSIBLE, PERSISTENT strip across the
 * TOP of the assessment workspace (full content width) instead of an always-on
 * right rail (plan §3.1 / §5.3a).
 *
 *  - Collapsed (default): a one-line digest — monthly + yearly payable fees and
 *    bursary award — so the laptop view is two columns (documents | data) with
 *    the form using the full pane width.
 *  - Expanded: the full `CalculationDisplay` breakdown.
 *  - Collapsed/expanded state persists in localStorage (mirrors the SplitScreen
 *    ratio pattern).
 *
 * Pure layout: this changes only WHERE the calculation renders, not what it
 * computes (calc semantics are Epic 07).
 */

import * as React from "react";
import { ChevronDown, ChevronUp, Calculator } from "lucide-react";
import { CalculationDisplay } from "@/components/admin/calculation-display";
import { calculateAssessment } from "@/lib/assessment/calculator";
import type { AssessmentInput } from "@/lib/assessment/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jwf:assessment-calc-strip-expanded";

interface AssessmentCalcStripProps {
  input: AssessmentInput;
  dishonestyFlag?: boolean;
  creditRiskFlag?: boolean;
  className?: string;
}

function fmt(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

export function AssessmentCalcStrip({
  input,
  dishonestyFlag,
  creditRiskFlag,
  className,
}: AssessmentCalcStripProps) {
  // Collapsed by default (plan §10). Read persisted state after mount to avoid
  // a hydration mismatch.
  const [expanded, setExpanded] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setExpanded(true);
    } catch {
      // localStorage unavailable
    }
    setMounted(true);
  }, []);

  const toggle = React.useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Digest figures for the collapsed strip. Guarded like CalculationDisplay's
  // "meaningful output" gate (annualFees > 0); otherwise show dashes.
  const digest = React.useMemo(() => {
    if (!input.annualFees || input.annualFees <= 0) {
      return { monthly: null, yearly: null, bursary: null, nextYearMonthly: null };
    }
    try {
      const o = calculateAssessment(input);
      return {
        monthly: o.payableFees.adjustedMonthlyPayableFees,
        yearly: o.payableFees.adjustedYearlyPayableFees,
        bursary: o.payableFees.bursaryAward,
        // Epic 07: next-year payable monthly (fee-uplift implication).
        nextYearMonthly: o.payableFees.nextYearMonthlyPayableFees,
      };
    } catch {
      return { monthly: null, yearly: null, bursary: null, nextYearMonthly: null };
    }
  }, [input]);

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      {/* Collapsed digest / toggle header */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={mounted ? expanded : false}
        aria-controls="assessment-calc-strip-body"
        className={cn(
          "flex w-full items-center justify-between gap-3 px-5 py-3 text-left",
          "transition-colors hover:bg-slate-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8862A] focus-visible:ring-offset-2",
          expanded && "border-b border-slate-100"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Calculator
            className="h-4 w-4 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <span className="shrink-0 text-sm font-semibold text-slate-700">
            Calculation
          </span>
          {/* One-line digest — always shown so the key numbers stay visible
              even while collapsed. */}
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-slate-500">
            <span className="whitespace-nowrap">
              Monthly{" "}
              <span className="font-mono font-semibold tabular-nums text-slate-700">
                {fmt(digest.monthly)}
              </span>
            </span>
            <span className="whitespace-nowrap">
              Yearly{" "}
              <span className="font-mono font-semibold tabular-nums text-slate-700">
                {fmt(digest.yearly)}
              </span>
            </span>
            <span className="whitespace-nowrap">
              Bursary{" "}
              <span className="font-mono font-semibold tabular-nums text-primary-900">
                {fmt(digest.bursary)}
              </span>
            </span>
            {digest.nextYearMonthly != null && (
              <span className="whitespace-nowrap">
                Next-Yr Monthly{" "}
                <span className="font-mono font-semibold tabular-nums text-slate-700">
                  {fmt(digest.nextYearMonthly)}
                </span>
              </span>
            )}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
          {expanded ? "Collapse" : "Expand"}
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {/* Full breakdown */}
      {mounted && expanded && (
        <div id="assessment-calc-strip-body" className="px-5 py-4">
          <CalculationDisplay
            input={input}
            dishonestyFlag={dishonestyFlag}
            creditRiskFlag={creditRiskFlag}
          />
        </div>
      )}
    </div>
  );
}
