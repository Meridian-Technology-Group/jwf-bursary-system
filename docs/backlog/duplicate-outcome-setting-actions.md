---
title: Two parallel "set application outcome" server actions with divergent behaviour
status: open
severity: medium
area: assessment, recommendation, correctness
opened: 2026-05-23
opened_by: Brian Wagner (via Claude, during API-reference authoring)
related:
  - src/app/(admin)/applications/[id]/actions.ts (setOutcome — line 324)
  - src/app/(admin)/applications/[id]/recommendation/actions.ts (setApplicationOutcomeAction — line 111)
  - src/components/admin/recommendation-form.tsx (calls setApplicationOutcomeAction)
---

## Context

There are **two** server actions that both set an application's outcome
(Qualifies / Does Not Qualify), found while mapping the API surface:

- `setOutcome(...)` — `src/app/(admin)/applications/[id]/actions.ts:324`
- `setApplicationOutcomeAction(...)` —
  `src/app/(admin)/applications/[id]/recommendation/actions.ts:111`

They are **not** thin wrappers around a shared core: the API-reference audit
found they differ in transition validation, which audit-action key they write,
and — importantly — **only one of them creates the `BursaryAccount`** on a
qualifying outcome. The recommendation form
(`recommendation-form.tsx:329`) calls `setApplicationOutcomeAction`; it is
unclear whether `setOutcome` is still reachable from any live UI path.

## Why it matters

Medium — this is a correctness/consistency risk on a critical flow:

- If both paths can fire in different contexts, an outcome set via one path may
  **skip BursaryAccount creation** or write a different/again audit trail than
  the other — leading to qualifying applications without a bursary account, or
  inconsistent history.
- Two sources of truth for the same state transition is a maintenance trap: a
  fix to one (e.g. a new guard) silently misses the other.

## Proposed approach

1. Confirm which action the live UI uses (`setApplicationOutcomeAction`) and
   whether `setOutcome` is dead code or reachable from another entry point
   (search call sites; check the application-detail and queue paths).
2. If `setOutcome` is unused → remove it. If both are needed →
   **collapse them onto one shared core** that does the transition validation,
   the BursaryAccount creation, the outcome email, and a single canonical audit
   write; have both entry points delegate to it.
3. Add a test asserting that a qualifying outcome always creates exactly one
   BursaryAccount and writes the expected audit row, regardless of entry point.

## Out of scope

- Changing the outcome model (Qualifies / Does Not Qualify) or the email
  behaviour itself — this is about de-duplicating the transition logic.
