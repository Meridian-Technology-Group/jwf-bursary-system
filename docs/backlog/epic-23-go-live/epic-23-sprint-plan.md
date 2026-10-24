---
title: "Epic 23 — go-live sprint: migration fixes, rejected forms, exports, dashboard, retention"
status: "READY — dispatch as one autonomous run (see §9)"
charge: "None. Everything here is delivered under the existing agreements (Brian, 16 Oct 2026). Do not describe any item as new work, a change request or chargeable — in code, PRs or emails."
opened: 2026-10-16
opened_by: Brian Wagner
sources:
  - "Charlotte's emails 16 Oct 2026 09:12 + 09:22 UTC, thread 1a14190d5c2b914a ('Phases 4 and 5 - testing feedback') — her answers to Brian's eight questions + 'all 271 are rolling-over accounts'"
  - "Charlotte's email 16 Oct 2026 09:24 UTC, msg 1a14406f355c8673 — the DPO-signed data-retention rules (PDF attachment)"
  - "Charlotte's email 15 Oct 2026 22:51 UTC, msg 1a141c3865f0bf27 — EXPORTS.xlsx (the three export sections; attachment index 1)"
  - "Charlotte's email 6 Sep 2026 18:48 UTC + her answers 20:59 UTC, thread 1a0780d1f41e55e9 ('Dashboard') — Dashboard.xlsx (attachment index 1)"
  - "Call 16 Oct 2026 14:00 (Brian, Charlotte, Alex) — Granola notes 904af384; outcomes restated in §1"
code_surveyed_at: "origin/staging 5dc03c6 (16 Oct 2026); toolkit chore/gt-migration-toolkit 7cd4c84"
---

# Epic 23 — go-live sprint

**This document is the handover.** It assumes no context beyond the repo, the auto-memory (`MEMORY.md`, loaded automatically) and this file. Read §0–§4 in full before touching anything. Then build the tranches in §5 **in order**, one at a time, to the rules in §3, validating each per §6.

The sprint has two goals, in this priority:
1. **Unblock the Grant Tracker live load.** The 271 migrated accounts go into prod after Brian promotes staging → main. Charlotte's new applications start in about three weeks.
2. **Ship what she asked for on 15–16 Oct.** That is: rejected forms returned rather than wiped, the Documents tab removed, three exports with a field picker, the dashboard rebuilt to her 6 Sep layout, and retention rebuilt to the DPO-signed rules.

---

## §0 · Starting position (16 Oct 2026)

- **Code.** `origin/staging` = `5dc03c6`. Epic 21 (Phase 4) and Epic 22 (Phase 5, P1–P5) are merged to staging, along with #452 (synopsis backfill), #453 (per-invitation "Submit by") and #454 (GT schedule dates). `origin/main` is behind staging. **Only Brian promotes.**
- **Migration staging** is Charlotte's name for the rehearsal environment:
  - Supabase project ref **`ldqpzjizqvrairoojker`**, Vercel custom environment `rehearsal`, deployed from branch `chore/gt-rehearsal`.
  - `chore/gt-rehearsal` is at `e5496cd`. It contains all of `origin/staging` plus merge commits only.
  - It holds all 271 migrated accounts (run `rh-r1-20261008`, canonical extract `e3391ced7065`) and the parent login for the test family **TS-NOWS01**. There is no non-migrated family there.
  - `db-push.yml` does **not** migrate it: apply migrations by hand (§6).
  - Charlotte is testing on it **right now**, so treat its data as hers. No reloads, no rollbacks, no deletes.
- **Prod** (Supabase `supabase-prod`; the MCP is read-only via `&read_only=true`) has 2 ACTIVE accounts. **The GT live load has not happened** and is not part of this sprint (§8).
- **Toolkit.** `scripts/gt-migration/` on branch `chore/gt-migration-toolkit`, in the **main checkout** `bursary-system/`. That branch matches its remote at `7cd4c84`. Data, manifests and run ledgers live in `../data/migration/`. Resume notes are `../data/migration/RESUME.md` and `STATE.md`; **read both before any toolkit work.**
- **Worktrees.**
  - The main checkout stays on the toolkit branch and has an uncommitted `docs/.obsidian/app.json`. That file is Brian's; never touch, stage or revert it.
  - `../bursary-system-epic21` holds `.env`, `.env.local` and `.env.migration.rehearsal`.
  - `../bursary-system-epic22` holds this plan's docs branch.
  - **Build this sprint in a new worktree, `../bursary-system-epic23`** (§3, T0).
- **Rehearsal counts** (canonical, verified by survey 16 Oct): 271 accounts; 221 rolling-over and 50 new; Trinity 138, Whitgift 112, Old Palace 21.
  - **63 leavers** have no 2027-28 schedule row: Whitgift Y13 28, Trinity Y13 23, OP Y11 12. All 63 are rolling-over and all are loaded ACTIVE.
  - **208** have a 2027-28 SCHEDULED row, i.e. are re-assessment eligible. 208 + 63 = 271, which matches Charlotte's rule (every non-Y13 TS/WS and non-Y11 OP account shows a 2027-28 application due).

---

## §1 · What was decided (16 Oct, emails + call). This is the spec

| # | Topic | Decision | Tranche |
|---|---|---|---|
| 1 | "Debt spiral" with zero declared debt (TS-GORD05) | **Correct, no change.** Negative disposable income after notional spend is a shortfall by her 11 Sep rule. She reads it as undisclosed debt or savings | — |
| 2 | Pre-live assessment spreadsheet of the 271 accounts | **Yes.** The Section 3 (statistical) fields of her Exports sheet, password-protected, before the live load | T5 |
| 3 | Child date of birth (NULL on all 271) | **Option (b).** Load the DOB from GT's annual review forms where it is consistent (~205 rolling-over accounts). Leave the rest blank and send her the list of blanks (by family code); she fills in what she has | T2 |
| 4 | Rejected forms | The parent gets **their previous answers and documents back**, with a message that the form was returned and must be corrected. Charlotte then removes the specific bad items (wrong-year P60, forged return, blurry statement, wrong figures) so the gaps show. **A new "Submit by" date is set on rejection** (the original has usually passed, or the rolling-over window is still open) | T7 |
| 5 | Parent Documents page | **Remove it altogether.** Uploaded documents follow the retention rules (1 year after the account closes); there is no historical uploads page in the parent account | T3 |
| 6 | "Not submitted" on the schedule | Keep the wording. She says it should never occur: an account is submitted, extended or closed | — |
| 7 | 2027/28 rolling-over deadline | **Saturday 22 May 2027**, not 21 May | T1 |
| 8 | Admin schedule "Shown to family" column | Fine as it is | — |
| 9 | All 271 as rolling-over active bursaries | **Already true** (§0 counts). Leavers stay ACTIVE until they actually leave and are closed in the system then. **Do not close them now**: they are current Y13/Y11 pupils with live 2026-27 bursaries | T2 (verify only) |
| 10 | Exports: three sections from EXPORTS.xlsx | Build all three. Each has a **search form** and a **field picker** (every column ticked by default; she unticks to make a short report, as in Grant Tracker) | T4, T6, T8 |
| 11 | Exports Section 2, "all fields in part 1" | **Every field in assessment Part 1**, then the Part 2 totals she lists, then the Part 3–5 fields she lists | T8 |
| 12 | Exports: number of parents and number of schooling-age children | **Blank for migrated (Grant Tracker) applications.** Derived from in-system data for applications made in the portal | T4 |
| 13 | Exports Section 1, "% completion less than x" | The **parent's form progress**, the same figure the parent sees. She uses it mid-window to nudge families | T6 |
| 14 | Export access control / "password" / "external sharing" | **Deferred by Brian (16 Oct).** Every export keeps today's access (ADMIN, ASSESSOR, VIEWER). Build Section 3 like the others; ignore its "external" nature for now. No role-per-section work in this sprint | — |
| 15 | Dashboard | **Rebuild `/admin` to her 6 Sep layout** (Dashboard.xlsx), with an editable "illustrative data" store for sections whose real data doesn't exist yet (promised in Brian's 6 Sep reply). Her 6 Sep answers are in §5 T9 | T9 |
| 16 | Retention | **DPO signed 16 Oct; T&Cs also signed** (confirmed on the call). Rebuild retention to the signed rules (§5 T10) | T10 |
| 17 | Domain `bursaries.johnwhitgiftfoundation.org` | Done by Brian and Alex together after Charlotte's go-ahead. **Not in this sprint**; touch no Vercel domain or DNS settings | — |

---

## §2 · Decisions taken in this plan (defaults)

"Default" = build on it and list it in the delivery email (§6 step 6) so she can object. These are not questions to stop on.

| ID | Question | Default | Tranche |
|---|---|---|---|
| **D-1** | Where the 22 May fix goes | Data, not code. Set the 2027/28 round's stored RA window `submitBy` to 2027-05-22 on rehearsal **through the Rounds page** (`saveRoundWindowsAction` re-dates the year's still-SCHEDULED rows). Also set `Round.defaultSubmissionDeadlineRolling` if it is filled. **Leave the code fallback `RA_SUBMIT_BY_DAY = 21` (`src/lib/rounds/round-scenario.ts:43-44`) alone**: 22 May is a one-off for 2027, not a new yearly rule. Check prod read-only and report its 2027/28 round state to Brian; never write to prod | T1 |
| **D-2** | DOB "consistent" | Normalise each GT DOB string to an ISO date first (formats vary), then compare. One distinct date across all of the account's Recurring Annual forms = consistent. The 16 "conflicting" may collapse after normalisation; re-count and report | T2 |
| **D-3** | How DOB reaches rehearsal | A new **idempotent, ledgered toolkit patch command** (e.g. `mig patch-dob --run <id>`). It sets `child_dob` only where it is NULL, on the account's Contact, BursaryAccount and migrated Application (and on an Invitation if one exists for that child), and writes each change to the run ledger so it can be undone. **Never a reload or rollback**: she is mid-test and `assertUntouched` would refuse touched accounts anyway. The same patch is folded into the plan builder so the prod live load gets DOBs natively | T2 |
| **D-4** | The DOB blank list | A CSV in `../data/migration/` (never committed) with columns family code, school, current school year and reason ("new award, no GT annual form" / "dates differ across years"). **No names, no dates.** It is attached to the delivery email draft | T2 |
| **D-5** | "Bursary award type" column | `Assessment.awardFundType` (JWF / WSP-JWF / WFA / TBF), shown with her labels. NEW_AWARD vs ROLLED_OVER is already covered by "Application type" | T4 |
| **D-6** | Which school the export filters on | Section 1: `Application.school`. Sections 2–3: `Assessment.assessmentSchool`, falling back to `Application.school` | T4 |
| **D-7** | "Academic year" vs "Round" filters | Both read `Round.academicYear`. "Round" picks one round; "Academic year" picks every round for that year. The column "Academic year" = the round's academic year | T4 |
| **D-8** | Account Active/Closed filter for NEW applications with no account yet | Three options: Active, Closed, No account yet (pre-award). Default: all | T4 |
| **D-9** | Number of parents (in-system applications) | Count the assessment's parent earners (`AssessmentEarner.earnerLabel` PARENT_1 / PARENT_2). **Blank when `Application.migrationSource` is set.** Number of schooling-age children = `AssessmentProperty.schoolAgeChildrenCount`, blank when migrated. Both rules apply in every section that carries the columns | T4 |
| **D-10** | v1 assessments (`calculationVersion = 1`) | v2-only columns are blank, never zero | T4 |
| **D-11** | Values that aren't persisted | Total debt = `totalPersonalDebt(property.debts)`. Part 2 totals = the `src/lib/assessment/v2/income.ts` helpers. **Never `AssessmentEarner.totalIncome`/`benefitsIncluded`**, which are unreliable on v2; add `totalSelfEmployedIncome` / `totalPayeIncome` helpers beside them, with tests. "Add back notional rent applied" = the engine line `rentAddBack`, via `calculateAssessmentV2` with the reference bundle loaded **once per export**. Everything else reads the stored v2 snapshot columns | T4, T8 |
| **D-12** | Field picker UX | Grouped checkboxes (by section/part), every box ticked by default, with "Select all" / "Clear all". The selection goes to the route as `fields=` keys and the server validates them against the section's column registry. The last selection is remembered in `localStorage` (wrapped in try/catch) as a per-viewer convenience only. XLSX and CSV formats, as today | T4 |
| **D-13** | Section 1 rows | One row per application in the selected round(s). Also, **sent invitations with no application yet** appear as "Not yet started" rows (application fields blank), so a mid-window check sees everyone. Submission status mapping: CREATED / NOT_STARTED / no application → "Not yet started"; IN_PROGRESS / FILLED_IN → "Started"; SUBMITTED → "Submitted" | T6 |
| **D-14** | % completion in bulk | The same function the parent sees: `applicationCompletionFromGaps(getSectionGapStatuses(tx, appId, owningContributorId))`, scoped to the owning contributor (`resolveOwningContributorId`) so the number matches the parent's. Run it in chunks as `round-watchlist.ts:215-227` does, and raise the transaction timeout. If that is too slow at ~300 rows (>10 s), load sections and slots set-wise and call the pure engine | T6 |
| **D-15** | Siblings in exports | Flatten up to three: Sibling 1–3 name / school / payable fees. Section 3 has school and payable fees only | T8 |
| **D-16** | Rejection mechanism | **Reject returns the same application**, instead of hard-deleting it and creating a blank one. `formStatus` SUBMITTED → IN_PROGRESS. Sections and documents are kept. A live assessment resets to NOT_STARTED (as `reopenAssessmentForMaterialChange` does, `src/lib/applications/status.ts:738`). See T7 for details | T7 |
| **D-17** | The rejection email | Same template type `APPLICATION_RESTART_REQUIRED` (it is locked, so no new enum value), with new wording: "returned for correction; your previous answers and documents are still there; please correct the sections highlighted and resubmit by {deadline}". It ships as a migration that updates the body/subject **only where they still equal the seeded text** (`WHERE body = <seed>`), so a template Charlotte edited is never overwritten. If prod's or nonprod's copy differs from the seed, report it in the PR | T7 |
| **D-18** | Dashboard "illustrative data" store | One new table, `dashboard_sample_data` (`key` text PK, `payload` jsonb, `updated_at`, `updated_by`). Its RLS policies ship in the same migration: staff read, ADMIN write. It is edited from a new **Settings → Dashboard sample data** tab, with one small form per illustrative section. A section shows real data as soon as any exists, and sample data, marked **"Illustrative data"**, only while the real count is zero | T9 |
| **D-19** | Dashboard spend cohorts (her 6 Sep answer 3) | **Spend tables only** split ex-OP · TS · TS-TBF · WS · WS-WFA · WS-Pastoral Boarders. ex-OP = school OP or OP partner. TBF / WFA from `awardFundType`. Pastoral Boarders = `Application.migrationSource = MANUAL_PB` (the only pastoral marker that exists). WS-WSP-JWF counts under WS. Every workload count splits OP / TS / WS only | T9 |
| **D-20** | Retention anchors | Account-closed tier: `BursaryAccount.closedAt`. Unsuccessful tier: `Application.closedAt`, set by the staff close. If CLOSED_ARCHIVED or WAITING_LIST can end an application without setting `closedAt`, set it in that path (additive column if needed). No `submittedAt` anchors, no 30-day timers | T10 |

---

## §3 · Ground rules (apply always)

**Git.**
- Work only in `../bursary-system-epic23`, except toolkit work (T2, T5), which happens in the main checkout on `chore/gt-migration-toolkit`.
- One branch per tranche, from fresh `origin/staging`: `git fetch origin && git switch -c <branch> origin/staging`.
- Commit in Conventional Commits style, matching `git log`. End every commit message with the `Co-Authored-By` trailer from the session's attribution reminder.
- Every PR targets `staging` (`gh pr create --base staging`); end the body with the session's PR attribution line.
- Never commit to, or push directly to, `main` or `staging`. Never force-push. Never use `--no-verify`. Never open a `staging → main` PR.
- Never `git checkout --`, `git restore` or `git stash` files you didn't change. The Obsidian file in the main checkout is Brian's.
- **Merging:** see §9 (Brian's grant at dispatch). Squash-merge your own PR only when CI is green and its §6 checks pass.
- If `gh pr merge` asks Brian for approval and doesn't get it, leave the PR open. Carry on only with tranches that don't depend on it, each branched from `origin/staging`, and never stack branches.

**CI gates (run locally before every push):**
```bash
rm -f tsconfig.tsbuildinfo && npx tsc --noEmit
npx prisma format --check
npx vitest run
```
- Lint doesn't gate. Don't run `npx prettier` over files you didn't touch.
- tsconfig has no `target` (ES5): use `Array.from()` rather than iterating a Set or Map directly.
- A stale `tsconfig.tsbuildinfo` hides errors, hence the `rm`.

**Migrations.**
- Write migrations with `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` (adjust to the repo's documented pattern). Never run `migrate dev` against a shared database.
- Keep them **additive**: one migration per PR, alongside the code that needs it. Never edit an applied migration.
- Every new table has RLS force-enabled by the `ensure_rls` event trigger, so **its policies ship in the same migration**. Patterns: `20260519163000`, `20260710205004`, `20260606210000`.
- Don't widen enums. `ScheduleEntryStatus`, `BursaryAccountStatus` and `ApplicationFormStatus` all have silent binary checks. If a new enum value seems needed, stop and choose a column instead.
- Data UPDATEs inside a migration are allowed only if they are bounded and idempotent, and the PR body states the prod blast radius.

**Data access.**
- **Prod: read-only queries only**, through `mcp__supabase-prod__execute_sql`. No writes, no `migrate deploy`, no scripts with prod env.
- **Nonprod** (`supabase-nonprod`) gets migrations automatically on merge to staging. Never run `migrate reset`, `DROP`, or a mass `UPDATE`/`DELETE` against it.
- **Rehearsal:** hand-applied `migrate deploy` and the toolkit patch commands are the only writes. **Check the project ref is `ldqpzjizqvrairoojker` before every write.**
- Before any script runs, confirm the env file it reads. The Prisma CLI reads `.env`; the app and seeds read `.env.local`; the toolkit reads `.env.migration.<env>`.
- `audit_logs` is append-only. `profiles` is under RLS: write it with the service-role client, not Prisma.

**Code.**
- Every new decision goes in a **pure exported function**, unit-tested with vitest. There is no jsdom.
- Audit with `createAuditLog(tx, …)`. New actions are string keys in `src/lib/audit/actions.ts`.
- Staff queries run inside `withAdminContext`/`withUserContext` as the surrounding code does. Never expose staff-only data to a parent.
- Copy is British English and plain. Parent pages say "application", never "assessment".

**People and data.**
- In PRs, commits, docs and email drafts, identify families **by family code only** (TS-NOWS01), never by pupil, parent or sibling names. Never commit any of Charlotte's workbooks or exports.
- **Never send email.** Gmail **drafts** only, from `brian@meridiantech.group` (`user_google_email`). Brian sends.
- Never touch Vercel env vars, domains or DNS. If a tranche needs an env var, say so in the PR and the final report.

**No timelines.** Don't put dates or durations in anything. Report progress per tranche.

---

## §4 · Tranches and order

| T | Contents | Where / branch | Migration | Depends on |
|---|---|---|---|---|
| **T0** | Set up the sprint worktree and record a baseline | `../bursary-system-epic23` | — | — |
| **T1** | 2027/28 rolling-over deadline → 22 May 2027 on rehearsal; prod read-only check | Rehearsal UI (no code) | — | — |
| **T2** | Load child DOBs into rehearsal; produce the blank list; verify the 208/63 split and the school-age default | Main checkout, `chore/gt-migration-toolkit` | — (toolkit) | — |
| **T3** | Remove the parent Documents tab and page | `chore/portal-remove-documents-page` | none | — |
| **T4** | Exports framework + field picker + **Section 3** | `feature/exports-framework-statistical` | none | — |
| **T5** | The pre-live Section 3 spreadsheet of the 271 rehearsal accounts | Main checkout (script reusing T4's row builder) | — | T4 merged |
| **T6** | Exports **Section 1**: assessment workload | `feature/exports-workload` | none | T4 |
| **T7** | Rejected forms come back with answers and documents | `feature/reject-returns-form` | email body update (+ maybe a column) | — |
| **T8** | Exports **Section 2**: spend and billing | `feature/exports-spend-billing` | none | T4 |
| **T9** | Dashboard rebuilt to her 6 Sep layout + illustrative data store | `feature/dashboard-rebuild` | `dashboard_sample_data` (+ RLS) | — |
| **T10** | Retention rebuilt to the DPO-signed rules (purge stays OFF) | `feature/retention-dpo-rules` | maybe additive columns | T7 (rejection semantics) |
| **T11** | Bring rehearsal up to staging, verify everything there, draft the delivery email, write the final report | `chore/gt-rehearsal` (merge, no force) | hand-apply T7/T9/T10 | all |

Merge order: **T3 → T4 → T6 → T7 → T8 → T9 → T10**. T1 and T2 run first because they need no PR. T5 runs as soon as T4 is merged. After each merge, check that the staging preview deploy is Ready and smoke-test the change there (§6).

**Live-load interaction.** None of T3–T10 may change what the loader writes, except T2's DOB fold-in. **No tranche may touch `bursary_accounts.updated_at` on migrated accounts**: rollback's `assertUntouched` reads it. T10 is the only tranche that reads `bursary_accounts` close data, and it writes nothing while the purge flag is off.

---

## §5 · Work packages

### T0 · Set up

```bash
cd /Users/brian/Projects/MTG/john-whitgift-foundation/bursary-system
git fetch origin
git worktree add ../bursary-system-epic23 origin/staging --detach
cp ../bursary-system-epic21/.env ../bursary-system-epic21/.env.local ../bursary-system-epic21/.env.migration.rehearsal ../bursary-system-epic23/
cd ../bursary-system-epic23 && npm ci
rm -f tsconfig.tsbuildinfo && npx tsc --noEmit && npx vitest run   # record the test count as the baseline
```
- Check that `.env`/`.env.local` point at **nonprod** (the URL should not contain the prod ref or the dead ref `bzxoepyhmfvydoxfklft`).
- The node binary must be v22.12+. If `node -v` is older, run `export PATH="$HOME/.local/share/nvm/v22.12.0/bin:$PATH"`.
- Record the baseline in the final report.

### T1 · 2027/28 rolling-over deadline = 22 May 2027 (D-1)

1. On rehearsal, read the 2027/28 round, its RA `RoundWindow` and the 2027-28 SCHEDULED rows' `required_by` values (read-only SQL with the rehearsal URL; confirm the project ref first).
2. Sign in to the rehearsal app as admin. The credentials are in `../data/migration/STATE.md` / `RESUME.md`; if none are recorded there, use the `/add-admin` skill against rehearsal **only if** `.env.local` can be pointed at rehearsal safely, otherwise stop T1 and report. On Rounds → 2027/28 → windows, set the rolling-over **submit by = 22/05/2027** and save. This re-dates the still-SCHEDULED, non-year-1 rows through `rollingRedateWhere`. If `defaultSubmissionDeadlineRolling` is set on the round, set it to 22 May 2027 as well. **Leave the round in DRAFT**: opening it flips the dashboard, reports and queue defaults (Epic 21 plan :49).
3. Re-read and confirm all 208 rows read 22 May 2027 and nothing else changed (row count, statuses).
4. On prod, read-only: report whether a 2027/28 round exists, its status and its RA window. Change nothing.

**Done when:** rehearsal shows 22 May 2027 on the round and on all 208 rows, and the prod state is recorded for the final report.

### T2 · Toolkit: child DOB, blank list, rehearsal checks (D-2, D-3, D-4)

Read `RESUME.md`, `STATE.md` and the runbook (`chore/gt-migration-runbook`, `docs/migration/gt/`) first.

**Source data.**
- File: `../data/migration/extract/20260910/gt_forms.tsv` (columns `ftype eid grid row control rid val`).
- Keep rows where ftype = "Recurring Annual Bursary Assessment - V1", **grid is empty** and control = "Date of birth". The control also appears inside the "Dependent children information" and "Dependent elderly information" grids; exclude those.
- Link to accounts: form `eid` = `gt_progress.id`, and `gt_progress.grant` = the account's GT id (`build.py:125` shows the progress column order).
- The 50 new awards have no Recurring form, so they get no DOB.

**Build.**
1. A pure extractor + normaliser + consistency check, with unit tests in `scripts/gt-migration/__tests__/`. Cover: several date formats, the same date in different formats (consistent), two different dates (conflict), grid-scoped DOB rows ignored.
2. Fold it into the plan builder: `load/plan.ts` currently hard-codes `dob: null` at :76/:308, and `phases.ts:364` passes `childDob: null`. A fresh plan (`npm run mig -- plan`) must then carry DOBs. **Check the unique constraints** before writing: `Application @@unique([roundId, leadApplicantId, childName, childDob])` and `Contact @@unique([profileId, childName, childDob])`. Setting a DOB on twins with the same name is the only collision risk, and the extractor should flag it. The `phases.ts:307-312` duplicate check matches on name because DOB was NULL; keep that behaviour.
3. The patch command (D-3): it sets `child_dob` where NULL on that account's Contact, BursaryAccount, the migrated Application, and any Invitation for that child. It is ledgered, idempotent, has `--dry-run` and needs `--run`. **It must not bump `bursary_accounts.updated_at`** (raw SQL `UPDATE … SET child_dob = …` with no Prisma `@updatedAt`). If it can't avoid that, ledger the change so `assertUntouched` treats it as the toolkit's own.
4. Run a dry-run on rehearsal, then the real patch. Verify:
   - the count of non-null DOBs equals the consistent count;
   - zero changes to other columns;
   - the contact page no longer blocks "Invite this family to apply" for a patched account (browser check on one family code).
5. Write the blank-list CSV (D-4).
6. **Rehearsal checks (read-only):**
   - 271 ACTIVE; 208 with a 2027-28 SCHEDULED row; 63 without. Report the 63 by school and year group; they must be exactly the Y13 TS/WS and Y11 OP accounts.
   - **School-age children:** commit `7cd4c84` only fixed new loads. Count migrated `assessment_property.school_age_children_count = 0` on rehearsal. If any remain, add a ledgered patch that sets the category default (`defaultSchoolAgeChildren`, `plan.ts:28-30`) and run it. Brian already told her it shows the default on all 271.
7. Commit to `chore/gt-migration-toolkit` and push (fast-forward only). Update `STATE.md` with what ran, using family codes and counts only.

**Done when:** the DOBs are on rehearsal, the blank list exists, the 208/63 split is confirmed, school-age children ≠ 0 on every migrated assessment, the toolkit branch is pushed and `STATE.md` is updated.

### T3 · Remove the parent Documents page (decision 5)

- Remove the nav item: `buildPortalNav` in `src/components/portal/portal-nav.tsx`, item at :128-134, plus the comments at :6 and :72-73 and the unused `Upload` import.
- Delete `src/app/(portal)/documents/page.tsx`. Also delete `getAllDocumentsForApplication` (`src/lib/db/queries/applications.ts:1024`) and `src/components/portal/documents-list.tsx`, which only that page uses.
- Remove `documents` from `PORTAL_PREFIX` in `src/middleware.ts:42`. A parent hitting `/documents` should land on Home: add a redirect in `next.config` or a tiny route.
- Update the string literals in `rail-stepper-gate.test.ts:32` and `unsaved-changes.test.ts:153`, and the comments in `(portal)/layout.tsx:130,169` and `apply/layout.tsx:7`.
- **Do not touch `/respond`** (Missing Documents uploads) or the wizard upload slots. `/documents` had a paused card linking to `/respond`; check that the gold Missing Documents nav item still covers that case.
- **Tests:** the nav builder's output has no Documents item for every state (draft, submitted, paused, migrated).
- **Verify:** on the staging preview as a demo applicant, the nav shows no Documents and `/documents` redirects home.

### T4 · Exports framework, field picker, Section 3 (decisions 10, 12; D-5–D-12)

Today: `/exports` = `src/app/(admin)/exports/page.tsx` + `export-filter-form.tsx` + `export-button.tsx` → `src/app/api/exports/recommendations/route.ts`. That route checks auth/role, runs one `withUserContext` transaction, audits `RECOMMENDATION_EXPORT`, builds the file in memory, and runs the query `src/lib/db/queries/exports.ts` through the builder `src/lib/export/xlsx.ts` (ExcelJS, a static `COLUMNS` array that drives both XLSX and CSV). **Keep Export Recommendations working, unchanged** apart from one fix: its header "Bursary Award (%)" (`xlsx.ts:35`) holds £ before VAT on v2. Relabel it "Bursary Award (£, before VAT)".

**Framework.**
- `src/lib/export/sections/`: one module per section. Each exports:
  - `filters` schema (zod)
  - `columns: ColumnDef[]` (key, header = **her wording from EXPORTS.xlsx**, group, width, numFmt)
  - `buildRows(tx, filters, ctx)` returning plain objects
  - a pure `mapRow(raw, ctx)`, unit-tested
- Generalise `xlsx.ts` so `buildXlsxBuffer` / CSV take `(columns, rows)`; the recommendations export becomes one caller.
- Route: `src/app/api/exports/[section]/route.ts`, `section ∈ {workload, spend-billing, statistical}`. It uses the same auth pattern (401/403 JSON; ADMIN, ASSESSOR, VIEWER). It validates `fields=` against the registry (unknown key → 400; empty → 400). It audits a new action per section (`EXPORT_WORKLOAD`, `EXPORT_SPEND_BILLING`, `EXPORT_STATISTICAL`) with filters, format, column count and row count. Raise `withUserContext`'s 10 s timeout for these, or chunk the work.
- `/exports` page: the three sections as cards or tabs, **each with its search form and field picker**, above the existing Export Recommendations card. Use the existing shadcn/ui components (Card, Checkbox, Select, Input, Button) and match the page's style. The download stays a plain navigation, as `export-button.tsx` does today.
- Shared helpers in a pure module, `src/lib/export/fields/`: lead/child names (`resolveChildNameParts`), current school year (`currentSchoolYear`, `src/lib/portal/current-school-year.ts:27`), award fund label, the migrated-blank rule (D-9), sibling flattening (D-15), the postcode outward code + area (`formatPostcodeAreaLabel`), money as numbers (never strings) with `numFmt`.

**Section 3: statistical.**
- **Filters:** bursary account (Active / Closed / No account yet), assessment status, application type (rolling-over / new), round, assessment completion date (from–to), academic year, school, school year.
- **Columns, in her order:**
  1. Application type, round, assessment completion date, academic year, school, school year
  2. Bursary award year of entry (`Assessment.entrySchoolYear`), bursary recipient's scholarship (`scholarshipPct`)
  3. Family category, remaining years at the school (`schoolingYearsRemaining`)
  4. Number of schooling-age children and number of parents (both D-9)
  5. Postcode (first part)
  6. The four categories: income `incomeCategory`, property `propertyCategoryDerived`, property equity `propertyEquityCategory`, financial equity `financialEquityLabel`
  7. Debt over NDI ratio, debt status `debtStatusLabel`
  8. Lifestyle squeeze ratio and status
  9. Sibling school and payable fees (D-15)
  10. Fees for next year before VAT (`resolveNextYearFees`), scholarship %, scholarship spend before VAT, bursary award / spend before VAT, net fees before VAT, yearly payable incl VAT, monthly payable incl VAT
  11. Reason codes year-on-year (`RecommendationReasonCode` → "code – label", joined)
  12. Bursary award type (D-5)
- **No names, emails, references or child names in this section's registry at all.**
- Rows = assessments matching the filters (one per assessment).

**Tests:**
- Every `mapRow`, with v1 / v2 / migrated / in-system fixtures.
- The registry: keys are unique, headers match her sheet, and Section 3 contains no identifying key (assert it).
- `fields=` validation.
- The generalised XLSX/CSV builder: column subset, order preserved, CSV quoting.

**Verify:**
- On the staging preview as `brian.admin@jwf-bursary.test`: download Section 3 in XLSX and CSV with all fields, then with five fields. Open both files (read them with a script) and check the headers and the row count against a SQL count.
- Export Recommendations still downloads identically, except for the relabelled header.

### T5 · The pre-live spreadsheet (decision 2)

- **Precondition:** T4 merged.
- In the main checkout, add a toolkit command (e.g. `mig export-statistical --env rehearsal`) that runs **T4's Section 3 `buildRows` + builder with every column** against rehearsal, for all 271 migrated accounts' 2026-27 assessments.
- **Password protection:**
  - ExcelJS can't encrypt. Look in `../data/migration/` (`STATE.md`, `scratch/`) for how the earlier 271 report was protected and reuse that method. Otherwise use `msoffcrypto-tool` in a Python venv in the session scratchpad (`python -I`).
  - Generate a strong password. Write it **only** to `../data/migration/` next to the file (a `.password.txt`), never into git, a PR or an email draft.
- **Output:** `../data/migration/exports/<date>-statistical-271.xlsx` (never committed).
- Report the debt-status counts (her 15 Oct question: how many households read "IN A DEBT SPIRAL, AT RISK OF BANKRUPTCY"). Expect about 111, 56 of them with no declared debt.
- **Done when:** the file and password exist and the counts are in the final report.

**Brian sends the file and the password separately.** You only put "spreadsheet ready" in the delivery draft.

### T6 · Exports Section 1: assessment workload (decision 13; D-13, D-14)

- **Filters:** bursary account (Active / Closed / No account yet), to be submitted by (date range), submission date (range), submission status (Not yet started / Started / Submitted), % completion less than x (0–100), application type, plus round (required; default = the current open round via `getActiveRound`).
- **Columns, her order:**
  1. Bursary status (`BursaryAccount.status`)
  2. To be submitted by (`effectiveSubmissionDeadline(app, round)`, `src/lib/rounds/submission-deadline.ts:158`, with `DEADLINE_ROUND_SELECT`)
  3. Application submission date (`submittedAt`)
  4. Submission status (D-13)
  5. % completion (D-14)
  6. Application type, bursary reference
  7. Lead applicant first name and surname, email, mobile (`Profile.phone`, falling back to `Contact.phone`)
  8. Bursary recipient's name (child), school, school year
  9. Round, assessment status, bursary account
  10. Assessment completion date
- **Performance:** completion is computed only for unsubmitted applications (a submitted form is 100%). Chunk the work, and log the timing in the PR body for ~300 rows on rehearsal (T11).
- **Tests:** the status mapping, the completion filter (strictly less than), invitation-only rows, and deadline resolution incl. a per-invitation Submit-by.
- **Verify:** staging preview with the demo applicants (draft, in progress and submitted). The % for a draft must equal what that applicant sees on My Bursary Application(s).

### T7 · Rejected forms come back with answers and documents (decision 4; D-16, D-17)

**Today:**
- `rejectAndRestartApplication` (`src/app/(admin)/applications/[id]/actions.ts:357`) runs `restartApplicationFromRejection` (`src/lib/applications/create-from-invitation.ts:192`). That **deletes** the application (cascading sections, documents, assessment and recommendation), creates a blank one, writes an `application_rejections` row (`src/lib/applications/rejection-record.ts:70`), resets the schedule row, audits `APPLICATION_REJECTED_RESTART`, deletes storage objects after commit, and emails `APPLICATION_RESTART_REQUIRED`.
- `submissionDeadlineAt` and `childFirstName`/`childLastName` are not copied, so the deadline falls back to the round default.
- A dormant `reopenForMaterialChange` (AA:555 → `status.ts:738`) has no UI, email or tests.

**Build:**
1. **Reject = return.** Rewrite the core as one transaction under `withAdminContext`, keeping the allowed phases SUBMITTED / NOT_STARTED / PAUSED and ADMIN/ASSESSOR:
   - `formStatus` → IN_PROGRESS.
   - `submittedAt` → NULL. The rejection row keeps the old one, the next submission records its own date, and the schedule shows Submitted → Rejected → Submitted. **Check `submission.ts:196-209`**: it reuses the original `submittedAt` on resubmit for a material-change reopen. A returned form must get a fresh date, so key that branch off a marker (e.g. the latest `application_rejections` row for the application with no later submission) rather than off `submittedAt`.
   - A live assessment is reset as `discardAssessment` does (status.ts:671). Read what that deletes first, and keep the same data the material-change reopen keeps.
   - Sections and documents are **kept**, and their `isComplete` flags are unchanged.
   - The `application_rejections` row records the old `submittedAt`, the rejection date, and `replacementApplicationId = the same application id`.
   - The schedule row resets to SCHEDULED, `receivedOn` NULL, `applicationId` unchanged (adapt `recordRejection`'s guard).
   - **New required field in the reject dialog (`src/components/admin/reject-restart-dialog.tsx`): "New submit-by date".** It is pre-filled with the later of the current effective deadline and today + 7 days, and written to `Application.submissionDeadlineAt`. Validate it as a date in the future.
   - The custom message to the family is kept as today.
   - Audit `APPLICATION_REJECTED_RESTART` (same key, so the History tab keeps working), with metadata `{ mode: "returned", newSubmitBy, rejectionRecordId, customMessage }`.
   - **No storage deletes, and no `application.delete` call.**
   - Rename the user-facing button text to "Return for correction" only if the button currently says "Reject and restart". Keep the internal name.
2. **Email (D-17).** Add a migration updating `APPLICATION_RESTART_REQUIRED`'s subject/body only where they equal the seed. Merge fields: the existing ones plus the deadline. Check the template merge-field registry; `{{deadline}}` may already exist for invitations, so reuse it. The `restart_link` should land on the first incomplete section, i.e. the "keep working" target from Epic 22 P1, not `/apply/child-details`.
3. **Parent banner.** While the latest rejection for the application has no later submission, the portal (My Bursary Application(s) block, wizard header, review page) shows: "This application was returned to you for correction on {date}. Please correct the sections without a green tick and resubmit by {deadline}." Then the custom message. It is a pure seam deciding when it shows.
4. **Staff can make the gaps show.**
   - **Documents:** the admin document delete (`DELETE /api/admin/documents/[id]`, used by the edit-on-behalf chrome) already works with no phase check. Verify on a returned application that the parent then sees that slot as missing, with no green tick.
   - **Answers:** on-behalf saves (`saveSectionOnBehalf`, `src/app/(admin)/applications/[id]/edit/actions.ts:64`) run the full portal Zod schema and force `isComplete = true`, so staff can't blank a figure. **For a returned application only**, change the on-behalf save to the **parent's own draft-save semantics**: the same partial validation and the same `isComplete` computation the portal wizard uses when a parent saves an unfinished section. Find that path in `src/app/(portal)/apply/actions.ts` and reuse it; don't fork the logic. Then a figure staff clear leaves the section incomplete, and the parent sees exactly what to redo.
   - Also add a per-section **"Needs correction"** action on the on-behalf page (sets `isComplete = false` without editing data), for when the issue is a judgement rather than a blank field.
   - Pure seam: `isReturnedForCorrection(app, latestRejection)`.
5. **Deadline gate.** Resubmission runs `submitApplicationCore`'s deadline check (`submission.ts:220`) and the section-page redirect (`apply/[section]/page.tsx:122`). With the new `submissionDeadlineAt` both pass. Add a test that a returned application past its **original** deadline but before the **new** one can be edited and resubmitted.
6. **Parent schedule (Epic 22 P5).** `src/lib/portal/parent-schedule.ts` builds Submitted → Rejected → new attempt from `application_rejections`. Check it handles `replacementApplicationId === applicationId` and a NULL `submittedAt` while the form is being corrected (it should read "In progress", then "Submitted" with the new date). Add tests.
7. **Retention interplay:** none. Nothing is purged on return any more. Note this in the PR.

**Tests:** the return core (state before and after, as a pure planner where possible), the banner seam, the draft-save semantics on behalf, the deadline override, the schedule rows, and the email's seed-only update (SQL `WHERE` matches the seed text exactly; assert it in a test that reads the seed module).

**Verify on the staging preview:**
1. As a demo applicant, submit.
2. As admin, Return for correction with a new date and a message.
3. Back as the applicant: the answers and documents are there, the banner shows, and the deadline is the new one.
4. As admin, delete one document and clear one figure on behalf. As the applicant, both sections show as incomplete.
5. Resubmit. The schedule shows Submitted → Rejected → Submitted (new date). The email lands in `EmailLog` (staging) with the new wording.

### T8 · Exports Section 2: spend and billing (decision 11; D-11, D-15)

- **Filters:** as Section 3.
- **Columns, in her order:**
  1. Bursary account, assessment status, application type, round, assessment completion date, academic year, school, school year
  2. **Every Part 1 field** of `src/components/admin/assessment-form-v2.tsx:1078-1312`:
     - first name and surname
     - recipient's school (`assessmentSchool`), bursary award year of entry, scholarship %
     - siblings 1–3 name / school / net payable fees
     - family category (+ its description from `FamilyCategoryMeta`), remaining years, number of schooling-age children (D-9), postcode (first part)
     - annual fees
     - re-read the component and include any Part 1 field missing from this list
  3. **Part 2:** total parent 1, total parent 2 (`calculateEarnerIncome` per PARENT_1/PARENT_2 earner), total benefits, total self-employed income, total PAYE income (D-11)
  4. **Part 3:**
     - total savings (`isasPepsShares`), total cash held (`cashSavings`)
     - add back notional rent applied (`rentAddBack`, D-11)
     - net disposable income after notional spend (`ndiAfterNotionalSpend`), household income category
  5. **Parts 4–5:**
     - the family home, second property and other properties: market value and mortgage balance each (`propertyAssets` JSON)
     - property category, property equity category, financial equity category
     - derived yearly debt repayments, total debt (`totalPersonalDebt`; her note says 5 × the yearly figure, so assert they agree in a test)
     - debt over NDI ratio, debt status
     - behind with school fees (`behindOnFees`)
     - lifestyle squeeze ratio and status
     - siblings' name / school / payable fees
  6. **Award block:**
     - household net income, actual remaining DI, theoretical benchmark DI, affordability-adjusted DI
     - fees for next year before VAT, scholarship award %, scholarship spend before VAT, bursary award / spend before VAT, net fees before VAT, yearly payable incl VAT, monthly payable incl VAT
     - gap (confirmed − recommended, `Recommendation.gapAmount`)
     - scholarship-adjusted gap (`scholarshipAdjustedGap`, `src/lib/reason-codes/gap-metrics.ts:37`)
     - gap reason code(s) (main first, via `mainGapReason`)
     - reason codes year-on-year
     - bursary award type (D-5)
- Group the picker by part (Identity · Part 1 · Part 2 · Part 3 · Parts 4–5 · Award), so she can untick a whole part.
- **Tests:**
  - `mapRow` with a fully populated v2 fixture: every column non-null where expected, and money as numbers
  - v1 blanks
  - migrated blanks (D-9)
  - the Part 2 total helpers, against a hand-computed earner
  - `rentAddBack` equals the assessment page's figure for the same fixture (run the orchestrator once in the test)
- **Verify:** on staging, export one completed demo assessment with all fields and compare 10 spot values against its assessment page in the browser.

### T9 · Dashboard rebuilt to her 6 Sep layout (decision 15; D-18, D-19)

- **Source:** Dashboard.xlsx, attached to msg `1a0780d1f41e55e9`. Download it with `mcp__workspace-mcp-mtg__get_gmail_attachment_content` (`attachment_index: 1`) into the session scratchpad, read it with a script and **never commit it**.
- **Her instructions:** "remove all the items on the current dashboard and replace the whole page with this suggestion", "feel free to change … colouring/overall display … while keeping the infrastructure", and "for the sections which refer to future data … a tab where we could store some 'fictive data'".
- **Her 6 Sep answers:**
  1. ex-OP pupils go through the normal rolling-over process.
  2. Award types: Whitgift JWF / WSP-JWF / WFA; Trinity JWF / TBF. The fund can change year to year.
  3. Only the spend tables split by fund cohort; workload stays OP / TS / WS.

**Today:** `/admin` = `src/app/(admin)/admin/page.tsx`. It has 3 stat tiles + a RoundTile, a Status Distribution, and an activity feed, all from `src/lib/db/queries/reports.ts` (`getActiveRound` :124, `getDashboardCounts` :159, `getDashboardFeed` :249). **Remove all of it from the page.** Keep the query functions if `/reports` or tests use them; delete them if not. Fix the stale header comment.

**The new page:**
- Title: **BURSARY ACTIVITY DASHBOARD**.
- Three bands, with her labels kept verbatim, a pure query per panel (`src/lib/db/queries/dashboard/*.ts`) and a pure shaping function per panel, unit-tested.
- "Current round" = `getActiveRound`. "Next round" = the round for the following academic year, in any status, DRAFT included.

**Band 1: Applications & assessments management.**
- **Current open round:** this academic year; the tax year assessed (the year before: 2026/2027 → 2025/2026); number of new application invitations sent; number of new applications received.
- **Bursary applications, current round:** for each of TS and WS (and OP where it has any), new application invitations sent, new applications received, rolling-over applications due, total.
- **Bursary assessments, current round:** for each school, waiting to be started, paused, completed.

**Band 2: Assessment outcomes, new and internal bursary applications.**
- Number of assessments with a new bursary award this round (per school).
- New bursary awarded spends for the current academic year (internal bursaries): total spend before VAT + number of awards, per school.
- Number of assessments closed with no bursary awarded this round (per school).
- New bursary awarded spends for next year (new applications): total spend before VAT + number of awards, per school.
- **Top 5 closed-application reasons** (close reasons with their share): illustrative until real closes exist.

**Band 3: Assessment outcomes, rolling-over bursary applications.**
- **Next round details:** future round academic year, future tax year, submission by (the next round's RA submit-by, **22 May 2027** on rehearsal after T1).
- **Number of scheduled rolling-over assessments by cohort** (D-19: ex-OP · TS · TS-TBF · WS · WS-WFA · WS-Pastoral Boarders · total). On rehearsal, the total should equal the 208 of §0; assert it in T11.
- **Assessment progress snapshot:** for the next round, with its dates (to be done by: invitations sent by, submission by, assessments done by):
  - rolling-over applications sent, assessments received, waiting to be started, paused, accounts closed, completed with award
  - each as a count and a % of the scheduled total
- **Rolling-over new committed spend** (completed assessments): ex-OP, TS and WS totals. Fund cohorts per D-19 if the layout splits them.
- **Top 10 year-to-year change reasons in completed assessments** (`RecommendationReasonCode`, count of recurrences): illustrative until real data exists.

**Illustrative data (D-18).**
- Migration: `dashboard_sample_data` + RLS policies in the same migration.
- A settings tab, **Settings → Dashboard sample data**. It is ADMIN only and holds one JSON-backed form per illustrative panel (the two Top-N panels, plus any panel she drew with figures that can't exist yet).
- Seed it from her mock-up's figures: the two Top-N lists and their numbers. These are code-and-label pairs with no personal data, so they can go in a migration INSERT. Make the migration INSERT `ON CONFLICT DO NOTHING`.
- Any panel showing sample data carries a visible **"Illustrative data"** badge. The pure seam `chooseRealOrSample(realCount, sample)` switches to real data as soon as `realCount > 0`.

**Display.**
- Use the app's design system (navy #0D1B2A / gold #B8862A, Inter + Playfair, the existing Card and StatTile components). Tables over charts for panels that are tables in her sheet. Load the `dataviz` skill before drawing any chart.
- Responsive: three columns on desktop, stacked on tablet.
- Each count links to the filtered `/queue` or Applications list where such a filter exists, as today's tiles do.

**Tests:** every shaping function (per-school splits, cohort mapping incl. MANUAL_PB and awardFundType, the tax-year label, % of total, real-vs-sample switching) and the RLS migration (policies present; `prisma format`).

**Verify:**
- Staging preview as admin: the page renders with demo data, the illustrative badges show, and editing a sample value in Settings changes the dashboard.
- Rehearsal (T11): the cohort total is 208 and the submission date is 22 May 2027.

### T10 · Retention rebuilt to the DPO-signed rules (decision 16; D-20)

**The signed rules** (DPO, 16 Oct 2026; Charlotte's clarifications 7 Oct; memory `project_retention_rules_oct_2026`):
1. **Bursary account closed:**
   - 1 year after the account's closing date: the **form + documents** are purged (sections, documents, storage objects).
   - 6 years after the closing date: the **named assessment data** is purged.
2. **Unsuccessful application** (waiting list, not offered, offer declined), closed manually by staff whenever they choose (**no fixed timer**):
   - at close: form + documents purged;
   - the assessment is **kept named** for 6 years from the close, then purged.
3. **Parent erasure request at the new-application stage:**
   - the application is deleted at once and the name/reference anonymised (shown as "XXXX");
   - the assessment is kept **anonymous** for 6 years, then purged.
- There are no 30-day timers. The anchor is always the **closing date**, never `submittedAt` or a financial-year end.

**Today** (`src/lib/retention/policy.ts:76-85`, cron `src/app/api/cron/purge-expired/route.ts`, weekly, dry-run unless `RETENTION_PURGE_ENABLED === "true"`):
- **Tiers:** declined 30 days; qualifies-not-awarded 6 years from `submittedAt`; awarded 7 years from `account.closedAt`; closed with no outcome 30 days. Tiers are chosen from `assessment.outcome`.
- **Purges:** `purgeApplication` (`src/lib/retention/purge.ts:101`, the whole-parent GDPR cascade) and `purgeClosedApplication` (`src/lib/retention/close-purge.ts:162`, which anonymises the assessment at once). The scrub map is `scrub-map.ts`.

**Traps to fix:**
- Epic 18 NEW_AWARD/ROLLED_OVER never write `outcome`. So a closed award falls into the 30-day closed tier and would be **fully erased in 30 days** (with the parent's other children's contacts and accounts) if the flag were on.
- The cron takes 100 rows by `submittedAt` and then filters them in memory, so due rows beyond the first 100 are never reached. Close-purged rows come back as candidates every week.
- `application_rejections.childName`/`reference` and the `reference` itself are never scrubbed.
- `BursaryAccount.closedAt` is cleared by reopen, re-award and "Add a year". Treat that as "not closed any more": correct, but a purge must re-check it inside its transaction.

**Build:**
1. **`policy.ts`, rewritten as a pure planner:** `planRetention(record, now) → { stage: "keep" | "purge-form-docs" | "purge-assessment" | "anonymise-now", dueAt, rule }` for rules 1–3, anchored per D-20. Delete the 30-day tiers and their env overrides. Keep the `RETENTION_*` names only if still used.
2. **Per-application purge primitives.** Never reuse the whole-parent GDPR cascade for retention.
   - `purgeFormAndDocuments(appId)`: sections, documents, storage, `application_rejections` free text. Keep the assessment and the application shell.
   - `purgeAssessment(appId)`: assessment + recommendation + children. Anonymise what's left of the application (child name, DOB, reference → "XXXX").
   - Erase the parent profile only when no other live record references it (reuse `close-purge.ts`'s check).
   - Each is idempotent, audited (new keys in `AUDIT_ACTIONS`) and re-checks its anchor inside its transaction.
3. **Rule 2:** change the staff-close path so it purges the form + documents **at close** but keeps the assessment named; it is purged later by the 6-year stage. Today `purgeOnClose` reasons are all `false`, so add the purge at close for the unsuccessful close reasons (waiting list / not offered / offer declined; identify them in `prisma/seed-data/close-reasons.ts`). **This deletes data on nonprod at the moment a staff member closes, so it must sit behind `RETENTION_PURGE_ENABLED` as well.** With the flag off, log what would have been purged instead.
4. **Rule 3:** add an **"Erasure request"** admin action for an application at the new-application stage (ADMIN only, 2-step DELETE confirmation like the GDPR dialog). It runs `purgeFormAndDocuments` + anonymise now and keeps the assessment anonymous with a 6-year due date. Behind the flag; with the flag off it is refused with "Retention purging is not enabled on this environment".
5. **Cron:** select candidates **by due date in SQL**, not "100 by `submittedAt`". Page through them, skip anything already purged at that stage (store the stage reached, e.g. `Application.retentionStage` + `retentionStageAt`, an additive column), and keep the dry-run summary (counts per stage + the next 10 due).
6. **Admin visibility:** a read-only "Retention" panel (Settings or Audit) listing upcoming purges by stage and due date, by reference. Charlotte must be able to answer a SAR question ("when will this be deleted?").
7. **`RETENTION_PURGE_ENABLED` stays unset everywhere.** Turning it on is Brian's decision after he has reviewed the dry-run report on rehearsal; say so in the PR and the final report.

**Tests:** the planner for every rule and edge:
- a reopened account (`closedAt` cleared → keep)
- an award closed via `closeApplicationCore` (rule 1, not 30 days)
- an unsuccessful close (rule 2)
- an erasure request (rule 3)
- a sibling still live (profile kept)
- an already-purged stage (skipped)

Also: cron candidate selection paging, and every primitive's idempotence (pure planners plus a thin executor).

**Verify:**
- Staging preview: the panel lists sensible due dates for demo data. Running the cron route in dry-run returns the summary and changes no rows (compare row counts before and after).
- The PR body states the prod blast radius: with the flag off, nothing; with it on, list what the current prod rows would do.

### T11 · Migration staging, verification, delivery draft, final report

1. **Bring `chore/gt-rehearsal` up to `origin/staging`.**
   - Check out `chore/gt-rehearsal` in the epic23 worktree: `git switch chore/gt-rehearsal && git pull --ff-only`.
   - Then `git merge origin/staging` (a merge commit; **no reset, no force-push**) and `git push`.
2. **Apply the new migrations to rehearsal by hand:** `DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy`, with the URLs from `.env.migration.rehearsal`. **Confirm the ref `ldqpzjizqvrairoojker` in both URLs first.** `npx prisma migrate status` must show nothing pending afterwards.
3. Wait for the Vercel `rehearsal` deployment to be Ready on the merge commit. Check `meta.githubCommitSha` through the Vercel MCP (`list_deployments` / `get_deployment`).
4. **Browser checks on rehearsal** (Playwright MCP):
   - **As admin:**
     - the dashboard: cohort total 208, submission by 22 May 2027, illustrative badges
     - the three exports: Section 1 timing for the 2026/27 round logged; Section 3 headers and count; Section 2 spot-check on one migrated assessment, with the children/parents counts blank
     - a patched DOB on a contact
     - the reject dialog shows the new-date field (**don't reject a migrated application**: migrated applications can't be edited, so check the dialog only)
   - **As the TS-NOWS01 family:** no Documents tab; Home, My Bursary Application(s) and Schedule unchanged.
   - Use family codes only in notes and screenshots. Store screenshots in the session scratchpad, never in git.
5. **Draft the delivery email** in Gmail as a **reply in thread `1a14190d5c2b914a`** ("Phases 4 and 5 - testing feedback"). It is a draft only; Brian sends it. British English, plain, no names (family codes only), no timeline words. Contents:
   - What's on migration staging now, per item in §1, each with what to try and the family code to try it on.
   - The defaults taken from §2 that she would notice: D-1, D-5, D-8, D-9, D-13, D-16/17 (with the new email wording quoted), D-18, D-19 and the retention summary.
   - The DOB blank list attached (D-4).
   - "The pre-live spreadsheet is ready; Brian will send it with its password separately."
   - That retention purging stays off until Brian enables it.
6. **Final report to Brian** (the last message of the run):
   - PRs with numbers and merge commits; migrations and where each was applied
   - toolkit commands run, with counts
   - the T1 prod state, the T5 counts, the T6 timing
   - the baseline vs the final test count
   - anything skipped or blocked, and why
   - env vars needed (none expected)
   - **what Brian must do:** send the draft, send the spreadsheet + password, review the retention dry-run, decide on the flag, and promote when ready
   - Update the auto-memory: the Epic 23 status in a project memory file + its `MEMORY.md` line.

---

## §6 · Validation path for every PR tranche

1. **Local:** the three CI gates (§3) pass, and new tests exist for every new pure seam.
2. **PR → staging.** The body has:
   - what and why (cite the §1 decision)
   - the §2 defaults used
   - files touched
   - the migration, if any, and its RLS
   - the **prod blast radius** (today: 2 accounts; and after the GT live load: 271)
   - test evidence
3. **CI green**, then merge per §9. After the merge, `db-push.yml` applies the migration to nonprod. Check the run succeeded: `gh run list --workflow db-push.yml --limit 1`.
4. **Staging preview smoke test** as `brian.admin@jwf-bursary.test` (and a demo applicant for parent-facing tranches), per the tranche's Verify list.
5. Rehearsal is brought up **once**, in T11. The exception is T5, which only reads rehearsal.
6. **One delivery email** for the whole sprint (T11), as a draft.
7. **Promotion `staging → main`: never** in this run.

---

## §7 · Stop conditions: stop and report instead of improvising

- Any write that would touch **prod**, or any need to run the toolkit with `--env prod`.
- The rehearsal project ref doesn't match, or `.env*` points at the dead project.
- A migration that would drop, rename or rewrite existing data beyond a bounded, idempotent UPDATE. Or a needed enum widening.
- T2: a twin-name unique collision, or a DOB patch that changes more rows than the consistent count.
- T7: `discardAssessment` turns out to delete something the material-change path also deletes and that Charlotte would expect kept (assessor notes, the synopsis). Report it and build the safest variant: reset the status only.
- T10: anything that would delete data with the flag **off**.
- CI fails twice for a reason that isn't in your diff.
- `gh pr merge` approval is refused and every remaining tranche depends on the refused PR.

On a stop, finish the current tranche's PR as a **draft PR** if it has value, record the state in the final report, and end the run.

---

## §8 · Out of scope (do not build)

- Export access control by role or job, password-protecting exports in the app, and the "external sharing" handling of Section 3 (Brian, 16 Oct: later).
- The GT live load into prod, the staging→main promotion, raising the prod Storage limit, and purging migration staging after go-live. All are Brian's.
- The domain `bursaries.johnwhitgiftfoundation.org` (Brian and Alex).
- Closing the 63 leavers (they're live until they leave).
- Turning on `RETENTION_PURGE_ENABLED`.
- Changes to `/reports`. She may trim it once the dashboard exists; wait for her.
- Loading a further year of GT assessments (mentioned 16 Oct as an option, not requested).
- Pastoral blank-assessment accounts, the CARE system, and anything she raises while testing. Log new items in the final report; don't build them.

---

## §9 · Dispatch

Brian dispatches a fresh Claude Code session in the main checkout with:

> Read `docs/backlog/epic-23-go-live/epic-23-sprint-plan.md` (on `origin/staging`; if not merged yet, on branch `docs/epic-23-sprint-plan`). Execute it end to end, autonomously, in the order in §4, following §3, §6 and §7 exactly. Standing authority for this run: create branches and worktrees, push feature branches, open PRs to `staging`, and squash-merge your own PRs to `staging` once CI is green and the tranche's verification passes. Run the toolkit patch commands and hand-apply migrations on migration staging (`ldqpzjizqvrairoojker`). Merge `origin/staging` into `chore/gt-rehearsal` and push it (no force). Create Gmail drafts (never send). Not authorised: any prod write, any staging→main PR, force-pushes, env-var/domain changes, enabling retention purging, sending email. Finish with the T11 final report.

The quoted grant is the whole of the run's authority. Anything it doesn't name falls under the repo `CLAUDE.md` and §7.
