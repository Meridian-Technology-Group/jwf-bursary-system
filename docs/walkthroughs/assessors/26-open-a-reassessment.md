# 26 — Open a re-assessment

Backlink: [[README#Re-assessment (year 2+)]]

Re-assessments are second-or-later-year applications for the same
`BursaryAccount`. The detail view surfaces prior-year data and the
year-1 benchmark for direct comparison.

## Prerequisites

- The applicant was invited via the batch re-assessment flow (see
  [[../admins/11-batch-reassessment-invitations]]) or by an internal
  request that re-uses an existing `bursaryAccount`.
- The applicant has submitted the new application (status `SUBMITTED`).

## Steps

1. From `/queue`, identify re-assessment applications by the orange
   **Re-assessment** chip in the header card (`isReassessment ===
   true`).
2. Open the application (see [[02-open-an-application]]). The header
   shows the **Re-assessment** pill alongside the school and round
   information.
3. Switch to the **Assessment** tab. **Before** the workspace renders,
   two extra panels appear at the top:
   - **First year benchmark** banner (`BenchmarkDisplay`) — see
     [[27-compare-against-year-1-benchmark]]. Reads e.g.
     *"First year benchmark: £4,200/year — This is the payable fees
     figure established in the first year of the bursary…"*
   - **Year-on-Year Comparison** table (`YearComparison`) — eight
     rows showing the previous year's figures against the current
     year, with up/down trend icons and red/green colour coding.
4. Below those panels sits the standard split-screen workspace.
   Click **Begin Assessment** as usual (or if already started, the
   form is already open).

## Verification

- The header pill **Re-assessment** is present.
- The Year-on-Year table's header reads
  *"Previous application: `<reference>` (`<prior academic year>`)"*.
- If no previous assessment exists despite `isReassessment === true`,
  the comparison panel falls back to *"No previous year assessment
  data available for comparison."*

## Notes

- The applicant data tab works exactly the same on a re-assessment;
  it shows the current submission only. Cross-reference prior-year
  data via the previous application's record under the same bursary
  account (visible through the sibling link or the bursary account
  history).
- Re-assessments must still pick reason codes
  ([[20-select-reason-codes]]) to justify the change (or no change)
  vs. year 1.
