# Item 4: Close reason dropdown (required on close)

> Source: `docs/backlog/post-demo-change-list.md` — item 4. Status: Not started.

When an application is closed, the user must pick a reason from an admin-configurable dropdown. Each reason carries a "purge on close" toggle that decides whether closing purges PII (item 10) or retains all data — which is what enables the single "Closed" state (item 2). The chosen reason is stored against the application and shown in every list view.

## Story 4.1 — Require a close reason when closing an application (per-row)
**As an** ADMIN (or ASSESSOR, per existing close permissions), **I want** to be forced to select a close reason from a dropdown whenever I close an application, **so that** every closure is explained and the system knows whether to purge or retain the applicant's data.

**Acceptance criteria**
- [ ] Given I trigger the per-row *Close* action, When the close dialog opens, Then it shows a reason dropdown populated from the admin-configured close-reason list (see Story 4.3).
- [ ] Given the reason dropdown is untouched, When I attempt to confirm the close, Then the action is blocked and I see a validation message that a reason is required.
- [ ] Given I select a reason and confirm, When the close completes, Then the application moves to the single "Closed" state (item 2) and the chosen reason is stored against the application.
- [ ] Given a close succeeds, Then the reason label, the timestamp, and the acting user are recorded against the application.
- [ ] Given the selected reason has `purgeOnClose` = true, When the close completes, Then the purge routine (item 10) is triggered; Given it is false, Then all data is retained under the normal retention policy.
- [ ] Given a close occurs, Then an audit entry is written capturing which reason was applied (respecting append-only `audit_logs`).
- [ ] The reason field is enforced server-side, not only in the UI, so no close path can bypass it.

**Notes / dependencies**
- Depends on Story 4.3 (the reason list must exist and be configurable).
- Ties to item 2 (single "Closed" state) and item 10 (purge routine). The `purgeOnClose` flag on the reason is the sole driver of purge vs retain.
- Must reconcile with the existing `withdrawBursaryAccount` / *Decline* actions so there is one canonical close path, not several overlapping ones.

## Story 4.2 — Require a single close reason for a bulk close
**As an** ADMIN, **I want** to select one close reason that applies to all selected applications when I bulk-close them, **so that** I can close a batch efficiently without losing the per-application reason record or the purge/retain decision.

**Acceptance criteria**
- [ ] Given I select multiple rows and choose the bulk *Close* action (item 3), When the confirmation dialog opens, Then it shows the same reason dropdown as the per-row close and requires a selection before I can proceed.
- [ ] Given I confirm a bulk close, Then the single chosen reason is stored against every successfully closed application in the batch (with timestamp and actor per row).
- [ ] Given the chosen reason has `purgeOnClose` = true, Then the confirmation dialog clearly warns that the batch close is destructive (data will be purged) before I confirm.
- [ ] Given some selected rows are not in a valid state to close, When the batch runs, Then those rows are skipped and reported, and the remaining valid rows still close (the whole batch does not fail).
- [ ] Given the batch completes, Then a per-row result summary is shown and an audit entry is written for each closed row.
- [ ] The same server-side gating and reason enforcement used by the per-row close apply to the bulk path.

**Notes / dependencies**
- Depends on Story 4.1 (shared close/reason behaviour) and Story 4.3 (reason list).
- Implements the reason-collection requirement called out in item 3.

## Story 4.3 — Manage the close-reason list in admin Settings
**As an** ADMIN (Charlotte), **I want** to add and remove close reasons and set each one's "purge on close" toggle from Settings, **so that** I can maintain the reason list myself without needing a code change.

**Acceptance criteria**
- [ ] Given I open the close-reasons management area in Settings (new tab or extension of an existing settings tab), Then I see the current list of reasons, each with its label and its `purgeOnClose` state.
- [ ] Given I am an ADMIN, When I add a reason with a label, Then it becomes available in every close dropdown (per-row and bulk); non-ADMIN staff cannot add/remove/edit reasons.
- [ ] Given I remove a reason, Then it is no longer offered in close dropdowns, but reasons already recorded against previously-closed applications remain intact and still display.
- [ ] Given I toggle `purgeOnClose` on or off for a reason, Then future closes using that reason follow the new setting.
- [ ] Given I add, remove, or change a reason (including the toggle), Then an audit entry is written recording the change and the acting user.
- [ ] Given a fresh environment, Then the list is pre-populated (idempotent seed) with: "Declined by the school", "Relocation", "Accepting another school offer". (Charlotte to send the full list; purge toggle per reason to be confirmed.)
- [ ] The reason list is stored as reference data (label + `purgeOnClose` per row), mirroring the existing reason-code / reference-data pattern.

**Notes / dependencies**
- Reference table seeded idempotently via `seed-reference.ts` per CLAUDE.md (not the demo seed only); schema migration ships in the same PR.
- Pre-populated defaults are placeholders until Charlotte sends the full list and confirms each reason's purge toggle.
- Consider whether removing a reason should soft-delete/deactivate rather than hard-delete, to preserve referential integrity with historical closes.

## Story 4.4 — Show the close reason in all application list views
**As a** staff user (ADMIN / ASSESSOR / VIEWER), **I want** to see the close reason next to each closed application in every list view, **so that** I can understand at a glance why an application was closed.

**Acceptance criteria**
- [ ] Given a closed application, When I view it in any list view (new tab, rolling tab, and any filtered drill-in), Then its close reason is displayed as a column or inline label.
- [ ] Given an application that is not closed, Then no close reason is shown (the field is blank/not applicable).
- [ ] Given a reason was later removed from the configurable list, When I view an application closed under that reason, Then the originally-recorded reason label still displays.
- [ ] The reason display is consistent across all list surfaces (same label wording as chosen at close time).

**Notes / dependencies**
- Depends on Story 4.1/4.2 storing the reason against the application.
- Aligns with item 1 (Applications-list columns) — the reason column sits alongside any restored status/deadline columns.

## Open questions (confirm before building)
- **Free-text "other" option:** earlier notes mentioned a free-text "other" reason; the latest instruction specifies a dropdown only. Confirm with Charlotte whether a free-text fallback is still wanted before building. (Not resolved here.)
- **Full reason list + per-reason purge toggles:** Charlotte to send the complete list of reasons and confirm which ones should purge on close.
