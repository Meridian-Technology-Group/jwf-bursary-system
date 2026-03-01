"use client";

/**
 * Live assessment calculation hook.
 *
 * Takes all form values and runs calculateAssessment() on every change,
 * debounced at 150ms. Returns StageResults + PayableFeesResult.
 *
 * Runs entirely client-side — no network requests.
 */

import * as React from "react";
import { calculateAssessment } from "@/lib/assessment/calculator";
import type {
  AssessmentInput,
  AssessmentOutput,
  EarnerInput,
} from "@/lib/assessment/types";

// ─── Form value shape (mirroring what the form manages) ───────────────────────

export interface EarnerFormValues {
  earnerLabel: "PARENT_1" | "PARENT_2";
  employmentStatus: EarnerInput["employmentStatus"];
  netPay: number;
  netDividends: number;
  netSelfEmployedProfit: number;
  pensionAmount: number;
  benefitsIncluded: number;
  benefitsExcluded: number;
}

export interface AssessmentFormValues {
  familyTypeCategory: number;
  notionalRent: number;
  utilityCosts: number;
  foodCosts: number;
  annualFees: number;
  councilTax: number;
  schoolingYearsRemaining: number;
  scholarshipPct: number;
  vatRate: number;
  manualAdjustment: number;
  isMortgageFree: boolean;
  additionalPropertyIncome: number;
  cashSavings: number;
  isasPepsShares: number;
  schoolAgeChildrenCount: number;
  siblingPayableFees: number[];
  earners: EarnerFormValues[];
}

// ─── Default empty output ─────────────────────────────────────────────────────

const EMPTY_OUTPUT: AssessmentOutput = {
  stages: {
    stage1_totalHouseholdNetIncome: 0,
    stage2_netAssetsYearlyValuation: 0,
    stage3_hndiAfterNS: 0,
    stage4_requiredBursary: 0,
  },
  payableFees: {
    grossFees: 0,
    scholarshipDeduction: 0,
    bursaryAward: 0,
    netYearlyFees: 0,
    vatAmount: 0,
    yearlyPayableFees: 0,
    monthlyPayableFees: 0,
    adjustedYearlyPayableFees: 0,
    adjustedMonthlyPayableFees: 0,
  },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Runs the full assessment calculation on every form value change.
 * Debounced at 150ms to avoid excessive computation on rapid keystroke input.
 */
export function useAssessmentCalculation(
  values: AssessmentFormValues
): AssessmentOutput {
  const [output, setOutput] = React.useState<AssessmentOutput>(EMPTY_OUTPUT);

  // Stable reference for the timeout
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Serialise values for the dependency check
  const valuesKey = JSON.stringify(values);

  React.useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      try {
        const input: AssessmentInput = {
          earners: values.earners.map((e) => ({
            earnerLabel: e.earnerLabel,
            employmentStatus: e.employmentStatus,
            netPay: e.netPay,
            netDividends: e.netDividends,
            netSelfEmployedProfit: e.netSelfEmployedProfit,
            pensionAmount: e.pensionAmount,
            benefitsIncluded: e.benefitsIncluded,
            benefitsExcluded: e.benefitsExcluded,
          })),
          familyTypeCategory: values.familyTypeCategory,
          notionalRent: values.notionalRent,
          utilityCosts: values.utilityCosts,
          foodCosts: values.foodCosts,
          annualFees: values.annualFees,
          councilTax: values.councilTax,
          schoolingYearsRemaining: values.schoolingYearsRemaining,
          isMortgageFree: values.isMortgageFree,
          additionalPropertyIncome: values.additionalPropertyIncome,
          cashSavings: values.cashSavings,
          isasPepsShares: values.isasPepsShares,
          schoolAgeChildrenCount: values.schoolAgeChildrenCount,
          scholarshipPct: values.scholarshipPct,
          vatRate: values.vatRate,
          manualAdjustment: values.manualAdjustment,
          siblingPayableFees: values.siblingPayableFees,
        };

        const result = calculateAssessment(input);
        setOutput(result);
      } catch (err) {
        console.error("[useAssessmentCalculation] Calculation error:", err);
        setOutput(EMPTY_OUTPUT);
      }
    }, 150);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey]);

  return output;
}
