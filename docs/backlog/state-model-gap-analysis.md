---
title: Canonical state model — gap analysis
status: open
severity: high
area: status-model, lifecycle, edit-on-behalf, account, rounds, portal
opened: 2026-06-19
opened_by: Brian Wagner (via Claude)
related:
  - ../product/state-model.md
  - ../diagrams/bursary-application-flow.drawio
  - ../contract/change-requests/CR-001-assessor-edit-on-behalf.md
  - ./process-alignment/README.md
  - ./process-alignment/plans/01-status-and-workflow-model.md
  - ./process-alignment/plans/10-data-retention-and-account-lifecycle.md
---

## Context

Gap analysis of the **current system** against the canonical state model
([`docs/product/state-model.md`](../product/state-model.md)) derived from the
signed-off diagram
([`bursary-application-flow.drawio`](../diagrams/bursary-application-flow.drawio))
and the 2026-06-11 review meeting.

**Baseline analysed:** branch `main` @ `e1fb121` — the live/most-current code.
(Note: `staging` is currently *behind* `main` by 27 commits @ `cf4f9e0`; the
process-alignment programme and **CR-001 edit-on-behalf** (PR #206) are on
`main`, not `staging`. This inverts the documented `staging`-ahead workflow and
should be reconciled separately — see [§7](#7-process--git-note).)

**Method:** four parallel read-only code investigations (application/assessment
lifecycle; CR-001 edit-on-behalf; bursary account / school decision / rounds;
income form) plus the Prisma schema and the CR-001 contract. Every claim below
is grounded in `path:line`.

**Headline finding.** The **three-lifecycle foundation already exists** — it was
built by the process-alignment programme (Epics 01–11) and the CR-001 change
request. So this is **not** a greenfield gap; it is (a) a set of refinements and
one **reversal** the June-11 model introduced over what was built, (b) a few
genuinely **missing** features, (c) two latent **bugs**, and — importantly —
(d) several places where **the canonical model itself is out of step with later,
authoritative decisions** (the CR-001 contract; process-alignment decisions D2,
D6). The honest conclusion cuts both ways: some gaps mean *fix the code*; others
mean *fix the model*. The reconciliations are collected in
[§6](#6-decisions-needed-reconciliations).

## Legend

- ✅ **Aligned** — already matches the canonical model.
- 🔧 **Gap** — missing or partial; needs building.
- ⚖️ **Conflict** — canonical model and as-built/contract diverge; needs a
  decision (the as-built may be the *better* answer — see the decision register).
- 🐞 **Bug** — internal inconsistency to fix regardless of the model.

Per the [backlog house style](README.md), `high`/`critical` is reserved for
things affecting correctness today; most items here concern a not-yet-built
*future* requirement and are `low`/`medium`.

---

## What's already aligned (no action)

So the gap list isn't read as "rebuild everything":

- **Three independent lifecycles** exist: `ApplicationFormStatus`,
  `AssessmentStatus`, `BursaryAccountStatus` (`prisma/schema.prisma`). The old
  fused `ApplicationStatus` enum is gone.
- **Immutable submission date** — `submittedAt` is write-once (app guard +
  Postgres trigger, migration `20260605181936_submitted_at_immutable`). The
  canonical "original date kept on document requests" rule is satisfied.
- **Account `ACTIVE`/`CLOSED`** match; award generates a forward
  `BursaryScheduleEntry` schedule + `scheduleYears` (`account-promotion.ts:70-156`,
  `bursary-accounts/schedule.ts:163-211`).
- **Rollover never fails out** — a `ROLLING_OVER` app that does not qualify is
  *not* archived; the account stays `ACTIVE` (`status.ts:498-509`). ✅
- **Edit-on-behalf audit/provenance** — staff edits are attributed to the staff
  member with per-field provenance badges (`edit/actions.ts:214-230`,
  `audit/actions.ts:55-59`). The one canonical pillar of §9 that is fully met.
- **Income form** — 4 of 5 rules already implemented: two-column layout,
  conditional evidence via the rule engine, single self-employed document, and
  the persistent zero-income acknowledgement (`parents-income-form.tsx`,
  `section-rules.ts`, `submission.ts:216-244`). ✅

---

## Gaps by track

### A. Application lifecycle

#### A1 🔧 "Started" state is not implemented · severity: low
- **Canonical:** Sent → **Started** (on open-link + set-password) → In Progress
  (on first field/doc).
- **Current:** `CREATED → IN_PROGRESS → FILLED_IN → SUBMITTED`. `NOT_STARTED`
  exists in the enum but **has no runtime writer** — there is no login/
  password-set trigger (`status.ts:228-240`, which explicitly excludes it:
  "needs login telemetry, unavailable here"). Also, `IN_PROGRESS` is derived from
  a *completed section count* (≥1 section `isComplete`), not "first field or first
  document" — a document upload does not move the form to In Progress.
- **Proposed:** decide whether "Started" is worth a real state (it needs login
  telemetry) or whether `CREATED` is accepted as the pre-work state and the model
  is amended (see [D-G1](#decision-register)). Low-value either way.

#### A2 ⚖️ "Submitted" / "Received" labels are **inverted** · severity: medium
- **Canonical (signed diagram nodes A5/A6):** **new = "Submitted"**, **rollover
  = "Received"**. The transcript confirms ("if it's a rollover it's received, if
  it's new it's submitted" — "Correct").
- **Current:** the opposite — `NEW → "Received"`, `ROLLING_OVER → "Submitted"`,
  applied consistently across portal, admin badge, and PDF. Single source
  `status-projection.ts:76-78`, mirrored in `lifecycle-badges.tsx:106-121`. This
  was built to process-alignment **Decision D2 (2026-06-05)**, which the June-11
  meeting **reversed**.
- **Proposed:** flip the mapping at the single source (+ the badge mirror). Low
  effort, but it reverses a previously *decided* item, so confirm
  ([D-G2](#decision-register)). The diagram wins → flip.

#### A3 ⚖️ No application-side "Submitted with Correction" (built as assessment `PAUSED`) · severity: low
- **Canonical:** a documents request puts the **application** into "Submitted
  with Correction"; the **assessment** has *no* Paused state.
- **Current:** the inverse — the awaiting-docs pause is modelled on the
  **assessment** as `AssessmentStatus.PAUSED` + `pausedUntil`; the form stays
  `SUBMITTED` (`status.ts:467-473`). The process-alignment README calls this "the
  elegant payoff." **Behaviourally equivalent:** original date kept ✓, assessment
  held and resumed via `resumeReview` (`status.ts:423-442`) ✓. The only real
  difference is representation + that the parent sees "Being assessed" throughout
  (no form-track "correction" label).
- **Proposed:** most likely **update the model** to the as-built representation
  rather than rebuild — functionally identical ([D-G3](#decision-register)).

### B. Assessment lifecycle & gate

#### B1 🐞 Assessment gate is only half-enforced (split-brain) · severity: medium
- **Canonical:** an assessment may not begin until the application is
  `SUBMITTED`.
- **Current:** the application-detail "Begin Review" track *does* gate on
  SUBMITTED (via derived review phase), **but** the assessor-workspace
  `beginAssessmentAction` / `createAssessment` / assessment page have **no**
  `formStatus === SUBMITTED` guard (`assessment/actions.ts:73-115`,
  `assessment/page.tsx:128-174`) — an assessment row can be created on a *draft*
  application via that route. The intent comment exists but only the
  secondary-parent half is implemented.
- **Proposed:** add the server-side `formStatus === SUBMITTED` guard to
  `beginAssessmentAction`/`createAssessment`. Small, closes a real invariant hole.

### C. Post-submission edits & send-backs

#### C1 ⚖️ Reject is "void + recreate", not "hard-reset in place" · severity: low
- **Canonical:** REJECT → the **same** application hard-resets to "Started",
  login kept, all fields cleared, no submission date; assessment discarded.
- **Current:** the application row is **hard-deleted** (cascading
  sections/contributors/documents/assessment + Storage files) and a **new blank
  `CREATED`** application is created reusing the old `reference`
  (`create-from-invitation.ts:154-184`, `actions.ts:349-506`). Net outcome is
  close (fields cleared ✓, no submission date ✓, assessment gone ✓, login kept
  ✓) but the row id changes, old data is destroyed rather than retained-then-
  reset, and it lands at `CREATED` not "Started". The `@@unique(round, lead,
  child, dob)` constraint is the cited reason in-place reset wasn't done.
- **Proposed:** likely **accept** the void+recreate outcome and amend the model's
  wording ([D-G5](#decision-register)); verify the destroy-old-data behaviour is
  GDPR-acceptable.

#### C2 🔧 No "material change → back to In Progress" soft send-back · severity: medium
- **Canonical:** material change → application back to **In Progress** (fields
  kept), re-submission needed, **new** submission date on re-submit.
- **Current:** **no such path.** `SUBMITTED` is terminal in the form transition
  table (`FORM_TRANSITIONS.SUBMITTED = []`), `submittedAt` is write-once (so "new
  date on re-submit" is impossible without delete+recreate), and the only
  "go back for changes" option is the destructive Reject & Restart
  (`application-actions.tsx:10-14`).
- **Proposed:** introduce a soft send-back transition (SUBMITTED → IN_PROGRESS
  keeping data) + relax/duplicate the submission-date rule for the re-submit.
  Couples with C3 and D3. Needs a decision on the date semantics.

#### C3 🔧 Material change does **not** discard / re-run an in-progress assessment · severity: **high**
- **Canonical:** any material change to submitted data **discards** an
  in-progress assessment, which must be re-run.
- **Current:** **no assessment "reset to Not Started" primitive exists** — the
  `ASSESSMENT_TRANSITIONS` table has no edge back to `NOT_STARTED`, `COMPLETED`
  is terminal, and discard happens *only* via cascade-delete during reject.
  Crucially, **CR-001 edit-on-behalf amends submitted data in place without
  touching the assessment** (`edit-on-behalf.ts:18-32`) — editing is *allowed*
  while the assessment is In Progress, with no invalidation. So staff can change
  household/income source data under a live assessment and the assessment is
  never flagged for re-run.
- **Why high:** this is a live process-integrity hole on a merged feature. It is
  staff-controlled (the assessor enters the calc inputs separately, so it is not
  silent applicant-driven corruption), but the canonical invalidation rule is
  simply absent.
- **Proposed:** add an assessment-invalidation path (reset to `NOT_STARTED` /
  flag re-run) triggered by a material change to a submitted application,
  including via edit-on-behalf. Couples with C2/D3.

### D. Edit-on-behalf (CR-001) vs canonical §9

> CR-001 is a **signed change request under MSA clause 9.5** (£600, new feature
> excluded from the licence fee). It was drafted/built **after** the June-11
> meeting and **deliberately departs** from the meeting's "impersonation" idea.
> So D1/D2 below are **doc reconciliations**, not code defects — the as-built may
> be the better, contractually-agreed answer. D3 is a genuine functional gap.

#### D1 ⚖️ Mechanism: scoped direct-write (built) vs impersonation (model §9) · severity: reconcile
- **Canonical §9:** *impersonation* — staff act within the applicant's identity;
  no direct staff write path.
- **Current:** *scoped edit-on-behalf* — staff stay logged in as themselves and
  write directly into the applicant's `ApplicationSection.data`, stamping
  per-field provenance. The form UI is the applicant's own ten sections (reused),
  but the identity/authorship model is the inverse of §9. Impersonation is
  **explicitly rejected** in the contract on audit-trustworthiness grounds
  (`CR-001-...md:56-69, 123`).
- **Proposed:** **rewrite canonical §9** to the scoped-edit mechanism — it is
  later, contractual, and better-audited ([D-G8](#decision-register)). Unless the
  Customer wants to revisit impersonation, this is a model fix, not a build.

#### D2 ⚖️ Edit-on-behalf auto-sends an email (model §9: no auto-comms) · severity: low
- **Canonical §9:** *no* automated/templated email; staff notify personally
  (Charlotte, June 11: "none of the communications for that for now").
- **Current:** `APPLICATION_EDITED_ON_BEHALF` is **auto-sent** on "Finish
  editing", template **enabled by default** (`edit/actions.ts:350-364`;
  seed `email-templates.ts:457-484`; default-enabled migration
  `20260524190000`). This was a **deliberate CR decision** — D-CR1-1 chose
  option (b), "notify by email," on GDPR-transparency grounds.
- **Direct conflict** between the meeting (no email) and the CR (send email). It
  is a per-template toggle, so trivially reconcilable either way — but someone
  must choose ([D-G9](#decision-register)). **Needs Charlotte.**

#### D3 ⚖️/🔧 Edit-on-behalf status & date semantics · severity: medium
- **Canonical §9:** to edit a submitted app, move it back to In Progress, edit,
  re-submit with a **new** date.
- **Current:** a SUBMITTED app is edited **in place** and stays SUBMITTED
  (`status.ts:286-287` returns early on SUBMITTED); a new `submittedAt` is written
  **only** on the `FILLED_IN` submit-on-behalf path, never when amending an
  already-submitted form. So on-behalf amendments keep the original date and never
  pass back through In Progress.
- **Proposed:** decide the post-submission-edit semantics once for C2/C3/D3
  together: does an amendment (a) reset the date, (b) pass back through In
  Progress, (c) discard the assessment? Recommend at minimum (c) for integrity.

### E. School decision & outcome

#### E1 ⚖️ No distinct School/Admissions decision step or actor · severity: low-medium
- **Canonical:** for new applications the **School/Admissions** decides
  Offered/Declined *after* the assessor reports.
- **Current:** folded into the **assessor/admin** recording a 3-value
  `AssessmentOutcome` (`AWARDED` / `QUALIFIES_NOT_AWARDED` / `DOES_NOT_QUALIFY`)
  on the recommendation form (`recommendation-form.tsx:226-246`,
  `set-outcome-core.ts:138-248`). There is **no** admissions role/portal/handoff
  (`Role` = APPLICANT/ASSESSOR/VIEWER/ADMIN/DELETED, `schema.prisma:663-668`).
  Award ≈ Offered, Decline ≈ Declined.
- **Proposed:** decide whether a distinct admissions handoff/step is required, or
  whether "assessor records the school's decision" is sufficient
  ([D-G11](#decision-register)). **Needs Charlotte.**

#### E2 ⚖️ Decline ≠ "close & purge"; purge is separate, time-gated, dry-run · severity: low
- **Canonical:** Declined → account Closed **and** data purged.
- **Current:** decline sets `DOES_NOT_QUALIFY` + `archivedAt` (NEW only), leaves
  the account untouched, and purge runs later via the **tiered retention** cron
  (default 30-day grace), gated behind `RETENTION_PURGE_ENABLED` (currently
  report-only) (`status.ts:498-508`, `retention/policy.ts:62-68`,
  `api/cron/purge-expired/route.ts`). This is the **process-alignment D6** model,
  which is arguably *better* (GDPR grace + tiered years) than immediate purge.
- **Proposed:** **update the model** to reference the D6 tiered-retention policy
  rather than "purge immediately" ([D-G12](#decision-register)). (DPO sign-off on
  the retention years remains an open process-alignment deliverable.)

### F. Account lifecycle operations

#### F1 🔧 No account-level withdrawal action · severity: medium
- **Canonical:** an assessor can close the account **at any time, account-level,
  no documents** → Closed (e.g. parent says the child is leaving).
- **Current:** **missing.** The only `CLOSED` writer is `closeAccountIfComplete`
  (automatic, when every schedule entry is COMPLETE) (`lifecycle.ts:39-64`). A
  docstring references a "manual-close server action" that **does not exist**.
- **Proposed:** build an admin account-level "withdraw / close" action (sets
  `CLOSED` + `closedAt`, revokes portal access), available in any state, no docs.

#### F2 🔧 No parent-facing read-only schedule calendar (Yr 6 → Yr 13) · severity: medium
- **Canonical:** active families see a **read-only calendar** of the full Yr 6 →
  Yr 13 span (years outside the award greyed), informational only, with no access
  to prior application data.
- **Current:** **missing in the portal.** The schedule grid is **admin-only**
  (`applications/[id]/page.tsx:414`); `BursaryScheduleEntry.showOnPortal` is
  maintained but **never read by any portal component** (zero refs under
  `src/app/(portal)/`). Active families get a `ReassessmentCard` when invited +
  a `/status` page. (No prior-application access — that part holds, by omission.)
- **Proposed:** add a portal schedule/calendar view consuming `showOnPortal`
  entries. The transcript stressed this reassurance matters ("it's stressful not
  to see"). Data plumbing already exists.

### G. Rounds & funding rules

#### G1 🐞/🔧 Final-year inconsistency + no "internal = any start year" · severity: medium
- **Canonical:** full Yr 6 → Yr 13 span (8 rounds); standard start Yr 6/7/9/12;
  **internal can start any year**; funding max 8 / min 1.
- **Current:** length clamp `[1, 8]` ✓ (`schedule.ts:64-75`). **But:**
  - 🐞 `FINAL_ELIGIBLE_SCHOOL_YEAR = 13` (`schedule.ts:32`) **disagrees** with
    `schooling-years.ts:16-21` which caps schooling at Year **12** (Y6→7, …,
    Y12→1). The two modules compute different final years; the just-merged commit
    `e1fb121` ("fix bursary round span to Yrs 6–13") implies **13 is intended**,
    making `schooling-years.ts` the fix target (and a possible undercount in
    "schooling years remaining" feeding the calc — verify).
  - 🔧 No "internal bursaries start at any year" path — both standard and internal
    use the fixed `EntryYearGroup` (Y6/Y7/Y9/Y12/OTHER); `OTHER` is the only
    escape, with manual handling. The standard Y6/7/9/12 rule is not enforced as a
    rule (entry year is admin-locked at invite, D1).
- **Proposed:** fix the 12-vs-13 discrepancy (a real bug); decide the internal
  any-year policy ([D-G15](#decision-register)).

### H. Income form

#### H1 ⚖️ "Gross earned income" rename landed on the wrong line · severity: low
- **Canonical:** the **self-employed** earned-income line is labelled "Gross
  earned income" (to capture sole traders *and* director-salaried owners).
- **Current:** the self-employed line still reads **"Gross salaried income"**
  (`parents-income-form.tsx:363`, field `grossSalaried`, review label
  `income-model.ts:189`) — the exact wording the meeting asked to drop. "Gross
  earned income" *does* appear, but on the **PAYE/Employed** line
  (`parents-income-form.tsx:340`).
- **Proposed:** relabel the self-employed line to "Gross earned income" (label
  only; the `grossSalaried` field key can stay). Trivial.

---

## Summary table

| ID | Gap | Type | Severity | Resolution |
|---|---|---|---|---|
| A1 | "Started" state not implemented | 🔧/⚖️ | low | D-G1 |
| A2 | Submitted/Received labels inverted | ⚖️ | medium | flip code (D-G2) |
| A3 | No app-side "Submitted with Correction" (built as assessment PAUSED) | ⚖️ | low | update model (D-G3) |
| B1 | Assessment gate half-enforced | 🐞 | medium | add guard |
| C1 | Reject = void+recreate, not in-place reset | ⚖️ | low | accept/amend model (D-G5) |
| C2 | No material-change soft send-back | 🔧 | medium | build (D-G6/D3) |
| C3 | Material change doesn't discard in-progress assessment | 🔧 | **high** | build |
| D1 | Edit-on-behalf is scoped-write, not impersonation | ⚖️ | reconcile | rewrite §9 (D-G8) |
| D2 | Edit-on-behalf auto-email vs "no comms" | ⚖️ | low | Charlotte (D-G9) |
| D3 | Edit-on-behalf status/date semantics | ⚖️/🔧 | medium | decide w/ C2/C3 |
| E1 | No distinct School/Admissions decision actor | ⚖️ | low-med | Charlotte (D-G11) |
| E2 | Decline ≠ close & purge (tiered retention instead) | ⚖️ | low | update model (D-G12) |
| F1 | No account-level withdrawal action | 🔧 | medium | build |
| F2 | No parent-facing Yr6–13 schedule calendar | 🔧 | medium | build |
| G1 | Final-year 12-vs-13 bug + no internal any-year | 🐞/🔧 | medium | fix bug (D-G15) |
| H1 | "Gross earned income" rename on wrong line | ⚖️ | low | relabel |

---

## 6. Decisions needed (reconciliations)

These reverse or restate prior decisions and need a human call (Brian, or
Charlotte where noted). Recommendations are the Supplier's view.

| # | Decision | Recommendation | Owner |
|---|---|---|---|
| **D-G1** | Implement a real "Started" state (needs login telemetry), or accept `CREATED` as the pre-work state and amend the model? | Amend model; skip telemetry | Brian |
| **D-G2** | Flip Submitted/Received to match the signed diagram (reverses built D2)? | **Flip** — diagram wins | Brian (notify Charlotte) |
| **D-G3** | Keep as-built assessment `PAUSED` (update model) or add app-side "Submitted with Correction"? | **Update model** — functionally identical | Brian |
| **D-G5** | Accept reject = void+recreate, or require in-place reset? | Accept; amend model wording | Brian |
| **D-G8** | Rewrite canonical §9 to the CR-001 scoped-edit mechanism (impersonation rejected by contract)? | **Yes** — CR-001 is contractual & better-audited | Brian (Customer already signed CR-001) |
| **D-G9** | Edit-on-behalf: keep the auto-email (CR D-CR1-1 (b)) or honour "no auto-comms" (June 11)? | Confirm with Charlotte | **Charlotte** |
| **D-G6/D3** | Post-submission edit semantics: reset date? pass back through In Progress? discard assessment? | At minimum **discard the assessment** (C3); align date rule | Brian/Charlotte |
| **D-G11** | Model a distinct admissions Offered/Declined step/actor, or keep "assessor records the school's decision"? | Confirm with Charlotte | **Charlotte** |
| **D-G12** | Reconcile "purge on decline" (model) with tiered retention (D6, built)? | **Update model** → D6 policy | Brian (DPO for years) |
| **D-G15** | Final eligible year 12 vs 13, and internal-bursary any-start-year policy? | 13 per `e1fb121`; confirm internal policy | Brian/Charlotte |

## Corrections the canonical model doc needs

This analysis shows [`state-model.md`](../product/state-model.md) (written
2026-06-19) is itself already out of step with later authoritative decisions —
worth fixing **once the decisions above land**:

- **§9 (edit-on-behalf):** rewrite from "impersonation" to CR-001 scoped-edit
  (pending D-G8/D-G9). The diagram is silent on mechanism, so this does not
  violate "diagram wins".
- **§4/§6 (pause):** reconcile "Submitted with Correction" vs assessment `PAUSED`
  (pending D-G3).
- **§5 (decline):** "close & purge" → tiered retention per D6 (pending D-G12);
  note the school-decision actor question (D-G11).
- **§10 (rounds):** confirm Yr 13 final year (the diagram and `schedule.ts` say
  13; `schooling-years.ts` says 12 — a bug, not a model issue).
- Labels in §3/§8 are **correct** (new = Submitted) — the *code* is what's wrong
  (A2), not the doc.

## 7. Process / git note

`main` is 27 commits **ahead** of `staging`, the inverse of the documented
`staging`-ahead-of-`main` workflow (repo `CLAUDE.md`). CR-001 (#206) and the
diagram (`e1fb121`) are on `main` only. Any follow-on work branched off
`staging` per the workflow would **not** include CR-001 or the latest diagram.
This should be reconciled (sync `staging` up to `main`) before the next epic
branches — flagged for Brian; out of scope for this analysis.

## Out of scope

- Implementation of any fix — this is the analysis only.
- Re-validating the assessment **calculation** engine (process-alignment Epic 07;
  awaits Charlotte's real historical figures).
- The outstanding process-alignment client deliverables (D4 reason codes, D11
  declaration text, Epic 09 household H7–H10, D6 retention years) — tracked in
  [`process-alignment/PROGRESS.md`](process-alignment/PROGRESS.md).
