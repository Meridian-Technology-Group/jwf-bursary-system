# 37 — Sibling bursary summary

Backlink: [[README#Reports]]

Families with two or more linked bursary accounts, with combined
totals (number of children, combined yearly payable fees, combined
bursary award).

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- Sibling links exist (see [[23-link-siblings]]).

## Steps

1. Open **Reports** (`/reports`).
2. Select the **Sibling Summary** tab from the report tab strip. This
   report spans all rounds, so the round selector does not narrow it.
   Single-child family groups are excluded — only families with two or
   more linked accounts appear.
3. The table groups rows by `FamilyGroup`, showing per family:
   - Family group reference / ID.
   - Children count (linked siblings).
   - Child names + school + reference (subject to name-reveal audit).
   - Combined yearly payable fees (sum of each account's latest
     recommendation).
   - Combined bursary award (sum across siblings).
4. Sort by combined bursary award to spot the highest-cost families.

## Notes

- Linked families inherit sibling-aware calculations automatically —
  the report is an after-the-fact summary, not a calculation step.
- Per-child figures come from each account's most recent
  recommendation. Pair this with [[36-active-bursaries-final-year]] for
  succession decisions.
