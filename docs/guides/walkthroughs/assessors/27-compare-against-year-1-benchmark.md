# 27 — Compare against the year-1 benchmark

Backlink: [[README#Re-assessment (year 2+)]]

The first-year payable fees figure is stored on the bursary account
as `benchmarkPayableFees`. On re-assessments, the system surfaces it
and warns if the current year's calculation falls below it. The
benchmark is **advisory** — the assessor decides whether to honour it.

## Prerequisites

- A re-assessment is open (see [[26-open-a-reassessment]]).
- The bursary account has a `benchmarkPayableFees` value (set when the
  first assessment completed).

## Steps

1. On the **Assessment** tab, read the **First year benchmark** banner.
   Default (within benchmark) styling is info-blue; below-benchmark
   styling is amber.
2. The banner shows two lines:
   - *"First year benchmark: £X,XXX/year"* (monospace).
   - *"This is the payable fees figure established in the first year of
     the bursary. It serves as a reference floor for re-assessments."*
3. As you enter Stage 1–4 figures in the workspace, the live
   calculation feeds the banner. If the current year's *Yearly
   Payable Fees* is below the benchmark:
   - The banner flips to amber.
   - An inline advisory appears: *"Below first year level — Current
     yearly payable fees (£A,AAA) are £B below the first year
     benchmark. Review before finalising the assessment."*
4. Decide:
   - **Honour the benchmark** — apply a positive Manual Adjustment
     equal to the £ delta shown in the advisory; see
     [[14-apply-manual-adjustment]]. Record the reason e.g. *"Honouring
     year-1 benchmark per Foundation policy."*
   - **Allow the lower figure** — leave the adjustment at 0 and
     document the rationale in the Recommendation Summary
     ([[21-write-recommendation-narrative]]) and reason codes.
5. When the current year is **above or equal** to the benchmark, the
   banner stays info-blue and shows *"Current year: £A,AAA/year
   (`<delta>` above benchmark)"*.

## Verification

- The banner colour matches the current state (info-blue ≥ benchmark,
  amber < benchmark).
- The delta shown matches your manual adjustment when honouring the
  benchmark.

## Notes

- The benchmark is **never silently applied** — the calculation engine
  does not floor the result. It is purely a visual warning; honouring
  it requires an explicit Manual Adjustment.
- The benchmark itself is set once at the completion of the first
  year's assessment and rolls forward unchanged through subsequent
  years (`BursaryAccount.benchmarkPayableFees`).
