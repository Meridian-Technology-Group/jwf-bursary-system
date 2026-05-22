# 13 — Stage 4 — Bursary impact

Backlink: [[README#Tab 2 — Running the assessment (the calculation engine)]]

Stage 4 is computed from Stages 1–3 plus the **Payable Fees** inputs.
The calculation sidebar shows it in real time; the figures land on the
recommendation tab and the export.

## Prerequisites

- Stages 1–3 substantially complete.
- *Annual School Fees* in Section A is non-zero — the
  `CalculationDisplay` shows placeholders otherwise.

## Steps

1. Expand **Section D. Payable Fees** ("Scholarship, VAT, and manual
   adjustments"). Enter:
   - **Scholarship Percentage (%)** — *"School scholarship applied
     before bursary (0–100)"*. Decimal allowed (step 0.5).
   - **VAT Rate (%)** — default 20.
   - **Manual Adjustment** — covered in [[14-apply-manual-adjustment]].
2. The right-hand **CalculationDisplay** Stage 4 panel now shows:
   - **Required Bursary** — `max(0, gross_fees - HNDI_after_NS - sibling_payable_fees)`.
   - **Gross Fees** — `annualFees × (1 - scholarshipPct/100)`.
   - **Bursary Award** — capped at gross fees.
   - **Net Yearly Fees** — `grossFees - bursaryAward`.
   - **VAT** — applied to net yearly fees at the configured rate.
   - **Yearly Payable Fees** — net + VAT, including any manual
     adjustment.
   - **Monthly Payable Fees** — yearly / 12.
3. Cross-check the sidebar values against the family's circumstances
   before saving.

## Verification

- The sidebar's bold *Yearly Payable Fees* and *Monthly Payable Fees*
  lines render once `annualFees > 0`.
- For sibling-linked applications, the sidebar shows a *Sibling
  payable fees absorbed* line — this is the sum of older siblings'
  yearly payable fees, deducted before bursary is calculated.

## Notes

- The full calculator lives in `src/lib/assessment/calculator.ts` (the
  pure TS function `calculateAssessment`). Use the unit tests as the
  canonical worked examples if a figure looks off.
- VAT applies to school fees per HMRC's 2025 rules; the rate is
  editable per-assessment in case of policy changes mid-round.
