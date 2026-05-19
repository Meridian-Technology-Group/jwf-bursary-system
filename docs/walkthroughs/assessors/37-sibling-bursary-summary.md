# 37 — Sibling bursary summary

Backlink: [[README#Reports]]

Families with two or more linked bursary accounts, with combined
totals (number of children, combined yearly payable fees, combined
bursary award).

> **Note:** this report is **not yet implemented** in `/reports`
> today. The README spec'd it; tracking and implementation are
> backlog items. This guide describes the intended workflow.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- Sibling links exist (see [[23-link-siblings]]).

## Steps (spec'd, pending implementation)

1. Open **Reports** (`/reports`).
2. Pick the round in the selector.
3. Locate the **Sibling bursary summary** section.
4. The table will group rows by `FamilyGroup`, showing per family:
   - Family group reference / ID.
   - Children count (linked siblings).
   - List of child names + school + reference (subject to name-reveal
     audit).
   - Combined yearly payable fees (sum across siblings).
   - Combined bursary award (sum across siblings).
5. Sort by combined bursary award to spot the highest-cost families.

## Manual workaround (today)

Until the report lands you can:

1. Open each multi-child family's primary application and check the
   **Linked Siblings** card on the Applicant Data tab — see
   [[23-link-siblings]].
2. Export the recommendation list ([[30-export-recommendation-list]])
   and aggregate by family group manually in Excel (group by
   `bursaryAccountId` / reference prefix).

## Notes

- Linked families inherit sibling-aware calculations automatically —
  the report is an after-the-fact summary, not a calculation step.
- When this report ships, treat it as the planning view alongside
  [[36-active-bursaries-final-year]] for succession decisions.
