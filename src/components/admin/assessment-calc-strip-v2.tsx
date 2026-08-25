"use client";

/**
 * CALC-07 — v2 live calculation strip.
 *
 * Sibling to `assessment-calc-strip.tsx` (v1 untouched). Renders the full
 * notional-model output the v2 hook computes: household net income, total
 * notional spend, NDI-after-notional-spend, and the THREE award legs (actual /
 * theoretical / affordability-adjusted) with the MIN highlighted — that min is
 * `recommendedPayableFees`. Below the legs, a display-only profiling strip
 * (income / property / equity / financial categories, debt status, lifestyle
 * squeeze). Collapsible + persisted, matching the v1 strip's UX.
 *
 * Pure presentation — it takes the already-computed `AssessmentV2Output` (or
 * `null` while awaiting data); the calculation itself lives in the form's hook.
 */

import * as React from "react";
import { ChevronDown, ChevronUp, Calculator, Minus } from "lucide-react";
import type { AssessmentV2Output } from "@/lib/assessment/v2/orchestrator";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jwf:assessment-calc-strip-v2-expanded";

function fmt(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

interface AssessmentCalcStripV2Props {
  output: AssessmentV2Output | null;
  /** Appendix A SAVINGS_CUSHION for the selected family category — shown for context. */
  savingsCushion?: number | null;
  className?: string;
}

function Row({
  label,
  value,
  bold,
  highlight,
  sub,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
  sub?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-2 py-1.5",
        sub && "pl-3",
        highlight && "-mx-2 rounded-md bg-primary-50 px-2 py-2"
      )}
    >
      <span
        className={cn(
          "text-xs leading-snug",
          sub ? "text-slate-400" : "text-slate-600",
          bold && "font-semibold text-slate-700"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-xs tabular-nums text-slate-700",
          bold && "text-sm font-bold",
          highlight && "font-bold text-primary-900"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 pt-3 first:pt-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</span>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  );
}

export function AssessmentCalcStripV2({ output, savingsCushion, className }: AssessmentCalcStripV2Props) {
  const [expanded, setExpanded] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setExpanded(true);
    } catch {
      /* localStorage unavailable */
    }
    setMounted(true);
  }, []);

  const toggle = React.useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Which of the three legs is the min (== recommendedPayableFees before the £0 floor)?
  const legs = output
    ? ([
        { key: "actual", label: "Actual remaining DI", value: output.actualRemainingDi },
        { key: "theoretical", label: "Theoretical benchmark DI", value: output.theoreticalBenchmarkDi },
        { key: "affordability", label: "Affordability-adjusted DI", value: output.affordabilityAdjustedDi },
      ] as const)
    : [];
  const minValue = legs.length > 0 ? Math.min(...legs.map((l) => l.value)) : null;

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={mounted ? expanded : false}
        aria-controls="assessment-calc-strip-v2-body"
        className={cn(
          "flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8862A] focus-visible:ring-offset-2",
          expanded && "border-b border-slate-100"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Calculator className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="shrink-0 text-sm font-semibold text-slate-700">Calculation (v2)</span>
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-slate-500">
            <span className="whitespace-nowrap">
              Net income{" "}
              <span className="font-mono font-semibold tabular-nums text-slate-700">
                {fmt(output?.householdNetIncome)}
              </span>
            </span>
            <span className="whitespace-nowrap">
              NDI{" "}
              <span className="font-mono font-semibold tabular-nums text-slate-700">
                {fmt(output?.ndiAfterNotionalSpend)}
              </span>
            </span>
            <span className="whitespace-nowrap">
              Recommended payable{" "}
              <span className="font-mono font-semibold tabular-nums text-primary-900">
                {fmt(output?.recommendedPayableFees)}
              </span>
            </span>
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

      {mounted && expanded && (
        <div id="assessment-calc-strip-v2-body" className="px-5 py-4">
          {!output ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Minus className="h-7 w-7 text-slate-200" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-400">Awaiting data entry</p>
              <p className="text-xs text-slate-300">Enter income and fees to see results</p>
            </div>
          ) : (
            <>
              <SectionHeader title="Income & notional spend" />
              {/* Epic 13 / C2 — when an adjustment is in play the household
                  figure is shown as earners + adjustment so the number is
                  never unexplained. With no adjustment the strip reads exactly
                  as it did before. */}
              {output.manualAdjustment !== 0 && (
                <>
                  <Row label="Earner income subtotal" value={fmt(output.earnerAggregateIncome)} sub />
                  <Row
                    label="Manual income adjustment"
                    value={`${output.manualAdjustment > 0 ? "+" : "−"}${fmt(Math.abs(output.manualAdjustment))}`}
                    sub
                  />
                </>
              )}
              <Row label="Household net income (C40)" value={fmt(output.householdNetIncome)} bold />
              <Row label="Total notional spend (C85)" value={fmt(output.totalNotionalSpend)} />
              <Row label="Savings-test number (C80)" value={fmt(output.savingsTestNumber)} sub />
              {savingsCushion != null && (
                <Row label="Savings cushion allowance" value={fmt(savingsCushion)} sub />
              )}
              <Row label="NDI after notional spend (C87)" value={fmt(output.ndiAfterNotionalSpend)} bold />

              <SectionHeader title="Award legs — min is recommended" />
              {legs.map((leg) => (
                <Row
                  key={leg.key}
                  label={leg.label}
                  value={fmt(leg.value)}
                  highlight={minValue != null && leg.value === minValue}
                />
              ))}
              <div className="mt-3 flex items-baseline justify-between rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
                <span className="text-xs font-semibold text-primary-700">
                  Recommended payable fees (C160)
                </span>
                <span className="font-mono text-base font-bold text-primary-900">
                  {fmt(output.recommendedPayableFees)}
                </span>
              </div>

              <SectionHeader title="Profiling" />
              <Row label="Income category" value={output.incomeCategory?.toString() ?? "—"} />
              <Row label="Property category" value={output.propertyCategoryDerived?.toString() ?? "—"} />
              <Row
                label="Property equity category"
                value={output.propertyEquityCategory?.toString() ?? "—"}
              />
              <Row label="Financial equity" value={output.financialEquityLabel ?? "—"} />
              <Row label="Debt status" value={output.debtStatusLabel ?? "—"} />
              <Row
                label="Lifestyle squeeze"
                value={
                  // CH-42 — `squeezeRatio` is ALREADY in whole percentage
                  // points (`profiling.ts`: "100 = 100%"), so the old × 100
                  // here rendered 76.31% as "7631%". This is the diagnostic
                  // view, so it keeps the figure; the summary panel shows the
                  // status alone, per Charlotte.
                  output.lifestyleSqueezeRatio != null
                    ? `${output.lifestyleSqueezeRatio.toFixed(0)}% — ${output.lifestyleSqueezeLabel ?? "—"}`
                    : output.lifestyleSqueezeLabel ?? "—"
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
