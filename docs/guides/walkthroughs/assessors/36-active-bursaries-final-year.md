# 36 — Active bursaries approaching final year

Backlink: [[README#Reports]]

List of bursary holders entering their final school years (Y12 / Y13)
so the foundation can plan succession (who replaces them in the
priority order for siblings, communication, etc.).

> **Note:** this report is **not yet implemented** in `/reports`
> today. The README spec'd it; tracking and implementation are
> backlog items. This guide describes the intended workflow so it can
> be wired up when the section ships.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- Bursary accounts in the system with a recorded entry year and
  active status.

## Steps (spec'd, pending implementation)

1. Open **Reports** (`/reports`).
2. Pick the round in the selector.
3. Locate the **Active bursaries approaching final year** section.
4. The table will list:
   - Bursary account reference.
   - Child name (subject to the standard name-reveal audit gate).
   - School.
   - Entry year and current school year.
   - Yearly payable fees (latest).
   - Linked sibling count (if any).
5. Filter to Y12 / Y13 to identify the cohort entering their final
   year.

## Manual workaround (today)

Until the report lands you can derive the cohort by:

1. Exporting the recommendation list for the current round
   (see [[30-export-recommendation-list]]).
2. Filtering the spreadsheet by *Entry Year* to find applications
   whose `13 - (currentAcademicYear - entryYear + 1)` is 0 or 1.
3. Cross-referencing with the sibling list on each application to
   plan re-prioritisation (see [[24-reorder-sibling-priority]]).

## Notes

- When this report ships it will live alongside the existing five
  report sections under `/reports`.
