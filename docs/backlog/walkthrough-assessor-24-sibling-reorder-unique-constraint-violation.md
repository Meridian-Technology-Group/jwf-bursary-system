---
title: Sibling reorder 500s on unique (family_group_id, priority_order) constraint
status: closed
severity: medium
area: siblings
opened: 2026-05-22
opened_by: walkthrough re-walk (Claude)
closed: 2026-05-22
closed_by: PR #46 (atomic reorder)
related:
  - PR #44 (sibling RLS fix — fixed link/unlink, not reorder)
  - PR #46 (fix: make sibling reorder atomic to avoid unique-constraint violation)
  - docs/walkthroughs/assessors/24-reorder-sibling-priority.md
  - app route: PATCH /api/siblings/[bursaryAccountId]
---

> **Closed (2026-05-22) by PR #46.** Re-walked on a local prod build of merged
> `staging`: as assessor on WS-202627-0001 → Sibling Links, "Move up" on Jordan
> (BA-202627-0002) returned **200 OK** (no 500) and the swap **persisted** —
> SQL confirmed `priority_order` flipped (BA-202627-0002 → 1, BA-202627-0001 → 2)
> and the order survived a page reload. The reorder is now atomic.

## Context

Re-walking the sibling fixes after PR #44. As assessor, on
WS-202627-0001 → Applicant Data → Sibling Links:

- **Link** ("Link as Sibling" for Jordan / BA-202627-0002) — SUCCEEDS,
  no RLS denial, two `sibling_links` rows created (priority 1/2). ✅
- **Unlink** ("Confirm Unlink") — SUCCEEDS, rows removed. ✅
- **Reorder** ("Move … up/down") — **FAILS with 500**.
  `PATCH /api/siblings/<bursaryAccountId>` body
  `{familyGroupId, orderedIds:[...]}` returns
  `{"error":"Failed to reorder sibling priority"}`. Postgres log shows:
  `duplicate key value violates unique constraint
  "sibling_links_family_group_id_priority_order_key"`. The DB
  priority_order values are unchanged after the call (no persistence).

So PR #44's RLS fix unblocked link + unlink, but reorder hits a
separate, non-RLS bug.

## Why it matters

Reordering sibling priority is the documented assessor workflow
(assessors/24) — the older child's payable fees feed the younger
child's HNDI, so the sequence is materially part of the calculation.
The move arrows are present and clickable but every reorder throws and
silently does nothing.

## Proposed approach

The handler updates rows one at a time, so setting account B to
priority 1 while account A still holds priority 1 trips the unique
`(family_group_id, priority_order)` index mid-update. Fix options:

1. Do the reassignment inside a single transaction and either (a) bump
   all affected rows to a temporary offset (e.g. `+1000`) first, then
   set final values, or (b) `SET CONSTRAINTS … DEFERRED` for the unique
   constraint so the check runs at commit.
2. Or make the constraint deferrable in the migration
   (`DEFERRABLE INITIALLY DEFERRED`) and update in a transaction.

## Out of scope

The link/unlink paths — both verified working post-PR-#44.
