---
title: Assessor experience & UI — responsive workspace + single synopsis
status: planned
severity: medium
area: assessor, admin, ui
wave: 3
depends_on: [02]
related:
  - 00-current-state-map.md
  - 02-application-form-rescope.md
  - 07-assessment-calculations-and-fees.md
  - 08-recommendation-and-outcome.md
  - ../source-materials/meeting-findings.md   # "Assessor experience / UI"
  - src/components/admin/split-screen.tsx
  - src/components/admin/assessment-form.tsx
  - src/components/admin/document-list-client.tsx
  - src/components/admin/assessment-checklist.tsx
---

# 06 — Assessor experience & UI

**Objective.** Make the assessment workspace usable on a laptop and aligned to
how the Foundation actually assesses: **documents left, applicant data centre,
calculations as a collapsible persistent strip at the top** (not a giant
always-on right panel); keep document navigation workable for **30+ documents**;
collapse the **eight** scattered freeform qualitative boxes down to **one
synopsis** that stays visible during assessment *and* on the completed/final
screen and remains **editable after completion**; and ensure the assessment
form *presents* the fields Charlotte said were missing.

This epic is **UI/UX + information architecture + the synopsis move**. It does
**not** own calculation semantics (current-vs-next-year fees, auto-fill-then-
confirm → **Epic 07**) or outcome terminology (final bursary / scholarship /
sibling options → **Epic 08**). Those are cross-linked, not duplicated here.

---

## 1. Background & rationale

[`meeting-findings.md`](../source-materials/meeting-findings.md) ("Assessor
experience / UI") asks specifically to:

- *"Revisit assessor layout for smaller screens/laptops: documents left, data
  centre, calculations collapsed/persistent at top instead of always full right
  panel"* and to keep the workflow optimised for **document → data → document**
  review *"rather than forcing large persistent summary panes"*.
- *"Keep document navigation workable for 30+ documents."*
- *"Reduce the number of freeform qualitative sections to one synopsis box"*,
  keep it *"visible at the bottom during assessment and also on the
  post-completion/final screen"*, and *"allow synopsis to remain editable after
  assessment completion."*
- *"Add the missing assessment fields and logic Charlotte said were absent"* and
  *"rework assessor UI to match the real assessment scoping document, not the
  shortened/incomplete current version."*

Two of these are pure layout/IA problems with the existing components; the
synopsis ask is a small schema move plus relaxing a read-only rule; the
"missing fields" ask is where 06 (presence/placement of fields) hands off to
**07** (what the fields compute) and **08** (how the outcome reads). The
demo pain was concrete: on a 13" laptop the assessor sees three columns at once
(documents | form | calculation rail) and the six qualitative tabs sit
off-screen below the fold, so document-data-document review means constant
vertical scrolling past data they can't see while a document is open.

---

## 2. Current state

See [00 §E](00-current-state-map.md#e-assessor-assessment-calculations-outcome).
Confirmed against the code at the time of writing:

**Layout — a two-pane split with a *third* nested column.**

- The workspace is `SplitScreen` (`src/components/admin/split-screen.tsx`): a
  resizable two-pane layout, **documents left / form right**, ratio persisted
  in `localStorage`, `MIN_WIDTH = 380px` per pane (`split-screen.tsx:16`).
  Below `md` it collapses to a **Documents / Assessment tab switcher**
  (`split-screen.tsx:134`), wired in at the page
  (`assessment/page.tsx:399-404`, container `h-[calc(100vh-220px)] min-h-[600px]`).
- The calculation panel `CalculationDisplay` is **not** a sibling pane — it is a
  **nested sticky right rail inside the form pane**. The form's own root is a
  `grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]`
  (`assessment-form.tsx:748`), with the calc rail rendered into the second
  column at `assessment-form.tsx:1371-1380` (`hidden lg:block` + `sticky top-6`)
  and a duplicate at the bottom for `lg:hidden` (`:1382-1389`). So on a laptop
  the user gets **documents | form | calc — three columns**, each fighting for
  width inside `380px`-floored panes. The calc rail is **not collapsible** and
  has no persistent header strip.

**Document navigation — functional, single-view.**

- `DocumentListClient` (`document-list-client.tsx`) renders the selected
  document inline in the left pane with a toolbar: a **single dropdown**
  listing every document (slot + filename + verified badge), **Prev/Next**
  buttons with an `n / total` counter (`:282-287`), and **`[` / `]` keyboard
  shortcuts** suppressed while typing (`:158-180`). Presigned URLs are cached
  per-document (`:108-142`). Dual-parent docs are grouped/labelled
  ("Parent 1" / "Parent 2", `:83-92`).
- This is *workable* for 30+ documents but offers **no list/thumbnail/filter
  view** — finding "the third payslip" means paging the dropdown. An
  **unused** tab-based alternative `assessment-doc-panel.tsx` exists with zero
  importers (`grep` finds only its own definition) — dead code to remove or
  harvest.

**Qualitative boxes — eight, across two screens, all read-only on completion.**

- Six live in `AssessmentChecklist` (`assessment-checklist.tsx`): a `ChecklistTab`
  enum of `BURSARY_DETAILS, LIVING_CONDITIONS, DEBT, OTHER_FEES, STAFF,
  FINANCIAL_PROFILE` (`schema.prisma:572-579`), rendered as the **"F. Qualitative
  Checklist"** card **below** the split-screen (`assessment/page.tsx:406-412`) —
  i.e. **off-screen during data entry**. Each is a `Textarea` that auto-saves on
  blur/tab-change and goes **`disabled` when `readOnly`** (`assessment-checklist.tsx:318-332`),
  with `readOnly` set from `status === "COMPLETED"` at the page.
- The 7th and 8th are on the **recommendation** screen:
  `Recommendation.familySynopsis` (`recommendation-form.tsx:411-417`) and
  `Recommendation.summary` (`:474-479`), both `disabled={isReadOnly}` where
  `isReadOnly = applicationStatus === "QUALIFIES" || "DOES_NOT_QUALIFY"`
  (`recommendation-form.tsx:245-247`).
- The persistence backing them: `AssessmentChecklist` rows
  (`schema.prisma:296-306`, `@@unique([assessmentId, tab])`) and two `String?`
  columns on `Recommendation` (`schema.prisma:314, 323`).
- **Server-side, there is no status guard** — `saveChecklistNotes` accepts
  `ADMIN, ASSESSOR` and upserts unconditionally
  (`checklist-actions.ts:27-45`); the read-only behaviour is **purely
  client-side** (the `readOnly` prop disabling the textareas). This makes
  "editable after completion" mostly a client change.

**Assessment form sections today** (`assessment-form.tsx:7-11, 836+`):
`A. Reference Data` · `B. Income (P1/P2 tabs, earner-form.tsx)` ·
`C. Property & Savings` · `D. Payable Fees (scholarship %, VAT %, manual
adjustment)` · `E. Flags (dishonesty, credit risk)`. `isReadOnly =
assessment.status === "COMPLETED"` (`assessment-form.tsx:374`) drives `disabled`
on every input. The header status pill derives **"In Progress"** as "neither
COMPLETED nor PAUSED" (`assessment-form.tsx:774-778`) — the real `IN_PROGRESS`
state is added in Epic 01.

---

## 3. Target state

A single responsive workspace tuned for **document → data → document** review:

1. **Calculations = a collapsible, persistent strip across the TOP** of the
   workspace (full content width), not a right rail. Collapsed by default to a
   one-line summary (e.g. *monthly payable fees · bursary award*), expandable to
   the full breakdown. Collapse state persists. This frees the form pane to use
   the *whole* right side, so the laptop view is **two columns (docs | data)**
   instead of three.
2. **Documents LEFT, applicant data CENTRE/right** — keep the existing
   resizable two-pane split, now genuinely two-pane because the calc rail has
   moved up top. The `< md` tab switcher stays.
3. **Document navigation scales to 30+** — keep the inline viewer + Prev/Next +
   `[`/`]`, and **add a collapsible list panel** (slot · filename · verified ·
   contributor) with a type/slot filter and "verified only" toggle, so the
   assessor can jump straight to a named document instead of paging a dropdown.
4. **One synopsis box, always visible, editable after completion.** Collapse the
   six checklist tabs + the recommendation `familySynopsis`/`summary` into a
   **single `Assessment.synopsis`** that renders (a) docked/visible in the
   workspace during assessment and (b) on the completed/final and recommendation
   screens, and **stays editable post-completion** (its own relaxed read-only
   rule, independent of the rest of the form locking).
5. **Field presence/IA aligned to the scoping document** — every field the
   scoping workbook expects an assessor to *see and enter* is present and
   sensibly grouped. (What those fields *compute* and how the outcome is worded
   are 07/08.)

---

## 4. Gap analysis

| Target | Today | Action | Owner |
|---|---|---|---|
| Calc = collapsible top strip, full-width | nested `lg:grid-cols-[1fr_320px]` right rail, not collapsible (`assessment-form.tsx:748, 1371`) | Lift `CalculationDisplay` out of the form grid into a top strip with collapse state; form becomes single-column | **06** |
| Two columns on a laptop (docs \| data) | three columns (docs \| form \| calc) | Falls out of moving the calc strip up | **06** |
| 30+ doc nav with a list/filter | dropdown + Prev/Next + `[`/`]` only (`document-list-client.tsx`) | Add a collapsible list panel + slot/type filter + verified toggle; keep keyboard nav | **06** |
| One synopsis | 8 boxes (6 checklist tabs + `familySynopsis` + `summary`) | New `Assessment.synopsis`; retire the 6 tabs + 2 recommendation boxes into it | **06** |
| Synopsis always visible | checklist below the fold (`assessment/page.tsx:406`) | Dock synopsis inside the workspace (and on final/recommendation screens) | **06** |
| Synopsis editable post-completion | read-only on COMPLETED (`assessment-checklist.tsx:318`; `recommendation-form.tsx:245`) | Relax read-only **for the synopsis only**; server action already permits the write (`checklist-actions.ts:27`) | **06** |
| Remove dead code | unused `assessment-doc-panel.tsx` | Delete (or harvest list UI from it) | **06** |
| Missing assessment fields present | A–E sections only (`assessment-form.tsx:7-11`) | Audit form vs scoping workbook; add/relabel field **presence & placement** | **06** (presence) → **07/08** (semantics) |
| Calc inputs/values correct | single-year fees, auto-fill overwrites | — | **07** |
| Outcome terminology (bursary/scholarship/siblings) | binary, percentage scholarship | — | **08** |

---

## 5. Proposed approach

### 5.1 Schema (Prisma + migration)

**One additive migration. Backfill from the existing eight boxes. Do not drop
the old columns in this epic** (keep them readable for the migration window and
for any historical recommendation render).

```prisma
model Assessment {
  // + synopsis String?  @map("synopsis")
  // Single qualitative narrative for the assessment. Replaces the six
  // AssessmentChecklist tabs and the Recommendation family_synopsis/summary
  // as the editable surface. Editable after COMPLETED (see 5.2 / 5.3).
}
```

**Why `Assessment.synopsis` (not `Recommendation`)** — the synopsis must be
editable and visible **throughout** assessment, *before* a `Recommendation` row
exists, and must survive on the completed screen regardless of recommendation
state. The recommendation is downstream and is itself being reworked in **08**.
Hanging the synopsis off `Assessment` (1:1 with `Application`) keeps it
available the moment an assessment is created. Coordinate with **08**: when 08
reworks `Recommendation`, it should *read* `Assessment.synopsis` rather than
re-introduce its own free-text fields.

**Backfill** (data migration in the same PR, deterministic, idempotent):

- Concatenate any non-empty `AssessmentChecklist.notes` into `Assessment.synopsis`
  in a stable order with labelled headings (e.g. `## Debt\n…`), so no assessor
  text is lost; then append `Recommendation.familySynopsis` and
  `Recommendation.summary` if present (de-duped against identical content).
- Leave `assessment_checklists`, `recommendations.family_synopsis`,
  `recommendations.summary` **in place** (read-only legacy). A later
  cutover epic can drop them once the recommendation rework (08) lands and the
  migration has been verified in prod.

> Migrations stay additive + backfilled, never edited in place (repo `CLAUDE.md`).
> The `ChecklistTab` enum and `AssessmentChecklist` model are **retired from the
> UI** in this epic but **retained in the schema** until the 08 cutover.

### 5.2 Server actions / API

- **Synopsis writer.** Add `saveSynopsis(assessmentId, applicationId, text)`
  (or generalise `checklist-actions.ts`) that upserts `Assessment.synopsis`,
  audit-logs, and `revalidatePath`s the assessment + recommendation paths. The
  existing `saveChecklistNotes` already authorises `ADMIN, ASSESSOR` with **no
  status guard** (`checklist-actions.ts:27-45`), so the only change needed for
  "editable after completion" is to **not** pass a `readOnly` that disables it —
  i.e. the post-completion edit is permitted server-side already; we make the
  client allow it and add an audit action (`ASSESSMENT_SYNOPSIS_SAVE`).
- **Deprecate** `saveChecklistNotes` once the UI no longer renders the six tabs
  (keep the action for one release for in-flight saves, then remove with the 08
  cutover).
- **No new calculation endpoints** — `CalculationDisplay` keeps its current
  props (`input`, `dishonestyFlag`, `creditRiskFlag`, `assessment-form.tsx:1373-1378`);
  only its *placement* changes. Calc input/value changes are **07**.

### 5.3 UI

This is the core of the epic. Concrete layout and behaviours:

**(a) Workspace shell — calc strip on top, two-pane below.**

- Restructure `assessment/page.tsx` so the workspace is:

  ```
  ┌──────────────────────────────────────────────────────────────┐
  │  ▸ Calculation summary   £x/mo · award £y   [expand ▾]        │  ← collapsible
  ├───────────────┬──────────────────────────────────────────────┤   top strip
  │  Documents    │  Applicant data (A–E sections)               │
  │  (list +      │                                              │  ← SplitScreen
  │   inline      │  ────────────────────────────────────────    │   (2 panes)
  │   viewer)     │  Synopsis (docked, always visible)           │
  └───────────────┴──────────────────────────────────────────────┘
  ```

- **Lift `CalculationDisplay` out of the form grid.** Change
  `assessment-form.tsx:748` from `grid lg:grid-cols-[1fr_320px]` to a
  **single column**, and delete the right-rail (`:1371-1380`) and the
  `lg:hidden` duplicate (`:1382-1389`). Render `CalculationDisplay` once, in a
  new **`AssessmentCalcStrip`** wrapper at the top of the workspace, full content
  width, with a collapse toggle. Collapsed = a one-line digest (monthly/yearly
  payable fees + bursary award); expanded = the existing full breakdown.
  Persist collapsed/expanded in `localStorage` (mirror the `SplitScreen` ratio
  pattern, `split-screen.tsx:34-57`). Because the calc no longer needs the
  `[1fr_320px]` column, the laptop view drops to **docs | data** with the form
  using the full pane width.
- `SplitScreen` itself needs **no structural change** — it already does
  resizable two-pane + `< md` tab switch. (Optional: lower `MIN_WIDTH` from
  `380` or make the data pane the default-wider side; tune, don't rebuild.)

**(b) Document navigation for 30+.**

- Keep the inline viewer, Prev/Next, counter, and `[`/`]` shortcuts
  (`document-list-client.tsx`) — they are the document-data-document backbone.
- **Add a collapsible list panel** in the left pane above/beside the viewer: a
  scrollable list of all documents (slot label · filename · verified tick ·
  contributor chip), click-to-jump, with the current item highlighted. Reuse the
  contributor grouping already computed (`document-list-client.tsx:83-92`).
- **Add a filter row**: text filter on slot/filename + a "verified only" toggle,
  so 30+ docs are findable without paging the dropdown. The dropdown can remain
  as the compact control when the list is collapsed.
- **Harvest or delete** `assessment-doc-panel.tsx` (unused) — if its tabbed
  layout is a better list affordance, lift it; otherwise remove the dead file.

**(c) Single synopsis — docked + editable post-completion.**

- Replace the **"F. Qualitative Checklist"** card (six tabs,
  `assessment/page.tsx:406-412`) with a **single `AssessmentSynopsis`**
  component: one auto-saving `Textarea` bound to `Assessment.synopsis`, **docked
  inside the workspace** so it is visible during data entry (either as a sticky
  footer of the data pane, or a third row beneath the split — visible without
  leaving the screen, per the "visible at the bottom during assessment" ask).
- On the **completed/final screen and the recommendation screen**, render the
  **same** synopsis component (not the old `familySynopsis`/`summary` textareas).
- **Relax read-only for the synopsis only.** The rest of the form keeps
  `isReadOnly = status === "COMPLETED"` (`assessment-form.tsx:374`) and the
  recommendation keeps its lock (`recommendation-form.tsx:245`), but the synopsis
  component **ignores those flags** and stays editable — backed by the
  always-permissive server action (5.2). Show a subtle "editable after
  completion" affordance so it's clearly intentional, plus the existing
  saving/saved indicator pattern (`assessment-checklist.tsx:339-368`).
- Remove the six-tab `AssessmentChecklist` from the assessment view and the two
  free-text fields from `recommendation-form.tsx` (their values were backfilled
  in 5.1).

**(d) Missing-field presence / IA (scope-limited).**

- Audit the A–E sections (`assessment-form.tsx`) against the assessment scoping
  workbook and add/relabel/regroup **fields that should be present and entered**
  by the assessor (presence + placement + labels only). Where a "missing field"
  implies a **calculation** (e.g. next-year fees) defer the *logic* to **07**;
  where it implies **outcome wording** (scholarship £, sibling options) defer to
  **08**. 06 ensures the IA has a home for them; 07/08 wire the behaviour.
- This sub-task is deliberately bounded: it produces a **field-map** (scoping
  field → section → owning epic) and lands only the unambiguous UI-presence
  additions, with the rest tracked into 07/08.

### 5.4 Seed / reference data

- Update `seed-demo` so assessment fixtures populate `Assessment.synopsis`
  (so the docked synopsis renders with content in the demo) and so at least one
  fixture is `COMPLETED` to demonstrate the **post-completion editable** synopsis
  alongside an otherwise-locked form. No reference-data change.

---

## 6. Work breakdown (PR-sized)

- [ ] **PR-1 (synopsis schema + backfill):** add `Assessment.synopsis`
      (nullable, additive); data migration concatenating the six checklist tabs +
      `Recommendation.familySynopsis`/`summary` into it with labelled headings;
      leave legacy columns in place. Idempotent. Seed updated.
- [ ] **PR-2 (synopsis component + read-only relax):** `AssessmentSynopsis`
      auto-saving component + `saveSynopsis` action (+ `ASSESSMENT_SYNOPSIS_SAVE`
      audit); dock it in the workspace and render it on the completed +
      recommendation screens; it stays editable post-completion. Remove the
      six-tab `AssessmentChecklist` from the view and the two recommendation
      free-text fields.
- [ ] **PR-3 (calc top strip):** `AssessmentCalcStrip` wrapper (collapsible,
      persisted); move `CalculationDisplay` out of the form's
      `lg:grid-cols-[1fr_320px]` into the strip; collapse the form to a single
      column; delete the right-rail + `lg:hidden` duplicate. Pure layout — no
      calc value change.
- [ ] **PR-4 (doc nav for 30+):** collapsible document **list panel** + slot/
      filename filter + "verified only" toggle in the left pane, reusing the
      contributor grouping; keep Prev/Next + `[`/`]`. Delete or harvest the
      unused `assessment-doc-panel.tsx`.
- [ ] **PR-5 (field-presence audit):** scoping-workbook → form field-map;
      land the unambiguous UI-presence additions/relabels in A–E; open/annotate
      07 + 08 tickets for fields with calc/outcome semantics.
- [ ] **PR-6 (responsive/QA pass):** verify the `< md` tab switcher still works
      with the new strip + synopsis dock; tune `SplitScreen` defaults (pane
      widths) for 13" laptops; a11y for the new collapse/list controls.

---

## 7. Open decisions

This epic has **no hard blockers** in the [Decision register](../README.md#5-decision-register).
Two coordination points (not register items):

- **Synopsis structure** — single freeform box vs a light heading template
  (so the backfilled six-tab content stays legible). *Default:* one freeform box;
  backfill writes the old tab labels as in-text headings the assessor can keep or
  delete. Confirm with Charlotte during the field-presence review.
- **Field-presence additions (PR-5)** ride on the same scoping-workbook
  reconciliation as **D3** (income sub-tables, blocks **02**) and the **08**
  outcome decisions (**D4 reason codes, D7 PDF, D9 scholarship**). 06 lands only
  the unambiguous UI presence; semantic fields wait on those.

---

## 8. Risks & mitigations

- **Data loss collapsing 8 boxes → 1.** *Mitigation:* backfill is
  **concatenate, not pick-one**, with labelled headings; legacy columns are
  **retained**, not dropped, so the migration is reversible and the original
  per-tab text is always recoverable. Dry-run the concat on a staging copy and
  diff character counts before applying.
- **Depends on 02.** The centre pane shows the applicant data that **02**
  rebuilds; building 06's layout against the *old* form risks churn.
  *Mitigation:* 06 is Wave 3, after 02 ships; the layout work targets the
  reworked sections. Treat the field-presence audit (PR-5) as the seam.
- **Overlap with 07/08 on "missing fields."** *Mitigation:* the field-map
  explicitly routes each scoping field to its owning epic; 06 only lands
  UI-presence with no calc/outcome behaviour, avoiding double-implementation.
- **Recommendation read-only keys off the *old* outcome enum**
  (`recommendation-form.tsx:245`, `QUALIFIES`/`DOES_NOT_QUALIFY`) which **01**
  replaces. *Mitigation:* the synopsis deliberately moves **off** the
  recommendation's lock; coordinate the recommendation's own read-only rule with
  01/08 rather than in 06.
- **Three-up → two-up may surprise users mid-test.** *Mitigation:* ship behind
  the normal staging→client-test loop with the Sunday update note; the calc is
  not removed, only relocated and collapsible.

---

## 9. Out of scope / deferred

- **Calculation semantics** — current-vs-next-year fees, validating the engine
  against historical assessments, auto-populate-then-confirm (stop overwriting
  assessor edits) → **Epic 07**.
- **Outcome terminology & structure** — final bursary + scholarship £ award,
  siblings, choice of options, real reason codes, removing the unused assessor
  PDF, outcome → account promotion → **Epic 08**.
- **Real `IN_PROGRESS` assessment state** and the typed status badges →
  **Epic 01** (06 consumes them once present; today's pill derives it,
  `assessment-form.tsx:774-778`).
- **Dropping the legacy `AssessmentChecklist` table / recommendation free-text
  columns** → a cutover step alongside **08**, after the synopsis backfill is
  verified in prod.
- **Second-parent question subset** in the assessor view → **Epic 09**.

---

## 10. Acceptance criteria

- On a 13" laptop the workspace shows **two** primary columns (documents | data);
  the calculation panel is a **collapsible strip at the top**, collapsed by
  default, with its state persisted across reloads.
- The full calculation breakdown is reachable in one click from the collapsed
  strip; **no** `[1fr_320px]` right rail remains in `assessment-form.tsx`.
- An assessor can locate any of **30+ documents** via a filterable list panel
  (and still via Prev/Next + `[`/`]`) without paging a dropdown.
- The assessment shows **exactly one** qualitative synopsis box; the six
  `ChecklistTab` textareas and the recommendation `familySynopsis`/`summary`
  textareas no longer render.
- The single synopsis is visible **during assessment** and on the
  **completed/final and recommendation screens**, and remains **editable after
  the assessment is COMPLETED** (saves succeed; an audit entry is written).
- Backfill preserves all pre-existing qualitative text (verified by a
  before/after content check); legacy columns are untouched.
- The `< md` tab switcher still works with the new strip + docked synopsis.
- The scoping-workbook field-map exists; unambiguous UI-presence fields are in
  the form; calc/outcome fields are tracked into 07/08.
