---
title: "Epic 21 — follow-ups found while building (not in the £1,100)"
status: open
opened: 2026-10-13
opened_by: Brian Wagner
depends_on:
  - ./epic-21-implementation-plan.md
---

# Epic 21 — follow-ups

Found during the sprint, outside its scope (plan §8). Licence fixes are free, but they go in a separate PR so the Phase 4 tranches stay reviewable.

## From T2 (gap ranking and adjusted gap)

Mislabels: the v2 calculation stores the bursary award in **£**, but three places still treat it as a **%**. These are licence fixes, size S each, and fit in one PR.

- **Export header.** The export column is headed "Bursary Award (%)" with number format `0.00` (`src/lib/export/xlsx.ts`, the `bursaryAward` column). On v2 rows the value is £. Rename it "Bursary Award (£)" and give it the currency format. Check first that no v1 rows remain in an exported round.
- **Award distribution.** `getAwardDistribution` (`src/lib/db/queries/reports.ts`) buckets the £ award into 0–100% bands. Rebase it on award ÷ gross fees, or band it in £.
- **School comparison.** `SchoolCard` on Reports shows "Avg bursary award" with a `%` suffix, but averages £ values.

## From T3/T4 (admin payable-fees table and schedule controls) — FIXED 13 Oct

Cosmetic, licence, fixed on `fix/schedule-labels-and-badge`:
- **"This year" badge wrapped** under the academic year in the admin payable-fees table and the Applicant Data schedule grid. The cell and the badge no longer wrap.
- **"Add a year" vs "Add year" were confusable.** The schedule button "Add a year" (T4) sat on the same page as the pre-system history "Add year", which adds a manual history row. The pre-system button now reads **"Add pre-system row"**. The schedule dialog's confirm button reads "Add a year", matching the button that opens it.
