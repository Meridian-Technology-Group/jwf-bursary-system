---
title: Round management — concurrent rounds, editable dates, per-application deadlines
status: planned
severity: high
area: rounds, admin, schema
wave: 1
depends_on: [01]
blocks: [05, 10]
sources:
  - ../source-materials/meeting-findings.md   # "Admin / round management changes"
  - ../source-materials/feedback.md
related:
  - 00-current-state-map.md
  - 01-status-and-workflow-model.md
  - prisma/schema.prisma
  - docs/engineering/round-cockpit-implementation-plan.md
---

# 03 — Round management

**Objective.** Make rounds match how the Foundation actually runs intake:
**more than one round can be OPEN at once**, round **dates are editable and
extendable after creation**, an applicant can be given a **per-application
submission deadline** that differs from the round close date, the parent-invite
**round picker only offers live rounds**, the round picker is a **simple
two-option control** rather than an unbounded dropdown, and sending an
invitation has a **confirmation step**. This lifts the singular-"the open round"
assumption that is threaded through the dashboard, queue, reports and invitation
code, and it does so without regressing the Round Cockpit (#18).

---

## 1. Background & rationale

[`meeting-findings.md`](../source-materials/meeting-findings.md) → **"Admin /
round management changes"** lists, in order:

- *Remove current limitation that only one round can be open at a time; support
  cases where two rounds are open concurrently.*
- *Allow editing/extending round dates after creation.*
- *Support per-application submission-by date, not just round-level timing,
  because some applicants get extended deadlines.*
- *Filter parent invitation round choices to active/live rounds only.*
- *Replace round dropdown with a simpler UI if there are typically only two
  active rounds.*
- *Add invitation confirmation step if useful, to prevent accidental sends.*

The same section continues into the contact-database / contact-record asks —
those are **Epic 04** (lead-applicant contacts & invitations) and are out of
scope here; this epic owns only the *round* and *round-picker/confirmation*
slice of the invitation flow.

Two of these are bug-adjacent rather than greenfield: round dates already have a
working server action with **no UI**, and the round picker already exists but is
**unfiltered**. The structurally interesting items are (a) lifting the
single-OPEN invariant, which is singular in many readers, and (b) the new
**per-application deadline**, which must sit cleanly alongside the round close
date and the assessment pause deadline introduced by **Epic 01** — three
distinct dates that must not be conflated again.

---

## 2. Current state

See [00 §D](00-current-state-map.md#d-rounds--invitations) for the full
snapshot. The load-bearing facts for this epic:

- **`Round`** (`prisma/schema.prisma:38`) is keyed `academicYear @unique`
  (`:40`); dates are `openDate` / `closeDate` (`:41-42`, both `@db.Date` — **no
  time component**) and `decisionDate?` (`:43`). There are **no
  "available"/"required"/per-stage date fields**.
- **Single-OPEN-round is an action-layer guard, not a DB constraint.**
  `openRoundAction` does an explicit `findFirst({ status: OPEN, NOT: { id } })`
  and throws if one exists (`rounds/actions.ts:212-221`). The doc-comment at
  `:181-186` is explicit that this is a deliberate MVP guard ("revisit if
  concurrent admin activity becomes a real concern; then promote to a DB
  constraint"). There is **no partial unique index** enforcing it.
- **"The open round" is assumed singular in many readers.** `getActiveRound`
  (`reports.ts:122`) returns the *single most-recent OPEN* round (falling back
  to any most-recent round), and is consumed by:
  - `admin/page.tsx:123` — dashboard tiles scope to it,
  - `queue/page.tsx:113` — the assessment queue scopes to it,
  - `reports/page.tsx:444` — reports default to it,
  - `rounds/current/page.tsx:27` — the "current round" redirect/shortcut,
  - `invitations/actions.ts:625` — the **queue bulk re-assessment** invite
    resolves its target round from it (`:621-651`).
  - The invite **form default** also picks the single OPEN round:
    `invitations/page.tsx:101` (`rounds.find((r) => r.status === "OPEN")`).
- **Round dates are not editable from the UI.** `updateRoundAction` exists and
  works (`rounds/actions.ts:118-169`, validates via `RoundSchema`, audits
  `UPDATE_ROUND`) but has **zero UI callers** — `round-detail-actions.tsx`
  offers only *Send Invitations / Open / Close / View report / Export archive*
  (`round-detail-actions.tsx:36-101`). There is no "Edit dates" affordance and
  no extend-while-open path.
- **No per-application deadline exists anywhere.** The `Application` model
  (`schema.prisma:80`) has `submittedAt?` (`:94`), `createdAt`, `updatedAt` —
  and nothing for a submission-by date. The only deadline in the system is the
  **invitation** `expiresAt`, computed as a fixed **+30 days**
  (`invitations/actions.ts:130-131`, repeated at `:364-365`, `:756`, `:1146`),
  which gates *registration* (whether the invite link still works), **not form
  submission**.
- **The invite round picker is unfiltered.** `invitations/page.tsx:104-108`
  builds `roundOptions` from **all** rounds (`listRounds`), newest first, with
  no status filter; `send-invitation-form.tsx:270-287` renders them in a
  `shadcn` `Select`. A DRAFT or CLOSED round can be picked.
- **No confirmation on single-send.** The single parent / staff invite forms
  submit directly; only the `/queue` **bulk** re-assessment action has a
  confirm step today (the per-form confirmation is the gap).
- **Round Cockpit (#18) reads round state.** `/rounds` + `/rounds/[id]`,
  `components/rounds/*`, and `lib/db/queries/round-cockpit*.ts` are live.
  Watchlist **Rule 8** ("close approaching with undecided") reads
  `Round.closeDate` directly (`round-watchlist-eval.ts:267-280`), and the
  cockpit time-progress gauge derives day-N / days-to-close / decisions-per-day
  from `openDate`+`closeDate` (`round-cockpit-eval.ts:67-100`). Anything that
  changes round dates or adds a per-app deadline must not break these.

---

## 3. Target state

Per [`meeting-findings.md`](../source-materials/meeting-findings.md) and
decision **[D13](../README.md#5-decision-register)**:

**Concurrent OPEN rounds.**
- Two (or more) rounds may be OPEN simultaneously. The hard single-OPEN guard at
  `rounds/actions.ts:212-221` is **removed** (or, per D13/§7, made a
  config-gated soft guard).
- Every reader that currently assumes a single OPEN round is reworked to handle
  *a set of* OPEN rounds: dashboard, queue, reports each gain an explicit
  **round selector** (defaulting to the most recent OPEN), `rounds/current`
  resolves sensibly when several are open, and the bulk re-assessment action
  resolves its target round **explicitly** rather than via "the" open round.

**Editable / extendable dates.**
- Admin can edit `openDate` / `closeDate` / `decisionDate` from the round detail
  page at any non-terminal status, including **extending `closeDate` while the
  round is OPEN** (the common "give everyone another week" case). This simply
  surfaces the already-built `updateRoundAction` behind a dialog, with the
  ordering invariants (`close > open`, `decision > close`) kept.

**Per-application submission deadline.**
- A new optional `Application.submissionDeadlineAt` lets an admin grant an
  individual applicant a later (or earlier) submission-by date than the round.
- **Effective submission deadline** for a given application =
  `submissionDeadlineAt ?? round.closeDate` (per-app override wins; otherwise
  fall back to the round). This single derivation is what Epic 05's parent
  countdown / deadline-missed lockout and the submit guard read.
- This date is **distinct** from, and must not be conflated with, the two other
  dates in the system (see the explicit three-clock model below).

**Filtered, simplified round picker + confirmation.**
- The parent-invite round picker offers **live rounds only** — `OPEN` (and,
  per §7, optionally `DRAFT` for "prepare invites before opening"; default
  **OPEN-only**). CLOSED rounds never appear.
- When there are ≤ 2 live rounds (the expected steady state per **D13**), the
  picker renders as a **two-option segmented control / radio pair** instead of a
  dropdown; it gracefully degrades to a `Select` if more are live.
- Sending a single parent invite shows a **confirmation step** ("Invite
  &lt;name/email&gt; into &lt;round&gt;?") before dispatch, matching the
  existing bulk-action pattern.

**The three-clock model (must stay distinct — coordinates with [01](01-status-and-workflow-model.md)).**

| Clock | Field | Granularity | Governs | Owner |
|---|---|---|---|---|
| **Round close** | `Round.closeDate` | date (today) | round-level intake window; cockpit pacing & Rule 8 | this epic |
| **Per-app submission-by** | `Application.submissionDeadlineAt` (new) | date+time | *this applicant's* deadline to **submit the form**; parent countdown/lockout (Epic 05) | **this epic** |
| **Assessment pause** | `Assessment.pausedUntil` (Epic 01) | date+time | deadline to **upload missing docs** *after* submission; does not move `submittedAt` | [01](01-status-and-workflow-model.md) |

The submission-by clock stops at `SUBMITTED` (it gates the form lifecycle); the
pause clock only starts *after* submission when the assessment goes `PAUSED`.
They never overlap in time for one application, and neither one mutates
`submittedAt` (Epic 01 makes that immutable).

---

## 4. Gap analysis

| Target | Today | Action |
|---|---|---|
| Multiple OPEN rounds allowed | hard guard throws (`rounds/actions.ts:212`) | Remove guard (or config-gate per §7) |
| Readers handle a *set* of OPEN rounds | 6 call sites assume one (`getActiveRound` + form default) | Add explicit round selectors; resolve target round explicitly in bulk re-assessment |
| Edit/extend dates from UI | action exists, **no UI** (`updateRoundAction` unwired) | Add "Edit dates" dialog on round detail wired to `updateRoundAction` |
| Extend `closeDate` while OPEN | not surfaced | Allow date edit on OPEN rounds (keep ordering refinements) |
| Per-application submission-by date | **no column** (`Application`) | New `submissionDeadlineAt DateTime?` + effective-deadline helper |
| Parent picker = live rounds only | lists **all** rounds (`invitations/page.tsx:104`) | Filter to OPEN (optionally DRAFT) before building options |
| 2-option round control | `Select` of all rounds (`send-invitation-form.tsx:270`) | Segmented/radio control for ≤2 live; fall back to `Select` |
| Invite confirmation step | only bulk action confirms | Add confirm dialog to single-send forms |
| Don't regress cockpit Rule 8 / pacing | reads `closeDate` (`round-watchlist-eval.ts:272`, `round-cockpit-eval.ts:76`) | Keep `closeDate` semantics; per-app deadline is additive, not a rename |

### 4.1 The "the open round is singular" call sites (enumerated)

Removing the single-OPEN guard makes "the open round" ambiguous. Every site
below must be reworked to either (a) take an explicit `roundId`, or (b) operate
over the set of OPEN rounds:

1. `getActiveRound` (`reports.ts:122-135`) — the shared helper; keep as
   "most-recent OPEN" *default* but stop treating it as the only one.
2. `admin/page.tsx:123` — dashboard tiles → add a round selector; default to
   most-recent OPEN.
3. `queue/page.tsx:113` — assessment queue → round selector; default to
   most-recent OPEN.
4. `reports/page.tsx:444` — reports → round selector (a partial control may
   already exist; verify it does not silently pin to one OPEN round).
5. `rounds/current/page.tsx:27` — "current round" shortcut → define behaviour
   when >1 OPEN (most-recent OPEN, or a small chooser).
6. `invitations/actions.ts:621-651` — **bulk re-assessment** target round → must
   resolve **explicitly** (the action already *requires* `status === OPEN` at
   `:626`; with multiple OPEN rounds it must take/confirm a specific `roundId`,
   not the most-recent one silently).
7. `invitations/page.tsx:101` — invite-form default → default to most-recent
   OPEN but allow choosing among live rounds (ties into the filtered picker).

> This list is the acceptance gate for "concurrent rounds" — the feature is not
> done until each site behaves correctly with two rounds OPEN.

---

## 5. Proposed approach

### 5.1 Schema (Prisma + migration)

One additive migration, shipped in the PR that consumes it (per repo
`CLAUDE.md`). No edits to existing migrations.

```prisma
model Application {
  // + submissionDeadlineAt DateTime? @map("submission_deadline_at") @db.Timestamptz(6)
  //   Per-applicant submit-by override. NULL ⇒ fall back to round.closeDate.
  //   Distinct from Assessment.pausedUntil (post-submission doc deadline, Epic 01)
  //   and from Round.closeDate (round-level intake window).
}
```

Design decisions for §5.1:

- **`submissionDeadlineAt` is `Timestamptz` (date+time), not date-only.** A
  parent "submit by Friday 5pm" countdown (Epic 05) needs a time; `@db.Date`
  would force midnight-UTC and reintroduce the BST off-by-one class of bug seen
  in audit timestamps ([00 §F](00-current-state-map.md#f-settings-auth-audit-retention)).
  It is nullable with no default; absence means "use the round".
- **`Round.closeDate` stays `@db.Date` (date-only) for now — recommended.**
  Promoting it to `Timestamptz` would ripple through the cockpit pacing maths
  (`round-cockpit-eval.ts:67-100`) and Rule 8 (`round-watchlist-eval.ts:272`),
  which currently treat it as a whole-day boundary, and is **not required** by
  any ask: the per-app clock is where time-of-day matters. We therefore keep the
  round window day-granular and put the time precision on the per-application
  override. *(If a future ask needs a timed round close, that is a separate,
  cockpit-aware change — flagged in §9.)*
- **No new column for the single-OPEN rule.** Lifting it is a code change
  (delete the `findFirst` guard). If we keep it *removable behind config* (§7,
  D13), that is an env/flag check in `openRoundAction`, **not** a schema field
  and **not** a DB partial index (adding a partial unique index would *prevent*
  concurrency — the opposite of the requirement). The DB stays permissive; the
  guard, if retained, is a soft app-layer check.
- **Effective-deadline derivation lives in code, not the DB** — a small helper
  `effectiveSubmissionDeadline(application, round)` returning
  `application.submissionDeadlineAt ?? round.closeDate` (normalised to an
  end-of-day instant when falling back to a date-only `closeDate`), so the
  parent portal, the submit guard, and any admin display read one source of
  truth.

### 5.2 Server actions / API

- **Remove / soften the single-OPEN guard** (`rounds/actions.ts:212-221`).
  Either delete the `existingOpen` check, or wrap it behind a config flag
  (e.g. `ROUNDS_SINGLE_OPEN_ONLY`, default off) so the old behaviour is
  recoverable without a deploy. Update the doc-comment at `:181-186` to reflect
  the new contract.
- **Edit/extend dates:** no new action needed — wire the existing
  `updateRoundAction` (`rounds/actions.ts:118`) to a new dialog. Confirm
  `RoundSchema` (`:22-44`) and its `close > open` / `decision > close`
  refinements still hold for an extend (they do; they are relative, not
  "future-only"). Audit already stamped as `UPDATE_ROUND` (`:150-157`).
- **Per-application deadline action:** a new `setSubmissionDeadlineAction(appId,
  deadline | null)` (admin-gated, RLS via `withUserContext`) that writes
  `submissionDeadlineAt`, audits a new `SET_SUBMISSION_DEADLINE` action
  (mirroring the `UPDATE_ROUND` pattern), and `revalidatePath`s the application
  + round views. Clearing (set `null`) reverts to the round close date.
- **Rework "the open round" resolvers (per §4.1):**
  - Keep `getActiveRound` but rename its intent in the doc-comment to
    "most-recent OPEN (default)"; add a sibling `listOpenRounds(tx)` for callers
    that must show all live rounds (picker, selectors).
  - The **bulk re-assessment** action (`invitations/actions.ts:621`) takes the
    target `roundId` as an explicit argument (resolved/confirmed in the UI),
    validates it is OPEN, and no longer infers "the" open round.
- **Filtered picker data:** `invitations/page.tsx` builds `roundOptions` from
  `listOpenRounds` (OPEN, optionally DRAFT per D13/§7) instead of `listRounds`,
  newest first; `defaultRoundId` = most-recent OPEN.
- **Effective-deadline helper** (§5.1) added under `src/lib/rounds/` (or
  alongside `reports.ts` queries) and consumed by the Epic 05 submit guard so a
  draft cannot be submitted after its effective deadline.

### 5.3 UI

- **Round detail — "Edit dates" dialog.** Add an *Edit dates* button to
  `round-detail-actions.tsx` (`:55-101`, available for DRAFT and OPEN). Reuse
  the date `Input type="date"` fields and validation UX already built in
  `create-round-dialog.tsx:173,188,208`; submit through `updateRoundAction`.
  For OPEN rounds, frame it as *Extend / adjust dates*.
- **Per-application deadline control.** On the admin application detail (and/or
  the queue row context), an *override submission deadline* affordance
  (date-time picker) calling `setSubmissionDeadlineAction`; show the **effective
  deadline** with a marker when it is an override vs inherited-from-round. Read
  by Epic 05's parent countdown — this epic provides the field + admin control;
  the parent-facing banner/lockout is Epic 05.
- **Invite round picker → live + simple.** In `send-invitation-form.tsx`
  (`:262-291`), swap the `Select` for a **two-option segmented control** when
  ≤ 2 live rounds are passed in, falling back to the existing `Select` for >2.
  Source is now the filtered live-rounds list (§5.2). Label clearly which round
  the invite enters.
- **Single-send confirmation.** Add a confirmation dialog to the single
  parent-invite submit (and the staff-invite submit) — summarising recipient +
  round before dispatch — matching the existing bulk-action confirmation
  pattern. Keep it lightweight (a `shadcn` AlertDialog), and skippable only by
  explicit confirm.
- **Dashboard / queue / reports round selectors.** Where these pages pinned to
  the single OPEN round (§4.1), add a compact round selector (default
  most-recent OPEN) so admins can switch between concurrently-open rounds.
- **Do not alter the cockpit's date semantics.** The Round Cockpit gauge and
  watchlist keep reading `closeDate` as today; editing dates flows through the
  same field, so the cockpit reflects an extended close automatically and
  correctly (Rule 8 / pacing recompute from the new `closeDate`).

### 5.4 Seed / reference data

- **Demo seed (`seed:demo`)** updated to show the new shapes: at least **two
  concurrently-OPEN rounds**, at least one application carrying a
  `submissionDeadlineAt` override (one earlier, one later than its round close)
  so the effective-deadline derivation and the Epic 05 countdown have fixtures.
  No reference-data (`seed:reference`) change — rounds are operational data, not
  reference data.

---

## 6. Work breakdown (PR-sized)

- [ ] **PR-1 (schema, additive):** add `Application.submissionDeadlineAt
      DateTime?` + migration; add `effectiveSubmissionDeadline()` helper and unit
      tests (override wins; null falls back to round close end-of-day). No
      behaviour change yet.
- [ ] **PR-2 (concurrent rounds — core):** remove/soften the single-OPEN guard
      (`rounds/actions.ts:212`, config flag per D13); add `listOpenRounds`; make
      the **bulk re-assessment** action take an explicit `roundId`
      (`invitations/actions.ts:621`). Update doc-comments.
- [ ] **PR-3 (concurrent rounds — readers):** add round selectors to dashboard
      (`admin/page.tsx`), queue (`queue/page.tsx`), reports (`reports/page.tsx`),
      and define `rounds/current` behaviour for >1 OPEN. Acceptance: each behaves
      with two rounds OPEN (§4.1).
- [ ] **PR-4 (editable/extendable dates):** "Edit dates" dialog on
      `round-detail-actions.tsx` wired to `updateRoundAction`; reuse
      `create-round-dialog` fields; allow on OPEN (extend). Verify cockpit
      recomputes from the new `closeDate`.
- [ ] **PR-5 (per-app deadline UI + action):** `setSubmissionDeadlineAction` +
      `SET_SUBMISSION_DEADLINE` audit action; admin override control on the
      application detail / queue; surface effective vs overridden.
- [ ] **PR-6 (filtered + simplified picker):** filter invite round options to
      live rounds (`invitations/page.tsx:104`); two-option segmented control in
      `send-invitation-form.tsx:262` with `Select` fallback.
- [ ] **PR-7 (invite confirmation):** confirmation dialog on single parent +
      staff invite sends.
- [ ] **PR-8 (seed):** demo fixtures — two OPEN rounds + per-app deadline
      overrides.

> PR-1 → PR-3 are the structural core; PR-4 → PR-7 are independent UX slices that
> can land in any order once PR-1/PR-2 are in. Coordinate PR-5 with Epic 01 (the
> submit guard + parent countdown that consume the effective deadline).

---

## 7. Open decisions

- **[D13](../README.md#5-decision-register)** — *Multiple open rounds: confirm
  the real cap is "two concurrent" so the UI can be a 2-option control not a
  dropdown.* Default: **support N, optimise UI for 2** (segmented control for
  ≤2, `Select` fallback). This also governs whether the single-OPEN guard is
  fully removed or **retained behind config** (`ROUNDS_SINGLE_OPEN_ONLY`,
  default off) as a reversible safety. Owner: **Charlotte**.
- **Picker scope — OPEN-only vs OPEN+DRAFT?** Default **OPEN-only** for the
  parent invite picker (you invite into a live intake). Revisit if admins need
  to prepare invites against a DRAFT round before opening it. Owner: Charlotte.
- **Per-app deadline direction** — confirm overrides may be **earlier as well as
  later** than the round close (the ask names "extended deadlines"; earlier is a
  natural symmetric case). Default: allow both. Owner: Charlotte.

---

## 8. Risks & mitigations

- **Wide blast radius from lifting single-OPEN.** "The open round" is singular in
  6+ readers (§4.1). *Mitigation:* enumerate-and-convert each in PR-2/PR-3; gate
  with a CI grep for new `getActiveRound`-as-singleton uses; make the bulk
  re-assessment target explicit so it can never silently fan out to the wrong
  round.
- **Regressing the Round Cockpit (#18).** Rule 8 and the pacing gauge read
  `Round.closeDate` (`round-watchlist-eval.ts:272`, `round-cockpit-eval.ts:76`).
  *Mitigation:* keep `closeDate` semantics unchanged (date-only, round-level);
  the per-app deadline is an **additive** field, never a rename; editing dates
  flows through the same `closeDate` so the cockpit stays correct. Run the
  existing `round-cockpit.test.ts` after PR-4.
- **Three clocks getting reconflated.** The whole point of [01](01-status-and-workflow-model.md)
  is to *un*-fuse lifecycle concepts; introducing a per-app deadline risks
  re-muddying it. *Mitigation:* the §3 three-clock table is normative —
  `submissionDeadlineAt` (form submit-by) ≠ `pausedUntil` (post-submit doc
  deadline) ≠ `closeDate` (round window); each has one owner and one reader path;
  none mutates `submittedAt`.
- **Concurrent-open admin confusion.** Two OPEN rounds could make it unclear
  "which round am I acting on" in dashboard/queue/reports. *Mitigation:* explicit
  round selectors (PR-3) with a clear default (most-recent OPEN) and the round
  named in the invite confirmation (PR-7).
- **Accidental sends were the demo pain point.** *Mitigation:* PR-7 confirmation
  closes the specific failure (wrong invite flow used during the demo, per
  `meeting-findings.md` bugs list) together with Epic 04's parent-vs-staff
  clarity.

---

## 9. Out of scope / deferred

- **Lead-applicant contact register, contact records, and "invite from
  contact"** → **Epic 04** (the rest of the "Admin / round management changes"
  bullet list). This epic only touches the *round picker* and *confirmation*
  parts of the invite flow.
- **Parent-facing countdown banner, deadline-missed lockout, read-only submitted
  summary** → **Epic 05** (consumes the effective-deadline helper this epic
  ships).
- **Promoting winners to rolling accounts + generating the forward round
  schedule** → **Epic 10** (depends on this epic's round model + Epic 01).
- **Timed round close (`Round.closeDate` → `Timestamptz`)** — deliberately not
  done; would require cockpit pacing + Rule 8 rework and is unrequested. Flagged
  here so a future ask starts from this note.
- **DB-level enforcement of round concurrency rules** (partial unique indexes)
  — not added; concurrency is permitted, and any soft cap stays in the app
  layer per D13.

---

## 10. Acceptance criteria

- Two rounds can be **OPEN at the same time**; opening a second OPEN round no
  longer throws (or is governed solely by the optional `ROUNDS_SINGLE_OPEN_ONLY`
  config).
- Every site in §4.1 behaves correctly with two rounds OPEN: dashboard, queue,
  and reports let the admin choose the round; `rounds/current` resolves
  deterministically; the **bulk re-assessment** action targets an explicitly
  chosen OPEN round (never silently "the" open one).
- An admin can **edit and extend** a round's open/close/decision dates from the
  round detail page (including extending `closeDate` while OPEN); ordering
  invariants hold; the change audits as `UPDATE_ROUND`; the Round Cockpit gauge
  and Rule 8 recompute from the new `closeDate`.
- An application can carry a **`submissionDeadlineAt`** that differs from its
  round's `closeDate`; the **effective submission deadline** =
  `submissionDeadlineAt ?? closeDate` is computed in one helper, set/cleared via
  an admin action, and audited.
- `submissionDeadlineAt`, `pausedUntil` ([01](01-status-and-workflow-model.md)),
  and `closeDate` remain **three distinct fields** with distinct meanings; none
  mutates `submittedAt`.
- The parent-invite round picker offers **live rounds only** (CLOSED never
  appears) and renders as a **two-option control** when ≤ 2 are live, with a
  `Select` fallback.
- Sending a single parent (and staff) invite requires an explicit
  **confirmation** naming recipient + round before dispatch.
- Demo seed shows two concurrently-OPEN rounds and at least one per-application
  deadline override.
