---
title: Assessment calculations & fees — current+next-year fees, validation, non-destructive auto-fill
status: planned
severity: high
area: assessment, calculations, schema
wave: 3
depends_on: [06]
blocks: [08]
sources:
  - ../source-materials/meeting-findings.md   # "Assessment calculations / data structure"
  - ../source-materials/feedback.md
related:
  - 00-current-state-map.md                    # §E (engine, fees, auto-fill)
  - 06-assessor-experience-and-ui.md           # surfaces these fields
  - prisma/schema.prisma                        # SchoolFees, Assessment
  - src/lib/assessment/                         # the pure engine
---

# 07 — Assessment calculations & fees

**Objective.** Make the assessment engine match the Foundation's real model on
three fronts: (1) support **current-year *and* next-year fees** where the
monthly-payment logic needs them; (2) **validate every stage of the engine
against real historical assessments** supplied by the client; and (3) change
auto-population so it is **auto-populate-then-confirm** — reference defaults
fill *empty* inputs but never clobber a value the assessor has independently
entered. The pure engine itself is sound and unit-tested; this epic corrects
its *inputs* (fee sourcing, auto-fill) and *proves* its *outputs* (historical
validation), rather than rewriting the maths.

---

## 1. Background & rationale

[`meeting-findings.md`](../source-materials/meeting-findings.md) → "Assessment
calculations / data structure" asks for four things:

> - Validate all calculations against **real historical assessments**.
> - Make sure assessor-entered values and calculation inputs fully reflect the
>   **agreed assessment model**.
> - Add support for **current-year fees and next-year fees** where needed for
>   calculations / monthly payment logic.
> - Ensure only the correct data is auto-populated; assessor should still
>   independently assess/enter what is required.

These are inputs-and-trust concerns, not engine-correctness ones. Charlotte's
assessment spreadsheets are the ground truth for the numbers; the build must
reproduce them exactly, and the assessor must be able to trust that (a) the
auto-filled defaults are right, and (b) the system will not silently overwrite
a deliberate manual entry when she changes the family type or the fee year.

The "current-year **and** next-year fees" ask is the one genuine *model* gap:
fees rise each academic year, and an award decided in one round is paid across a
school year that spans the fee uplift — so the monthly figure a parent will
actually pay can depend on the *next* year's fee schedule, not the one in force
when the assessment is run. The current build has no concept of more than one
fee figure per school.

This epic is **Wave 3** and **depends on [06]** — Epic 06 rebuilds the assessor
UI surface (responsive layout, the fields panel, the collapsed calc rail) that
these inputs render into. 07 changes *what* those fields source and *how* they
auto-fill; 06 changes *where* they live. It also **blocks [08]**: the
recommendation/outcome screen consumes the payable-fee numbers (gross → net →
yearly → monthly) that this epic finalises, so the award terminology work in 08
sits on top of a validated fee breakdown.

---

## 2. Current state

See [00 §E](00-current-state-map.md#e-assessor-assessment-calculations-outcome).
In brief, confirmed against the code:

- **Pure engine** in `src/lib/assessment/`, orchestrated by
  `calculator.ts:33` (`calculateAssessment`), a side-effect-free pipeline:
  - **Stage 1** household income — `stage1-income.ts:21`
    (`netPay + netDividends + netSelfEmployedProfit + pensionAmount +
    benefitsIncluded`, clamped ≥ 0; `benefitsExcluded` recorded, not summed).
  - **Stage 2** net assets — `stage2-assets.ts:42`: income − notional rent,
    add the rent back if mortgage-free, + additional-property income, −
    council tax, + **derived savings** `(cash + ISAs) / childrenCount /
    yearsRemaining` (`stage2-assets.ts:17`, guards divide-by-zero).
  - **Stage 3** living — `stage3-living.ts:19` (− utilities − food).
  - **Sibling absorption** — `sibling.ts:22` (each older sibling's payable
    fees subtracted from HNDI in priority order).
  - **Stage 4** bursary — `stage4-bursary.ts:21` (`annualFees − hndiAfterNS`,
    clamped to `[0, annualFees]`).
  - **Payable fees** — `payable-fees.ts:38`: scholarship deduction → net (≥ 0)
    → VAT → yearly → **monthly = yearly / 12** → manual adjustment
    (`payable-fees.ts:53,56`).
- **School fees come from a single most-recent row per school.**
  `getSchoolFees` (`src/lib/db/queries/reference-tables.ts:65`) orders by
  `effectiveFrom desc` and keeps the first row per `School`;
  `getConfigsForAssessment` (`:131`) builds a `schoolFeesMap` and resolves
  `annualFees = schoolFeesMap[school] ?? 0`. **There is no current-vs-next-year
  concept** — one school yields exactly one annual figure, and monthly is
  derived as `annual / 12`. The `SchoolFees` table (`prisma/schema.prisma:388`)
  is versioned only by `effectiveFrom @db.Date` with `@@unique([school,
  effectiveFrom])`.
  > The same `effectiveFrom desc` dedup (no `createdAt` tie-break) is the root
  > cause of the settings "edit doesn't save" defect — owned by **[12]** /
  > flagged in [00 §F](00-current-state-map.md#f-settings-auth-audit-retention).
  > 07 must not regress that ordering when it touches the fee read path.
- **Auto-fill overwrites assessor edits.** On family-type change,
  `assessment-form.tsx:415` (`handleFamilyCategoryChange`) unconditionally
  writes `notionalRent`, `utilityCosts`, `foodCosts` from the selected
  category's config — discarding anything the assessor typed. (Initial mount is
  *non-destructive* — it uses `assessment.X ?? default`, e.g.
  `assessment-form.tsx:390-409` — but the change handler is not.) There is no
  per-field "assessor overrode this" marker.
- **Snapshotting:** on save, the form re-runs the pure calculator and persists
  the derived outputs to the `Assessment` row (`assessment-form.tsx:601`), so
  the recommendation/PDF/emails read stored numbers. A one-off
  `scripts/backfill-assessment-calculations.ts` rebuilds these for rows saved
  before that behaviour existed.
- **Engine is unit-tested** — `src/lib/assessment/__tests__/*` (one
  `*.test.ts` per stage plus `calculator.test.ts`), using named-family
  scenarios (e.g. "Okafor Family") with hand-worked expected values. These are
  *synthetic* fixtures, not client historicals.
- **VAT** is applied to the post-bursary net fee (`payable-fees.ts:50`), with a
  schema default of 20% (`prisma/schema.prisma:228`). Whether VAT genuinely
  applies to bursary fees is an open client question — **D8**.

---

## 3. Target state

Per the meeting findings and the scoping model:

1. **Fees support a current year and a next year.** For any school, the engine
   can resolve *two* annual fee figures — the fee in force for the academic
   year being assessed (**current-year**) and the fee for the following
   academic year (**next-year**) — and the assessor UI shows both. The
   monthly-payment logic uses whichever the agreed model dictates (see §5.1 and
   **D14**), and the choice is explicit and visible, not implicit in "the most
   recent row".

2. **Every stage validated against real historical assessments.** A set of
   client-supplied historical cases (inputs + the Foundation's own computed
   outputs) is encoded as fixtures; the engine reproduces each one to the penny
   (within a defined rounding tolerance). Any divergence is either a fixed
   engine bug or a documented, signed-off rule difference — not left ambiguous.

3. **Auto-populate-then-confirm.** Reference defaults (family-type costs,
   council tax, school fees) populate *only empty / untouched* inputs. Once the
   assessor edits a field, changing the family type or fee year **does not**
   overwrite it; instead the UI flags that the live default differs and offers
   a one-click "reset to default". The assessor's independent figure is always
   preserved unless they explicitly re-accept the default.

4. **Inputs reflect the agreed model.** The set of assessor-entered fields and
   their auto-populated defaults matches Charlotte's spreadsheet (council-tax
   default, family-type costs, fee figures, VAT treatment per **D8**). Field
   *additions* are owned by **[06]**; 07 owns their *values and sourcing*.

---

## 4. Gap analysis

| Target | Today | Action | Owner epic |
|---|---|---|---|
| Current-year **and** next-year fee per school | single most-recent row; `annual/12` | Model + resolve two fee figures by fee year; thread both into engine/UI | 07 (§5.1) |
| Monthly logic aware of fee year | `monthly = annual / 12` of the one figure | Decide & implement which fee year drives the payable monthly (**D14**) | 07 (§5.1) |
| Engine validated vs client historicals | only synthetic fixtures | Encode supplied historicals as fixtures; reconcile to the penny | 07 (§5.5, §6) |
| Auto-fill never clobbers edits | category change overwrites 3 fields (`:415`) | Per-field "assessor-overridden" tracking; fill-empties-only; reset-to-default affordance | 07 (§5.2, §5.3) |
| Auto-filled values are *correct* | defaults from reference tables (unverified vs sheet) | Reconcile defaults against the spreadsheet during validation | 07 (§5.5) |
| VAT applicability on bursary fees | applied at 20% default | Confirm via **D8**; keep field, set correct default, document | 07 (§7) |
| Fee read path doesn't reintroduce the settings ordering bug | dedup on `effectiveFrom desc` only | Add deterministic tie-break when extending the fee query | 07 (§5.1) / coord [12] |

---

## 5. Proposed approach

The work is deliberately split so the **pure engine stays pure** and
independently testable. Fee *sourcing* and *UI auto-fill* change around it;
the calculation primitives change only if a historical case proves a rule
wrong.

### 5.1 Schema (Prisma + migration) — current + next-year fees

Two viable designs; **Option A is recommended** because it reuses the existing
versioned-row mechanism and keeps "fees change over time" as the single concept.

**Option A — resolve two effective rows by fee year (recommended).**
Keep the `SchoolFees` table as-is (`prisma/schema.prisma:388`); it is already
versioned by `effectiveFrom @db.Date`. Add a **fee-year resolver** that, given
a school and a target academic year, returns the row effective *for* that year
(the latest row with `effectiveFrom` on/before the year's start) and the row
effective for the *next* year. The "current vs next" pair is then just two
calls to one resolver with `feeYear` and `feeYear + 1`.

- Source of the assessed fee year: `Round.academicYear`
  (`prisma/schema.prisma:40`, already `@unique`) is the natural anchor — the
  round the application belongs to defines "this year"; "next year" is the
  subsequent academic year. (Confirm with **D5**, which already nominates
  `Round.academicYear` as the canonical year source for the parent form's
  tax-year wording — reuse the same anchor here.)
- **Migration:** *additive only*. No column changes to `SchoolFees` are
  strictly required for Option A — the data already supports multiple
  effective rows; what is missing is *data* (a next-year row per school) and a
  *resolver*. If the data does not yet contain forward-dated rows, seeding them
  (§5.4) is the only persistence change. Optionally add a non-breaking
  `notes`/`label` column if the client wants to annotate a fee schedule, but
  that is not required for the calculation.
- **Deterministic ordering:** the resolver must order by `effectiveFrom desc,
  createdAt desc` (adding the `createdAt` tie-break the current dedup lacks) so
  two rows with the same `effectiveFrom` resolve predictably. This is the same
  fix [12] makes for the settings read path — keep them consistent; do not ship
  a fee resolver that re-introduces the non-deterministic ordering.

**Option B — explicit `currentYearFees` / `nextYearFees` inputs.**
Carry two explicit fee figures on the assessment (e.g. add
`nextYearAnnualFees Decimal?` to `Assessment` alongside the existing
`annualFees`, and treat `annualFees` as the current-year figure). Simpler to
reason about per-assessment and lets the assessor override either independently,
but it *denormalises* the fee schedule onto every assessment row and loses the
"one versioned source of truth" property — every fee uplift then has to be
re-entered per assessment instead of seeded once. Use only if the client's
process treats next-year fees as a per-case manual entry rather than a schedule.

> **Decision required — D14 (new):** *Which* fee year drives the **payable
> monthly** figure, and how is an award split across a year that spans a fee
> uplift? Candidate rules: (i) monthly = current-year annual / 12 throughout;
> (ii) monthly = next-year annual / 12 (awards are paid forward); (iii) a
> blended/term-weighted split. The engine change is small once the rule is
> fixed; the *rule* is Charlotte's to confirm. Until then, default to the
> current behaviour (current-year annual / 12) so nothing regresses. Add to the
> [Decision register](../README.md#5-decision-register).

**Engine threading.** Whichever option, the pure calculator gains at most one
new optional input on `AssessmentInput` (`src/lib/assessment/types.ts:47`),
e.g. `nextYearAnnualFees?: number`, consumed only by `payable-fees.ts` to
produce a **next-year monthly** alongside the current one. `PayableFeesResult`
(`types.ts:80`) gains the next-year fields (e.g.
`nextYearYearlyPayableFees`, `nextYearMonthlyPayableFees`). The Stage-4 bursary
maths is unchanged unless **D14** says the bursary itself is computed against
the next-year fee. Keep these additive and defaulted so existing call sites and
the backfill script (`scripts/backfill-assessment-calculations.ts`) keep
compiling.

### 5.2 Server actions / API — non-destructive defaults & fee resolution

- **Fee resolver** lives next to the existing helpers in
  `src/lib/db/queries/reference-tables.ts`: add
  `getSchoolFeesForYear(tx, school, academicYear)` returning
  `{ currentYear, nextYear }` figures, and extend `getConfigsForAssessment`
  (`:131`) to take the assessed `academicYear` and return both. Keep the legacy
  single-figure return for back-compat during rollout.
- The assessment page (`src/app/(admin)/applications/[id]/assessment/page.tsx`
  — already calls `getConfigsForAssessment` at `:240`) passes the round's
  `academicYear` so the resolver can compute current + next.
- **Override tracking.** Persist *which* reference-backed fields the assessor
  has overridden, so re-applying a default is opt-in. Lightest-touch option:
  derive "overridden" by comparing the stored value to the live default at load
  (if they differ, treat as overridden). More robust: a small JSON
  `overriddenFields` marker on the assessment (additive column) set when the
  assessor edits a defaulted field. Prefer the derived approach first — it
  needs no schema change and is correct for the common case; escalate to the
  marker only if the UX in §5.3 needs to distinguish "deliberately equal to
  default" from "never touched".
- The save action already snapshots derived outputs (`assessment-form.tsx:601`
  → `saveAssessmentAction`); extend the snapshot to persist the next-year
  payable figures too, so the recommendation/PDF (Epic 08) can show both
  without recomputation.

### 5.3 UI — auto-populate-then-confirm

All within the assessor form rebuilt by **[06]** (`assessment-form.tsx`):

- **Fix the destructive handler.** Replace `handleFamilyCategoryChange`
  (`assessment-form.tsx:415`) so a family-type change updates `notionalRent /
  utilityCosts / foodCosts` **only for fields the assessor has not edited**.
  For edited fields, leave the value and surface a subtle "default for this
  family type is £X — reset" affordance. Same pattern for council tax and for
  the school-fee figure(s) when the fee year changes.
- **Two fee figures shown.** The reference-data panel shows current-year and
  next-year annual fees (and their monthly equivalents), clearly labelled with
  the academic years they apply to, sourced from the resolver in §5.2. Each is
  independently editable; editing one marks it overridden.
- **Default vs entered is visible.** A field that still holds its auto-filled
  default reads as "default"; once edited it reads as "edited", with the
  reset-to-default control. This is the on-screen expression of
  auto-populate-then-confirm: the assessor *confirms* by leaving the default or
  *assesses* by overriding, and the system never silently reverts either.
- The collapsed calc rail (Epic 06) shows both the current-year and next-year
  payable monthly so the assessor sees the payment implication of the fee
  uplift at a glance.

### 5.4 Seed / reference data

- **`seed:reference`** (idempotent, per repo `CLAUDE.md`) is where school-fee
  rows live. Extend it to seed *both* a current-year and a next-year
  `SchoolFees` row per school (distinct `effectiveFrom` dates) so Option A's
  resolver has forward data to find. Keep upserts idempotent
  (`@@unique([school, effectiveFrom])`).
- Reconcile the seeded **family-type costs, council-tax default, and fee
  figures** against Charlotte's spreadsheet as part of validation (§5.5) — the
  values must match the agreed model, not just be present.
- **`seed:demo`** fixtures gain at least one assessment exercising the
  next-year fee path so the UI state is demonstrable.

### 5.5 Validation against historical assessments

This is the heart of the epic and is **gated on client data** (see §7).

- Obtain a representative set of **completed historical assessments** from the
  client: for each, the full input set (incomes, property/savings, family type,
  council tax, fees, scholarship %, VAT, manual adjustment, sibling fees) **and**
  the Foundation's own computed outputs (household income, net assets, HNDI,
  required bursary, net/yearly/monthly payable fees).
- Encode each as a fixture in the existing test harness, mirroring the
  named-family style already in `src/lib/assessment/__tests__/calculator.test.ts`
  (e.g. the "Okafor Family" case). Assert the engine reproduces every stage
  output within a documented rounding tolerance (the engine rounds money to 2dp
  via `roundMoney` in `payable-fees.ts:14`; pick a tolerance consistent with the
  spreadsheet's own rounding).
- For any mismatch, triage into: **(a)** an engine bug → fix the relevant stage
  and add a regression test; **(b)** a rule the spreadsheet applies that the
  engine omits (e.g. a different fee-year basis, a rounding convention, an
  ordering of sibling absorption) → raise as a decision, implement once
  confirmed; or **(c)** a data-entry artefact in the historical sheet → note
  and exclude with justification.
- Re-run `scripts/backfill-assessment-calculations.ts --dry-run` against the
  non-prod DB after any engine change to confirm no *unexpected* drift in
  already-stored assessment outputs, then apply if the diff is the intended
  correction.

---

## 6. Work breakdown (PR-sized)

- [ ] **PR-1 (fee resolver + ordering):** add `getSchoolFeesForYear` /
      current+next resolution to `reference-tables.ts` with deterministic
      `effectiveFrom desc, createdAt desc` ordering; unit tests. No UI yet.
      (Additive; coordinate ordering fix with [12].)
- [ ] **PR-2 (engine — next-year fees):** additive optional `nextYearAnnualFees`
      on `AssessmentInput`; extend `payable-fees.ts` + `PayableFeesResult` to
      emit next-year yearly/monthly; default-preserving so all call sites and
      the backfill script compile. Engine tests for the new path.
- [ ] **PR-3 (wiring):** thread `Round.academicYear` → `getConfigsForAssessment`
      → assessment page → form; snapshot next-year payable figures on save.
- [ ] **PR-4 (non-destructive auto-fill):** rewrite `handleFamilyCategoryChange`
      and the council-tax / fee-year handlers to fill-empties-only; add
      per-field overridden detection + reset-to-default affordance. (Lands into
      the Epic-06 form.)
- [ ] **PR-5 (UI — two fee figures):** render current + next-year annual and
      monthly fees with year labels and edited/default state; calc rail shows
      both payable monthlies.
- [ ] **PR-6 (seed):** add next-year `SchoolFees` rows to `seed:reference`
      (idempotent); demo fixture exercising the next-year path; reconcile seeded
      defaults to the spreadsheet.
- [ ] **PR-7 (historical validation):** *(gated on client data)* encode supplied
      historicals as fixtures; reconcile to the penny; fix or document each
      divergence; dry-run the backfill and apply if it is the intended
      correction.

---

## 7. Open decisions

- **D8** — Is VAT actually applied to bursary fees, or is the field legacy?
  *(default: keep, default 0 — but the engine currently defaults 20 at
  `prisma/schema.prisma:228`; confirm the real default.)* —
  [register](../README.md#5-decision-register). Blocks the correctness of every
  payable-fee figure validated in §5.5.
- **D14 (new)** — Which fee year drives the **payable monthly**, and how is an
  award split across a fee-uplift boundary? *(default: current-year annual / 12,
  i.e. no change, until confirmed.)* Add to the register; owner Charlotte.
- **D5** — Confirms `Round.academicYear` as the single source for the assessed
  fee year (already nominated for the form's tax-year wording). Reuse here.
- **Dependency (not a decision):** §5.5 and **PR-7** are **blocked on the
  client supplying real historical assessments with their computed outputs**.
  Flag this to Charlotte early — it is the long-pole item and the rest of the
  epic (PR-1…PR-6) can proceed without it, but the epic is not "done" until the
  engine is reconciled against real cases.

---

## 8. Risks & mitigations

- **Validation reveals an engine rule is wrong.** A historical case may diverge
  because the real model differs (fee-year basis, rounding, sibling order, VAT).
  *Mitigation:* the engine is pure and fully unit-tested — fixes are localised
  to one stage with a regression test; the triage in §5.5 keeps "bug" vs "rule
  difference" explicit so we change behaviour only with sign-off.
- **Changing engine outputs silently re-writes stored assessments.** Saved rows
  hold snapshotted outputs (`assessment-form.tsx:601`); a rule fix could change
  historical numbers. *Mitigation:* always `--dry-run` the backfill first and
  diff counts/values before applying; never apply against prod from a local
  machine without approval (repo `CLAUDE.md`).
- **Fee-resolver ordering re-introduces the settings bug.** The current dedup
  is non-deterministic on same-day `effectiveFrom` ([00 §F]). *Mitigation:* add
  the `createdAt` tie-break in PR-1; share the fix with [12].
- **Auto-fill override detection misfires** — a value that legitimately equals
  the default could be mistaken for "untouched" and get overwritten on the next
  category change. *Mitigation:* prefer the explicit `overriddenFields` marker
  (§5.2) over pure value-comparison if QA shows the derived approach is
  ambiguous; the marker is an additive, defaulted column.
- **Next-year fee data absent.** Option A's resolver returns nothing for "next
  year" if no forward-dated row exists. *Mitigation:* seed forward rows in PR-6;
  resolver falls back to the current-year figure (and the UI labels it as
  "next-year fee not yet set") rather than erroring.

---

## 9. Out of scope / deferred

- **Assessor UI layout / new field additions** → **[06]** (07 only changes the
  sourcing and auto-fill behaviour of fields, not which fields exist or where).
- **Award terminology, scholarship-as-£, sibling/option choice, reason codes,
  outcome→account promotion** → **[08]** (consumes the validated fee numbers).
- **Income sub-table rebuild** (status-driven Employed/Self-employed/Benefits
  rows feeding Stage 1) → **[02]** (parent form). 07 validates Stage 1 against
  historicals but does not restructure the income *capture*.
- **Reference-data settings ordering bug fix** as a standalone defect → **[12]**
  (07 only ensures its own fee read path uses the corrected ordering).

---

## 10. Acceptance criteria

- For any school, the assessor sees a **current-year and a next-year** annual
  fee (with the academic years labelled) and their monthly equivalents; both
  are editable.
- The **payable monthly** is computed per the rule confirmed in **D14**; with
  no change confirmed, it remains current-year annual / 12 and nothing
  regresses.
- Changing the **family type** (or fee year, or council-tax basis) updates only
  the reference-backed fields the assessor has **not** edited; edited fields are
  preserved and offer an explicit "reset to default". No assessor entry is ever
  silently overwritten (regression test on the old `:415` behaviour).
- Every **client-supplied historical assessment** is reproduced by the engine to
  within the agreed rounding tolerance, across all stages and the payable-fee
  breakdown; each divergence is either fixed (with a regression test) or
  documented and signed off.
- Seeded reference defaults (family-type costs, council tax, fees) **match the
  Foundation's spreadsheet**; `seed:reference` stays idempotent and seeds
  forward-dated fee rows.
- The fee read path orders deterministically (`effectiveFrom desc, createdAt
  desc`) — same-day fee edits resolve predictably.
- `D8` (VAT applicability) is resolved and the VAT default reflects the answer;
  the payable-fee figures validated above use the confirmed VAT treatment.
