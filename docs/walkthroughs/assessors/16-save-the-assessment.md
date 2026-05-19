# 16 — Save the assessment

Backlink: [[README#Tab 2 — Running the assessment (the calculation engine)]]

The assessment form auto-saves on every blur (debounced 300 ms) and
also exposes explicit **Save**, **Pause**, and **Complete** buttons in
the status bar.

## Prerequisites

- The workspace is open and the assessment has been started.

## Steps

1. Top of the form: the **status bar** shows
   - The status chip (**In Progress** grey / **Paused** amber /
     **Completed** green).
   - The *Saved hh:mm:ss* indicator (last successful save).
   - Three action buttons (when not read-only):
     - **Save** — manual flush of the form to the server via
       `saveAssessmentAction`.
     - **Pause** — saves first, then transitions the assessment to
       `PAUSED` (mirrors *"Request Missing Documents"* on the actions
       bar, without sending an email).
     - **Complete** — saves, then transitions to `COMPLETED`; disabled
       while `annualFees === 0`.
2. To save without changing status, click **Save**. The button shows
   *"Saving…"*; the *Saved* indicator updates on success.
3. To complete: click **Complete**. The status chip flips to
   **Completed** (green) and the entire form becomes read-only.
4. On completion the assessment becomes the source for the
   **Recommendation** tab; the latest snapshot of payable fees lands
   on the bursary account as `latestPayableFees`.

## What is persisted

`saveAssessmentAction` writes:
- Section A: `familyTypeCategory`, `notionalRent`, `utilityCosts`,
  `foodCosts`, `annualFees`, `councilTax`, `schoolingYearsRemaining`.
- Section B: two `Earner` rows (Parent 1 + Parent 2) with full income
  components.
- Section C: a single `AssessmentProperty` row.
- Section D: `scholarshipPct`, `vatRate`, `manualAdjustment`,
  `manualAdjustmentReason`.
- Section E: `dishonestyFlag`, `creditRiskFlag`.
- Plus a snapshot of the calculator outputs
  (`totalHouseholdNetIncome`, `netAssetsYearlyValuation`, `hndiAfterNs`,
  `requiredBursary`, `grossFees`, `bursaryAward`, `netYearlyFees`,
  `yearlyPayableFees`, `monthlyPayableFees`) — **the post-adjustment
  values** are written into the payable-fee columns.

## Verification

- Hard-refresh the page; the form re-hydrates with every entered
  figure intact.
- For `COMPLETED` assessments, the **Recommendation** tab unlocks
  (otherwise it shows the gate *"Assessment must be completed first"*).

## Troubleshooting

- **"Complete" disabled** — `Annual School Fees` is still 0; enter
  the school's annual fees in Section A.
- **Save error banner** — the red triangle in the status bar shows the
  server-side error from `saveAssessmentAction`. Common causes: RLS
  denial (you are no longer assigned), validation failure on a
  Decimal field. Refresh and check session.
