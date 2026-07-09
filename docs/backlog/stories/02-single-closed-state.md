# Item 2: Single "Closed" state, with purge driven by the close reason

> Source: `docs/backlog/post-demo-change-list.md` — item 2. Status: Partial.

The lifecycle needs one terminal **Closed** state rather than several overlapping
close paths (today's *Decline* and *Withdraw account*). Whether closing an
application also purges PII is decided entirely by the selected close reason's
"purge on close" toggle (item 4) — a purge-flagged reason runs the purge routine
(item 10); a non-purge reason retains all data under the retention policy. There
is deliberately **no** separate "Purged" state.

## Story 2.1 — Close an application into a single terminal state
**As an** ADMIN, **I want** to close an application into one unified "Closed" state, **so that** the lifecycle has a single, unambiguous terminal outcome instead of several overlapping close paths.

**Acceptance criteria**
- [ ] Given an application in a valid (non-closed) state, when an ADMIN chooses *Close*, then it moves to the single terminal **Closed** state regardless of the reason chosen.
- [ ] Given the close flow, when the ADMIN confirms, then the system records the terminal state, the actor, and the timestamp.
- [ ] Given a closed application, then there is exactly one "Closed" state in the model — there is no separate "Close" vs "Purge" terminal state and no "Purged" state; purge is a consequence of the reason, not a distinct state.
- [ ] Given a closed application, when an ADMIN views it, then the recorded close reason (item 4) and whether it was purged are visible.
- [ ] Given an application already in the Closed state, when an ADMIN opens the row actions, then *Close* is not offered again (no double-close).
- [ ] Given any close action, then an audit entry is written (append-only) capturing actor, timestamp, reason, and whether purge ran.

**Notes / dependencies**
- Depends on item 4 (close reason dropdown + `purgeOnClose` toggle) — the reason field is required in every close path.
- Purge behaviour is delegated to item 10; this story only guarantees the single state and that the reason's toggle decides.
- Roles: ADMIN performs close; ASSESSOR/VIEWER do not (mirror existing per-row action gating).

## Story 2.2 — Close reason drives purge-vs-retain
**As an** ADMIN, **I want** the selected close reason's "purge on close" toggle to determine whether closing purges PII or retains everything, **so that** I get the right data-handling outcome without choosing a separate action.

**Acceptance criteria**
- [ ] Given a close reason whose `purgeOnClose` toggle is **on**, when the application is closed with that reason, then the purge routine (item 10) runs — PII and uploaded documents are removed while financials, bursary reference, dates, and assessment synopsis are retained.
- [ ] Given a close reason whose `purgeOnClose` toggle is **off**, when the application is closed with that reason, then all data is retained under the normal retention policy and no purge runs.
- [ ] Given either outcome, then the application still lands in the same single "Closed" state — only the data footprint differs.
- [ ] Given a purge-flagged close, when the ADMIN is asked to confirm, then the confirmation clearly warns that closing with this reason will permanently remove PII/documents (destructive).
- [ ] Given the close completes, then the retained close reason remains readable on the (now anonymised, if purged) record.

**Notes / dependencies**
- The `purgeOnClose` flag is configured per reason in admin Settings (item 4); this story consumes it, it does not manage it.
- Exact PII-vs-retained field list and the anonymisation mechanics are defined in item 10; align with the existing GDPR deletion routine so the two do not diverge.

## Story 2.3 — Reconcile existing Decline / Withdraw-account paths into the single close
**As an** ADMIN, **I want** the existing *Decline* and *Withdraw account* actions reconciled with the new unified close, **so that** there is one coherent way to close and we don't end up with multiple divergent "close" paths.

**Acceptance criteria**
- [ ] Given the current per-row menu (*Decline* recording `DOES_NOT_QUALIFY` + retain, *Withdraw account* closing the rolling `BursaryAccount`), when the unified close ships, then these outcomes are expressed through the single Closed state driven by an appropriate close reason rather than as independent terminal paths.
- [ ] Given a "declined" outcome, when an ADMIN closes with the matching close reason (e.g. a non-purge "Declined by the school" style reason), then the result is functionally equivalent to today's Decline (data retained) but lives in the single Closed state.
- [ ] Given a rolling bursary account being wound down, when an ADMIN closes, then the `withdrawBursaryAccount` behaviour is invoked/represented consistently within the unified close rather than as a separate, parallel lifecycle end.
- [ ] Given historical records created under the old paths, when viewed after the change, then they still display correctly and are not orphaned by the reconciliation (back-compatible).
- [ ] Given the reconciliation, then any duplicate/legacy close entry points are removed or redirected so ADMINs are not offered two ways to close the same thing.

**Notes / dependencies**
- Touches `application-row-actions.tsx` (per-row *Decline* / *Withdraw account* / *Move to active bursary*) and the `withdrawBursaryAccount` server action.
- Coordinate with item 3 (bulk *Mark as Active* / *Close*) — the bulk close must reuse the same single-close + reason logic so per-row and bulk stay consistent.
- `AssessmentOutcome.QUALIFIES` is already vestigial; confirm how the `DOES_NOT_QUALIFY` outcome relates to the new close reason so they are not recorded in two conflicting places.
- Keep server-side state gating; skip/report rows not in a valid state rather than failing.
