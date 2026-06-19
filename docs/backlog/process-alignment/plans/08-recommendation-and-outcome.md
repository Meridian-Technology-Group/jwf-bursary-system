---
title: Recommendation & outcome — real award terminology
status: in-progress
severity: high
area: recommendation, outcome, schema
wave: 3
depends_on: [01, 07]
blocks: [10]
sources:
  - ../source-materials/meeting-findings.md            # "Recommendation / outcome area"
  - ../source-materials/application-lifecycle-illustration.png  # approved → rolling active; declined → archived
related:
  - 00-current-state-map.md
  - 01-status-and-workflow-model.md
  - prisma/schema.prisma
---

# 08 — Recommendation & outcome

**Objective.** Re-shape the recommendation/outcome surface so it speaks the
Foundation's real language — a **final bursary award** and a **distinct
scholarship award**, with siblings and the "choice between options" Charlotte
said were missing — instead of the current binary qualify/does-not-qualify and
scholarship-as-a-percentage. Swap the 35 placeholder reason codes for the real
paperwork codes, remove the unused assessor-side recommendation PDF, and wire
the AWARDED outcome through to account promotion.

This epic sits **on top of** Epic 01 (which delivers the 3-outcome enum and the
lifecycle split) and Epic 07 (which delivers the fee inputs the award maths
consumes). 01 changes the *enum and transitions*; **08 changes the
recommendation UX, the award model, and the reference data** that ride on them.

---

## 1. Background & rationale

[`meeting-findings.md`](../source-materials/meeting-findings.md) ("Recommendation
/ outcome area") asks for four things:

1. Replace the recommendation/outcome area so it reflects the real process and
   terminology — "**final bursary and scholarship awards** rather than
   simplified qualify/not qualify".
2. Add the missing concepts around **scholarships, siblings, and choice between
   views/options** that Charlotte said were absent.
3. Remove the assessor-side **PDF output** from this step "if it is not used".
4. Replace the current **reason codes** with the actual current paperwork codes
   "if the existing set is outdated/wrong".

The [lifecycle illustration](../source-materials/application-lifecycle-illustration.png)
frames the outcome end-to-end: the panel-level possible outcomes are
**APPROVED BURSARY** / **DECLINED BURSARY**; an *approved* new application
"generates a schedule of rounds for a given amount of years with submission
dates" and the account becomes the rolling **always active** spine; a *declined*
application is **archived**. Outcome is therefore not a leaf — it is the hinge
between assessment and the rolling-account lifecycle (Epic 10).

The status-model half of that hinge (the 3-value enum, the immutable submission
date, the archived state) is **Epic 01's** job. Epic 08 owns the
*assessor-facing recommendation experience* and the *award semantics* that hang
off the AWARDED outcome: how a bursary award and a scholarship award are
captured, how siblings and option-comparisons surface to the assessor, what the
reason codes mean, and what paperwork (if any) the step emits.

---

## 2. Current state

See [00 §E](00-current-state-map.md#e-assessor-assessment-calculations-outcome)
and [00 §A](00-current-state-map.md#a-data-model--enums-prismaschemaprisma). In
brief, confirmed against the code:

- **Outcome is binary.** `AssessmentOutcome { QUALIFIES, DOES_NOT_QUALIFY }`
  (`prisma/schema.prisma:541`). The outcome is written **onto the fused
  `Application.status`** — not onto `Assessment.outcome` — by
  `set-outcome-core.ts:151` (`data: { status: outcome }`), gated on a
  `COMPLETED → QUALIFIES|DOES_NOT_QUALIFY` transition (`:42`). On QUALIFIES it
  idempotently creates an **ACTIVE** `BursaryAccount` and links it (`:83`,
  `:160`). The recommendation form drives it via
  `setApplicationOutcomeAction` (`recommendation-form.tsx:329` →
  `recommendation/actions.ts:116`).
- **`Recommendation` is its own model** (`prisma/schema.prisma:309`):
  `familySynopsis`, `accommodationStatus`, `incomeCategory`,
  `propertyCategory`, `bursaryAward`, `yearlyPayableFees`,
  `monthlyPayableFees`, `dishonestyFlag`, `creditRiskFlag`, `summary`, plus
  reason codes M:N via `RecommendationReasonCode` (`:348`). It carries
  `bursaryAccountId?` + `roundId`. There is **no scholarship field** on the
  recommendation at all.
- **Scholarship = a single percentage.** `Assessment.scholarshipPct`
  (`prisma/schema.prisma:225`, default 0) is a *deduction off gross fees*, not a
  £ award: `calculatePayableFees` does
  `scholarshipDeduction = grossFees * (scholarshipPct/100)`, then
  `netYearlyFees = grossFees − scholarshipDeduction − bursaryAward`
  (`payable-fees.ts:45`). It is entered as a 0–100 input on the assessment form
  (`assessment-form.tsx:1224`) and shown as a deduction line in
  `calculation-display.tsx:242`. **No scholarship-as-£-award concept exists.**
- **Siblings = `SiblingLink` + sequential income absorption.** `SiblingLink`
  (`prisma/schema.prisma:359`) links bursary accounts in a family group by
  `priorityOrder`; `applySiblingDeductions` subtracts each older sibling's
  payable fee from HNDI before the younger child's bursary is computed
  (`sibling.ts:22`). This is purely a *calculation input* — siblings are **not
  surfaced as a comparison/choice** anywhere in the recommendation or outcome
  UI.
- **No "choice between options".** The recommendation produces exactly **one**
  bursary number, taken straight from the completed assessment. There is no
  side-by-side of scenarios (e.g. with/without sibling absorption, bursary-only
  vs bursary+scholarship), nothing the assessor can compare and pick from.
- **Reason codes are 35 generic placeholders** (`prisma/seed-data/reason-codes.ts`
  — "Salary increase", "Property value increased", …) selected on the
  recommendation form via `ReasonCodeSelector` (`reason-code-selector.tsx`,
  bucketed by numeric range: 1–9 Income, 10–19 Property & Assets, 20–29 Family
  Circumstances, 30–39 Risk Flags) and managed/deprecatable in settings
  (`settings/reason-code-table.tsx`, same range→category mapping at `:27`).
  `getReasonCodes` already filters `isDeprecated: false`
  (`queries/recommendations.ts:129`), so deprecation hides a code from new
  selections while historical M:N rows survive.
- **Assessor-side PDF.** `GET /api/pdf/recommendation/[applicationId]`
  (`route.tsx`) renders `RecommendationPDF` (`lib/pdf/recommendation-pdf.tsx`).
  A full-repo grep confirms it is referenced from exactly **one** place — the
  Download-PDF anchor on the recommendation page (`recommendation/page.tsx:151`)
  — plus its own files. It is the **only** `@react-pdf/renderer` consumer in the
  codebase. It still renders `scholarshipPct` as a percentage line
  (`route.tsx:170`, `recommendation-pdf.tsx:543`).
- **Read-only on terminal status.** The recommendation form goes read-only when
  `applicationStatus` is `QUALIFIES` / `DOES_NOT_QUALIFY`
  (`recommendation-form.tsx:245`); the page-level gate requires
  `assessment.status === "COMPLETED"` (`recommendation/page.tsx:74`).
- **Outcome emails** are seeded via migration (single source of truth per
  `CLAUDE.md`): `OUTCOME_QUALIFIES` / `OUTCOME_DNQ`
  (`prisma/migrations/20260513220100_seed_email_templates/migration.sql:100`),
  with a per-template `enabled` flag (`20260524190000_email_template_enabled`).

> **Audit note that de-risks the PDF removal.** The Round Cockpit watchlist
> rule 7 keys off the `RECOMMENDATION_EXPORT` audit action — and that action is
> emitted by the **XLSX/CSV bulk export** route
> (`api/exports/recommendations/route.ts:85`), **not** by the PDF download.
> Removing the PDF therefore does **not** regress the cockpit
> (`queries/round-watchlist.ts:164`, `queries/round-cockpit.ts:164`). The PDF
> emits no audit row of its own.

---

## 3. Target state

Per the meeting findings and the lifecycle illustration:

**Award model — bursary *and* scholarship as distinct £ awards.** The
recommendation captures, alongside the calculated **bursary award**, a separate
**scholarship award** (£) — the academic/merit award the Foundation grants
distinctly from means-tested bursary. Both feed the net-payable maths (Epic 07
owns the fee inputs; 08 owns how the two awards combine into payable fees). The
0–100 `scholarshipPct` deduction is retained for the *fee calculation* it
already performs, but the **outcome/recommendation** now expresses scholarship
as a real award figure rather than only a percentage (Decision **D9**).

**Three outcomes, real terminology.** Building on Epic 01's
`AssessmentOutcome { DOES_NOT_QUALIFY | QUALIFIES_NOT_AWARDED | AWARDED }` and
`Assessment.outcome` column:

- **AWARDED** — the panel's "Approved Bursary". Hands off to Epic 10: continue
  / create the **Active** rolling `BursaryAccount` and generate the forward
  round schedule. The recommendation records the final bursary award and the
  scholarship award that the account carries forward.
- **QUALIFIES_NOT_AWARDED** — assessed as eligible but not granted this round
  (held for retention per Epic 10's tiered policy).
- **DOES_NOT_QUALIFY** — the panel's "Declined Bursary"; on a *new* application
  → archived (Epic 01 sets `archivedAt`).

**Siblings & options surfaced to the assessor.** The recommendation screen shows
the **sibling context** that the calc already consumes (the linked
`SiblingLink` accounts and the income they absorbed) as read-only context, and
presents a **comparison of options** — at minimum bursary-only vs
bursary + scholarship, and, where siblings exist, the with/without-absorption
figures — so the assessor can see and confirm the chosen scenario rather than
inheriting one opaque number. This is the "choice between views/options" gap.

**Reason codes = the real paperwork codes.** The 35 generic placeholders are
replaced with the Foundation's actual current codes (Decision **D4** — held
until Charlotte supplies them). This is a **data** change, not a schema change:
the `ReasonCode` model and the M:N already fit.

**No assessor-side PDF** (Decision **D7**): the route, the renderer, and the
Download button are removed. The *parent-facing* "download my submitted
application as PDF" is a **separate, not-yet-built** deliverable owned by Epic
05 and is unaffected (see §9).

**Outcome → account.** The AWARDED path is the single entry point into the
rolling-account lifecycle; 08 writes the recommendation + award figures and
delegates the account/schedule creation across the Epic 10 interface.

---

## 4. Gap analysis

| Target | Today | Action | Owner |
|---|---|---|---|
| 3-outcome enum on `Assessment.outcome` | binary, written to `Application.status` | Consume Epic 01's enum + outcome column; re-point writes | 01 delivers; 08 consumes |
| Real award terminology (bursary + scholarship) | binary qualify/DNQ; scholarship only a % | Award-decision UX; scholarship as £ award | **08** |
| Scholarship as a distinct £ award | `scholarshipPct` deduction only (`:225`) | Add `scholarshipAward` to `Recommendation`; combine in payable maths | **08** + 07 (D9) |
| Siblings surfaced in the outcome | calc input only (`sibling.ts`) | Read-only sibling context panel on recommendation | **08** |
| Choice between options/views | one opaque number | Options-comparison panel; assessor confirms scenario | **08** |
| Real reason codes | 35 generic placeholders | Data swap: deprecate placeholders, seed real codes (D4) | **08** (blocked on Charlotte) |
| No assessor PDF | route + renderer + button live | Delete all three (D7) | **08** |
| AWARDED → rolling account + schedule | QUALIFIES → ACTIVE account, **no schedule** | Delegate to Epic 10 interface | 10 delivers; 08 calls |
| Outcome emails for 3 outcomes | 2 templates (QUALIFIES/DNQ) | Map AWARDED/QUALIFIES_NOT_AWARDED to templates | **08** (+ migration) |

---

## 5. Proposed approach

> **Sequencing.** 08 lands *after* 01 (enum + lifecycle separation + immutable
> submission) and *after* 07 (current+next-year fees, confirmed inputs). It must
> **read** `Assessment.outcome` and the new fee fields, not the deprecated fused
> `status`. The account-promotion side effect is delegated behind an Epic 10
> interface so 08 can ship before 10's full schedule generator.

### 5.1 Award terminology, scholarship/sibling/options, and the reason-code swap

This is the design core of the epic.

**(a) Bursary award + distinct scholarship award (D9).**

- Add **`scholarshipAward Decimal? @db.Decimal(10,2)`** to `Recommendation`
  (alongside the existing `bursaryAward`). The recommendation thus records *two*
  award figures: the means-tested **bursary award** and the merit
  **scholarship award**.
- Keep `Assessment.scholarshipPct` as the **fee-calculation** lever it already
  is (Epic 07 owns the calc) — but the recommendation/outcome surface now reads
  and presents the **scholarship as a £ award**. Where a scholarship is granted,
  the assessor enters the award amount; the form shows both the percentage
  deduction (calc provenance) and the resulting £ figure so the two stay
  reconciled. (If Charlotte's process turns out to drive scholarship *only* as a
  £ amount, the percentage becomes derived — flagged under D9.)
- Both awards persist onto the `BursaryAccount` on AWARDED so the rolling
  account carries the granted bursary **and** scholarship forward (the schedule
  in Epic 10 benchmarks against them). Add `scholarshipAward` to the account at
  the Epic 10 boundary (interface field), not in 08's own migration, to avoid
  two epics writing the same column.

**(b) Award-decision UX (replaces the QUALIFIES / DOES NOT QUALIFY buttons).**

- The current two-button block (`recommendation-form.tsx:533`) becomes a
  **three-way award decision** matching the real outcomes: **Award**,
  **Qualifies — not awarded**, **Decline**. Copy and confirm-dialog wording use
  the Foundation's terms ("Approve bursary" / "Decline") from the illustration,
  not "qualifies/does-not-qualify".
- The confirm dialog (`OutcomeDialog`, `:181`) is rebuilt for three branches and
  states the consequence of each (Award → email + rolling account opened +
  schedule generated; Decline → email + archived; Qualifies-not-awarded →
  email + retained per policy).
- The form's read-only predicate (`:245`) switches from the
  `QUALIFIES|DOES_NOT_QUALIFY` string check to the Epic 01 outcome/lifecycle
  state, so an already-decided assessment is read-only **except** the synopsis,
  which Epic 06 makes editable post-completion (08 must not re-lock it).

**(c) Siblings & options surfaced.**

- **Sibling context panel** (read-only): list the `SiblingLink` accounts in the
  family group with each one's absorbed payable fee (the numbers
  `applySiblingDeductions` already used), sourced from
  `queries/siblings.ts`. This makes the sequential-absorption assumption visible
  at decision time instead of buried in the engine.
- **Options-comparison panel**: render the calculator's scenarios side by side
  so the assessor *chooses/confirms* rather than inherits — minimum set:
  (i) bursary only, (ii) bursary + scholarship, and, when siblings exist,
  (iii) with vs without sibling absorption. The compared figures come from the
  pure engine (`lib/assessment/`), so this is a presentation layer over existing
  maths plus the new scholarship award — **no new calc** beyond what 07
  delivers. The chosen scenario is what the award figures persist.

**(d) Reason-code swap (D4 — data, not schema).**

The model already supports this cleanly; the swap path is:

1. Receive the real codes from Charlotte (numbers + labels + intended grouping).
2. **Deprecate** the 35 placeholders rather than delete them
   (`isDeprecated = true`) so any historical `RecommendationReasonCode` rows
   remain valid and auditable; `getReasonCodes` already hides deprecated codes
   from new selection (`queries/recommendations.ts:129`).
3. Seed the real codes via the reference-data path. **Reason codes are *not* in
   the demo-only seed** — they belong in the idempotent reference seed
   (`seed-reference.ts`, per `CLAUDE.md`); extend it with an upsert keyed on the
   unique `code`. Do **not** wire them into the demo seed alone.
4. **Range→category coupling.** Both the selector (`reason-code-selector.tsx`,
   `groupReasonCodes`) and the settings table (`reason-code-table.tsx:27`,
   `getCategory`) bucket codes by numeric range (1–9, 10–19, 20–29, 30–39). If
   the real codes don't follow those ranges, update *both* helpers in lockstep
   (single shared `categoryForCode` util) — otherwise the new codes render under
   wrong/`Other` headings.

> If D4 is still unanswered when the rest of 08 is ready, ship everything else
> and land the code swap as its own follow-up PR (the placeholders keep working
> in the meantime).

### 5.2 Schema (Prisma + migration)

Minimal and additive — most of this epic is UX + data, and the enum/lifecycle
columns come from Epic 01.

```prisma
model Recommendation {
  // + scholarshipAward Decimal? @db.Decimal(10,2)  // distinct £ scholarship award (D9)
  // (bursaryAward already present)
}
```

- **No new enum** here — `AssessmentOutcome` (3 values) and `Assessment.outcome`
  are delivered by **Epic 01**. 08 depends on them.
- `BursaryAccount.scholarshipAward` is added at the **Epic 10 boundary**, not in
  08, to keep account-shape changes in one place.
- Migration is additive (nullable column); existing recommendations backfill to
  `NULL` (no scholarship award recorded).

### 5.3 Server actions / API

- **Re-point the outcome writer.** `set-outcome-core.ts` stops writing the
  outcome onto `Application.status` (`:151`) and instead writes
  `Assessment.outcome` (Epic 01's column) via Epic 01's status service. It
  accepts the 3-value outcome; the transition guard (`:42`) widens from the
  single `COMPLETED` source to Epic 01's legal outcome transitions.
- **AWARDED hands off to Epic 10.** Replace the inline ACTIVE-account creation
  (`createBursaryAccountForQualifies`, `:83`) with a call to the Epic 10
  account/schedule interface (`promoteToActiveAccount({ recommendation, awards })`),
  keeping the **idempotency** guarantee (don't double-create for a re-assessment
  that already carries `bursaryAccountId`). 08 defines and calls the interface;
  10 supplies the schedule generation behind it. Until 10 lands, the interface's
  default implementation preserves today's "create ACTIVE account, no schedule"
  behaviour so 08 is shippable.
- **`saveRecommendationAction`** (`recommendation/actions.ts:35`) gains
  `scholarshipAward` in its `UpsertRecommendationInput`; persists it via
  `upsertRecommendation`.
- **Outcome emails for three outcomes.** Map AWARDED → an award-confirmation
  template and QUALIFIES_NOT_AWARDED → its own template; DECLINE keeps the
  decline template. Add the missing template(s) via a **new migration** (seed
  email templates are migration-sourced per `CLAUDE.md`), and extend
  `EmailTemplateType`. (Coordinate enum wording with Epic 01, which renames the
  outcome values.)
- **Audit.** Keep the single canonical `APPLICATION_OUTCOME_SET` row
  (`set-outcome-core.ts:203`); include the chosen outcome + both award figures
  in metadata. No change to `RECOMMENDATION_EXPORT` (that's the XLSX/CSV path and
  the cockpit's rule-7 source — must not be touched).

### 5.4 Remove the assessor PDF (D7)

- Delete `src/app/api/pdf/recommendation/[applicationId]/route.tsx` and
  `src/lib/pdf/recommendation-pdf.tsx`.
- Remove the Download-PDF anchor from `recommendation/page.tsx:151` (and the now
  unused `FileDown` import).
- Drop `@react-pdf/renderer` from dependencies **only after** confirming no other
  importer (grep is currently clean — this is the sole consumer). **Hold the
  dependency removal if Epic 05's parent-PDF lands first or in parallel**, since
  that feature would re-introduce a renderer (see §8/§9).
- No audit/cockpit impact (the PDF emits no audit action; `RECOMMENDATION_EXPORT`
  is unaffected).

### 5.5 UI

- Recommendation form: three-way **award decision** block + rebuilt confirm
  dialog (§5.1b); **scholarship award £** input next to the bursary figure;
  **sibling context** + **options-comparison** panels (§5.1c). Reuse the
  existing flag banners / fee-summary card.
- Reason-code selector/table: unchanged components; new data + (if needed) the
  shared `categoryForCode` util (§5.1d).
- Outcome/lifecycle badges come from Epic 01's typed `OutcomeBadge`; 08 just
  consumes it. Remove the local `status.replace(/_/g," ")` terminal-status copy
  in favour of the real award terms.

### 5.6 Seed / reference data

- **Reference seed:** add the real reason codes to `seed-reference.ts` as
  idempotent upserts (D4); deprecate placeholders. **Not** the demo seed.
- **Demo seed:** populate `scholarshipAward` on a couple of fixtures and ensure
  at least one AWARDED, one QUALIFIES_NOT_AWARDED, and one DECLINED recommendation
  so all three outcomes render.

---

## 6. Work breakdown (PR-sized)

- [ ] **PR-1 (schema, additive):** `Recommendation.scholarshipAward` nullable
      column + migration; thread it through `UpsertRecommendationInput`,
      `saveRecommendationAction`, and the recommendation query serialisation.
- [ ] **PR-2 (outcome writer on Epic 01 surface):** re-point
      `set-outcome-core.ts` to write `Assessment.outcome` (3 values) via the
      status service; widen the transition guard; define the Epic 10
      `promoteToActiveAccount` interface with a default (today's behaviour)
      implementation; preserve idempotency.
- [ ] **PR-3 (award-decision UX):** replace the two QUALIFIES/DNQ buttons with
      the three-way Award / Qualifies-not-awarded / Decline control + rebuilt
      confirm dialog + real terminology; switch the read-only predicate to the
      Epic 01 state (leave synopsis editable per Epic 06).
- [ ] **PR-4 (scholarship £ + siblings + options panels):** scholarship-award
      input; read-only sibling-context panel from `queries/siblings.ts`;
      options-comparison panel over the pure engine; persist the chosen scenario.
- [ ] **PR-5 (remove assessor PDF, D7):** delete route + renderer + Download
      button + `FileDown` import; remove `@react-pdf/renderer` *iff* no other
      consumer (gate on Epic 05's parent-PDF status).
- [ ] **PR-6 (outcome emails):** add AWARDED / QUALIFIES_NOT_AWARDED templates
      via migration; extend `EmailTemplateType`; map outcomes → templates.
- [ ] **PR-7 (real reason codes, D4 — blocked on Charlotte):** deprecate the 35
      placeholders; seed real codes in `seed-reference.ts`; reconcile the
      range→category helpers (shared `categoryForCode`). Shippable independently.
- [ ] **PR-8 (demo seed):** fixtures covering all three outcomes +
      `scholarshipAward`.

---

## 7. Open decisions

From the [Decision register](../README.md#5-decision-register):

- **D4** — real paperwork reason codes (supplier: Charlotte). *Default: hold;
  keep placeholders.* Blocks **PR-7** only; the rest of 08 ships without it.
- **D7** — remove the assessor-side recommendation PDF. *Default: remove.*
  Confirmed sole consumer; no audit/cockpit impact. Drives **PR-5**.
- **D9** — model scholarship as a distinct £ award alongside bursary, and supply
  the scholarship process. *Default: add the award field.* Shapes **PR-1/PR-4**;
  whether `scholarshipPct` becomes derived-from-£ awaits the process detail.
- Cross-epic: AWARDED's account/schedule behaviour is owned by **Epic 10**; 08
  only needs the interface. Outcome **enum naming/values** come from **Epic 01**.

---

## 8. Risks & mitigations

- **Depends on two upstream epics.** 08 reads Epic 01's outcome column +
  transitions and Epic 07's fee inputs. *Mitigation:* gate the merge on 01 and
  07; until then, develop against the interfaces (default impls preserve current
  behaviour) so PRs compile and demo.
- **Scholarship double-counting.** A £ scholarship award plus the existing
  `scholarshipPct` deduction could both reduce fees and diverge. *Mitigation:*
  one is the **calc lever** (07) and one is the **recorded award** (08); the
  form reconciles them on screen, and acceptance checks net-payable equals the
  engine's single computation — never both applied twice.
- **Reason-code range coupling.** Real codes outside 1–39 ranges would mis-group
  in two UIs. *Mitigation:* single shared `categoryForCode`; verify both surfaces
  after the swap.
- **PDF removal vs Epic 05 parent PDF.** 05 needs a *parent-facing* submitted
  PDF, and the renderer we delete is the only `@react-pdf/renderer` consumer.
  *Mitigation:* remove the **assessor** route/renderer/button regardless (it's
  the wrong artefact for parents — it exposes assessor-internal figures), but
  **defer dropping the npm dependency** until 05's needs are settled, so we don't
  add-then-remove-then-re-add the package.
- **Outcome-write blast radius.** Moving the outcome off `Application.status`
  touches reports/queue/cockpit readers of the old fused value. *Mitigation:*
  this is Epic 01's cutover (PR-6 there); 08 must land *after* that cutover and
  read the new column only — do not reintroduce a `status`-based outcome read.

---

## 9. Out of scope / deferred

- **Forward round-schedule generation** on AWARD and account close-on-completion
  → **Epic 10**. 08 only calls the promotion interface.
- **Outcome enum values, immutable submission, archived state** → **Epic 01**.
- **Fee engine changes** (current+next-year fees, auto-populate-then-confirm,
  historical validation) → **Epic 07**. 08 consumes the outputs.
- **Synopsis collapse to one always-visible box, editable post-completion** →
  **Epic 06** (08 must not re-lock the synopsis after a decision).
- **Parent-facing submitted-application PDF** → **Epic 05**. This is a *new*
  renderer with parent-safe content; it is **not** a revival of the assessor PDF
  this epic deletes. (Today there is no parent PDF at all — the deleted file is
  the codebase's only PDF renderer.)
- **VAT applicability** (D8) → **Epic 07**.

---

## 10. Acceptance criteria

- An assessor records a **bursary award and a separate scholarship award (£)** on
  the recommendation; both persist and appear on the resulting `BursaryAccount`
  for an AWARDED outcome.
- The decision control offers **three** real outcomes — Award / Qualifies-not-
  awarded / Decline — using the Foundation's terminology; the binary
  qualify/does-not-qualify wording is gone from the assessor surface.
- **AWARDED** continues/creates an **Active** account via the Epic 10 interface
  (idempotent — no duplicate account for a re-assessment) and a **DECLINE** on a
  new application results in an archived application; both send the correct
  outcome email.
- Net-payable fees equal the engine's single computation with the scholarship
  applied **once** — no double-deduction from combining the £ award with
  `scholarshipPct`.
- The recommendation screen shows **sibling context** (linked accounts + absorbed
  fees) and an **options comparison**, and the chosen scenario is what the award
  figures reflect.
- The **assessor-side recommendation PDF** (route, renderer, button) is removed;
  no broken links; the Round Cockpit watchlist (rule 7 / `RECOMMENDATION_EXPORT`)
  is unaffected.
- When the real reason codes are supplied, the placeholders are **deprecated**
  (not deleted — historical links intact) and the real codes appear in the
  selector and settings, grouped correctly.
- Demo seed renders all three outcomes and a non-null `scholarshipAward`.
