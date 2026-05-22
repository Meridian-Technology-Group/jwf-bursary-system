# 33 — Income distribution

Backlink: [[README#Reports]]

Histogram of household net income across assessed applications in the
selected round.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- A round with at least one assessed application.

## Steps

1. Open **Reports** (`/reports`).
2. Pick the round in the selector.
3. Jump to or scroll to the **Income Bands** card. Strapline:
   *"Distribution of household net income across assessed
   applications."*
4. The horizontal bar chart breaks the population into income bands
   computed from `Assessment.totalHouseholdNetIncome`. Bands include
   counts and percentages.

## Verification

- Each bar shows a count; the chart's footer (legend / hover) shows
  the percentage of the round total.
- Empty state *"No data for this round yet"* appears when zero
  assessments exist.

## Notes

- The income figure plotted is the calculated household net income,
  not the applicant's declared total. For the underlying definition,
  see `src/lib/assessment/stage1-income.ts`.
- The bands themselves are defined in
  `src/lib/db/queries/reports.ts → getIncomeBandDistribution`; review
  there if a band feels wrong for your population.
