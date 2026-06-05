---
title: Application form re-scope — rebuild the 8 sections to the scoping workbook
status: planned
severity: high
area: portal, forms, schema
wave: 2
depends_on: [01, 04]
sources:
  - ../source-materials/application-form-scoping.md   # authoritative target spec (8 sections)
  - ../source-materials/feedback.md                   # asks #1 and #4
  - ../source-materials/meeting-findings.md           # "Parent form changes"
related:
  - 00-current-state-map.md
  - 01-status-and-workflow-model.md
  - 04-lead-applicant-contacts-and-invitations.md
  - prisma/schema.prisma
---

# 02 — Application form re-scope

**Objective.** Rebuild the parent application form so its eight sections match
the Foundation's actual scoping workbook
([`application-form-scoping.md`](../source-materials/application-form-scoping.md)).
The headline is the **income model**: the current flat 14-line-per-parent table
is replaced with the workbook's **status-driven income sub-tables**
(Employed / Self-employed / Benefits / Unemployed / Retired / Divorced-or-separated /
Third-party). Alongside that: finish the four live stubs, replace the bespoke
per-section document checks with a **reusable required-document rule engine**,
derive **dynamic tax-year wording** from the round, make **phone + email
mandatory**, ship the **real declaration text** with a **per-parent tick for
both parents**, and split the identity capture into the **new-vs-rolling
variant** (full ID for new applications, hidden for rolling-over).

This is the parent-facing rebuild of Wave 2. It reads the lifecycle and the
locked invite data laid down in Waves 1.

---

## 1. Background & rationale

Client testing surfaced that several form areas were built against an
early/assumed model, not the real one. The asks come from three places:

- [`feedback.md`](../source-materials/feedback.md) **ask #1** — "Add in the
  questions that are not currently showing on the form from the scoping
  document," and **ask #4** — two visual application options (new vs
  rolling-over) where *"a new application will be the full application form with
  the mandatory ID documents section and a rolling-over bursary application will
  be the application form with the ID section hidden / not required."*
- [`meeting-findings.md`](../source-materials/meeting-findings.md) **"Parent
  form changes"** — rework the form to match the scoping document, **remove gross
  pay**, **remove bonus**, remove other wrong-model parent questions, replace the
  declaration text with the real wording, make **telephone mandatory**, make
  **email mandatory and explicitly captured even if the invite was emailed**,
  auto-populate the **"left employment since April …"** wording from the round's
  tax year, show the **stored address** when the child shares the parent's
  address, and add the **postcode logic** transport/bursary processing needs.
- [`application-form-scoping.md`](../source-materials/application-form-scoping.md)
  is the authoritative structure — the faithful transcription of the workbook's
  eight sections, branch logic, and per-field document uploads. Where the
  workbook hard-codes the 2025-26 tax year, the build derives it from the round
  (Decision **D5**).

These are one body of work because they share the same substrate: the per-section
JSONB form-data model, the section wizard, and the gap/required-document engine.
Re-scoping income without also re-scoping the document rules, the declaration,
and the identity section would leave the form internally inconsistent.

---

## 2. Current state

See [00 §B](00-current-state-map.md#b-parent-application-form-srcappportal)
for the grounded snapshot. In brief:

- **Wizard.** Sequential one-page-per-section at `/apply/[section]`, driven by
  `SECTION_ORDER` (`apply/[section]/page.tsx:60`). Forms live in
  `src/components/portal/sections/`; each is a react-hook-form + Zod form wired
  through `section-form.tsx`. Cross-section gap analysis is
  `lib/portal/section-gaps.ts`, which feeds the sidebar tri-state and the Review
  screen.
- **Persistence.** Form data is **JSONB per section**: `ApplicationSection.data`
  keyed by `ApplicationSectionType` (10 values, `prisma/schema.prisma:581`) and
  `ownerContributorId`. TypeScript shapes for each section's blob live in
  `src/types/application.ts`.
- **Income — the biggest divergence.** A **flat 14-line model per parent**:
  `INCOME_FIELDS` (`parents-income-form.tsx:31`) and `parentIncomeRecordSchema`
  (`lib/schemas/parents-income.ts:8`). It includes wrong-model lines —
  `supplementsAndBonus` ("Any supplement(s) and/or bonus"), `amountFromPartner`,
  `salaryWagesPension` lumped together — and is **not status-driven**: all 14
  lines show regardless of employment status. **Missing entirely**: the March
  payslip upload, itemised benefits rows (UC / Housing Benefit / Child Benefit /
  Tax Credits / ESA / PIP / Carer's / Childcare), SA302 numeric fields (property
  income, dividends, interest as discrete cells), the P45 / redundancy block, the
  retired pension rows, the divorced/separated maintenance rows, and the
  third-party support rows. The **per-parent TOTAL is not entered on the form** —
  it is computed downstream at the assessment/Review stage.
- **Live STUBS** ("future work package" placeholders):
  - dependent-elderly details (`dependent-elderly-form.tsx:68`, `:117`) — count
    captured, per-elder details deferred;
  - other-info court-order upload (`other-info-form.tsx:60`) — amount captured,
    evidence upload deferred;
  - assets other-properties repeatable table (`assets-liabilities-form.tsx:184`)
    — a single total captured, per-property rows deferred;
  - additional-info circumstance uploads (`additional-info-form.tsx:56`) — toggle
    captured, supporting-document upload deferred.
- **School & entry-year are parent-picked, not locked.** School is chosen on the
  onboarding card (`onboarding-card.tsx:91`, radio) **and** re-picked in step 1
  (`child-details-form.tsx:80`, select); the entry-year group is a free select
  (`child-details-form.tsx:108`). The Application already carries
  `school: School` (`schema.prisma:86`) and `entryYearGroup: EntryYearGroup?`
  (`schema.prisma:90`) — they are simply not write-locked to the applicant.
- **Required-document rules are bespoke per section.** `section-gaps.ts` hand-codes
  one `GapEvaluator` per `SectionType` in `SECTION_EVALUATORS` (`:119`): birth
  certificate always-required (`:123`), per-parent P60 always + SA302/benefits
  if-value>0 + capital-repayments if-true (`:280`), council-tax + bank-statements
  always (`:392`), and `() => []` no-op passthroughs for FAMILY_ID, DEPENDENT_ELDERLY,
  OTHER_INFO, ADDITIONAL_INFO. The progress maths even carries a hand-maintained
  `SECTION_ITEM_TOTALS` table (`:530`) because the rule set is not enumerable.
- **Declaration is split and generic.** A single closing acceptance tick + a
  free-text signature name (`declaration-form.tsx:21`, the `DECLARATION_POINTS`
  array is placeholder copy), **plus** a separate per-parent declaration tick
  nested inside parent-details (`parent-details-form.tsx:660`,
  `declarationAccepted`). Neither is the workbook's real wording, and the closing
  declaration is a single tick, not one per parent.
- **Identity is its own top-level step.** `FAMILY_ID` is a standalone wizard
  section (`family-id-form.tsx`), whereas the workbook nests identity inside
  "Details of Child" as **Q10 — Identification for all family members**.
- **New-vs-rolling scaffolding already exists** but keyed on a heuristic.
  `isReassessment: Boolean` (`schema.prisma:91`) drives
  `HIDDEN_REASSESSMENT_SECTIONS = [FAMILY_ID]` (`reassessment.ts:38`) and the
  FAMILY_ID skip/redirect in `apply/[section]/page.tsx:135`. There is **no
  explicit `applicationType`** — that is introduced by Epic 01.
- Uploads post to `/api/documents` (`api/documents/route.ts`) → Supabase Storage,
  tagged by `slot` and contributor. The submit gate re-runs `getSectionGapStatuses`
  as defence-in-depth and blocks on any error-severity gap (`apply/actions.ts:408`).

---

## 3. Target state

Per [`application-form-scoping.md`](../source-materials/application-form-scoping.md),
the form presents **eight content sections** plus a How-to-apply / Checklist /
Validation-Summary scaffold (the landing-page How-to / Checklist tabs and the
T&Cs are **Epic 05**; this epic owns the eight form sections and the validation
summary that lists outstanding mandatory items).

**Section map (workbook).** Details of Child · Parental/Guardian Details · Other
Information Required · Parents' Income · Parents' Assets & Liabilities ·
Additional Information · Declaration · (Validation Summary). Identity moves
**inside** Details of Child.

Key targets:

1. **Income — status-driven sub-tables** (workbook §6). Per parent, the column
   shows the sub-tables matching what they declared, each with its own numeric
   rows and required upload:
   - **Employed** — gross earned income / annual salary (PAYE, as on P60) →
     **P60** (dated April YYYY) **and** **March YYYY payslip** (≥1 of the two
     mandatory). *Removes `supplementsAndBonus` / bonus and the lumped
     `salaryWagesPension` line — meeting-findings "remove gross pay / bonus".*
   - **Self-employed (SA302)** — gross salaried income; property income;
     dividends; additional other interest/investment income → **SA302**.
   - **On benefits** — itemised rows: Universal Credit (excl. childcare) → UC
     12-month statement **and** 3 monthly UC docs; Housing Benefit → award
     letter; **Child Benefit → number only, upload non-mandatory**; Child/Working
     Tax Credit, ESA, Disability/PIP, Carer's, Childcare Support, Other →
     other-benefits docs.
   - **Unemployed / in between roles (last 12 months)** — final gross pay → **P45**;
     redundancy/severance → letter; JSA → award letter; grant/support → letter;
     parental/adoption/sickness pay → status-change doc.
   - **Retired** — State Pension; Private Pension & Other Plan → pension docs.
   - **Divorced or separated** — Child Maintenance Allowance received → letter +
     shared-custody free text.
   - **Third-party support** — Additional Income Support received + who/how/how-long
     free text.
   - The rule: **"if a sub-section has a value other than £0 its upload is
     mandatory — except Child Benefit."** Each parent's column ends with a
     **TOTAL (£)** = sum of all numeric cells (now **entered/shown on the form**,
     not only computed at Review) and a compulsory **"I confirm all documents on
     this page are correct and legible"** tick.
   - Header wording is dynamic: *"GROSS INCOME (before tax) from all sources for
     the financial year ended 4 April **YYYY**"*, "March **YYYY** payslip", and
     the SA302 tax-year — all derived from the round (**D5**).

2. **Finish the four stubs** to the workbook:
   - **Dependent elderly** (workbook §4 Q12/Q13) — per-elder: first/surname/DOB/
     care-home name/yearly fees/**latest invoice upload**.
   - **Other Information → court orders** (workbook §5 Q1) — amount + which school
     year + **evidence upload**; plus child-maintenance, insurance-policy, and
     outstanding-fees branches.
   - **Assets → other properties** (workbook §6/7 Q2) — repeatable "add property"
     (Address line 1, postcode, market value, mortgage balance, monthly
     repayment, used-as-rental Y/N, **latest mortgage statement upload**).
   - **Additional Information** (workbook §7) — list current uploads, a
     **mandatory** free-text field (≥1 char to proceed), and an **upload area**
     for docs not covered by the checklist.

3. **Required-document rule engine** — a single declarative table driving both
   the in-form upload prompts and the gap/submit gate, replacing the bespoke
   per-section evaluators. Rule kinds: **required-always**, **required-if-value>0**
   (the workbook's £0 rule), **required-if-true** (toggle branches),
   **required-one-of** (P60 *or* March payslip), and **non-mandatory** (Child
   Benefit; lease/car docs). See §5.

4. **Dynamic tax-year wording** — one helper derives every date/tax-year string
   from `Round.academicYear` (**D5**); no hard-coded "2025-26" / "to April 2025"
   left in the forms.

5. **Mandatory phone + email** on the contact block of each parent
   (workbook §4 Q3/Q6), email explicitly captured even when the invite was
   emailed (meeting-findings).

6. **Real declaration text** — the workbook's per-parent declaration (§4 Q5/Q8)
   **and** closing declaration (§8) with **both** a Parent/Guardian 1 tick **and**
   a Parent/Guardian 2 tick (not the single closing tick today). Final wording per
   Decision **D11**.

7. **New-vs-rolling identity variant** — identity capture (workbook §3 Q10) is
   shown for **new** applications and **hidden** for **rolling-over**. This is
   keyed on Epic 01's explicit `applicationType` (`NEW | ROLLING_OVER`), replacing
   today's `isReassessment` heuristic, while reusing the existing FAMILY_ID
   skip/redirect machinery.

8. **Locked school + entry-year** — Q1 (school) and the entry-year become
   **display-only** in the form, set at admin invite (Decision **D1**; the lock
   itself is owned by **Epic 04**). The child's address "same as Parent 1?" shows
   the **stored** parent address rather than free-text re-entry (workbook §3 Q7;
   meeting-findings).

---

## 4. Gap analysis

| Target (workbook) | Today | Action |
|---|---|---|
| Status-driven income sub-tables (7 statuses) | Flat 14-line model, status-agnostic (`parents-income-form.tsx:31`) | Replace with per-status sub-tables; new JSONB shape |
| Remove gross-pay / bonus / lumped lines | `supplementsAndBonus`, `amountFromPartner`, `salaryWagesPension` present | Drop from schema + form |
| March payslip; P45 block; pension rows; maintenance rows; third-party rows | Absent | Add per-status rows + uploads |
| Itemised benefits rows (UC/HB/CB/Tax Credits/ESA/PIP/Carer's/Childcare) | Single "working tax credits" + "other benefits" cells | Add itemised rows; CB number-only, upload non-mandatory |
| SA302 as discrete numeric cells | Lumped into flat lines | Add property/dividend/interest cells gated by self-employed |
| Per-parent TOTAL shown on form | Computed at Review only | Surface running TOTAL in the income column |
| Dependent-elderly per-elder details + invoice | Count only (stub) | Repeatable per-elder block + upload |
| Court-order / property / circumstance uploads | Amount/toggle only (stubs) | Finish uploads + repeatable property table |
| Required-doc rule engine | Bespoke `SECTION_EVALUATORS` per section | Declarative rule table + generic evaluator |
| Dynamic tax-year wording | Hard-coded "To April"/2025-26 in copy | Round-derived helper (**D5**) |
| Mandatory phone + email | Email implicit from invite; phone optional | Make both required in schema + UI |
| Real declaration, both parents tick | Placeholder copy; single closing tick + per-parent tick in parent-details | Real wording; P1 **and** P2 closing ticks (**D11**) |
| Identity nested in Details of Child | Standalone FAMILY_ID step | Keep section internally, present under Details of Child; variant by type |
| Hide ID for rolling-over | Keyed on `isReassessment` heuristic | Re-key on Epic 01 `applicationType` |
| Locked school + entry-year, display-only | Parent-picked (`onboarding-card.tsx:91`, `child-details-form.tsx:80/:108`) | Display-only; lock owned by **Epic 04** (**D1**) |
| Child address shows stored parent address | Free-text re-entry | Read stored parent address when "same as Parent 1" |

---

## 5. Proposed approach

### 5.1 Schema (Prisma + migration)

**The JSONB-per-section model stays.** Recommendation: **yes, keep
`ApplicationSection.data: Json` keyed by `ApplicationSectionType`.** The form is
inherently a sparse, branchy, frequently-reshaped document; a normalised column
explosion (or per-field tables) would be far more churn for the income rework and
would fight the contributor-scoped section ownership already wired
(`ownerContributorId`, dual-parent). JSONB also lets each section's shape evolve
in `src/types/application.ts` + Zod without a migration per field. The cost —
no DB-level validation of the blob — is already mitigated by the per-section Zod
schema being the single write gate, and we **strengthen** that here. So the
**income rework is a TypeScript-type + Zod-schema change, not a Prisma
migration.**

**How the income sub-tables are shaped inside the JSONB.** Reshape
`ParentIncomeRecord` (`types/application.ts`) and `parentIncomeRecordSchema`
(`lib/schemas/parents-income.ts`) from a flat 14-field bag into a
**discriminated, status-keyed object** — present sub-blocks only for the
statuses the parent declared, e.g.:

```ts
interface ParentIncomeRecord {
  employed?: { annualSalaryPaye: number;
               p60DocumentId?: string; marchPayslipDocumentId?: string };  // one-of required
  selfEmployed?: { grossSalaried: number; propertyIncome: number;
                   dividends: number; otherInvestmentIncome: number;
                   sa302DocumentId?: string };
  benefits?: { universalCredit: number; housingBenefit: number;
               childBenefit: number; /* number only, upload optional */
               childWorkingTaxCredit: number; esa: number; pipOrDla: number;
               carersAllowance: number; childcareSupport: number; other: number;
               ucStatementDocumentId?: string; ucMonthlyDocumentIds?: string[];
               housingBenefitDocumentId?: string; otherBenefitsDocumentId?: string };
  unemployed?: { finalGrossPay: number; redundancy: number; jsa: number;
                 grantSupport: number; leavePay: number;
                 p45DocumentId?: string; redundancyDocumentId?: string; /* … */ };
  retired?: { statePension: number; privatePension: number;
              pensionDocumentId?: string };
  divorcedSeparated?: { maintenanceReceived: number;
                        sharedCustodyNote: string; maintenanceDocumentId?: string };
  thirdParty?: { incomeSupportReceived: number; supportNote: string };
  total: number;                 // running sum, surfaced on the form
  documentsConfirmed: boolean;   // legibility tick
}
```

The presence of a sub-block is gated by the **employment status** captured in
PARENT_DETAILS (`EmploymentStatus`), so the income column and the gap engine read
the same source of truth. `parentsIncomeSchema` keeps `parent1Income` +
optional `parent2Income` (sole-parent unchanged). **Old → new is a one-way
field-mapping** for any in-flight drafts (see migration note below).

**No new enum values; no Application column changes here.** `applicationType`,
`formStatus`, and the immutable submission date all land in **Epic 01**. The
`ApplicationSectionType` enum (`schema.prisma:581`) is unchanged — identity stays
the `FAMILY_ID` section internally; only its *presentation* moves under "Details
of Child", and its visibility is driven by `applicationType`.

**Migration / data note.** Because in-progress drafts on staging hold the old
flat income blob, ship a **one-off idempotent data backfill** (a script, run once,
under the migration discipline in `CLAUDE.md` — additive, reversible-by-design)
that maps legacy income fields into the new shape where unambiguous (e.g.
`salaryWagesPension → employed.annualSalaryPaye` when the parent's status is
Employed) and leaves the rest for the applicant to re-enter, marking
`PARENTS_INCOME.isComplete = false` so the form re-validates. Submitted
applications are immutable (Epic 01) and are **not** rewritten — their JSONB is
read through a back-compat reader.

### 5.2 Server actions / API

- **Required-document rule engine.** Introduce
  `src/lib/portal/document-rules.ts` exporting a declarative rule set keyed by
  `SectionType`, each rule one of: `requiredAlways`, `requiredIfValueGt0(path)`,
  `requiredIfTrue(path)`, `requiredOneOf([slotA, slotB])`, `optional`. A single
  generic evaluator turns a rule + the section blob + the uploaded-slot set into
  `SectionGap[]`. `section-gaps.ts` becomes a thin adapter that runs the rule
  engine instead of hand-coded `SECTION_EVALUATORS`, and the
  `SECTION_ITEM_TOTALS` hack (`:530`) is **deleted** — totals/progress derive
  from the enumerable rule list. The submit gate (`apply/actions.ts:408`) is
  unchanged in shape; it keeps consuming `getSectionGapStatuses`.
- **Dynamic tax-year helper.** `src/lib/portal/tax-year.ts` derives, from
  `Round.academicYear`: `financialYearEndedLabel` ("financial year ended 4 April
  2025"), `marchPayslipLabel` ("March 2025 payslip"), `sa302TaxYearLabel`, and
  the "left employment since April YYYY" wording. The section page already loads
  `round.academicYear` (`apply/actions.ts:363`) — thread it into
  `SectionPageClient` so the forms render derived copy (**D5**).
- **Identity variant.** Replace the `isReassessment`-keyed visibility in
  `apply/[section]/page.tsx:135` and `HIDDEN_REASSESSMENT_SECTIONS`
  (`reassessment.ts:38`) with Epic 01's `applicationType === "ROLLING_OVER"`.
  Keep `isReassessment` as a derived accessor during the transition (per Epic 01's
  back-compat plan) so this epic depends on **01** but does not re-implement it.
- **Locked school + entry-year.** The form renders these **display-only** from
  `application.school` / `application.entryYearGroup`; the write-lock (rejecting
  any applicant attempt to change them) is enforced at invite/section-save by
  **Epic 04**. This epic removes the parent-facing pickers
  (`onboarding-card.tsx:91`, `child-details-form.tsx:80/:108`) and shows the
  locked values.
- **Stored child address.** When "child's address same as Parent 1" is Yes,
  read the stored Parent 1 address from PARENT_DETAILS rather than duplicating
  free-text (workbook §3 Q7).

### 5.3 UI

- **Income form rebuild** (`parents-income-form.tsx`) — render the sub-tables for
  the statuses the parent declared (read `EmploymentStatus` from PARENT_DETAILS,
  already threaded as `isSoleParent` is today via the section page's cross-section
  read at `apply/[section]/page.tsx:185`). Each sub-table is its own small
  component with its rows + conditional `FileUpload` slots; a live **TOTAL**
  footer sums the numeric cells; the legibility tick stays. Reuse `CurrencyInput`,
  `YesNoToggle`, `ConditionalField`, `FileUpload`.
- **Stub completion** — replace the four "future work package" placeholder cards
  with the real repeatable blocks + uploads (elderly per-elder, court-order
  evidence, other-properties table, additional-info uploads). The other-properties
  and elderly blocks reuse the `useFieldArray` pattern already in
  `family-id-form.tsx`.
- **Identity under Details of Child** — present the `FAMILY_ID` capture within the
  child-details step's flow (or as an adjacent panel) so the applicant experiences
  it as workbook §3 Q10, while the underlying section record stays `FAMILY_ID`.
  Hidden entirely for `ROLLING_OVER`.
- **Declaration** (`declaration-form.tsx`) — swap `DECLARATION_POINTS` for the
  real closing declaration text and render **two** acceptance ticks (P1 and P2,
  P2 hidden when sole parent). The per-parent declaration inside parent-details
  (`parent-details-form.tsx:660`) is reconciled to the workbook §4 Q5/Q8 wording
  (**D11**).
- **Contact block** — mark phone + email required in the parent-details schema and
  UI (workbook §4 Q3/Q6).
- **Validation Summary** — the existing Review screen (`apply/review/page.tsx`)
  already lists outstanding items from the gaps; extend its copy to the workbook's
  per-section phrasing ("Parent/Guardian 1 – Property Income answer is not filled
  in", etc.). No new screen.

### 5.4 Seed / reference data

- Update `seed:demo` income/section fixtures to populate the **new** income shape
  across the demo families so each employment status renders. No reference-data
  (`seed:reference`) change — school fees / council-tax / reason-codes are
  untouched by this epic.

---

## 6. Work breakdown (PR-sized)

Sequenced so the rule engine lands first (every section build consumes it), then
one PR per section group, then the cross-cutting items.

- [ ] **PR-1 — Required-document rule engine.** Add
      `lib/portal/document-rules.ts` (declarative rules + generic evaluator) and
      `lib/portal/tax-year.ts` (round-derived wording). Refactor `section-gaps.ts`
      to run the engine; delete `SECTION_ITEM_TOTALS`. Thread `round.academicYear`
      into `SectionPageClient`. No behavioural change to existing rules (proven by
      keeping current gap snapshots green). Unit tests for each rule kind.
- [ ] **PR-2 — Income rebuild (status-driven sub-tables).** Reshape
      `ParentIncomeRecord` (`types/application.ts`) + `parentsIncomeSchema`;
      rebuild `parents-income-form.tsx` into per-status sub-tables with TOTAL +
      uploads; wire the income document rules in the engine (P60-or-payslip
      one-of, SA302/benefits/P45 if-value>0, Child Benefit non-mandatory). Add the
      one-off draft backfill script + back-compat reader for submitted blobs.
- [ ] **PR-3 — Finish the stubs.** Dependent-elderly per-elder details + invoice;
      other-info court-order/insurance/maintenance/fees uploads;
      assets other-properties repeatable table + mortgage-statement upload;
      additional-info mandatory narrative + uploads. Wire each into the rule
      engine.
- [ ] **PR-4 — Identity variant + nesting.** Re-key ID-section visibility on Epic
      01 `applicationType` (replace `isReassessment` heuristic in
      `apply/[section]/page.tsx` + `reassessment.ts`); present `FAMILY_ID` under
      Details of Child for `NEW`, hidden for `ROLLING_OVER`. Encode the per-family-
      member passport/ILR document rules (the `FAMILY_ID: () => []` no-op today).
- [ ] **PR-5 — Declaration + contact mandatories.** Real closing declaration text
      with P1 **and** P2 ticks; reconcile the per-parent declaration wording;
      make phone + email required (schema + UI). (**D11**.)
- [ ] **PR-6 — Locked school/entry-year + stored address.** Remove the parent
      school/entry-year pickers, render them display-only from the application;
      show the stored Parent 1 address on "same address". (Coordinates with **Epic
      04**, which owns the write-lock; **D1**.)
- [ ] **PR-7 — Seed + Validation-Summary copy.** Update `seed:demo` to the new
      income shape across statuses; align Review/Validation-Summary phrasing to the
      workbook.

Each schema-type change ships in the PR that needs it; the only data migration is
the one-off draft backfill in PR-2 (additive, idempotent, reversible-by-design).

---

## 7. Open decisions

Linked to the [Decision register](../README.md#5-decision-register):

- **D1** — School + entry-year locked at admin invite, form Q1 display-only.
  *(default: lock at invite; Q1 display-only)* — owner Charlotte. **Lock owned by
  Epic 04; this epic consumes it.**
- **D3** — Replace the flat 14-line income model wholesale with the scoping
  sub-tables. *(default: yes — full rebuild)* — owner Charlotte. **The premise of
  PR-2.**
- **D5** — `Round.academicYear` is the single source for the "to April YYYY" /
  payslip-month / SA302 wording. *(default: derive from round)* — owner
  Brian/Charlotte. **The premise of `tax-year.ts`.**
- **D11** — Final per-parent + closing declaration text. *(default: use
  scoping-workbook text)* — owner Charlotte. **Blocks PR-5 copy.**

---

## 8. Risks & mitigations

- **Income reshape breaks downstream readers.** The assessment engine
  (`stage1-income.ts`) and the year-on-year re-assessment carry-over
  (`reassessment.ts` PREPOPULATED/FINANCIAL sections) read the income blob.
  *Mitigation:* a back-compat reader that accepts both shapes; map the new
  sub-tables to the assessment's expected inputs in the same PR; keep the
  pre-population copy-forward working (it copies blobs verbatim, so a submitted old
  blob still pre-populates — the new round's form then re-validates under the new
  schema). Assessor-side field changes belong to **Epic 06/07** — do not regress
  them here.
- **Draft data loss on staging.** In-flight drafts hold the old income shape.
  *Mitigation:* the one-off backfill maps the unambiguous fields and flags
  `PARENTS_INCOME` incomplete so nothing is silently mis-assessed; communicate that
  testers may need to re-confirm income.
- **Dependency on Epic 01 not yet merged.** The identity variant and any
  `applicationType` read depend on **01**. *Mitigation:* land PR-1/PR-2/PR-3
  (engine, income, stubs — none need `applicationType`) first; gate PR-4 behind 01;
  use the derived `isReassessment` accessor 01 promises so the switch is a one-line
  change.
- **Required-one-of and non-mandatory rules.** P60-*or*-payslip and the Child
  Benefit exception are easy to get wrong in a generic engine. *Mitigation:*
  explicit `requiredOneOf` / `optional` rule kinds with unit tests asserting the
  workbook's exact "value>0 ⇒ upload, except Child Benefit" behaviour.
- **Gap/progress regressions.** Swapping `SECTION_EVALUATORS` for the engine could
  shift the sidebar tri-state or the submit gate. *Mitigation:* snapshot current
  gap output for the demo fixtures and diff before/after in PR-1.

---

## 9. Out of scope / deferred

- Landing-page **How-to-apply / Checklist tabs** and **T&Cs display/acceptance** →
  **Epic 05** (this epic builds the eight form sections + the per-section
  validation summary, not the home-page guidance scaffold).
- **Explicit `applicationType` / `formStatus` / immutable submission date** →
  **Epic 01** (this epic consumes them).
- **Locked school/entry-year *enforcement*** (the write-lock at invite/save) →
  **Epic 04** (this epic renders them display-only).
- **Drafts, countdown, deadline-missed lockout, read-only submitted summary +
  PDF, portal missing-doc upload** → **Epic 05**.
- **Assessor-side field additions / calc inputs** consuming the new income shape →
  **Epic 06 / 07**.
- **Separated/divorced/widowed question-subset depth** (which sub-tables to ask
  per household type) → **Epic 09** (this epic ships the sub-tables; 09 tunes the
  subset logic).

---

## 10. Acceptance criteria

- The Parents' Income section renders **status-driven sub-tables** matching the
  parent's declared employment status, with the workbook's rows, a live per-parent
  **TOTAL**, and the legibility tick — and **no** gross-pay / bonus / lumped-salary
  lines remain.
- The **"value>0 ⇒ upload mandatory, except Child Benefit"** rule holds for every
  income sub-section, enforced both in-form and at the submit gate, via the
  declarative rule engine (no bespoke per-section evaluator left for income).
- The March payslip, P45/redundancy block, SA302 numeric cells, itemised benefits
  rows, retired pension rows, divorced/separated maintenance rows, and third-party
  support rows all exist and validate per the workbook.
- All four former stubs (dependent-elderly details, court-order upload, other-
  properties table, additional-info uploads) are fully functional with their
  required documents.
- Tax-year wording everywhere ("financial year ended 4 April YYYY", "March YYYY
  payslip", "left employment since April YYYY", SA302 year) is **derived from the
  round** — no hard-coded 2025-26 string remains (**D5**).
- Phone **and** email are mandatory on each parent's contact block; email is
  captured explicitly even when the invite was emailed.
- The Declaration shows the **real** wording with a **Parent/Guardian 1 tick and a
  Parent/Guardian 2 tick** (P2 hidden when sole parent) (**D11**).
- A **new** application shows the identity section (workbook §3 Q10); a
  **rolling-over** application hides it — driven by Epic 01 `applicationType`, not
  the old heuristic.
- School and entry-year are **display-only** in the form, populated from the
  locked invite values (**D1**); "child same address as Parent 1" shows the stored
  parent address.
- The required-document rule engine is the single source for required-doc gaps;
  `SECTION_ITEM_TOTALS` is gone and progress/totals derive from the rule list.
- `seed:demo` exercises every employment status; the gap output for the demo
  fixtures is unchanged where rules are unchanged (before/after diff clean).
