---
title: Admin "Round Cockpit" — CRM-like situational awareness for rounds
status: open
severity: medium
area: admin-ux
opened: 2026-05-13
opened_by: brian
related:
  - ../../src/app/(admin)/rounds/page.tsx
  - ../../src/app/(admin)/rounds/[id]/page.tsx
  - ../../src/app/(admin)/admin/page.tsx
  - ../tdd/07-system-components.md
---

## Context

Today the admin UI treats a Round as a flat record: a status badge
(DRAFT/OPEN/CLOSED), a few count tiles, and a school breakdown table.
That's accurate but inert — it doesn't tell an admin **where the round
is in its lifecycle, what's stuck, what's slipping, or what needs them
right now**. A salesperson opening a CRM gets that read in seconds; a
JWF assessor opening `/rounds/[id]` does not.

The data to power a richer experience already exists — every signal
below is derivable from current Prisma models via queries already in
`src/lib/db/queries/` (reports, exports, invitations, reassessment). No
schema change needed.

## Why it matters

A round runs ~3 months and processes 100–200 applications across two
schools, with a hard close date and several handoff points (invite →
submit → assess → recommend → decide → export). The cost of poor
situational awareness shows up as:

- Stalled assessments discovered late (after the close date).
- Pending invitations no one chased.
- Recommendations sitting undecided right before export.
- No felt sense of "are we on track to close in time?"

With only 1–3 assessors running the cycle, a single missed signal can
mean a family's award is delayed.

## Proposed approach

**Mental model:** "Round Cockpit" for the single active round, "Season
Ledger" for `/rounds`. Reject "dashboard" (passive), "kanban" (the
queue is already one), "pipeline" (implies parallel deals; only one
round is live).

**`/rounds` (Season Ledger)** — hero card for the OPEN round dominates;
DRAFT prompts below; CLOSED rounds collapse to compact ledger rows.
Replace today's table.

**`/rounds/[id]` (Cockpit)** — replace the 6 cards with:

- **Stage strip** in the header: 7 nodes (Setup → Invitations Sent →
  Submissions Open → Assessment → Decision → Export → Closed), each
  in one of {not-yet, live, complete, live-but-blocked}. Status
  instrument, not a navigation control.
- **Needs Attention lane** (top-left): ranked watchlist of 8 aging /
  SLA rules. Each row: icon · count · plain-English description ·
  linked drill-in. Empty state = "All clear."
  1. Invitations pending >14d
  2. Reassessment invites expiring <48h
  3. Submitted apps missing required docs
  4. Assessments paused >7d
  5. Assessments stalled (in-progress, no audit event >5d)
  6. Recommendations awaiting outcome >3d
  7. Recommendation complete but not exported
  8. Close approaching <7d with >10 undecided
- **Pipeline tiles** (4): Invited / Submitted / In Assessment /
  Decided. Each tile drills to `/queue?roundId=…&status=…`. Filter
  state round-trips via URL + sessionStorage.
- **Time & Progress:** day-N-of-M, days to close, decisions/day
  required to clear the backlog.
- **Outcomes:** stacked bar of qualifies / DNQ, with a
  `<DeltaBadge>` showing % change vs prior round.
- **School split:** keep the existing breakdown but show stage
  counts per school, not totals.
- **Export readiness:** per-school progress + per-school export
  buttons.
- **Activity feed:** existing component, unchanged.

**Cross-round:** inline `<DeltaBadge>` on headline numbers ("▲ +12%
vs 2025/26"). No separate YoY tab — full comparison stays in
`/reports`. Closed rounds render the same layout, all-checked strip,
muted styling, actions replaced by "Export archive" / "View report."

**New components:** `RoundStageStrip`, `NeedsAttentionLane`,
`RoundProgressGauge`, `ExportReadinessPanel`, `ActiveRoundHero`,
`RoundLedgerRow`, `DeltaBadge`. **New query:**
`src/lib/db/queries/round-watchlist.ts` exposing
`getRoundWatchlist(roundId)` to run all 8 rules in one batch.

**Reuse:** `StatTile` (extended with `delta` + `subCounts`),
`RoundStatusBadge`, shadcn `Progress`/`Card`/`Alert`, the recharts
stacked bar already used in `/reports`, the existing dashboard
activity feed.

A fuller working document with ASCII layout, reuse-vs-build matrix,
and anti-patterns lives at
`~/.claude/plans/use-your-ui-and-or-vivid-moth.md` (out-of-repo
scratchpad).

## Out of scope

- Schema changes — every signal is derivable from existing models.
- Making watchlist thresholds (14d / 7d / 5d / 3d / 48h) configurable
  in Settings. Hard-code defaults first; revisit if real-world data
  shows them wrong.
- Deciding whether `/admin` is deleted, redirects to the cockpit, or
  stays as a neutral landing. Defer until the cockpit exists.
- Stage strip clickability — it's deliberately a status instrument,
  not navigation, to keep affordances unambiguous.
- Longitudinal cross-round analytics beyond the inline delta badge —
  full comparison stays in `/reports`.
