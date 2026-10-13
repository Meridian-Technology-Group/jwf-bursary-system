---
title: "Epic 21 — CR-002 Phase 4: system changes from the migration review"
status: approved — ready to build (Charlotte approved the £1,100 quote in writing 12 Oct 2026)
approved: "2026-10-12 07:49 UTC, Gmail message 1a12f1663ee413ce, thread 1a11fad6a8b0e010"
due_on_migration_staging: 2026-10-26 (10 working days from approval)
opened: 2026-10-11
opened_by: Brian Wagner
quote: "£1,100 net of VAT — Gmail draft r1309823553813329048, thread 1a11fad6a8b0e010"
depends_on:
  - Charlotte's email 11 Oct 2026 17:26 UTC (six system changes, "migration phase 4")
  - ../../contract/master-services-agreement.md (§9.2 licence / §9.3 change control)
  - CR-002-grant-tracker-migration.pdf (pricing baseline)
code_surveyed_at: origin/staging 0be83db (11 Oct 2026)
---

# Epic 21 — CR-002 Phase 4

**This document is the handover.** It assumes no context beyond the repo, this file and the migration workspace (`../data/migration/STATE.md`). Read §0–§3 before touching code, then work the tranche you are given.

**Approved.** Charlotte accepted the quote in writing on 12 Oct 2026 (MSA 9.5(c)): "Please go ahead with those changes and do send me your invoice". Everything is due on migration staging by **Mon 26 Oct 2026**.

**Update 13 Oct (read this first).** Her test-login feedback (12 Oct 08:44 UTC, Gmail msg `1a12f49699543fe4`, thread `1a12c831e7b0a657`) and Brian's reply (sent 12 Oct 11:39) changed the plan:
- **D-1 answered:** every rolling-over year opens **15 April** and closes **21 May** (e.g. 2027-28 → 15/04/2027–21/05/2027). T7 is unblocked.
- **D-2 confirmed:** her screenshot showed an in-award Year 13 as "Outside your award", which is the years-1–2 tick default. Brian told her every year of the award will be ticked and an unticked year is hidden. Build T5 as proposed.
- **Two new licence fixes, folded into T1:** F4 ("Application", not "Assessment", on the family's side) and F5 (T&Cs link on the portal home page). Both were promised to her in the 12 Oct reply.
- **Keep the portal row labels** "Scheduled" / "Outside your award" (`portal-schedule.ts` `STATE_LABELS`) as they are; she may send new wording.
- **Out of scope:** her "Parent View" redesign, quoted separately as Phase 5 (§8). Don't pre-build any of it.

---

## §0 · Starting position (11 Oct 2026)

- **Prod and staging hold the same code** at `0be83db` (#414–#430 promoted in #431, merge `7a70d8a`). `origin/main` is ahead of `origin/staging` only by release-please files (`CHANGELOG.md`, `package.json` version, manifest), which is harmless.
- **Prod data is tiny:** 2 ACTIVE bursary accounts, 9 schedule entries (4 with `show_on_portal`), 6 assessments, 0 migrated applications.
- **The Grant Tracker live load has not happened.** About 271 accounts will arrive in prod with it. Several tranches below change what the loader produces or what those accounts look like (§4, "Order against the live load").
- **Migration staging** (Charlotte's name for the rehearsal environment) is Supabase `ldqpzjizqvrairoojker`, Vercel custom env `rehearsal`, deployed from branch `chore/gt-rehearsal`. It holds all 271 migrated accounts (run `rh-r1-20261008`) and the test family login for TS-NOWS01 (see `STATE.md`, 11 Oct evening). **This is where Charlotte tests.** `db-push.yml` does **not** migrate it: apply migrations there by hand (§6).

### Git hygiene before the sprint

**Status 13 Oct 2026 (sprint start):** G1 done (toolkit pushed, `fb92782`). G3/G4 approved by Brian but **not yet run**: the stale worktree and merged branches are still there; Brian runs the deletions (Claude's auto mode blocks `git branch -d/-D`). They don't block the sprint. Local `staging`, `main` and `chore/gt-rehearsal` fast-forwarded to their remotes. G5 and G6 open. The sprint worktree `../bursary-system-epic21` has `node_modules`, `.env`, `.env.local` and `.env.migration.rehearsal`; baseline at `0be83db`: `tsc` clean, 2,559 tests pass.

| # | Item | Action | Why |
|---|---|---|---|
| G1 | `chore/gt-migration-toolkit` is 29 commits ahead of its remote (`03c80f6`); the loader, M8 documents phase and postcode work exist **only on this laptop** | `git push origin chore/gt-migration-toolkit` (fast-forward, no force) | Backup. The toolkit is needed for the live load and for WP-T7 |
| G2 | `docs/.obsidian/app.json` modified in the main checkout | **Leave it.** It's Brian's Obsidian setting. Never `checkout --` it | Avoid destroying uncommitted local edits |
| G3 | Stale worktree `.claude/worktrees/agent-a28645cf3a10c129c` on `feature/assessments-search-reference-sort` (#430, merged) | `git worktree remove` it, then `git branch -d` the branch | Merged |
| G4 | Local branches whose PRs are merged: `feature/migrated-account-mode` #421, `feature/old-palace-partner-school` #422, `feature/reason-codes-27-35` #420, `fix/reassessment-invite-existing-login` #423, `fix/review-phase-locked-states` #425, `fix/schedule-mirror-academic-year` #424, `docs/handover-staging-address` #418. Also `docs/handover-guides` (#417 closed unmerged) and `worktree-agent-a28645cf3a10c129c` (no PR) | `git branch -d` each (squash-merged, so `-D` may be needed; check each has no unpushed work first) | Clutter |
| G5 | Open PRs: #350 release-please 2.1.0, #343, #378, #416, #419 (docs) | Brian decides: merge #350 to tag 2.1.0; close or refresh the stale docs PRs | None block this sprint |
| G6 | `chore/gt-rehearsal` is at `ebd4f01` (#430's head), i.e. staging minus the squash commit | Fast-forward or reset it to `origin/staging` at the start of each rehearsal deploy (§6). It is a deploy branch, so a hard reset of it is a force-push: **ask first** | Rehearsal must run exactly the staging code under test |

**Build every tranche in the sprint worktree `../bursary-system-epic21`**, never in the main checkout (which stays on the toolkit branch for migration work). Start each tranche from fresh `origin/staging`:

```bash
cd ../bursary-system-epic21
git fetch origin
git switch -c <branch> origin/staging
npm ci   # only if package-lock.json changed since the last tranche
```

T8 is the exception: it is toolkit work on `chore/gt-migration-toolkit` in the main checkout.

---

## §1 · Scope and charge

Charlotte's six changes (her numbering), the quote, and three fixes found while checking (licence, no charge).

| # | Change | Charge | Tranche |
|---|---|---|---|
| 1 | Scholarship-adjusted gap (export column + Reports total) | £100 | T2 |
| 2 | Gap ranking (per-code rank in Settings; "main gap" in reports) | £100 | T2 |
| 3 | Links to previous years (admin page as the door) | £200 | T3 |
| 4 | Schedule edit: End after this year / Add a year | £450 | T4 |
| 5 | Show-on-portal tick applies to the home page too | £0 (fix) | T5 |
| 6 | Standing synopsis on the admin page | £250 | T6 |
| F1 | "No invitation found" box shown to migrated/active families | £0 (fix) | T1 |
| F2 | Future-year dates on the schedule follow the new-applicant round, not the rolling-over window | £0 (fix) | T7 |
| F4 | Family-facing "Assessment Schedule" → "Application Schedule" and "This year's assessment" → "This year's application" (her 12 Oct email; admin keeps "Assessment") | £0 (fix) | T1 |
| F5 | Terms & Conditions reachable from the portal home page (her 12 Oct email) | £0 (fix) | T1 |
| F3 | Next spring's re-assessment invitations ignore the schedule (a Year 13 family would be invited for a year they don't have) | £0 (fix) | T4 |
| — | Migration footer dates as "10 October 2026" (promised 11 Oct) | toolkit | T8 |

Total charged: **£1,100**, invoiced on her acceptance, payable within 30 days. Promised: everything on migration staging **within 10 working days of approval**.

---

## §2 · Decisions

Mark each answered with date and source before building the tranche that needs it.

| ID | Question | Who | Default if no answer | Blocks |
|---|---|---|---|---|
| **D-1** | Rolling-over years: which dates should the family see? | Charlotte | **ANSWERED 12 Oct:** open 15 April, close 21 May, every rolling-over year | T7 |
| **D-2** | The show-on-portal fix: make the home page obey the tick. Today the tick defaults on for years 1–2 only, so obeying it would **hide years 3+ from every family**. Proposal: default the tick **on for every year**, so it becomes a "hide this year" switch, and backfill existing rows | Charlotte, then Brian (prod backfill) | **CONFIRMED 12 Oct** (her "Outside your award" screenshot; Brian's reply promised it). Default on for all years + backfill; the prod backfill still needs Brian's approval in the PR | T5 |
| **D-3** | Should the gap-code picker in the assessment list codes in ranking order? (asked 11 Oct, unanswered) | Charlotte | **BUILD ON DEFAULT (Brian, 13 Oct):** keep the current order (`sortOrder`); ranking is its own column. Stated in the batch-1 email so she can object | T2 (picker only) |
| **D-4** | Previous-year links for an ASSESSOR: last year's application is usually not assigned to them, so RLS and the `[id]/layout.tsx` assignment redirect hide or bounce it | Brian | **ACCEPTED 13 Oct:** show links only where the viewer can open the target (ADMIN/VIEWER always; ASSESSOR when assigned). No RLS change | T3 |
| **D-5** | After "End after this year", does the account stay ACTIVE through the funded year (closed later with a reason, as today), or close immediately? | Charlotte | **BUILD ON DEFAULT (Brian, 13 Oct):** stays ACTIVE; closes by the existing Close action or auto-close when the last row completes. Stated in the batch-1 email so she can object before T4 merges | T4 |
| **D-6** | Standing synopsis: on a re-lock (revert, then lock again), replace that year's entry or add another? Can staff edit or delete their own notes? | Brian (Charlotte informed) | **ACCEPTED 13 Oct:** one entry per assessment, replaced on re-lock; notes editable by ADMIN, never deleted; every change audited | T6 |
| **D-7** | Retention: is the standing synopsis kept verbatim at the close purge, like `Assessment.synopsis` (decision D-2 in `close-purge.ts`)? | Brian / DPO later | **ACCEPTED 13 Oct:** same as the assessment synopsis (kept) | T6 |
| **D-8** | Live load timing: before or after this sprint? | Brian + Charlotte | **DECIDED 13 Oct: hold the live load until T7 has merged**, so loaded accounts come out with the right defaults and no prod backfill is needed | T5, T6, T7, T8 |
| **D-9** | Scholarship-adjusted gap basis: `gap + scholarshipSpendBeforeVat × (1 + vatRate/100)`. This is the incl-VAT figure already quoted to her (−£851,622 → −£83,565) | Brian (confirm only) | **ACCEPTED 13 Oct:** as stated | T2 |

---

## §3 · Ground rules (from CLAUDE.md and Epic 19 §0; apply always)

- **Git:** branch from `origin/staging`, PR to `staging`, Conventional Commits. Never commit to `main`/`staging`, never force-push, never `--no-verify`. Only Brian promotes `staging → main`; open that PR only on his explicit instruction. `gh pr merge` now prompts Brian for approval (user settings, 11 Oct).
- **CI gates:** `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` · `npm test` · `npx prisma format --check`. Lint does not gate. tsconfig has no `target` (ES5): use `Array.from()` over Set/Map iteration.
- **Migrations:** author with `prisma migrate diff --script`, additive only, one per PR alongside the code that needs it. They apply to nonprod on merge to staging and to prod on merge to main (`db-push.yml`). **Rehearsal is manual** (§6). Never touch an applied migration.
- **RLS:** a new table gets RLS force-enabled by the `ensure_rls` trigger. **Policies ship in the same migration** (patterns: `20260519163000`, `20260710205004`, and the schedule table `20260606210000`). A new column on an existing table needs nothing.
- **Enums:** do **not** widen `ScheduleEntryStatus` or `BursaryAccountStatus`. Several checks are silently binary (`schedule-home.ts:175`, `lifecycle.ts:49`, `access.ts:53`, `assessments/page.tsx:97-135`, `payable-fees-schedule.ts:113`). This sprint deletes rows or adds columns instead.
- **Audit:** `createAuditLog(tx, {...})` (`src/lib/audit/log.ts:27`). New actions are string keys in `AUDIT_ACTIONS` (`src/lib/audit/actions.ts`), with no migration. `audit_logs` is append-only.
- **Tests:** there is no jsdom. Extract every decision into a pure exported function and unit-test that. Each WP names its seam.
- **Prod blast radius:** state in each PR body what the change does to existing prod rows (today: 2 accounts). Re-state after the live load if it lands first.
- **Email drafts and docs:** identify families by code (TS-NOWS01), never names.

---

## §4 · Tranches, order and dependencies

Each tranche is one PR to `staging` and independently promotable.

| T | Contents | Branch | Migration | Needs |
|---|---|---|---|---|
| **T1** | F1 · hide "No invitation found" when the family has an active schedule · F4 "Application" wording · F5 T&Cs link on home | `fix/portal-home-no-invitation-box` | none | — |
| **T2** | #1 adjusted gap + #2 gap ranking (export, Settings, Reports "Gap" section) | `feature/gap-ranking-and-adjusted-gap` | `gap_reasons.rank` | D-9; D-3 for the picker only |
| **T3** | #3 previous-year links | `feature/previous-year-links` | none | D-4 |
| **T4** | #4 End after this year / Add a year + F3 invitation filter + schedule-anchor fix | `feature/schedule-end-and-add-year` | `bursary_accounts.schedule_end_year` | D-5 |
| **T5** | #5 show-on-portal on the home page + default and backfill | `fix/portal-home-respects-show-on-portal` | data migration (backfill) | D-2 |
| **T6** | #6 standing synopsis | `feature/standing-synopsis` | new table `account_synopsis_entries` + RLS | D-6, D-7 |
| **T7** | F2 rolling-over dates on future schedule years | `fix/schedule-rolling-over-dates` | data migration (backfill SCHEDULED rows) | D-1 (answered) |
| **T8** | Toolkit: footer date format, A9 invariant vs ended schedules, seed the standing synopsis, re-plan with new defaults | `chore/gt-migration-toolkit` (local, then push per G1) | — | T4, T6 merged |

**Merge order: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8.** T1 and T2 can be built in parallel. After that, go one at a time, because the files overlap:

- `assessment/admin/page.tsx` is touched by T3, T4 and T6.
- `payable-fees-schedule.ts` is touched by T3 (application id) and T4 (row label).
- `bursary-accounts/schedule.ts` is touched by T4, T5 and T7.

Rebase each branch on fresh staging after the previous one merges (merge `origin/staging` in; no force-push).

**Order against the live load (D-8).** If the live load happens before:
- **T5:** backfill `show_on_portal = true` on loaded accounts. This is the same migration, but it hits 452 rows on rehearsal (and about the same on prod) instead of 5.
- **T6:** backfill a standing-synopsis entry from each migrated `Assessment.synopsis`, using a toolkit command that is ledgered and roll-back safe (T8).
- **T7:** re-date about 660 future SCHEDULED rows. The migration is the same, with a larger blast radius; state it in the PR.
- **T8:** the footer date stays ISO on prod; it's cosmetic and can be fixed with a one-off `UPDATE` (needs approval).

**Recommended:** hold the live load until T7 is merged. That's under 10 working days, Charlotte has no deadline on it, and it avoids every backfill on prod.

---

## §5 · Work packages

### T1 · WP-F1 — hide "No invitation found" for families with a schedule

**Status: BUILT 13 Oct** on `fix/portal-home-no-invitation-box` (seam `src/lib/portal/home-state.ts` `portalHomeMain`). The quiet help line now renders in every home-page state and carries the direct T&Cs link. F4 also covers `(portal)/layout.tsx:66`, `queries/schedule.ts:151` (comments) and the `/schedule` intro line "each year's application opens".

**Problem.** Migrated families (and any family between rounds) see a "No invitation found… If you believe this is an error" card under their schedule. `src/app/(portal)/page.tsx:613-632` is the final `else` of `application ? … : invitation ? … : …`, shown when both are null. Migrated applications are excluded from "the current application" by design (`PORTAL_APPLICATION = { migrationSource: null }`, `src/lib/applications/migration-source.ts:34`, used by `getCurrentApplicationForUser`, `src/lib/db/queries/applications.ts:701-732`).

**Change.** Render that card only when the family has **no schedule** (`hasSchedule`, page.tsx:322, built from `getScheduleHomeForUser`, which already returns only ACTIVE accounts). With a schedule, show nothing there; the schedule is the page.

**Seam.** Extract `portalHomeFallback({ hasApplication, hasInvitation, hasSchedule }): "application" | "invitation" | "none" | "no-invitation"` into `src/lib/portal/` and test it (4 cases). The page switches on it.

**Accept.** The TS-NOWS01 test family on rehearsal sees three schedules and no "No invitation found" card. A fresh applicant with no invitation still sees the card.

**Blast radius.** Display only. Prod: the 2 active accounts' families stop seeing the card if they currently do.

**F4 · "Application" on the family's side.** Family-facing text only; the admin `ScheduleGrid` heading (`src/components/admin/schedule-grid.tsx:127`) stays "Assessment Schedule".
- `src/components/portal/portal-nav.tsx:100` nav label → "Application Schedule" (and its doc comments, 66 and 202).
- `src/app/(portal)/schedule/page.tsx:28` metadata title, `:60` heading, `:63` intro ("your assessment schedule" → "your application schedule").
- `src/components/portal/schedule-calendar.tsx:47` aria-label → "bursary application schedule".
- `src/lib/bursary-accounts/portal-schedule.ts:84` `current: "This year's application"`. Leave `active` / `greyed` as they are (§0 update).
- Grep `(portal)` and `components/portal` for any other family-visible "assessment schedule" / "This year's assessment". Update `portal-nav-schedule.test.ts:34` and the portal-schedule tests.

**F5 · T&Cs on the home page.** Today the T&Cs PDF (`TERMS_AND_CONDITIONS_PATH`, `src/lib/portal/terms.ts`, version 2026-10) is reachable only from `/help` and from the "New to bursary applications?" card, which shows only to invited-not-started parents. Add one quiet link ("Terms & Conditions", opens the PDF) rendered in **every** home-page state, using `TERMS_AND_CONDITIONS_LABEL`. Keep it small: Phase 5 (§8) will redesign the home page.

**Accept (F4/F5).** As the TS-NOWS01 test family on rehearsal: the menu and `/schedule` say "Application Schedule"; the current row says "This year's application"; the home page shows a T&Cs link that opens the PDF. As an admin, the account page still says "Assessment Schedule".

---

### T2 · WP-1 + WP-2 — scholarship-adjusted gap and gap ranking

**Facts.**
- The gap is `Recommendation.gapAmount = confirmed − recommended` (`src/lib/assessment/recommendation-v2.ts:27-32`), recomputed server-side on save (`recommendation/actions.ts:102-141`). It is negative when the family pays less than recommended.
- Scholarship spend is `Recommendation.scholarshipSpendBeforeVat` (`award.ts:250`, fees × pct, before VAT). The VAT rate is `Assessment.vatRate` (default 20).
- No incl-VAT scholarship figure is stored anywhere. `scholarshipValueInclVat` is deprecated (CH-36), so **do not revive it**.
- Gap codes are `GapReason { code, label, sortOrder, isDeprecated }` (`schema.prisma:739-749`). Display numbers 1–20 come from `sortOrder`; DB codes are 101–120.

**Schema.** One migration, `<ts>_gap_reason_rank`:

```sql
ALTER TABLE "gap_reasons" ADD COLUMN "rank" INTEGER;
UPDATE "gap_reasons" SET "rank" = v.rank FROM (VALUES
  (101,1),(102,2),(103,3),(110,4),(111,5),(107,6),(108,7),(104,8),(105,9),(106,10),
  (119,11),(109,12),(112,13),(120,14),(113,15),(114,16),(115,17),(116,18),(117,19),(118,20)
) AS v(code, rank) WHERE "gap_reasons"."code" = v.code;
```

Her ranking is from her email of 11 Oct, 13:03. Deprecated codes 1–10 keep `rank NULL`. No RLS change is needed: policies are row-level (`20260710205004:180-193`).

**Seed.** In `prisma/seed-data/gap-reasons.ts`, add `rank` to each live code. In `prisma/seed-reference.ts:162-176`, put `rank` in **`create` only**. Putting it in `update` would let a rerun of `seed:reference` wipe ranks edited in Settings.

**Pure core** (new `src/lib/reason-codes/gap-metrics.ts`):
- `scholarshipAdjustedGap(gap, scholarshipSpendBeforeVat, vatRate)`: returns `gap + spend × (1 + vat/100)`. Null or 0 spend returns `gap`; null gap returns null. Round to pennies.
- `mainGapReason(linked: {code, rank, sortOrder}[])`: the lowest `rank`, with nulls last, then the lowest `sortOrder`, then the lowest `code`.
- Tests: no scholarship; scholarship at 20% VAT; null gap; ties; all-null ranks; deprecated-only.

**Export** (`src/lib/db/queries/exports.ts`, `src/lib/export/xlsx.ts`):
- Select `scholarshipSpendBeforeVat` (recommendation select, ~97-137), `assessment.vatRate` (~84-95) and `gapReason.rank`.
- Extend `ExportRowSource`, `ExportRow` and `mapExportRow`.
- Add two columns after "Gap Reasons": **"Main Gap Reason"** (`code – label`, the same convention as the existing column) and **"Scholarship-adjusted Gap"** (currency format like "Gap Amount").
- `xlsx.ts`: add both keys to `COLUMNS` (20-97) **and** to the hand-written `addRow` (151-176). Fix the auto-filter range at `xlsx.ts:188`: it uses `String.fromCharCode(64 + COLUMNS.length)`, which breaks past 26 columns. Use `worksheet.getColumn(n).letter` or a small `columnLetter(n)`, and test it at 26, 27 and 52.
- Update fixtures in `src/lib/db/queries/__tests__/exports.test.ts` and `src/lib/export/__tests__/xlsx-columns.test.ts` (header order).

**Reports** (`src/app/(admin)/reports/page.tsx`, `src/lib/db/queries/reports.ts`):
- New `getGapSummary(tx, roundId)`: `tx.recommendation.findMany({ where: { roundId }, select: { gapAmount, scholarshipSpendBeforeVat, assessment: { select: { vatRate, application: { select: { school } } } }, gapReasons: { select: { gapReason: { select: { code, label, rank, sortOrder } } } } } })`. Reduce it in a pure `summariseGaps(rows)` (tested).
- New section **"Gap"** in `SECTIONS` (42-50), placed after "Reason Code Frequency":
  - **Cards:** total gap; scholarship spend incl VAT; **scholarship-adjusted gap**; accounts with a gap; accounts with a scholarship. Split by school with the `SchoolCard` pattern (107-151), because Reports has no school filter.
  - **Table:** "Gap by main reason" with columns rank · code · label · accounts · total gap · total adjusted gap, ordered by rank, plus a "No gap code" row and a total row. It reproduces the table sent to Charlotte on 11 Oct.
- Load inside the existing `Promise.all` (471-493). Use `formatGBP` (224-231).

**Settings** (`src/components/admin/settings/gap-reason-table.tsx`, `src/app/(admin)/settings/actions.ts:1336-1402`, `src/lib/db/queries/reference-tables.ts:661-689`):
- Add `rank` to `GapReasonRow` and the mapper, and order the Settings list by `rank` (nulls last), then `sortOrder`.
- Add a **Rank** column to the read row, edit row and add row. While there, fix the edit row: its `sortOrder` input sits under the "Status" header (142-205 vs header 357-360). Give it its own "List order" column.
- **The deprecate toggle (70-84) re-posts every field:** include `rank` there or a toggle will clear it.
- Action: parse `rank` (optional positive int). Reject a duplicate rank among non-deprecated codes with a friendly message, as a validation in the action rather than a DB unique (ties are possible mid-edit). Add `sortOrder` and `rank` to the audit metadata (1388 audits only code, label and isDeprecated today).
- Tests: `src/app/(admin)/settings/__tests__/gap-reason-actions.test.ts` (rank saved, duplicate rejected, toggle preserves rank). `gap-category.test.ts:64-80` asserts the seed and needs the rank too.

**Picker (D-3).** No change by default. If Charlotte says "ranking order", `getGapReasons` (`src/lib/db/queries/recommendations.ts:199-204`) orders by `rank` (nulls last). `ReasonCodeSelector` keeps the incoming order within groups.

**Not in scope; record in `follow-ups.md`:**
- "Bursary Award (%)" in the export is £ on v2 rows (`xlsx.ts:34-39`).
- `getAwardDistribution` buckets £ into % bands.
- `SchoolCard` averages £ as %.
These are mislabels found during the survey, are licence fixes, and belong in a separate PR.

**Accept.**
- Export for round 2026/27 on rehearsal: the scholarship-adjusted gap column sums to about −£83,565, and Main Gap Reason matches her ranking table.
- Reports → Gap shows the same totals: −£851,622 gap and £768,057 scholarship incl VAT.
- Settings shows ranks 1–20 and a new code can be ranked.

**Blast radius.** Prod: one new nullable column; 20 rows get a rank; no figures change.

---

### T3 · WP-3 — links to previous years

**Facts.**
- The admin tab (`src/app/(admin)/applications/[id]/assessment/admin/page.tsx`) renders an inline "Payable-fees schedule" table (446-547) from `getPayableFeesScheduleRows` (`src/lib/db/queries/payable-fees-schedule.ts`). That query already matches each schedule row to an application (`entry.applicationId`, falling back to the academic year, 117-120), but drops the id from `PayableFeesScheduleTableRow` (17-36).
- `ScheduleGrid` (`src/components/admin/schedule-grid.tsx`) is a different table on the Applicant Data tab. Its `ScheduleEntryRow` reduces `applicationId` to `hasApplication`.
- The year-on-year comparison uses `getPreviousAssessment` (`src/lib/db/queries/reassessment.ts:486-543`): same `bursaryAccountId`, any other round, latest `submittedAt`. It does **not** restrict to earlier years, so viewing an older year could pick a *later* one as "previous", and NULL `submittedAt` sorts first in DESC. The same flaw is in `previousYearApplicationQuery` (107-119) and the watch-out selector (`watch-out-notes.ts:70`).
- **Migrated accounts have no past years in the system.** Their schedule starts at 2026-27 (year 1, COMPLETE). Earlier years exist only as `preSystemHistory` rows, which have no application to link to. Links start being useful from 2027-28. Tell Charlotte this when T3 ships; it's already implied by the quote.

**Change.**
1. `payable-fees-schedule.ts`: carry `applicationId: app?.id ?? null` (≈l.150).
2. Admin page table: the academic-year cell becomes a link to `/applications/{applicationId}/assessment` when `applicationId` is set and is not the current application. Mark the current row "This year".
3. Applicant Data `ScheduleGrid`: carry `applicationId` alongside `hasApplication` (`schedule.ts` query 54/70 and the row type 14-28) and link the same way.
4. Assessment page header: a "Last year's assessment →" link from the corrected previous-assessment lookup. Make `getPreviousAssessment` return the application id and restrict it to rounds whose academic year is **earlier** than the current round's (compare the normalised start year; `nulls last`). Apply the same restriction in `previousYearApplicationQuery`. Check `ReassessmentContext` / `YearComparison` still behave (`reassessment-previous-assessment.test.ts`).
5. Year-on-year table (`mergeYoyHistory`, `src/lib/assessments/admin-tab.ts:92+`): keep the `applicationId` that `YoyFinancialsTableRow` already has (`yoy-financials.ts:70`) and link the year label. Manual pre-system rows stay unlinked.
6. Previous-year wizard callout (240-259): `WatchOutSelection` already returns `applicationId`, so add the link.

**Access (D-4).** Resolve link targets under the viewer's own context (`withUserContext`, as today). An ASSESSOR then sees links only to applications assigned to them; everything else is invisible to them under RLS anyway. Make no RLS or redirect change. Document it in the PR.

**Seam.** `scheduleRowLink(row, currentApplicationId)` and `isEarlierAcademicYear(a, b)` (handles "2026/27" and "2026-27"; reuse the normaliser behind `scheduleYearLabels`, `lifecycle.ts:33-38`). Unit-test both, and extend `reassessment-previous-assessment.test.ts` with "a later year is never previous".

**Accept.**
- On staging, a two-year test account (build one on nonprod: lock a 2026/27 award, then a 2027/28 re-assessment) shows a link from year 2's admin page to year 1, and from the assessment page to "last year".
- Viewing year 1 shows no "previous" link.
- On rehearsal, migrated accounts show no broken links.

**Blast radius.** Read-only.

---

### T4 · WP-4 — End after this year / Add a year (+ F3, + anchor fix)

**Facts that shape the design.**

1. **Deleting rows alone does not stick.** `generateSchedule` (`src/lib/bursary-accounts/schedule.ts:156-204`) inserts every missing `scheduleYear` up to the horizon. It is called by Regenerate (`schedule-actions.ts:78`) and by **every award lock**: `promoteToActiveAccount` (`account-promotion.ts:114`), called from `post-assessment-core.ts:221`.
2. **The lock-time call anchors on the current application's round**, not on the account's `firstAssessmentYear`. A re-created year would get the wrong academic year and dates. The same call **re-activates a CLOSED account** (`account-promotion.ts:108-113`).
3. **Invitations ignore the schedule.** `getActiveBursaryHolders` (`src/lib/db/queries/invitations.ts:326-368`) returns every ACTIVE account not yet invited to the round. It is the single chokepoint for re-assessment invites: `runReassessmentInvites` (`invitations/actions.ts:632-748`) → batch, selected and from-applications actions, plus the queue's "re-assessment eligible" filter (`queue/page.tsx:209`). **This is a live bug (F3)**: a Year 13 family with no 2027-28 year would be invited next spring.
4. The admin page's payable-fees table labels the school year by array index (`payable-fees-schedule.ts:153`), so a gap in the middle would mislabel the rows after it.
5. `closeAccountIfComplete` (`lifecycle.ts:62-87`) closes an account when every row is COMPLETE. It is called after an assessment completes (`assessment/actions.ts:472-479`).
6. The home page labels the school year `entrySchoolYear + scheduleYear − 1` (`schedule-home.ts:211-214`), so a year beyond the final year would read "Year 14".

**Schema.** Migration `<ts>_bursary_account_schedule_end_year`:

```sql
ALTER TABLE "bursary_accounts" ADD COLUMN "schedule_end_year" INTEGER;
-- NULL = natural horizon (to Year 13, Year 11 for OP_PARTNER). A number = the last scheduleYear kept.
```

`BursaryAccount.scheduleEndYear Int? @map("schedule_end_year")`, with a doc comment. Do not touch `scheduleYears` (written by `generateSchedule`, read by nothing).

**Generation.**
- `resolveScheduleHorizon` gets an optional `scheduleEndYear`; the effective horizon is `min(natural, scheduleEndYear ?? natural)`.
- `generateSchedule` uses it, so Regenerate and lock never re-create an ended year.
- **Anchor fix:** in `promoteToActiveAccount`'s existing-account branch, pass dates for the account's `firstAssessmentYear` round, not the current application's round, so a re-inserted year gets the correct academic year. Factor out `roundDatesForAccount(tx, account)`; Regenerate already resolves the round this way (`schedule-actions.ts`).
- Keep the CLOSED → ACTIVE re-activation (D18), but only when the account's horizon includes the locked year.

**Actions** (new, in `src/app/(admin)/applications/[id]/schedule-actions.ts`, modelled on `toggleScheduleShowOnPortalAction` 115-184). Both are ADMIN only, run under `withUserContext` (the `is_admin()` write policy allows DELETE), and revalidate `/applications/{id}` and `/applications/{id}/assessment/admin`.

- `endScheduleAfterYearAction({ applicationId, reason })`:
  - "This year" is the schedule row of this application: matched by `applicationId`, else by the normalised academic year of its round.
  - Refuse if any later row is not `SCHEDULED` (it has an application or was received). Say which year.
  - Delete the later `SCHEDULED` rows and set `scheduleEndYear` to this row's `scheduleYear`.
  - `reason` is required (free text, 3–500 chars).
  - Audit `SCHEDULE_ENDED_AFTER_YEAR` with `{ scheduleYear, academicYear, removedYears: [...], reason }`.
  - **D-5 default:** the account stays ACTIVE.
- `addScheduleYearAction({ applicationId, reason })`:
  - The next year is `max(scheduleYear) + 1`. Refuse beyond the natural horizon: "This pupil's bursary ends at Year 13 (Year 11 at Old Palace)". No Year 14.
  - If the account is CLOSED, re-open it with `reopenAccountForAssessmentYear` (`src/lib/bursary-accounts/lifecycle.ts:128`, the documented exception to write-once `closedAt`, `schema.prisma:136-146`), clearing `closedAt` and `closeReasonId` as that helper does.
  - Insert the row through `planSchedule` for that single year, so dates and labels match generation. Set `scheduleEndYear` to the new last year, or NULL when it reaches the natural horizon.
  - Audit `SCHEDULE_YEAR_ADDED` with `{ scheduleYear, academicYear, reopened, reason }`.
- Add both keys to `AUDIT_ACTIONS` and labels to the history page map (`[id]/history/page.tsx:30`).

**UI** (admin tab, next to the existing Close dialog at `admin/page.tsx:221-231`):
- Two buttons, ADMIN only: **"End after this year"** and **"Add a year"**. Each opens a dialog that shows exactly which years will be removed or added and asks for a reason.
- Disable "End" when there are no later SCHEDULED rows, and disable "Add" at the natural horizon, each with a tooltip saying why.
- Fix the payable-fees table to label school years from `scheduleYear`, not the array index.

**Invitations (F3)** (`getActiveBursaryHolders`):
- Require `scheduleEntries: { some: { status: SCHEDULED, academicYear: { in: scheduleYearLabels(round.academicYear) } } }`. This takes one round lookup, and `scheduleYearLabels` bridges "2026/27" and "2026-27".
- The queue's eligibility filter uses the same predicate. Extract `reassessmentEligibleWhere(roundAcademicYear)`.
- `createReassessmentApplicationAction` (`invitations/actions.ts:1259`) should refuse the same accounts, with a clear message.

**Toolkit impact (T8).** Invariant A9 (`scripts/gt-migration/load/phases.ts:423-427`) asserts `rows === resolveScheduleHorizon(...)`. It must pass `scheduleEndYear`, or `mig verify` fails once Charlotte ends a year on rehearsal.

**Seams and tests.**
- `effectiveHorizon(natural, scheduleEndYear)`.
- `planEndAfterYear(rows, thisYear)`: returns `{ deleteIds, refuseReason? }`.
- `planAddYear(rows, naturalHorizon)`: returns `{ scheduleYear } | { refuseReason }`.
- `reassessmentEligibleWhere`.
- Extend `schedule.test.ts` (generation respects the end year; idempotent), `schedule-actions.test.ts` (both actions: role, refuse paths, audit), `account-promotion.test.ts` (anchor uses `firstAssessmentYear`; an ended account is not regrown) and `reassessment-lock-guard.test.ts` (holders filtered). Add the first test for `closeBursaryAccountAction` while there; it has none.

**Accept** (on rehearsal with the test family TS-NOWS01):
- Admin ends Year 8's account after 2026-27: rows 2027-28…2031-32 disappear, and the family's home page shows one year after refresh.
- Regenerate does not bring them back.
- Add a year brings back 2027-28 with the right dates.
- The Year 13 child is not in the 2027/28 re-assessment invite list.
- The audit log shows who did it and why.

**Blast radius.**
- Prod: one new nullable column and no data change.
- The invite filter changes who is eligible next spring: accounts with no SCHEDULED row for that year drop out, which is the fix.
- Before promotion, run a query listing prod ACTIVE accounts with no row for the next round's year, and put the count in the PR.

---

### T5 · WP-5 — the show-on-portal tick governs the home page too

**Facts.**
- `showOnPortal` is filtered only in `getPortalScheduleForUser` (`src/lib/db/queries/schedule.ts:127-131`), which serves the `/schedule` calendar and the nav gate.
- The home page query `getScheduleHomeForUser` (190-313) ignores it.
- New rows default it on for years 1–2 only (`DEFAULT_PORTAL_VISIBLE_YEARS = 2`, `schedule.ts:45`).
- Prod has 4 of 9 rows ticked; rehearsal has 479 of 931.

**Change (D-2 default).**
1. `planSchedule`: `showOnPortal = true` for every year. Delete or repurpose `DEFAULT_PORTAL_VISIBLE_YEARS`.
2. `getScheduleHomeForUser`: `where: { showOnPortal: true }` on the entries select.
3. Data migration `<ts>_schedule_show_on_portal_all_years`: `UPDATE bursary_schedule_entries SET show_on_portal = true WHERE show_on_portal = false;`. This is a mass UPDATE, so **name it in the PR and get Brian's approval** (CLAUDE.md). Prod: 5 rows. Rehearsal: re-run after the manual migrate deploy.
4. Admin `ScheduleGrid`: relabel the toggle to say what it now does ("Shown to family" / "Hidden from family") so the two pages agree in words too.

**Seam.** `visibleHomeEntries(entries)` if the filter lives in the mapper rather than the query. Otherwise extend `portal-schedule-query.test.ts` with a hidden row.

**Accept.** On rehearsal, untick 2028-29 for one TS-NOWS01 child: it disappears from both the home page and the calendar. Tick it again and it returns.

**Blast radius.** Prod: 5 rows ticked on; the families of the 2 accounts see years they already saw on the home page (no visible change), and those years now also appear on the calendar.

---

### T6 · WP-6 — standing synopsis on the admin page

**Facts.**
- `Assessment.synopsis` is per year, plain text, autosaved by `saveSynopsis` (`assessment/checklist-actions.ts:31-70`; ADMIN/ASSESSOR; no status guard; audits `ASSESSMENT_SYNOPSIS_SAVE`).
- All award locks go through `setPostAssessmentFinalState` (`src/lib/applications/post-assessment-core.ts:123-320`), one transaction (137-280). `isAwardLock` is at 173 and the lifecycle write at 259. It is called by the award form and by `bulkLockRolledOverAction`. A revert (`revertPostAssessmentState`, 329-379) followed by a re-lock calls the core again.
- The legacy v1 path is `setApplicationOutcome` (`src/lib/applications/set-outcome-core.ts:158`).
- The migration loader bypasses the core and writes the lock directly (`scripts/gt-migration/load/phases.ts:469-478`).
- `BursaryAccount` has no notes field. The toolkit's rollback refuses accounts whose `bursary_accounts.updated_at` moved after the load (`rollback.ts:112-134`), so **a column on BursaryAccount would block rollback**. Use a child table.

**Schema.** Migration `<ts>_account_synopsis_entries`:

```sql
CREATE TYPE "AccountSynopsisKind" AS ENUM ('YEAR', 'NOTE');
CREATE TABLE "account_synopsis_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "bursary_account_id" UUID NOT NULL REFERENCES "bursary_accounts"("id") ON DELETE CASCADE,
  "kind" "AccountSynopsisKind" NOT NULL,
  "assessment_id" UUID UNIQUE REFERENCES "assessments"("id") ON DELETE SET NULL, -- YEAR entries: one per assessment
  "academic_year" TEXT,                -- YEAR entries, e.g. '2026-27'
  "body" TEXT NOT NULL,
  "created_by_id" UUID,                -- NULL for system/migration
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "account_synopsis_entries" ("bursary_account_id", "created_at");
-- RLS: copy the bursary_accounts pattern. SELECT for admin/viewer/assessor; INSERT/UPDATE for admin and
-- assessor (assessors may already write bursary_accounts: 20260522103852); no DELETE for app_user.
```

Write the policies **in this migration**, using the patterns in `20260606210000_bursary_schedule_entries` and `20260522103852`.

**Behaviour.**
- **On award lock**, inside the core transaction after l.259 when `isAwardLock`: upsert the YEAR entry keyed by `assessment_id`, with body = the assessment's synopsis at lock time and `academic_year` from the round. A re-lock replaces the body (D-6), which makes it idempotent. Skip when the synopsis is blank. Use the account id from `fetchApplicationForLifecycle`, or from `promoteToActiveAccount`'s result when the account was just created.
- **Legacy v1 `setApplicationOutcome`:** hook it the same way only if v1 locks still happen. Check prod for v1 recommendations first; if there are none, leave a comment and skip.
- **After lock:** editing that year's `Assessment.synopsis` (still allowed after COMPLETED) also updates its YEAR entry, so the two never disagree. Do this in `saveSynopsis` (same transaction) when a YEAR entry exists for the assessment.
- **Notes:** ADMIN/ASSESSOR can add a NOTE (free text). ADMIN can edit a note. Nobody deletes. Audit `ACCOUNT_SYNOPSIS_NOTE_ADDED` / `_EDITED`.
- **Display:** a new card at the top of the admin tab, above the per-year `AssessmentSynopsis` (`admin/page.tsx:262-284`), titled "Account synopsis (all years)". It is a timeline, newest first: YEAR entries headed by their academic year (read-only, with "edit in that year's assessment"), and NOTE entries headed by date and author. The existing per-year box stays and is renamed "This year's synopsis" so the two are not confused (her original question).
- **Retention (D-7):** add the table to the close-purge scrub map with the same verdict as `Assessment.synopsis` (`src/lib/retention/close-purge.ts:16`, `scrub-map.ts:23, 134-140`). There is a test for the scrub map; extend it.

**Seams and tests.**
- `yearEntryFromLock({ synopsis, academicYear })` (blank → null).
- `orderSynopsisTimeline(entries)`.
- Extend `post-assessment-core.test.ts`: lock creates; re-lock replaces; blank skips; ROLLED_OVER bulk lock creates per row; revert leaves the entry.
- Action tests for note add/edit (roles, audit).

**Migrated accounts (T8).** Seed one YEAR entry per migrated account from `Assessment.synopsis` (which includes the Grant Tracker footer).
- **In the loader:** write the entry in the same transaction as the assessment lock (`phases.ts` ~469-478) and ledger it. Add the new `EntityType` to the rollback ORDER (`rollback.ts:39-54`) before `BursaryAccount`. The cascade covers it anyway, but explicit ledgering keeps verify honest.
- **For rehearsal, already loaded:** a `mig backfill-synopsis --env rehearsal --run rh-r1-20261008` command, ledgered so rollback stays exact.

**Accept.**
- TS-NOWS01 on rehearsal shows each child's 2026-27 Grant Tracker synopsis in the account card.
- Adding a note shows it, with author and date.
- On staging, locking a new award creates a YEAR entry; reverting and re-locking replaces it, not duplicates it.

**Blast radius.** Prod: a new empty table. Existing locked prod assessments (6) get no entry unless backfilled. Offer a backfill of the 2 active accounts in the PR, as a one-off ledgered script, approval needed.

---

### T7 · WP-F2 — rolling-over dates on future schedule years (blocked on D-1)

**Facts.**
- `planSchedule` (`schedule.ts:94-122`) sets every year's `availableOn` and `requiredBy` to the award round's `openDate` and `closeDate` shifted by N years. That gives 21 Aug and 30 Nov forever.
- Those values win over everything else in the home page's date order (`schedule-home.ts:17-23, 149-171`), so the RA (rolling-over) window code (`src/lib/rounds/round-scenario.ts:8-13, 107-115`, default 12 Apr → 22 May) is never reached.
- Award news shows only when `roundId` is set (year 1). Future years show "—", which is correct until those rounds exist.

**Change (D-1 answered 12 Oct: open 15 April, close 21 May).** Set the `round-scenario.ts` RA default to 15 Apr → 21 May (it's 12 Apr → 22 May today). For academic year `YYYY-(YY+1)` the dates fall in spring `YYYY`: 2027-28 → `availableOn` 2027-04-15, `requiredBy` 2027-05-21.
- `planSchedule`: year 1 keeps the award round's dates. Years ≥2 use the rolling-over window of the round they will fall in: the award round's `RoundWindow` for scenario `RA` if set, else her D-1 dates, else the `round-scenario.ts` RA default. Each is shifted to that year. Put her window into `round-scenario.ts` as the RA default if she gives fixed dates; it is a per-round setting already editable on the Rounds page (`saveRoundWindowsAction`, `rounds/actions.ts:433`).
- Data migration: re-date future `SCHEDULED` rows with `scheduleYear ≥ 2` and `round_id IS NULL`. Name it in the PR. Prod: about 7 rows today. Rehearsal: re-run after deploy.

**Seam.** `scheduleDatesForYear({ awardRound, raWindow, scheduleYear })`, tested for year 1, year 2 with a round window, year 2 with the default, and a leap-year shift.

**Accept.** TS-NOWS01 on rehearsal shows 2027-28 onwards with her rolling-over dates; 2026-27 is unchanged.

---

### T8 · Toolkit changes (branch `chore/gt-migration-toolkit`, scripts only)

1. **Footer dates (promised 11 Oct).** In `composeSynopsis` (`scripts/gt-migration/load/plan.ts:140-155`), format `today` and the GT completed/received dates as "10 October 2026" (en-GB, Europe/London). Update `load-plan.test.ts:92-95`.
2. **A9 invariant** (`phases.ts:423-427`) uses the effective horizon with `scheduleEndYear` (from T4).
3. **Standing synopsis seeding** (from T6): add an entry in `loadAssessment`, a ledger entity type, a rollback ORDER entry, a verify check (one YEAR entry per migrated account) and the `backfill-synopsis` command for rehearsal.
4. **Re-plan defaults.** After T5/T7, `mig plan` picks up `showOnPortal` for all years and rolling-over dates automatically, because the loader goes through `generateSchedule`. Run `mig plan --env rehearsal` and diff it against the previous plan, so the only changes are those fields.
5. Rebuild the rehearsal data for these accounts only if Charlotte wants it fresh. Otherwise the backfills in T5/T6/T7 cover rehearsal.

---

## §6 · Validation path for every tranche

1. **Local:** tsc / test / prisma format (§3).
2. **PR → staging:** CI green. The migration applies to nonprod via `db-push.yml`. Smoke-test on the staging preview with `brian.admin@jwf-bursary.test`.
3. **Merge** (Brian approves `gh pr merge`).
4. **Migration staging (rehearsal):**
   - Bring `chore/gt-rehearsal` up to `origin/staging` (fast-forward if possible; otherwise ask, per G6).
   - Apply new migrations by hand: `DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy`, with the rehearsal URLs from `.env.migration.rehearsal`. **Check the project ref is `ldqpzjizqvrairoojker` first.**
   - Run any rehearsal backfill.
   - Wait for the Vercel `rehearsal` deploy to be Ready, and confirm `meta.githubCommitSha` with `vercel api`.
   - Browser-check as admin and as the TS-NOWS01 test family. The Playwright scripts are in the session scratchpad `uicheck/` (`check.mjs`, `family.mjs`); re-create them under the worktree if the scratchpad is gone.
5. **Tell Charlotte** what to try, by family code, in one email per batch, not per PR. Suggested batches: (T1+T2), (T3+T4+T5), (T6+T7).
6. **Promotion** (`staging → main`) only on Brian's explicit instruction, after her OK. Open the PR with the commit checklist and per-tranche blast radius.

---

## §7 · Timeline (working days from Charlotte's approval)

Sprint planned 13 Oct. Day 1 is Tue 13 Oct; slack is about one day, held in T4.

| Day | Date | Work | Done when |
|---|---|---|---|
| 0 | Mon 12 Oct | Approved. G1 · plan merged (#432) | — |
| 1 | Tue 13 Oct | T1 (F1 + F4 + F5) | PR open |
| 2 | Wed 14 Oct | T2 | PR open |
| 3 | Thu 15 Oct | T3 · batch 1 (T1+T2) to rehearsal; email Charlotte (incl. D-3/D-5 defaults) | Batch 1 sent |
| 4–6 | Fri 16 – Tue 20 Oct | T4 (largest: generation, two actions, invite filter, UI, tests) | PR open, prod eligibility count in body |
| 6 | Tue 20 Oct | T5 (backfill needs Brian's approval) | PR open |
| 7 | Wed 21 Oct | Batch 2 (T3+T4+T5) to rehearsal; email Charlotte | Batch 2 sent |
| 7–8 | Wed 21 – Thu 22 Oct | T6 | PR open |
| 9 | Fri 23 Oct | T7 · T8 | PRs open |
| 10 | Mon 26 Oct | Batch 3 (T6+T7+T8) to rehearsal; email Charlotte. **Promise met** | — |
| after | — | Her sign-off → promotion (Brian) → live load (D-8) → invoice £1,100 | — |

**Risks.**
- **T4 is the risky one:** a wrong horizon or invite filter means a family is invited, or not, next spring. Mitigation: pure seams, the prod eligibility query in the PR, and a test family on rehearsal.
- **Parallel worktree agents** have collided before (`feedback_parallel_agents_worktree_cwd`): build tranches one at a time and verify each PR's file list.

---

## §8 · Out of scope (logged, not built)

- **Export/report mislabels:** "Bursary Award (%)" on £ values, % banding of £ awards, and the `SchoolCard` average. Goes to `follow-ups.md` as a separate licence fix.
- Charging for anything beyond the six items. Anything new she raises from testing goes to a new quote.
- Reports school filter. T2 splits by school inside the section instead.
- Account-level reporting of ended schedules (`reports.ts:612-669` computes years remaining from the final school year, not the schedule). Note it if she asks.
- Year 14 / beyond the natural horizon: refused by design.
- **Phase 5, the "Parent View" redesign** (her workbook, 12 Oct, thread `1a12f98bb30f54cf`). Quoted 13 Oct at £1,300 (Home, My Bursary Application(s), My Application(s) Schedule, Help form to the fees inbox, My Details); Paused Assessment page parked. Awaiting her decision, and it starts only after Phase 4 is on migration staging. That quote also lists two licence items for the home page (remove "Your bursary portal is ready"; guidance sections always visible): build those with Phase 5, not here. The workbook holds a real family's personal and bank data: never commit it.
