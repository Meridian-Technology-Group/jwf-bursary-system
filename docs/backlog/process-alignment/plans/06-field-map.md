---
title: Assessor form field-map (Epic 06 PR-5)
status: artifact
area: assessor
wave: 3
related:
  - 06-assessor-experience-and-ui.md
  - 07-assessment-calculations-and-fees.md
  - 08-recommendation-and-outcome.md
  - ../source-materials/meeting-findings.md
  - ../source-materials/application-form-scoping.md
---

# 06 — Assessor form field-map

Deliverable for [06 §5.3d / §6 PR-5](06-assessor-experience-and-ui.md). Maps each
field the assessment scoping document expects an assessor to **see and enter** to
its section in the current form and to the **owning epic**. Per the plan, 06 only
lands the *unambiguous UI presence*; fields that imply a calculation or an
outcome wording are routed to **07** / **08** so they are implemented once, with
behaviour, in their owning epic.

> Source of "missing fields": meeting-findings.md "Assessor experience / UI"
> ("Add the missing assessment fields and logic Charlotte said were absent") and
> "Assessment calculations / data structure" + "Outcome / recommendation step".

## Legend

- **Present** — the field already exists in the form at the listed section.
- **06** — UI-presence/placement/label change owned here.
- **07** — field implies calculation semantics → Epic 07 (calculations & fees).
- **08** — field implies outcome terminology/structure → Epic 08.

## Field map

| Scoping field | Current section | State | Owner | Note |
|---|---|---|---|---|
| Family type category | A. Reference Data | Present | 06 | auto-populates rent/utilities/food |
| Notional rent / utilities / food (per family type) | A. Reference Data | Present | 06 | display of the active config |
| Annual school fees | A. Reference Data | Present | — | **current-year** today |
| **Next-year (uplifted) school fees** | A. Reference Data | **Absent** | **07** | meeting-findings §calc "current-year fees and next-year fees"; 06 leaves the home in section A, 07 adds the field + uplift/boundary logic (D14) |
| Entry year-group / entry year / schooling years remaining | A. Reference Data | Present | 06 | derived; assessor-overridable |
| Council tax | A. Reference Data | Present | — | Band-D default |
| Income per earner (PAYE/dividends/self-employed/pension/benefits) | B. Income Entry | Present | — | Parent 1 / Parent 2 tabs |
| Mortgage-free toggle / additional property / savings / ISAs | C. Property & Savings | Present | — | Stage-2 inputs |
| School-age children count | C. Property & Savings | Present | — | savings divisor |
| Scholarship **percentage** | D. Payable Fees | Present | — | today a % deduction |
| **Scholarship as a distinct £ award** | D. Payable Fees / outcome | **Partial** | **08** | D9 (meeting): scholarship is a distinct award, not just a %; outcome rework owns the £ award + presentation |
| VAT rate | D. Payable Fees | Present | 06 | flagged for D8 (07) |
| Manual adjustment (+ reason) | D. Payable Fees | Present | — | "do not overwrite assessor edits" is 07 |
| Dishonesty / credit-risk flags | E. Flags | Present | — | carried to recommendation |
| **Single qualitative synopsis** | (docked synopsis) | **Done (06 PR-1)** | **06** | replaces the 8 boxes; editable post-completion |
| **Sibling options / income absorption visibility** | (recommendation) | **Partial** | **08** | sibling fees already absorbed in calc; the *choice between views/options* is 08 |
| Final bursary / outcome terminology | (recommendation) | Present (binary) | **08** | replace qualify/not-qualify (D7/D9) |

## 06 disposition

- **No new enterable A–E fields are unambiguous UI-presence-only.** Every
  "missing field" Charlotte named carries calculation (next-year fees) or
  outcome (scholarship £, sibling options) semantics and is therefore routed to
  **07** / **08**, which already own those work items in this programme. Adding a
  bare input here with no behaviour would create the double-implementation the
  plan §8 risk warns against.
- 06 lands: the **synopsis consolidation** (PR-1) and the **layout/IA** that
  gives those future fields a sensible home (calc strip frees the right side;
  section A is where next-year fees will sit; D is where the scholarship £ award
  will sit). The seam is documented here; 07/08 wire the behaviour.
- **Action for 07:** add "next-year (uplifted) fees" to section A and the
  current-vs-next-year monthly logic (D14 boundary rule).
- **Action for 08:** model scholarship as a distinct £ award and the
  sibling/option choice in the reworked recommendation/outcome step; read
  `Assessment.synopsis` rather than re-introducing free-text fields.
