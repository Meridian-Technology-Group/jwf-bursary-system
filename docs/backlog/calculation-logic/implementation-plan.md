# Full Assessment Model — Implementation Plan

**Audience:** a Claude Code session implementing this work. This document is self-contained enough to execute from, but you MUST also read, before writing any code:

1. `docs/backlog/calculation-logic/gap-analysis.md` — the full gap analysis (same folder). Cell references below (`C56`, `table 8`, etc.) are to the workbook via that document.
2. `docs/backlog/calculation-logic/Assessment Model Notional Calculations.xlsx` — the canonical model. Parse it with `openpyxl` (installed) if you need to verify a value; load with `data_only=False` for formulas and `data_only=True` for cached values.
3. Repo `CLAUDE.md` — mandatory git workflow. Branch off `staging`, PR to `staging`, one PR per work package below, conventional commits, never touch `main`.
4. `src/lib/assessment/` — the existing engine you are extending. Read every file; they are small and heavily documented.

**Goal:** replace the abridged 4-stage calculation with the client's full notional model: full income assembly, six notional blocks with conditional add-backs, a savings test, a personal-debt module, derived profiling categories, the lifestyle-squeeze ratio, and the **min-of-three** award rule (Actual / Theoretical / Affordability-adjusted), plus the reworked VAT treatment and the gap-to-confirmed tracking.

---

## 1. Ground rules (apply to every work package)

- **Branching**: `feature/calc-XX-<slug>` off fresh `staging`. PR targets `staging`. Do not merge your own PR unless the user has granted standing merge authority in-session.
- **Migrations**: additive only — new tables and nullable columns. One migration per PR, shipped in the same PR as the code that needs it. Author SQL via `prisma migrate dev` locally (Node 22.12: `export PATH="$HOME/.local/share/nvm/v22.12.0/bin:$PATH"`). Merged PRs auto-apply to nonprod via `db-push.yml` — never mutate an applied migration.
- **Never recompute completed assessments.** `Assessment` rows snapshot their outputs; `COMPLETED` assessments are immutable. All semantic changes apply to new/in-progress assessments only, gated by the `calculationVersion` stamp (CALC-02).
- **Engine purity**: everything under `src/lib/assessment/` stays pure (no DB, no React). Reference values arrive as inputs. DB reads live in `src/lib/db/queries/`, wiring in server components/actions.
- **Seeds**: reference data goes in `prisma/seed-data/` + idempotent upserts in `prisma/seed-reference.ts` (never the demo seed). Follow the existing `effectiveFrom`-versioned upsert pattern.
- **Tests**: `npm run test` (vitest). Every engine module gets a `__tests__/*.test.ts` sibling. Use the workbook fixtures in Appendix F as acceptance vectors — the engine must reproduce the workbook's cached values exactly. Full suite (~603 tests) must stay green; run `npx tsc --noEmit` and `npm run build` before opening each PR.
- **Do not silently "fix" workbook defects.** Where the workbook is ambiguous (§7 assumptions), implement the stated assumption and mark it with a `// ASSUMPTION(CALC-A#):` comment so it is greppable when the client answers.

---

## 2. Architecture decisions (made — do not relitigate)

1. **Engine v2 beside v1, dispatched by `Assessment.calculationVersion`** (`Int @default(1)`; new assessments created after CALC-07 ships get `2`). v1 files stay untouched so in-flight v1 assessments keep recomputing identically. v2 lives in `src/lib/assessment/v2/`. Shared helpers (`fee-year.ts`, `schooling-years.ts`, `sibling.ts`) are version-neutral and reused.
2. **Assessor-side itemisation uses JSONB sub-table records**, mirroring the parent-form pattern (`src/lib/portal/income-model.ts` / `ParentIncomeRecord`). Do NOT add 25 numeric columns to `assessment_earners`; add one `income_detail Json` column whose TypeScript shape reuses/extends `ParentIncomeRecord`. Same pattern for debts and property assets (see CALC-02). Rationale: the parent form already produces these shapes; the assessor reviews/adjusts them.
3. **Profiling categories are computed, not manual.** The free-text `Recommendation.incomeCategory` and the manual 1–12 `propertyCategory` dropdown are superseded by derived lookups (kept as columns, now written by the engine wiring; the manual inputs are removed from the UI for v2 assessments).
4. **Reference lookups follow the existing pattern**: one row per (key, `effectiveFrom`), resolved by "latest `effectiveFrom` ≤ anchor date, tie-break `createdAt` desc" — reuse `resolveEffectiveFeeRow` semantics (`fee-year.ts`).
5. **VAT per the workbook** (scholarship value = fees × % × 1.20; bursary award entered after-VAT; school spend = award ÷ 1.20; payable = fees − scholarship − bursary). Implemented in v2 only; v1 untouched. Flagged `ASSUMPTION(CALC-A5)` pending explicit client sign-off of D8.
6. **Reason codes: deprecate-and-replace, never update-in-place.** Existing `RecommendationReasonCode` rows reference current codes by ID; mark old rows `isDeprecated`, insert the workbook's list as new rows (CALC-09).

---

## 3. Work packages

### Phase A — foundations (start here; A1 ∥ A2)

#### CALC-01 · Reference tables & seed data
**Branch** `feature/calc-01-reference-tables` · **Depends on:** nothing.

New Prisma models (all `@@map` snake_case, all with `effectiveFrom @db.Date` + `createdAt`, unique on natural key + `effectiveFrom`):

| Model | Key | Columns (beyond key/dates) | Source |
|---|---|---|---|
| `NotionalCostConfig` | `category` (1–6) + `costType` enum | `amount Decimal` | Appendix A. `costType` enum: `RENT`, `COUNCIL_TAX`, `ESSENTIALS`, `CAR`, `PUBLIC_TRANSPORT`, `JWF_ALLOWANCE`, `NOTIONAL_SAVINGS`, `SAVINGS_CUSHION` |
| `FamilyCategoryMeta` | `category` | `familyMembers Int`, `schoolAgeChildren Int`, `description` | Appendix A row 1 |
| `AffordabilityBand` | `bandFloor Decimal` | `bandCeiling Decimal`, `basePct Decimal` (category adjustment is formulaic: `basePct − 0.5 × (category−1)`, floor 0 not applied — negatives allowed per workbook) | Appendix B |
| `IncomeCategoryBand` | `bandFloor` | `bandCeiling`, `category Int`, `feesBenchmarkPct Decimal` | Appendix C.1 (merges PROFILING tables 1 + 6 — same bands) |
| `PropertyEquityBand` | `bandFloor` | `bandCeiling`, `category Int` | Appendix C.2 |
| `FinancialEquityBand` | `bandFloor` | `bandCeiling`, `label String` | Appendix C.3 |
| `DebtRatioBand` | `ratioFloor Decimal` | `ratioCeiling`, `minRepaymentMonths Int?`, `statusLabel String` | Appendix C.4 |
| `LifestyleSqueezeBand` | `ratioFloor` | `ratioCeiling`, `statusLabel String` | Appendix C.5 |

Also in this PR:
- **Re-seed corrected values** for `FamilyTypeConfig` (rent per Appendix A; keep `utilityCosts`/`foodCosts` columns populated for v1 back-compat but v2 reads `ESSENTIALS` composite from `NotionalCostConfig`). Use a NEW `effectiveFrom` (`2026-09-01` is already taken by the placeholder rows — use the workbook-confirmed date or `2026-09-02`; do not mutate existing rows).
- Extend `prisma/seed-data/reference.ts` + `seed-reference.ts` with idempotent upserts for every new table (per the CLAUDE.md rule: reference data never goes in the demo seed).
- Query helpers in `src/lib/db/queries/reference-tables.ts` following the existing resolve-latest pattern; band lookups return the row where `floor ≤ value ≤ ceiling` (use `lte`/`gte`, exclusive/inclusive per Appendix notes).
- Leave `SchoolFees` seed values alone (Epic 07 placeholder figures) — the workbook's fee figures are of unconfirmed vintage (assumption CALC-A4); fee reseeding is a data task, not code.

**Done when:** migration applied cleanly, `npm run seed:reference` idempotent (run twice), query helpers unit-tested against Appendix values.

#### CALC-02 · Assessment capture schema (`calculationVersion` + itemised inputs)
**Branch** `feature/calc-02-assessment-schema` · **Depends on:** nothing (parallel with CALC-01).

Additive migration on existing tables:

- `assessments`:
  - `calculation_version Int @default(1)` — v2 stamped at creation from CALC-07 onward.
  - Notional toggles/inputs (all nullable): `rent_add_back_type` enum (`NONE`,`FULL_MORTGAGE_FREE`,`FULL_RENT_FREE`,`PARTIAL_LOWER_RENT`) — replaces reliance on `isMortgageFree` for v2; `multi_property_rent_add_back Boolean?`; `council_tax_support Boolean?`; `uses_car Boolean?`, `uses_public_transport Boolean?` (pre-fill from the application's assets/liabilities answers); `fee_insurance_annual Decimal?`; `behind_on_fees Boolean?`.
  - Snapshot columns for new v2 outputs (nullable Decimals unless noted): `notional_essentials`, `notional_car`, `notional_public_transport`, `notional_jwf_allowance`, `notional_savings_benchmark`, `savings_test_number`, `total_notional_spend`, `ndi_after_notional_spend`, `derived_yearly_debt_repayments`, `yearly_debt_exposure`, `debt_over_ndi_ratio`, `debt_status_label String?`, `income_category Int?`, `property_category_derived Int?`, `property_equity_category Int?`, `financial_equity_label String?`, `lifestyle_squeeze_ratio Decimal?`, `lifestyle_squeeze_label String?`, `actual_remaining_di`, `theoretical_benchmark_di`, `affordability_adjusted_di`, `recommended_payable_fees`.
- `assessment_earners`: `income_detail Json?` — the status-driven sub-table record (type in `src/types/assessment.ts`, structurally reusing `ParentIncomeRecord` from `src/types/application.ts` + assessor-only extras: `divorcedSeparated.newSpouseIncomePortion`, `thirdParty.numberOfKidsDivisor`). The 6 legacy numeric buckets remain and keep powering v1.
- `assessment_properties`: `property_assets Json?` — `{ home: {value, mortgageBalance}, second: {value, mortgageBalance}, other: {value, mortgageBalance} }` (aggregate "other", per workbook C101/C102); `debts Json?` — `{ creditCards, loans, leaseBalances, schoolFeesOwedOrOther }`.
- `recommendations`: `recommended_payable_fees Decimal?` (the engine's min-of-three), `confirmed_payable_fees Decimal?`, `gap_amount Decimal?`, `last_payable_fees Decimal?`, `scholarship_value_incl_vat Decimal?`, `bursary_spend_before_vat Decimal?`.
- New table `gap_reasons` (mirrors `reason_codes` shape: `code Int @unique`, `label`, `isDeprecated`, `sortOrder`) + junction `recommendation_gap_reasons`. Seed from Appendix E in `seed-reference.ts` (fine to include here rather than CALC-01; keep one migration).

Add the TypeScript types (`src/types/assessment.ts`) and Zod schemas for the JSONB shapes in this PR so the engine packages can import them.

**Done when:** migration + `prisma generate` clean, types exported, no behaviour change anywhere (pure schema PR).

### Phase B — pure engine v2 (after CALC-02 types exist; B1 ∥ B2 ∥ B3, then B4)

All modules in `src/lib/assessment/v2/`, pure, DB-free, each with exhaustive tests against Appendix F vectors. Reference values are passed in via a single `ReferenceBundle` input type (defined in CALC-03, consumed by all).

#### CALC-03 · Income assembly + notional spend engine
**Branch** `feature/calc-03-notionals-engine` · **Depends on:** CALC-02 (types only).

- `income.ts`: `calculateEarnerIncome(detail: AssessorIncomeRecord): number` summing the status-driven streams (mirror `newIncomeTotal` in `income-model.ts`, plus new-spouse portion; third-party support = last-12-months cash ÷ number of kids). `calculateHouseholdNetIncome(earners)` = Σ, floor 0. (Workbook C40.)
- `notional-spend.ts`: `calculateNotionalSpend(input, ref): NotionalSpendResult` implementing, with **positive-deduction sign convention** (return both the itemised lines and the signed total so the UI can render the workbook's ± column):
  - rent deduction (ref RENT by category) with add-backs: `FULL_*` → +100%, `PARTIAL_LOWER_RENT` → +25% (C57); multi-property add-back → +100% again when `multiPropertyRentAddBack` (C58 — assessor-judged boolean, the three OR-conditions are UI helper text, not computed);
  - council tax deduction (ref COUNCIL_TAX) with full add-back when `councilTaxSupport` (C59/C60);
  - essentials deduction (ref ESSENTIALS composite) (C62);
  - car / public transport deductions, each only when the corresponding `uses*` flag (C65–C68);
  - JWF allowance deduction (C70);
  - notional savings benchmark deduction (ref NOTIONAL_SAVINGS) (C78);
  - savings test **add-back**: `max(0, adjustedSavings − derivedYearlyDebtRepayments − notionalSavingsBenchmark)` (C80/C81) — takes `derivedYearlyDebtRepayments` as an input (computed in CALC-04; orchestrator wires it);
  - fee-insurance add-back (`feeInsuranceAnnual`, C83);
  - `totalNotionalSpend` (C85) and `ndiAfterNotionalSpend = netIncome + totalNotionalSpend` (C87, total is negative in the normal case).
  - `adjustedSavings` = existing `calculateDerivedSavings` (reuse from v1 — identical formula), with `schoolAgeChildrenCount` **defaulted from `FamilyCategoryMeta`** but overridable.

#### CALC-04 · Debt module
**Branch** `feature/calc-04-debt-module` · **Depends on:** CALC-02 (types), CALC-01 (band shapes).

`debt.ts`:
- `derivedYearlyDebtRepayments = (creditCards + loans + leaseBalances + schoolFeesOwedOrOther) / schoolingYearsRemaining` (C123; return 0 when years ≤ 0).
- `yearlyDebtExposure = derivedYearlyDebtRepayments − adjustedSavings` (C124 — `ASSUMPTION(CALC-A2)`: workbook cell ref "C122−C77" read as C123−C77 per its own label "netted off yearly savings").
- `debtOverNdiRatio = max(0, yearlyDebtExposure) / householdNetIncome` (C125 — `ASSUMPTION(CALC-A2)` on the garbled bracketing; denominator is net income C40 per F125).
- `classifyDebt(ratio, bands)` → `{minRepaymentMonths, statusLabel}` from `DebtRatioBand` (Appendix C.4 — bands normalised to non-overlapping, `ASSUMPTION(CALC-A3)`).

#### CALC-05 · Profiling derivations
**Branch** `feature/calc-05-profiling` · **Depends on:** CALC-01 (band shapes), CALC-02 (types).

`profiling.ts`:
- `incomeCategory(netIncome, bands)` and `feesBenchmarkPct(netIncome, bands)` from `IncomeCategoryBand` (Appendix C.1, with the anomaly preserved as seeded — `ASSUMPTION(CALC-A1)`).
- `propertyCategory(assets)`: renting → 1; else classify the **relevant** property per portfolio type (single → home; double → second; multiple → other) by value band × outright-vs-mortgaged (equity == value ⇒ outright) per the PROFILING table-2 matrix (Appendix C.6; categories 1–13).
- `propertyEquityTotals(assets)` → per-property equity + total; `propertyEquityCategory(total, bands)` (C.2).
- `financialEquityLabel(cashAndSavings − Σdebts, bands)` (C.3).
- `lifestyleSqueeze(ndi, netIncome, yearlyDebtExposure, feesBenchmarkPct, bands)` → `{ndiOverIncomePct, postDebtLifestylePct, feesBenchmarkAmount = feesBenchmarkPct × netIncome, squeezeRatio = feesBenchmarkAmount / (ndi − yearlyDebtExposure), statusLabel}` (C131–C135; guard ÷0 → null status).

#### CALC-06 · Award engine v2 (min-of-three + VAT rework)
**Branch** `feature/calc-06-award-engine` · **Depends on:** CALC-03 (NDI), CALC-01 (affordability grid), CALC-05 (only for types — no maths dependency).

`award.ts`:
- `actualRemainingDI = ndiAfterNotionalSpend − Σ siblingPayableFees − annualFees` (C154; reuse `sibling.ts` ordering semantics).
- `theoreticalBenchmarkDI = netIncome − theoreticalNotionalTotal(category) − notionalSavings(category)` where `theoreticalNotionalTotal = rent + councilTax + essentials + publicTransport + jwfAllowance + car` — **both** transport modes included unconditionally per table-8 row 47 (LINKED NOTIONALS G47).
- `affordabilityAdjustedDI = netIncome × max? no — exactly `(basePct(bandOf(netIncome)) − 0.5 × (category−1)) / 100 × netIncome` (grid, Appendix B). Below the bottom band (≤ £27,000) → 0; above the top band (> £105,000) → cap at the top band's pct (`ASSUMPTION(CALC-A6)`).
- `recommendedPayableFees = max(0, min(actual, theoretical, affordability))` (C160).
- `awardSummary(nextYearFees, scholarshipPct, bursaryAwardAfterVat, vatRate)`:
  - `scholarshipValueInclVat = nextYearFees × pct × (1 + vatRate/100)` (C165);
  - `payableFeesNextYear = nextYearFees − scholarshipValueInclVat − bursaryAwardAfterVat` (C167, floor 0);
  - `bursarySpendBeforeVat = bursaryAwardAfterVat / (1 + vatRate/100)` (C169);
  - `gapAmount = confirmedPayableFees − recommendedPayableFees` (C172 concept).
  - Note the inversion vs v1: in v2 the **bursary award is an assessor-entered £ (after VAT)**, guided by `recommendedPayableFees`; it is not auto-derived. Keep `DEFAULT_VAT_RATE` as the single source.
- `orchestrator.ts`: `calculateAssessmentV2(input, ref): AssessmentV2Output` composing CALC-03/04/05/06 in dependency order (income → debt repayments → notional spend (needs debt) → debt ratio (needs NDI) → profiling → award), returning every intermediate the schema snapshots (CALC-02 column list is the contract).

### Phase C — wiring & UI (sequential: C1 → C2; C3 parallel to both)

#### CALC-07 · Assessor form v2 (capture + live calculation)
**Branch** `feature/calc-07-assessor-form` · **Depends on:** CALC-01…06 all merged. **This is the largest package — split into stacked PRs if it exceeds ~1.5k changed lines** (7a: income + notionals; 7b: property/debt/savings + profiling strip).

- Server: load `ReferenceBundle` for the round's academic year; stamp `calculationVersion: 2` on assessment creation; dispatch v1/v2 by stamp everywhere the engine is called (`use-assessment-calculation.ts`, save actions, `src/app/(admin)/applications/[id]/assessment/page.tsx`).
- Earner cards: status-driven sub-table inputs (reuse the parent-form components/labels where possible), **pre-filled from the application's submitted `ParentIncomeRecord`** (auto-populate-then-confirm — extend `auto-populate.ts` override semantics to the new fields).
- Notional section: each line shows the auto value, the ± sign, the toggles (rent add-back type, multi-property add-back with the three OR-conditions as helper text, CT support, car/PT use pre-filled from assets/liabilities answers), fee insurance input.
- Property & debt section: `property_assets` / `debts` JSONB inputs pre-filled from the application's assets/liabilities section; savings inputs unchanged; savings-test line (display-only) with cushion allowance shown for context.
- Profiling strip (display-only): income category, property/equity/financial categories, debt status, lifestyle squeeze — recomputed live.
- Live totals: net income, total notional spend, NDI, and the three award legs with the min highlighted (extend `assessment-calc-strip.tsx` / `calculation-display.tsx` for v2).
- v1 assessments must render the OLD form unchanged — branch on `calculationVersion` at the page level.

**Done when:** a v2 assessment can be completed end-to-end on a seeded application, all snapshots persist, v1 assessments unaffected (regression-test one), suite green.

#### CALC-08 · Recommendation screen v2 (min-of-three, gap tracking)
**Branch** `feature/calc-08-recommendation-v2` · **Depends on:** CALC-07.

- Show the three legs + `recommendedPayableFees`; assessor enters scholarship % and the bursary award £ (after VAT); live `payableFeesNextYear`, `bursarySpendBeforeVat`, `gapAmount`.
- When `gapAmount ≠ 0`, require ≥1 gap reason (multi-select from `gap_reasons`).
- `lastPayableFees` pre-filled from the account's previous recommendation (via `BursaryAccount`); YoY reason-code multi-select unchanged mechanically (list content changes in CALC-09).
- Derived `incomeCategory`/`propertyCategory` replace the free-text/manual inputs for v2 (v1 recommendations keep the old inputs).
- Extend `recommendation-options.ts` scenarios to include the three legs.

#### CALC-09 · Reason-code list replacement (D4) + gap-reason content
**Branch** `feature/calc-09-reason-codes` · **Depends on:** CALC-02 only (gap_reasons table). Can run parallel to Phase B/C.

- Deprecate all 35 existing `reason_codes` rows (`isDeprecated: true`); insert the workbook's 36 codes (Appendix D) as new rows (codes 101–136 to avoid numeric collision with the deprecated 1–35 — display label carries the workbook's own numbering).
- Verify pickers filter `isDeprecated` (they should — Story 4.4 pattern) and historic recommendations still render deprecated labels.

### Phase D — periphery (all parallel, after CALC-08)

#### CALC-10 · Assessment admin extras
**Branch** `feature/calc-10-admin-extras` — "Assessor's wizard — things to look out for" (`assessments.watch_out_notes String?`, shown prominently on the NEXT assessment of the same account); `bursary_accounts.fees_account_code String?`; YoY financials history table on the account page (per completed assessment: net income, total savings, property equity, debt exposure, lifestyle squeeze + deltas — read-only projection over snapshots, no new write path).

#### CALC-11 · Settings UI for new reference tables
**Branch** `feature/calc-11-settings` — extend the WP-19 settings page with tabs/editors for `NotionalCostConfig`, `FamilyCategoryMeta`, the band tables, and `gap_reasons`, following the existing versioned-row editing pattern (new `effectiveFrom` row, never mutate).

#### CALC-12 · Outputs alignment
**Branch** `feature/calc-12-outputs` — recommendation PDF (`src/lib/pdf/`), XLSX/CSV exports (`src/lib/export/`, `queries/exports.ts`), and dashboard/reports touchpoints: surface the v2 fields (three legs, recommended vs confirmed + gap + reasons, profiling categories, debt status, squeeze label) with graceful nulls for v1 rows.

---

## 4. Order & parallelism

```
Phase A:   CALC-01 ──────────────┐
           CALC-02 ──────────────┤   (01 ∥ 02)
                                 ▼
Phase B:   CALC-03 ∥ CALC-04 ∥ CALC-05
                └──────┬──────┘
                       ▼
                   CALC-06
                       ▼
Phase C:           CALC-07  ──►  CALC-08
           CALC-09 (any time after CALC-02, ∥ with B/C)
                                       ▼
Phase D:        CALC-10 ∥ CALC-11 ∥ CALC-12
```

Sequencing notes:
- CALC-03/04/05 are pure modules with no mutual imports at build time (the orchestrator in CALC-06 wires the savings-test ↔ debt-repayments dependency), so they can be three parallel branches — but they share `v2/types.ts`/`ReferenceBundle`; land CALC-03 first *or* agree the shared types in CALC-02 to avoid conflicts. If running agents in parallel, prefer one-at-a-time per the repo's worktree-cwd gotcha (see memory/CLAUDE.md), or give each its own files only.
- CALC-07 is the integration point and the riskiest PR; everything before it is invisible to users.
- Nothing in this plan promotes to `main` — the user owns promotion.

## 5. Test strategy

- **Workbook-fixture tests** (Appendix F) in `src/lib/assessment/v2/__tests__/workbook-fixtures.test.ts`: the engine must reproduce the workbook's cached values for every family category — essentials totals, transport, savings cushions, theoretical notional totals, table-8 available-cash example (net income £32,600), and the affordability grid spot-checks.
- **Rule tests** per module: add-back combinations, savings-test sign behaviour, debt ÷0 guards, band edge values (floor/ceiling inclusivity), min-of-three tie/negative/floor cases, VAT identities (`spendBeforeVat × 1.2 == award`).
- **Version-dispatch regression**: a v1 assessment recomputes byte-identically after every PR (snapshot an existing calculator test's output as the guard).
- **E2E smoke** after CALC-07/08: seeded demo application → complete a v2 assessment → recommendation → PDF renders. Use the `verify` skill before committing UI PRs.

## 6. Open client decisions (do NOT block; implement the assumption, tag it)

| # | Question | Assumption implemented | Tag |
|---|---|---|---|
| A1 | Income-category band tail is 1,2,3,4,5,6,7,7,8,**7**,8 — is the £110–120k→7 intentional? | Seed exactly as the workbook | `CALC-A1` |
| A2 | Debt formulas `F124`/`F125` cell refs are garbled | `exposure = repayments − adjustedSavings`; `ratio = max(0,exposure)/netIncome` | `CALC-A2` |
| A3 | Debt-ratio bands 0.1–1/0.3–1/0.5–1/0.8–1 overlap | Normalised to 0.1–0.3, 0.3–0.5, 0.5–0.8, 0.8–1 | `CALC-A3` |
| A4 | Which academic years do the workbook fees (Trinity 29,240/30,450; Whitgift 30,240/31,450) belong to? | Do not reseed fees; keep Epic 07 placeholders | `CALC-A4` |
| A5 | VAT treatment (closes D8) | Workbook semantics in v2 (see §2.5) | `CALC-A5` |
| A6 | Affordability grid outside £27k–£105k | ≤27k → 0%; >105k → hold top band % | `CALC-A6` |
| A7 | Multi-property rent add-back (C58) three OR-conditions — computed or judged? | Assessor-judged boolean with conditions as helper text | `CALC-A7` |

---

## Appendix A — Notional cost seed values (by family category 1→6)

Category descriptions: 1 sole parent+1 child · 2 parents+1 · 3 parents+2 · 4 parents+3 · 5 parents+4 · 6 parents+5+. Family members: 2,3,4,5,6,7. School-age children: 1,1,2,3,4,5.

| costType | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| RENT | 19000 | 19000 | 22000 | 25000 | 28000 | 31000 |
| COUNCIL_TAX | 2480 | 2480 | 2480 | 2480 | 2480 | 2480 |
| ESSENTIALS | 8879 | 13398.50 | 16854 | 20341.50 | 23890 | 27294.50 |
| CAR | 3600 | 3600 | 3600 | 3600 | 3600 | 3600 |
| PUBLIC_TRANSPORT | 1800 | 3000 | 3600 | 4200 | 4800 | 5400 |
| JWF_ALLOWANCE | 1700 | 1700 | 1700 | 1700 | 1700 | 1700 |
| NOTIONAL_SAVINGS | 3000 | 4500 | 6000 | 7500 | 9000 | 10500 |
| SAVINGS_CUSHION | 13500 | 16000 | 19000 | 22000 | 25500 | 28500 |

Essentials build-up (for the settings UI helper text / audit, not separate rows): utilities 1850/2315/2796/3309/3883/4313 · internet £25/mo/adult (300, then 600) · food £5.30/day/person (3869→13541.50) · household items £15/wk/adult+£5/wk/child (1040→2860) · eating out £10/wk/adult+£5/wk/child (780→2340) · sports £10/wk/person (1040→3640).

Theoretical notional totals (derived — used by the theoretical leg; assert in tests, don't seed): RENT+COUNCIL_TAX+ESSENTIALS+PUBLIC_TRANSPORT+JWF_ALLOWANCE+CAR = **37459 / 43178.50 / 50234 / 57321.50 / 64470 / 71474.50**.

## Appendix B — Affordability grid (base % for category 1; category n uses base − 0.5×(n−1) pct-points)

| Net income band (£) | base % | | Net income band (£) | base % |
|---|---|---|---|---|
| 27,001–29,000 | 0 | | 63,001–65,000 | 14 |
| 29,001–32,000 | 1 | | 65,001–67,000 | 15 |
| 32,001–35,000 | 2 | | 67,001–70,000 | 16 |
| 35,001–38,000 | 3 | | 70,001–73,000 | 17 |
| 38,001–40,000 | 4 | | 73,001–75,000 | 18 |
| 40,001–43,000 | 5 | | 75,001–78,000 | 20 |
| 43,001–45,000 | 6 | | 78,001–80,000 | 21 |
| 45,001–47,000 | 7 | | 80,001–83,000 | 22 |
| 47,001–50,000 | 8 | | 83,001–85,000 | 23 |
| 50,001–53,000 | 9 | | 85,001–88,000 | 24 |
| 53,001–55,000 | 10 | | 88,001–90,000 | 25 |
| 55,001–57,000 | 11 | | 90,001–93,000 | 27 |
| 57,001–60,000 | 12 | | 93,001–95,000 | 29 |
| 60,001–63,000 | 13 | | 95,001–98,000 | 32 |
| | | | 98,001–100,000 | 35 |
| | | | 100,001–103,000 | 40 |
| | | | 103,001–105,000 | 45 |

Note the non-uniform steps (18→20 at £75k; 25→27→29→32→35→40→45 at the top) — seed exactly. Category-adjusted % may go negative (e.g. cat 6 in the 0% band → −2.5%); the workbook keeps the negative £ and lets the min-of-three floor handle it — do the same.

## Appendix C — Profiling bands

**C.1 Income categories + fees-benchmark %** (bands inclusive of floor, exclusive of ceiling):
<27,000→cat 1, 2% · 27,000–39,999→2, 3% · 40,000–49,999→3, 6% · 50,000–59,999→4, 10% · 60,000–69,999→5, 15% · 70,000–79,999→6, 19% · 80,000–89,999→**7**, 23% · 90,000–99,999→**7**, 27% · 100,000–109,999→**8**, 30% · 110,000–119,999→**7**, 30% · ≥120,000→**8**, 30%. (Anomaly preserved — CALC-A1.)

**C.2 Property-equity category:** 0→1 · 0–50k→2 · 50–75k→3 · 75–100k→4 · 100–150k→5 · 150–250k→6 · 250–400k→7 · 400–600k→8 · 600–900k→9 · 900k–1.2m→10 · 1.2–1.6m→11 · >1.6m→12.

**C.3 Financial-equity labels:** <0 "in debt" · 0 "no debt, no equity" · 0–50k "some savings" · 50–75k "fair savings" · 75–100k "decent savings" · 100–150k "large savings" · 150–250k "high savings" · 250–400k "very high savings" · 400–600k "extremely high savings" · 600–900k / 900k–1.2m / 1.2–1.6m / >1.6m "stratospheric savings - level 1/2/3/4".

**C.4 Debt-over-NDI ratio** (months, status): ≤0 → n/a, "ZERO DEBT, NO CREDIT RISK" · <0.1 → <1mo, "SMALL DEBT LEVEL, NEGLIGIBLE CREDIT RISK - level 1" · 0.1–0.3 → 1, "…level 2" · 0.3–0.5 → 3, "MANAGEABLE DEBT, LOW CREDIT RISK - level 1" · 0.5–0.8 → 6, "…LOW - level 2" · 0.8–1 → 9, "MANAGEABLE DEBT, MEDIUM CREDIT RISK - level 1" · 1–2 → 12, "…MEDIUM - level 2" · 2–3 → 24, "MATERIAL DEBT IMPACT, FAIR CREDIT RISK - level 1" · 3–4 → 36, "…level 2" · 4–5 → 48, "HEAVILY IN DEBT, HIGH CREDIT RISK - level 1" · 5–6 → 60, "…level 2" · 6–7 → 72, "…level 3" · 7–8 → 84, "VERY HEAVILY IN DEBT, VERY HIGH CREDIT RISK - level 1" · 8–9 → 96, "…level 2" · 9–10 → 108, "…level 3" · >10 → 120, "…level 4". (Overlaps normalised — CALC-A3.)

**C.5 Lifestyle-squeeze ratio:** <100% "AFFORDABLE, NO IMPACT" · 100–120% "SMALL LIFESTYLE SQUEEZE, LITTLE IMPACT" · 120–140% "NOTICEABLE LIFESTYLE SQUEEZE, SOME IMPACT" · 140–150% "IMPORTANT LIFESTYLE SQUEEZE, WILL STRUGGLE" · 150–170% "VERY HIGH LIFESTYLE SQUEEZE, WON'T MANAGE OVER TIME" · >170% "SEVERE LIFESTYLE SQUEEZE, SET TO FAIL QUICKLY".

**C.6 Property category matrix** (per portfolio type; "outright" = equity equals value): renting → **1**. Then by relevant property (single→home, double→second, multiple→other aggregate): <360k mortgaged→2 · 360–500k mortgaged→3 · <360k outright→4 · 360–500k outright→5 · 500–800k mortgaged→6 · 500–800k outright→7 · 800k–1.2m mortgaged→8 · 800k–1.2m outright→9. Single-property tops out: >1.2m mortgaged→10, outright→11. Double/multiple continue: 1.2–1.6m mortgaged→10, outright→11 · >1.6m mortgaged→12, outright→13.

## Appendix D — Reasons for year-on-year change (definitive list, workbook rows B217–B252; seed as codes 101–136, display numbering as written)

1 - No year on year comparison, first assessment · 2 - No real change · 3 - Additional family member since last year · 4 - One of their children has left school since last year · 5 - Divorce or separation · 6 - Bereavement · 7 - Illness · 8 - Sudden unemployment · 9 - Self-employed net profit increase/decrease · 10 - Bonus change year on year · 11 - Increase in Benefits · 12 - Salary increase · 13 - New job and decreased pay · 14 - New job and increased pay · 15 - Increased savings · 16 - Inheritance · 17 - Early Pension drawing · 18 - More Profitable or New Investments · 19 - Additional income not disclosed last year · 20 - Stopped work to study · 21 - Became a student · 22 - Mortgage now fully paid · 23 - New property asset acquired · 24 - Property asset has increased in value · 25 - Additional asset not disclosed last year · 26 - Re-mortgage agreement · 27 - Change in accommodation arrangements · 28 - Failure to meet the deadline · 29 - Out of date documents used last year · 30 - Forged or tampered with documents · 31 - Failure to provide required documents · 32 - Other · 33 - Error made by previous assessor · 34 - Reduced Payable fees due to scholarship offer · 35 - Internal Bursary request originally · 36 - Reduced savings

## Appendix E — Reasons for gap (recommended → confirmed payable fees; workbook E217–E226)

1 - Out of sync due to scholarship applied on place offer · 2 - Original Old Assessment Benchmark (2020) · 3 - Pastoral Exceptional Leniency - Social Services · 4 - Pastoral Exceptional Leniency - Fostering · 5 - Pastoral Exceptional Leniency - Homed Boarder · 6 - Out of sync due to new scholarship offered mid cursus · 7 - Internal Bursary Bias - Bereavement · 8 - Internal Bursary Bias - Severe Illness · 9 - Affordability Adjusted Calculation Preferred · 10 - Theoretical Benchmark Calculation Preferred. *(The workbook numbers these 1,2,3,4,5,5,6,7,8,9 with a duplicated "5" — renumber 1–10 as here.)*

## Appendix F — Workbook acceptance vectors

1. **Essentials totals** (cat 1→6): 8879, 13398.50, 16854, 20341.50, 23890, 27294.50.
2. **Savings cushion calc**: (rent+essentials)/2 = 13939.50, 16199.25, 19427, 22670.75, 25945, 29147.25 → rounded reference values 13500, 16000, 19000, 22000, 25500, 28500 (the *seeded* value is the rounded one; the calc is documentation).
3. **Theoretical notional totals**: 37459, 43178.50, 50234, 57321.50, 64470, 71474.50.
4. **Table-8 worked example** (net income £32,600): theoretical available cash by category = −7859, −15078.50, −23634, −32221.50, −40870, −49374.50; affordability band £32,001–35,000 → base 2% → £652, 489, 326, 163, 0, −163 by category.
5. **Award floor**: with the £32,600 example, min-of-three is negative for every category → recommended payable fees = £0 (full-bursary recommendation).
6. **VAT identities**: fees 31450, scholarship 10% → scholarship value 3774 (= 31450×0.10×1.20); bursary award (after VAT) 12000 → school spend before VAT 10000; payable = 31450 − 3774 − 12000 = 15676.
7. **Savings test**: adjustedSavings 5000, debtRepayments 1200, notionalSavings 6000 → test = −2200 → add-back 0. adjustedSavings 12000, debtRepayments 1200, notionalSavings 6000 → +4800 add-back.
