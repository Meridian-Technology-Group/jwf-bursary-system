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
  createDebtShortfallBandVersionAction,
  createLifestyleSqueezeBandVersionAction,
} from "@/app/(admin)/settings/actions";
import type {
  AffordabilityBandRow,
  IncomeCategoryBandRow,
  PropertyEquityBandRow,
  FinancialEquityBandRow,
  DebtRatioBandRow,
  DebtShortfallBandRow,
  LifestyleSqueezeBandRow,
} from "@/lib/db/queries/reference-tables";

/**
 * Her five contexts, labelled the way her spreadsheet describes each table so
 * the settings page and her own workbook read the same.
 */
const DEBT_SAVINGS_CONTEXT_LABELS = [
  { context: "NO_DEBT_NO_SAVINGS", label: "no debt, no savings" },
  { context: "NO_DEBT_WITH_SAVINGS", label: "no debt, with savings" },
  { context: "DEBT_NO_SAVINGS", label: "debt, no savings" },
  { context: "DEBT_SAVINGS_BELOW_DEBT", label: "debt above savings" },
  { context: "DEBT_SAVINGS_ABOVE_DEBT", label: "savings above debt" },
] as const;

interface BenchmarkBandsTabProps {
  affordabilityBands: AffordabilityBandRow[];
  incomeCategoryBands: IncomeCategoryBandRow[];
  propertyEquityBands: PropertyEquityBandRow[];
  financialEquityBands: FinancialEquityBandRow[];
  debtRatioBands: DebtRatioBandRow[];
  debtShortfallBands: DebtShortfallBandRow[];
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

// 6 Sep 2026 respec — the repayment-months column is GONE from this table:
// the figure is computed per assessment (((total debt − total savings) / NDI)
// × 12, `minRepaymentMonthsWithoutFees`), never stored per band.
const DEBT_RATIO_EXTRA: BandExtraFieldConfig[] = [
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
  debtShortfallBands,
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

      {/* Charlotte's ten Part 5 tables (10 Sep 2026): the debt-status and
          lifestyle-squeeze ladders exist once per household context. Rendered
          as one section each, because they are versioned independently and a
          single mixed list would both read as five duplicate ladders and fail
          the band-overlap check on save. */}
      {DEBT_SAVINGS_CONTEXT_LABELS.map(({ context, label }) => (
        <BandVersionSection
          key={`debt-${context}`}
          title={`Debt-Over-NDI Ratio — ${label}`}
          description="Debt status by debt-over-NDI ratio (Appendix C.4). Applies to households in this debt and savings position."
          floorKey="ratioFloor"
          ceilingKey="ratioCeiling"
          floorLabel="Ratio Floor"
          ceilingLabel="Ratio Ceiling"
          extraFields={DEBT_RATIO_EXTRA}
          rows={debtRatioBands.filter((b) => b.debtSavingsContext === context)}
          debtSavingsContext={context}
          createVersionAction={createDebtRatioBandVersionAction}
        />
      ))}

      {DEBT_SAVINGS_CONTEXT_LABELS.map(({ context, label }) => (
        <BandVersionSection
          key={`lifestyle-${context}`}
          title={`Lifestyle Squeeze — ${label}`}
          description="Lifestyle-squeeze status label by squeeze ratio, in percentage points (Appendix C.5). Applies to households in this debt and savings position."
          floorKey="ratioFloor"
          ceilingKey="ratioCeiling"
          floorLabel="Ratio Floor (%)"
          ceilingLabel="Ratio Ceiling (%)"
          extraFields={LIFESTYLE_SQUEEZE_EXTRA}
          rows={lifestyleSqueezeBands.filter((b) => b.debtSavingsContext === context)}
          debtSavingsContext={context}
          createVersionAction={createLifestyleSqueezeBandVersionAction}
        />
      ))}

      {/* Charlotte, 11 Sep 2026 — the table used INSTEAD of the ratio when a
          household cannot cover its yearly repayment out of disposable income.
          Its bounds are in £, and unlike the ratio ladders they are
          floor-inclusive and ceiling-exclusive, which is how she wrote them. */}
      <BandVersionSection
        title="Debt status — shortfall against yearly repayment"
        description="Used instead of the debt-over-NDI ratio when NDI after notional spend is below the yearly repayment (total debt / 5). Keyed on the shortfall in £."
        floorKey="floorGbp"
        ceilingKey="ceilingGbp"
        floorLabel="Shortfall from (£)"
        ceilingLabel="Shortfall to (£)"
        extraFields={DEBT_RATIO_EXTRA}
        rows={debtShortfallBands}
        createVersionAction={createDebtShortfallBandVersionAction}
      />
    </div>
  );
}
