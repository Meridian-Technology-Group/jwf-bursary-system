# Item 3: "Mark as Active" and "Close" — as bulk actions

> Source: `docs/backlog/post-demo-change-list.md` — item 3. Status: Partial.

Equivalents of these actions already exist as per-row menu items (*Move to active bursary*, *Decline*, *Withdraw account*), and the Applications list already has a bulk-selection toolbar (assign assessor, re-assessment invite). This item adds *Mark as Active* and *Close* to that existing toolbar as ADMIN-only bulk actions, reusing the same server-side gating as the per-row paths. The bulk *Close* collects a single close reason (item 4) applied to the whole batch, and per-row purge follows that reason's "purge on close" toggle (item 2).

## Story 3.1 — Bulk "Mark as Active"
**As an** ADMIN, **I want** to mark multiple selected applications as active at once, **so that** I can promote a batch of applicants into active bursaries without opening each row's menu individually.

**Acceptance criteria**
- [ ] Given I am an ADMIN viewing the Applications list, when I select one or more rows, then a *Mark as Active* action appears in the existing bulk-selection toolbar alongside the current bulk actions.
- [ ] Given a non-ADMIN (ASSESSOR/VIEWER) is viewing the list, when rows are selected, then *Mark as Active* is not shown or is disabled (mirrors the per-row action's role gating).
- [ ] Given I trigger bulk *Mark as Active*, when the server processes the batch, then each row is transitioned using the same logic and gating as the per-row *Move to active bursary* action (no new, divergent transition path).
- [ ] Given some selected rows are not in a valid state to be made active, when the batch runs, then those rows are skipped and every valid row still processes (the batch does not fail as a whole).
- [ ] Given the batch completes, when results are returned, then I see a summary reporting how many rows succeeded and which were skipped (with the reason each was skipped).
- [ ] Given the batch completes, then the list refreshes to reflect the new state and the selection is cleared.
- [ ] Given each successful transition, then an audit entry is written per affected application (append-only, consistent with the per-row action).

**Notes / dependencies**
- Reuses the per-row *Move to active bursary* server action / gating — do not fork logic.
- Follows the assign-assessor bulk pattern already in `BulkToolbar`.
- No close reason involved; this action is non-destructive and needs no confirmation dialog (though a lightweight confirm is acceptable if it matches existing bulk UX).

## Story 3.2 — Bulk "Close" with one batch-wide reason
**As an** ADMIN, **I want** to close multiple selected applications at once, choosing a single close reason applied to the whole batch, **so that** I can wrap up a group of applications consistently in one step.

**Acceptance criteria**
- [ ] Given I am an ADMIN with rows selected, when I open the bulk toolbar, then a *Close* action is available (ADMIN-only; hidden/disabled for other roles).
- [ ] Given I trigger bulk *Close*, when the flow starts, then I am required to select exactly one close reason from the admin-configurable reason dropdown (item 4) before the action can proceed; the batch cannot run with no reason chosen.
- [ ] Given a reason is selected, then that single reason (plus timestamp and acting admin) is recorded against every application closed in the batch.
- [ ] Given the batch runs, when each row is processed, then it uses the same server-side close logic and gating as the per-row close path (item 2's single "Closed" terminal state), not a separate bulk-only path.
- [ ] Given the selected reason's `purgeOnClose` toggle is ON, when a row is closed, then that row runs the purge routine (item 10); given the toggle is OFF, then the row is closed and all data is retained under the retention policy.
- [ ] Given some selected rows are already closed or otherwise not in a valid state to close, when the batch runs, then those rows are skipped and reported, and every valid row still closes.
- [ ] Given the batch completes, then I see a per-batch result summary (succeeded count, skipped rows with reasons) and the list refreshes with the close reason shown inline per row (item 4).
- [ ] Given each successful close, then an audit entry is written per application capturing the reason and whether a purge was triggered.

**Notes / dependencies**
- Hard dependency on item 4 (close reason dropdown + `purgeOnClose` flag) and item 2 (single "Closed" state). If the reason model is not yet built, this story is blocked on it.
- Purge behaviour is entirely reason-driven (item 10) — there is no separate "bulk purge" action.
- Reuses the per-row close server action / gating.

## Story 3.3 — Confirmation step for destructive bulk close
**As an** ADMIN, **I want** an explicit confirmation before a bulk close runs — especially when the chosen reason will purge data — **so that** I don't irreversibly anonymise a batch of applications by accident.

**Acceptance criteria**
- [ ] Given I have selected a close reason and confirmed the batch, when I proceed, then a confirmation dialog appears before anything is written, stating how many applications will be closed and the reason applied.
- [ ] Given the selected reason has `purgeOnClose` ON, then the confirmation dialog clearly warns that closing will purge PII and documents for the affected rows (destructive, per item 10) and requires an explicit confirm to proceed.
- [ ] Given the selected reason has `purgeOnClose` OFF, then the dialog states that data will be retained and still requires confirmation, but is not framed as destructive.
- [ ] Given the confirmation dialog is open, when I cancel, then no application is modified and the selection is preserved.
- [ ] Given I confirm, then the batch executes exactly as described in Story 3.2 (same gating, skip/report, audit, summary).

**Notes / dependencies**
- Confirmation copy must reflect the effective `purgeOnClose` state of the chosen reason so the destructive vs retained distinction is unambiguous.
- Depends on Story 3.2 and items 2/4/10.
