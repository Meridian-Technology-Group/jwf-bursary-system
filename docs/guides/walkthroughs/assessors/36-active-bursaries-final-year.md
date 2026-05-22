# 36 — Active bursaries approaching final year

Backlink: [[README#Reports]]

List of bursary holders entering their final school years (Y12 / Y13)
so the foundation can plan succession (who replaces them in the
priority order for siblings, communication, etc.).

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- Bursary accounts in the system with a recorded entry year-group and
  active status.

## Steps

1. Open **Reports** (`/reports`).
2. Select the **Final-Year Bursaries** tab from the report tab strip.
   This report spans all rounds, so the round selector does not narrow
   it — every ACTIVE account in the final-year cohort is shown.
3. The table lists, final year (Y13) first then by reference:
   - Bursary account reference.
   - Child name (subject to the standard name-reveal audit gate).
   - School.
   - Entry year and current year group.
   - Years remaining (0 or 1 for this cohort).
   - Latest yearly payable fees (from the most recent recommendation).
   - Linked sibling count (excluding the account itself).
4. Use it to identify the Y12 / Y13 cohort and plan re-prioritisation
   of any linked siblings (see [[24-reorder-sibling-priority]]).

## Notes

- "Final year" is derived from the entry year-group (the source of
  truth), using the same formula as the assessment form: an account is
  in the cohort when `FINAL_SCHOOL_YEAR − currentYearGroup` is 0 or 1.
- The report sits alongside the other sections under `/reports`; pair
  it with [[37-sibling-bursary-summary]] for succession decisions.
