# 09 — Set up the assessment workspace

Backlink: [[README#Tab 2 — Running the assessment (the calculation engine)]]

Open the split-screen workspace by starting the assessment for an
application that doesn't have one yet.

## Prerequisites

- Application is open on the **Assessment** tab.
- Application status is at least `SUBMITTED` (typically `NOT_STARTED`
  after you click **Begin Review**).
- You are signed in as `ASSESSOR` or `ADMIN`. Viewers see the read-only
  prompt and cannot start.

## Steps

1. Click the **Assessment** tab in the application detail.
2. If no `Assessment` record exists yet, the centre of the tab shows
   the dashed empty card with:
   - The clipboard icon.
   - Heading **Assessment not yet started**.
   - Strapline *"Begin the assessment to open the workspace with all
     documents and income entry forms."*
3. Click **Begin Assessment** (large primary-navy button, clipboard
   icon). The button shows *"Starting assessment…"* with a spinner.
4. The server action `beginAssessmentAction` creates the `Assessment`
   row (status `IN_PROGRESS`) seeded with reference-table defaults
   for the school's annual fees, the Croydon Band D council tax, and
   family-type costs for category 1.
5. The page refreshes and renders the full **split-screen workspace**:
   - **Left panel** — `DocumentListClient`: every uploaded document
     with inline preview controls. Use the document dropdown / list to
     flip between PDFs as you enter figures.
   - **Right panel** — `AssessmentForm` with five collapsible
     sections (A–E) plus the sticky **CalculationDisplay** sidebar.
6. Below the split-screen sits the **AssessmentChecklist** with six
   qualitative tabs: *Bursary*, *Living Conditions*, *Debt*, *Other
   Fees*, *Staff*, *Financial Profile*. Use these for narrative notes
   as you work.

## Verification

- The status bar at the top of the form shows the chip **In Progress**
  with a *Saved hh:mm:ss* indicator after the first save.
- All five form sections (**A. Reference Data**, **B. Income Entry**,
  **C. Property & Savings**, **D. Payable Fees**, **E. Flags**)
  collapse / expand on click.
- The calculation sidebar shows placeholder rows until *Annual School
  Fees* is non-zero.

## Notes

- For **re-assessments**, the `BenchmarkDisplay` banner and the
  `YearComparison` table render above the split-screen *before* the
  workspace appears — see [[27-compare-against-year-1-benchmark]].
- If `beginAssessmentAction` returns an error (e.g. concurrent edit),
  the red text under the button shows the server-action message; refresh
  and try again.
