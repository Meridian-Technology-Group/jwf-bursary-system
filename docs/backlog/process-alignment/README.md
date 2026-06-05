# Process Alignment — programme plan

> **What this is.** A structured programme of work to reconcile the JWF Bursary
> System with the Foundation's **real** bursary process, as captured in the
> authoritative scoping workbook and the post-demo client feedback (Alex &
> Charlotte). It supersedes the "sprint-1" dumping-ground folder. The work spans
> many epics across several waves — this README is the spine; each epic has its
> own implementation plan under [`plans/`](plans/).

**Status:** planning · **Opened:** 2026-06-05 · **Owner:** Brian Wagner

---

## 1. Why this programme exists

The system was built to v1.0 and shipped to production. Client testing of the
staging build surfaced two things at once:

1. **Bugs / rough edges** from the demo (the immediate defect list), and
2. A **scope correction** — several areas were built against an early/assumed
   model and need to align to the Foundation's actual process: the parent
   application form, the status/lifecycle model, round management, the
   invitation model, the assessor experience, and account/retention lifecycle.

The source documents in [`source-materials/`](source-materials/) are the ground
truth. This programme turns them into buildable, sequenced engineering plans.

> **Authoritative form spec.** The parent application form is built to match the
> scoping workbook (`New Bursary - Application Form.xlsx`, see its
> [markdown transcription](source-materials/application-form-scoping.md))
> **tab-for-tab**: questions, wording, order, branch logic, field types,
> mandatory markers, per-section document uploads, and validation behaviour. The
> only deviations are explicit, recorded decisions: school is **set & locked at
> the admin invite** (Q1 read-only) with entry-year admin-side and off the form
> ([D1](#5-decision-register) — decided); year/date literals **derive from the
> round** ([D5](#5-decision-register) — decided); and declaration wording
> defaults to the workbook verbatim pending [D11](#5-decision-register).

---

## 2. How this folder is organised

```
process-alignment/
├── README.md                 ← this file: programme spine, epic catalogue, decisions
├── source-materials/         ← client ground-truth (do not edit; record of intent)
│   ├── New Bursary - Application Form.xlsx   ← the form scoping workbook (11 sheets)
│   ├── terms-and-conditions.pdf              ← parent T&Cs to display in-portal
│   ├── meeting-findings.md                   ← full categorised to-do list
│   ├── feedback.md                           ← the 4 form asks + canonical statuses
│   └── application-lifecycle-illustration.png← new vs rolling-over lifecycle diagram
└── plans/
    ├── 00-current-state-map.md   ← grounded snapshot of the build (cited by all epics)
    └── NN-<epic>.md              ← one implementation plan per epic
```

**Conventions** (extends the [backlog house style](../README.md)):

- One epic per file in [`plans/`](plans/), kebab-case, numeric prefix for order.
- Each plan opens with YAML frontmatter (`title/status/severity/area/depends_on/sources`)
  and follows the [plan template](#7-epic-plan-template).
- Plans cite [`00-current-state-map.md`](plans/00-current-state-map.md) rather
  than restating current state. Code references are `path:line`.
- Open questions that need a **stakeholder/client decision** go in the
  [Decision register](#5-decision-register) here, and are linked from the epic.
- `status` values: `planned` → `ready` → `in-progress` → `shipped` / `won't-do`.

---

## 3. The canonical status model (the spine)

The redesign separates **three independent lifecycles** that are currently
fused into one `ApplicationStatus` enum. Everything else depends on getting
this right — it is **Epic 01**.

| Lifecycle | States | Notes |
|---|---|---|
| **Form** (`Application`) | Created → Not started → In progress → Filled in → **Received** (new) / **Submitted** (rolling) | "Received" vs "Submitted" is the *same* submitted state, labelled by application type. Submission date is **fixed** once set. |
| **Assessment** (`Assessment`) | Not started → In progress → **Paused** → Complete | Paused = blocked on missing docs, with an *optional persisted deadline* for the applicant to upload/email them (retro-populating the form). Independent of form state. |
| **Outcome / account** | Declined ▸ archived · Qualifies-not-awarded · **Awarded** ▸ rolling **Active** account ▸ **Closed** when schedule completes | Replaces the binary qualify/does-not-qualify. Approved → multi-year schedule of future rounds. |

Because the lifecycles become independent, "submitted **and** awaiting extra
documents" stops being a contradiction: the form stays *Submitted* while the
assessment sits *Paused*. That is the elegant payoff of the split.

---

## 4. Epic catalogue

Each links to its plan (created as the programme proceeds). `[00]` is the
current-state reference, not an epic.

| # | Epic | Objective | Wave | Depends on |
|---|---|---|---|---|
| [01](plans/01-status-and-workflow-model.md) | **Status & workflow model** | Split `ApplicationStatus` into the 3 lifecycles above; add `In progress`; persist pause deadline; enforce immutable submission date; 3-outcome model; stop parent leakage. | 1 | — |
| [02](plans/02-application-form-rescope.md) | **Application form re-scope** | Rebuild the 8 form sections to the scoping workbook: status-driven income sub-tables, finish the live stubs, required-doc rule engine, dynamic tax-year wording, mandatory phone+email, real declaration text, new-vs-rolling ID-section variant. | 2 | 01, 04 |
| [03](plans/03-round-management.md) | **Round management** | Allow multiple concurrent open rounds; wire editable/extendable dates; per-application submission-by date; filter invite picker to live rounds; 2-round UI; invite confirmation step. | 1 | 01 |
| [04](plans/04-lead-applicant-contacts-and-invitations.md) | **Lead-applicant contacts & invitations** | Admin-managed contact register (parent/child/school/year/address); "invite from contact"; required + **locked** school/entry-year at invite; parent-vs-staff clarity; one-account-per-child incl. twins. | 1 | 01 |
| [05](plans/05-parent-portal-experience.md) | **Parent portal experience** | Home-page How-to-apply + Checklist tabs + T&Cs; new-vs-rolling visual options; drafts; countdown + deadline-missed lockout; read-only submitted summary + PDF; multi-round/account history; portal missing-doc upload; trim status visibility. | 2 | 01, 02, 03 |
| [06](plans/06-assessor-experience-and-ui.md) | **Assessor experience & UI** | Responsive docs-left / data-centre / calc-collapsed-top layout; 30+ doc nav; collapse 8 qualitative boxes to one always-visible synopsis editable post-completion; add missing assessment fields. | 3 | 02 |
| [07](plans/07-assessment-calculations-and-fees.md) | **Assessment calculations & fees** | Current-year **and** next-year fees; validate the engine against real historical assessments; auto-populate-then-confirm (stop overwriting assessor edits). | 3 | 06 |
| [08](plans/08-recommendation-and-outcome.md) | **Recommendation & outcome** | Real award terminology (final bursary + scholarship award, siblings, choice of options); replace placeholder reason codes with real paperwork codes; remove unused assessor PDF; wire outcome → account promotion. | 3 | 01, 07 |
| [09](plans/09-complex-household-and-second-parent.md) | **Complex household / second parent** | Validate the dual-parent flow; encode the separated/divorced/widowed/remarried logic from the FAQ; ask only the right question subset; combined-income vs sole-parent assessment. | 3 | 02, 06 |
| [10](plans/10-data-retention-and-account-lifecycle.md) | **Data retention & account lifecycle** | Auto-purge declined/non-awarded; active vs closed accounts + **revoke portal access**; tiered retention (6-yr qualified-not-awarded vs 7-yr); promote winners to rolling accounts with a generated future-round schedule. | 4 | 01, 03 |
| [11](plans/11-auth-and-access.md) | **Auth & access** | Verify MFA env-gating (mostly already built); Microsoft SSO (spike/backlog); optional inactivity logout. | 4 | — |
| [12](plans/12-defect-fixes.md) | **Defect fixes (P0)** | The immediate demo bug list — several already root-caused to exact lines. Independent, shippable now. | 0 | — |

---

## 5. Decision register (needs stakeholder input)

These are reconciliation points where the documents conflict or the real
process is unknown. They **block** the linked epics until answered. Owner =
who we need it from.

| # | Question | Default if unanswered | Blocks | Owner |
|---|---|---|---|---|
| D1 ✅ | School + entry-year: lock at admin invite and make form Q1 read-only? (Workbook Q1 shows the parent picking school.) | **DECIDED 2026-06-05 — locked at invite: Q1 shows the school read-only (parent cannot change it); entry-year is admin-side and absent from the parent form.** | 02, 04 | Brian |
| D2 ✅ | "Received" vs "Submitted": model one submitted state + type-based label? | **DECIDED 2026-06-05 — yes: a single `SUBMITTED` form state, label derived from `applicationType` ("Received" for new, "Submitted" for rolling-over). Submission date fixed once set.** | 01, 05 | Brian |
| D3 | Income: replace the flat 14-line model wholesale with the scoping sub-tables? | Yes — full rebuild | 02 | Charlotte |
| D4 | Reason codes: the current 35 are placeholders — supply the real paperwork codes. | Hold; keep placeholders until supplied | 08 | Charlotte |
| D5 ✅ | Dynamic tax-year: confirm `Round.academicYear` is the single source for the "to April YYYY" / payslip-month wording. | **DECIDED 2026-06-05 — yes: match the workbook wording/structure exactly, derive the year from `Round.academicYear`.** | 02 | Brian |
| D6 | Retention policy: purge declined immediately? 6-yr for qualified-not-awarded? keep flat 7-yr? | Tiered: 6-yr q-n-a, 7-yr awarded, purge declined | 10 | Charlotte (+ DPO) |
| D7 | Remove the assessor-side recommendation PDF? (Only reachable from the recommendation page.) | Remove | 08 | Charlotte |
| D8 | VAT %: is VAT actually applied to bursary fees, or is the field legacy? (Engine currently **applies** it — schema default **20%** at `prisma/schema.prisma:228`, deducted on the post-bursary net fee at `payable-fees.ts:50`.) | Confirm; 20% currently applied | 07 | Charlotte |
| D9 | Scholarship: model as a distinct £ award alongside bursary? Need the scholarship process. | Add scholarship award field | 08 | Charlotte |
| D10 | T&Cs: is `terms-and-conditions.pdf` the final wording, and must acceptance be recorded per round? | Display + record acceptance per submission | 05 | Charlotte |
| D11 | Declaration wording: confirm the final per-parent + closing declaration text (the workbook has a version). | Default — implement the **workbook's declaration verbatim** unless Charlotte supplies different final text | 02 | Charlotte |
| D12 ✅ | Twins: one account per child keyed on (childName + DOB)? Two accounts, one lead? | **DECIDED 2026-06-05 — one account per child keyed on (childName + DOB); same-name twins resolve by DOB.** | 04 | Brian |
| D13 | Multiple open rounds: confirm the real cap is "two concurrent" so the UI can be a 2-option control not a dropdown. | Support N, optimise UI for 2 | 03 | Charlotte |
| D14 | Fee year that drives the **payable monthly**, and how an award splits across a fee-uplift boundary. | Current-year ÷ 12 until confirmed | 07 | Charlotte |
| D15 | Shared custody: model 50/50 as **two lead applicants** (add `CustodyArrangement`), or keep a single lead + note? | Add `CustodyArrangement`; 50/50 ⇒ either may hold the account | 09 | Charlotte |
| D16 | Foster/guardian: a distinct relationship-status value + mandatory guardianship evidence? | Add a guardian facet + evidence upload | 09 | Charlotte |
| D17 | Remarried (3 incomes): reuse the two-earner + maintenance model, or build a true 3-contributor model? | Reuse two-party + maintenance; defer 3-contributor | 09 | Charlotte / Brian |
| D18 ✅ | Portal-access revocation: a status-keyed portal/layout guard, or flip role → `DELETED`? | **DECIDED 2026-06-05 — status-keyed portal/layout guard; reserve `role = DELETED` for true erasure only.** | 10 | Brian (DPO if data) |
| D19 | Forward-schedule horizon N + the `availableOn`/`requiredBy` date policy for generated rounds. | Years-to-final-eligible; dates from the award round + Epic 03 | 10 | Charlotte |
| D20 ✅ | Inactivity/session-timeout logout: build it, and what idle window? | **DECIDED 2026-06-05 — build the optional idle-timeout watcher; the exact idle window still to confirm with Charlotte (does not block the build).** | 11 | Brian/Charlotte |
| D21 | Commission the Microsoft SSO build after the spike? | Spike only; no build until commissioned | 11 | Charlotte |

> Household decisions D15–D17 also carry a standing validation ask: **confirm
> every household scenario row H1–H11 in
> [plan 09](plans/09-complex-household-and-second-parent.md) verbatim** against
> the workbook FAQ before the rules harden into branch logic (H7 *cannot
> support* / H9 *may defer* stay assessor-surfaced flags, never auto-decline).

---

## 6. Dependency graph & sequencing

```
Wave 0  ── 12 Defect fixes ............................ (independent, ship now)

Wave 1  ── 01 Status & workflow model  (keystone)
        ├─ 03 Round management
        └─ 04 Lead-applicant contacts & invitations

Wave 2  ── 02 Application form re-scope   (needs 01, 04)
        └─ 05 Parent portal experience    (needs 01, 02, 03)

Wave 3  ── 06 Assessor experience & UI    (needs 02)
        ├─ 07 Calculations & fees         (needs 06)
        ├─ 08 Recommendation & outcome    (needs 01, 07)
        └─ 09 Complex household           (needs 02, 06)

Wave 4  ── 10 Retention & account lifecycle (needs 01, 03)
        └─ 11 Auth & access               (independent)
```

**Rationale.** Wave 0 is pure remediation and unblocks client testing
immediately. Wave 1 lays the data-model/lifecycle foundation everything else
reads. Wave 2 is the parent-facing rebuild. Wave 3 is the assessor side. Wave 4
closes the loop on lifecycle and access. Each schema change ships in the same PR
as the code that needs it (per repo `CLAUDE.md`); migrations are additive and
backfilled, never edited in place.

---

## 7. Epic plan template

Every `plans/NN-*.md` follows this shape (see
[01](plans/01-status-and-workflow-model.md) as the worked example):

```
--- frontmatter: title / status / severity / area / wave / depends_on / sources ---
1. Background & rationale          (cite source-materials)
2. Current state                   (cite 00-current-state-map + path:line)
3. Target state                    (per scoping doc / feedback)
4. Gap analysis
5. Proposed approach   5.1 Schema (Prisma+migration) · 5.2 Server/API · 5.3 UI · 5.4 Seed
6. Work breakdown                  (PR-sized task checklist)
7. Open decisions                  (link to the Decision register)
8. Risks & mitigations
9. Out of scope / deferred
10. Acceptance criteria
```

---

## 8. Working agreement

- Branch off `staging`, PR to `staging`, **only the user promotes to `main`**
  (repo `CLAUDE.md`). One epic ≈ one branch ≈ one or more focused PRs.
- Migrations: additive + backfilled; never edit an applied migration.
- This programme does **not** set delivery dates — sequencing is by dependency,
  not calendar. Priorities can be re-cut per wave as decisions land.
