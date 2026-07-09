# Item 1: Status & deadline columns on the Applications list

> Source: `docs/backlog/post-demo-change-list.md` — item 1. Status: Partial — divergent from written ask.

The client asked for the status column to be restored (using the agreed flow-diagram vocabulary) and for a new deadline (submission-by) column on the Applications list. The `feature/admin-applications` worktree instead **removed** the status column and its filter and added no deadline column, so status now lives only on the detail page. These stories restore status to the list from the derived review-phase projection (not the dropped fused `applications.status` enum), add a deadline column, and optionally re-introduce a status filter.

## Story 1.1 — Status column on the Applications list
**As a** staff user (ADMIN, ASSESSOR, or VIEWER) viewing the Applications list, **I want** each application's current status shown as a column, **so that** I can see where every application sits in the flow without opening each one individually.

**Acceptance criteria**
- [ ] Given the Applications list, When it renders, Then each row shows a Status value.
- [ ] Given a row's status, When it is displayed, Then the label uses the agreed flow-diagram vocabulary (the same wording used on the detail page), not the legacy `DOES_NOT_QUALIFY` / fused-enum labels.
- [ ] Given the derived review-phase projection (`deriveReviewPhase` / `matchesReviewPhase`), When the column value is computed, Then it is derived from that projection and **not** from the dropped fused `applications.status` enum.
- [ ] Given both list tabs (new and rolling), When each is viewed, Then the status column appears consistently on both.
- [ ] Given the status shown in the list, When compared with the same application's detail page, Then the two agree (single source of truth via the derived phase).
- [ ] Given a VIEWER, When they open the list, Then they can see the status column read-only (no state-changing controls introduced by this story).

**Notes / dependencies**
- **Decided:** status **returns to the list** (confirmed). All three stories (1.1–1.3) proceed.
- Must render from the derived review-phase projection; the fused `applications.status` column and `ApplicationStatus` enum were dropped in the Epic 01 cutover — do not reintroduce them.
- No schema change expected (phase is derived).
- Read-only presentation only; per-row/bulk state actions are items 2 and 3.

## Story 1.2 — Deadline (submission-by) column on the Applications list
**As a** staff user (ADMIN, ASSESSOR, or VIEWER) viewing the Applications list, **I want** each application's submission-by deadline shown as a column, **so that** I can spot upcoming and overdue deadlines at a glance.

**Acceptance criteria**
- [ ] Given the Applications list, When it renders, Then each row shows the effective submission-by (deadline) date.
- [ ] Given an application with a per-application deadline set, When the column renders, Then it shows that per-application date.
- [ ] Given an application with **no** per-application deadline, When the column renders, Then it falls back to the round-level default submission-by date (item 12).
- [ ] Given an application whose round has no default and no per-application deadline, When the column renders, Then it shows a clear empty/placeholder value (e.g. "—") rather than an error or blank ambiguity.
- [ ] Given the deadline column, When present, Then it renders on both the new and rolling tabs consistently.

**Notes / dependencies**
- **Depends on item 12** (round-level default submission-by date) for the fallback source; if item 12 is not yet delivered, the column shows only per-application deadlines and the fallback is deferred.
- The "effective deadline" (per-application override else round default) should be computed once and reused wherever the deadline is shown or filtered (this column, and item 7's submission-by date filter) to avoid divergence.
- No schema change in this story itself; the deadline fields/round default belong to item 12.

## Story 1.3 — Status filter on the Applications list
**As a** staff user (ADMIN, ASSESSOR, or VIEWER) viewing the Applications list, **I want** to filter the list by status, **so that** I can focus on applications in a particular phase (e.g. everything awaiting assessment).

**Acceptance criteria**
- [ ] Given the list filter bar, When I open the status filter, Then I can select one or more phase values expressed in the agreed flow-diagram vocabulary.
- [ ] Given a selected status filter, When applied, Then the list shows only applications whose derived review phase matches, using the same `matchesReviewPhase` logic that powers the column in 1.1.
- [ ] Given a status filter is active, When I clear it, Then the full (tab-scoped) list is restored.
- [ ] Given the status filter, When combined with other active filters (e.g. tab, assessor, date filters from item 7), Then filters compose (AND) rather than override one another.

**Notes / dependencies**
- With status confirmed back on the list (see 1.1), the filter is a natural follow-on. Lower priority than 1.1/1.2 but no longer contingent on any open question.
- Must key off the derived phase values, not the dropped fused enum or the old `StatusFilter` popover's legacy vocabulary; the removed popover can be a UI reference but not its value set.
- Should follow the existing filter-bar pattern and compose cleanly with item 7's date-range filters.
