# 34 — Property category distribution

Backlink: [[README#Reports]]

Count of applications per property category (1–12). The Foundation's
£750K threshold sits between categories — typically category 8–9 —
and is worth scrutinising when reviewing the chart.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- A round with recommendations that have a saved property category.

## Steps

1. Open **Reports** (`/reports`).
2. Pick the round in the selector.
3. Jump to or scroll to the **Property Categories** card. Strapline:
   *"Distribution of applicants by property ownership category."*
4. The horizontal bar chart renders one bar per category that has at
   least one application. Labels read `Category 1`, `Category 2`, …
5. Hover any bar for count and percentage.

## Verification

- Sum of bar counts equals the count of saved recommendations with a
  non-null `propertyCategory`.
- Empty state *"No data for this round yet"* when zero rows.

## Notes

- The recommendation form raises an amber **High Property Category**
  banner for category > 8 (see [[15-property-category-and-flags]]).
  Categories 9–12 in this report correspond to that threshold; the
  £750K policy line typically sits inside this range.
- Re-categorisation: if a recommendation's property category looks
  wrong, open the recommendation, change the value, and save. The
  report updates on next render.
