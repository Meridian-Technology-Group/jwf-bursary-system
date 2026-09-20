# 05 — Milestones (the runbook)

Each milestone has the same shape: **Goal · Entry gate · Steps · Automatic checks ·
Outputs · Exit gate · If it goes wrong**. A gate is "passed" only when recorded in
`STATE.json`. Steps marked **[H-Brian]**, **[H-Charlotte]**, **[H-Alex]** need a
human; everything else the executor does itself.

Until M3 delivers the CLI, M0 and M2 steps are run with ad-hoc scripts kept in
`../data/migration/scratch/`; the M3 build absorbs them.

---

## M0 — Preflight

**Goal.** Prove the ground is solid before anything is built on it.
**Entry gate.** None.

**Steps**
1. Create `../data/migration/` with the layout in `00-README.md`. Write the initial `STATE.json` (`milestone: "M0"`) and the first `STATE.md` entry.
2. Copy the three inputs into `inputs/` with sha256 and received date: the 273 sheet (export the Drive sheet `1G0Cto2…` as csv **and** xlsx), the trusted-fields workbook (the original xlsx from her 19 Sep email, not the Sheets conversion: the screenshots matter), the reason/gap codes workbook. Record hashes in `STATE.json.snapshots`.
3. GT database: `docker ps` shows `jwf-mssql` up; `SELECT COUNT(*)` on the grants view returns the known count. If the container crashes with "Invalid mapping of address": Rosetta is missing; `softwareupdate --install-rosetta`, then `colima restart`.
4. Create `.env.migration.nonprod` and `.env.migration.prod` (values from the existing `.env.local` / Vercel prod env; `DIRECT_URL` must be the **session pooler, port 5432**). Confirm both project refs by connecting and reading `current_database()` + the Supabase URL. Confirm neither is the dead project.
5. Baseline counts from **both** environments, saved to `runs/baseline-<env>.json`: rows in `profiles` (by role), `contacts`, `applications`, `assessments`, `recommendations`, `bursary_accounts`, `bursary_schedule_entries`, `sibling_links`, `documents`, `invitations`, `email_log`, `audit_logs`; `auth.users` count; storage object count in bucket `documents`. (Prod on 19 Sep: 1 round "2026/27" OPEN; 6 contacts, 6 applications, 1 bursary account, 6 applicant profiles, 1 admin.)
6. Overlap check: lower-cased lead emails from the sheet ∩ `profiles.email` ∩ `contacts.email` ∩ `auth.users.email`, in both envs. Any hit → flag `EXISTING_IDENTITY` on those accounts (expected: none in prod).
7. Round check: exactly one round whose academic year is 2026/27; record its `id`, the **exact string format** of `academic_year` (prod uses `"2026/27"`), `open_date`, `close_date`. Never hard-code the format.
8. Reference-data diff nonprod ↔ prod: `school_fees`, all band tables, `notional_cost_configs`, `family_type_configs`, `council_tax_defaults`, `reason_codes`, `gap_reasons`. Differences are recorded; those in calc-relevant tables must be resolved before M4 results are trusted.
9. **[H-Brian]** Confirm B1 (real data on nonprod), B3 (assessor / system profile), and that prod has a recent backup or PITR window (Supabase dashboard → Database → Backups). Record the backup timestamp.
10. ~~Send the drafted reply to Charlotte~~ Done 19 Sep; she answered the same evening (S19, S20).

**Automatic checks.** `mig preflight --env nonprod` and `--env prod` both green (before M3: the same checks by hand, results pasted into `STATE.md`).
**Outputs.** State folder; baselines; env files; reference-data diff.
**Exit gate `M0.exit`.** All checks green + step 9 recorded.
**If it goes wrong.** Nothing has been written anywhere. Fix and re-run.

---

## M1 — System changes ship

**Goal.** The production system can hold an Old Palace account, a PB award and a migrated placeholder, and does not misreport them.
**Entry gate.** `M0.exit`. Runs in parallel with M2 and M3.

**Steps.** One branch and PR per group in `02-target-model.md` Part 2, in order A → B → C → D → E → R, each off a fresh `staging`:
1. `git checkout staging && git pull && git checkout -b <feature|fix|chore>/<name>`.
2. Implement; add tests named in the group; `npm test`; clean `tsc`; `npm run check:migrations`; `npm run check:rls`.
3. Author migrations with `prisma migrate diff --script` (never `migrate dev` against a shared DB). Additive only. Policies for the ledger table in the same migration.
4. Push, `gh pr create --base staging`. **[H-Brian]** reviews and merges. `db-push.yml` applies the migration to nonprod on merge.
5. After PR-C merges: on staging, open one existing Trinity and one Whitgift assessment and confirm fees, VAT and years-remaining are unchanged (regression), then create a throwaway OP contact through the staff contact form and confirm it saves.
6. After PR-D merges: insert one synthetic migrated application on nonprod by hand (ledgered under run id `m1-smoke`), check the Applicant Data card, the disabled APPLICATION FORM tab, the documents tab, and that the portal ignores it; then remove it with the rollback routine's SQL. This is the first exercise of rollback.
7. **[H-Brian]** Promote `staging → main` when A–E are merged and M6 is approaching (R may follow). The executor opens the promotion PR **only** when Brian says "promote staging to main".

**Automatic checks.** CI green on every PR; `check:rls` green; enum values present in nonprod (`SELECT unnest(enum_range(NULL::"School"))`).
**Exit gates.** `M1.staging` (A–E merged, nonprod migrated) unblocks M4. `M1.main` (promoted, prod migrated, Vercel prod deployment on that commit) unblocks M7.
**If it goes wrong.** A bad PR is reverted by a new PR. Enum values cannot be dropped from Postgres; an unused value is harmless. Never edit an applied migration.

---

## M2 — Extract, canonical build, questions to Charlotte  ← **the 2 Oct critical path**

**Goal.** Every question that needs GT's screens is in Charlotte's hands by **Mon 21 Sep**, as one pack, not a drip of emails.
**Entry gate.** `M0.exit`.

**Steps**
1. **Extract.** One SQL file per dataset, explicit columns, written to `extract/20260910/*.jsonl` with row counts: grants (id, ref, status, round, org, lead, email, dates); progress reports; dynamic field values for grants + reports; form data for the two assessment forms (control name, grid, row, value); contacts for each grant's primary contact (title, names, phones, address); grant documents (id, grant/report id, type, filename, size, created). Re-use the queries behind `../data/migration-assessment/scripts/` (they read TSV exports that lived in a session scratchpad: re-export).
2. **Match** the 273 rows to GT. Expect: 271 match (one via the non-standard reference map, one with two GT grants → take `Active`), 2 PB do not match by design. Anything else → `NO_GT_MATCH`.
3. **Latest assessment per account**: candidates = the grant (if assessed) + its progress reports (if assessed); order by (`SchoolYear`, completion date); take the last. Expect 2026/27 for all but a handful → `NO_2026_REVIEW`.
4. **Pin her notes to controls.** Unzip the trusted-fields xlsx; read every image in `xl/media/` alongside the note cells' positions (`xl/drawings/*.xml` anchors give each image's row range). For each note record: tab, note text, the GT control(s) it refers to, confidence. Update the "proposed" rows of `03-field-mapping.md`. Low-confidence pins become questions.
5. **Build** `canonical/<hash>/accounts.json` and `flags.json` (before M3: a script in scratch; after: `mig build`). Include R1–R3 and R6.
6. **Re-derive the exceptions against the 273 list.** The 16 exceptions from 17 Sep were computed on the 269 list; WBS is gone (S7), four accounts are new, two references are in the old `24/25_…` form. Produce the definitive list by flag.
7. **Build the M2 pack** (`packs/<date>/`), one xlsx, tabs:
   - *Read me*: what we need, by when (before GT closes), how to answer (a "Your ruling" column with allowed values per tab).
   - *Exceptions* (C2): one row per flagged account, what GT says vs what her sheet says, our proposed handling.
   - *Check before migrating* (C5, C6, C7, `SIBLING_UNMATCHED`): the accounts she asked us to tag, with the GT values in question.
   - *Sheet arithmetic* (R3): the rows where fees, scholarship, award and payable do not reconcile.
   - *Email differences*: the lead emails that differ from GT (she asked to see them).
   - *Name tidy-up*: before → after for every capitalisation change.
   - *Questions*: C3, C4, C8 (with the crosswalk table), C9, C10, C11, C12, and any low-confidence pins from step 4.
   The pack contains personal data: it is shared by the protected route she uses (password-protected xlsx, password by the other channel), never as an artifact or plain attachment.
8. Draft the covering email (Gmail draft). **[H-Brian]** sends it with the pack.
9. Record gate `M2.charlotte-rulings` as open, `waitingOn: charlotte`, `neededBy: 2026-10-01`.
10. **[H-Charlotte]** returns the pack (possibly in pieces). Ingest per `07-charlotte-loop.md`. Rebuild. Repeat until no blocking flag from this pack remains, or 1 Oct arrives: on **1 Oct**, list whatever is still open, and **[H-Brian]** decides with her which accounts are dropped from the first batch rather than guessed.

**Automatic checks.** 273 rows in = 273 accounts out; every account has exactly one of {GT match, PB}; no duplicate account keys; lead-email count = 247 (or explained); R3 failures = 2 (or explained); canonical build is deterministic (build twice → same hash).
**Outputs.** Extract; canonical build; the pack; updated mapping doc.
**Exit gate `M2.exit`.** Pack sent (`M2.sent`) is enough to proceed to M4 with hold-backs; `M2.exit` proper = all M2 blocking flags resolved or the account explicitly deferred by Brian.
**If it goes wrong.** Read-only milestone. A wrong match or mapping is fixed in code and rebuilt; the hash change resets downstream gates automatically.

---

## M3 — Build the toolkit

**Goal.** `04-toolkit.md` exists as tested code.
**Entry gate.** `M0.exit`. Load phases need `M1.staging` (they write the new column, enum values and ledger).

**Steps**
1. Branch `chore/gt-migration-toolkit` off `staging`. Build in this order so each layer is usable as soon as it exists: `state` → `extract` → `build` (+flags) → `packs` → `calc` + `parity` → `ledger` → `load` phases → `verify` → `rollback` → `drill`.
2. Synthetic fixtures only in the repo. Real data stays in `../data/migration/`.
3. Unit + integration tests per `04-toolkit.md` §8.
4. PR to `staging`. The toolkit is not deployed; it only needs to be merged so prod runs happen from a commit on `main`.

**Automatic checks.** CI green; integration test proves load → verify → rollback → row counts equal → load again.
**Exit gate `M3.exit`.** Merged; `mig preflight --env nonprod` green; `mig parity --env nonprod` and `--env prod` green (read-only on both).
**If it goes wrong.** Code only. Note: a parity failure is a finding about the *app*, not the toolkit: tell Brian before going further.

---

## M4 — Rehearsal 1 on nonprod (with a full rollback drill)

**Goal.** First real load, and proof that rollback returns the environment to baseline.
**Entry gate.** `M1.staging`, `M2.sent`, `M3.exit`, B1 = yes.

**Steps**
1. `mig preflight --env nonprod`. Fresh baseline counts.
2. `mig calc --env nonprod`.
3. For each phase `identities → accounts → assessments`: `--dry-run` → canary (`--limit 5`, one of each class) → `mig verify` → full phase → `mig verify`. Held-back accounts are expected; record how many and why.
4. Walk five accounts in the staging UI as a staff user: Applicant Data card; documents tab (empty for now); assessment model tab shows the mapped inputs and the recalculated legs; award tab shows her fees, award and payable; ASSESSMENT ADMIN tab shows the schedule and the year-on-year row; the account appears in reports under the right school and fund. Screenshot each into `runs/<id>/ui/`.
5. Log in to the portal as one migrated parent on nonprod (set a password through the admin API for that one user) and confirm: schedule grid with the right years, **no** application to open, no "start application" affordance, no error.
6. **Rollback drill.** `mig rollback --env nonprod --run <id> --dry-run`, review, then for real. `mig verify --baseline`: every table count, the `auth.users` count and the storage object count equal the step 1 baseline (audit rows excepted: +2 per account, by design).
7. Reload everything (run id `np-r1b-…`). This reload is what M5 is built from. Timing for each phase recorded: it sets expectations for M7.

**Automatic checks.** All of `06-checks-and-rollback.md` §1; zero new `email_log` rows; zero `invitations` rows; tripwires silent.
**Outputs.** Run manifests; UI screenshots; timings; the rollback proof.
**Exit gate `M4.exit`.** Load verified **and** rollback verified **and** reload verified.
**If it goes wrong.** That is what this milestone is for. Roll back, fix, rerun. Do not proceed to M5 on a load you have not also successfully rolled back.

---

## M5 — Reconciliation pack to Charlotte

**Goal.** She sees, for every account, GT next to the recalculation, and rules on gaps and oddities while GT is still open.
**Entry gate.** `M4.exit`.

**Steps**
1. `mig pack reconciliation` → xlsx, tabs:
   - *Summary*: counts by school/fund/type; gap distribution (R5 buckets, both signs); how many recalculated recommendations fall within £100 of her payable fees; held-back accounts.
   - *Her hypothesis* (S19): she expects most outcomes near the affordability-adjusted leg. Report, per account, which of the three legs (actual, theoretical, affordability) lies closest to her payable fees, and the distribution. This answers her question directly and flags any account where none of the three is close.
   - *Every account* (one row each): reference; school; year; **GT synopsis** (S23: she reads it to judge the gap reason in context); **GT** income, equity, income category, property category, lifestyle grade (from her sheet) | **recalculated** income, categories, squeeze label, actual remaining DI, theoretical, affordability, closest leg | her fees, scholarship, award, payable | **gap** | **gap code** (yellow ruling column, drop-down of the 13 active gap codes; blank → code 3 per S19; under £100 → code 13, pre-filled) | reason codes (crosswalked) | flags.
   - *Siblings* (S24): every account whose GT synopsis or sibling fields indicate a sibling with fees — roughly 30 — with the synopsis's closing line, the sibling's name, and a yellow column for the sibling's net payable fees. What she enters here is loaded into the award tab's sibling section with the assessment; she cannot type it in afterwards, because a migrated assessment is locked and reopening one clears its recommendation.
   - *Large gaps*: |gap| > £1,000, with the inputs that drive it, so she can see whether it is the model or the data. Accounts flagged `SIBLING_PRESENT` are marked here: GT may have deducted a sibling's fees where the migrated recalculation does not (S22).
   - *Income differences* (R1 > £1) and *equity differences* (R2).
   - *Held back*: what each waits on.
2. Give her staging access to the same accounts (she already has a nonprod login) so she can open any row in the real UI.
3. Draft the covering email: what the pack shows, what she needs to do (fill "gap code", mark any account "hold"), the 1 Oct date for anything that needs GT. **[H-Brian]** sends.
4. **[H-Charlotte]** reviews. Ingest per `07-charlotte-loop.md`. Mapping corrections she surfaces go into `03-field-mapping.md` + code, then `build` → `calc` → a fresh pack *diff* (only rows that changed), not a whole new pack.

**Exit gate `M5.exit`.** Every loaded account has either her gap code or the agreed fallback; every account she marked "hold" is deferred in `decisions.json`; no unresolved mapping question.
**If it goes wrong.** If the recalculated figures are systematically off (say most gaps share a sign and size), that is a **mapping or model finding, not noise**: stop, analyse the five largest, and bring Brian a diagnosis before asking her to review 273 rows.

---

## M6 — Rehearsal 2 and sign-off

**Goal.** The exact data that will go to prod, loaded on nonprod, approved.
**Entry gate.** `M5.exit`.

**Steps**
1. Roll back run `np-r1b`. Verify baseline.
2. `mig build` (final decisions) → `mig calc --env nonprod` → full load, all phases, canary first → `mig verify`.
3. Freeze: record `canonicalHash` as `signoffHash`. Any later change to inputs or decisions voids the sign-off.
4. `mig calc --env prod` (read-only) and diff against the nonprod calc. They must be identical; a difference means prod's reference bands differ from nonprod's (M0 step 8): resolve before M7.
5. **[H-Charlotte]** signs off in writing (email): "the migrated accounts on staging are correct and may go to the live system", with the list of any accounts to exclude.
6. **[H-Brian]** records approval in `STATE.json.approvals` for run id `prod-<date>`, `signoffHash`, scope `load:identities,accounts,assessments`.

**Exit gate `M6.exit`.** Steps 5 and 6 recorded against the same hash; `M1.main` passed.

---

## M7 — Production load

**Goal.** 273 accounts (less deferrals) live, verified, with nobody emailed.
**Entry gate.** `M6.exit`, `M1.main`. A time when Charlotte is **not** working in the system (agree a window; the load takes minutes).

**Steps**
1. **[H-Brian]** confirm a fresh prod backup / PITR point; record its timestamp. Confirm Vercel prod is on the promoted commit.
2. `git checkout main && git pull`; clean tree. `mig preflight --env prod` → green, approval matched.
3. Fresh prod baseline counts. Re-run the M0 overlap check on prod (new real families may have been invited since).
4. `mig parity --env prod`.
5. Per phase: `--dry-run` → canary 5 → `mig verify` → **pause: [H-Brian] looks at the five in the prod UI (or Charlotte does)** → full phase → `mig verify`. Order: identities, accounts, assessments.
6. `mig verify --env prod --full`: all invariants; canonical comparison (every written figure equals the signed-off canonical value); `email_log` delta = 0; `invitations` delta = 0; Sentry shows no new issues during the window.
7. Draft a note to Charlotte: what is live, how to find a migrated account, the held-back list, what happens next (documents). **[H-Brian]** sends.
8. **[H-Charlotte]** spot-checks 10 accounts of her choosing within 48 hours.

**Exit gate `M7.exit`.** Verify green + her spot-check recorded.
**If it goes wrong.** See `06-checks-and-rollback.md` §4–§5. In short: a failed account never commits; a tripwire stops the run between accounts; anything already committed stays in place, consistent and ledgered, while Brian decides between fix-forward for the remainder and a ledger rollback. The executor does not roll back prod unasked.

---

## M8 — Documents

**Goal.** Latest-cycle documents and GT PDFs on each migrated application; the rest archived.
**Entry gate.** `M7.exit`; B2 (archive password); B5 (storage headroom).

**Steps**
1. Decrypt only what is needed: from the extract's document list, select documents belonging to each account's **latest cycle** (the application, or the latest progress report, plus that entity's attachments) and the GT-generated PDF ("Application Form" / "Progress Report" document types). Expect ≈6,200 files / ≈6.4 GB for the 269; recompute for 273. `7z x` by path list into `docs-staging/`. Non-ASCII filenames: match on GT document id, not on the name.
2. Classify → slot (`02-target-model.md` §9). Report: counts by slot, by MIME type, the largest 20 files, anything over the bucket's file-size limit, anything that is not pdf/jpeg/png (those will download rather than preview; list them, do not convert).
3. Reconcile: every expected document id is present on disk with the expected byte size. Missing or mismatched → hold that account's documents, continue with the rest.
4. Nonprod rehearsal with a 5% sample (B5): `mig load --phase documents --limit 14`; open them in the staging UI; roll back; confirm the storage object count returns to baseline.
5. Prod: `--dry-run` → canary 5 accounts → verify (signed URL opens; size and digest match) → full run. Uploads are idempotent (deterministic object key; an existing object with the same size is adopted, not re-uploaded).
6. `mig verify --phase documents`: per account, document rows = expected; every `storagePath` resolves; total bytes = expected.
7. **[H-Alex]** A1. When answered: hand over the remaining archive (still encrypted) plus an index csv (account reference, year, document type, filename, path inside the archive) so Charlotte can ask for a file by reference. Until answered, the archive stays where it is, untouched.
8. Delete `docs-staging/` (securely) once verify is green.

**Exit gate `M8.exit`.** Verify green; staging folder gone; archive hand-over done or explicitly parked.
**If it goes wrong.** Documents are additive and independently ledgered: `mig rollback --phase documents` removes objects and rows without touching accounts.

---

## M9 — Forward-compatibility drill, clean-up, deferred scope

**Goal.** Proof that April 2027 works, and a tidy finish.
**Entry gate.** `M7.exit`.

**Steps**
1. **Rollover drill on nonprod** (`mig drill rollover`): create a 2027/28 round; for three migrated accounts (Trinity, an OP Year 10, a two-child family) send a rolling-over invitation with **email skipped**, accept it as the parent, confirm: the existing login is reused (PR-E), the new application inherits her GT reference, child details carry over, the placeholder is *not* adopted as the new application, "last payable fees" shows the migrated confirmed figure, the year-on-year table shows the 2026-27 row, the OP account's fee override and 0% VAT apply, the OP Year 11 account is *not* offered a further year, and the batch invite is not blocked by "stored as complete" assessments. Remove the drill data afterwards.
2. Remove real family data from nonprod (ledger rollback of the M6 run), per B1. Keep the run manifests.
3. Archive `../data/migration/` (encrypted) with the final `STATE.md`. Delete `docs-staging/` if it still exists. Delete `.env.migration.prod`.
4. Write the close-out note: counts migrated, deferred accounts and why, known follow-ups.
5. **Deferred scope, each a new mini-run of M2 → M7 with its own sign-off:** held-back accounts as her rulings arrive, and prior years per her choice among the S20 options:
   - **Options 1 and 4 (statistical figures only)** need no new system work: they are `BursaryAccount.preSystemHistory` rows (`{academicYear, netIncome, savings, propertyEquity, debtExposure, livingArrangement, lifestyleSqueeze}`), which the ASSESSMENT ADMIN tab already shows as "manual" year-on-year rows. Source: GT's summary figures for each year from the copy we hold. Two traps: the table *labels* a stored `2024/25` row as `2023/24` (`priorAcademicYear`), so pin the convention with her on one account first; and these rows exist only on *active* accounts, so option 1/4 cannot include closed accounts.
   - **Option 2 (recreated assessments incl. closed accounts)** is the M2→M7 cycle again for 2025-26: a 2025/26 round (the unique academic-year means it must be created once, closed), her 2025-26 fee/award sheet, the same mapping, closed bursary accounts for leavers (the 97 last assessed for 2025-26), and the same review and sign-off.
   - **Option 3** closes this item.
6. **Before end of March 2027:** confirm with Charlotte how parents get their first password (the "forgot password" flow works for confirmed users; JWF mail scans links, and the reset flow already verifies the token on submit). Add to the calendar.

**Exit gate `M9.exit`.** Drill green; nonprod cleaned; close-out note sent.
