# 02 — Target model and the system changes it needs

Part 1 says exactly what one migrated account looks like in the database. Part 2
lists the system changes (milestone M1) that must be deployed before data of that
shape can be written. Line numbers are as of `staging` @ `063ee00`; re-locate by
symbol if they have moved.

## Part 1 — One migrated account, row by row

Writes happen in this order. "Key" is the natural key the toolkit uses to find an
existing row and stay idempotent.

### 1. Auth user (Supabase) — one per lead email
- `auth.admin.createUser({ email, password: <random 24 bytes>, email_confirm: true, app_metadata: { role: "APPLICANT" } })`.
  This sends nothing. Reuse `provisionApplicantAuthUser` (`src/lib/auth/provision-applicant.ts:34`): it reuses an existing APPLICANT, refuses a staff email, and recovers the id on "already registered".
- **Key:** lower-cased email. 247 emails for 273 accounts (25 leads have 2–3 children).
- **Not created** for the two PB accounts (decision C3): they get a profile only.

### 2. `profiles`
- `id` = auth user id (for PB: a generated uuid; `profiles.id` has no FK to `auth.users`).
- `role = APPLICANT`, `email`, `firstName`, `lastName`, `phone` from GT primary contact, capitalisation tidied (`03-field-mapping.md` §2).
- Note the trigger `trg_sync_role_to_app_metadata`: inserting the profile stamps `app_metadata.role` on the auth user. Create the auth user first.
- **Key:** `id`; guard on the unique `email`.

### 3. `contacts` — one per account
- `title`, `firstName`, `lastName`, `email`, `phone`, address fields from GT primary contact; `childFirstName`, `childLastName` parsed from column C; `childName` composed; `childDob` from GT when present.
- `school`, `situation = ROLLING_OVER` (rolling-over) or `NEW` (new awards, PB), `entryYear = 2026`, `entryYearGroup` = 2026-27 school year.
- `profileId`, `bursaryAccountId` linked; `createdBy` = the migration system profile (B3); `notes = "Migrated from Grant Tracker <date>"`.
- **Key:** (`profileId`, `childName`, `childDob`) — the table's own unique.

### 4. `applications` — the locked placeholder
| Field | Value |
|---|---|
| `reference` | her GT reference, verbatim (E6) |
| `roundId` | the existing 2026/27 round (E1) |
| `leadApplicantId`, `contactId`, `bursaryAccountId` | linked |
| `school`, `childName`, `childFirstName`, `childLastName`, `childDob` | as contact |
| `entryYear`, `entryYearGroup` | 2026, 2026-27 school year |
| `applicationType` | `ROLLING_OVER` or `NEW` (PB: `NEW`) |
| `isReassessment` | true for rolling-over |
| `formStatus` | `SUBMITTED` (E2) |
| `submittedAt` | GT assessment completion date; PB: import timestamp. **Never NULL.** |
| `migrationSource` | `GRANT_TRACKER` (new column, E5); PB: `MANUAL_PB` |
| `closedAt`, `archivedAt`, outcome | NULL (E4) |
| `assignedToId` | NULL |
- No `ApplicationSection` rows. One PRIMARY `ApplicationContributor` via `ensurePrimaryContributor` (cheap, keeps every reader on its happy path).
- **Key:** (`roundId`, `leadApplicantId`, `childName`, `childDob`) — the table's own unique. A collision with a *non-migrated* row is a stop-the-line condition.

### 5. `assessments` (+ `assessment_earners`, `assessment_properties`)
- `calculationVersion = 2`, `assessorId` = B3, `assessmentSchool`, `entrySchoolYear` = 2026-27 school year, `schoolingYearsRemaining` from the central helper (Year 11 cap for OP).
- **Inputs** mapped from GT per `03-field-mapping.md` §3–§5: `familyTypeCategory`, earner `incomeDetail` JSON, `propertyAssets`, `debts`, `cashSavings`, `isasPepsShares`, toggles, `manualAdjustment`, `siblingDetails`, `synopsis`.
- **Fees:** `annualFees` = her sheet's school fees; `nextYearAnnualFees` = NULL (no 2027/28 fee row exists; the award summary falls back to the current-year fee, which is what her sheet's arithmetic uses); `scholarshipPct` from her sheet (blank = 0); `vatRate` = 20, **0 for OP**.
- **Snapshot:** every v2 output column populated from `calculateAssessmentV2` (`src/lib/assessment/v2/orchestrator.ts`), including `recommendedPayableFees = max(0, actualRemainingDi)`. `bursaryAward`, `yearlyPayableFees`, `monthlyPayableFees` from her sheet.
- `awardFundType` per S7. `status` = `ROLLED_OVER` / `NEW_AWARD` (E3). `completedAt` = GT assessment completion date. `outcome` NULL.
- **PB:** no earners, no property row, no inputs; snapshot columns zero; `recommendedPayableFees = 0`; status `NEW_AWARD`; `awardFundType = PB`; synopsis = "Pastoral boarder: no financial assessment (external charity assesses)."
- **Key:** `applicationId` (unique).

### 6. `recommendations` (+ reason codes, gap reasons)
| Field | Value |
|---|---|
| `assessmentId`, `roundId`, `bursaryAccountId` | linked |
| `bursaryAward`, `bursarySpendBeforeVat` | her 2026-27 bursary award (before VAT) |
| `scholarshipSpendBeforeVat` | fees × scholarship % |
| `netFeesBeforeVat` | max(0, fees − scholarship − award) |
| `yearlyPayableFees`, `confirmedPayableFees` | her 2026-27 payable fees |
| `monthlyPayableFees` | her monthly figure |
| `recommendedPayableFees` | from the recalculation |
| `gapAmount` | round(confirmed − recommended, 2) |
| `lastPayableFees` | NULL (no prior year in system) |
| `incomeCategory`, `propertyCategory` | from the recalculation |
| `familySynopsis` | NULL (synopsis lives on the assessment) |
- `recommendation_reason_codes`: crosswalked GT codes + 27/35 where her sheet says "Yes" to major income/assets change; new awards and PB get code 1 ("first assessment").
- `recommendation_gap_reasons`: required whenever |gap| > £0.01 by the app's own rule; she treats < £100 as immaterial (gap code 13). Per S19: her pick from the reconciliation pack, else fallback gap code 3. Below £100 the app still requires a code for any non-zero gap: use gap code 13 "Immaterial gap, less than £100".
- **Key:** `assessmentId` (unique).

### 7. `bursary_accounts` and `bursary_schedule_entries`
- `school`, `childName`, `childDob`, `entryYear = 2026`, `entryYearGroup`, `firstAssessmentYear` = round academic year, `leadApplicantId`, `status = ACTIVE`, `benchmarkPayableFees` = confirmed payable fees; OP: `annualFeesOverride` = her sheet's fee (new column).
- Schedule: call `generateSchedule` (`src/lib/bursary-accounts/schedule.ts:149`) with the round's dates; it writes `scheduleYears`. Then set schedule year 1 to `status = COMPLETE`, `applicationId` = the placeholder, `roundId` = the 2026/27 round (what `mirrorApplicationToSchedule` does after a live NEW_AWARD).
- Expected horizons: Y6→8, Y7→7, Y8→6, Y9→5, Y10→4, Y11→3, Y12→2, Y13→1; **OP Y10→2, Y11→1**.
- **Key:** the account is found through the placeholder application's `bursaryAccountId`; schedule rows by (`bursaryAccountId`, `scheduleYear`).

### 8. Siblings — **no links, no automation** (S22)
- **No `sibling_links` rows are created.** Each account stands alone; a family with three bursary children has three accounts and, next year, three applications.
- GT's sibling **first names** are transposed into `Assessment.siblingDetails` so the award tab shows them. `netPayableFees` is blank unless she supplied a figure in the reconciliation pack (S24), in which case it is loaded with the assessment and included in `siblingPayableFees` for the recalculation.
- `siblingPayableFees` passed to the engine is therefore **empty**, so a migrated recalculation performs no sibling absorption. Where GT's own assessment did deduct a sibling's fees, the recalculated recommendation will sit higher than GT's by roughly that amount. Every such account is flagged `SIBLING_PRESENT` and listed in the reconciliation report, so she sees which gaps have that cause.
- Accounts are no longer calculated oldest-first: each is independent.

### 9. `documents` + Storage — separate phase (M8)
- Object key: `documents/{applicationId}/{slot}/{uuidv5(gtDocumentId)}_{safeFilename}` (same convention as `buildStoragePath`, deterministic uuid for idempotency).
- Slots (free strings, must match `^[A-Z0-9_]{1,64}$`): `GT_APPLICATION_PDF`, `GT_ANNUAL_REVIEW_PDF`, `GT_APPLICATION_ATTACHMENT`, `GT_REVIEW_ATTACHMENT`, `GT_GENERAL`.
- `uploadedBy` = migration system profile; `uploadedByContributorId` NULL; `contentDigest` computed with `src/lib/documents/content-digest.ts`; `isVerified = false`.

### 10. Ledger and audit
- One `data_migration_ledger` row per created row/object (`04-toolkit.md` §4).
- One `audit_logs` row per account: action `DATA_MIGRATION_IMPORT`, entity `BursaryAccount`, metadata `{ runId, source: "GRANT_TRACKER", gtGrantId }`. No names in metadata. Audit rows are append-only and are **not** removed by a rollback; a rollback adds `DATA_MIGRATION_ROLLBACK`.

## Part 2 — System changes (milestone M1)

Each group is one PR to `staging`, smallest first. Every schema change is additive
(a merged migration auto-applies to nonprod, and to prod on promotion). New tables
get RLS force-enabled by the `ensure_rls` trigger: **policies ship in the same PR**
and `npm run check:rls` must pass. Enum values are added by migration and must be
live in code **before** any data uses them.

### PR-A — Reason codes 27 and 35 (decision S18)
- Migration: keep every existing DB `code` where it is (so nothing already recorded moves); **relabel** the 15 rows whose display number shifts (DB codes 227–241: label prefix "27 – …41 –" becomes "28 – …43 –", `sort_order` +1 or +2); **insert** two rows with new DB codes 242 ("27 - Major change in income", `sort_order` 27) and 243 ("35 - Major change in assets", `sort_order` 35). Update `prisma/seed-data/reason-codes.ts` to match, because `seed:reference` upserts by `code` and would otherwise undo the relabelling. The toolkit resolves reason codes **by label text**, never by number.
- Only five uses exist in prod (codes 1, 5, 8), none of which move.
- Charlotte asked for this independently; it also unblocks the "major change" flags in the crosswalk.

### PR-B — Whitgift bursary type `JWF-PB` (S21)
Her taxonomy is what is already implemented plus one value: Trinity JWF + TBF; Whitgift JWF + JWF-WSP + WFA + **JWF-PB**.
- `AwardFundType` += `PB`; `AWARD_FUND_LABELS` (`src/lib/assessment/award-fund.ts:15`) gains `PB: "JWF-PB bursary"` — the map is exhaustive, so the build breaks until it is added.
- `awardFundOptionsForSchool` (`award-fund.ts:23`): WHITGIFT becomes `["JWF", "WSP_JWF", "WFA", "PB"]`; Trinity unchanged. The `default` branch is silent, so without this every PB lock is rejected as "not offered at this school".
- `bulkLockRolledOverAction` fallback `"JWF"` (`src/app/(admin)/assessments/actions.ts:63`): leave, but add a test that a PB account carries PB forward.
- Extend `award-fund.test.ts`.

### PR-C — Old Palace partnering school
The enum widening is the riskiest change: only 3 exhaustive maps and 1 switch fail the build; **18 conditionals silently treat a third school as Whitgift (or Trinity)** and 14 option lists are hard-coded.
1. **First commit: centralise.** Add `src/lib/schools.ts` exporting `SCHOOL_LABELS: Record<School, {short, long}>`, `schoolLabel()`, `finalEligibleSchoolYear(school)`, `schoolVatRate(school)`, `schoolHasFeeTable(school)`. Replace all 18 ternary/if-else sites and the 5 loose label maps with it. No behaviour change; ships green on its own.
2. **Second commit: widen.** `School` += `OP_PARTNER`. Work through the compile errors, then the *silent* sites, by list:
   - Ternaries: `contribute/actions.ts:326`, `contribute/page.tsx:36`, `assessments/page.tsx:513`, `assessment/admin/page.tsx:188`, `queue/actions.ts:335`, `invitations/page.tsx:66`, `invitations/actions.ts:149`, `assessment/award/page.tsx:117`, `recommendation-form.tsx:362`, `sibling-fees-block.tsx:200`, `invite-from-contact-dialog.tsx:42`, `contacts-table.tsx:40`, `contact-helpers.ts:74`, `submission.ts:454`, `set-outcome-core.ts:227`, `invitation-template.ts:43-49`.
   - Badges that fall through to Trinity: `applications/[id]/layout.tsx:45`, `application-table.tsx:209`.
   - Hard-coded unions (`"TRINITY" | "WHITGIFT"`): `src/types/application.ts:10`, `src/types/assessment-v2.ts:98`, and the 16 others listed in the survey → import the Prisma `School` type.
   - zod / option lists: `(portal)/actions.ts:36`, `schemas/child-details.ts:73`, `send-invitation-form.tsx:84`, `internal-request-dialog.tsx:76`, `contact-form-dialog.tsx:94`, `onboarding-card.tsx:98`, `assessment-form-v2.tsx:1100`, `sibling-fees-block.tsx:163`, `application-table.tsx:1108`, `export-filter-form.tsx:46`, `assessments/page.tsx:87,373`, `api/exports/recommendations/route.ts:62`. **OP is not offered on parent-facing or new-invitation forms** (no new OP families are ever invited); it *is* offered on staff filters, exports and the contact form.
   - `reference.ts:56` school segment; `invitation-template.ts` must not pick a Whitgift template for OP (rolling-over template only).
3. **Per-account fee, no VAT.** `BursaryAccount.annualFeesOverride Decimal?`. In `assessment/page.tsx:384-398` the fee lookup hard-codes both schools; make it data-driven and, when the application's account has an override, use it for that school. `vatRate` is per-assessment: stamp `schoolVatRate(school)` at creation (`assessments.ts:267`, `status.ts:505` both hard-code 20).
   - **Bug to fix here:** `assessment-form-v2.tsx:634` reads `Number(assessment.vatRate ?? 20) || 20`, which turns a stored **0 back into 20**. Must become a null-check.
   - `school-fees-form.tsx:88,127` ignore the rate; OP has no fee row, so it never renders there. `add-school-fees-year-form.tsx:31` keeps offering only Trinity/Whitgift (S9: no OP fee table).
   - An admin-only field on the ASSESSMENT ADMIN tab edits `annualFeesOverride` (she will need it for the 9 remaining accounts next spring).
4. **Year 11 cap**, through the central helper only: `schooling-years.ts:26-35` and `:263` (`14 − year`), `schedule.ts:35` (`FINAL_ELIGIBLE_SCHOOL_YEAR`), `portal-schedule.ts:165`, `reports.ts:108` (an independent second copy of "13"), the literal `[6..13]` at `assessment-form-v2.tsx:1130`, and the "Year 6 → Year 13" copy in four portal files. Add tests: OP Y10 → 2 years, OP Y11 → 1.
   - Before widening, grep `case "TRINITY"` / `case "WHITGIFT"` / `default: return null` once more: private switches with a silent default have broken schedules in this codebase before.

### PR-D — Migrated-account mode + ledger
- `applications.migration_source String?` (E5).
- `data_migration_ledger` table (`04-toolkit.md` §4) with admin-only RLS policies in the same migration.
- Audit actions `DATA_MIGRATION_IMPORT`, `DATA_MIGRATION_ROLLBACK` in `src/lib/audit/actions.ts`.
- Admin UI: on a migrated application the **Applicant Data** tab shows a "Migrated from Grant Tracker: there is no application form. Documents are under Assessment → Uploaded documents." card and still renders the account, schedule and sibling sections (today the zero-sections early return at `applications/[id]/page.tsx:206` hides `DocumentChecklist`/`AdminUpload`; render `AdminUpload` for migrated rows so staff can still add a document). `AssessmentTabNav` (`assessment-tab-nav.tsx:18`) gains a prop to disable "APPLICATION FORM".
- Portal: `getCurrentApplicationForUser` (`applications.ts:698`) falls back to the most recently updated application, which would make the placeholder "the application" on a parent's dashboard. Exclude `migrationSource IS NOT NULL` from that fallback and from the application-type chooser; the schedule grid is unaffected.
- Re-assessment prepopulation already tolerates a zero-section prior year (`reassessment.ts:275`).

### PR-E — Rolling-over invite must reuse an existing login
`sendReassessmentInviteForHolder` (`invitations/actions.ts:516`) always calls `createUser`, so it fails with "already registered" for any holder who already has a login, which is every migrated parent (and every in-system holder). Switch it to `provisionApplicantAuthUser`. Without this, the March 2027 batch fails for all 247 families. Proved by the M9 drill.

### PR-R — Reporting correctness (decision B4; existing defects, amplified 273×)
Charlotte found three of these herself on 21 Sep (S25) and they are the priority in this group:
- **Money precision on the admin tab**: `assessment/admin/page.tsx:54` formats with `maximumFractionDigits: 0`. Show 2dp for the award and payable figures — a third of the award goes on each termly invoice, so the pennies matter.
- **Future-year submit-by dates**: `planSchedule` (`schedule.ts:89`) shifts the award round's open/close by whole years, so a migrated 2026/27 account shows 30 Nov 2026 for next year. Use the round's `RoundWindow` RA row (opens 2027-04-15, submit by 2027-05-22 in prod today) for every schedule year after the first, falling back to the shifted dates when no RA window exists.
- **Locked assessments read "Not started"**: `payable-fees-schedule.ts:132-140`.
- Dashboard `getDashboardCounts` (`reports.ts:195-225`) buckets only on the legacy `outcome`; a `NEW_AWARD`/`ROLLED_OVER` assessment with `formStatus = SUBMITTED` is counted as **awaiting assessment**. Treat the locked states as decided.
- Watchlist `isDecided()` (`round-watchlist-eval.ts:222`) is `outcome != null` only; rules 5, 6 and 8 would fire on every migrated account. Same fix.
- `payable-fees-schedule.ts:132-140` labels any locked year "Not started".
- `getAwardDistribution` (`reports.ts:356`) bands `recommendation.bursaryAward` as a percentage, but v2 stores pounds. Decide the unit and fix the chart.
- None of these change data; all can ship after M4 but before M7.

### Deployment order
PR-A → PR-B → PR-C (two commits) → PR-D → PR-E → PR-R, all to `staging`. Brian
promotes `staging → main` **before M7**. The toolkit's prod preflight refuses to
run unless the enum values, the column and the ledger table exist in prod *and*
the deployed commit on `main` contains PR-C and PR-D.
