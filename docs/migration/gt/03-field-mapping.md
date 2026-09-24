# 03 — Field mapping

How each value in the new system is derived. Three sources, in priority order:

1. **Her 273 sheet** ("Active bursaries (273, …)"): identity of the account, lead email, school + fund, 2026-27 school year, fees, scholarship %, award, payable fees, and GT's own summary figures (used for *comparison only*).
2. **GT assessment form data**: the latest assessment per account. Form "Fees Assessment - V1" sits on the grant (new awards); "Recurring Annual Bursary Assessment - V1" sits on the latest progress report (rolling-over). Read from `RV_ApplicationFormDataView`; summary outputs from `RV_DynamicFieldValues`.
3. **GT contacts**: the grant's primary contact.

Status of this document: **proposed**. M2 confirms every row against her
trusted-fields workbook. That workbook carries her notes as cell text *beside
embedded screenshots of each GT tab* (18 images). The notes are pinned to a
position on a screenshot, not to a control name, so M2 step 4 extracts the images
(`xl/media/*` inside the xlsx), reads them, and records the control name each note
refers to in the "pinned to" column below. Where a pin is uncertain, the row stays
flagged and goes into the M2 questions pack.

Trust key: **T** = she marked it trusted; **I** = she said ignore (derived by the
new model instead); **C** = comparison only (never written as an input).

## 1. Account identity (her sheet)

| Target | Source | Rule |
|---|---|---|
| account key | `Reference` | normalised (strip whitespace, hyphens, commas; upper-case). Primary key of the whole migration. |
| GT grant | `Reference` → `grants.ref` | exact on normalised key; known special-case map for non-standard references (`24/25_…_NNN`); if two GT grants share a reference take the `Active` one and flag `DUP_GT`. |
| school | reference prefix | `TS` → TRINITY, `WS` → WHITGIFT, `OP` → OP_PARTNER, `24/25_Trinity School_…` → TRINITY. Cross-check with the School column; mismatch → flag `SCHOOL_MISMATCH` (one known: an OP reference filed under Whitgift in GT). |
| award fund | School column suffix | S7. OP → JWF (C10). |
| bursary type | `Bursary Type` | Rolling-over → `ROLLING_OVER`; New award → `NEW`; Pastoral Boarder → `NEW` + PB handling. |
| 2026-27 school year | column G | integer 6–13 → `EntryYearGroup` `Y6`…`Y13`. Compare with GT's `SchoolYear`; differs → flag `YEAR_MISMATCH` (her sheet wins once she confirms). |
| pupil surname, first name | `Reference` tail "SURNAME, First names" | split on the first comma; surname → title case with particle rules (§2); if no comma (non-standard refs) parse from the pupil-name column and flag `NAME_PARSE`. |
| pupil DOB | GT grant / applicant child record | optional; absent → NULL. Twins/same-name siblings under one lead need it: if two accounts under one lead share `childName` and both lack DOB → flag `TWIN_KEY`. |

## 2. Lead applicant (GT primary contact, email from her sheet)

| Target | Source | Rule |
|---|---|---|
| email | her sheet | trim, strip embedded tabs/newlines (one cell has them), lower-case for matching, keep as typed otherwise. Differs from GT → flag `EMAIL_DIFF` (informational: her sheet wins, S3). |
| title | GT contact | one of Mr/Mrs/Ms/Miss/Dr/Prof/… else NULL. Never guess. |
| first name, surname | GT contact; fallback: parse her "Lead Applicant" cell | if GT holds only an initial, keep the initial and flag `NAME_INITIAL`. |
| phone | GT contact mobile, else landline | digits and leading `+` only. |
| address | GT contact | `addressLine1/2`, `town`, `postcode` (upper-case, single space before the inward code). |
| capitalisation | all name/address strings | if a string is ALL CAPS or all lower → title case, preserving: `Mc`/`Mac` + capital, `O'` + capital, hyphenated parts, and lower-case particles (`de`, `van`, `von`, `da`, `di`, `bin`, `al-`) only when GT had them lower-case somewhere. Mixed-case strings are **left exactly as they are**. Every changed string is listed in the reconciliation pack ("before → after") for her eye. |
| same lead, several children | email | one auth user + one profile; one contact per child. If one email maps to two *different* GT family codes → flag `LEAD_MULTI_FAMILY` (one known case). |
| PB accounts | her sheet | lead = "Fees team" + the Foundation mailbox. C3: profile only, no auth user. |

## 3. Assessment inputs — income (GT tab "INCOME SECTION": **T**, reliable)

Each earner becomes one `AssessorIncomeRecord` (`src/types/assessment-v2.ts`).
A second earner record is created only if any Second-Earner field is non-zero.

| GT control | Target path in `incomeDetail` | Notes |
|---|---|---|
| First/Second Earner yearly net pay | `employed.annualSalaryPaye` | |
| First/Second earner net salary if self employed/director | `selfEmployed.grossSalaried` | Her note: often the only SE field filled; "just the same when it comes to the assessment". |
| First/Second earner net dividends | `selfEmployed.dividends` | |
| First/Second Earner yearly company profits | `selfEmployed.otherInvestmentIncome` | Pin to confirm in M2. |
| First/Second Earner pension amount as stated on P60 | `retired.privatePension` | |
| First/Second Earner yearly pension payments | `retired.statePension` | Pin to confirm. |
| First/Second Earner tax credits | `benefits.childWorkingTaxCredit` | |
| First/Second Earner yearly hb or uc entitlement | `benefits.universalCredit` | GT does not split HB from UC. |
| First/Second Earner yearly jsa | `unemployed.jsa` | |
| First/Second Earner yearly disability allowance | `benefits.pipOrDla` | |
| First/Second Earner yearly income support | `benefits.other` | **C6:** on new-application assessments child benefit may be in here. Flag `CHB_IN_IS` when type = New award and value > 0. |
| First/Second Earner other benefits | `benefits.other` (added) | |
| First/Second earner child benefits | `benefits.childBenefit` | **Added 24 Sep — missing from the first draft.** Lower-case "earner" in GT. 197 non-zero. Without it income matched GT on 71/270; with it, 270/270. |
| First/Second earner housing benefits | `benefits.housingBenefit` | **Added 24 Sep.** Part of GT's income total. |
| YEARLY CHILD MAINTENANCE SUPPORT (court settlements section) | `divorcedSeparated.maintenanceReceived` on earner 1 | |
| FRIENDS & FAMILY ARRANGEMENTS (+ total) | `thirdParty.incomeSupportReceived`, divisor 1 | Her note: help from friends and family "may show there". |
| ADD BACK IN THE ADDITIONAL YEARLY PROPERTY INCOME | `selfEmployed.propertyIncome` on earner 1 | Not part of GT's own income total (verified 24 Sep), so the one account carrying it shows as an income difference in the report. |
| **Rent-free add-back** (+12,000 / +15,000) | **not income** → `rentAddBackType = FULL_RENT_FREE` | **C5.** The control she means is pinned in M2 (candidates: "ADD AVERAGE YEARLY RENTAL INCOME ON ZOOPLA", the friends-and-family block). Detection rule: a value of exactly 12000 or 15000 in the pinned control. Always flagged `RENT_FREE`. **Pinned 24 Sep:** the marker sits in First/Second Earner yearly income support and *is* inside GT's income total, so treating it as rent-free takes it out of income. The Zoopla control is not part of GT's income total. |
| TOTAL HOUSEHOLD NET INCOME (pre Court Settlement) / TOTAL HOUSEHOLD NET INCOME | **C** | Reconciliation anchor (§7, check R1). "May include adjustments for when the household is living rent-free." **Verified 24 Sep:** pre-court = every earner control incl. child and housing benefit (270/270); post-court = that + YEARLY CHILD MAINTENANCE SUPPORT (270/270). R1 compares with post-court. |
| CEO's discretionary adjustment (current / next) | `manualAdjustment` = 0 | GT's final-award tab is ignored (S14). Non-zero → flag `CEO_ADJ` for her information. |

`employmentStatus` on each `AssessmentEarner` row: derived by the app's own
`dominantEmploymentStatus(record)`; do not hand-roll it.

## 4. Assessment inputs — assets, living costs, debt

| GT control (tab) | Trust | Target | Rule |
|---|---|---|---|
| ENTER A FIGURE BETWEEN 1 AND 6 / FAMILY TYPE CATEGORY (net assets) | **T** "same family category logic as in current model" | `familyTypeCategory` | 1–6. Her sheet's `Family Type` is the cross-check; differ → flag `FAMILY_TYPE_DIFF`. The new system has 12 family types in reference data: confirm in M2 that 1–6 still key the v2 lookups (they do in `AssessmentV2Input`). |
| CASH SAVINGS AT THE BANK | **T** "fine to migrate" | `property.cashSavings` | |
| TOTAL IN ISAS, PEPS, SHARES | **T** | `property.isasPepsShares` | |
| NUMBER OF SCHOOLING YEARS LEFT | **I** "derived by default from current school year" | `schoolingYearsRemaining` | central helper from the 2026-27 school year; OP capped at Year 11 (a Year 10 OP pupil has 1 year left after this one). |
| CAR SECTION / ENTER NUMBER OF CARS | **T** for yes/no only | `usesCar = cars > 0` | the deduction amount is **I**. |
| — | – | `usesPublicTransport` | not in GT. Default `false`; flag nothing (model-neutral default); listed in the pack header as an assumption. |
| APPROX VALUE OF OWNED HOME / OUTSTANDING MORTGAGE BALANCE | **T** "first part is always the family home" | `propertyAssets.home.{value, mortgageBalance}` | both zero → `portfolioType = RENTING`. Value with no mortgage → `rentAddBackType = FULL_MORTGAGE_FREE` (**C16**, added 24 Sep). |
| TOTAL VALUE OF ANY OTHER PROPERTIES / OTHER OUTSTANDING MORTGAGE BALANCES | **T but amalgamated** | one second property → `propertyAssets.second`, `portfolioType = DOUBLE`; a portfolio → `propertyAssets.other`, `MULTIPLE` | **C7:** any non-zero → flag `OTHER_PROPERTY`; she decides second-vs-multiple per account before it loads. **Corrected 24 Sep:** the engine reads `DOUBLE` from `second`, not `other`. |
| Total Equity | **C** "totally reliable" | comparison | check R2. |
| DEDUCT ANNUAL COUNCIL TAX, sub-totals, deductions | **I** | – | new model derives. `councilTaxSupport = false`, no overrides. |
| NUMBER OF PEOPLE IN THE HOUSEHOLD / HouseholdOccupants | **C** | – | "we don't have adults vs kids, only the total"; the new model keys on family type. Comparison only. |
| OTHER CHILDREN ALREADY AT A JWF SCHOOL: child 1 / child 2 name + fees | name **T**, fee **I** | `siblingDetails[].name` only | **S22:** transpose the first name; leave `school` and `netPayableFees` blank for the assessor; create no sibling link; pass no sibling fees to the engine. Flag `SIBLING_PRESENT` so the reconciliation report can explain a recommendation that sits higher than GT's. |
| Insurance to pay school fees total | **T** | `feeInsuranceAnnual` | |
| ENTER TOTAL CC DEBT BALANCE (debt tab) | **T** "reliable" | `debts.creditCards` | |
| ENTER YEARLY LOAN REPAYMENTS … | **T** | `debts.loans` | **Unit mismatch, confirmed.** GT holds a *yearly repayment* (or the remainder if under 12 instalments); the new model sums outstanding *balances* and spreads them over the schooling years (`src/lib/assessment/v2/debt.ts:43`). Any non-zero value → informational flag `DEBT_UNITS`; conversion rule per C12. |
| ENTER YEARLY LEASE REPAYMENTS … | **T** | `debts.leaseBalances` | same caveat. |
| Derived Yearly Debt Repayments, months-before field | **I** | – | |
| DEBT SITUATION WITH THE FOUNDATION: yes/no, total debt | **T** "reliable data" | `behindOnFees`, `debts.schoolFeesOwedOrOther` | |
| Risk profile, ratios, lifestyle formula, break-even level | **I** | – | recomputed. GT values are **C** via her sheet. |
| "Add any comments which support the figures…" (bursary-impact tab) | **T** | `synopsis` | verbatim; see §5 for the footer. |
| SELECT SCHOOL | **T** "fine to use, although the reference will be used" | cross-check only | |
| MAJOR INCOME / ASSETS CHANGE | superseded | reason codes 27 / 35 | taken from **her sheet's** columns, not GT. |
| YEAR ON YEAR BURSARY AWARD CHANGE DUE TO | **T** with crosswalk | reason codes | §6. |
| Credit / land-registry / social-media check requested | unplaced | synopsis footer | C9. |
| Assessment carried out by / completed on | **T** | `completedAt`, `submittedAt`; assessor name → synopsis footer | |
| Everything on "FINAL BURSARY & SCHOLAR. AWARDS" | **I** | – | S14. |

## 5. Synopsis composition

```
<GT free-text comments, verbatim>

— Migrated from Grant Tracker on <date>. GT assessment completed <date> by <assessor name>.
  Checks requested in GT: credit <Y/N>, land registry <Y/N>, social media <Y/N>.
  Figures recalculated by the current model from GT inputs; award and payable fees as confirmed by the Head of Fees & Bursaries.
```

The synopsis holds health and family notes. It never appears in logs, packs sent
by email, check output, or this repo.

## 6. Reason-code crosswalk (C8, proposed)

GT's old numbering → the new list's display number (DB code = 200 + display number
after PR-A; resolve DB ids by label at load time, never by hard-coded number).

| GT value (count on the 273 sheet) | New code |
|---|---|
| 1 - No real change (131) | 2 No real change |
| 6 - Salary increase (55) | 14 Salary increase |
| 77 - Self-employed net profit increase (32) | 9 |
| 28 - Reduced net self-employed profit (18) | 10 |
| 14 - Sudden unemployment (16) | 8 |
| 15 - New job and increased pay (13) | 16 |
| 16 - New job and decreased pay (8) | 15 |
| 4 - Increased savings (11) | 17 |
| 34 - Reduced savings (2) | 18 |
| 17 - Increase in Benefits (9) | 12 |
| 35 - Stopped qualifying for some benefits (5) | 13 |
| 19 - Bonus change year on year (5) | 11 |
| 18 - Inheritance (3) | 19 |
| 8 - Additional family member since last year (2) | 3 |
| 9 - Divorce or separation (2) | 5 |
| 11 - Serious Illness (2) | 7 Severe Illness |
| 3 - New property asset acquired (2) | 29 |
| 2 - Property asset has increased in value (1) | 30 |
| 32 - Other (3) | 43 Other |
| **29 - New asset acquired since last year (2)** | **no clean match** → her ruling (29 or 32?); default 43 + flag |
| n/a (52: the 50 new awards + 2 PB) | 1 No year on year comparison, first assessment |
| her sheet: Major Income Change = Yes (75) | + 27 |
| her sheet: Major Assets Change = Yes (3) | + 35 |

Cells hold several codes separated by `,` and in one case `;`. Split on both.
Blank major-change cells (7 / 5) → no code, no flag.

## 7. Reconciliation checks computed per account (feed the M5 pack)

| ID | Check | Tolerance | On failure |
|---|---|---|---|
| R1 | Sum of mapped earner income (before the model's own adjustments) vs her sheet's "Total Household Net Income" | £1 | flag `INCOME_DELTA` with the difference; the usual causes are C5 and C6 |
| R2 | home + other equity vs her sheet's "Total Property Assets Equity"; savings vs "Total Financial Assets Equity" | £1 | flag `EQUITY_DELTA` |
| R3 | Her sheet's arithmetic: `payable = max(0, fees − fees×schol% − award) × (1 + VAT)` with VAT 20% (0% OP); `monthly = payable / 12` | £1.50 | flag `SHEET_ARITH`. As profiled on 19 Sep: 271 of 273 reconcile; **2 do not** and go to her in M2. |
| R4 | Recalculated income category / property category vs her sheet's GT categories | exact | informational column in the pack, not a flag (the model changed; differences are expected) |
| R5 | Gap = confirmed − recommended | – | bucketed: < £100, £100–£1,000, > £1,000, and sign; drives the gap-code column (S19) |
| R6 | Fees on her sheet vs `school_fees` for 2026/27 (Trinity 25,390; Whitgift 26,175) | exact | flag `FEE_DIFF` (none expected; OP exempt) |

## 8. Flags — the complete list

Blocking flags hold an account back from the load phase named until resolved in
`decisions.json`. Informational flags appear in packs only.

| Flag | Blocks | Resolved by |
|---|---|---|
| `NO_GT_MATCH`, `DUP_GT`, `GT_NOT_ACTIVE`, `NO_2026_REVIEW`, `SUMMARY_ONLY` | assessments | C2 |
| `YEAR_MISMATCH`, `SCHOOL_MISMATCH` | accounts | C2 |
| `SHEET_ARITH` | assessments | C2 |
| `TWIN_KEY`, `NAME_PARSE` | accounts | Brian/CP |
| `LEAD_MULTI_FAMILY` | identities | CP |
| `RENT_FREE`, `CHB_IN_IS`, `OTHER_PROPERTY` | assessments | C5–C7 |
| `SIBLING_PRESENT` | nothing (informational; explains a higher recommendation) | S22 |
| `PB_NO_PARENT` | identities (PB only) | C3 |
| `DEBT_UNITS` | nothing: C12 is one global rule, not a per-account ruling; the default applies until she changes it, and a changed rule re-runs the build | C12 |
| `EMAIL_DIFF`, `NAME_INITIAL`, `FAMILY_TYPE_DIFF`, `CEO_ADJ`, `INCOME_DELTA`, `EQUITY_DELTA`, `FEE_DIFF`, `REASON_UNMAPPED` | nothing (informational; `INCOME_DELTA` > £500 escalates to blocking) | pack review |
