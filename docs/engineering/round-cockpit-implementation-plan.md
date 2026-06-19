# Round Cockpit (#18) — Implementation Plan

> Build-ready engineering plan for the backlog epic
> [`admin-round-cockpit-concept`](../backlog/admin-round-cockpit-concept.md)
> (#18). Authored 2026-05-25. The backlog file + the UX scratchpad remain the
> source of truth for visual intent; this document sequences the build into
> shippable PRs and records the **code-grounded findings** that correct the
> concept's "no schema change, everything derivable" assumption.

## TL;DR

Rebuild `/rounds` (Season Ledger) and `/rounds/[id]` (Cockpit) to give admins
CRM-like situational awareness: a stage strip, a ranked Needs-Attention lane (8
rules), pipeline tiles that actually drill into a filtered `/queue`, time/
progress, outcomes with year-on-year deltas, per-school split, and export
readiness.

**Six staged PRs.** The riskiest piece is **not** RLS (this is admin-only, full
access) — it's the **`getRoundWatchlist` aggregator**, which derives several
"stuck/stalled" signals from `AuditLog` timestamps rather than dedicated
columns. **No Prisma migration is required**; the one write-side gap (exports
are recorded nowhere) is closed by logging an audit row on export.

---

## Locked decisions (owner, 2026-05-25)

1. **Rule 7 export tracking → AuditLog (lightest).** No new column/table. Add a
   `RECOMMENDATION_EXPORT` audit action written by the export route.
2. **Rule 5 reinterpreted.** `AssessmentStatus` has no `IN_PROGRESS` (only
   `NOT_STARTED | PAUSED | COMPLETED`). "Stalled" = an assessment exists, is
   **not** `COMPLETED`, and has **no `AuditLog` event in >5 days**.
3. **Rules 4 & 6 are audit-derived** (no `pausedAt` / `decidedAt` columns).
4. **Pipeline "Invited" tile counts invitations** (pending), drilling to
   `/invitations` — not applications.
5. **Thresholds hardcoded** (14d / 7d / 5d / 3d / 48h). Revisit only if real
   data proves them wrong; not configurable in Settings (per backlog out-of-scope).
6. **`/admin` stays**, gains an "Open Cockpit" CTA for the active round. The
   delete/redirect decision remains deferred.
7. **Staged delivery** across PRs A–F below (not one mega-PR).

---

## Code-grounded findings (why the plan is shaped this way)

### The 8 Needs-Attention rules — actual derivability

| # | Rule | Derivation | Migration? |
|---|------|-----------|:---:|
| 1 | Invites pending >14d | `Invitation` where `roundId=R`, `status=PENDING`, `acceptedAt IS NULL`, `expiresAt > now`, `createdAt < now-14d` | no |
| 2 | Reassessment invite expiring <48h | as #1 but `bursaryAccountId IS NOT NULL` (reassessment marker) and `expiresAt < now+48h` | no |
| 3 | Submitted, missing required docs | reuse `getSectionGapStatuses(applicationId)` → any error-severity gap | no |
| 4 | Assessment paused >7d | `Assessment.status=PAUSED` **and** latest `ASSESSMENT_PAUSE` `AuditLog` event for that app `< now-7d` | no |
| 5 | Assessment stalled | assessment exists, `status≠COMPLETED`, **max** `AuditLog.createdAt` for the app `< now-5d` | no |
| 6 | Recommendation awaiting outcome >3d | `Recommendation.createdAt < now-3d` **and** no `APPLICATION_OUTCOME_SET` audit event for the app | no |
| 7 | Ready but not exported | recommendations decided for a school, **no** `RECOMMENDATION_EXPORT` audit event covering that school since the latest decision | **+audit action (no migration)** |
| 8 | Close <7d & >10 undecided | `Round.closeDate < now+7d` and `total − qualifies − doesNotQualify > 10` | no |

Confirmed model facts:
- `Invitation` has `roundId`, `bursaryAccountId` (reassessment marker),
  `status`, `expiresAt`, `acceptedAt`, `createdAt` — rules 1/2 scope cleanly by
  `roundId`.
- `Recommendation` has `roundId` + `createdAt` (1:1 with `Assessment` via unique
  `assessmentId`) — rule 6/7 scope cleanly by `roundId`.
- `AuditLog` already records `ASSESSMENT_PAUSE`, `RECOMMENDATION_SAVE`,
  `APPLICATION_OUTCOME_SET` (`src/lib/audit/actions.ts`) with `createdAt`,
  `entityType`, `entityId` — the basis for rules 4/5/6 and the decided-over-time
  series (decisions/day from `APPLICATION_OUTCOME_SET`).
- `AUDIT_ENTITY_TYPES` already includes `Round` — the export action logs against
  the round (`entityId = roundId`, metadata `{ school, format, count }`).

### The watchlist query is the real engineering meat

Rules 4/5/6 need **latest-audit-event-per-application** correlation. Plan:
`getRoundWatchlist(roundId)` runs a handful of batched queries via `Promise.all`
and correlates in memory:
1. round applications (id, status, assessment status, recommendation createdAt);
2. `Invitation` rows for the round (rules 1/2);
3. an `auditLog.groupBy({ by: [entityId], _max: { createdAt } })` over the
   round's application/assessment ids (rules 4/5 "latest event"), plus targeted
   counts of `ASSESSMENT_PAUSE` / `APPLICATION_OUTCOME_SET` / `RECOMMENDATION_EXPORT`;
4. per-application doc-gap check (rule 3).

**Precedence:** one stuck item appears in exactly one rule (most-severe wins) —
dedupe by application id across rules before counting.

**Perf watch-items** (≈100–200 apps/round):
- Rule 3 calls `getSectionGapStatuses` per submitted app. Running 200 is heavy.
  Mitigation: add a batched `getMissingDocsApplicationIds(roundId)` that does the
  doc-slot check set-wise, or memoize. Decide in PR B; do **not** loop naively.
- The audit `groupBy` must be bounded to the round's entity ids (indexed on
  `entityId`). Acceptable per-request under `force-dynamic`; revisit caching only
  if it shows up slow.

### Component reuse — corrected map

| Concept asset | Reality in code | Action |
|---|---|---|
| `StatTile` | **inline** in `admin/page.tsx` (not shared) | extract → `components/admin/stat-tile.tsx`, add `delta` + `subCounts` |
| `RoundStatusBadge` | **duplicated inline** in both round pages | extract → `components/admin/round-status-badge.tsx` |
| shadcn `Progress` / `Alert` | **do not exist** (only Card/Badge/Tooltip/etc.) | add via shadcn in PR A |
| recharts "stacked bar" | only a **horizontal** bar (`charts/horizontal-bar-chart.tsx`) | add a stacked outcomes variant |
| activity feed | `getDashboardFeed` + `charts/activity-feed.tsx` — reusable as-is | lift unchanged |
| pipeline tiles → `/queue?…` | **queue ignores URL params today**; `listApplications` *does* support `roundId/status/school` | wire `searchParams` (PR C) + add missing filters |

The queue-param gap matters: `admin/page.tsx` already emits `/queue?roundId=&status=`
links that currently filter nothing. Making tiles work is a **prerequisite**, not
a freebie. Watchlist drill-ins needing **new** filters: `docsMissing`, `stale`,
`paused`, `awaitingOutcome`, `agedInvite`.

---

## PR sequence (foundation-first, each shippable to `staging`)

### PR A — Foundations (small, low-risk)
- Extract `RoundStatusBadge` (update both round pages to import).
- Extract `StatTile` from `admin/page.tsx`; add `delta?` and `subCounts?` props;
  update the dashboard to use the shared component (no visual change).
- Add `RECOMMENDATION_EXPORT` to `AUDIT_ACTIONS` (entityType `Round`).
- Write that audit row in `src/app/api/exports/recommendations/route.ts`
  (metadata `{ school, format, count }`) **before** streaming — unblocks rule 7.
- Add shadcn `ui/alert.tsx` + `ui/progress.tsx`.
- *No behaviour change beyond one audit row per export.*

### PR B — Watchlist engine (additive)
- New `src/lib/db/queries/round-watchlist.ts` → `getRoundWatchlist(roundId)`
  implementing all 8 rules + precedence dedupe + the batched doc-gap helper.
- New `src/components/rounds/needs-attention-lane.tsx` (ranked list; gold = time
  pressure, red = blocks close; "All clear" empty state) built on `Alert`/`Badge`.
- Unit tests per rule (backdate audit/invite fixtures to trip each threshold).
- Can render in a temporary slot on `/rounds/[id]` until PR D assembles the layout.

### PR C — Queue drill-in plumbing (prerequisite for tiles)
- `src/app/(admin)/queue/page.tsx`: read `searchParams`, pass to
  `listApplications`. Extend `ListApplicationsFilters` with the derived filters
  (`docsMissing`, `stale`, `paused`, `awaitingOutcome`, `agedInvite`).
- Client table: render server-filtered data; round-trip filter state via URL +
  `sessionStorage` so back-nav from a drill-in returns to the same lane.

### PR D — Cockpit refactor of `/rounds/[id]`
- New `components/rounds/`: `round-stage-strip.tsx` (7 nodes, states
  not-yet/live/complete/blocked; **not** clickable), `round-progress-gauge.tsx`
  (day-N-of-M, days-to-close, decisions/day required vs actual),
  `export-readiness-panel.tsx` (per-school ready counts + last-export time + buttons).
- Outcomes: stacked qualifies/DNQ bar (adapt the horizontal-bar component or add
  a stacked variant).
- Assemble: header + stage strip · Needs-Attention · 4 pipeline tiles · time/
  progress · outcomes · school split · export readiness · activity feed. Replaces
  the 6 `SummaryCard`s + school table.
- "Blocked" stage-strip node lights when a red watchlist rule touches that stage.

### PR E — Season Ledger refactor of `/rounds`
- New `components/rounds/`: `active-round-hero.tsx`, `round-ledger-row.tsx`,
  `delta-badge.tsx`.
- Layout: OPEN-round hero (with stage strip + headline numbers) · DRAFT prompt ·
  compact reverse-chron ledger of CLOSED rounds. Replaces the table.

### PR F — Cross-round polish + entry points
- `DeltaBadge` across headline numbers (needs a prior-round metric helper —
  prior round = next-earlier `academicYear`).
- Closed rounds render the cockpit muted/read-only (all stages checked, actions →
  "Export archive" / "View report").
- `admin/page.tsx`: add the "Open Cockpit" CTA for the active round (keep the page).

---

## Cross-cutting
- Admin-only surfaces; `requireRole([ADMIN, ASSESSOR, VIEWER])` unchanged. No RLS
  or privacy work.
- Audit-log the new export action via `AUDIT_ACTIONS`; no other new mutations.
- Pages stay `force-dynamic` (already set).
- Git workflow: branch off `staging`, PR to `staging`, owner promotes to `main`.

## Open build-time items (not blockers)
- Rule-3 missing-docs batching strategy (decide in PR B; avoid the N-call loop).
- Exact "ready/decided per school" definition for export readiness + rule 7
  (decided = `QUALIFIES`/`DOES_NOT_QUALIFY`; "covered by export" = a
  `RECOMMENDATION_EXPORT` for that school after the latest decision).

## Verification
- `npx next build` clean after each PR.
- Seed manipulation to trip each of the 8 rules (backdate an invite `createdAt`,
  pause an assessment + backdate its audit row, etc.) → confirm count + drill link.
- Playwright: `/rounds` hero + ledger; cockpit tile → `/queue` filtered → back-nav
  returns to the lane; closed round renders read-only/muted.
- a11y/Lighthouse on the cockpit (focus order through tiles, stage-strip state
  labels, gold-on-navy contrast).

## Explicitly out of scope (per backlog)
- Schema changes for analytics (audit-derived instead).
- Configurable thresholds in Settings.
- Deleting/redirecting `/admin`.
- Stage-strip clickability.
- Longitudinal analytics beyond the inline delta badge (stays in `/reports`).
