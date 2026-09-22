# 01 — Decision register

Every design choice in this migration traces to a row here. **Settled** rows are
facts. **Open** rows carry a *default*: the toolkit behaves as the default says
until the owner rules otherwise, and any account affected by an open row is
*flagged* so it can be held back from a load (see `04-toolkit.md` §5).

Sources: Charlotte's emails of 16 and 19 Sep 2026 (threads "Moving the live
bursaries off Grant Tracker", "MIGRATION PATH", "WHAT DOES NOT COME ACROSS",
"WHAT YOU NEED ME TO CONFIRM", "List to use to prepare the accounts", "Reasons
codes (year on year)"); Brian's instructions of 19 Sep.

Record new rulings in `../data/migration/decisions.json` (machine) **and** update
this table (human). Never delete a row; supersede it.

## A. Settled

| ID | Decision | Source |
|---|---|---|
| S1 | Assessments are **recalculated** by the current model from GT inputs she trusts. Nothing is copied from GT's calculated results. | CP 16 Sep, 19 Sep |
| S2 | The account list is her **273 sheet** (271 to migrate + 2 pastoral boarders to create). It supersedes the 269 list. Drive: `1G0Cto2tesfQwS9LYGJftgRgmgTW_43Stk5BgOIkJDGg`. | CP 19 Sep |
| S3 | Lead applicant **email comes from her sheet** (she used it for the 8 Jun 2026 award letters). Title, first name, surname, address and mobile come from GT's primary contact. Tidy capitalisation. Titles are often missing: leave blank. | CP 19 Sep |
| S4 | Only the lead applicant is migrated. No second-parent records. | CP 19 Sep (thread reply, point 5) |
| S5 | Pupil surname / first name come from column C (the reference), not the free-text pupil-name column. | Brian's path, agreed 19 Sep |
| S6 | Parents get a login; **no email goes out** as part of the migration. Parents are told at the end of March 2027. | CP 19 Sep Q5 |
| S7 | Award fund = suffix of her School column: none → `JWF`, `TBF` → `TBF`, `WSP` → `WSP_JWF`, `WFA` → `WFA`, `PB` → new `PB`. **WBS no longer exists** (the two former WBS accounts are WSP on the 273 sheet). | CP 19 Sep |
| S8 | **Pastoral boarders (PB):** full bursary for the day element, **no financial assessment**; only the award tab is filled. Two accounts, to be *created* (they are not in GT). | CP 19 Sep |
| S9 | **Old Palace:** one school, named "OP partnering school". **No per-pupil partner-school field.** School fees differ per account and carry **no VAT**. Bursary commitment ends at **Year 11**. 21 accounts now; 9 remain in 2027-28. No fees admin section for OP. | CP 19 Sep |
| S10 | Remaining years are derived from the pupil's **2026-27 school year** up to Year 13 (Year 11 for OP) and shown on the parent's home page. GT progress reports are not used. | CP 19 Sep |
| S11 | Documents: the latest application / annual review cycle's documents, plus GT's generated PDF of that application or review, go into the document section. Earlier years are archived outside the live system. | CP 19 Sep |
| S12 | No applications are recreated. The application tab is disabled for migrated accounts. Next annual review happens in the new system normally. | CP 19 Sep |
| S13 | Not migrated: GT calculated figures, progress reports, application forms as data, email correspondence, GT finance and report sections. | CP 19 Sep |
| S14 | GT's final-award tab is ignored entirely; her 273 sheet supplies school fees, scholarship %, 2026-27 bursary award, payable fees, monthly payable fees. | Trusted-fields workbook, tab 7 |
| S15 | GT free-text "comments supporting the figures" → the new assessment's **synopsis**. | Trusted-fields workbook, tab 6 |
| S16 | Current year (2026-27) first. 2025-26 and closed accounts are a separate, later pass and do not shape the first batch. | CP 19 Sep Q6, §8; Brian's draft reply |
| S17 | The 13-day window to 2 Oct is accepted as the window for **GT-dependent questions**; commercial scope (SOW/price) is deferred by Brian. | Brian 19 Sep |
| S19 | **Gap codes: option (b).** She picks a gap code per account in the reconciliation pack; any left blank falls back to gap code 3 "Original Old Assessment Benchmark (year 2020)". Gaps under £100 get gap code 13 "Immaterial gap, less than £100" automatically (the app requires a code for any gap over 1p, `GAP_TOLERANCE = 0.01` in `src/lib/assessment/recommendation-v2.ts`; the 19 Sep email told her under-£100 gaps need no code, which is only true in effect). Supersedes C1. Her view: the model has not changed, it is three times more transparent, and odd accounts standing out is fine. She expects most recalculations to land close to the **affordability-adjusted** leg. | CP 19 Sep 19:47, "MIGRATION PATH" thread |
| S20 | 2025-26 is decided **after** the current year is done. Her four options, none chosen yet: (1) statistical top-line figures for 2025-26 in the ASSESSMENT ADMIN tab only; (2) a second mapping/comparison pass that recreates 2025-26 assessments, including accounts closed since; (3) stop at one year; (4) statistical figures for the previous three years. | CP 19 Sep 19:47 |
| S27 | **The "2025/26" row on the ASSESSMENT ADMIN tab is in scope and carries no charge.** Charlotte, 22 Sep: that line is the **financial assessment year**, not a prior award year — a 2026-27 award rests on the applicant's 2025-26 finances. It is therefore the migrated assessment itself, and the system already labels it that way: the history table renders each row through `priorAcademicYear` (`admin-tab.ts:185`, used at `assessment/admin/page.tsx:360`), so a row stored under 2026/27 displays as 2025/26. An earlier suggestion that this was option 1 at £200 was wrong and has been withdrawn. Option 1 remains what it always was: the year *before* the migrated one. | CP 22 Sep; verified in code |
| S28 | **Money precision: the export was already right.** `src/lib/export/xlsx.ts` writes raw numbers with `numFmt '£#,##0.00'`, so her invoicing extract keeps the pennies. Only the admin screen rounds (S25a). | Verified 22 Sep |
| S25 | **Three admin-tab defects she found on 21 Sep, all confirmed in code and all licence-covered.** (a) The year-on-year table renders money with `maximumFractionDigits: 0` (`assessment/admin/page.tsx:54`), so an award of £19,556.67 shows as £19,557; she needs 2dp because a third of it goes on each termly invoice. (b) "App to be submitted by" for future years is the award round's close date shifted a year (`planSchedule`, `schedule.ts:89`), giving 30 Nov 2026; it should be the rolling window already configured in `round_windows` (RA: opens 2027-04-15, submit by 2027-05-22 — exactly the dates she quoted). (c) A locked assessment (`NEW_AWARD`/`ROLLED_OVER`) shows as "Not started" (`payable-fees-schedule.ts:132`). All three affect every migrated account, so they ship in M1 (PR-R). | CP 21 Sep; verified in code + prod `round_windows` |
| S26 | **Documents: her cycle window is confirmed.** Documents hang off the GT *grant*, not the review, so the cycle is taken by date: 5 Nov 2025 – 31 Jul 2026 gives **6,181 documents across 269 of the 271** accounts (median 20 each), plus a generated PDF for 269. The other 26,202-6,181 documents on those grants (2020–2025) are archived, not migrated. Two accounts have nothing in the window and go on the exceptions list. | Extract, 21 Sep |
| S24 | **Sibling fees are captured in the reconciliation pack and loaded with the assessment, not typed in afterwards.** She intends to read each synopsis, identify the ~30 accounts with a sibling bearing fees, and feed the figure into the award tab's sibling section. A migrated assessment is locked (`ROLLED_OVER` / `NEW_AWARD`) and locked assessments are read-only; reopening one clears its recommendation. So the pack carries a sibling column she fills, and the load writes it. | Brian/CP 20 Sep, plus `assessment/gate.ts` (`EDITABLE_ASSESSMENT_STATUSES`) |
| S21 | **PB is a bursary type, not a new fund concept.** Her taxonomy: Trinity offers JWF and TBF; Whitgift offers JWF, JWF-WSP, WFA and **JWF-PB**. That is the existing model plus one value on Whitgift only. | CP 20 Sep |
| S22 | **No sibling automation.** Sibling accounts behave like any other account: one application per bursary recipient, no automated feed at any level. The award tab's sibling fields are there for the assessor to fill **manually**, because a sibling may have fees without being a bursary recipient. For the migration: transpose sibling **first names** from GT into those fields, leave the fees blank, and create **no sibling links**. Supersedes C4. | CP 20 Sep, and the trusted-fields workbook ("no need to work out the payable fees of the sibling") |
| S23 | The reconciliation report must show each account's **GT written synopsis**, so she can judge the gap reason in the context of that assessment. Small gaps carry "immaterial gap" by default, which she has confirmed. | CP 20 Sep |
| S18 | Two new year-on-year reason codes: **27 "Major change in income"**, **35 "Major change in assets"**; existing 27–41 renumber to 28–43. Gap codes unchanged. | CP 19 Sep |

## B. Open — waiting on Charlotte

| ID | Question | Default until answered | Blocks | Asked |
|---|---|---|---|---|
| ~~C1~~ | **Settled → S19.** Which **gap code** do migrated accounts get when \|confirmed − recommended\| ≥ £100? (a) one default, (b) she picks per account in the reconciliation pack with a fallback, (c) other. | – | – | Answered 19 Sep |
| C2 | Ruling on each **exception account** (re-derived against the 273 list in M2): not active in GT; no 2026 review; school year differs from GT; summary-only assessment; lead email differs; reference not in GT; duplicate GT records; sheet arithmetic that does not reconcile. | Hold the account back from every load | Those accounts only | M2 pack |
| C3 | **Pastoral boarders:** lead applicant is "Fees team" with the Foundation's fees mailbox. Confirm there is no parent and no portal login. | Create a login-less profile (no auth user); no schedule shown to anyone | The 2 PB accounts | M2 pack |
| ~~C4~~ | **Settled → S22.** **Siblings:** when a migrated pupil has a sibling at a JWF school who is *not* on the 273 list (full-fee or other), which fee figure is deducted? And confirm the rule that only *older* siblings' payable fees are deducted. | – | – | Answered 20 Sep |
| C5 | **Rent-free adjustments** (+£12,000 / +£15,000 in a GT income field): confirm each flagged account, and that they become the model's rent add-back rather than income. | Treat as `rentAddBackType = FULL_RENT_FREE`, exclude from income, flag | Flagged accounts | M2 pack |
| C6 | **Child benefit inside "income support"** on new-application assessments: confirm per flagged account. | Import as entered under income support (`benefits.other`), flag | Flagged accounts | M2 pack |
| C7 | **Other properties ≠ 0:** split between second property and "multiple portfolio" per flagged account. | Import the aggregate as `other`, portfolio type `MULTIPLE` if >1 implied else `DOUBLE`, flag | Flagged accounts | M2 pack |
| C8 | **Reason-code crosswalk** (GT's old numbering → new list): confirm the proposed mapping, and rule on the codes with no clean equivalent. | Proposed mapping in `03-field-mapping.md` §6; unmapped → "Other" + flag | Reason codes only (never blocks a load) | M2 pack |
| C9 | Where is the "audit trail" of GT's check flags (credit check / land registry / social media requested) kept? She asked; we propose the synopsis footer. | Append a one-line footer to the synopsis | Nothing | M2 pack |

| C10 | OP award fund: confirm `JWF` for all 21 (no suffix on the sheet). Her 20 Sep taxonomy (S21) covers Trinity and Whitgift only. | `JWF` | Nothing | M2 pack |
| C11 | Has anything changed in GT since the **10 Sep** copy (new awards, edits to the 273)? If yes, request a fresh export from Symplectic before 2 Oct. | Assume her 273 sheet (built from the billing system) is newer than GT for award figures; GT inputs as at 10 Sep | Nothing, but time-boxed by 2 Oct | M2 pack |
| C12 | **Loan and lease debt:** GT records *yearly repayments*; the current model expects *outstanding balances* (credit cards are balances in both). How should a GT yearly figure become a balance? | Load credit-card and Foundation debt as-is; load loans/leases as yearly repayment × schooling years remaining (so the model's per-year spread returns GT's yearly figure); list every such account in the pack (about half of all accounts carry some debt repayment) | Nothing: one global rule; a change re-runs the build | M2 pack |

## C. Open — waiting on Brian

| ID | Question | Default | Blocks |
|---|---|---|---|
| B1 | Real family data on **nonprod** for the rehearsals (Charlotte must review real figures on staging). Nonprod is reachable only by Brian and Charlotte; data is removed after prod sign-off (M9). | Yes | M4 |
| B2 | `DocumentStore.zip` AES password (from Symplectic's one-time link). | – | M8 only |
| B3 | Which staff profile owns migrated assessments (`assessorId`)? | Charlotte's ADMIN profile; a login-less "Data migration" system profile is `createdBy` / `uploadedBy` | M3 config |
| B4 | The "reporting correctness" fixes in M1 group R are existing defects, not migration features. Ship them before the prod load? | Yes: at 273 accounts they make the dashboard visibly wrong | M7 quality, not M4 |
| B5 | Supabase plan storage headroom for ~6.4 GB of documents on prod (and the same again on nonprod if M8 is rehearsed with the full set). | Rehearse M8 on nonprod with a 5% sample | M8 |
| B6 | Commercial scope (SOW). | Deferred | Nothing technical |

## D. Open — waiting on Alex Skrzynski (JWF IT)

| ID | Question | Default | Blocks |
|---|---|---|---|
| A1 | Where do archived pre-2026 documents live, and how does Charlotte reach them? (~34 GB, ~20,000 files.) | Keep the encrypted archive as delivered; do nothing until answered | The archive half of M8 only |

## E. Engineering decisions made by this plan

These are ours to make; they are recorded so nobody re-litigates them mid-run.

| ID | Decision | Why |
|---|---|---|
| E1 | Migrated applications and assessments go into the **existing 2026/27 round**, not a separate "legacy" round. | `Round.academicYear` is unique; her stats must show live and migrated 2026-27 awards together; next year's "last payable fees", year-on-year history and watch-out notes all read the prior year by account, and work unchanged. |
| E2 | The placeholder application is `formStatus = SUBMITTED` with `submittedAt` set. | Anything else hides the documents tab (pre-submission redirect), and a `NULL submittedAt` sorts *first* in every "most recent prior year" query. A non-submitted placeholder in the same round would also be silently adopted as next year's re-assessment application. |
| E3 | The assessment is written directly in its **locked** state: `ROLLED_OVER` (rolling-over) or `NEW_AWARD` (new awards and PB). Never left at `COMPLETED`. | A `COMPLETED` assessment on a submitted application from an earlier round **blocks the entire rolling-over invitation batch** next spring. Locked states are also what the year-on-year readers expect. |
| E4 | No legacy `outcome` is written and `closedAt` stays NULL. | This mirrors the in-system award path. Setting `closedAt` would make the application purge-eligible after 30 days and the purge deletes documents. |
| E5 | A migrated row is identified by a new nullable column `applications.migration_source = 'GRANT_TRACKER'` and by a **ledger table** listing every row the toolkit created. | Read-side gating (tabs, portal) needs a flag on the row; reliable rollback needs an explicit list that survives the loss of a laptop. |
| E6 | The `reference` of the placeholder is **her GT reference verbatim**. | That is the field's purpose (fees-system reconciliation), and next year's application inherits it. |
| E7 | The account's `entryYearGroup` is the pupil's **2026-27 school year**, `entryYear = 2026`, `firstAssessmentYear` = the round's academic year. | The schedule horizon, "final-year bursaries" report and the portal grid all derive from these three; this gives "Year 8 → five more years" exactly as she specified. |
| E8 | The toolkit connects as the database owner (`DIRECT_URL`) and writes with Prisma, per-account transactions. Auth users via the Supabase admin API. **Never raw SQL into `auth.users`.** | Owner bypasses RLS cleanly; hand-inserted auth rows break sign-in and password reset. |
| E9 | Engine parity is proved before trusting any recalculation: the toolkit must reproduce the stored snapshot of every existing prod assessment to the penny. | It shows the script calls the calculator exactly as the UI does, with the same reference bands. |
