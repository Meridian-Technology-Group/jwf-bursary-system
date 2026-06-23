# Canonical State-Model Alignment — Implementation Plan

> Build-ready engineering plan to close the gaps between the **current system**
> and the canonical state model. Sources of truth:
> [`docs/product/state-model.md`](../product/state-model.md) (canonical text),
> the signed-off diagram
> [`bursary-application-flow.drawio`](../diagrams/bursary-application-flow.drawio)
> (**wins on topology**), and the
> [gap analysis](../backlog/state-model-gap-analysis.md) (every gap grounded in
> `path:line`).
>
> Authored 2026-06-19. Baseline: branch `main` @ `e1fb121` (the live/most-current
> code — see [§ Prerequisite P0.1](#p01--git-reconciliation-blocker-brian)).
> Code anchors below were re-verified against `main`.

## TL;DR

The gap analysis' headline finding holds: **the three-lifecycle foundation
already exists** (Epics 01–11 + CR-001). This is **not** a greenfield build. The
work splits four ways, and the plan is sequenced to match:

1. **Two prerequisites, no code** — reconcile the inverted `main`/`staging` git
   state, and land a short **decision gate** (most items already have a Supplier
   recommendation; a few need Charlotte).
2. **Safe correctness wins** (Phase 1) — three bug/label fixes that need no
   decision: the half-enforced assessment gate (B1), the final-year `12`-vs-`13`
   discrepancy (G1a), the mis-placed income label (H1); plus the
   Submitted/Received label flip (A2) once D-G2 is confirmed.
3. **New features** (Phase 3) — account-level **withdrawal** (F1) and the
   parent-facing **Yr 6→13 schedule calendar** (F2). Both self-contained; the
   data plumbing for F2 already exists.
4. **Post-submission edit integrity** (Phase 4) — the highest-severity gap (C3:
   a material change must discard an in-progress assessment) plus the soft
   send-back (C2) and edit-on-behalf date/status semantics (D3). Coupled; gated
   on one decision (D-G6/D3).

Everything else (A1, A3, C1, D1, E2) is a **documentation reconciliation** —
the as-built behaviour is accepted and `state-model.md` is amended to match
(Phase 2). E1 (distinct admissions actor) and the G1b internal-any-year policy
are **client-gated** and deferred (Phase 5).

**Migration footprint is small.** Most items are code-only. The only candidate
schema change is the `submitted_at` write-once trigger, and *only* if the
D-G6/D3 decision lands on "new submission date on re-submit" (Phase 4).

---

## What is already aligned (do NOT rebuild)

Per the gap analysis, these already match the canonical model — no work:

- **Three independent lifecycles** — `ApplicationFormStatus`, `AssessmentStatus`,
  `BursaryAccountStatus` (`prisma/schema.prisma:696,725,817`); the fused
  `ApplicationStatus` enum is gone.
- **Immutable submission date** — write-once `submittedAt` (app guard
  `assertSubmittedAtUnset`, `status.ts:350`; Postgres trigger
  `20260605181936_submitted_at_immutable`).
- **Account `ACTIVE`/`CLOSED` + forward schedule** on award
  (`account-promotion.ts`, `bursary-accounts/schedule.ts`).
- **Rollover never fails out** — a non-qualifying rollover still completes and the
  account stays `ACTIVE` (`set-outcome-core.ts`; `status.ts:498-509` only archives
  `NEW` DNQ).
- **Edit-on-behalf audit/provenance** — staff edits attributed per-field
  (CR-001; `edit/actions.ts`, `application_sections.assessor_provenance`).
- **Income form** — 4 of 5 rules done (two-column layout, conditional evidence,
  single self-employed document, persistent zero-income acknowledgement).
  Only the H1 label is wrong.

---

## Prerequisites (no code — must clear before Phase 1)

### P0.1 — Git reconciliation · BLOCKER · Brian

`main` is **27 commits ahead of `staging`** (`main` @ `e1fb121`, `staging` @
`cf4f9e0`) — the inverse of the documented `staging`-ahead workflow
(`CLAUDE.md`). **CR-001 (#206) and the signed diagram (`e1fb121`) live on `main`
only.** Any branch cut from `staging` per the normal workflow would *not* contain
CR-001 — and Phase 4 (D3) edits the CR-001 code directly.

**Action (Brian's call — touches the `main`/`staging` boundary, which Claude
must not cross unprompted):** bring `staging` up to `main` (merge `main` →
`staging`, restoring the invariant that `staging` ⊇ `main`) **before** any Phase
1 branch is cut. Once reconciled, all work below follows the standard flow:
branch off `staging`, PR to `staging`, Brian promotes to `main`.

> Until P0.1 is done, treat the work branches as cut from a ref that **includes
> CR-001** (i.e. from `main`, or from a `staging` that has been fast-forwarded).
> Do not start Phase 4 against a `staging` that lacks CR-001.

### P0.2 — Decision gate

These reverse/restate prior decisions or need the Customer. Recommendations are
the Supplier's (from the gap analysis §6). **Bold owner = blocks the phase
noted.** Items with a clear recommendation can proceed on Brian's confirmation;
two need Charlotte.

| # | Decision | Recommendation | Owner | Gates |
|---|---|---|---|---|
| **D-G2** | Flip Submitted/Received to match the signed diagram (reverses built D2)? | **Flip** — diagram wins | Brian (notify Charlotte) | A2 (Phase 1) |
| **D-G15a** | Final eligible school year 12 vs 13? | **13** per `e1fb121` + model §10 | Brian | G1a (Phase 1) |
| **D-G6/D3** | Post-submission edit semantics: discard the assessment? reset the date? pass back through In Progress? | At minimum **discard the assessment** (C3); decide date rule for C2/D3 | Brian (+ Charlotte on date) | Phase 4 |
| **D-G1** | Real "Started" state (needs login telemetry) or accept `CREATED`? | **Amend model**; skip telemetry | Brian | A1 (Phase 2) |
| **D-G3** | Keep as-built assessment `PAUSED` or add app-side "Submitted with Correction"? | **Update model** — functionally identical | Brian | A3 (Phase 2) |
| **D-G5** | Accept reject = void+recreate, or require in-place reset? | **Accept**; amend model wording | Brian | C1 (Phase 2) |
| **D-G8** | Rewrite canonical §9 to CR-001 scoped-edit (impersonation rejected by contract)? | **Yes** — CR-001 is contractual & better-audited | Brian | D1 (Phase 2), Phase 4 framing |
| **D-G12** | Reconcile "purge on decline" (model) with tiered retention (D6, built)? | **Update model** → D6 policy | Brian (DPO for years) | E2 (Phase 2) |
| **D-G9** | Edit-on-behalf: keep the auto-email (CR D-CR1-1) or honour "no auto-comms" (June 11)? | Confirm with **Charlotte** | **Charlotte** | D2 (Phase 5) |
| **D-G11** | Model a distinct admissions Offered/Declined actor/step, or keep "assessor records the school's decision"? | Confirm with **Charlotte** | **Charlotte** | E1 (Phase 5) |
| **D-G15b** | Internal-bursary any-start-year policy? | Confirm intent | **Charlotte** | G1b (Phase 5) |

---

## Phase 1 — Safe correctness wins (no decision dependency beyond D-G2/D-G15a)

Small, independent, shippable as **stacked or parallel PRs**. No schema
migrations.

### 1A · B1 — Enforce the assessment gate (🐞 medium)

**Gap.** The assessor-workspace begin path has no `formStatus === SUBMITTED`
guard, so an assessment row can be created on a *draft* application.
`beginAssessmentAction` (`assessment/actions.ts:73-115`) only runs
`checkSecondParentGate`; `proceedWithoutSecondParentAction`
(`assessment/actions.ts:130+`) and the assessment page
(`assessment/page.tsx:128-174`) share the hole. The application-detail "Begin
Review" track is already gated (it derives `PRE_SUBMISSION` and the UI hides the
action) — this only closes the workspace route.

**Build.**
- Add a server-side guard in `beginAssessmentAction` and
  `proceedWithoutSecondParentAction`: inside the `withUserContext` tx, load
  `application.formStatus` and reject with a clear error unless `=== "SUBMITTED"`.
  Reuse `deriveReviewPhase` (`status.ts:106`) and assert `!== "PRE_SUBMISSION"`
  for a single source of truth, rather than hand-rolling the check.
- Gate the assessment page render the same way (redirect/empty-state when
  `PRE_SUBMISSION`).
- Tests: begin blocked on `CREATED`/`IN_PROGRESS`/`FILLED_IN`; allowed on
  `SUBMITTED`; existing second-parent gate behaviour unchanged.

### 1B · G1a — Fix the final-year `12`-vs-`13` discrepancy (🐞 medium)

**Gap.** `FINAL_ELIGIBLE_SCHOOL_YEAR = 13` (`bursary-accounts/schedule.ts:32`,
"Year 13 / Upper Sixth") disagrees with `assessment/schooling-years.ts:16-21`,
whose `TOTAL_YEARS_BY_ENTRY` caps schooling at **Year 12** (Y6→7, Y7→6, Y9→4,
Y12→1). The schema doc-comment (`schema.prisma:676-678`) echoes the `12` model.
The canonical model (§10: "Yr 6 → Yr 13", "max 8 years (Yr 6 entry)") and commit
`e1fb121` both say **13** — so `schooling-years.ts` is the bug.

**Build (pending D-G15a = 13).**
- Update `TOTAL_YEARS_BY_ENTRY` to run to Year 13: **Y6→8, Y7→7, Y9→5, Y12→2**.
- Fix the header comment (`schooling-years.ts:8-12`) and the schema doc-comment
  (`schema.prisma:676-678`) to "Years 6–13".
- Sanity-check `resolveScheduleHorizon` (`schedule.ts:64-75`) — with `FINAL=13`,
  Y6 entry now yields the full `MAX_SCHEDULE_YEARS=8`; confirm the clamp still
  holds for Y7/Y9/Y12.

> ⚠️ **Calc blast-radius — do not ship blind.** `calculateSchoolingYearsRemaining*`
> feeds the assessment engine and the re-assessment auto-decrement. Bumping every
> entry by one year **changes assessment outputs** (notably Y12 entrants go from
> 1 → 2 remaining years). This intersects the open Epic 07 deliverable
> (Charlotte's real historical figures). **Coordinate the fix with Epic 07
> validation**; land the constant change behind that validation, or as its own PR
> explicitly flagged for re-baselining the calc fixtures. Update all
> `schooling-years` unit-test expectations in the same PR.

### 1C · H1 — Move "Gross earned income" to the self-employed line (⚖️ low)

**Gap.** The rename landed on the wrong row. The **PAYE** line reads "Gross
earned income / annual salary (PAYE, as on P60)"
(`parents-income-form.tsx:340`); the **self-employed** line still reads "Gross
salaried income" (`parents-income-form.tsx:363`, field `selfEmployed.grossSalaried`)
— the exact wording the meeting asked to drop. Mirror label in
`income-model.ts:189`.

**Build.**
- `parents-income-form.tsx:363` → label **"Gross earned income"** (keep the
  `selfEmployed.grossSalaried` field key — label-only change, no data migration).
- `parents-income-form.tsx:340` → drop the "Gross earned income /" prefix so it
  reads e.g. **"Annual salary (PAYE, as on P60)"** (avoids two identically-named
  lines).
- Update the assessor review label `income-model.ts:189` to match.
- Grep for any other surfacing of these labels (PDF, review summary) and align.

### 1D · A2 — Flip Submitted/Received labels (⚖️ medium · pending D-G2 = flip)

**Gap.** Inverted vs the signed diagram. `submittedLabel`
(`status-projection.ts:76-78`) returns `NEW → "Received"`,
`ROLLING_OVER → "Submitted"`; canonical = **new "Submitted"**, **rollover
"Received"**. Built to process-alignment D2, which June-11 reversed.

**Build (single source + mirrors).**
- `status-projection.ts:77` → `applicationType === "NEW" ? "Submitted" : "Received"`.
- Flip the matching timeline copy at `status-projection.ts:178-186` (the `NEW`
  branch should read "submitted", the rollover branch "received").
- Update the assessor/admin badge mirror `lifecycle-badges.tsx:106-121` and the
  PDF label so all three surfaces agree.
- Update tests asserting the old mapping.
- Notify Charlotte (this reverses a previously-decided item).

---

## Phase 2 — Documentation reconciliations (amend `state-model.md`; ~no code)

Once the relevant decisions in P0.2 land, the **model doc is wrong, not the
code** for these. Edit [`docs/product/state-model.md`](../product/state-model.md)
(and, where noted, the diagram) — no application code changes. Do this as one
`docs:` PR after Phase 1.

| Item | Decision | Edit to `state-model.md` |
|---|---|---|
| **A1** "Started" state | D-G1 | §3: document that `CREATED` is the accepted pre-work state; drop "Started" as a distinct runtime state (no login telemetry). Note it as a deliberate simplification. |
| **A3** docs-pause representation | D-G3 | §4/§6/§7.2: replace app-side "Submitted with Correction" with the as-built **assessment `PAUSED` + `pausedUntil`**; the form stays Submitted/Received and the parent sees "Being assessed". Functionally identical. |
| **C1** reject = void+recreate | D-G5 | §3/§6.4/§7.3: describe REJECT as **void + recreate reusing the reference** (hard reset outcome; login kept, fields cleared, no submission date), not "in-place reset". Confirm GDPR-acceptability of destroying old data. |
| **D1** edit mechanism | D-G8 | §9: rewrite from **impersonation** to the CR-001 **scoped edit-on-behalf** (staff stay themselves; per-field provenance; impersonation rejected by contract on audit-trustworthiness grounds). The diagram is silent on mechanism, so this does not break "diagram wins". |
| **E2** decline ≠ purge-now | D-G12 | §5/§7: replace "Declined → Closed + data purged" with the **D6 tiered-retention** policy (grace window + tiered years, `RETENTION_PURGE_ENABLED`, report-only today). DPO still owes the retention-year sign-off. |

Also fix the doc nits the gap analysis flagged: §10 confirm **Yr 13** final year;
note that §3/§8 labels are already correct (the *code* was wrong — fixed in A2).

> **Sequencing note.** Per the model's own change-control (§12), amend the doc
> **and** the diagram together where the diagram is affected. A1/A3/C1/D1/E2 are
> textual-spec changes the diagram is silent on, so the diagram needs no edit;
> only confirm the Yr-13 final year matches.

---

## Phase 3 — New features (self-contained builds)

### 3A · F1 — Account-level withdrawal action (🔧 medium)

**Gap.** The only `CLOSED` writer is the automatic `closeAccountIfComplete`
(`bursary-accounts/lifecycle.ts:39-64`). Its own docstring says "Admin
manual-close is a separate server action" — **which does not exist** (grep
confirms no withdraw/manual-close path). Canonical §5/§7.7: an assessor may close
the account **at any time, account-level, no documents**.

**Build.**
- New server action `withdrawBursaryAccount(accountId, reason)` (e.g. in a new
  `src/app/(admin)/bursary-accounts/[id]/actions.ts` or alongside the existing
  account admin surface): `requireRole([ADMIN, ASSESSOR])`; under
  `withUserContext`, set `status: "CLOSED"`, `closedAt: now`; idempotent
  (no-op if already `CLOSED`). Allowed in **any** state — no schedule/doc gate.
- **Portal access auto-revokes** — the access guard reads account status
  (`bursary-accounts/access.ts`; see `lifecycle.ts:6-8`), so setting `CLOSED` is
  sufficient. Verify a closed account blocks the portal in the E2E check.
- Audit: add `AUDIT_ACTIONS.BURSARY_ACCOUNT_WITHDRAWN` (string constant — **no
  migration**) with `{ accountId, reason }`.
- Admin UI: a destructive "Withdraw / close account" control on the account
  detail surface with a confirm dialog (model on
  `components/admin/reject-restart-dialog.tsx`) capturing the reason.
- Tests (boundary-mock pattern per
  `applications/[id]/__tests__/schedule-actions.test.ts`): closes ACTIVE→CLOSED
  with `closedAt`; idempotent on CLOSED; role-gated; audit row written.

**No schema migration** — `BursaryAccountStatus.CLOSED` + `closedAt` already exist.

### 3B · F2 — Parent-facing Yr 6→13 schedule calendar (🔧 medium)

**Gap.** `BursaryScheduleEntry.showOnPortal` is maintained by admin
(`schedule-grid.tsx:196`, `schedule-actions.ts:154`) and exposed by
`src/lib/db/queries/schedule.ts:24,67` — but **no `(portal)` component reads it**
(grep: zero portal consumers). Active families get a `ReassessmentCard` + a
`/status` page, but no read-only future calendar. Canonical §10: a **read-only
calendar** of the full Yr 6→13 span, far-future years greyed, informational
only, **no access to prior application data** (the no-prior-access part already
holds by omission).

**Build.**
- New portal view (e.g. `src/app/(portal)/schedule/page.tsx` + a
  `components/portal/schedule-calendar.tsx`) consuming the existing
  `showOnPortal` schedule query for the signed-in family's account.
- Render the **full Yr 6→13 span** as academic-year rows (e.g. "due to be
  assessed May 2028, May 2029…"); grey out years **outside** the award; mark the
  current/next assessment year. Read-only — no actions, no links into prior
  application data.
- Add a portal nav entry, shown only for accounts in `ACTIVE · rounds scheduled`
  (i.e. an account with ≥1 schedule entry). Keep the existing `ReassessmentCard`
  for the "invited to reassess" call-to-action; the calendar is the standing
  reassurance view.
- Reuse the academic-year formatting already in `schedule.ts` /
  `assessment/fee-year.ts` so labels match the admin grid.
- a11y: the greyed/active states must not rely on colour alone (the gold-on-navy
  contrast + a text/`aria` state label, per the round-cockpit a11y pattern).
- Tests: query returns only `showOnPortal` entries for the account; greyed-year
  logic; nav item hidden for accounts with no schedule.

**No schema migration** — column + query already exist; this is read-only portal
plumbing.

---

## Phase 4 — Post-submission edit integrity (C3 + C2 + D3) · gated on D-G6/D3

The coupled cluster. **C3 is the single highest-severity gap** (a live
process-integrity hole on the merged CR-001 feature). Split the
**decision-independent primitive** (build now) from the **decision-gated wiring**
(after D-G6/D3).

### 4A · C3-core — Assessment-invalidation primitive (🔧 **high** · build now)

**Gap.** No primitive resets an assessment to "Not Started". `ASSESSMENT_TRANSITIONS`
(`status.ts:154-159`) has **no edge back to `NOT_STARTED`**, `COMPLETED` is
terminal, and discard happens only via cascade-delete on reject. Canonical
§4/§6.5/§7.2: any **material change** to submitted data **discards** an
in-progress assessment, which must be re-run.

**Build (no decision needed for the primitive itself).**
- Add a `discardAssessment(tx, applicationId, assessorId)` writer in
  `status.ts`, modelled on `resumeReview`/`markReviewComplete`: resets
  `assessments.status → NOT_STARTED`, clears `outcome`, `completedAt`,
  `pausedUntil`. Add the legal edges `IN_PROGRESS → NOT_STARTED` and
  `PAUSED → NOT_STARTED` to `ASSESSMENT_TRANSITIONS` (and, defensively,
  `COMPLETED → NOT_STARTED` only if the materiality policy later allows
  invalidating a completed-but-not-decided assessment — decide in 4C; default
  **off**).
- Audit: `AUDIT_ACTIONS.ASSESSMENT_DISCARDED` (string constant — **no migration**)
  with `{ applicationId, reason, changedFields }`.
- Resetting to `NOT_STARTED` is itself the "must be re-run" signal — no extra
  column. (If the team later wants an explicit "invalidated" flag for UI, that is
  an additive boolean; not needed for v1.)
- Tests: each new edge legal; discard clears outcome/completedAt/pausedUntil;
  idempotent when already `NOT_STARTED`.

### 4B · C2 — Soft send-back `SUBMITTED → IN_PROGRESS` (🔧 medium · gated)

**Gap.** `SUBMITTED` is terminal in `FORM_TRANSITIONS` (`status.ts:138`), and the
only "go back for changes" path is the destructive Reject & Restart. Canonical:
a **material change** sends the application back to **In Progress** (fields kept),
needing re-submission.

**Build (after D-G6/D3 date decision).**
- Add an explicit admin action `reopenForMaterialChange(applicationId, reason)`
  that moves `form_status: SUBMITTED → IN_PROGRESS` **keeping all section data**
  (distinct from reject's void+recreate). This is an explicit transition, **not**
  driven by `refreshFormStatus` (which stays terminal-safe at `status.ts:283`).
- Add `SUBMITTED → IN_PROGRESS` to `FORM_TRANSITIONS` **only for this explicit
  path** (keep derivation from ever demoting a submitted form — gate the edge
  behind the dedicated writer, not the generic `refreshFormStatus`).
- It must call `discardAssessment` (4A) in the same tx.
- **Submission-date semantics (the decision):**
  - If D-G6/D3 = **"new date on re-submit"**: the write-once `submittedAt`
    invariant must be relaxed for this path. That means revisiting both the app
    guard (`assertSubmittedAtUnset`, `status.ts:350`) **and** the Postgres
    trigger `trg_submitted_at_immutable` (migration `20260605181936`) — a **new
    additive migration** that allows clearing `submittedAt` to `null` on reopen so
    the next submit can re-stamp it. ⚠️ This is the only schema change in the
    whole plan; design it carefully (e.g. allow `NOT NULL → NULL` only when
    `form_status` leaves `SUBMITTED`).
  - If D-G6/D3 = **"keep original date"**: no trigger change; document that the
    original date persists (matches the docs-only philosophy).
- Tests: reopen keeps section data; assessment discarded; date behaviour per the
  chosen branch; reject path unaffected.

### 4C · D3 — Wire edit-on-behalf to the integrity rules (⚖️/🔧 medium · gated)

**Gap.** CR-001 amends submitted data **in place** without touching the
assessment (`edit-on-behalf.ts:18-32`; `EDIT_ON_BEHALF_ALLOWED_PHASES` includes
`SUBMITTED`/`PAUSED`). A `SUBMITTED` app stays `SUBMITTED` and keeps its original
date (`status.ts:283`). So staff can change household/income data under a live
assessment with **no invalidation** — exactly the C3 hole, via the merged
feature.

**Build (after D-G6/D3 — defines "material").**
- In `saveSectionOnBehalf` (`edit/actions.ts`), when the diff
  (`diffSectionPaths` / the `assessor_provenance` change set already computed)
  is **non-empty on a `SUBMITTED` application** whose assessment is
  `IN_PROGRESS` or `PAUSED`, call `discardAssessment` (4A) in the same tx.
- **Materiality policy (the decision):** v1 default — treat **any on-behalf data
  change to a submitted app as material** (conservative; matches canonical "any
  material change … invalidates"). If Charlotte/Brian want a narrower definition
  (e.g. only the calc-input sections: `PARENTS_INCOME`, `ASSETS_LIABILITIES`,
  household/dependents), scope the trigger to those `ApplicationSectionType`s.
  State the chosen rule in the assessor guide.
- **Date/flow:** align with the C2 decision — either keep editing in place
  (current) or route on-behalf amendments through `reopenForMaterialChange`
  (4B) so they pass back through `IN_PROGRESS` and re-stamp the date. Recommend
  at minimum the **assessment discard** (C3) regardless of the date choice.
- Reconcile CR-001 locked-decision 4 (edit blocked once `COMPLETED`/outcome set)
  with this: discard applies while `IN_PROGRESS`/`PAUSED`; post-completion edits
  stay blocked (no change to `EDIT_ON_BEHALF_ALLOWED_PHASES`).
- Update the CR-001 guide/FVC and `docs/engineering/cr-001-edit-on-behalf-implementation-plan.md`
  to describe the new invalidation behaviour.
- Tests: on-behalf material change discards an IN_PROGRESS/PAUSED assessment +
  audit; non-material/no-op change does not; completed/decided still blocked.

---

## Phase 5 — Client-gated / deferred (await Charlotte)

Do **not** start until the owning decision lands.

- **D2 (D-G9) — edit-on-behalf email.** Already a per-template toggle
  (`APPLICATION_EDITED_ON_BEHALF`, default-enabled, `edit/actions.ts:350-364`).
  If Charlotte chooses "no auto-comms", **disable the template in Settings** —
  near-zero code, `sendEmail` already skips disabled templates. If "keep", no
  action. Direct conflict between the June-11 meeting and CR D-CR1-1; needs the
  call, not a build.
- **E1 (D-G11) — distinct School/Admissions actor.** Today the assessor/admin
  records a 3-value `AssessmentOutcome` (`recommendation-form.tsx`,
  `set-outcome-core.ts`); there is no admissions role/portal/handoff (`Role` =
  APPLICANT/ASSESSOR/VIEWER/ADMIN/DELETED, `schema.prisma:663-668`). **If
  Charlotte confirms "assessor records the school's decision" is sufficient → no
  build** (amend model only). **If a distinct actor/handoff is required → a large
  follow-up epic** (new `Role` value + RLS + portal + report-to-admissions
  handoff state) — scope separately; out of this plan's envelope.
- **G1b (D-G15b) — internal-bursary any-start-year.** Both standard and internal
  use the fixed `EntryYearGroup` (Y6/Y7/Y9/Y12/OTHER; `schema.prisma:680-686`),
  with `OTHER` the manual escape. "Standard starts Y6/7/9/12; internal starts any
  year" is not enforced as a rule. If Charlotte confirms the policy, decide
  whether `OTHER` + manual schooling-years entry is adequate, or whether a
  first-class "internal, arbitrary start year" path is needed. Pairs naturally
  with the G1a calc work but is policy-gated.

---

## Summary matrix

| Gap | What | Type | Phase | Decision | Migration | Notes |
|---|---|---|---|---|---|---|
| B1 | Assessment-begin gate | 🐞 | 1A | — | no | server guard reuse `deriveReviewPhase` |
| G1a | Final year 12→13 | 🐞 | 1B | D-G15a | no | ⚠️ calc blast-radius (Epic 07) |
| H1 | Income label on wrong line | ⚖️ | 1C | — | no | label-only, keep field key |
| A2 | Submitted/Received flip | ⚖️ | 1D | D-G2 | no | 1 source + 2 mirrors + PDF |
| A1 | "Started" state | ⚖️ | 2 | D-G1 | no | doc only |
| A3 | Pause representation | ⚖️ | 2 | D-G3 | no | doc only |
| C1 | Reject void+recreate | ⚖️ | 2 | D-G5 | no | doc only (verify GDPR) |
| D1 | Edit mechanism (§9) | ⚖️ | 2 | D-G8 | no | doc only |
| E2 | Decline → tiered retention | ⚖️ | 2 | D-G12 | no | doc only (DPO years) |
| F1 | Account withdrawal | 🔧 | 3A | — | no | new action + audit const |
| F2 | Portal schedule calendar | 🔧 | 3B | — | no | reads existing `showOnPortal` |
| C3 | Assessment invalidation | 🔧 | 4A | — | no | primitive — build now |
| C2 | Soft send-back | 🔧 | 4B | D-G6/D3 | **maybe** | trigger change iff "new date" |
| D3 | Edit-on-behalf semantics | ⚖️/🔧 | 4C | D-G6/D3 | no | wires 4A into CR-001 |
| D2 | Edit-on-behalf email | ⚖️ | 5 | D-G9 | no | config toggle (Charlotte) |
| E1 | Admissions actor | ⚖️ | 5 | D-G11 | maybe | large iff a new actor (Charlotte) |
| G1b | Internal any-start-year | 🔧 | 5 | D-G15b | maybe | policy-gated (Charlotte) |

---

## Critical files

| File | Phase | Change |
|---|---|---|
| `src/app/(admin)/applications/[id]/assessment/actions.ts` | 1A | `formStatus === SUBMITTED` guard in begin / proceed-without-second-parent |
| `src/app/(admin)/applications/[id]/assessment/page.tsx` | 1A | gate render on review phase |
| `src/lib/assessment/schooling-years.ts` | 1B | `TOTAL_YEARS_BY_ENTRY` → Yr 13 (8/7/5/2) + comments |
| `prisma/schema.prisma` (doc-comment :676-678) | 1B | "Years 6–13" |
| `src/components/portal/sections/parents-income-form.tsx` | 1C | relabel `:340` PAYE / `:363` self-employed |
| `src/lib/portal/income-model.ts` | 1C | review label `:189` |
| `src/lib/portal/status-projection.ts` | 1D | flip `submittedLabel` `:77` + timeline `:178-186` |
| `src/components/shared/lifecycle-badges.tsx` | 1D | flip badge mirror `:106-121` |
| `docs/product/state-model.md` | 2 | A1/A3/C1/D1/E2 reconciliations |
| `src/app/(admin)/bursary-accounts/[id]/actions.ts` *(new)* | 3A | `withdrawBursaryAccount` |
| `src/lib/bursary-accounts/access.ts` | 3A | verify CLOSED revokes portal access |
| `src/app/(portal)/schedule/` *(new)* + `components/portal/schedule-calendar.tsx` *(new)* | 3B | read-only Yr6→13 calendar |
| `src/lib/db/queries/schedule.ts` | 3B | reuse for portal-scoped read |
| `src/lib/applications/status.ts` | 4A/4B | `discardAssessment`; transition-table edges; explicit reopen |
| `src/app/(admin)/applications/[id]/edit/actions.ts` | 4C | invalidate assessment on material on-behalf change |
| `src/lib/applications/edit-on-behalf.ts` | 4C | reconcile allowed-phases / materiality |
| `src/lib/audit/actions.ts` | 3A/4A | `BURSARY_ACCOUNT_WITHDRAWN`, `ASSESSMENT_DISCARDED` |
| `prisma/migrations/*` *(Phase 4 only, conditional)* | 4B | relax `submitted_at` write-once **iff** "new date on re-submit" |

---

## Migrations

Per `CLAUDE.md`: additive only; new files, never edit applied ones; ship in the
same PR as the code; auto-applied to nonprod via `db-push.yml` on merge to
`staging`.

- **Phases 1–3, 4A, 4C, 5(D2): no schema migrations.** New audit actions are
  string constants in `src/lib/audit/actions.ts` (no DB change). F1/F2 reuse
  existing columns/enums.
- **Phase 4B: one conditional migration** — only if D-G6/D3 = "new submission
  date on re-submit": an additive migration to relax `trg_submitted_at_immutable`
  so `submittedAt` may be cleared to `null` when `form_status` leaves
  `SUBMITTED`. Author via `migrate diff --script`; gate so it cannot blank a date
  on a still-submitted row.
- **Phase 5 (E1, if a new actor is required): migration-heavy** — new `Role`
  enum value + RLS — scoped to its own epic, not this plan.

---

## Testing & verification

- **Unit (vitest, boundary-mock pattern** per
  `applications/[id]/__tests__/schedule-actions.test.ts`**)** — per item above.
  Keep `next build` and `tsc` clean.
- **Calc re-baseline (1B)** — update every `schooling-years` fixture; verify the
  assessment engine outputs against Epic 07's figures before merge.
- **End-to-end (staging preview / nonprod after each phase):**
  1. **B1** — try to begin an assessment on a draft app via the workspace route →
     blocked; submitted app → allowed.
  2. **A2** — a NEW submission shows "Submitted"; a rollover shows "Received"
     across portal status, admin badge, and PDF.
  3. **H1** — the self-employed line reads "Gross earned income"; no duplicate
     "Gross earned income" on the PAYE line.
  4. **F1** — withdraw an `ACTIVE` account → `CLOSED` + `closedAt`; the family's
     portal access is revoked; audit row present; idempotent on re-withdraw.
  5. **F2** — an active family sees the read-only Yr6→13 calendar (correct
     greyed/active years), no action controls, no prior-application access.
  6. **4A/4C** — with an assessment `IN_PROGRESS`, make a material on-behalf edit
     → assessment resets to Not Started + `ASSESSMENT_DISCARDED` audit; a
     completed/decided assessment stays edit-blocked.
  7. **4B** (if built) — reopen a submitted app → `IN_PROGRESS`, data retained,
     assessment discarded; re-submit date behaves per the chosen rule.

---

## Branching / workflow (CLAUDE.md)

1. **Clear P0.1 first** (Brian reconciles `staging` ← `main`). Do not branch new
   epics off a `staging` that lacks CR-001.
2. Then per phase: branch off `staging` (`fix/*` for Phase 1 bugs, `feat/*` for
   Phases 3–4, `docs:` for Phase 2), conventional commits, PR → `staging`, Brian
   reviews & merges. Stacked PRs where items are independent (Phase 1).
3. Migrations (Phase 4B only, conditional) ship in the same PR as their code.
4. **Only Brian promotes `staging` → `main`.** Claude does not open or merge that
   promotion.

## Suggested order

P0.1 + P0.2 → **Phase 1** (1A/1C parallel; 1B after Epic 07 coord; 1D after
D-G2) → **Phase 3** (F1, F2 — independent, high user value) → **Phase 2** (doc
reconciliations, once decisions are confirmed) → **Phase 4** (4A now; 4B/4C after
D-G6/D3) → **Phase 5** (as Charlotte's decisions land).

## Out of scope

- The assessment **calculation** engine itself (Epic 07; awaits Charlotte's real
  historical figures) — 1B only *touches* its input constant and must be
  validated against it.
- Remaining process-alignment client deliverables (D4 reason codes, D11
  declaration text, Epic 09 H7–H10, D6 retention-year DPO sign-off) — tracked in
  [`process-alignment/PROGRESS.md`](process-alignment/PROGRESS.md).
- A distinct admissions role/portal (E1) **if** a new actor is required — its own
  epic.
