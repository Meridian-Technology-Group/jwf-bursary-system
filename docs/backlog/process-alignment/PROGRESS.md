# Process Alignment — execution ledger

> **What this is.** The living *state* surface for the process-alignment
> programme. The [`plans/`](plans/) files are the **spec**; this file is the
> **progress**. Read it first at the start of every work session to recover
> where execution stands. Update it **inside the same PR** that completes a
> task so the tick rides the squash-merge into `staging` and is never lost to a
> separate clobberable commit.
>
> **Spec:** [README.md](README.md) (spine + decision register). **Owner:** Brian Wagner.

**Started:** 2026-06-05 · **Current focus:** Wave 0 shipped → Epic 01 (status keystone).

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
| 1 | [01 Status & workflow model](plans/01-status-and-workflow-model.md) | 🟡 | — | #141 (PR-1 schema), #142 (PR-2 backfill), #143 (PR-3 status service), #144 (PR-4 readers+badges) |
| 1 | [03 Round management](plans/03-round-management.md) | ⬜ | 01 | — |
| 1 | [04 Lead-applicant contacts & invitations](plans/04-lead-applicant-contacts-and-invitations.md) | ⬜ | 01 | — |
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
- [ ] **PR-5** — `submittedAt` write-once trigger migration + app invariant + test.
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
