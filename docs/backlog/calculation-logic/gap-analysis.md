# Assessment Model Gap Analysis

**Canonical source:** `Assessment Model Notional Calculations.xlsx` (this folder) — the client's *full* assessment model. The system's current engine was built from an **abridged** version of this model, so this document maps every tab of the full workbook against the built code and database and records every gap.

**Reviewed:** 2026-07-10.
**Workbook tabs reviewed:** `SUMMARY`, `ASSESSMENT PAGE`, `LINKED NOTIONALS`, `PROFILING CATEGORIES`, `Council Tax` (all 5).
**Code reviewed:** `src/lib/assessment/*` (engine), `prisma/schema.prisma` (Assessment / AssessmentEarner / AssessmentProperty / Recommendation / reference tables), `prisma/seed-data/*`, assessor UI (`src/components/admin/assessment-form.tsx`, `earner-form.tsx`, `recommendation-form.tsx`), parent portal capture (`src/lib/portal/income-model.ts`, `src/lib/schemas/assets-liabilities.ts`).

---

## 1. Executive summary

The full workbook is a substantially bigger model than what is built. The built engine (`src/lib/assessment/`) implements a 4-stage abridged pipeline:

```
Stage 1  income = Σ(netPay + dividends + SE profit + pension + benefitsIncluded) per earner
Stage 2  netAssets = income − notionalRent (+back if mortgage-free) + additionalPropertyIncome − councilTax + derivedSavings
Stage 3  HNDI = netAssets − utilityCosts − foodCosts
Sibling  HNDI −= Σ sibling payable fees
Stage 4  requiredBursary = clamp(annualFees − HNDI, 0, annualFees)
Fees     payable = (gross − scholarship% − bursary) + VAT, ÷12, ± manual adjustment
```

The full model differs in **three structural ways**, not just in missing fields:

1. **More notional deductions, with conditional add-backs.** The workbook deducts six notional blocks (rent, council tax, essentials, transportation, JWF recipient allowance, savings) with rule-driven add-backs (mortgage-free, lower-rent 25%, multi-property, council-tax support, school-fees insurance). The system deducts only rent + council tax + utilities + food, with a single mortgage-free add-back.
2. **A profiling layer that doesn't exist in the system.** Income category, property category, property-equity category, financial-equity category, a full personal-debt module (debt/NDI ratio → credit-risk status), and the lifestyle-squeeze affordability ratio are all absent or reduced to manual free-text/flag fields.
3. **A different award formula.** The workbook recommends payable fees as **min(Actual, Theoretical benchmark, Affordability-adjusted)** — three independently computed disposable-income figures. The system computes only (an equivalent of) the "Actual" leg. The theoretical-benchmark grid and the affordability %-of-income grid (LINKED NOTIONALS table 8) are entirely missing.

A mitigating finding: **the rebuilt parent form (Epic 02) and assets/liabilities section already capture nearly all raw inputs the full model needs** (status-driven income sub-tables, property values & mortgage balances incl. other properties, cash/investments, itemised personal debt, car/public-transport use). The gaps are concentrated in the **assessor-side data model, reference tables, and calculation engine** — the data pipeline from parents largely exists.

---

## 2. What the workbook contains (tab by tab)

### 2.1 SUMMARY
Overall logic statement: compute the **Household's Overall Net Income** for a tax year, then run a **notional-spend benchmarking** exercise keyed on family size, using lookup tables (`LINKED NOTIONALS`) that auto-populate fields from assessor-entered numbers.

### 2.2 ASSESSMENT PAGE (the assessor worksheet, rows 2–252)
- **Income section (rows 2–40)** — per earner (First/Second), by status:
  - *Unemployed & not on benefits*: £0.
  - *PAYE*: yearly net pay.
  - *Self-employed & director*: net salary + net dividends + **property income after tax** + **investment/other income after tax**.
  - *Self-employed partner/sole trader*: yearly company net profits after tax.
  - *On benefits*: Universal Credit, Housing Benefit, Child Benefit, Tax Credits (working & child), Income Support/ESA, DLA/PIP, Carer's Allowance, Childcare Support, Other — each annualised from its payment frequency (HB 4-weekly, ESA/JSA fortnightly, UC/PIP/Carer's/DLA monthly, CHB weekly or 4-weekly).
  - *Unemployed / in between roles*: net final salary on P45, redundancy/severance, JSA, student support, parental/adoption/sickness net pay.
  - *Retired*: state pension + private pension/other plan.
  - *Separated/divorced*: yearly child maintenance + **earned-income portion from new spouse if remarried**.
  - *Third-party support*: adjusted last-12-months' received cash support ÷ number of kids.
  - → `C40` **Household's Overall Net Income** (auto).
- **Notional spend benchmarking (rows 43–87)**:
  - Family structure dropdown (6 types) → **family category** 1–6 (table 1).
  - `C56` deduct **notional rent** (table 2). `C57` add back: full notional if mortgage-free/rent-free, **25% of notional if family pays lower-than-notional rent**. `C58` add back notional rent if household owns ≥2 properties AND (property income not main income, OR stable PAYE medium-high income, OR cash drawdown not solely for debt consolidation).
  - `C59` deduct **annual council tax** (table 3, Band D). `C60` add back if household receives **full council tax support**.
  - `C62` deduct **notional essentials** (table 4 = utilities + internet + food + household items/toiletries/clothing + eating out + sports & leisure).
  - `C65–C68` **transportation**: car yes/no → deduct notional car spend (table 5); public transport yes/no → deduct notional public-transport spend.
  - `C70` deduct **notional JWF Bursary Recipient Allowance** (table 6, £1,700 = uniform £275 + lunches £825 + trips £600).
  - `C72–C81` **savings adjustment**: total cash + total savings → `C74`; school-age children count (auto from table 7 by family category) and school-years-left (manual) → `C77` adjusted savings = C74 ÷ children ÷ years; `C78` deduct **notional savings benchmark** (−£1,500 × family members); `C80` **savings test number** = C77 − C123 (derived yearly debt repayments) + C78; `C81` add it **only if positive**.
  - `C83` **school-fees insurance**: if the applicant insured school-fee payments, add yearly insured total back in.
  - `C85` total deducted notional spend = Σ above; `C87` **Household's NDI after Notional Spend** = C40 + C85.
- **Profiling (rows 90–135)**:
  - `C90` **income category** — lookup C40 in PROFILING table 1.
  - `C92–C108` **property assets**: structure dropdown (renting / single / two / multiple), market value + mortgage balance for family home, second, other properties; derived total value, per-property equity; **property category** from PROFILING table 2 matrix (value band × mortgaged-vs-owned-outright → categories 1–13).
  - `C110–C112` total property equity → **property-equity category** (PROFILING table 3, 1–12).
  - `C114–C116` financial equity = cash+savings − personal debts → **financial-equity category** (PROFILING table 4, text labels "in debt" … "stratospheric savings").
  - `C118–C127` **personal debt module**: credit cards, loans, lease balances, owed school fees/other debt; school-years-left; `C123` derived yearly debt repayments = Σ debts ÷ years; `C124` yearly debt exposure (netted off yearly savings); `C125` **debt-over-NDI ratio**; `C126` minimum debt-repayment duration in months (PROFILING table 5); `C127` **debt status** text ("ZERO DEBT, NO CREDIT RISK" → "VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 4").
  - `C129` behind with school-fee payments? (manual yes/no).
  - `C131–C135` **lifestyle-squeeze affordability**: NDI/net-income %; (NDI − debt exposure)/net-income %; school-fees-use benchmark (PROFILING table 6: % of net income by income category); **lifestyle squeeze ratio** = benchmark ÷ (NDI − debt exposure); **status** from PROFILING table 7 ("AFFORDABLE, NO IMPACT" → "SEVERE LIFESTYLE SQUEEZE, SET TO FAIL QUICKLY").
- **Bursary award calculation (rows 138–180)**:
  - School selector (Whitgift/Trinity); up to 3 named siblings already at a JWF school, each with school + net payable fees (`C152` = sum).
  - `C151` annual school fees from PROFILING table 8 (future-year value).
  - `C154` **Actual net remaining disposable income** = NDI − siblings' fees − annual fees.
  - `C156` **Theoretical benchmarking disposable income** = net income − total theoretical notionals for the family category − notional savings (LINKED NOTIONALS table 8 rows 47–49).
  - `C158` **Affordability-adjusted disposable income** = net income × banded % (table 8 grid: 0% at £27–29k up to 45% at £103–105k, stepped down 0.5% per family-category increment).
  - `C160` **Recommended yearly payable fees = smallest of the three; floor £0**.
  - Award summary: `C163` next-year school fees; `C164` scholarship % (manual); `C165` scholarship value = (fees × %) **× 1.20 VAT**; `C166` bursary award value (after VAT, manual); `C167` payable fees next year = fees − scholarship − bursary; `C169` school's bursary spend for the pupil **before VAT** = C166 ÷ 1.20.
  - `C172` **gap from recommended PF to confirmed PF** = C166 − C160, with **Reasons-for-Gap multi-select** (9 codes); last assessment's payable fees + **Reasons-for-YoY-change multi-select** (36 codes, rows 217–252); assessment completed on/by; assessment status (Not started / Started but Paused / Completed).
- **Assessment admin (rows 182–214)**: account synopsis; **"Assessor's wizard — things to look out for with this family"**; recipient name/reference/school/fees-account-code + sibling equivalents; **year-on-year financials table** (per assessment year: overall net income, total savings, total property equity, total yearly debt exposure, YoY deltas, living arrangement, lifestyle-squeeze); **per-academic-year fee table** (YoY comments via reason codes, payable fees, YoY change, school year, submission deadline, application/assessment/bursary statuses).

### 2.3 LINKED NOTIONALS (8 lookup tables, all keyed on family category 1–6)
| Table | Contents | Values (cat 1 → 6) |
|---|---|---|
| 1 | Family structure → category + family-members count | members 2,3,4,5,6,7 |
| 2 | Annual notional rent (ONS Croydon, reactualised yearly) | 19,000 / 19,000 / 22,000 / 25,000 / 28,000 / 31,000 |
| 3 | Notional council tax (LB Croydon Band D) | 2,480 flat |
| 4 | Notional essentials: utilities (gas 627–1,300 + electricity 670–1,450 + water 550–1,550 = 1,850–4,313), internet (£25/mo/adult = 300–600), food (£5.30/day/person = 3,869–13,541.50), household items/toiletries/clothing (£15/wk/adult + £5/wk/child = 1,040–2,860), eating out (£10/wk/adult + £5/wk/child = 780–2,340), sports & leisure (£10/wk/person = 1,040–3,640) | **totals 8,879 / 13,398.50 / 16,854 / 20,341.50 / 23,890 / 27,294.50** |
| 5 | Transportation: car £3,600 flat; public transport £1,200/adult + £600/child = 1,800–5,400 | |
| 6 | JWF Bursary Recipient Allowance: uniform 275 + lunches 825 + trips 600 = **£1,700** flat | |
| 7 | Notional savings benchmark £1,500 × members (3,000–10,500); school-age children per category (1,1,2,3,4,5); savings-cushion allowance = (rent + essentials)/2 rounded to £500 → **13,500 / 16,000 / 19,000 / 22,000 / 25,500 / 28,500** | |
| 8 | Payable-fees benchmarking: theoretical notional total per category (rent+CT+essentials+PT+allowance+car = 37,459–71,474.50); **Theoretical Benchmarked Available Cash** = net income − notionals − notional savings; **% Max of income** grid — 27 income bands (£27,001–£105,000), base % 0→45%, −0.5% per category step | |

### 2.4 PROFILING CATEGORIES (9 tables)
1. **Income categories** — net-income bands → category 1–8 (⚠️ workbook data anomaly: the category column goes 1,2,3,4,5,6,7,7,8,**7**,8 — £110–120k maps *lower* than £100–110k; needs client confirmation).
2. **Property categories** — matrix per portfolio type (renting=1; single/double/multiple property): value band (<£360k, 360–500k, 500–800k, 800k–1.2m, 1.2–1.6m, >1.6m) × mortgaged-vs-outright → categories 1–13.
3. **Property-equity category** — equity bands £0→>£1.6m → 1–12.
4. **Financial-equity category** — bands → text labels ("in debt", "no debt, no equity", "some savings" … "stratospheric savings - level 4").
5. **Debt-over-NDI ratio** — ratio bands → minimum repayment duration (months) + credit-risk status text (16 bands).
6. **School-fees benchmarking %** — income category → % of net income considered normal for school fees: 2 / 3 / 6 / 10 / 15 / 19 / 23 / 27 / 30 / 30 / 30 %.
7. **Lifestyle-squeeze ratio** — <100% → "AFFORDABLE, NO IMPACT" … >170% → "SEVERE LIFESTYLE SQUEEZE, SET TO FAIL QUICKLY".
8. **School fees table** — Trinity current 29,240 / future 30,450; Whitgift current 30,240 / future 31,450 (updated annually).
9. **Academic school year / rounds** — 2026-27 entry years Y6→8 rounds, Y7→7, Y9→5, Y12→2.

### 2.5 Council Tax
LB Croydon 2025/26 band table A–H (A £1,653.66 → H £4,960.96; **Band D £2,480.48**) plus the England 1991-value band definitions. Reference only — the model itself always uses Band D (table 3).

---

## 3. Gap analysis

Legend: ✅ aligned · 🟡 partial (built differently or reduced) · 🔴 missing.

### 3.1 Income assembly (Stage 1)

| Workbook | System | Status |
|---|---|---|
| Status-driven income streams per earner (8 status branches, ~25 line items) | `AssessmentEarner` holds **6 numeric buckets** (`netPay`, `netDividends`, `netSelfEmployedProfit`, `pensionAmount`, `benefitsIncluded`, `benefitsExcluded`) + free-text detail; engine sums them (`stage1-income.ts`) | 🟡 |
| Director's **property income after tax** and **investment/other income** as income streams | No earner-level fields. `additionalPropertyIncome` exists on `AssessmentProperty` but is added in **Stage 2**, unconditionally, household-level | 🟡 |
| Benefits itemised (UC, HB, CHB, tax credits, IS/ESA, DLA/PIP, Carer's, childcare, other) with per-frequency annualisation | Single `benefitsIncluded` total; free-text detail; no annualisation helpers | 🟡 |
| Unemployed/in-between: P45 final salary, redundancy, JSA, student support, parental/sickness pay | No fields on the assessor side | 🔴 |
| Separated/divorced: child maintenance + **new-spouse earned-income portion** | No fields | 🔴 |
| Third-party support: last-12-months cash support ÷ number of kids | No fields | 🔴 |
| Employment statuses | `EmploymentStatus` enum: PAYE, BENEFITS, SELF_EMPLOYED_DIRECTOR, SELF_EMPLOYED_SOLE, OLD_AGE_PENSION, PAST_PENSION, UNEMPLOYED — no SEPARATED_DIVORCED or THIRD_PARTY_SUPPORT branches (and "unemployed & not on benefits" vs "in between roles" not distinguished) | 🟡 |

**Mitigation already in place:** the parent portal (Epic 02, `income-model.ts` / `parents-income.ts`) captures the **full status-driven sub-tables** (employed, selfEmployed {grossSalaried, propertyIncome, dividends, otherInvestmentIncome}, benefits {universalCredit, housingBenefit, childBenefit, childWorkingTaxCredit, esa, pipOrDla, carersAllowance, childcareSupport, other}, unemployed {finalGrossPay, redundancy, jsa, grantSupport, leavePay}, retired {statePension, privatePension}, divorcedSeparated {maintenanceReceived}, thirdParty {incomeSupportReceived}). The raw data arrives; the assessor model collapses it into 6 buckets and loses the itemisation.

### 3.2 Family category & notional lookups

| Workbook | System | Status |
|---|---|---|
| Family structure dropdown → category 1–6 | `Assessment.familyTypeCategory` 1–6 + `FamilyTypeConfig` reference table; auto-populate-then-confirm (`auto-populate.ts`) | ✅ structure |
| Family-members count per category (drives food, savings, internet, household-items formulas) | Not stored — reference table has only pre-computed £ values | 🟡 |
| School-age children count **auto from category** (table 7 row 39: 1,1,2,3,4,5) | `schoolAgeChildrenCount` manual, default 1 | 🟡 |
| Reference values (see §3.11) | Seed values differ substantially from the workbook | 🔴 values |

### 3.3 Notional accommodation

| Workbook | System | Status |
|---|---|---|
| Deduct notional rent by category (19k–31k) | Deducts `notionalRent` (seed 13k–26k) | 🟡 values |
| Add back **full** notional if mortgage-free **or living rent-free** | `isMortgageFree` boolean adds rent back | 🟡 (rent-free case not distinguished, same effect) |
| Add back **25% of notional if family pays lower-than-notional rent** | Missing | 🔴 |
| Add back notional rent if **≥2 properties** and (property income not main income OR stable PAYE med/high income OR drawdown not solely debt consolidation) | Missing (system instead adds `additionalPropertyIncome` — a different rule) | 🔴 |

### 3.4 Council tax

| Workbook | System | Status |
|---|---|---|
| Deduct Band D notional £2,480 | `councilTax` default from `CouncilTaxDefault` (2,480) | ✅ |
| Add back if household receives **full council tax support** | Missing | 🔴 |
| Band A–H reference table | Only a single Band D row; no band table (informational-only in the workbook too) | 🟡 low priority |

### 3.5 Notional essentials

| Workbook | System | Status |
|---|---|---|
| Essentials = utilities + internet + food + household items/toiletries/clothing + eating out + sports & leisure (8,879–27,294.50) | Only `utilityCosts` + `foodCosts` (seed totals 6,200–15,300 — roughly **half** the workbook essentials) | 🔴 four sub-components missing; values wrong |
| Utilities built up from gas/electricity/water sub-table | Single number | 🟡 (single number acceptable if value corrected) |

### 3.6 Transportation

| Workbook | System | Status |
|---|---|---|
| Car used? → deduct £3,600 notional | Missing from engine/schema (parent form **does** capture `carOwnership`/`carValue`/`carMonthlyLease`) | 🔴 |
| Public transport used? → deduct £1,800–£5,400 by category | Missing (parent form captures `usesPublicTransport` + `publicTransportMonthly`) | 🔴 |

### 3.7 JWF Bursary Recipient Allowance

£1,700/yr flat deduction (uniform £275 + lunches £825 + trips £600) — **missing entirely** from engine, schema, and reference data. 🔴

### 3.8 Savings adjustment

| Workbook | System | Status |
|---|---|---|
| Adjusted savings = (cash + savings) ÷ school-age children ÷ years left | `calculateDerivedSavings` — same formula | ✅ formula |
| **Deduct notional savings benchmark** (£1,500 × family members) | Missing | 🔴 |
| **Savings test** = adjusted savings − derived yearly debt repayments − notional savings benchmark; **add only if positive** | System adds the full derived savings **unconditionally** (`stage2-assets.ts:75`) — overstates the family's position for anyone with debts or savings below the notional benchmark | 🔴 material |
| Savings-cushion allowance display (13.5k–28.5k by category) | Missing | 🔴 |
| Total cash and total savings entered separately | `cashSavings` + `isasPepsShares` on `AssessmentProperty` | ✅ |

### 3.9 School-fees insurance
`C83`: if the applicant insured school-fee payments, add the yearly insured total back in — **missing**. 🔴

### 3.10 Personal debt module

Entirely missing. 🔴 The system has only `creditRiskFlag` (manual boolean) and `Recommendation.creditRiskFlag`. The workbook computes:
- Itemised debts: credit cards, loan balances, owed lease balances, owed school fees/other (parent form **already captures** `creditCardBalance`, `bankOverdraft`, `loansToAgencies`, `loansToFriendsFamily`, `schoolFeesOwed`).
- Derived yearly debt repayments = Σ debts ÷ school-years-left.
- Yearly debt exposure (netted off yearly savings).
- **Debt-over-NDI ratio** → minimum-repayment-duration months + 16-band credit-risk status text (PROFILING table 5).
- "Behind with school fees?" yes/no.
- The debt repayments also feed the savings test (§3.8) and the lifestyle-squeeze ratio (§3.12).

> ⚠️ Workbook internal inconsistencies to resolve with the client before implementing: `F124` defines yearly debt exposure as "C122 − C77" (school-years-left minus adjusted savings — almost certainly means **C123** − C77); `F125` defines the ratio as "((C124−C74/C76)) divided by C40" (bracketing ambiguous); table 5 rows overlap ("between 0.8 till 1", "0.5 till 1", "0.3 till 1", "0.1 till 1"). The intent (annualised debt burden ÷ NDI → banded status) is clear; exact formulas need confirmation.

### 3.11 Profiling categories

| Workbook | System | Status |
|---|---|---|
| Income category auto-derived from net income (PROFILING table 1) | `Recommendation.incomeCategory` is a **free-text Input** ("e.g. Low, Medium, High") | 🔴 not derived, wrong domain |
| Property category 1–13 from portfolio × value band × mortgage matrix (PROFILING table 2) | `Assessment.propertyCategory` / `Recommendation.propertyCategory` manual **1–12** dropdown; `propertyExceedsThreshold` boolean | 🟡 manual, wrong range, no matrix |
| Property values/mortgages for family home + second + other properties; per-property equity; total equity | `AssessmentProperty` has only `isMortgageFree`, `additionalPropertyCount`, `additionalPropertyIncome` — **no values or balances** (parent form captures `residenceValue`, `mortgageBalance`, `otherProperties[].value/mortgageBalance`) | 🔴 assessor-side |
| Property-equity category 1–12 (table 3) | Missing | 🔴 |
| Financial-equity category text labels (table 4) | Missing | 🔴 |
| Income-category anomaly (7,7,8,7,8 tail) | — | ⚠️ client to confirm intended bands |

### 3.12 Lifestyle-squeeze affordability ratio

Entirely missing. 🔴 Workbook: NDI/net-income %; (NDI − debt exposure)/net-income %; school-fees-use benchmark % by income category (table 6: 2→30%); squeeze ratio = benchmark ÷ (NDI − debt exposure); status text (table 7). This is also a per-year output tracked in the YoY history table.

### 3.13 Bursary award calculation

| Workbook | System | Status |
|---|---|---|
| **Actual** net remaining DI = NDI − sibling fees − annual fees | Effectively built: `applySiblingDeductions` then `requiredBursary = fees − HNDI` (algebraically the same leg viewed as a bursary rather than remaining DI) | ✅ concept |
| **Theoretical benchmarking DI** = net income − category notional total − notional savings (LINKED NOTIONALS table 8 rows 47–49) | Missing | 🔴 |
| **Affordability-adjusted DI** = net income × banded % (27 bands £27k–£105k, 0→45%, −0.5%/category) | Missing | 🔴 |
| **Recommended payable fees = min(three), floor £0** | Missing — single-path only | 🔴 |
| Sibling fees: up to 3 named siblings, school picked, net payable fees summed | `SiblingLink` + sequential absorption — richer (ordered, account-linked) | ✅ |
| Fees resolved for current + future academic year | Epic 07 fee-year resolver (`fee-year.ts`, versioned `SchoolFees`) | ✅ |
| Recommendation-options comparison for the assessor | `recommendation-options.ts` compares bursary/scholarship/sibling scenarios — but **not** the Actual/Theoretical/Affordability trio | 🟡 |

### 3.14 Award summary & VAT treatment

| Workbook | System | Status |
|---|---|---|
| Scholarship value = (next-year fees × %) **× 1.20** (VAT added to the scholarship value) | `scholarshipDeduction = gross × %` (no VAT on the deduction) | 🔴 different |
| Bursary award (after VAT) **manual fill**; school's bursary spend before VAT = award ÷ 1.20 | Bursary auto = `requiredBursary`; VAT applied to the **net remainder** (`payable-fees.ts`: net = gross − schol − bursary; payable = net × 1.20) | 🔴 different VAT placement |
| Payable = fees − scholarship(incl VAT) − bursary(incl VAT) | Payable = (fees − scholarship − bursary) × 1.20 | 🔴 not equivalent |
| Academic year label on the award | Round-derived | ✅ |

The two treatments give **different payable fees** whenever a scholarship or bursary exists. Which fee figures are VAT-inclusive is exactly the open D8 question (`types.ts` `DEFAULT_VAT_RATE` note) — the workbook now supplies the client's answer: *fees in table 8 are treated as VAT-inclusive-equivalent; scholarship and bursary are expressed after VAT; the school's true spend is the award ÷ 1.20*. Needs explicit confirmation, then the engine's VAT model reworked.

### 3.15 Recommended-vs-confirmed gap & reason codes

| Workbook | System | Status |
|---|---|---|
| Gap = confirmed payable fees − recommended payable fees, with **Reasons-for-Gap multi-select** (9 codes: scholarship sync, 2020 benchmark, pastoral leniency ×3, internal bursary bias ×2, affordability-preferred, theoretical-preferred) | Missing entirely | 🔴 |
| **Reasons for YoY change** — 36 numbered codes (workbook rows 217–252) | `ReasonCode` table with **35 placeholder codes whose wording does not match** (e.g. workbook `8- Sudden unemployment`, `28 - Failure to meet the deadline`, `30 - Forged or tampered with documents`, `35 - Internal Bursary request originally`, `36- Reduced savings` have no equivalents). This is outstanding decision **D4** — the workbook list looks like the definitive client list | 🔴 replace seed |
| Last assessment's payable fees + YoY change | Not stored on Recommendation; reassessment linkage exists via `BursaryAccount` | 🟡 derivable |

### 3.16 Assessment admin, history & statuses

| Workbook | System | Status |
|---|---|---|
| Account synopsis | `Assessment.synopsis` (Epic 06) | ✅ |
| **"Assessor's wizard — things to look out for with this family"** (forward-looking notes for next year's assessor) | No dedicated field (would otherwise be buried in synopsis) | 🟡 |
| Recipient name/reference/school + **fees account code**; sibling rows with the same | Account/application data exists; **fees account code** field missing | 🟡 |
| YoY financials table (per assessment year: net income, savings, property equity, debt exposure + deltas, living arrangement, lifestyle squeeze) | Not modelled. `BursaryScheduleEntry` tracks per-year status/dates only; assessments store their own year's figures but there is no cross-year financial comparison surface | 🔴 |
| Per-academic-year fee table (payable fees, YoY change, comments/reason codes, school year, deadline, application/assessment/bursary statuses) | Largely modelled: `BursaryScheduleEntry` (SCHEDULED/RECEIVED/COMPLETE, availableOn/requiredBy/receivedOn) + `Recommendation` figures + reason codes; no YoY-change column/comments surface | 🟡 |
| Assessment status: Not started / Started-but-Paused / Completed | `AssessmentStatus` NOT_STARTED / IN_PROGRESS / PAUSED / COMPLETED | ✅ |
| Rounds per entry year (table 9: Y6→8, Y7→7, Y9→5, Y12→2) | `Round` + `EntryYearGroup` + `schooling-years.ts` `TOTAL_YEARS_BY_ENTRY` {6:8, 7:7, 9:5, 12:2} | ✅ |

### 3.17 Reference data values (seed vs workbook)

All divergent — the seeds were written before this workbook arrived (Epic 07 flagged them as placeholders):

| Reference | Workbook (cat 1→6) | Seed (`prisma/seed-data/reference.ts`) |
|---|---|---|
| Notional rent | 19,000 / 19,000 / 22,000 / 25,000 / 28,000 / 31,000 | 13,000 / 15,000 / 18,000 / 20,000 / 23,000 / 26,000 |
| Utilities | 1,850 / 2,315 / 2,796 / 3,309 / 3,883 / 4,313 | 1,200 / 1,500 / 2,000 / 2,500 / 3,000 / 3,300 |
| Food | 3,869 / 5,803.50 / 7,738 / 9,672.50 / 11,607 / 13,541.50 | 5,000 / 7,500 / 8,500 / 9,500 / 10,500 / 12,000 |
| (Not in seed) internet / household items / eating out / sports / car / public transport / JWF allowance / notional savings / savings cushion | table 4–7 values above | — |
| Council tax | 2,480 | 2,480 ✅ |
| School fees | Trinity 29,240 → 30,450; Whitgift 30,240 → 31,450 | Trinity 30,702 → 32,237; Whitgift 31,752 → 33,340 (placeholder +5%) |

> Note the workbook fee figures may themselves be a prior year's; confirm which academic years they correspond to before reseeding (Epic 07 outstanding deliverable).

---

## 4. What is already aligned

- Family category 1–6 structure, auto-populate-then-confirm with override protection (`auto-populate.ts`).
- Council tax Band D default (£2,480) and versioned reference tables (`effectiveFrom` pattern supports annual reactualisation everywhere it exists).
- Derived-savings division formula (cash+savings ÷ children ÷ years).
- Sibling sequential income absorption (richer than the workbook's 3 manual rows).
- Fee-year current/next resolution (Epic 07) matches the workbook's current/future fee columns.
- Assessment statuses, rounds-per-entry-year, schedule entries, reassessment rolling accounts.
- Parent-side raw data capture (income sub-tables, property values/mortgages, itemised debt, transport use) — the inputs the missing modules need are mostly already collected and documented with evidence uploads.

## 5. Structural observations for implementation

1. **The assessor data model is the bottleneck.** `AssessmentEarner` (6 buckets) and `AssessmentProperty` (no values/balances) cannot hold the full model's inputs. Either extend them or, better, mirror the parent-form JSONB sub-table pattern (Epic 02) on the assessor side so the itemisation survives from application → assessment.
2. **Reference tables need 6 new value sets** (internet, household items, eating out, sports/leisure — or one "essentials" composite —, car, public transport, JWF allowance, notional savings rate, savings cushion) plus the two benchmark grids (affordability %-of-income bands; school-fees-use %). All fit the existing `effectiveFrom`-versioned reference pattern and the Settings UI (WP-19) model.
3. **The engine restructure is bigger than adding fields**: notional add-back rules, the positive-only savings test (depends on the debt module), the three-way award comparison, and the changed VAT placement all alter existing outputs. Existing completed assessments must keep their stored figures (the schema already snapshots outputs on `Assessment`, so recomputation risk is contained).
4. **Profiling categories are derivable, not manual.** Income category, property category, equity categories, debt status, and lifestyle squeeze should become computed lookups (with the workbook's tables as seeded reference data), replacing today's free-text/manual dropdowns on the Recommendation.
5. **Workbook defects to resolve with the client before build** (do not silently "fix"):
   - Income-category table tail (7,7,8,7,8) — §3.11.
   - Yearly-debt-exposure / debt-over-NDI cell references (`F124`/`F125`) — §3.10.
   - Overlapping debt-ratio bands in PROFILING table 5.
   - Which academic years the fee figures represent — §3.17.
   - VAT treatment confirmation (closes D8) — §3.14.

## 6. Priority summary

| # | Gap | Severity (effect on award correctness) |
|---|---|---|
| 1 | Three-way award comparison (theoretical + affordability legs + min rule) | **Critical** — changes the recommended figure for most families |
| 2 | Notional essentials under-scoped (missing internet/household/eating-out/sports) + wrong reference values | **Critical** — notional spend understated by ~£10–14k per family |
| 3 | Transportation + JWF recipient allowance deductions | **High** — up to ~£10.7k further notional spend missing |
| 4 | Savings test (notional savings benchmark, debt netting, positive-only) | **High** — currently overstates family resources |
| 5 | Personal debt module + debt/NDI status | **High** — feeds savings test, lifestyle squeeze, credit risk |
| 6 | Rent add-back rules (25% lower-rent, multi-property) + council-tax support add-back + fee insurance | **High** |
| 7 | VAT placement in award summary | **High** — changes payable fees whenever scholarship/bursary present |
| 8 | Assessor-side income itemisation (status-driven streams incl. maintenance, new-spouse portion, third-party) | **Medium** — totals can be right today but unauditable/lossy |
| 9 | Derived profiling categories (income/property/equity/financial) + property value capture on assessment | **Medium** |
| 10 | Lifestyle-squeeze ratio + status | **Medium** — assessor judgement aid + YoY tracking output |
| 11 | Gap-to-confirmed tracking + Reasons-for-Gap list; replace ReasonCode seed with workbook's 36 codes (closes D4) | **Medium** |
| 12 | YoY financials history table; assessor's-wizard note; fees account code | **Low–Medium** |
| 13 | Reference value reseeding (rent/utilities/food/fees) | **Critical but trivial** once figures confirmed |

---

*Sources: workbook cell references are to `ASSESSMENT PAGE` unless noted; code references at `src/lib/assessment/`, `prisma/schema.prisma`, `prisma/seed-data/reference.ts` as of `staging` @ 1b46287.*
