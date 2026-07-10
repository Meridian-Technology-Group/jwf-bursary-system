"use client";

/**
 * CALC-11 — "Benchmark Bands" settings tab: the six Appendix B/C.1–C.5
 * profiling band tables, each rendered via the shared `BandVersionSection`
 * (read-heavy table + duplicate-and-edit "create new version" dialog).
 */

import {
  BandVersionSection,
  type BandExtraFieldConfig,
} from "@/components/admin/settings/band-version-section";
import {
  createAffordabilityBandVersionAction,
  createIncomeCategoryBandVersionAction,
  createPropertyEquityBandVersionAction,
  createFinancialEquityBandVersionAction,
  createDebtRatioBandVersionAction,
  createLifestyleSqueezeBandVersionAction,
} from "@/app/(admin)/settings/actions";
import type {
  AffordabilityBandRow,
  IncomeCategoryBandRow,
  PropertyEquityBandRow,
  FinancialEquityBandRow,
  DebtRatioBandRow,
  LifestyleSqueezeBandRow,
} from "@/lib/db/queries/reference-tables";

interface BenchmarkBandsTabProps {
  affordabilityBands: AffordabilityBandRow[];
  incomeCategoryBands: IncomeCategoryBandRow[];
  propertyEquityBands: PropertyEquityBandRow[];
  financialEquityBands: FinancialEquityBandRow[];
  debtRatioBands: DebtRatioBandRow[];
  lifestyleSqueezeBands: LifestyleSqueezeBandRow[];
}

const AFFORDABILITY_EXTRA: BandExtraFieldConfig[] = [
  { key: "basePct", label: "Base % (category 1)", type: "number", width: "w-24" },
];

const INCOME_CATEGORY_EXTRA: BandExtraFieldConfig[] = [
  { key: "category", label: "Category", type: "number", width: "w-20" },
  { key: "feesBenchmarkPct", label: "Fees Benchmark %", type: "number", width: "w-24" },
];

const PROPERTY_EQUITY_EXTRA: BandExtraFieldConfig[] = [
  { key: "category", label: "Category", type: "number", width: "w-20" },
];

const FINANCIAL_EQUITY_EXTRA: BandExtraFieldConfig[] = [
  { key: "label", label: "Label", type: "text" },
];

const DEBT_RATIO_EXTRA: BandExtraFieldConfig[] = [
  { key: "minRepaymentMonths", label: "Min Repayment (months)", type: "nullableNumber", width: "w-32" },
  { key: "statusLabel", label: "Status Label", type: "text" },
];

const LIFESTYLE_SQUEEZE_EXTRA: BandExtraFieldConfig[] = [
  { key: "statusLabel", label: "Status Label", type: "text" },
];

export function BenchmarkBandsTab({
  affordabilityBands,
  incomeCategoryBands,
  propertyEquityBands,
  financialEquityBands,
  debtRatioBands,
  lifestyleSqueezeBands,
}: BenchmarkBandsTabProps) {
  return (
    <div className="space-y-8">
      <BandVersionSection
        title="Affordability Grid"
        description="Base % by net-income band (Appendix B) — category adjustment (base − 0.5 × (category − 1)) is applied by the engine, not stored here."
        floorKey="bandFloor"
        ceilingKey="bandCeiling"
        floorLabel="Income Floor (£)"
        ceilingLabel="Income Ceiling (£)"
        extraFields={AFFORDABILITY_EXTRA}
        rows={affordabilityBands}
        createVersionAction={createAffordabilityBandVersionAction}
      />

      <BandVersionSection
        title="Income Categories"
        description="Income category + fees-benchmark % by net-income band (Appendix C.1). Floor-inclusive, ceiling-exclusive at resolution time."
        floorKey="bandFloor"
        ceilingKey="bandCeiling"
        floorLabel="Income Floor (£)"
        ceilingLabel="Income Ceiling (£)"
        extraFields={INCOME_CATEGORY_EXTRA}
        rows={incomeCategoryBands}
        createVersionAction={createIncomeCategoryBandVersionAction}
      />

      <BandVersionSection
        title="Property Equity"
        description="Property-equity category by total equity band (Appendix C.2)."
        floorKey="bandFloor"
        ceilingKey="bandCeiling"
        floorLabel="Equity Floor (£)"
        ceilingLabel="Equity Ceiling (£)"
        extraFields={PROPERTY_EQUITY_EXTRA}
        rows={propertyEquityBands}
        createVersionAction={createPropertyEquityBandVersionAction}
      />

      <BandVersionSection
        title="Financial Equity"
        description="Financial-equity descriptive labels by band (Appendix C.3)."
        floorKey="bandFloor"
        ceilingKey="bandCeiling"
        floorLabel="Equity Floor (£)"
        ceilingLabel="Equity Ceiling (£)"
        extraFields={FINANCIAL_EQUITY_EXTRA}
        rows={financialEquityBands}
        createVersionAction={createFinancialEquityBandVersionAction}
      />

      <BandVersionSection
        title="Debt-Over-NDI Ratio"
        description="Debt status + minimum repayment period by debt-over-NDI ratio (Appendix C.4, normalised per CALC-A3)."
        floorKey="ratioFloor"
        ceilingKey="ratioCeiling"
        floorLabel="Ratio Floor"
        ceilingLabel="Ratio Ceiling"
        extraFields={DEBT_RATIO_EXTRA}
        rows={debtRatioBands}
        createVersionAction={createDebtRatioBandVersionAction}
      />

      <BandVersionSection
        title="Lifestyle Squeeze"
        description="Lifestyle-squeeze status label by squeeze ratio, expressed in percentage points (Appendix C.5)."
        floorKey="ratioFloor"
        ceilingKey="ratioCeiling"
        floorLabel="Ratio Floor (%)"
        ceilingLabel="Ratio Ceiling (%)"
        extraFields={LIFESTYLE_SQUEEZE_EXTRA}
        rows={lifestyleSqueezeBands}
        createVersionAction={createLifestyleSqueezeBandVersionAction}
      />
    </div>
  );
}
