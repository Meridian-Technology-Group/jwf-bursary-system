---
title: "Epic 14 — field map: workbook ⇄ v2 engine / UI (WP-C0)"
status: reference
opened: 2026-08-16
depends_on:
  - ./source-materials/assessment-model-requirements-2026-08-16.md
related:
  - ./epic-14-implementation-plan.md   # C-wave briefs build against this map
---

# Epic 14 field map — workbook ⇄ engine/UI

One row per workbook row (from the committed extraction), mapped to the v2
engine (`src/lib/assessment/v2/`) or an existing form/DB field, with the
fill mode the C-wave UI must implement and a status:

- **exists** — a 1:1 engine input/output or stored field already carries it.
- **presentation-only gap** — the value exists; only the rendering/label/
  placement changes (the C-wave's bread and butter).
- **no engine source** — no computation or storage backs the row. Per LA-8
  these render as display/manual cells wired to NO maths, and are listed in
  §LA-8 for Brian → Charlotte sign-off. **Never implement new maths (D14-4).**

Engine references use the workbook's own cell keys (C40, C56…, as carried in
the v2 module doc comments). Labels in the UI are Charlotte's **verbatim**
(including "SILBINGS", "EESA", "STUCTURE"); the `Engine / storage` column
uses internal names.

Fill-mode legend (workbook terms): `autofill` = system-supplied, editable
unless marked hidden · `AUTO` / `AUTO FILLED …` = computed, read-only ·
`manual fill` / `manual edit` = assessor-entered.

---

## Sheet 1 · PART 1 — BURSARY RECIPIENT'S & FAMILY DETAILS
Target: **ASSESSMENT MODEL (1-4)** tab, Part 1 table (WP-C4). 11 rows.

| Workbook row | Fill mode | Engine / storage | Status |
|---|---|---|---|
| Bursary recipient's First name | autofill, displayed | `Application` child first name (applicant-data) | exists |
| Bursary recipient's Surname | autofill, displayed | `Application` child surname | exists |
| Bursary award year of entry: | manual edit (LA-5: prefilled-but-editable) | `Application.entryYear` / `entryYearGroup` (set at invitation, Epic 13 D1) | exists |
| Bursary recipient's Scholarship | manual edit | nearest: `Assessment.scholarshipPct` (award-side input, C164). Part 1 wants a recipient-level scholarship note | **no engine source** (as a Part-1 field; see LA-8 №1) |
| Bursary recipient's sibling 1 at the school | manual edit | none — sibling *names* are not stored; only `siblingPayableFees[]` (C152) on the award side | **no engine source** (LA-8 №2) |
| Bursary recipient's sibling 2 at the school | manual edit | as above | **no engine source** (LA-8 №2) |
| Bursary recipient's sibling 3 at the school | manual edit | as above | **no engine source** (LA-8 №2) |
| Family category | manual selection, dropdown | `Assessment.familyTypeCategory` (1–6; keys every reference lookup) | exists |
| Remaining years at the school | manual edit (note: prefill-from-engine per extraction note / AE-11) | `Assessment.schoolingYearsRemaining` (engine input; prefill derivation kept — sanctioned autofill) | exists |
| Number of schooling age children | manual edit | `schoolAgeChildrenCount` (engine input; defaults from `familyCategoryMetas` when unset) | exists |
| Annual school fees | autofill, **hidden** | `annualFees` (engine input C151, from `school_fees` reference) — feeds the engine, not displayed | exists |

## Sheet 1 · PART 2 — HOUSEHOLD INCOME
Target: **ASSESSMENT MODEL (1-4)** tab, one two-column (Parent 1 · Parent 2)
table (WP-C5). Storage stays the per-earner `AssessorIncomeRecord`
(`assessment_earners.income_detail`); every row binds 1:1 per column.

| Workbook row (status block → row) | Engine input (`AssessorIncomeRecord`) | Status |
|---|---|---|
| IF UNEMPLOYED & NOT ON BENEFITS → NO CHANGE (0) | none — informational row, no value cell in the engine | presentation-only gap (render as an inert `0` row) |
| IF PAYE STATUS → ADD YEARLY NET PAY | `employed.annualSalaryPaye` | exists |
| IF SELF-EMPLOYED & A DIRECTOR → ADD NET SALARY | `selfEmployed.grossSalaried` | exists |
| → ADD NET DIVIDENDS AFTER TAX | `selfEmployed.dividends` | exists |
| → ADD PROPERTY INCOME AFTER TAX | `selfEmployed.propertyIncome` | exists |
| → ADD INVESTMENT / OTHER INCOME AFTER TAX | `selfEmployed.otherInvestmentIncome` | exists |
| IF SELF-EMPLOYED & A PARTNER OR SOLE TRADER → ADD YEARLY COMPANY NET PROFITS AFTER TAX | none — the engine has no separate sole-trader-profits input (the four `selfEmployed` fields are the whole block) | **no engine source** (LA-8 №3) |
| IF ON BENEFITS → ADD YEARLY UNIVERSAL CREDIT | `benefits.universalCredit` | exists |
| → ADD YEARLY HOUSING BENEFITS | `benefits.housingBenefit` | exists |
| → ADD YEARLY CHILD BENEFITS | `benefits.childBenefit` | exists |
| → ADD TAX CREDITS (WORKING & CHILD) | `benefits.childWorkingTaxCredit` | exists |
| → ADD YEARLY INCOME SUPPORT OR EESA | `benefits.esa` | exists |
| → ADD YEARLY DLA | `benefits.pipOrDla` — **the engine holds ONE combined PIP-or-DLA input; the workbook has two rows** | **split has no engine source** (LA-8 №4) |
| → ADD YEARLY PIP | see above | see above |
| → ADD YEARLY CARER'S ALLOWANCE | `benefits.carersAllowance` | exists |
| → ADD YEARLY CHILDCARE SUPPORT | `benefits.childcareSupport` | exists |
| → ADD YEARLY OTHER BENEFITS | `benefits.other` | exists |
| IF UNEMPLOYED/ IN BETWEEN ROLES → ADD NET FINAL SALARY STATED ON P45 | `unemployed.finalGrossPay` (label verbatim; field name says gross — same cell) | exists |
| → ADD REDUNDANCY/ SEVERANCE PAY | `unemployed.redundancy` | exists |
| → ADD JSA SUPPORT | `unemployed.jsa` | exists |
| → ADD STUDENT SUPPORT | `unemployed.grantSupport` | exists |
| → ADD PARENTAL/ADOPTION/SICKNESS NET PAY | `unemployed.leavePay` | exists |
| IF RETIRED → ADD YEARLY STATE PENSION | `retired.statePension` | exists |
| → ADD YEARLY PRIVATE PENSION/ OTHER PLAN | `retired.privatePension` | exists |
| IF SEPARATED/DIVORCED → ADD YEARLY CHILD MAINTENANCE | `divorcedSeparated.maintenanceReceived` | exists |
| → ADD EARNED INCOME PORTION FROM NEW SPOUSE IF REMARRIED | `divorcedSeparated.newSpouseIncomePortion` (assessor-only extra) | exists |
| IF RECEIVING SUPPORT FROM FRIENDS/FAMILY/OTHER 3RD PARTY → ADD ADJUSTED LAST 12 MONTHS' RECEIVED CASH SUPPORT/NBER OF KIDS | `thirdParty.incomeSupportReceived` ÷ `thirdParty.numberOfKidsDivisor` | exists (two inputs render for one workbook row: support £ + kids divisor) |
| HOUSEHOLD'S OVERALL NET INCOME (AUTO — sum of all entries) | `calculateHouseholdNetIncome` (C40) = earner aggregate + `manualAdjustment`, floored at £0 | exists — the Epic 13 C2 manual-adjustment line stays visible beside the total (plan C5 constraint) |

## Sheet 1 · PART 3 — NOTIONAL SPEND BENCHMARKING
Target: **ASSESSMENT MODEL (1-4)** tab (WP-C6). Computed cells come from
`calculateNotionalSpend` (`NotionalSpendLine[]` in workbook row order).

| Workbook row | Fill mode | Engine source | Status |
|---|---|---|---|
| SELECT FAMILY STUCTURE (6 options) | selector | mirrors Part 1's `familyTypeCategory` — display-back per workbook note | exists |
| FAMILY CATEGORY | AUTO FILLED NUMBER | `familyTypeCategory` (from Part 1 selection) | exists |
| DEDUCT NOTIONAL RENT | AUTO | line `rent` (C56) | exists |
| ADD BACK IN NOTIONAL RENT APPLIED (mortgage-free / rent-free / lower-rent 25%) | manual fill | `rentAddBackType` (NONE / FULL_MORTGAGE_FREE / FULL_RENT_FREE / PARTIAL_LOWER_RENT) → line `rentAddBack` (C57) | exists (input is an enum select, not a free number) |
| ADD BACK NOTIONAL RENT (two-property conditions) | manual fill | `multiPropertyRentAddBack` boolean → line `multiPropertyRentAddBack` (C58); the three OR-conditions are helper text (CALC-A7) | exists |
| DEDUCT ANNUAL COUNCIL TAX | AUTO | line `councilTax` (C59) | exists |
| ADD BACK IN COUNCIL TAX NOTIONAL (full support) | manual fill | `councilTaxSupport` boolean → line `councilTaxAddBack` (C60) | exists |
| DEDUCT NOTIONAL ESSENTIALS | AUTO | line `essentials` (C62) | exists |
| DOES THE FAMILY USE A CAR? | manual fill | `usesCar` boolean | exists |
| IF YES, DEDUCT NOTIONAL CAR SPEND | AUTO | line `car` (C65/66) | exists |
| DOES THE FAMILY USE PUBLIC TRANSPORT? | manual fill | `usesPublicTransport` boolean | exists |
| IF YES, DEDUCT NOTIONAL PUBLIC TRANSPORT SPEND | AUTO | line `publicTransport` (C67/68) | exists |
| DEDUCT NOTIONAL JWF BURSARY RECIPIENT ALLOWANCE | AUTO | line `jwfAllowance` (C70) | exists |
| ENTER TOTAL CASH HELD | manual fill | `cashSavings` (C72) | exists |
| ENTER TOTAL SAVINGS | manual fill | `isasPepsShares` (C73) | exists |
| TOTAL CASH & SAVINGS | AUTO TOTAL | `cashSavings + isasPepsShares` (simple render-side sum of the two inputs above — no new engine value) | exists |
| TOTAL NUMBER OF CHILDREN OF SCHOOL AGE | AUTO (from Part 1) | `schoolAgeChildrenCount` (display-back) | exists |
| NUMBER OF SCHOOL YEARS LEFT FOR THE BURSARY RECIPIENT | AUTO (from Part 1) | `schoolingYearsRemaining` (display-back) | exists |
| ADJUSTED SAVINGS TOTAL | AUTO CALCULATION | `adjustedSavings` (C77, `calculateDerivedSavings`) | exists |
| DEDUCT NOTIONAL SAVINGS | AUTO | line `notionalSavingsBenchmark` (C78) | exists |
| SAVINGS CUSHION ALLOWANCE | AUTO | `SAVINGS_CUSHION` exists as reference data (`NotionalCostConfig`) but **no engine computation reads it** — it can be *displayed* from the reference bundle, but it feeds nothing | **no engine source** (LA-8 №5 — display-only from reference data) |
| SAVINGS TEST NUMBER | AUTO | `savingsTestNumber` (C80 — adjustedSavings − debtRepayments − savings benchmark, signed) | exists |
| IF SAVINGS TEST NUMBER IS POSITIVE, ADD IT IN | AUTO | line `savingsTestAddBack` (C81) | exists |
| IF THE APPLICANT HAS INSURED SCHOOL FEES PAYMENT, ADD YEARLY INSURED TOTAL BACK IN | manual fill | `feeInsuranceAnnual` → line `feeInsuranceAddBack` (C83) | exists |
| TOTAL DEDUCTED NOTIONAL SPEND | AUTO | `totalNotionalSpend` (C85) | exists |
| HOUSEHOLD'S NET DISPOSABLE INCOME AFTER NOTIONAL SPEND | AUTO | `ndiAfterNotionalSpend` (C87) | exists |
| HOUSEHOLD'S INCOME CATEGORY IS: | AUTO FILLED NUMBER | `incomeCategory` (Appendix C.1) | exists |

## Sheet 1 · PART 4 — HOUSEHOLD'S ASSETS CATEGORIES
Target: **ASSESSMENT MODEL (1-4)** tab (WP-C6). Sources:
`PropertyAssetsRecord` + `profiling.ts`.

| Workbook row | Fill mode | Engine source | Status |
|---|---|---|---|
| Property asset structure selector (NO PROPERTY, RENTING / SINGLE / TWO / MULTIPLE) | selector | `portfolioType` (`RENTING`/`SINGLE`/`DOUBLE`/`MULTIPLE`) | exists |
| TOTAL FAMILY HOME MARKET VALUE | manual fill | `propertyAssets.home.value` | exists |
| TOTAL FAMILY HOME MORTGAGE BALANCE | manual fill | `propertyAssets.home.mortgageBalance` | exists |
| TOTAL SECOND PROPERTY MARKET VALUE | manual fill | `propertyAssets.second.value` | exists |
| TOTAL SECOND PROPERTY MORTGAGE BALANCE | manual fill | `propertyAssets.second.mortgageBalance` | exists |
| TOTAL OTHER PROPERTY (IES) MARKET VALUE | manual fill | `propertyAssets.other.value` (aggregate) | exists |
| TOTAL OTHER PROPERTY (IES) MORTGAGE BALANCE | manual fill | `propertyAssets.other.mortgageBalance` (aggregate) | exists |
| HOUSEHOLD'S TOTAL PROPERTY VALUE | AUTO | `propertyEquityTotals(...).totalValue` | exists |
| HOUSEHOLD'S EQUITY ON FAMILY HOME | AUTO | `propertyEquityTotals(...).homeEquity` | exists |
| HOUSEHOLD'S EQUITY ON SECOND PROPERTY | AUTO | `.secondEquity` | exists |
| HOUSEHOLD'S EQUITY ON OTHER PROPERTIES | AUTO | `.otherEquity` | exists |
| HOUSEHOLD'S PROPERTY CATEGORY IS: | AUTO | `propertyCategory` (Appendix C.6 matrix, 1–13) | exists |
| HOUSEHOLD'S TOTAL EQUITY HELD ON PROPERTY ASSETS | AUTO | `.totalEquity` | exists |
| HOUSEHOLD'S PROPERTY EQUITY CATEGORY IS: | AUTO | `propertyEquityCategory` (Appendix C.2) | exists |
| HOUSEHOLD'S TOTAL EQUITY HELD ON FINANCIAL ASSETS | AUTO | `netFinancialEquity(cash+isas, debts)` | exists |
| HOUSEHOLD'S FINANCIAL EQUITY CATEGORY IS: | AUTO | `financialEquityLabel` (Appendix C.3 — NB a **text label**, not a number, despite the workbook's "NUMBER") | exists |

## Sheet 1 · "PART 5" — PERSONAL DEBT + LIFESTYLE SQUEEZE (on the model sheet, LA-6)
Target: **ASSESSMENT MODEL (1-4)** tab (WP-C6). Source: `DebtsRecord` + `debt.ts` + `profiling.ts`.

| Workbook row | Fill mode | Engine source | Status |
|---|---|---|---|
| ENTER TOTAL CREDIT CARD DEBT | manual fill | `debts.creditCards` | exists |
| ENTER TOTAL LOAN BALANCES | manual fill | `debts.loans` | exists |
| ENTER TOTAL OWED LEASE BALANCES | manual fill | `debts.leaseBalances` | exists |
| ENTER OWED OTHER SCHOOL FEES BALANCES OR OTHER DEBT | manual fill | `debts.schoolFeesOwedOrOther` | exists |
| NUMBER OF SCHOOL YEARS LEFT FOR THE BURSARY RECIPIENT | manual fill | `schoolingYearsRemaining` (same value as Part 1/3 — display-back here, one storage) | exists |
| DERIVED YEARLY DEBT REPAYMENTS | AUTO | `derivedYearlyDebtRepayments` (C123) | exists |
| YEARLY DEBT EXPOSURE (NETTED OFF YEARLY SAVINGS) | AUTO | `yearlyDebtExposure` (C124) | exists |
| DEBT OVER NET DISPOSABLE INCOME RATIO | AUTO | `debtOverNdiRatio` (C125) | exists |
| Minimum Debt Repayment Duration in months without school fees payments | AUTO | `minRepaymentMonths` (Appendix C.4) | exists |
| DEBT STATUS | AUTO FILLED TEXT | `debtStatusLabel` | exists |
| IS THE FAMILY BEHIND WITH THEIR SCHOOL FEES PAYMENTS? | MANUAL FILL YES/NO | `Assessment.behindOnFees` | exists |
| CALCULATING NDI over NET INCOME % | AUTO % | `lifestyleSqueeze(...).ndiOverIncomePct` | exists |
| CALCULATING (NDI after YEARLY DEBT EXPOSURE) over NET INCOME) LIFESTYLE RATIO % | AUTO % | `.postDebtLifestylePct` | exists |
| SCHOOL FEES USE BENCHMARKING | AUTO | `.feesBenchmarkAmount` (feesBenchmarkPct% × net income, £) | exists |
| LIFESTYLE SQUEEZE AFFORDABILITY RATIO | AUTO % | `.squeezeRatio` | exists |
| LIFESTYLE SQUEEZE AFFORDABILITY STATUS | AUTO TEXT | `.statusLabel` (Appendix C.5) | exists |

## Sheet 2 · BURSARY AWARD (5)
Target: **BURSARY AWARD CALCULATION (5)** tab (WP-C7). Sources: `award.ts`,
`Recommendation`, `reason_codes`.

| Workbook row | Fill mode | Engine / storage | Status |
|---|---|---|---|
| CALCULATING BURSARY AWARD FOR (name) | AUTO TEXT | `Application` child name | exists |
| school (SELECT WHITGIFT OR TRINITY / AUTO) | auto-select | `Application.school` | exists |
| SILBINGS' FEES — ENTER CHILD NAME 1–3 | manual (name text + school select) | none — sibling names/schools are not stored; where a sibling holds a JWF `BursaryAccount` the C7 picker fills them, else manual display cells | **no engine source** for name/school persistence (LA-8 №2); fees column ↓ |
| SILBINGS' FEES — NET PAYABLE FEES (per row) | manual / picker | `siblingPayableFees[]` (engine input C152, priority order) | exists |
| ANNUAL SCHOOL FEES | AUTO | `annualFees` (C151 — shown here; hidden on Part 1) | exists |
| SIBLINGS' NET PAYABLE FEES | AUTO | sum of `siblingPayableFees[]` (render-side; the engine consumes them itemised via sequential absorption) | exists |
| ACTUAL NET REMAINING DISPOSABLE INCOME | AUTO | `actualRemainingDi` (C154) | exists |
| THEORETICAL BENCHMARKING DISPOSABLE INCOME | AUTO | `theoreticalBenchmarkDi` (C156) | exists |
| AFFORDABILITY ADJUSTED DISPOSABLE INCOME | **MANUAL FILL** (workbook) | `affordabilityAdjustedDi` (C158) is **computed** by the engine | exists — **conflict noted**: workbook marks it manual; engine computes it. Render computed (D14-4 forbids new manual override paths; D13-3 forbids per-field overrides). Flag to Charlotte (§LA-8 note A) |
| RECOMMENDED YEARLY PAYABLE FEES - FUTURE YEAR | MANUAL FILL | `recommendedPayableFees` (C160) is computed min-of-three; the *decided* figure lives on `Recommendation` | exists — render computed value + the recommendation flow's decided figure (C7 integrates, not duplicates) |
| SCHOOL FEES NEXT YEAR | AUTO | `Assessment.nextYearAnnualFees` (fee-year resolver) / `nextYearFees` input (C163) | exists |
| % SCHOLARSHIP | MANUAL FILL % | `scholarshipPct` (C164) | exists |
| SCHOLARSHIP VALUE (after VAT) | MANUAL (workbook) | `awardSummary(...).scholarshipValueInclVat` (C165, computed) | exists — same manual-vs-computed note (§LA-8 note A) |
| BURSARY AWARD VALUE (after VAT) | MANUAL FILL | `bursaryAwardAfterVat` (C166, genuinely assessor-entered) | exists |
| PAYABLE SCHOOL FEES NEXT YEAR | MANUAL (workbook) | `awardSummary(...).payableFeesNextYear` (C167, computed) | exists — §LA-8 note A |
| ACADEMIC YEAR | AUTO | `Round.academicYear` | exists |
| School's bursary spend for this pupil (before VAT) | AUTO | `awardSummary(...).bursarySpendBeforeVat` (C169) | exists |
| GAP FROM REC PF TO CONFIRM PF: | computed | `awardSummary(...).gapAmount` (C172 — confirmed − recommended) | exists |
| REASONS FOR GAP | multi-select (9 codes) | `reason_codes` — real list ships in WP-C9 (gap set); multi-select storage on the recommendation/assessment decided in C7/C9 | exists after C9 (data); picker is new UI |
| LAST ASSESSMENT'S PAYABLE FEES | MANUAL FILL | prior `Recommendation`/`ScheduleEntry` for the account — derivable for system years; manual for pre-system years (LA-7) | exists (derived) + manual pre-system cell |
| REASONS FOR YEAR ON YEAR CHANGE: | multi-select (36 codes) | `reason_codes` (YoY set, WP-C9) | exists after C9 |
| ASSESSMENT COMPLETED ON: | dd/mm/yyyy | `Assessment.completedAt` | exists |

## Sheet 3 · ASSESSMENT ADMIN
Target: **ASSESSMENT ADMIN** tab (WP-C8).

| Workbook block | Engine / storage | Status |
|---|---|---|
| Account Synopsis (free text) | `Assessment.synopsis` | exists |
| — alongside: recipient name · Bursary Reference · school · Fees Account Code | `Application` name/reference/school; **Fees Account Code renders `Application.reference`** (`feesAccountCode` dropped, Epic 13 D13-1a) | exists |
| Assessor's wizard — Things to look out for (free text) | `Assessment.watchOutNotes` (CALC-10; surfaced as callout on next assessment) | exists |
| — alongside: recipient's siblings · reference · siblings' school | sibling names/school not stored (see LA-8 №2) | **no engine source** for the sibling columns |
| Year-on-year history table (net income · savings · property equity · debt exposure · deltas · living arrangement · lifestyle squeeze) | system years: prior COMPLETED `Assessment` snapshot columns per `BursaryAccount` (`totalHouseholdNetIncome`/C40, cash+ISAs, `propertyEquity*`, `yearlyDebtExposure`, `rentAddBackType`-ish living arrangement, `lifestyleSqueezeLabel`); deltas render-side. **Pre-system years: manual cells (LA-7)** → C8 adds a JSONB store on `BursaryAccount` (preferred first cut, no new table/RLS) | exists (system years) + additive manual store (pre-system) |
| — "Living arrangement" column | nearest stored signal: `rentAddBackType` / portfolio type; her example values ("rent") suggest a short text — C8 decides derived-vs-manual; if manual → part of the LA-7 JSONB | presentation decision (note B) |
| Payable-fees schedule table (academic year · reason codes · payable fees · Δ · school year · submit-by · application status · assessment status · bursary status) | `ScheduleEntry` (Epic 10) + applications + recommendations + reason-code selections (C9) + submission-deadline resolver; future rows "Scheduled / Not started" | exists (derived; C8 assembles) |

---

## LA-8 list — rows with **no engine source** (render inert, flag for sign-off)

Per LA-8/D14-4 these render as display or manual cells wired to **no
computation**, until Brian/Charlotte confirm intent:

1. **Part 1 "Bursary recipient's Scholarship"** — no recipient-level
   scholarship field outside the award-side `scholarshipPct` (C164).
   Proposed: render a manual text cell (persisted, uncomputed); if Charlotte
   means the scholarship %, C4 can display-back `scholarshipPct` instead.
2. **Sibling names/schools (Part 1 rows 5–7, award-sheet name rows 1–3,
   admin-tab "recipient's siblings" columns)** — the engine stores only
   `siblingPayableFees[]` (amounts). Names/schools need a small additive
   store if they must persist (C7's picker can fill them from sibling
   `BursaryAccount`s where they exist). Proposed: additive JSONB on
   `Assessment` for the three name/school/fees triples, feeding
   `siblingPayableFees[]` — amounts still the only computed part.
3. **Part 2 "IF SELF-EMPLOYED & A PARTNER OR SOLE TRADER → ADD YEARLY
   COMPANY NET PROFITS AFTER TAX"** — no separate engine input; sole-trader
   profits have historically been entered in `selfEmployed.grossSalaried`.
   Rendering an inert row invites double entry. Proposed: bind the row to
   the SAME `grossSalaried` storage with the workbook label, showing one of
   the two rows per earner… **needs Charlotte's confirmation** (or an
   engine change under MSA 9.3 — out of scope).
4. **Part 2 separate "ADD YEARLY DLA" and "ADD YEARLY PIP" rows** — the
   engine holds a single combined `benefits.pipOrDla`. Splitting changes
   stored data (and re-summing changes nothing mathematically, but the
   split is new storage). Proposed: render one combined row (label
   "ADD YEARLY DLA / PIP") until confirmed.
5. **Part 3 "SAVINGS CUSHION ALLOWANCE"** — the reference table carries a
   `SAVINGS_CUSHION` amount per category but **no engine computation reads
   it**; the savings test uses the notional-savings benchmark. It can be
   displayed from reference data as an inert figure. Confirm display-only
   is what she expects.

**Note A (manual-vs-computed conflicts, award sheet):** the workbook marks
AFFORDABILITY ADJUSTED DI, SCHOLARSHIP VALUE and PAYABLE SCHOOL FEES NEXT
YEAR as *manual fill*, but the v2 engine computes all three (C158, C165,
C167) — and per D13-3/D14-4 no per-field overrides of computed cells are
being added. C7 renders them computed. If Charlotte insists on manual entry
for any of them, that is a calculation-behaviour change → MSA 9.3 / Brian.

**Note B (living arrangement column):** short free text in her example
("rent"); C8 may derive from portfolio/rent-add-back or take a manual cell
in the LA-7 JSONB. Cheap either way; C8 decides and records.

---

## Current form fields with NO workbook row (candidates — list only, do not remove)

| Current v2-form field | Where | Recommendation |
|---|---|---|
| `manualAdjustment` + `manualAdjustmentReason` (Epic 13 C2 signed income adjustment) | B. Income entry | **Keep** — plan C5 explicitly keeps the adjustment line visible near the total (zero-income/divorced flows depend on it) |
| "Include a second earner (Parent 2)" toggle | B. Income entry | Keep — the two-column table needs an explicit Parent 2 enable for sole-parent cases |
| `dishonestyFlag` (E. Flags) | E | Keep, relocate — no workbook row; belongs on ASSESSMENT ADMIN (C8) or stays as internal flag. Flag to Brian |
| `secondaryParentOverride` (+ reason) | assessment chrome | Keep — process control, not a workbook cell |
| Live calculation panel (income/NDI/award strip) | form footer | Wrapped behind SEE COMPUTATION (C2, CG-21) |
| Prefill "reported from application" figure blocks | A–D | **Remove in C4** (CG-15/D14-3) — declared values move to the APPLICATION FORM tab |
| `nextYearYearlyPayableFees` / `nextYearMonthlyPayableFees` displays | award area | Keep (recommendation/PDF depend on them); not workbook rows but award-tab-adjacent — C7 places them |

## Parity guarantee (C4–C7)

The C-wave changes **presentation only**: every AUTO cell binds to an
existing orchestrator output (`calculateAssessmentV2`), every manual cell to
an existing input. The parity fixture each C-wave PR must run: same
`AssessmentV2Input` → identical `AssessmentV2Output` before/after (engine
tests untouched, D14-4).
