# Process Alignment — execution ledger

> **What this is.** The living *state* surface for the process-alignment
> programme. The [`plans/`](plans/) files are the **spec**; this file is the
> **progress**. Read it first at the start of every work session to recover
> where execution stands. Update it **inside the same PR** that completes a
> task so the tick rides the squash-merge into `staging` and is never lost to a
> separate clobberable commit.
>
> **Spec:** [README.md](README.md) (spine + decision register). **Owner:** Brian Wagner.

**Started:** 2026-06-05 · **Current focus:** **Epic 05 IN PROGRESS** (parent portal) — PR-1 (home guidance + T&Cs + type chooser) opened; PR-2 (deadline/status/summary) + PR-3 (history + missing-doc upload) to follow, stacked. Epic 02 COMPLETE (#152–#158). Wave 1 shipped (01/03/04; 01 PR-6 gated).

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
| 1 | [04 Lead-applicant contacts & invitations](plans/04-lead-applicant-contacts-and-invitations.md) | ✅ | 01 | #148 (contact register), #149 (invite-from-contact + D1 lock), #150 (twin/DOB uniqueness) |
| 2 | [02 Application form re-scope](plans/02-application-form-rescope.md) | ✅ | deps met (01, 04 ✅) · D3 ✅ · D11 artifact (build to workbook) | #152 · #153 · #154 · #155 · #156 · #157 · #158 (all ✅) |
| 2 | [05 Parent portal experience](plans/05-parent-portal-experience.md) | 🟡 | deps met (01, 02, 03 ✅) · D2/D10 ✅ | PR-1 home guidance + chooser (this batch); PR-2 deadline/status/summary; PR-3 history + missing-doc upload |
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

**PR-3 — twin/DOB uniqueness (backfilled)** (§6 PR-5):
- [x] Migration `20260605210000_application_dob_unique`:
  (A) BACKFILL `applications.child_dob` from `CHILD_DETAILS` JSONB
  (`dateOfBirth`, only where NULL, mirrors submit-time promotion);
  (B) add composite `UNIQUE(round, lead, child_name, child_dob)` (non-NULL DOB)
  + a raw PARTIAL `UNIQUE(round, lead, child_name) WHERE child_dob IS NULL`
  (closes the NULL-distinctness trap so two unknown-DOB same-name rows still
  collide); (C) drop the old childName-only unique. Cannot break existing rows
  (the old constraint already forbade two same-name rows per round+lead).
  **READ-ONLY nonprod validation queries are in the PR body — Brian runs them
  before merge.**
- [x] Submit path now promotes `child_dob` from `CHILD_DETAILS` onto the column
  (never clobbers an existing value), so future apps populate it.
- [x] `child-identity.ts` pure key helper (NULL coalesced to a sentinel,
  mirroring the partial index) + 9 unit tests covering twins-don't-collide,
  same-child-does, NULL-vs-NULL collides, known-vs-unknown doesn't.

> **Note:** the D1 lock-enforcement invariant landed in PR-2 (it belongs with the
> from-contact/onboarding create path), so PR-3 is purely the DOB-keyed
> uniqueness + backfill. Plan §6 grouped them; splitting keeps each migration in
> the PR that needs it.

---

## Active — Epic 02 (application form re-scope)

Wave 2, deps met (01, 04 ✅). Plan §6 lists 7 PR-sized items. **No Prisma
migration** — form data is JSONB `ApplicationSection.data`, so this is app code +
Zod + TypeScript types only. Executed as **independent branches off `staging`**
(prefer over deep stacks). PR-1 is the keystone every later section build
consumes (rule engine + tax-year), and is behaviour-preserving for existing rules
(proven by before/after gap tests).

**PR-1 — required-document rule engine + tax-year helper** (§6 PR-1) — `feature/02-rule-engine-tax-year`:
- [x] `lib/portal/tax-year.ts` — round-derived wording from `Round.academicYear`
  (D5): financial-year-ended / 4-April-date / P60-date / March-payslip / SA302
  tax-year / "left employment since April" labels. Lenient parse (handles
  "2026/27", "2025/2026", "2024-25", "2024"); current-year fallback. 9 tests.
- [x] `lib/portal/document-rules.ts` — declarative rule engine + generic
  evaluator. Rule kinds: `requiredAlways`, `requiredIfValueGt0` (the workbook's
  £0 rule), `requiredIfTrue`, `requiredOneOf` (P60-or-payslip; with optional
  value/true gate), `structural`. `onlyIfExistsPath` gate for per-parent scoping;
  array-doc presence (bank statements); `applicableRuleCount`/`sectionItemTotal`
  for the progress denominator. 22 tests.
- [x] `lib/portal/section-rules.ts` — the per-section rule registry reproducing
  the legacy `SECTION_EVALUATORS` behaviour exactly (CHILD_DETAILS birth cert;
  PARENT_DETAILS left-SE/scholarship; PARENTS_INCOME P60-always +
  SA302/benefits-if-value>0 + capital-if-true; DEPENDENT_CHILDREN structural;
  ASSETS_LIABILITIES council-tax + bank-stmt). Earner builders re-exported for
  the income rebuild. 19 behaviour-preservation tests.
- [x] `section-gaps.ts` refactored to a thin adapter over the engine;
  `SECTION_EVALUATORS` + the `SECTION_ITEM_TOTALS` magic table **deleted** —
  progress now derives from the enumerable rule list. Public types/exports
  (`getSectionGapStatuses`, `SectionGap`, `SectionGapStatus`) unchanged; all 8
  importers compile unmodified.
- [x] `round.academicYear` threaded `page.tsx → SectionPageClient →
  ParentsIncomeForm`; income header + intro now render the dynamic
  financial-year-ended label (removed the hard-coded "To April (actual)").

**PR-2 — income rebuild (status-driven sub-tables, D3)** — `feature/02-income-subtables` (**stacks on PR-1; merge PR-1 first**):
- [x] Reshaped `ParentIncomeRecord` + `parentsIncomeSchema` into status-keyed
  sub-blocks (Employed / Self-employed / Benefits / Unemployed / Retired /
  Divorced-separated / Third-party). Flat `salaryWagesPension`/`supplementsAndBonus`/
  `amountFromPartner`/`workingTaxCredits`/`hasCapitalRepayments` etc. removed
  from the write path (gross-pay/bonus/lumped-salary gone per meeting-findings);
  legacy shape kept ONLY as `LegacyParentIncomeRecord` for the back-compat reader.
- [x] Rebuilt `parents-income-form.tsx` — sub-tables shown for the parent's
  declared `EmploymentStatus` (PAYE→employed, SELF_EMPLOYED_*→self-employed,
  BENEFITS→benefits, UNEMPLOYED→unemployed, OLD_AGE/PAST_PENSION→retired);
  divorced/separated shown by relationship status; third-party always offered.
  Live per-parent TOTAL footer; conditional uploads (shown when the row > £0);
  legibility tick. Seeds empty sub-blocks for shown statuses so the rule engine's
  `onlyIfExistsPath` gate sees the declaration.
- [x] Income doc rules wired into the engine: Employed **P60-or-March-payslip**
  (`requiredOneOf`, gated on salary > 0); SA302 if any SE cell > 0; UC statement
  + 3 monthly if UC > 0; Housing Benefit letter if HB > 0; other-benefits
  evidence if any non-CB benefit > 0 (**Child Benefit excluded** — workbook
  exception); P45/redundancy/JSA/grant/leave-pay per-row if > 0; pension docs if
  pension > 0; maintenance letter if received > 0.
- [x] `lib/portal/income-model.ts` — **back-compat reader**: `parentIncomeTotal`
  / `readIncomeItems` accept BOTH shapes; `isLegacyIncomeRecord` discriminates;
  `normaliseLegacyIncomeRecord` maps a legacy draft into the new shape on form
  load (salary→employed+P60, dividends/rents→self-employed+SA302, tax-credits→
  benefits, maintenance→divorced/separated). Review page + both section clients
  (apply + contribute) read through it, so old drafts and immutable submitted
  blobs still render. tax-year wording derives from the round (D5).
- [x] Threaded declared employment + relationship status into both the apply
  section page and the contribute (secondary-parent) page → the income form.
- [x] 34 new tests (income-model 14, section-rules income 11, +engine);
  tsc/build green, 344 total green.
- [ ] **PR-2 follow-up (deferred to PR-7):** the one-off idempotent draft
  *backfill script* for staging drafts. The runtime normaliser already maps
  legacy drafts on load (no data loss in the UI); a batch backfill that also
  flags `PARENTS_INCOME.isComplete=false` is a nicety, grouped with the seed PR.

**PR-3 — finish the four stubs** — `feature/02-finish-stubs` (independent off `staging`):
- [x] **Dependent-elderly** — per in-care elder repeatable card (first/surname/DOB/
  care-home name/yearly fees) + **latest invoice upload** (required per elder via a
  new `arrayForEach` rule kind); schema enforces name + fees per in-care elder.
- [x] **Other-info** — court-order amount + **which school year** + **evidence
  upload**; **child-maintenance branch** (who pays → divorced/decree-absolute or
  separated/agreement note); insurance amount + school year + **evidence upload**;
  outstanding-fees name + amount. Rule engine: court/insurance evidence required
  on toggle; decree-absolute required when divorced payer.
- [x] **Assets — other properties** repeatable "add property" table (Address line 1,
  postcode, market value, mortgage balance, monthly repayment, used-as-rental Y/N)
  + **latest mortgage-statement upload** required per property with a balance > 0
  (`arrayForEach`). Replaced the single-total stub.
- [x] **Additional-info** — **mandatory** narrative (≥1 char, schema-enforced),
  per-circumstance supporting-doc uploads, and a general multi-file
  "other supporting documents" area.
- [x] New `arrayForEach` rule kind in `document-rules.ts` (one gap per array
  element missing its doc, with an optional per-element gate). Threaded
  applicationId/documentMap into the elderly/other-info/additional-info forms.
  11 new tests; tsc/build green, 355 total green.

**Remaining (follow-up PRs, all independent off `staging` unless noted):**
- [x] **PR-3 — finish the stubs** (#154). Dependent-elderly per-elder + invoice;
  other-info court-order/insurance/maintenance/fees uploads; assets
  other-properties repeatable table + mortgage-statement upload; additional-info
  mandatory narrative + uploads. New `arrayForEach` rule kind; each wired into the
  rule engine.
- [x] **PR-4 — identity variant + nesting** (#155). `isRollingOverApplication()`
  keys ID-section visibility on Epic 01 `applicationType` (ROLLING_OVER hides
  FAMILY_ID, NEW shows it), `isReassessment` fallback for pre-backfill rows;
  `apply/[section]/page.tsx` re-keyed. FAMILY_ID re-titled "Details of Child —
  Identification"; per-member passport/ILR rule replacing the `FAMILY_ID: []` no-op.
- [x] **PR-5 — declaration + contact mandatories** (#156). Declaration rebuilt to
  the workbook §8 structure (intro + six numbered terms, D11 — swappable) with a
  separate acceptance tick + signature for Parent/Guardian 1 AND 2 (P2 hidden for a
  sole parent). `DeclarationData` reshaped (`acceptedParent1/2` +
  `signedOnBehalfOfParent1/2`); legacy single-tick fields kept + normalised on load.
  **Mobile/telephone + email mandatory** on every parent block (email now rendered
  for both parents — was P2-only). 10 new tests; tsc/build green, 354 total green.
- [x] **PR-6 — locked school + entry-year removal + stored address** (#157).
  CHILD_DETAILS Q1 school is **display-only** (read-only card from the locked
  `application.school`, pinned via a hidden field — D1); the **parent entry-year
  picker is removed** (`entryYearGroup` optional; submit promotes the admin value);
  the **stored Parent 1 address** is shown read-only on "same address" (workbook
  §3 Q7). Onboarding-card picker left intact. 3 new tests; 347 green.
- [x] **PR-7 — seed + validation-summary + draft backfill** (#158). All 5
  `seed:demo` PARENTS_INCOME fixtures rewritten to the status-driven shape across
  statuses; Review "issues" panel reframed as the workbook **Validation summary**;
  OFF-by-default idempotent `scripts/backfill-income-drafts.ts` (dry-run unless
  `--apply`; PRE_SUBMISSION drafts only). 344 tests green.

> **Epic 02 COMPLETE (#152–#158).** PRs 1–7 cover the full §6 work breakdown: rule
> engine + tax-year, status-driven income sub-tables, the four stubs, the
> new/rolling ID variant, per-parent declaration + mandatory phone/email, locked
> school + entry-year removal + stored address, seed/validation/backfill. No Prisma
> migration anywhere (form data is JSONB). Back-compat reader covers legacy income +
> declaration drafts and immutable submitted blobs.

---

## Active — Epic 05 (parent portal experience)

Wave 2, deps met (01, 02, 03 ✅). Plan §6 lists 7 PR-sized items; executed as
**three cohesive PRs stacked off `staging`** to avoid union-merges on the shared
portal glue (`(portal)/page.tsx`, `(portal)/actions.ts`, this ledger).
**Merge order: PR-1 → PR-2 → PR-3.**

**PR-1 — home-page guidance + T&Cs + application-type chooser** (§6 PR-1, PR-2) —
`feature/05-home-guidance-and-chooser` (off `staging`):
- [x] §6 PR-1 — `PortalGuidanceTabs` (Section 1 — How to Apply / Section 2 —
  Checklist / Terms & Conditions) wired into `(portal)/page.tsx`, always present
  before/during/after an application. Static workbook copy in
  `lib/portal/guidance-content.ts`; identity-docs checklist block flagged
  "first application only" and de-emphasised for rolling-over accounts.
- [x] §6 PR-1 — T&Cs viewer (D10 *display* half): `terms-and-conditions.pdf`
  copied to `public/legal/`, rendered inline (`<object>` + Open/Download) from
  the Terms tab. `lib/portal/terms.ts` = single source of the served path +
  version marker (the *record-per-submission* half lands in PR-2 with the
  schema columns).
- [x] §6 PR-2 — `ApplicationTypeChooser` shows BOTH cards (New / Rolling-over);
  the eligible one (derived from invitation type: re-assessment ⇒ ROLLING_OVER)
  is active (reuses `OnboardingCard` / `ReassessmentCard`), the other is a muted
  disabled shell with a reason + contact link (feedback #4). Replaces the
  implicit onboarding-xor-reassessment branch.
- [x] 10 unit tests (guidance content + terms reference). tsc/build green.

**PR-2 — parent-safe status projection + deadline/countdown/lockout + submitted
summary + submission PDF** (§6 PR-3, PR-4, PR-5) —
`feature/05-deadline-status-and-summary` (**stacks on PR-1**):
- [x] §6 PR-3 — `lib/portal/status-projection.ts` (single parent-safe read
  model: Draft → Received/Submitted → Being assessed → Outcome; collapses
  IN_PROGRESS/PAUSED → "Being assessed"; outcome view never leaks the enum
  name). `status/page.tsx` rewritten to consume it (dropped the leaky
  NOT_STARTED→"Under Review"/PAUSED→"Paused"/QUALIFIES maps + the
  QUALIFIES/DOES_NOT_QUALIFY literals). Dashboard keeps the form-status-only
  `projectFormStatusForApplicant` (parent-safe; assessment state not loaded
  there). Grep-clean of leaked enum display in the portal.
- [x] §6 PR-4 — `lib/portal/deadline.ts` (over Epic-03
  `effectiveSubmissionDeadline()`: `getDeadlineStatus`/`isSubmittable`/
  `formatTimeRemaining`, 72h closing-soon window); `SubmissionCountdown` client
  banner (ticks/minute, amber closing-soon, rose deadline-passed) on the
  dashboard + status page; dashboard hides Continue + shows a locked card past
  deadline; wizard `apply/[section]` redirects past-deadline drafts to /status;
  **server-side submit guard** in `apply/actions.ts` rejects late posts.
- [x] §6 PR-5 — additive migration
  `20260606120000_application_terms_acceptance` (`terms_accepted_at` +
  `terms_version`, nullable, no backfill); submit stamps both (D10). Schema +
  `lib/portal/terms.ts` version marker.
- [x] §6 PR-5 — read-only submitted summary: `lib/portal/application-summary.ts`
  (pure builder, shared by web + PDF), `submission-loader.ts` (RLS-scoped),
  `SubmittedSummary` view + dismissible `SubmissionDownloadOffer`;
  `/api/pdf/submission/[id]` + `submission-pdf.tsx` (applicant-scoped, on
  demand). `(portal)/submitted` rewritten from a thin receipt into the
  answers+docs+acceptance render; Received/Submitted label (D2); immutable
  submission date.
- [x] progress-count fix (Epic 12 §3): dashboard numerator AND denominator now
  derive from the same active-section set (rolling-over excludes FAMILY_ID), so
  "N of M" + the bar agree (was hard-coded /10).
- [x] 30 unit tests (deadline 7, status-projection 8, summary 4, +PR-1 11).
  tsc/prisma-format/build green, 403 tests pass.

**PR-3 — multi-round account history + portal missing-doc upload** (§6 PR-6,
PR-7) — *planned, stacks on PR-2*:
- [ ] `(portal)/history` over `BursaryAccount`; preserved read-only summaries/
  PDFs; upcoming-rounds lineup (empty until Epic 10); portal nav entry.
- [ ] generalise `submitMissingDocsResponse` → upload + retro-populate keeping
  `submittedAt`/`formStatus` fixed (works while the assessment is PAUSED).

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

- **2026-06-06** — **Epic 05 PR-2** (status projection + deadline/lockout +
  submitted summary/PDF + terms acceptance). New `lib/portal/status-projection.ts`
  parent-safe read model (Draft → Received/Submitted → Being assessed → Outcome;
  IN_PROGRESS/PAUSED collapse to "Being assessed"; outcome never leaks the enum
  name) — `status/page.tsx` rewritten onto it, dropping the leaky internal maps.
  `lib/portal/deadline.ts` over Epic-03 `effectiveSubmissionDeadline()` +
  `SubmissionCountdown` banner (dashboard + status) + dashboard/wizard lockout +
  **server-side submit guard** in `apply/actions.ts`. Additive migration
  `20260606120000_application_terms_acceptance` (`terms_accepted_at`/
  `terms_version`, nullable, no backfill) — submit stamps both (D10). Read-only
  submitted summary (`application-summary.ts` shared builder + `submission-loader.ts`
  + `SubmittedSummary` view + dismissible `SubmissionDownloadOffer`) and
  `/api/pdf/submission/[id]` + `submission-pdf.tsx` (applicant-scoped). Progress-
  count fix: dashboard numerator+denominator both derive from the active-section
  set (rolling-over excludes FAMILY_ID). Stacks on PR-1. tsc/prisma-format/build
  green, 403 tests (+19). **Migration SQL + read-only nonprod validation in the
  PR body.**
- **2026-06-06** — **Epic 05 OPENED (Wave 2)** — PR-1 (home-page guidance +
  T&Cs + application-type chooser). New `PortalGuidanceTabs` (Section 1 — How to
  Apply / Section 2 — Checklist / Terms & Conditions) wired into
  `(portal)/page.tsx`, always present; static workbook copy in
  `lib/portal/guidance-content.ts` with the identity-docs block flagged
  first-application-only. T&Cs PDF served from `public/legal/` and rendered
  inline (D10 *display* half); `lib/portal/terms.ts` is the single source of the
  served path + version marker. `ApplicationTypeChooser` shows BOTH application
  types with the non-eligible one disabled + reason (feedback #4), reusing the
  onboarding/reassessment bodies. No schema. 10 unit tests; tsc/build green.
  Epic 05 row → 🟡. PR-2 (status projection + deadline/lockout + submitted
  summary/PDF + acceptance columns) and PR-3 (history + portal missing-doc
  upload) to follow, stacked (merge order PR-1 → PR-2 → PR-3).
- **2026-06-06** — **Epic 02 COMPLETE** (#158, PR-7): seed:demo income fixtures →
  status-driven shape across statuses; Review reframed as the workbook Validation
  summary; OFF-by-default idempotent income-draft backfill script. Epic 02 row → ✅;
  plan frontmatter `status: shipped`. The 8-section parent form is rebuilt to the
  workbook (income sub-tables, stubs, ID variant, declaration, mandatory contacts,
  locked school). No migration (JSONB). **Next: Epic 05 (parent portal).**
- **2026-06-06** — **Epic 02 PR-6** (locked school + entry-year removal + stored
  address). CHILD_DETAILS Q1 school is display-only (read-only card from the
  locked `application.school`, pinned via a hidden field; D1). Parent entry-year
  picker removed (`entryYearGroup` optional in the schema; submit promotes the
  admin-set value). "Child same address as Parent 1" shows the stored Parent 1
  address read-only (workbook §3 Q7). Onboarding-card school picker left intact
  (no-invite create path). No schema/migration (JSONB). Independent off
  `staging`. tsc/build green, 347 tests green (+3).
- **2026-06-06** — **Epic 02 PR-5** (declaration + contact mandatories).
  Declaration rebuilt to workbook §8 (intro + six numbered terms, D11 swappable)
  with separate P1 AND P2 acceptance ticks + signatures (P2 hidden when sole
  parent). `DeclarationData` → `acceptedParent1/2` + `signedOnBehalfOfParent1/2`;
  legacy single-tick fields retained for the back-compat reader and normalised on
  load. Mobile/telephone + email made mandatory on every parent contact (email
  valid+required, ≥1 phone); the email field is now rendered for BOTH parents
  (previously P2-only). No schema/migration (JSONB). Independent off `staging`.
  tsc/build green, 354 tests green (+10).
- **2026-06-06** — **Epic 02 PR-4** (identity new/rolling variant + nesting).
  New `isRollingOverApplication()` (reassessment.ts) keys FAMILY_ID visibility on
  Epic 01 `applicationType` — ROLLING_OVER hides the ID section, NEW shows it —
  with an `isReassessment` fallback for pre-backfill rows. `apply/[section]/page.tsx`
  re-keyed off this helper (skip/redirect + active section order). FAMILY_ID
  re-titled "Details of Child — Identification" (workbook §3 Q10 nesting). The
  `FAMILY_ID: []` no-op replaced by a structural rule encoding the per-member
  passport/ILR requirement (British → UK passport; otherwise passport + ILR),
  satisfied by per-member doc ids or indexed upload slots. No schema/migration.
  Independent off `staging`. tsc/build green, 352 tests green (+8).
- **2026-06-06** — **Epic 02 PR-3** (finish the four live stubs). Dependent-elderly
  per in-care elder repeatable details + required invoice upload; other-info
  court-order (school year + evidence), child-maintenance branch (payer →
  divorced/decree-absolute or separated/agreement note), insurance (school year +
  evidence); assets other-properties repeatable table (address/postcode/value/
  mortgage balance/monthly repayment/rental Y-N) + per-property mortgage statement
  required when a balance > 0; additional-info mandatory narrative (≥1 char) +
  per-circumstance uploads + general document area. New `arrayForEach` rule kind
  drives the per-element (elder/property) doc requirements. Types + Zod schemas
  extended additively (back-compat: `OtherProperty.value` retained; new fields
  optional; old drafts read fine). No schema/migration (JSONB). tsc/build green,
  355 tests green (+11). Independent off `staging` (#152/#153 already merged).
- **2026-06-06** — **Epic 02 PR-2** (income rebuild, status-driven sub-tables —
  D3). `ParentIncomeRecord` + `parentsIncomeSchema` reshaped from the flat
  14-line model into status-keyed sub-blocks (Employed / Self-employed /
  Benefits / Unemployed / Retired / Divorced-separated / Third-party); gross-pay /
  bonus / lumped-salary lines removed. `parents-income-form.tsx` rebuilt with
  per-status sub-tables, a live per-parent TOTAL, conditional uploads, and the
  workbook's "value > £0 ⇒ upload, except Child Benefit" rule enforced via the
  engine (Employed P60-or-payslip `requiredOneOf`; SA302/P45/benefits/pension/
  maintenance if-value>0; Child Benefit excluded). New `lib/portal/income-model.ts`
  back-compat reader (`parentIncomeTotal`/`readIncomeItems` accept both shapes;
  `normaliseLegacyIncomeRecord` maps a legacy draft on load) — review page + apply
  + contribute clients all read through it, so old drafts and immutable submitted
  blobs still render. Declared employment + relationship status threaded into both
  section pages → the income form. No schema/migration (JSONB). tsc/build green,
  344 tests green (+20 over PR-1). **Stacks on PR-1 — merge PR-1 first.** The
  one-off draft backfill script is deferred to PR-7 (the runtime normaliser
  already maps drafts on load).
- **2026-06-06** — **Epic 02 opened (Wave 2).** PR-1 (required-document rule
  engine + tax-year helper) — keystone, behaviour-preserving. New
  `lib/portal/tax-year.ts` (D5 round-derived wording, lenient academic-year
  parse), `lib/portal/document-rules.ts` (declarative engine: requiredAlways /
  requiredIfValueGt0 / requiredIfTrue / requiredOneOf / structural +
  onlyIfExistsPath gate + array-doc presence), and `lib/portal/section-rules.ts`
  (per-section registry reproducing the legacy `SECTION_EVALUATORS` exactly).
  `section-gaps.ts` is now a thin adapter — `SECTION_EVALUATORS` and the
  `SECTION_ITEM_TOTALS` magic table deleted; progress derives from the
  enumerable rule list. `round.academicYear` threaded into the income form;
  hard-coded "To April (actual)" replaced with the dynamic financial-year label.
  No schema/migration (form data is JSONB). tsc clean, build green, 324 tests
  green (+50). PR-2..PR-7 (income rebuild, stubs, ID variant, declaration,
  locked school, seed) are the remaining breakdown in the Active — Epic 02
  section.
- **2026-06-05** — **WAVE 1 COMPLETE.** Epic 04 fully shipped (#148 contact
  register, #149 invite-from-contact + D1 school/entry-year lock, #150 twin/DOB
  uniqueness). DOB-uniqueness migration validated against real nonprod data
  (0 violations) before merge; applied cleanly. Wave 1 = Epics 01 (PRs 1–5) +
  03 + 04 all on staging; **Epic 01 PR-6 (drop fused `status`) remains ⏸ gated**.
  Epic 02 now unblocked. Awaiting Brian's go-ahead for Wave 2.
- **2026-06-05** — **Epic 04 PR-3** (twin/DOB uniqueness, backfilled): migration
  `20260605210000_application_dob_unique` backfills `applications.child_dob` from
  `CHILD_DETAILS` JSONB, adds a composite `UNIQUE(round,lead,child_name,
  child_dob)` + a raw PARTIAL `UNIQUE … WHERE child_dob IS NULL` (closes the
  NULL-distinctness trap), and drops the old childName-only unique — twins (same
  name, distinct DOB) no longer collide (D12). Submit path now promotes
  `child_dob` onto the column. `child-identity.ts` key helper + 9 tests.
  READ-ONLY nonprod validation queries in the PR body. tsc/format/build green,
  274 tests green (+9).
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
