# Process Alignment — execution ledger

> **What this is.** The living *state* surface for the process-alignment
> programme. The [`plans/`](plans/) files are the **spec**; this file is the
> **progress**. Read it first at the start of every work session to recover
> where execution stands. Update it **inside the same PR** that completes a
> task so the tick rides the squash-merge into `staging` and is never lost to a
> separate clobberable commit.
>
> **Spec:** [README.md](README.md) (spine + decision register). **Owner:** Brian Wagner.

**Started:** 2026-06-05 · **Current focus:** Wave 1 — Epic 03 shipped; Epic 04 (contact register) in progress.

---

## How this ledger is maintained (rules)

1. **One epic ≈ one branch off `staging`**; one PR per work-breakdown item.
2. **Tick a box in the PR that completes it** — never in a standalone commit
   that a later rebase could overwrite. After each merge, `git pull` staging and
   rebase open epic branches so this ledger stays the single current truth.
3. **Never force-overwrite this file.** Advance epic-plan frontmatter
   `status:` (`planned → ready → in-progress → shipped`) the same way.
4. Migrations are **additive → backfill → tighten**, each in the PR that needs
   it; never edit an applied migration.
5. **Brian merges to `staging`; Brian alone promotes `staging → main`.**
   No auto-merge of these PRs.

---

## Wave / epic status

Legend: ⬜ not started · 🟡 in progress · ✅ shipped to staging · 🚫 blocked · ⏸ deferred

| Wave | Epic | Status | Blocked by | Branch / PRs |
|---|---|---|---|---|
| — | Scaffolding (plans + this ledger) | ✅ | — | #133 (+ #140 reconcile) |
| 0 | [12 Defect fixes](plans/12-defect-fixes.md) | ✅ | — | #134–#139 |
| 1 | [01 Status & workflow model](plans/01-status-and-workflow-model.md) | ✅ | — | #141 (PR-1 schema), #142 (PR-2 backfill), #143 (PR-3 status service), #144 (PR-4 readers+badges), #145 (PR-5 submitted_at write-once); **PR-6 drop-column ⏸ gated** |
| 1 | [03 Round management](plans/03-round-management.md) | ✅ | 01 | #146 (PR-A schema+server core), #147 (PR-B UI) |
| 1 | [04 Lead-applicant contacts & invitations](plans/04-lead-applicant-contacts-and-invitations.md) | 🟡 | 01 | feature/04-* — PR-1 contact register (schema+CRUD+seed), PR-2 invite-from-contact + locking, PR-3 twin/DOB uniqueness |
| 2 | [02 Application form re-scope](plans/02-application-form-rescope.md) | ⏳ deps | 01, 04 (deps) · D3 ✅ · D11 artifact (build to workbook) | — |
| 2 | [05 Parent portal experience](plans/05-parent-portal-experience.md) | ⏳ deps | 01, 02, 03 (deps) · D10 ✅ | — |
| 3 | [06 Assessor experience & UI](plans/06-assessor-experience-and-ui.md) | ⏳ deps | 02 (dep) | — |
| 3 | [07 Calculations & fees](plans/07-assessment-calculations-and-fees.md) | ⏳ deps | 06 (dep) · D8/D14 narrow, non-blocking | — |
| 3 | [08 Recommendation & outcome](plans/08-recommendation-and-outcome.md) | ⏳ deps | 01, 07 (deps) · D7/D9 ✅ · D4 artifact (placeholders) | — |
| 3 | [09 Complex household / second parent](plans/09-complex-household-and-second-parent.md) | ⏳ deps | 02, 06 (deps) · D15–D17 build to workbook FAQ | — |
| 4 | [10 Data retention & account lifecycle](plans/10-data-retention-and-account-lifecycle.md) | ⏳ deps | 01, 03 (deps) · D6 ✅ (DPO signs years) · D19 narrow | — |
| 4 | [11 Auth & access](plans/11-auth-and-access.md) | ⬜ | none · D21 ✅ (SSO deferred) · D20 ✅ (idle watcher) | — |

---

## Wave 0 — defect fixes (Epic 12) — ✅ SHIPPED

Six independent PRs off `staging`, no schema, no migrations. All merged with
build/typecheck/tests green.

- [x] **PR-A** #134 — show-names toggle: ADMIN+ASSESSOR allowed at `names/route.ts`; client `catch` surfaces error + resets state. *(critical)*
- [x] **PR-B** #135 — reference-data save: `createdAt desc` tie-break on the 5 versioned reads in `reference-tables.ts`; no schema. *(critical)*
- [x] **PR-C** #136 — round create/edit return `{success:true}`; dialog navigates client-side; unused `redirect` import removed. *(high)*
- [x] **PR-D** #137 — new `lib/datetime.ts` Europe/London helper; audit page + applications-table dates use it. *(high)*
- [x] **PR-E** #138 — stale `status-badge.tsx` union `@deprecated` (live callers remain → Epic 01 replaces). *(medium)*
- [x] **PR-F** #139 — role-aware wordmark/aria/account label; ADMIN copy no longer shown to ASSESSOR/VIEWER. *(medium)*
- [ ] **(no PR)** — user guide: `docs/guides/JWF-Bursary-System-User-Guide.pdf` to be sent as the durable fallback. *(process — Brian)*

**Verification note.** All six passed lint + typecheck + 221 unit tests + build.
**Behavioural (Playwright) verification was NOT run** — the local demo seed creates
Profile rows only (no Supabase auth users/passwords), and nonprod is shared. The
fixes are surgical and code-verified; confirm live on the staging preview during
Monday testing (esp. PR-A show-names and PR-C round-create).
**Resolved same-line decision:** VIEWER name reveal — implemented ADMIN+ASSESSOR
only; confirm with Charlotte only if VIEWER must reveal.

---

## Active — Epic 01 (status & workflow model)

Keystone of Wave 1. Single branch lineage off `staging`; six sequential PRs
(`additive → backfill → tighten`). Schema column `applications.status` (the old
fused enum) is kept through PR-1→PR-5 and dropped only in **PR-6** once every
reader is migrated.

- [x] **PR-1** #141 — additive schema: new enums (`ApplicationFormStatus`,
  `ApplicationType`), `AssessmentStatus.IN_PROGRESS`, 3-value
  `AssessmentOutcome`; new columns `form_status`/`application_type`/`archived_at`
  + `assessments.paused_until`; legacy `status` marked `@deprecated`. Enum DDL
  split from column DDL across two migrations (PG `ADD VALUE`-in-txn safety).
- [x] **PR-2** #142 — backfill: deterministic, idempotent DML mapping the legacy
  fused `status` onto the new columns (§5.1 table + D-note). Writes only the new
  columns; never touches `status`.
- [x] **PR-3** #143 — central status service (`src/lib/applications/status.ts`):
  single transition writer with legacy `status` dual-write; migrated every
  scattered writer (apply/assessments/admin/portal/set-outcome-core/creates);
  persists `paused_until` (email reads it); pause no longer touches form_status.
  Behaviour-preserving; 13 new unit tests (234 total green). No stray status
  writes remain (grep-clean).
- [x] **PR-4** #144 — runtime form-status derivation (saveSection →
  refreshFormStatus, agrees with backfill); first assessor save → real
  IN_PROGRESS (saveAssessmentAction no longer re-pins NOT_STARTED;
  ASSESSMENT_TRANSITIONS now strict). Typed badges (FormStatusBadge /
  AssessmentStatusBadge / OutcomeBadge + parent-safe projection); stale
  `status-badge.tsx` removed, its 3 callers migrated (admin layout, queue table,
  portal dashboard). Readers migrated: dashboard "in progress" = assessment
  IN_PROGRESS|PAUSED (was PAUSED-only bug); assessment header pill. Cockpit
  untouched. 238 tests green.
- [x] **PR-5** — `submittedAt` write-once trigger migration + app invariant + test.
- [ ] **PR-6** — ⏸ **deferred / gated**: drop the deprecated fused `status`
  column once all readers are migrated (cut over reports/dashboard/cockpit
  queries first; CI grep-gate clean). Gated on Brian's confirmation that no
  external/report consumer reads the old string.

> **PR-6 prerequisite (enum cleanup).** Before dropping the legacy `QUALIFIES`
> value from the `AssessmentOutcome` enum, remap any residual
> `assessments.outcome = 'QUALIFIES'` rows (≈1 on nonprod — a COMPLETED-status
> app whose outcome predates the 3-value lifecycle) to `AWARDED` /
> `QUALIFIES_NOT_AWARDED` by `applications.bursary_account_id` presence, the same
> discriminator PR-2/PR-3 use. The dual-write means new outcomes are already
> written as the 3-value enum; this only catches pre-PR-3 rows.
>
> **PR-6 — remaining legacy `applications.status` readers (after PR-4).** PR-4
> moved all *display* reads to the lifecycle columns. What still reads the fused
> `status` and must be cut over before the column is dropped:
> 1. **Transition gating** — `(admin)/applications/[id]/actions.ts` and
>    `set-outcome-core.ts` read it as the transition *source*; `ApplicationActions`
>    + recommendation page gate buttons on it. Switch these to read
>    `form_status` + `assessment.status`/`outcome`.
> 2. **Round cockpit / watchlist** — `round-cockpit.ts` `DECIDED_STATUSES` and
>    `round-watchlist-eval.ts` `decidedStatuses` test QUALIFIES/DOES_NOT_QUALIFY;
>    `round-watchlist.ts` surfaces `app.status`. Re-key onto `assessment.outcome`.
> 3. **Parent portal (Epic 05)** — `(portal)/status/page.tsx` timeline and the
>    doc-response guards in `(portal)/actions.ts` + `respond/page.tsx`
>    (`status !== "PAUSED"`). Owned by Epic 05's portal status UX; coordinate.
> 4. **Reports/exports/queue** — `reports.ts` outcome branches + `listApplications`
>    status filter + `ALL_STATUSES`/`STATUS_LABELS` in `application-table.tsx`
>    (queue filter is still fused-status-keyed by design).
> The deprecated `ApplicationListItem.status` field is JSDoc-flagged.

---

## Active — Epic 03 (round management)

Wave 1, depends on Epic 01 (shipped). Plan §6 lists 8 PR-sized items; executed as
**two cohesive PRs** off `staging` (schema+server core, then UI) — PR-A is the
structural keystone, PR-B the UX slices. Each migration ships in the PR that
needs it.

**PR-A — schema + concurrent-rounds + per-app-deadline server core** (this PR):
- [x] §6 PR-1 — `Application.submissionDeadlineAt DateTime?` + additive migration
  `20260605190000_application_submission_deadline` (nullable, no default,
  timestamptz); `effectiveSubmissionDeadline()` helper in
  `src/lib/rounds/submission-deadline.ts` (override wins; null ⇒ round close
  end-of-day) + 9 unit tests.
- [x] §6 PR-2 — single-OPEN guard **softened** behind `ROUNDS_SINGLE_OPEN_ONLY`
  (default OFF → concurrent rounds allowed, D13); `listOpenRounds()` added;
  `getActiveRound` doc reframed as *default-only*; **bulk re-assessment** action
  takes an explicit `targetRoundId`, validates OPEN, refuses to guess when >1
  OPEN and none chosen.
- [x] §6 PR-3 (server half) — `rounds/current` deterministic doc; queue
  reassess-eligible resolves against the scoped `roundId` not "the" open round.
- [x] §6 PR-5 (server half) — `setSubmissionDeadlineAction` + new
  `SET_SUBMISSION_DEADLINE` audit action (set/clear, ADMIN-gated, audited).

**PR-B — UI slices** (this PR):
- [x] §6 PR-3 (UI) — round selector on admin dashboard (reused
  `RoundSelector`; queue + reports already accept `roundId`).
- [x] §6 PR-4 — "Edit/extend dates" dialog (`edit-round-dialog.tsx`) on round
  detail → `updateRoundAction` (DRAFT + OPEN; "Extend dates" framing when OPEN);
  cockpit recomputes from new `closeDate` (field unchanged).
- [x] §6 PR-5 (UI) — admin per-app deadline override control
  (`submission-deadline-card.tsx`); effective-vs-inherited display with marker.
- [x] §6 PR-6 — invite picker filtered to live (OPEN) rounds; two-option
  segmented control for ≤2, `Select` fallback.
- [x] §6 PR-7 — single parent invite confirmation step (recipient + round) AND
  staff invite confirmation (recipient + role) — both meet §10 acceptance.
- [x] §6 PR-8 — demo seed: two concurrently-OPEN rounds + 2 per-app deadline
  overrides (1 later, 1 earlier).

> Epic 04 owns the invitation/contact-register rework; this epic leaves clear
> seams (picker filter + confirmation only) and does not restructure the invite
> data model.

---

## Active — Epic 04 (lead-applicant contacts & invitations)

Wave 1, depends on Epic 01 (shipped). Plan §6 lists 7 PR-sized items; executed as
**three cohesive PRs** off `staging`. PR-1 is independent; PR-2 and PR-3 stack on
PR-1's `Contact` model (both branch off PR-1's branch). **Merge order: PR-1 →
PR-2 → PR-3.** Plan §6 PR-6 (round-picker filter) is ALREADY DONE by Epic 03
(#147, invite picker filtered to OPEN rounds), so it is not re-implemented here.

**PR-1 — contact register: schema + CRUD + seed** (§6 PR-1, PR-2, PR-7):
- [x] §6 PR-1 — additive migration `20260605200000_contact_register`: new
  `contacts` table (+RLS: staff-read, ADMIN-write); nullable
  `applications.contact_id`, `invitations.contact_id` +
  `invitations.entry_year`/`entry_year_group` (the invite now carries the locked
  entry-year forward — D1). Zero backfill. `Contact @@unique([profileId,
  childName, childDob])` (twins, D12); NULL-profile caveat documented + an
  app-layer creator-scoped dupe guard covers it.
- [x] §6 PR-2 — `/contacts` register (ADMIN nav item) + `createContactAction` /
  `updateContactAction` / `archiveContactAction` (required lastName/email/
  childName/school/entryYear; childDob recommended; structured address; audit
  logs; friendly "already a contact for that child" dupe error). Searchable
  table + create/edit dialog + archive confirm.
- [x] §6 PR-7 — demo seed: 5 contacts across every linkage state (fresh / bound
  to registered family / returning ACTIVE-account) incl. a **twin pair** (same
  childName, distinct childDob) proving the D12 key.
- [x] `missingRequiredInviteFields` / `isContactInviteReady` helpers (the D1
  locked-school invariant lives here, reused by PR-2's from-contact action) + 9
  unit tests.

**PR-2 — invite from contact + D1 locking + clarity** (§6 PR-3, PR-4):
- [x] `sendInvitationFromContactAction` (reuses the hardened invite/rollback:
  auth-user-up-front, withAdminContext tx, email inside rollback boundary);
  asserts the contact carries the required locked set; binds `Contact.profileId`
  on first invite; carries `entryYear`/`entryYearGroup` + `contactId` on the
  invitation. Round picker (OPEN only) + confirmation summary on `/contacts`.
- [x] Shared `createFirstYearApplicationFromSource` helper — the ONE place a
  first-year app is created from invitation/contact data; stamps LOCKED
  school/entryYear/entryYearGroup + `Application.contactId`. All three callers
  (register accept, portal onboarding card, from-contact) routed through it so
  the lock lives in one place. 6 unit tests on the helper + lock invariant.
- [x] Lock-enforcement in `startApplicationAction`: when the invitation fixes
  the school (seeded from the contact) it is authoritative — the parent-supplied
  school/childName are IGNORED (`invitation.school ?? school`). The read-only
  seam for Epic 02's form is `invitation.entryYear`/`entryYearGroup` carried onto
  the application; Epic 02 removes the parent selectors.
- [x] Tightened single-send `InvitationSchema` + `send-invitation-form.tsx` —
  lastName/childName/school now REQUIRED, `__none__` school sentinel dropped;
  school added to the confirm summary. Parent-vs-staff clarity: `/invitations`
  reframed "Invite a family to apply" with a link to `/users` for staff and a
  prominent "invite from the contact register" recommended-path card; the quick
  form demoted/relabelled.

**PR-3 — twin/DOB uniqueness (backfilled)** (§6 PR-5) — *pending*:
- [ ] Backfill `applications.child_dob` from `CHILD_DETAILS` JSONB; add
  `@@unique([roundId, leadApplicantId, childName, childDob])`; keep the old
  childName-only unique transitionally, verify counts, drop it in the cutover
  migration. READ-ONLY validation queries for nonprod precede the merge.

---

## Decision register — execution view

Mirrors [README §5](README.md#5-decision-register). Reconciled 2026-06-05 against
`meeting-findings.md` + `feedback.md`: Charlotte decided most "Charlotte" items in
the meeting — the register was written too defensively. ✅ = decided, safe to build.
📦 = **deliverable** she still owes (build to a working default now, swap on arrival).
🔎 = narrow technical confirm (build to default, flag).

| # | Owner | Status | Gates |
|---|---|---|---|
| D1 | Brian | ✅ school locked at invite; Q1 read-only; entry-year admin-side | 02, 04 |
| D2 | Brian | ✅ single `SUBMITTED` state, label by `applicationType` | 01, 05 |
| D5 | Brian | ✅ tax-year derives from `Round.academicYear` | 02 |
| D12 | Brian | ✅ one account per child keyed (childName + DOB) | 04 |
| D18 | Brian | ✅ status-keyed portal guard; `DELETED` = erasure only | 10 |
| D20 | Brian/Charlotte | ✅ build optional idle watcher; window TBC | 11 |
| D3 | Charlotte | ✅ rebuild form to workbook (meeting) | 02 |
| D7 | Charlotte | ✅ remove unused assessor PDF (meeting) | 08 |
| D9 | Charlotte | ✅ scholarship as distinct award (meeting) | 08 |
| D10 | Charlotte | ✅ display supplied T&Cs; record acceptance (feedback) | 05 |
| D13 | Charlotte | ✅ two concurrent rounds, 2-optimised UI (meeting) | 03 |
| D21 | Charlotte | ✅ SSO backlog — spike only, defer build (meeting) | 11 |
| D6 | Charlotte (+DPO) | ✅ purge declined / 6-yr q-n-a / 7-yr awarded (meeting); DPO signs year values | 10 |
| D4 | Charlotte | 📦 real reason codes — build on placeholders, swap when sent | 08 |
| D11 | Charlotte | 📦 final declaration text — build workbook-verbatim, swap if sent | 02 |
| D8 | Charlotte/finance | 🔎 VAT 20% applicability (not raised in meeting) — keep current, flag | 07 |
| D14 | Charlotte | 🔎 fee-uplift boundary split rule — default current-yr/12, flag | 07 |
| D15–D17 | Charlotte/Brian | 🔎 household scenario fine-detail — build to workbook FAQ; H7/H9 stay assessor flags | 09 |
| D19 | Charlotte | 🔎 forward-schedule horizon + date policy — default years-to-final-eligible | 10 |

**Nothing is decision-blocked.** The only real sequencing constraint is the
dependency graph (the waves). The two 📦 items (reason codes, declaration text) are
swap-in artifacts with working defaults. 🔎 items are narrow confirmations that
don't gate starting their epic. Critical path is purely: Wave 0 → 01 → {03, 04} →
Wave 2 → Wave 3 → Wave 4.

---

## Change log

- **2026-06-05** — **Epic 04 PR-2** (invite from contact + D1 locking +
  clarity): `sendInvitationFromContactAction` seeds a parent invite from a
  contact (OPEN-round picker + confirmation, binds `Contact.profileId`, carries
  the locked entry-year). Shared `createFirstYearApplicationFromSource` helper
  now backs all three first-year app-create paths and stamps the LOCKED
  school/entry-year + `Application.contactId` in one place;
  `startApplicationAction` ignores parent-supplied school when the invitation
  fixes it (D1). Single-send invite now requires surname/child/school (`__none__`
  sentinel gone); `/invitations` reframed as the family-invite page with a
  recommended "invite from the contact register" card and a staff-invite pointer.
  tsc/format/build green, 265 tests green (+6).
- **2026-06-05** — **Epic 03 marked ✅** (#146 PR-A + #147 PR-B shipped to
  staging). **Epic 04 opened**: PR-1 (contact register) — additive
  `20260605200000_contact_register` migration (new RLS-guarded `contacts` table,
  nullable `applications.contact_id` + `invitations.contact_id`/`entry_year`/
  `entry_year_group`, `Contact @@unique([profileId,childName,childDob])` for the
  D12 twin key); `/contacts` ADMIN page with create/edit/archive CRUD + dupe
  guard; `missingRequiredInviteFields` D1 invite-readiness helper; demo seed gains
  5 contacts incl. a twin pair. prisma format/validate/tsc/build green, 259 tests
  green (+9). PR-2 (invite-from-contact + locking) and PR-3 (twin/DOB app
  uniqueness, backfilled) to follow on stacked branches.
- **2026-06-05** — **Epic 03 PR-B (UI)**: dashboard round selector (concurrent
  rounds); "Edit/extend dates" dialog on round detail → `updateRoundAction`;
  per-application submission-deadline admin card (effective-vs-inherited);
  invite picker filtered to live (OPEN) rounds with a two-option segmented
  control + `Select` fallback; confirmation step on single parent + staff
  invites; demo seed gains a second concurrently-OPEN round + 2 per-app deadline
  overrides. Cockpit untouched. tsc/lint/build/250 tests green.
- **2026-06-05** — **Epic 01 marked ✅** (buildable scope complete: PRs #141–#145;
  PR-6 drop-column remains ⏸ gated with prerequisites intact). **Epic 03 opened**:
  PR-A (schema + server core) — additive `submission_deadline_at` migration +
  `effectiveSubmissionDeadline()` helper (9 tests); single-OPEN guard softened to
  the OFF-by-default `ROUNDS_SINGLE_OPEN_ONLY` flag (D13 concurrent rounds);
  `listOpenRounds()`; bulk re-assessment now takes an explicit `targetRoundId`
  (refuses to guess when >1 OPEN); queue reassess scope + `rounds/current`
  reworked for concurrency; `setSubmissionDeadlineAction` +
  `SET_SUBMISSION_DEADLINE` audit. 250 tests green. PR-B (UI) to follow.
- **2026-06-05** — Programme execution opened. Scaffolding (12 plans +
  current-state map + this ledger) shipped via **#133**. D2/D12/D18/D20 locked.
- **2026-06-05** — Decision register **reconciled** against the meeting (#140):
  D3/D6/D7/D9/D10/D13/D21 marked decided, D4/D11 = deliverables-with-defaults,
  D8/D14/D15–17/D19 = narrow confirms. Net: nothing decision-blocked.
- **2026-06-05** — **Wave 0 shipped**: defect PRs #134–#139 merged to staging
  (all green; behavioural verify deferred to staging preview). Next: Epic 01.
- **2026-06-05** — **Epic 01 opened**: PR-1 **#141** (additive schema) merged +
  applied to nonprod. PR-2 **#142** (idempotent backfill of the new lifecycle
  columns from the legacy fused `status`) opened for review. PR-3/4/5 pending;
  PR-6 (drop fused `status`) deferred/gated.
- **2026-06-05** — **Epic 01 PR-2 + PR-3 landed**: backfill (#142) validated on
  nonprod + applied. PR-3 **#143** — central status service with legacy
  dual-write (behaviour-preserving; all writers migrated, `paused_until`
  persisted, 234 tests green) opened. Recorded the PR-6 enum-cleanup prerequisite
  (remap residual `QUALIFIES` outcome rows before dropping the value).
- **2026-06-05** — **Epic 01 PR-4** **#144**: reader migration + typed badges +
  runtime form-status derivation. First assessor save now drives real
  IN_PROGRESS (fixes the every-save-repins-NOT_STARTED bug); dashboard "in
  progress" reads the real assessment lifecycle; stale `status-badge.tsx`
  removed; parent dashboard no longer leaks internal states. Cockpit untouched.
  Expanded the PR-6 prerequisites with the full remaining-legacy-reader list
  (transition gating, cockpit/watchlist, Epic 05 portal, reports/queue filter).
  238 tests green.
- **2026-06-05** — **Epic 01 PR-5**: `submitted_at` made write-once. New
  additive migration `20260605181936_submitted_at_immutable` adds a BEFORE
  UPDATE trigger (`trg_submitted_at_immutable`) raising only when an
  already-set `submitted_at` changes value (first set + untouched updates pass,
  so the status service's frequent `applications` writes are unaffected).
  App-level invariant `assertSubmittedAtUnset` in the submit path
  (`apply/actions.ts`) returns a friendly error ahead of the DB backstop; unit
  tests cover the guard. 241 tests green. PR-6 (drop fused `status`) remains
  deferred/gated with its prerequisites intact.
