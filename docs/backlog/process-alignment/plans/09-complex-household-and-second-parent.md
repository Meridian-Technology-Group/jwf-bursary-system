---
title: Complex household & second parent — encode the household rules, validate the dual-parent flow
status: planned
severity: medium
area: household, assessment, forms
wave: 3
depends_on: [02, 06]
sources:
  - ../source-materials/application-form-scoping.md   # §1 FAQ household scenarios; §4 P/G2; §5 maintenance/court; §6 divorced-or-separated block
  - ../source-materials/meeting-findings.md           # "Second parent / complex household handling"
related:
  - 00-current-state-map.md
  - 01-status-and-workflow-model.md
  - prisma/schema.prisma
---

# 09 — Complex household & second parent

**Objective.** The dual-parent *plumbing* already shipped (contributor model,
restricted secondary portal, assessor combine-vs-override). What has **not**
shipped is the **policy** that decides, for each real household shape
(separated / divorced ± school-fees court order / widowed / foster / remarried /
mid-divorce), **who is assessed**, **what evidence is requested**, and **which
parent is the lead applicant** for shared custody. Those rules live only in the
"How to Apply" FAQ prose today — codified nowhere. This epic validates the
existing flow against the real process and turns the FAQ scenarios into encoded,
testable handling, flagging the genuinely-ambiguous rules as decisions for
Charlotte.

> **Framing.** This is a *domain-rules* epic, not a schema epic. The data model
> for two parents exists. The deliverables are mostly "encode rule + validate
> with client" tasks (guidance copy, branch logic, evidence routing, an
> assessor decision aid) plus one small schema addition (shared-custody / lead
> designation) that only lands if Decision **D15** is answered "yes".

---

## 1. Background & rationale

The scoping workbook's **Section 1 "How to Apply" FAQ**
([application-form-scoping.md §1](../source-materials/application-form-scoping.md))
enumerates the household scenarios the Foundation actually handles, and gives
each a concrete rule. Paraphrasing the FAQ answers (verbatim in the `.xlsx`):

- **Single / long-separated / widowed / foster** — assess the **one** resident
  parent/guardian; no second-parent income.
- **Separated (not divorced)** — assess **both** natural parents; the resident
  parent is the lead; the non-resident parent supplies their own income.
- **Divorced *with* a court order for school fees** — the Foundation **cannot
  support** the application: the court order's terms conflict with a
  discretionary bursary (the fees are already someone's legal liability).
- **Divorced *without* a school-fees court order** — assess **like separated**:
  both parents' income, resident parent leads.
- **Remarried sole parent** — assess **both original natural parents *and* the
  new spouse** (three incomes): the household the child lives in now plus the
  absent natural parent.
- **Mid-divorce with finances not yet disentangled** — the Foundation **may
  decline / defer**: it cannot fairly assess a household whose income and assets
  are in flux.
- **Shared custody** — *who is the lead applicant?* **50/50** → treat **both as
  lead applicants** (either may hold the account); **main + limited** custody →
  the **main-custody** parent is the lead, **both are assessed**.

[meeting-findings.md](../source-materials/meeting-findings.md) ("Second parent /
complex household handling") gives the matching client ask: *review and validate
the second-parent flow; confirm the combined-income / separated-parent logic
aligns with the real process; ensure the second-parent section asks only the
right subset of questions.*

The build satisfies the **mechanics** (see §2) but encodes **none of the
policy**: a divorced-with-court-order applicant can sail through the form, and an
assessor gets no signal that the case is out of scope; "remarried → three
incomes" has no representation (the model is binary PRIMARY/SECONDARY); and
"lead applicant" is a single FK with no shared-custody concept.

---

## 2. Current state

See [00 §A (ApplicationContributor)](00-current-state-map.md#a-data-model--enums-prismaschemaprisma),
[00 §B](00-current-state-map.md#b-parent-application-form-srcappportal),
and [00 §G](00-current-state-map.md#g-already-satisfied--partially-built-do-not-rebuild).
Grounded against the code:

**Dual-parent mechanics — shipped (do not rebuild):**

- `ApplicationContributor` (`prisma/schema.prisma:156`): `role` PRIMARY/SECONDARY,
  `status` INVITED/IN_PROGRESS/SUBMITTED, `@@unique([applicationId, role])` —
  so **at most two** parents per application by construction
  (`ApplicationContributorRole` `:551`, `ApplicationContributorStatus` `:556`).
- The second parent supplies **their own** section data via
  `ApplicationSection.ownerContributorId` (`:129`) and uploads via
  `Document.uploadedByContributorId` (`:197`).
- Restricted secondary portal is a separate route group:
  `src/app/(contribute)/contribute/*` — the second parent fills only their own
  subset, not the whole form.
- Invite path: `addSecondParentAction` (`src/app/(admin)/invitations/actions.ts:1005`)
  creates the SECONDARY contributor + a scoped `Invitation` + sends
  `SECONDARY_PARENT_INVITE`. Email types `SECONDARY_PARENT_INVITE` /
  `_REMINDER` / `_RECEIVED` (`schema.prisma:610`).
- Assessor control: `Assessment.secondaryParentOverride` +
  `secondaryParentOverrideReason` (`:237`). The **begin gate**
  (`.../assessment/actions.ts:44`, `checkSecondParentGate`) blocks assessment
  when a second parent was invited but has not submitted, unless the assessor
  uses `proceedWithoutSecondParentAction` (`:120`) with a reason.
- Assessor UX: `assessment-form.tsx:1009-1067` switches Section B copy/labels on
  `forceTwoEarner` (a SUBMITTED secondary exists → "combine both parents in
  Stage 1") vs `secondaryParentOverride` (→ "primary applicant only").
- GDPR for the second contributor: `src/lib/db/queries/secondary-gdpr.ts`.

**Form — the household *inputs* (`src/components/portal/sections/`):**

- `parent-details-form.tsx`: the **sole-parent toggle**
  ("Are you applying as a sole parent / guardian?", `:727`) and **relationship
  status** radios (Single / Married / Widowed / Separated / Divorced / Civil
  Partnership / Cohabiting, `:62`). When **not** sole, the P/G2 block opens with
  the *same* questions (`ConditionalField show={isSoleParent === false}`, `:787`).
- A `secondaryMode` prop (`:707`) renders the restricted secondary view (P/G1
  layout only, sole-parent toggle suppressed) — this is what the second parent
  sees in `(contribute)`.

**What is NOT modelled / NOT encoded — the gap this epic owns:**

- **No scenario rules anywhere.** A grep for the FAQ rules (shared-custody,
  "cannot support", reject/defer) finds **no logic** — only substring noise in
  unrelated route filenames. The marital status is captured as an *informative
  tick* and drives **nothing** downstream.
- **Relationship status ≠ assessment behaviour.** "Divorced" never asks whether
  a **school-fees court order** exists *for the purpose of the cannot-support
  rule*; "Separated"/"Divorced" don't change which incomes are required.
- **The divorced/separated evidence surface is missing from the form.** Scoping
  **§5 Q2** (child maintenance → divorced? upload **decree absolute**;
  separated? confirm the mutual agreement) is **absent** from
  `other-info-form.tsx` (which only has court-order/insurance/outstanding-fees,
  and its court-order upload is a dead **stub**, `:60-67`). Scoping **§6's "If
  divorced or separated" block** (maintenance received + shared-custody
  free-text) is likewise not in `parents-income-form.tsx` (only a flat
  `maintenanceOrEquivalents` line, `:42`). **Both surfaces are owned by Epic 02**
  to build; **this epic owns the *branch logic and evidence routing* on top.**
- **Three-income households are unrepresentable.** The contributor model caps at
  two (`@@unique([applicationId, role])`), so "remarried → both natural parents
  *and* new spouse" has no first-class home (workaround in §5/§9).
- **No shared-custody / dual-lead concept.** `Application.leadApplicantId`
  (`:85`) is a single FK; `@@unique([roundId, leadApplicantId, childName])`
  (`:108`) assumes one lead. 50/50 "both are lead applicants" cannot be
  expressed; account ownership for shared custody is undefined.
- **Foster carer / guardian** is collapsed into "sole parent" with no
  guardianship evidence ask.

---

## 3. Target state

The FAQ scenarios become an explicit, encoded decision table. **§3.1 is the
authoritative matrix** the form branch-logic and the assessor decision aid both
derive from.

### 3.1 Scenario → handling matrix

Inputs are the parent-details **relationship status** + **sole-parent toggle**,
plus two *new* discriminators the form must capture (owned by Epic 02, branched
here): **"school-fees court order?"** and, for shared care, a **custody split**.
`R` = resident/main-custody parent; `NR` = non-resident/absent natural parent;
`S` = new spouse/partner.

| # | Scenario (relationship + facts) | Who is assessed | Lead applicant | Evidence requested | System handling |
|---|---|---|---|---|---|
| H1 | **Single** / never-partnered | R only | R | Standard single-parent set | Sole-parent path; no P/G2 |
| H2 | **Long-separated** (no contact, no maintenance) | R only | R | + brief note of estrangement | Sole-parent path; assessor may note |
| H3 | **Widowed** | R only | R | + **death certificate** of the deceased parent | Sole-parent path; evidence ask added |
| H4 | **Foster carer / legal guardian** | Guardian(s) only | Guardian | + **evidence of guardianship / foster status** | Sole-parent path; guardianship ask |
| H5 | **Separated** (not divorced) | R **and** NR | R | NR supplies own income; + **mutual maintenance agreement** (free-text/decl.) | Two-parent path (invite NR as SECONDARY) |
| H6 | **Divorced, NO school-fees court order** | R **and** NR | R | NR income; + **decree absolute**; + maintenance evidence | Treat **as H5** (two-parent) |
| H7 | **Divorced, WITH school-fees court order** | — (out of scope) | — | Court order is the disqualifier | **Cannot support** — flag at form + hard signal to assessor; likely decline |
| H8 | **Remarried sole parent** | R **and** NR **and** S | R | Three incomes: R+S (household) and NR (absent natural parent) | **Three-party** (see §5.1 workaround) |
| H9 | **Mid-divorce, finances not disentangled** | R (+ NR if reachable) | R | As separated, but flagged unstable | **May decline / defer** — assessor decision, surfaced |
| H10 | **Shared custody — 50/50** | Both natural parents | **Both are lead applicants** | Both incomes; custody split stated | Dual-lead (Decision **D15**); either may hold account |
| H11 | **Shared custody — main + limited** | Both natural parents | **Main-custody** parent | Both incomes; custody split stated | Single lead = main; NR as SECONDARY |

> The rows collapse to four *handling shapes*: **sole-parent** (H1–H4),
> **two-parent** (H5, H6, H11), **three-party** (H8), and **gate/flag**
> (H7 cannot-support, H9 may-defer). H10 adds a lead-designation variant.

### 3.2 Form behaviour (the right question subset)

- The **sole-parent toggle** + **relationship status** drive which downstream
  blocks appear. Concretely (logic this epic specifies; fields built in Epic 02):
  - **Widowed** → reveal a **death-certificate** upload (H3).
  - **Foster/guardian** (captured via a new relationship value *or* a
    "applying as a guardian?" facet — D16) → reveal a **guardianship evidence**
    upload (H4).
  - **Separated / Divorced** → reveal the **§5 Q2 maintenance block** and the
    **§6 "divorced or separated" income block** (maintenance received +
    shared-custody free-text), and ask **"Is there a court order specifically
    for school fees?"** If **Divorced + yes** → show the **cannot-support
    notice** (H7) and route the application to the assessor flagged.
  - **Divorced** → require **decree absolute**; **Separated** → require
    confirmation of the **mutual maintenance agreement** (per scoping §5 Q2).
- **Second-parent (P/G2) subset — validated, not rebuilt.** The restricted
  secondary view (`secondaryMode`, `parent-details-form.tsx:707`) must ask the
  second parent **only**: their own contact block, their **own income & evidence**
  (the §6 per-parent column), and **their own declaration** — **not** the
  child/household-level questions (school, dependants, court orders, the
  household's assets), which belong to the lead. This epic's job is to **audit
  the live `(contribute)` section list against that subset** and trim/justify
  any leakage.
- **Shared custody** (D15): when relationship implies shared care, capture the
  **custody split** (50/50 vs main+limited); 50/50 designates **both** as lead
  applicants.

### 3.3 Assessor behaviour

- Keep the existing combine-vs-override UX (`assessment-form.tsx:1009`), but add
  a **household decision aid**: a compact, always-visible panel that states the
  **derived scenario** (from relationship + court-order + custody) and the
  **expected handling** from §3.1 — e.g. *"Divorced, school-fees court order
  present → cannot support (see policy)."* for H7, or *"Remarried sole parent →
  assess R + new spouse as the household and NR as the absent natural parent"*
  for H8.
- For **H7 (cannot support)** and **H9 (may defer)**, the aid surfaces the rule
  and links to the outcome (Epic 08) — it **advises**, it does not auto-decline
  (the assessor remains the decision-maker; final terminology/reason codes are
  Epic 08's).
- **Combined-income vs sole-parent** assessment stays driven by the contributor
  set + `secondaryParentOverride` exactly as today; H8's third income is keyed
  per §5.1.

---

## 4. Gap analysis

| Target (from §3) | Today | Action |
|---|---|---|
| Scenario rules encoded + testable | FAQ prose only; nothing in code | New `household-rules` module: relationship+facts → scenario → handling (§5.2) |
| Relationship status drives form branches | informative tick; drives nothing | Wire status → reveal widowed/foster/divorced-separated blocks (Epic 02 fields, this epic's logic) |
| School-fees-court-order discriminator | not asked for the cannot-support purpose | Add the Q + H7 cannot-support notice/flag |
| §5 Q2 maintenance + decree-absolute / mutual-agreement | absent from `other-info-form.tsx` (stub) | Epic 02 builds fields; **09 owns the branch + evidence routing** |
| §6 "divorced or separated" income block | flat `maintenanceOrEquivalents` line only | Epic 02 builds; 09 owns the conditional reveal |
| Widowed → death cert; foster → guardianship | no such asks | Add evidence asks gated on status |
| Second-parent asks only its subset | restricted view exists; **subset not audited** | Audit `(contribute)` sections vs §3.2; trim leakage |
| Three-income (remarried) household | model caps at two contributors | §5.1 workaround + Decision **D17** |
| Shared-custody / dual-lead | single `leadApplicantId` FK | Decision **D15**; optional `custodyArrangement` + dual-lead handling |
| Assessor sees derived scenario + handling | only combine/override banners | Household decision-aid panel reading the rules module |

---

## 5. Proposed approach

### 5.1 Schema (Prisma + migration) — minimal, decision-gated

The two-parent model is sufficient for **H1–H7, H9, H11**. Only two rows need
schema, and **both are gated on decisions** so the bulk of the epic can land
without migrations:

```prisma
// Gated on D15 (shared custody / dual lead). Persisted on Application.
enum CustodyArrangement { SOLE  SHARED_5050  SHARED_MAIN_LIMITED }
model Application {
  // + custodyArrangement CustodyArrangement @default(SOLE)
  // For SHARED_5050, "both are lead applicants" — see the dual-lead note below.
}
```

- **Dual-lead (H10).** `leadApplicantId` stays the *account-holding* lead.
  50/50 is recorded via `custodyArrangement = SHARED_5050` **plus** the second
  natural parent already present as the SECONDARY `ApplicationContributor`;
  "either may hold the account" is a **policy** statement, not a second FK.
  Avoid widening `@@unique([roundId, leadApplicantId, childName])` (`:108`) —
  twin/one-account-per-child is **Epic 04's** constraint; do not regress it.
- **Remarried / three incomes (H8) — do NOT add a THIRD contributor role.**
  The `@@unique([applicationId, role])` two-party invariant is load-bearing
  across the secondary portal, the begin gate, and GDPR. Instead (Decision
  **D17**): key the **resident household** (R + new spouse S) into the existing
  **two-earner** assessment (Parent 1 = R, Parent 2 = S) — which the engine
  already combines — and capture the **absent natural parent's** maintenance via
  the §5 Q2 / §6 maintenance fields rather than as a third full income column.
  This reuses shipped machinery; a true 3-contributor model is **deferred** (§9).
- **No new evidence columns.** Death certificate, decree absolute, guardianship,
  and court-order docs ride the existing `Document` slots + the §5/§6 form
  fields (Epic 02). This epic only adds the **rules**, not storage.

### 5.2 Server / domain logic

- **`src/lib/household/rules.ts` (new) — the single source of truth.** A pure,
  unit-tested function `deriveHouseholdScenario(input) → { scenario, handling }`
  where `input` = `{ relationshipStatus, isSoleParent, hasSchoolFeesCourtOrder,
  custodyArrangement, isWidowed, isGuardian }` and `handling` encodes §3.1:
  `assessees` (`SOLE | TWO_PARENT | HOUSEHOLD_PLUS_ABSENT`), `leadRule`,
  `requiredEvidence[]`, and `gate` (`NONE | CANNOT_SUPPORT | MAY_DEFER`). No DB,
  no side-effects — so both the form and the assessor read identical logic.
- **Form server actions (Epic 02 owns the fields; 09 owns the wiring):** the
  parent-details / other-info / income save paths call `deriveHouseholdScenario`
  to decide which §5/§6 blocks are required and whether to attach the H7
  cannot-support marker to the application.
- **Assessor read path:** the assessment loader computes the scenario from the
  submitted contributor data and passes `{ scenario, handling }` to the form for
  the decision-aid panel (§5.3). Reuses the existing
  `forceTwoEarner` / `secondaryParentOverride` inputs; adds the derived scenario
  alongside them.
- **Begin/override interplay:** unchanged. `checkSecondParentGate`
  (`.../assessment/actions.ts:44`) and `proceedWithoutSecondParentAction`
  (`:120`) keep owning *whether a second parent has submitted*; the rules module
  only owns *which scenario applies and what it implies*.

### 5.3 UI

- **Parent form (logic only here; controls in Epic 02):** conditional reveals
  per §3.2 driven by `deriveHouseholdScenario`; the **H7 cannot-support notice**
  (an inline, non-blocking explanatory panel — the applicant may still submit,
  but is told the court order likely precludes support, mirroring the FAQ).
- **Restricted secondary view:** audit and, if needed, trim the section list in
  `(contribute)/contribute/[section]` so the second parent sees **only** the
  §3.2 subset; add a short "you're contributing income to *<child>*'s
  application" framing if missing.
- **Assessor decision-aid panel:** a compact card in `assessment-form.tsx` near
  the Section B banner (`:1009`) rendering `handling.scenario` +
  `handling.gate` + the expected assessment shape. For H7/H9 it shows a
  prominent flag and links to the outcome step (Epic 08).

### 5.4 Seed / reference data

- Extend `seed-demo` (per repo `CLAUDE.md`, demo seed only — **never** the
  idempotent `seed:reference`) with at least one fixture per *handling shape*:
  a separated two-parent case, a divorced-with-court-order (H7) case, a
  remarried (H8) case, and a 50/50 shared-custody (H10) case, so each branch and
  the assessor aid are demoable.
- No reference-data tables change (these are policy rules, not versioned
  reference rows).

---

## 6. Work breakdown (PR-sized)

Ordered so the **rules engine + validation** (the core of this epic) land early
and independently; schema-touching work is last and decision-gated.

- [ ] **PR-1 (rules engine):** `src/lib/household/rules.ts` +
      exhaustive unit tests covering all of H1–H11 from §3.1. Pure, no DB. Ships
      as the contract the form and assessor consume. *(encode + validate)*
- [ ] **PR-2 (second-parent subset audit):** diff the live `(contribute)`
      section list against §3.2; trim any child/household-level leakage; add the
      contributor framing copy. Document the validated subset. *(validate)*
- [ ] **PR-3 (assessor decision aid):** wire `deriveHouseholdScenario` into the
      assessment loader; render the household panel near `assessment-form.tsx:1009`
      with the derived scenario + handling + H7/H9 flags. *(encode)*
- [ ] **PR-4 (form branch logic — depends on Epic 02 fields):** consume the
      rules engine in parent-details/other-info/income to gate the widowed,
      foster, divorced/separated, maintenance, and school-fees-court-order
      reveals; render the H7 cannot-support notice. *(encode; blocked on 02)*
- [ ] **PR-5 (shared custody — gated on D15):** `CustodyArrangement` enum +
      `Application.custodyArrangement` (additive, default SOLE) + capture in the
      form + dual-lead handling for H10. Skip if D15 = no.
- [ ] **PR-6 (remarried handling — gated on D17):** the §5.1 two-earner-household
      + absent-parent-maintenance encoding for H8, plus an assessor note. Skip /
      defer to a true 3-contributor model if D17 directs otherwise.
- [ ] **PR-7 (seed + docs):** demo fixtures per handling shape (§5.4); update the
      assessor/admin guide with the household decision table.

---

## 7. Open decisions

These extend the [Decision register](../README.md#5-decision-register) (new
rows **D15–D17**, proposed here for Charlotte). Most §3.1 rules are
**policy not yet codified anywhere** — they need explicit client confirmation
before they harden into branch logic, because getting them wrong changes *who is
assessed*.

| # | Question | Default if unanswered | Owner |
|---|---|---|---|
| D15 | Shared custody: model 50/50 as **both lead applicants** (add `CustodyArrangement`, dual-lead semantics)? Or keep a single lead and treat 50/50 as a note? | Add `CustodyArrangement`; 50/50 ⇒ either may hold account | Charlotte |
| D16 | Foster/guardian: a distinct **relationship-status value** ("Guardian / Foster carer") vs a separate "applying as a guardian?" facet — and what guardianship evidence is mandatory? | Add a guardian facet + guardianship-evidence upload | Charlotte |
| D17 | Remarried (3 incomes): key R+spouse as the **two-earner household** and treat the absent natural parent via maintenance fields (reuse two-party model)? Or build a true 3-contributor model? | Reuse two-party + maintenance; defer 3-contributor | Charlotte / Brian |
| — | **Confirm every §3.1 row verbatim** against the workbook FAQ — esp. H7 *cannot support* (is it a hard decline or assessor-discretion?) and H9 *may defer* (decline vs pause). | Treat H7/H9 as **assessor-surfaced flags**, not auto-decline | Charlotte |

Also depends on the existing register entries: **D11** (per-parent declaration
wording — the second parent's declaration tick) and the Epic 02 field decisions
(D3 income sub-tables) that build the surfaces this epic branches on.

---

## 8. Risks & mitigations

- **Policy mis-encoding changes who gets money.** The FAQ is paraphrased here;
  the `.xlsx` is authoritative and the rules are nuanced (H7 vs H6 hinges on
  *whether the court order is specifically for school fees*). *Mitigation:* the
  rules engine ships **first, behind unit tests**, and **every row is
  client-confirmed** (§7) before the form/assessor consume it; until confirmed,
  the assessor aid is **advisory copy**, never an automatic outcome.
- **Two-party invariant is load-bearing.** `@@unique([applicationId, role])`
  underpins the secondary portal, begin gate, and GDPR. *Mitigation:* H8's third
  income reuses the two-earner household (§5.1, D17) rather than a third role;
  no change to the contributor uniqueness.
- **Overlap with Epic 02 (form fields) and Epic 06 (assessor combine/override).**
  This epic must not rebuild either. *Mitigation:* 09 owns **logic/branching and
  the decision aid**; 02 owns the **controls/validation**; 06 owns the
  **combine-vs-override mechanics**. PR-4 is explicitly gated on 02's fields.
- **Don't regress one-account-per-child (Epic 04).** Dual-lead must not widen
  `@@unique([roundId, leadApplicantId, childName])`. *Mitigation:* model shared
  custody as `custodyArrangement` + the existing SECONDARY contributor, not a
  second lead FK.
- **Inline H7 notice could read as a hard rejection** to an applicant whose
  order is *not* school-fees-specific. *Mitigation:* word it as "this may
  preclude support — the Foundation will review" and gate it strictly on the
  *school-fees* court-order answer, not any court order.

---

## 9. Out of scope / deferred

- **True ≥3-contributor model** (first-class third parent/spouse) — deferred;
  H8 is handled via the two-earner-household + maintenance workaround (§5.1).
  Revisit only if D17 demands it.
- **Form field controls** for §5 Q2 (maintenance / decree absolute / mutual
  agreement), the §6 "divorced or separated" income block, and the
  school-fees-court-order question → **Epic 02** builds them; 09 branches on them.
- **Combine-vs-override assessor mechanics** and the calculation of combined
  income → already shipped / **Epic 06**; 09 only adds the scenario read-out.
- **Outcome terminology & reason codes** for *cannot support* / *deferred* →
  **Epic 08** (this epic surfaces the flag; 08 names the outcome and supplies the
  real paperwork code).
- **Retention** of declined cannot-support cases → **Epic 10**.

---

## 10. Acceptance criteria

- `deriveHouseholdScenario` returns the **correct handling for every row H1–H11**
  in §3.1 (unit-tested), and is the **only** place the rules live (form and
  assessor both import it).
- A **divorced applicant with a school-fees court order (H7)** sees the
  cannot-support notice in the form **and** the assessor sees an unmistakable
  cannot-support flag on the assessment — confirmed against the workbook FAQ.
- **Separated / divorced-without-order (H5/H6)** applicants are routed to the
  **two-parent** path and prompted for the **right evidence** (decree absolute /
  mutual agreement, maintenance), with the resident parent as lead.
- **Widowed (H3)** and **foster/guardian (H4)** stay sole-parent but are asked
  for **death-certificate** / **guardianship** evidence respectively.
- The **second parent's restricted view asks only its subset** (§3.2) — audited,
  with any household-level leakage removed.
- **Remarried (H8)** is assessable with R+spouse combined and the absent parent's
  maintenance captured — no third contributor role introduced.
- **Shared custody (H10/H11)** designates the lead per §3.1 (50/50 ⇒ both, per
  D15; main+limited ⇒ main), without regressing one-account-per-child.
- The assessor **decision-aid panel** shows the derived scenario + expected
  handling for each case, and **advises rather than auto-decides** for H7/H9.
- Demo seed exercises one case per handling shape (sole / two-parent / three-party
  / gate-flag) and the shared-custody variant.
