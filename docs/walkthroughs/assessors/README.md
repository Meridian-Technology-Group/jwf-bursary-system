# Assessor Walkthroughs

The Assessor owns the **applicant journey** — from "this family has
been offered a place" through to "the school has a recommendation".
They invite the family, review the submitted application, verify the
documents, run the four-stage calculation, write the recommendation,
and complete the assessment with an outcome.

Assessors **cannot** edit reference tables (school fees, family-type
weightings, etc.), invite other staff, or delete records. Those are
Admin workflows — see [`../admins/`](../admins/).

A core principle of the role: the assessor builds an **independent
financial picture from source documents** (P60s, tax returns, bank
statements). They do not use the applicant's declared figures for
the calculation — only the uploaded evidence. This is the "two-layer"
model that justifies the role's existence.

## Workflows

Each item below will become its own guide (`<slug>.md`) in this
folder.

### Daily queue work

- **Triage the queue** — open `/queue`, scan submitted applications,
  filter by school / status / round, sort by submission date.
  Confirm the red-flag column when present. Names are hidden by
  default; the "Show Names" toggle is logged.
- **Open an application** — click a row to land on the four-tab
  detail view (Applicant Data, Assessment, Recommendation, History).

### Inviting applicants (single)

- **Invite one applicant for a new bursary** — the most common
  intake action. Enter the applicant's email, child name, and
  school; the system sends a unique registration link. (Batch
  re-assessment invitations are an Admin workflow.)
- **Invite an applicant for an internal / ad-hoc bursary** — outside
  the standard round, for pastoral or emergency cases. Schooling
  years remaining is editable rather than fixed to the standard
  Y6/Y7/Y9/Y12 mapping.

### Tab 1 — Reviewing the submission

- **Read the submitted application** — the Applicant Data tab is a
  read-only view of all 10 sections the applicant filled in.
- **Verify uploaded documents** — open each document inline (no
  download needed for the verification check), confirm the file in
  the slot matches what the slot is named for, mark each verified.
  Includes the document round-trip integrity check (Parent 1's P60
  is actually Parent 1's P60, not Parent 2's payslip).
- **Upload a document on behalf of the applicant** — for files
  received by email rather than via the portal. The upload is
  visually distinguished from applicant-uploaded files.
- **Request missing documents** — open the "Request Documents"
  email composer, customise the list of specific missing items,
  send. Pauses the assessment until the applicant responds.

### Tab 2 — Running the assessment (the calculation engine)

- **Set up the assessment workspace** — split-screen with document
  viewer on the left, data entry on the right. Pick which document
  to view from the dropdown.
- **Enter Stage 1 — Income** — per parent: employment status from
  the 7-option enum (PAYE / Benefits / SE Director / SE Sole / OAP /
  Past Pension / Unemployed), then the right inputs for that status,
  plus separate inputs for included and excluded benefits. Total
  household net income updates live.
- **Enter Stage 2 — Assets** — mortgage-free toggle, additional
  property count and income, cash savings, ISAs/PEPs/shares,
  school-age children count for the savings divisor. Net assets
  yearly valuation updates live.
- **Stage 3 — Living costs** — utility and food costs auto-populated
  from family type; editable. HNDI after Necessary Spending updates
  live.
- **Stage 4 — Bursary impact** — Required Bursary, gross fees,
  scholarship %, bursary award, net yearly fees, VAT, yearly +
  monthly payable fees all displayed.
- **Apply a manual adjustment** — positive or negative £; requires
  a reason if non-zero.
- **Select a property category** (1–12) and record red flags
  (dishonesty, credit risk).
- **Save the assessment** — at any point, in any status. Re-opening
  a saved assessment loads every entered figure back exactly.

### Tab 3 — Writing the recommendation

- **Build the family synopsis** — auto-populated suggestions from
  assessment data (single/married, number of children, employment),
  editable.
- **Set accommodation status, income category, property category** —
  these are the fields the school sees. Income and property are
  **categories** ("£15K–£25K"), not precise figures.
- **Record bursary award and payable fees** — pre-filled from the
  calculation, editable.
- **Select year-on-year reason codes** (re-assessments only) —
  multi-select from the ~35 codes; explains any payable-fee change.
- **Write the recommendation narrative** — free-text summary
  intended for the school.
- **Complete the assessment** — mark status as Completed, select
  outcome (Qualifies / Does Not Qualify). Triggers the outcome
  notification email to the applicant.

### Sibling linking

- **Link siblings** — when a family has more than one child applying
  or holding a bursary. Search by child name, reference, or lead
  applicant email; create the link from one record's "Link Sibling"
  action.
- **Re-order sibling priority** — when the eldest child leaves school,
  promote the next sibling to primary holder. The calculation
  re-evaluates payable fees for the remaining bursary holders.
- **Break a sibling link** — when one was set up incorrectly. Both
  records' calculations update.

### Re-assessment (year 2+)

- **Open a re-assessment** — different from a new application: the
  Applicant Data tab shows the prior year's data alongside the new
  submission, and the assessment workspace shows previous-year
  figures side-by-side with current entry fields.
- **Compare against the year-1 benchmark** — payable fees that fall
  below the year-1 benchmark surface a visual warning; the
  calculation is not silently overridden. The assessor decides
  whether to honour the benchmark via the manual adjustment field.
- **Pick reason codes** — explain the change (or lack of change) in
  family circumstances year-on-year.

### Hand-off to the school

- **Generate a PDF for one application** — recommendation tab →
  Download PDF.
- **Export recommendation list** — bulk export as CSV or XLSX, one
  row per application, including family synopsis, income category,
  property category, bursary award, payable fees, red flags, reason
  codes, outcome. Send externally to the school's admissions team.

### Reports

- **Round summary** — totals and breakdowns by status / outcome /
  school for the current round.
- **Bursary awards** — total £ awarded, average payable fees, trend
  across rounds.
- **Income distribution** — histogram across bands.
- **Property category distribution** — categories 1–12 with the
  £750K threshold highlighted.
- **Reason code frequency** — ranked codes for a selected round.
- **Active bursaries approaching final year** — Y12/Y13 holders.
- **Sibling bursary summary** — linked families with combined totals.

### Cross-link

For system-level work (rounds, reference data, staff invitations,
GDPR, audit), see [`../admins/`](../admins/).
