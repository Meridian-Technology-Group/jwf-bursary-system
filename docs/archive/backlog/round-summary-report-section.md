---
title: Add a dedicated "Round Summary" report section to /reports
status: wont-do
severity: low
area: reporting
opened: 2026-05-22
opened_by: Brian Wagner (via Claude, during user-guide authoring)
related:
  - src/app/(admin)/reports/page.tsx (SECTIONS tab strip)
  - src/lib/db/queries/reports.ts
  - docs/guides/walkthroughs/assessors/31-round-summary.md
  - docs/product/prd/09-reporting-and-export.md (RP requirements)
---

## Context

While writing the admin/assessor guide we audited `/reports` against the
walkthrough/PRD report inventory. **Most reports the docs imply already
exist** — the live tab strip has seven sections: Award Distribution,
School Comparison, Income Bands, Property Categories, Reason Codes,
**Final-Year Bursaries**, and **Sibling Summary**. (Walkthroughs 36 and
37 wrongly said the last two were "not yet implemented"; that was stale
and has been corrected.)

The **one** report named in the spec that has **no dedicated `/reports`
section** is a standalone **Round Summary**: total applications for a
single round, broken down by status, by outcome, and by school —
matching walkthrough `31-round-summary.md` and the README intent.

## Why it matters

Low. The information is already obtainable today:

- **School Comparison** gives per-school totals for the selected round.
- The **queue status filters** (`/queue?roundId=…&status=…`) give counts
  by status.
- The **`/admin` dashboard** tiles show round-level status counts.

So this is a convenience/consolidation gap, not a missing capability.
The cost of not doing it is that an assessor wanting a single "where is
this round" snapshot has to read it from two or three places.

## Proposed approach

1. Add a `getRoundSummary(tx, roundId)` query to
   `src/lib/db/queries/reports.ts` returning totals by status, by
   outcome, and by school for the round.
2. Add a `round-summary` entry to the `SECTIONS` tab strip in
   `src/app/(admin)/reports/page.tsx` and render a compact card/table.
   Unlike Final-Year/Sibling, this report **is** round-scoped — wire it
   to the existing round selector.
3. Update walkthrough `31-round-summary.md` (currently accurate in
   noting no dedicated section exists) once it ships.

If the `/admin` dashboard + School Comparison are judged sufficient,
this can equally be closed as `won't-do` — flag for owner decision.

## Out of scope

- Cross-round / longitudinal summaries (covered by the other report
  sections and the inline deltas discussed in the round-cockpit item).

## Resolution — closed won't-do (2026-05-24)

Round situational awareness is absorbed by the deferred #18 Round Cockpit; a
standalone round-summary report would likely be discarded when #18 lands. Decided
to close rather than build now. Revisit only if #18 is descoped.
