# Admin & Assessor Guide

*The operational guide for John Whitgift Foundation staff — assessing bursary
applications and running the system that supports them.*

> This document is the **MSA Schedule 1 §4 deliverable** (administrator and
> assessor guide for Customer staff). It is written for Foundation staff who
> are competent computer users but not developers. The companion document for
> parents and guardians is the [Applicant User Guide](applicant-guide.md).

---

## What this system is

The John Whitgift Foundation Bursary Assessment System is the purpose-built
replacement for the Foundation's previous grant-tracker tooling. It manages the
full lifecycle of a means-tested bursary — from inviting a family to apply,
through assessing their financial circumstances against the four-stage
calculation model, to producing a recommendation the schools (Trinity and
Whitgift) use to decide on a bursary-supported place. It also handles the
**annual re-assessment** of every active bursary.

You will use it in one of two capacities — often both at once.

- **As an Assessor**, you own the *applicant journey*: you open the queue, read
  a submission, verify documents, run the calculation, write the
  recommendation, and complete the assessment with an outcome. You can also
  invite families for ad-hoc bursaries and link siblings.
- **As an Admin**, you own the *system itself*: rounds, reference data (school
  fees, family-type costs, council tax, reason codes, email templates), staff
  accounts, GDPR deletions and the audit log.

One person may hold both roles. Where a step in this guide requires Admin
rights, it is clearly marked **(Admin only)**. As a rule of thumb: assessors
**cannot** edit reference data, invite staff, delete records, or open and close
rounds — those are Admin actions.

---

## How to use this guide

This guide is the **operational reference**. It explains *what* each part of
the system does, *why* it works the way it does, and the correct order to do
things in. For every task it also points to a **click-by-click walkthrough** — a
short, screenshot-led guide that takes a single workflow from start to finish.

Two reading paths:

- **New to the system?** Read [Quick Start](#quick-start), then [Signing in,
  roles & security](#signing-in-roles--security) and [Orientation](#orientation).
  That is enough to find your feet. Reach for the rest as you need it.
- **Looking something up?** Use the [table of contents](#table-of-contents) and
  the [Appendix](#appendix) — the appendix holds the glossary, the
  role-permission matrix, the status reference, the calculation cheat-sheet, and
  the full index of walkthroughs.

Throughout, links like [Triage the queue](walkthroughs/assessors/01-triage-the-queue.md)
take you to the detailed walkthrough for that task.

> 📷 *Screenshot: the signed-in admin console home, showing the sidebar and the
> round dashboard tiles.*

---

## Table of contents

1. [Quick Start](#quick-start)
2. [Signing in, roles & security](#signing-in-roles--security)
3. [Orientation](#orientation)
4. [Inviting applicants](#inviting-applicants)
5. [Reviewing a submission](#reviewing-a-submission)
6. [Running the assessment — the four-stage calculation engine](#running-the-assessment--the-four-stage-calculation-engine)
7. [Writing the recommendation](#writing-the-recommendation)
8. [Sibling linking](#sibling-linking)
9. [Re-assessment (year 2 and beyond)](#re-assessment-year-2-and-beyond)
10. [Hand-off to schools: PDF & exports](#hand-off-to-schools-pdf--exports)
11. [Reports & dashboards](#reports--dashboards)
12. [Admin: round lifecycle](#admin-round-lifecycle)
13. [Admin: reference data](#admin-reference-data)
14. [Admin: privacy, compliance & audit](#admin-privacy-compliance--audit)
15. [Troubleshooting](#troubleshooting--if-something-goes-wrong)
16. [Frequently asked questions](#frequently-asked-questions)
17. [Appendix](#appendix)

---

## Quick Start

Two fast-paths to get you productive. Each step links to the detailed
walkthrough.

### A. Assess your first application end-to-end (Assessor)

1. Open the queue at **Applications** (`/queue`) and find a *Submitted*
   application — [Triage the queue](walkthroughs/assessors/01-triage-the-queue.md).
2. Click the row to open the four-tab detail view — [Open an application](walkthroughs/assessors/02-open-an-application.md).
3. On the **Applicant Data** tab, read the submission and verify each uploaded
   document — [Read the submitted application](walkthroughs/assessors/05-read-submitted-application.md), [Verify uploaded documents](walkthroughs/assessors/06-verify-uploaded-documents.md).
4. Click **Begin Review**, then **Begin Assessment** to open the split-screen
   workspace — [Set up the assessment workspace](walkthroughs/assessors/09-set-up-assessment-workspace.md).
5. Enter **Stage 1 — Income** from the source documents — [Enter Stage 1 — Income](walkthroughs/assessors/10-enter-stage-1-income.md).
6. Enter **Stage 2 — Assets** — [Enter Stage 2 — Assets](walkthroughs/assessors/11-enter-stage-2-assets.md).
7. Confirm **Stage 3 — Living costs** (auto-populated from family type) — [Stage 3 — Living costs](walkthroughs/assessors/12-stage-3-living-costs.md).
8. Read **Stage 4 — Bursary impact** in the live calculation sidebar — [Stage 4 — Bursary impact](walkthroughs/assessors/13-stage-4-bursary-impact.md).
9. Click **Complete** to lock the assessment — [Save the assessment](walkthroughs/assessors/16-save-the-assessment.md).
10. On the **Recommendation** tab, write the synopsis, set the categories and
    narrative, then click **Save Recommendation** — [Build the family synopsis](walkthroughs/assessors/17-build-family-synopsis.md), [Write the recommendation narrative](walkthroughs/assessors/21-write-recommendation-narrative.md).
11. Click **Qualifies** or **Does Not Qualify** to set the outcome — this emails
    the applicant — [Complete the assessment](walkthroughs/assessors/22-complete-the-assessment.md).
12. Hand off to the school: download the PDF, or export the round's
    recommendation list — [Generate a PDF](walkthroughs/assessors/29-generate-pdf-for-application.md), [Export recommendation list](walkthroughs/assessors/30-export-recommendation-list.md).

### B. Set up a new application round (Admin only)

1. Create the round with its academic year and dates — it starts in `DRAFT` —
   [Create a new round](walkthroughs/admins/01-create-new-assessment-round.md).
2. Open the round when you are ready for applicants (only one round may be open
   at a time) — [Open a round](walkthroughs/admins/02-open-a-round.md).
3. Invite the families:
   - First-time applicants — single invite (Admin) or the assessor's
     **Internal Request** flow — [Invite one applicant](walkthroughs/assessors/03-invite-applicant-new-bursary.md), [Invite for an internal / ad-hoc bursary](walkthroughs/assessors/04-invite-internal-ad-hoc-bursary.md).
   - Existing bursary holders — batch re-assessment invitations from the round
     detail page — [Batch re-assessment invitations](walkthroughs/admins/11-batch-reassessment-invitations.md).

Once a family accepts and submits, the application appears in the queue and the
assessor takes over with fast-path A.

---

## Signing in, roles & security

### Signing in

Open the application URL and sign in with your work email and password. Staff
accounts are created by invitation only (see [Invite a staff member](walkthroughs/admins/10-invite-a-staff-member.md));
there is no self sign-up for staff.

> 📷 *Screenshot: the staff login page.*

### Multi-factor authentication (MFA) — live and enforced

Staff sign-in is protected by **multi-factor authentication using a TOTP
authenticator app** (for example Google Authenticator, Microsoft Authenticator,
or 1Password). MFA is **live and enforced in production** for all staff roles
(ADMIN, ASSESSOR, VIEWER). Applicants are never asked for MFA.

- **First sign-in (enrolment).** After entering your password you are taken to
  the MFA setup screen. Scan the on-screen QR code with your authenticator app
  (or type the secret manually), then enter the six-digit code to confirm. Your
  session is now elevated and you reach the admin area.
- **Every later sign-in (challenge).** After your password you are asked for the
  current six-digit code from your app.

You only need to enrol once per device. Keep your authenticator app safe — if
you lose your device, an admin must reset your factor before you can sign in
again (see below).

> The enforcement is environment-aware: production has MFA on by default; the
> test/staging environment normally has it off so the team can test other
> features without an authenticator. You will always be challenged in
> production.

> 📷 *Screenshot: the MFA enrolment screen with QR code and six-digit code field.*

### The three roles

| Role | Who it's for | What they can do |
|------|--------------|------------------|
| **ADMIN** | System owners / senior bursary staff | Everything an assessor can do, **plus** rounds, reference data, staff invitations, GDPR deletion, audit review, MFA resets. |
| **ASSESSOR** | Day-to-day case workers / contracted assessors | Full case-work: queue, applications, document verification, assessments, recommendations, sibling linking, internal/ad-hoc invitations, exports, reports. |
| **VIEWER** | Read-only stakeholders | View applications, exports and reports. Cannot start or change an assessment, invite, or delete. |

A full capability breakdown is in the [role-permission matrix](#role-permission-matrix)
in the appendix.

### Resetting a staff member's MFA (Admin only)

When a colleague loses their authenticator device they are locked out until
their MFA factor is cleared. An admin can reset it; the staff member then
re-enrols a fresh factor on their next sign-in.

The reset control lives on the **Users** page (`/users`) as an admin-only
action that clears the staff member's factor and writes a `RESET_STAFF_MFA`
entry to the audit log. If an admin is *also* locked out, the factor can be
cleared at database level by an engineer — this is the escalation path, not a
routine action. See [Reset another staff member's MFA](walkthroughs/admins/14-reset-staff-mfa.md)
and, for the operational detail, the runbook under [`docs/operations/`](../operations/).

> There are no self-service backup codes today. Recovery is always
> admin-assisted. If you are the only admin, make sure a second admin exists so
> you are never the single point of failure.

---

## Orientation

### The admin console layout

After signing in you land in the admin console. A **left sidebar** groups the
main areas: **Applications** (the queue), **Rounds**, **Invitations**,
**Exports**, **Reports**, **Audit**, **Settings** and **Users**. Some entries
(Rounds, Settings, Users, Audit) are Admin-facing; assessors and viewers see the
case-work entries. A live **dashboard** at `/admin` shows status tiles across
all rounds.

> 📷 *Screenshot: the sidebar with the grouped navigation sections.*

### The application queue

**Applications** opens the queue at `/queue` — *"Review and assess submitted
bursary applications."* It is a sortable, filterable table of every application
you can see. (Assessors see applications assigned to them; admins and viewers
see everything.)

Filter with the bar at the top:

- **Round** — *All rounds*, or one academic year.
- **School** — *All schools*, *Whitgift*, or *Trinity*.
- **Status** — a multi-select popover (*Pre-Submission*, *Submitted*, *Not
  Started*, *Paused*, *Completed*, *Qualifies*, *Does Not Qualify*); the badge
  shows how many are applied, **Clear filters** wipes them.
- **Search reference…** — free-text on the reference (and on names when revealed).

Sort by clicking any column header (**Reference**, **School**, **Submitted**,
**Status**, **Entry Year**). The bottom line reads `Showing N of M applications`.
See [Triage the queue](walkthroughs/assessors/01-triage-the-queue.md).

### The four-tab application detail view

Click a row (or **Open**) to land on `/applications/[id]`. The header card shows
the reference (e.g. `JW-2026-0042`), the school badge, the round and entry year,
the current status badge, and — for re-assessments — an orange **Re-assessment**
pill. An **Actions** bar beneath surfaces the next step for the current status
(e.g. **Begin Review**, **Resume Review**, **Set Qualifies**).

The tab strip moves you between:

| Tab | What it holds |
|-----|---------------|
| **Applicant Data** | The read-only submission, the document checklist, and sibling links. |
| **Assessment** | The split-screen calculation workspace. |
| **Recommendation** | The school-facing recommendation (meaningful once the assessment is completed). |
| **History** | The audit timeline for this application. |

See [Open an application](walkthroughs/assessors/02-open-an-application.md).

> 📷 *Screenshot: the application header card and the four-tab strip.*

### Name masking and "Show names" — a recurring principle

This system practises **data minimisation**. Personal identifiers are hidden by
default: the queue shows reference numbers, not names; the assessment workspace
labels parents **"Parent 1"** and **"Parent 2"** and shows the bursary reference
rather than the family name; reports use aggregates.

When you genuinely need to see names — for example to cross-check a document or
to communicate with a family — toggle **Show names** (top-right of the queue
filter bar). An amber pill *"Names visible — audit logged"* appears, and the
reveal is written to the audit log against your name with the action `REVEAL`.

This is by design: revealing a name is a deliberate, accountable act, not the
default state. Only reveal names when you need them, and expect every reveal to
be reviewable by an admin in the [audit log](walkthroughs/admins/13-audit-log-review.md).

> 📷 *Screenshot: the queue with names hidden, and the amber "Names visible —
> audit logged" pill after toggling Show names.*

---

## Inviting applicants

A family cannot self-register. An invitation creates an account stub and emails
the recipient a one-time, tokenised registration link. When they accept it they
complete the application themselves — see the [Applicant User Guide](applicant-guide.md)
for what they experience.

### Single new-bursary invitation

The dedicated **Invitations** page (`/invitations`) holds the **Send New
Invitation** form (email, optional names, child name, school, round) and the
**Invitation History** table. This page currently requires **Admin** rights.

If you are an **assessor** and need to invite a single first-time applicant as
part of intake, either ask an admin to send it from this page, or use the
**Internal Request** flow below (open to assessors, and it sends the same
applicant invitation email). See [Invite one applicant for a new bursary](walkthroughs/assessors/03-invite-applicant-new-bursary.md).

### Internal / ad-hoc bursary invitation (Assessor or Admin)

For pastoral referrals, emergency cases, or off-round intake, use **Internal
Request** on the queue page:

1. On `/queue`, click **Internal Request** (top-right, plus icon).
2. In **Create Internal Bursary Request**, fill in parent email, parent name,
   child name, school, the academic round, the **entry year**, and an optional
   reason (max 500 characters).
3. Click **Create Request**. The dialog confirms with the generated application
   reference; the parent receives the standard invitation email and registers
   themselves.

Use this flow when the standard Y6 → Y7 / Y9 / Y12 mapping is not the right fit
— here the entry year is freely editable. You never enter the family's financial
data on their behalf. See [Invite for an internal / ad-hoc bursary](walkthroughs/assessors/04-invite-internal-ad-hoc-bursary.md).

### Batch re-assessment invitations (Admin only)

At the start of a new round, invite every active bursary holder in one action:
open the **Rounds** list, click the **OPEN** round's academic year to reach its
detail page, then **Send Invitations**. The dialog lists who will be invited
(email, child, school); accounts that already have a pending or accepted
invitation for this round are skipped, so the batch is safe to re-run. See
[Batch re-assessment invitations](walkthroughs/admins/11-batch-reassessment-invitations.md).

### Re-sending or revoking an invitation (Admin only)

From the **Invitation History** table on `/invitations`, the row actions on any
**PENDING** invitation let you:

- **Resend** — regenerate the token, reset the 30-day expiry, and send a fresh
  email (the old link stops working).
- **Revoke** — mark the invitation **EXPIRED** so the link can no longer be used.

Accepted invitations cannot be resent or revoked — the recipient already has an
account. See [Re-send or revoke an invitation](walkthroughs/admins/15-resend-or-revoke-invitation.md).

---

## Reviewing a submission

Every assessment begins on the **Applicant Data** tab. Read the submission,
then verify the documents — but remember the golden rule of the [two-layer
model](#the-two-layer-model-and-why-it-matters): **nothing the applicant typed
is used in the calculation.** You will rebuild the financial picture yourself
from the source documents in the next stage.

### The Applicant Data tab

This tab is **strictly read-only**. It renders all ten sections the applicant
completed — Child Details, Family Identity, Parent Details, Dependent Children,
Dependent Elderly, Other Information, Parents' Income, Assets & Liabilities,
Additional Information, and Declaration — each with a green **Complete** or amber
**Incomplete** chip. Currency renders as £-formatted figures; unset fields show
*"Not provided"*.

There is no "edit" button: to correct a value, either the applicant resubmits,
or you record the correct, evidence-based figure in the assessment workspace
where it takes precedence. Use the document cards to flip into the PDFs while you
read. See [Read the submitted application](walkthroughs/assessors/05-read-submitted-application.md).

### Verifying documents

In the **Documents (n)** card, each row shows the **slot name** (e.g.
`PARENT_1_P60`, `BANK_STATEMENT_3M`) and the uploaded filename. For each:

1. Click **View** to open the file inline (PDF / JPEG / PNG) via a short-lived
   secure link — no download needed.
2. Confirm two things: the content genuinely belongs to that slot (Parent 1's
   P60 really is Parent 1's P60, not Parent 2's payslip — the *document
   round-trip integrity check*), and the file is legible and complete.
3. Tick the row checkbox to mark it **verified** (the icon turns green; the
   toggle is audit-logged). Clicking again revokes verification.

If a slot holds the wrong file, do **not** verify it — request a re-upload or
upload the correct file yourself. See [Verify uploaded documents](walkthroughs/assessors/06-verify-uploaded-documents.md).

> 📷 *Screenshot: the Documents card with verified (green tick) and unverified
> (grey) rows, and the inline document viewer open.*

### Uploading a document on behalf of an applicant

For files that arrive by email or post, use the **Upload Document (Assessor)**
card below the checklist: pick the slot, choose the file (PDF / JPEG / PNG, max
20 MB), and click **Upload Document**. The upload is attributed to you in the
audit metadata, and the new row appears unverified for you to check. See [Upload
a document on behalf of the applicant](walkthroughs/assessors/07-upload-document-on-behalf-of-applicant.md).

### Requesting missing documents (pauses the assessment)

When documents are missing or wrong, ask the applicant for them. This is only
available once you have clicked **Begin Review** (status `NOT_STARTED`):

1. In the Actions bar, click **Request Missing Documents**.
2. The dialog pre-checks every slot without a verified document and shows a
   status pill per row (green **Verified** / amber **Uploaded**). Fine-tune the
   selection.
3. Add an optional message (e.g. *"Please ensure the P60 is for the 2024/25 tax
   year."*) and click **Send Request**.

The application status moves to **Paused — awaiting documents**, the applicant
is emailed the bulleted list, and the assessment is held until they respond.
When new documents arrive, the assessment does **not** resume automatically —
verify the new files, then click **Resume Review** to return to `NOT_STARTED`.
See [Request missing documents](walkthroughs/assessors/08-request-missing-documents.md).

---

## Running the assessment — the four-stage calculation engine

This is the heart of your work as an assessor.

### The two-layer model, and why it matters

The applicant's form is, above all, a **document-collection exercise**. Parents
frequently confuse net and gross income, enter monthly figures where yearly is
asked, or describe their employment inaccurately. So the system keeps two
separate layers of data:

| Layer | Who enters it | Used in the calculation? |
|-------|---------------|--------------------------|
| **Applicant layer** | The parent, via the portal | **No** — it gathers evidence and gives you a cross-reference only. |
| **Assessor layer** | You, in the assessment workspace | **Yes** — the engine runs *exclusively* on these figures. |

Your job is to read the correct **net** figures straight from the source
documents (P60s, tax returns, bank statements, benefit letters, council tax
bills) and enter them into the workspace. The calculator never touches what the
applicant declared. This separation is the reason the assessor role exists, and
it is what makes the Foundation's assessments defensible.

The engine produces one bottom-line figure — the **Required Bursary Level to
Break Even** — through four stages, and from that derives the family's **payable
fees**. The full formulae are in the [calculation reference](#calculation-reference)
cheat-sheet; the authoritative narrative is in the project README.

### Setting up the workspace

On the **Assessment** tab, click **Begin Assessment**. The system creates the
assessment record (seeded with the school's annual fees, Croydon Band D council
tax, and the category-1 family-type costs) and opens the **split-screen
workspace**:

- **Left panel** — the document viewer. Pick any uploaded document from the list
  to read it while you type. This is what lets you read a figure off a P60 and
  enter it on the right without switching screens.
- **Right panel** — the assessment form, in five collapsible sections (A–E),
  with a sticky **calculation sidebar** that updates live.

Below the split-screen sits the **Assessment Checklist** with six qualitative
note tabs (*Bursary*, *Living Conditions*, *Debt*, *Other Fees*, *Staff*,
*Financial Profile*) for narrative observations. See [Set up the assessment
workspace](walkthroughs/assessors/09-set-up-assessment-workspace.md).

> 📷 *Screenshot: the split-screen assessment workspace — document viewer left,
> Stage 1 income form right, calculation sidebar far right.*

### Stage 1 — Income

**Section B. Income Entry** has a **Parent 1** and a **Parent 2** tab. For each
parent, set the **Employment Status**; the input fields change to match. There
are seven statuses:

| Employment status | Income inputs shown |
|-------------------|---------------------|
| **PAYE (Employed)** | Net Pay (annual) |
| **Benefits only** | Benefits only |
| **Self-employed (Director)** | Net Self-Employed Profit + Net Dividends |
| **Self-employed (Sole Trader)** | Net Self-Employed Profit |
| **Old Age Pension** | Pension Amount (annual) |
| **Past Employment Pension** | Pension Amount (annual) |
| **Unemployed** | (none) |

Enter all figures from the source documents, not the declared totals. Then
record benefits in two separate columns — this distinction matters:

- **Benefits Included (annual)** — benefits that *are* income to the household
  (e.g. DLA, ESA, PIP, Carer's Allowance paid to an unemployed parent). A detail
  box appears once non-zero (e.g. *"DLA £4,500, PIP £2,100"*).
- **Benefits Excluded (annual)** — benefits paid for a **child's** specific
  needs. These are recorded for completeness but **not** added to income,
  because that money is spent on the child's care.

The per-parent total updates live, and the calculation sidebar's Stage 1 block
shows each parent's net income, any additional property income, and the **Total
Household Net Income**. Changing a status zeroes the fields that no longer apply
— intentional, so a stale figure can't leak in. See [Enter Stage 1 — Income](walkthroughs/assessors/10-enter-stage-1-income.md).

### Stage 2 — Assets

**Section C. Property & Savings** captures the family's asset position:

- **Mortgage-free property** toggle — switch on only if the family fully owns
  their home. When on, the notional rent is *added back* to income (there is no
  housing cost to offset).
- **Additional Property Count** and **Additional Property Income (annual)** —
  rental income from any extra properties is added back.
- **Cash Savings** and **ISAs / PEPs / Shares** — the family's liquid pot.
- **School-Age Children Count** (minimum 1) — the **savings divisor**.

The calculator turns savings into an annualised, per-child contribution:
`(cash + investments) ÷ school-age children ÷ schooling years remaining`. The
sidebar's Stage 2 block shows cash savings, investments, derived savings, any
notional-rent uplift, and the **Net Assets Yearly Valuation**. See [Enter Stage
2 — Assets](walkthroughs/assessors/11-enter-stage-2-assets.md).

### Stage 3 — Living costs

Living costs are derived from **Section A. Reference Data**, which you complete
once at the top of the form:

- **Family Type Category** (1–6) — picking a category auto-populates the
  read-only **Notional Rent**, **Utility Costs** and **Food Costs** chips from
  the family-type reference table.
- **Annual School Fees** — pre-VAT, defaulted from the school's reference figure;
  override only if the school has confirmed a different figure.
- **Entry Year** — on blur this recomputes **Schooling Years Remaining**
  (13 − (academic year − entry year + 1), clamped 0–13).
- **Schooling Years Remaining** — editable if the auto-calc is wrong (e.g. a
  repeated year).
- **Council Tax (annual)** — defaults to Band D Croydon; override only if the
  family lives outside Croydon.

The sidebar's Stage 3 block sums notional rent, utilities, food, council tax and
pre-VAT school fees into **Necessary Spending**, then shows **HNDI after
Necessary Spending** (Household Net Disposable Income after Necessary Spending) —
Stage 1 + Stage 2 minus necessary spending. These reference figures are
**inherited at the moment the assessment starts**; if an admin changes the
reference table mid-round, an in-progress assessment keeps its figures unless you
re-select the family type. See [Stage 3 — Living costs](walkthroughs/assessors/12-stage-3-living-costs.md).

### Stage 4 — Bursary impact

Stage 4 is computed from Stages 1–3 plus the **Payable Fees** inputs in
**Section D**:

- **Scholarship Percentage (%)** — any school scholarship, applied before the
  bursary (0 if none).
- **VAT Rate (%)** — defaults to 20.
- **Manual Adjustment** — see below.

The sidebar's Stage 4 block then shows, live:

| Line | What it means |
|------|---------------|
| **Required Bursary** | `max(0, gross fees − HNDI after NS − absorbed sibling fees)` |
| **Gross Fees** | `annual fees × (1 − scholarship% / 100)` |
| **Bursary Award** | the bursary, capped at gross fees |
| **Net Yearly Fees** | `gross fees − bursary award` |
| **VAT** | applied to net yearly fees at the configured rate |
| **Yearly Payable Fees** | net + VAT, including any manual adjustment |
| **Monthly Payable Fees** | yearly ÷ 12 |

Cross-check these against the family's circumstances before saving. For
sibling-linked applications a **Sibling payable fees absorbed** line appears —
the older siblings' fees deducted before the bursary is worked out. See [Stage 4
— Bursary impact](walkthroughs/assessors/13-stage-4-bursary-impact.md).

> 📷 *Screenshot: the calculation sidebar showing all four stages and the bold
> Yearly / Monthly Payable Fees lines.*

### Manual adjustment

A pound-value override on the calculated yearly payable fees, for edge cases
(honouring a year-1 benchmark, a pastoral decision). In **Section D**, enter a
value in **Manual Adjustment** — positive *increases* the family's fees, negative
*reduces* them. As soon as the value is non-zero, a **Manual Adjustment Reason**
box appears: always fill it in. The reason shows on the audit trail and on the
recommendation PDF, and the adjusted figures are what get stored. See [Apply a
manual adjustment](walkthroughs/assessors/14-apply-manual-adjustment.md).

### Property category and red flags

- **Red flags** live in **Section E. Flags** on the assessment form: tick
  **Dishonesty flag** where there is evidence of misleading information, and
  **Credit risk flag** where there are concerns about financial stability or
  debt. Both surface as banners on the recommendation and as columns in the
  export.
- **Property category** (1–12) is set later, on the **Recommendation** tab. It
  reflects the family's primary-residence bracket and is used for *reporting*,
  not in the calculation. Choosing category 9 or above raises an amber **High
  Property Category** advisory (the Foundation's £750K qualifying line typically
  sits in this range).

See [Property category and red flags](walkthroughs/assessors/15-property-category-and-flags.md).

### Saving

The form **auto-saves on every blur** (after a short debounce), and the status
bar at the top exposes three buttons:

- **Save** — flush the form to the server now; the *Saved hh:mm:ss* indicator
  updates.
- **Pause** — save, then set the assessment to `PAUSED` (without emailing
  anyone).
- **Complete** — save, then set it to `COMPLETED`. This is disabled while
  **Annual School Fees** is still 0.

Completing locks the form to read-only, makes it the source for the
**Recommendation** tab, and writes the latest payable fees onto the bursary
account. Re-opening the page re-hydrates every figure exactly. See [Save the
assessment](walkthroughs/assessors/16-save-the-assessment.md).

> Once an assessment is `COMPLETED`, the workspace is read-only with no in-app
> "unlock". If figures must change, an admin re-opens the assessment, or you
> handle it in the next round's re-assessment.

---

## Writing the recommendation

The **Recommendation** tab is what the schools ultimately see. It only becomes
editable once the assessment is `COMPLETED`. Crucially, the school sees
**categories, not precise figures** — this protects family privacy while still
informing the admissions decision.

### The Assessment Fee Summary (read-only)

At the top, the **Assessment Fee Summary** card carries the **Bursary Award**,
**Yearly Payable Fees** and **Monthly Payable Fees** straight from the completed
assessment. These are **read-only here** — to change them, the assessment itself
must change. Sibling absorption is already baked in by this point. See [Record
bursary award and payable fees](walkthroughs/assessors/19-record-bursary-award-and-payable-fees.md).

### Family synopsis

A short, neutral, school-facing narrative: family structure, employment/income
context, and any salient circumstances (e.g. a sibling already at school, a
recent bereavement). Compose 1–3 factual sentences in the **Family Synopsis**
box. See [Build the family synopsis](walkthroughs/assessors/17-build-family-synopsis.md).

### Accommodation status, income category, property category

These are the three school-facing classifications:

- **Accommodation Status** — free text (e.g. *Rented*, *Mortgaged*, *Owned
  outright*).
- **Income Category** — a **band**, not a precise figure (e.g. *Low* / *Medium*
  / *High*, or a banded range your team agrees).
- **Property Category** (1–12) — the residence bracket; categories 9–12 raise the
  high-property advisory.

Accommodation and income are free text today, so agree a fixed vocabulary with
your team and use it consistently — the export grouping relies on consistent
spelling. See [Set accommodation, income, property](walkthroughs/assessors/18-set-accommodation-income-property.md).

### Reason codes

Reason codes are the standardised explanations for *year-on-year* change. They
are **required on re-assessments** and optional on new bursaries. In the **Reason
Codes** card, tick all that apply; they are grouped (1–9 Income, 10–19 Property &
Assets, 20–29 Family Circumstances, 30–39 Risk Flags, plus *Other*). The codes
are admin-managed and configurable — see [Select reason codes](walkthroughs/assessors/20-select-reason-codes.md)
and the [reason codes appendix](#reason-codes).

### The recommendation narrative

The **Recommendation Summary** is the fuller, panel-facing write-up. A useful
structure: summary of circumstances; justification for the bursary level;
anything unusual (manual adjustments, red flags, sibling considerations); and a
one-line recommendation. Keep it professional — assume a family could read it
under a subject-access request. The summary is not in the spreadsheet export, so
if a school needs the full narrative, send the PDF. See [Write the
recommendation narrative](walkthroughs/assessors/21-write-recommendation-narrative.md).

Click **Save Recommendation** to persist the synopsis, categories, reason codes
and narrative together.

### Completing the assessment (setting the outcome)

Finally, set the outcome. In the **Set Application Outcome** card (or via the
Actions bar) click **Qualifies** or **Does Not Qualify**, then confirm in the
dialog. This:

- transitions the application to its **terminal** status (`QUALIFIES` /
  `DOES_NOT_QUALIFY`);
- sends the corresponding outcome email to the lead applicant;
- locks the recommendation to read-only.

This action cannot be undone in the app — a wrong outcome requires admin
intervention via the audit trail. See [Complete the assessment](walkthroughs/assessors/22-complete-the-assessment.md).

> 📷 *Screenshot: the Set Application Outcome card with the Qualifies / Does Not
> Qualify buttons and the confirmation dialog.*

---

## Sibling linking

Applications are **per child**, but a family's finances are assessed as one unit.
When a family has more than one child applying or holding a bursary, link the
siblings so the calculator absorbs fees sequentially: the **older** sibling's
yearly payable fees are deducted from the family's HNDI **before** the younger
sibling's bursary is worked out. The younger child therefore typically qualifies
for a near-full or full bursary. The same logic applies even across the two
schools.

- **Link siblings** — on the **Applicant Data** tab, in the **Link a Sibling**
  card, search by child name, reference, or lead applicant email, then click
  **Link as Sibling**. A family group is created or joined. See [Link siblings](walkthroughs/assessors/23-link-siblings.md).
- **Re-order priority (succession)** — the **Linked Siblings** card shows each
  child with a priority badge (1, 2, …). Use the up/down arrows to change the
  order; priority 1 is the primary holder whose fees are absorbed first. When the
  eldest leaves school, promote the next sibling so their assessment recalculates
  correctly. See [Re-order sibling priority](walkthroughs/assessors/24-reorder-sibling-priority.md).
- **Break a link** — click **Unlink** on a row and confirm. Both children's
  *future* calculations stop absorbing each other's fees. Historical, already-
  saved assessments are **not** retroactively recalculated — re-open and re-save
  one if it now looks wrong. See [Break a sibling link](walkthroughs/assessors/25-break-sibling-link.md).

The underlying business rules are in PRD [06 — Sibling linking](../product/prd/06-sibling-linking.md).

> 📷 *Screenshot: the Linked Siblings card with priority badges and the up/down
> reorder arrows.*

---

## Re-assessment (year 2 and beyond)

Bursaries are not permanent — every active bursary is re-assessed annually.
A re-assessment is a fresh application for the same bursary account, with ID
documents skipped (checked only in year 1) and address / child details carried
forward.

- **Opening a re-assessment** — re-assessment applications carry the orange
  **Re-assessment** pill in the queue and header. They reach you via the
  admin's [batch re-assessment invitation](walkthroughs/admins/11-batch-reassessment-invitations.md).
  On the **Assessment** tab, before the workspace, two extra panels appear: the
  **First year benchmark** banner and the **Year-on-Year Comparison** table
  (previous year's figures against this year, with trend arrows). See [Open a
  re-assessment](walkthroughs/assessors/26-open-a-reassessment.md).
- **The year-1 benchmark** — the first year's payable fees are stored on the
  bursary account as a reference **floor**. If this year's calculated payable
  fees fall below it, the benchmark banner turns amber and shows the shortfall.
  The benchmark is **advisory** — the system never silently floors the result.
  You decide: honour it by entering a positive manual adjustment equal to the
  shortfall (recording the reason), or allow the lower figure and justify it in
  the narrative and reason codes. See [Compare against the year-1 benchmark](walkthroughs/assessors/27-compare-against-year-1-benchmark.md).
- **Reason codes are mandatory** on a re-assessment — you must explain what
  changed year-on-year (or confirm nothing changed). Read the Year-on-Year
  Comparison first, then tick the codes that match the movement. See [Pick reason
  codes (re-assessment)](walkthroughs/assessors/28-reassessment-reason-codes.md).

The re-assessment rules are described in the README and PRD [05 — Assessment
engine](../product/prd/05-assessment-engine.md).

> 📷 *Screenshot: the re-assessment Assessment tab with the First year benchmark
> banner (amber, below-benchmark state) and the Year-on-Year Comparison table.*

---

## Hand-off to schools: PDF & exports

Schools have **no access** to this system; everything goes to them externally.
There are two hand-off formats.

### Per-application PDF

On the **Recommendation** tab, click **Download PDF** (top-right). The file
(`recommendation-<reference>.pdf`) contains the reference, school, round and
entry year, the family synopsis, the accommodation/income/property categories,
the bursary award and payable fees, any red flags, the reason codes, and the
full recommendation summary narrative. Save the recommendation before
downloading so the figures are current. Use this for a single case. See
[Generate a PDF](walkthroughs/assessors/29-generate-pdf-for-application.md).

### Recommendation list export (CSV / XLSX)

For a whole round, use **Exports** (`/exports`). Choose the **Assessment Round**
(required), an optional **School Filter**, and the **File Format** (XLSX default
or CSV), then **Download**. Only applications with a *completed recommendation*
are included — one row each. Columns are:

| Group | Columns |
|-------|---------|
| Identity | reference, school, round, entry year |
| Recommendation | family synopsis, accommodation status, income category, property category |
| Money | bursary award (£), yearly payable fees (£), monthly payable fees (£) |
| Flags | dishonesty (Y/N), credit risk (Y/N) |
| Year-on-year | reason codes (comma-separated `code. label`) |
| Result | outcome (Qualifies / Does Not Qualify / Pending) |

**GDPR note:** the export does **not** include the applicant's full name or
email. The family synopsis, however, may contain identifying detail — redact
before sending externally if your team's policy requires it. The recommendation
*summary* is not in the spreadsheet; send the PDF if the school needs it. See
[Export recommendation list](walkthroughs/assessors/30-export-recommendation-list.md).

---

## Reports & dashboards

The **Reports** page (`/reports`) shows aggregate statistics per round. Pick a
round in the top-right round selector; the URL updates with the round id. A live
status-tile dashboard also exists at `/admin`.

The report sections available today (seven, picked from the tab strip):

| Report | What it shows | Walkthrough |
|--------|---------------|-------------|
| **Award Distribution** | Recommended bursary award **percentages** in bands; higher-award bands highlighted | [Bursary awards](walkthroughs/assessors/32-bursary-awards.md) |
| **School Comparison** | Per-school totals, average award %, average monthly payable fees (the practical *round summary* view today) | [Round summary](walkthroughs/assessors/31-round-summary.md) |
| **Income Bands** | Histogram of calculated household net income | [Income distribution](walkthroughs/assessors/33-income-distribution.md) |
| **Property Categories** | Count per property category (1–12); the £750K line sits around 8–9 | [Property category distribution](walkthroughs/assessors/34-property-category-distribution.md) |
| **Reason Codes** | Reason codes ranked by use across the round | [Reason code frequency](walkthroughs/assessors/35-reason-code-frequency.md) |
| **Final-Year Bursaries** | ACTIVE accounts whose holders are in Y12/Y13 (0–1 years remaining), with latest yearly payable fees and sibling count — for succession planning. Not round-scoped. | [Active bursaries approaching final year](walkthroughs/assessors/36-active-bursaries-final-year.md) |
| **Sibling Summary** | Families with two or more linked accounts, with combined children count, combined yearly payable fees, and combined award. Not round-scoped. | [Sibling bursary summary](walkthroughs/assessors/37-sibling-bursary-summary.md) |

The reporting requirements are in PRD [09 — Reporting and export](../product/prd/09-reporting-and-export.md).

> The one report named in the spec that has **no dedicated `/reports` section** is
> a standalone *Round Summary* (total applications by status/outcome/school for a
> single round). For now the **School Comparison** card plus the queue status
> filters and the `/admin` status tiles give you the same totals. Tracked in
> [`docs/backlog/round-summary-report-section.md`](../backlog/round-summary-report-section.md).

> 📷 *Screenshot: the Reports page with the round selector and the Award
> Distribution and Property Categories charts.*

---

## Admin: round lifecycle

**(Admin only.)** A **round** is one academic year's assessment cycle. It moves
through three states.

| State | Meaning | Applicants can register? |
|-------|---------|--------------------------|
| **DRAFT** | Created but not yet live | No |
| **OPEN** | Live; the active round | Yes |
| **CLOSED** | Past its window | No (but in-flight applications can still be assessed) |

1. **Create** — **Rounds** → **Create Round**. Set the **Academic Year** (e.g.
   `2026/27`), **Open Date**, **Close Date** (after open), and optional
   **Decision Date** (after close). The round starts in **DRAFT**. See [Create a
   new round](walkthroughs/admins/01-create-new-assessment-round.md).
2. **Open** — in the DRAFT row's Actions, click **Open Round** and confirm.
   **Only one round can be OPEN at a time** — the system blocks opening a second.
   Applicants can now register against it. See [Open a round](walkthroughs/admins/02-open-a-round.md).
3. **Close** — in the OPEN row's Actions, click **Close Round** and confirm. No
   new applications can be submitted, but existing ones remain fully assessable.
   See [Close a round](walkthroughs/admins/03-close-a-round.md).
4. **Historical rounds** — every prior round stays visible in the **Rounds**
   list for reporting and re-assessment comparison. Click an academic year for
   the round detail page: status, the three key dates, summary cards (total,
   submitted, in progress, completed, qualifies, does not qualify) and a
   per-school breakdown. See [View historical rounds](walkthroughs/admins/04-view-historical-rounds.md).

The round-management requirements are in PRD [04 — Admin round management](../product/prd/04-admin-round-management.md).

> 📷 *Screenshot: the Rounds list showing DRAFT, OPEN and CLOSED status badges.*

---

## Admin: reference data

**(Admin only.)** The calculation depends on lookup tables you maintain under
**Settings** (`/settings`), across five tabs. One rule governs all of them:

> **The effective-date rule.** Changes apply to **new** assessments only. Any
> assessment already finalised keeps the values that were in force when it was
> calculated. Nothing is ever deleted — the previous record is retained for
> historical fidelity and the new one supersedes it going forward.

| Tab | What you maintain | Notes | Walkthrough |
|-----|-------------------|-------|-------------|
| **Family Types** | The six categories' notional **rent**, **utility** and **food** costs | Drives Stages 2 & 3 | [Edit family type categories](walkthroughs/admins/05-edit-family-type-categories.md) |
| **School Fees** | Annual fee per school (Trinity, Whitgift), **pre-VAT** | The system applies 20% VAT automatically — never add it by hand | [Edit school fees](walkthroughs/admins/06-edit-school-fees.md) |
| **Council Tax** | The Band D Croydon default figure | Label is fixed; only the figure changes (updated annually) | [Edit the council tax default](walkthroughs/admins/07-edit-council-tax-default.md) |
| **Reason Codes** | The ~35 year-on-year codes (label, sort order, deprecation) | Deprecated codes hide from new assessments but stay on historical records; don't change a code key once used | [Manage reason codes](walkthroughs/admins/08-manage-reason-codes.md) |
| **Email Templates** | Subject & body for the seven transactional emails | Merge fields are documented inline; keep `{{registration_link}}` in invitation templates | [Edit email templates](walkthroughs/admins/09-edit-email-templates.md) |

For the seeded values (notional rents, utility/food costs, council tax bands,
school fees, property categories) see the README reference tables and the source
[`assessment-model.xlsx`](../product/assessment-model.xlsx). The seven email
templates are listed in the [email template reference](#email-template-reference).

> 📷 *Screenshot: the Settings page with the five reference-data tabs.*

---

## Admin: privacy, compliance & audit

**(Admin only.)** The Foundation's GDPR obligations are baked into the system.

### GDPR deletion

When a data subject exercises their right to erasure, delete from the
application's detail page: **Actions** → **Delete Applicant Data (GDPR)** →
confirm in the two-step **Permanently Delete Applicant Data?** dialog by clicking
the red **I understand, delete** button. This:

- deletes the application sections and uploaded documents (Storage objects
  removed), the assessment, and the recommendation;
- anonymises the applicant's profile (name and email cleared, role set to
  `DELETED`) and removes the auth user;
- writes a `GDPR_DELETION` audit entry **with no personal data in the entry
  itself** — so the fact of deletion is logged without retaining what was
  deleted.

A **7-year retention guard** blocks deletion of applications inside the retention
window that are tied to an active or recently-closed bursary; if the button is
disabled with a retention message, record the refusal in your GDPR response to
the applicant. Keep your own written evidence of the request — the system records
the deletion, not the request. See [Delete an applicant under GDPR](walkthroughs/admins/12-delete-applicant-gdpr.md)
and PRD [10 — GDPR and data](../product/prd/10-gdpr-and-data.md).

> 📷 *Screenshot: the two-step "Permanently Delete Applicant Data?" confirmation
> dialog.*

### Audit log review

The **Audit** page (`/audit`) is the system-wide, **append-only, immutable**
activity log. Filter by **Entity type** (Application / Document / Assessment /
Invitation), **Action** (substring match, e.g. `REVEAL`, `GDPR`, `STATUS`), and a
**From / To** date range. Each row shows the action, a coloured status dot, the
acting user, the entity, a relative and full timestamp, and an expandable
metadata payload.

Typical reviews:

- **Name reveals** — filter Action = `REVEAL` to confirm only authorised staff
  revealed names.
- **GDPR** — filter Action = `GDPR` for deletion entries.
- **Document handling** — Entity type = Document.
- **Status changes** — Action = `STATUS` to trace an application's lifecycle.

Logged events include status changes, document uploads/verifications, name
reveals, invitations, assessment completions, outcomes, GDPR deletions and staff
MFA resets. See [Audit log review](walkthroughs/admins/13-audit-log-review.md).

> 📷 *Screenshot: the Audit Log page with the filter bar and an expanded metadata
> row.*

---

## Troubleshooting / "If something goes wrong"

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| **Can't open a second round** ("Another round is already open") | Only one round may be OPEN at a time | Close the currently-open round first, then open the new one — [Close a round](walkthroughs/admins/03-close-a-round.md). |
| **The queue is empty** (assessor) | You only see applications assigned to you | Check your filters, or ask an admin to assign applications to you. |
| **Invitation email didn't arrive** | Delivery issue, or wrong address | Check the **Invitation History** row status, **Resend** the invitation, and confirm the email address; persistent delivery failures are an operational issue — see [`docs/operations/`](../operations/). |
| **"A valid email address is required" / "An application round is required"** | Form validation | Correct the email field / select a round before sending. |
| **Locked out of MFA** (lost authenticator) | No factor to challenge against | An admin resets your factor on `/users`; you re-enrol on next sign-in — [Reset MFA](walkthroughs/admins/14-reset-staff-mfa.md). If *all* admins are locked out, escalate to engineering per [`docs/operations/`](../operations/). |
| **"Complete" button is disabled** | Annual School Fees is still 0 | Enter the school's annual fee in Section A. |
| **Calculation looks wrong** | A figure entered against the wrong parent/slot, or stale reference data | Re-check your Stage 1–3 inputs against the source documents; re-select the family type to re-pull current reference figures; compare against the [calculation reference](#calculation-reference). |
| **A sibling's figures look stale after unlinking** | Historical assessments aren't retroactively recalculated | Re-open and re-save the affected assessment to refresh its snapshot — [Save the assessment](walkthroughs/assessors/16-save-the-assessment.md). |
| **PDF download returns 404 / 403** | Recommendation not saved yet / session lost rights / record deleted | Click **Save Recommendation** first; if 403, re-sign-in; if the record was GDPR-deleted it's gone. |
| **Export has fewer rows than expected** | Only completed-recommendation applications are exported | Confirm those applications have a saved recommendation; check the round/school filter. |
| **Can't reach an application** (redirect to `/admin` or 404) | Not assigned to you / GDPR-deleted | Ask an admin to assign it; a 404 means it was deleted or never existed. |
| **A wrong outcome was sent** | Terminal status has no in-app undo | Identify the change in the audit log and ask an admin to handle the correction via the escalation path in [`docs/operations/`](../operations/). |

For anything operational or engineering — deployments, environment variables,
backups, incidents, the hypercare window — use the **operations runbook** under
[`docs/operations/`](../operations/), not this guide.

---

## Frequently asked questions

**Why don't we just use the figures the applicant typed in?**
Because the calculation runs on *evidence*, not declarations. Applicants
frequently confuse net/gross or monthly/yearly, and a few misrepresent their
situation. You derive verified net figures from the source documents. See [the
two-layer model](#the-two-layer-model-and-why-it-matters).

**Why are names hidden by default?**
Data minimisation. You don't need a name to assess finances, so the system shows
references and "Parent 1 / Parent 2". When you do need a name, **Show names**
reveals it and logs the reveal against you.

**An assessor needs to invite a single first-time family — can they?**
The dedicated Invitations page is Admin-only, but an assessor can use the
**Internal Request** flow on the queue, which sends the same invitation email.
Otherwise ask an admin.

**What's the difference between a scholarship and a bursary?**
A scholarship is a **percentage** fee reduction awarded by the school (merit-
based), applied first. A bursary is a means-tested **£ amount** from the
Foundation, applied after. Both can apply at once.

**What is the year-1 benchmark and does it cap the result automatically?**
It is the first year's payable fees, kept as a reference floor. It is **advisory
only** — the engine never silently floors a re-assessment. If you want to honour
it, enter a manual adjustment for the shortfall and record the reason.

**Can I edit the bursary award on the Recommendation tab?**
No. The award and payable fees there are read-only and come from the completed
assessment. Change them on the assessment (which an admin may need to re-open).

**Are reason codes mandatory?**
On re-assessments, yes — you must explain the year-on-year change (or confirm "no
change"). On new bursaries they are optional.

**How does sibling linking change the numbers?**
The older sibling's payable fees are deducted from the family's HNDI before the
younger sibling's bursary is calculated, so younger siblings usually qualify for
a near-full or full bursary. It works across both schools.

**I changed a school fee in Settings — why didn't an existing assessment update?**
By design. Reference-data changes apply to **new** assessments only; finalised
assessments keep the values in force at the time. Re-selecting the family type in
an in-progress assessment re-pulls current values.

**Do I add VAT myself?**
No. School fees are stored pre-VAT and the calculator adds 20% (or the
configured rate) automatically after scholarship and bursary deductions.

**A family lives outside Croydon — what about council tax?**
The model uses Band D Croydon by default regardless of where they live; override
the council-tax figure in Section A only when genuinely needed.

**Can I undo a Qualifies / Does Not Qualify outcome?**
Not in the app — it is terminal and triggers the applicant email. Trace it in the
audit log and ask an admin to handle the correction.

**Where do new reason codes come from?**
An admin adds or edits them under Settings → Reason Codes. If a code you need
doesn't exist, ask an admin rather than improvising in free text — the export
grouping relies on codes.

**What happens to data when someone leaves / requests deletion?**
Data is retained for 7 years (legal requirement), then deleted. A right-to-erasure
request is actioned by an admin via the GDPR deletion flow, subject to the 7-year
retention guard.

**Who actually decides whether a child gets a bursary place?**
The Foundation assesses and *recommends*; the school's Headmaster decides, weighing
the recommendation, the entrance exam, and the funds available. There is no
committee step inside this system.

**Where do I get help if something is broken?**
See [Getting help / support](#getting-help--support) in the appendix.

---

## Appendix

### Glossary

| Term | Meaning |
|------|---------|
| **Two-layer model** | The separation between applicant-declared data (evidence only, not calculated) and assessor-entered data (the verified figures the engine uses). |
| **Name masking** | Hiding personal identifiers by default; names are revealed only when needed, and reveals are audit-logged. |
| **Round** | One academic year's assessment cycle, with open/close/decision dates. Moves DRAFT → OPEN → CLOSED. |
| **Notional rent** | An imputed annual housing cost (by family-type category) deducted from income; added back if the home is mortgage-free. |
| **Savings divisor** | Total savings ÷ school-age children ÷ schooling years remaining, giving the annualised per-child **derived savings**. |
| **HNDI after NS** | Household Net Disposable Income after Necessary Spending — income + assets minus necessary spending; the figure compared to school fees. |
| **Necessary Spending** | The sum of notional rent, utilities, food, council tax and pre-VAT school fees used in Stage 3. |
| **Required Bursary** | Stage 4 output: `max(0, gross fees − HNDI after NS − absorbed sibling fees)`. |
| **Scholarship** | A percentage fee reduction awarded by the school, applied before the bursary. |
| **Bursary award** | The means-tested £ reduction from the Foundation, capped at gross fees. |
| **Payable fees** | What the family actually pays: net fees + VAT, after scholarship and bursary, including any manual adjustment. Yearly and monthly. |
| **Benchmark** | The first year's payable fees, kept as an advisory floor for re-assessments. |
| **Manual adjustment** | A £ override on yearly payable fees (positive increases, negative reduces); requires a reason. |
| **Property category** | A 1–12 classification of the family's property position, used for reporting (not in the calculation). |
| **Reason code** | A configurable code (~35) explaining year-on-year change; required on re-assessments. |
| **Red flag** | Dishonesty or credit-risk tag set on the assessment, surfaced to the school. |
| **Sibling linking** | Manually linking a family's children so older siblings' fees are absorbed before younger siblings' bursaries are calculated. |
| **Reference** | The application's identifier (e.g. `JW-2026-0042`); active bursaries use a school prefix **WS-** (Whitgift) / **TS-** (Trinity). |
| **Entry year** | The year group the child enters (Y6/Y7/Y9/Y12), which sets schooling years remaining. |
| **Internal / ad-hoc bursary** | A bursary requested off-cycle for pastoral/emergency reasons, with a freely editable entry year. |

### Role-permission matrix

| Capability | ADMIN | ASSESSOR | VIEWER |
|------------|:-----:|:--------:|:------:|
| Sign in (MFA enforced in prod) | ✅ | ✅ | ✅ |
| View the application queue & detail | ✅ | ✅ (assigned) | ✅ |
| Reveal names (Show names, logged) | ✅ | ✅ | ✅ |
| Verify / upload documents | ✅ | ✅ | ❌ |
| Begin / run / complete an assessment | ✅ | ✅ | ❌ |
| Write & save a recommendation | ✅ | ✅ | ❌ |
| Set outcome (Qualifies / Does Not Qualify) | ✅ | ✅ | ❌ |
| Link / re-order / break sibling links | ✅ | ✅ | ❌ |
| Internal / ad-hoc bursary request | ✅ | ✅ | ❌ |
| Generate PDF / export recommendation list | ✅ | ✅ | ✅ |
| View reports & dashboards | ✅ | ✅ | ✅ |
| Send single new-bursary invitation (Invitations page) | ✅ | ❌ | ❌ |
| Batch re-assessment invitations | ✅ | ❌ | ❌ |
| Resend / revoke invitations | ✅ | ❌ | ❌ |
| Create / open / close rounds | ✅ | ❌ | ❌ |
| Edit reference data & email templates | ✅ | ❌ | ❌ |
| Invite / manage staff, change roles | ✅ | ❌ | ❌ |
| Reset a staff member's MFA | ✅ | ❌ | ❌ |
| GDPR deletion | ✅ | ❌ | ❌ |
| Review the system-wide audit log | ✅ | ❌ | ❌ |

### Application & assessment status reference

**Application status** (shown as the status badge and in queue filters):

| Status | Meaning |
|--------|---------|
| **Pre-Submission** | Invited and registered; the applicant is still filling in the form. |
| **Submitted** | The applicant has submitted; awaiting an assessor to begin review. |
| **Not Started** | Review begun (you clicked **Begin Review**); assessment not yet completed. |
| **Paused** | Held awaiting documents from the applicant (after **Request Missing Documents**). |
| **Completed** | The assessment is finished; the recommendation can be written and an outcome set. |
| **Qualifies** | Terminal: the family qualifies for a bursary; outcome email sent. |
| **Does Not Qualify** | Terminal: the family does not qualify; outcome email sent. |

**Assessment status** (the workspace status chip):

| Status | Meaning |
|--------|---------|
| **In Progress** | The assessment is open and being worked on (auto-saving). |
| **Paused** | Saved and paused. |
| **Completed** | Locked read-only; feeds the recommendation and the bursary account's latest payable fees. |

**Invitation status** (Invitation History):

| Status | Meaning |
|--------|---------|
| **PENDING** | Sent, not yet accepted (can be resent or revoked). |
| **ACCEPTED** | The recipient has registered (cannot be resent/revoked). |
| **EXPIRED** | Lapsed or revoked; the link no longer works. |

### Calculation reference

A compact cheat-sheet of the four-stage engine. The authoritative narrative and
the seeded reference tables are in the project README; the source model is
[`assessment-model.xlsx`](../product/assessment-model.xlsx). All figures are
**annual** and use **assessor-entered, evidence-based** values.

**Stage 1 — Total Household Net Income**
```
Parent 1 net income (by employment status)
+ Parent 2 net income (by employment status)
+ Included benefits (income to the household; excluded benefits are recorded but NOT added)
+ Additional property income (from Stage 2)
= TOTAL HOUSEHOLD NET INCOME
```

**Stage 2 — Net Assets Yearly Valuation**
```
Start from Total Household Net Income
− Notional rent (by family-type category)
+ Notional rent added back   (only if the home is mortgage-free)
+ Additional property income (if more than one property owned)
+ Derived savings = (cash savings + ISAs/PEPs/shares) ÷ school-age children ÷ schooling years remaining
= NET ASSETS YEARLY VALUATION
```

**Stage 3 — HNDI after Necessary Spending**
```
Necessary Spending = notional rent + utilities + food + council tax (Band D Croydon) + pre-VAT school fees
HNDI after NS = Net Assets Yearly Valuation − Necessary Spending
```

**Stage 4 — Bursary impact & payable fees**
```
Gross Fees       = annual fees × (1 − scholarship% / 100)
Required Bursary = max(0, Gross Fees − HNDI after NS − absorbed sibling payable fees)
Bursary Award    = Required Bursary, capped at Gross Fees
Net Yearly Fees  = Gross Fees − Bursary Award
+ VAT (20% default) on Net Yearly Fees
± Manual Adjustment
= Yearly Payable Fees      (÷ 12 = Monthly Payable Fees)
```

**Schooling years remaining** (by entry year): Year 6 = 8, Year 7 = 7, Year 9 =
5, Year 12 = 2 (internal/ad-hoc requests can enter at any year).

**Soft income guidelines** (not enforced): full bursary around ~£27K household
income; no bursary assumed around ~£90K. The model decides regardless.

**Qualifying criterion:** the family should own one property valued under £750K;
property portfolios above this may be disqualified. The £750K line sits around
property categories 8–9.

### Email template reference

Seven transactional templates are configurable under Settings → Email Templates
([Edit email templates](walkthroughs/admins/09-edit-email-templates.md)). Each
has an editable subject and body with documented merge fields (e.g.
`{{applicant_name}}`, `{{child_name}}`, `{{school}}`, `{{round_year}}`,
`{{deadline}}`, `{{registration_link}}`).

| Template | Fires when |
|----------|------------|
| **Invitation** | An admin (or internal request) invites a first-time applicant. |
| **Submission confirmation** | The applicant submits their application. |
| **Missing documents** | An assessor sends a **Request Missing Documents** email (status → Paused). |
| **Outcome — Qualifies** | The outcome is set to Qualifies. |
| **Outcome — Does Not Qualify** | The outcome is set to Does Not Qualify. |
| **Re-assessment invitation** | A batch (or individual) re-assessment invitation is sent for a new round. |
| **Reminder** | A reminder is sent for an outstanding action. |

> Always keep `{{registration_link}}` in the invitation and re-assessment
> templates — removing it breaks the registration flow.

### Reason codes

The system ships with roughly **35 configurable year-on-year reason codes**,
grouped by theme (1–9 Income, 10–19 Property & Assets, 20–29 Family
Circumstances, 30–39 Risk Flags, plus *Other*). They explain why a bursary award
or payable fees changed (or did not) at re-assessment, and are reported to
schools.

Codes are **admin-managed** under Settings → Reason Codes — you can add new
codes, edit labels and sort order, and deprecate codes (deprecated codes hide
from new assessments but remain on historical records). Because the list is
configurable, treat the README's table as the seeded starting point rather than a
fixed list; the live set is whatever appears in the picker. See [Manage reason
codes](walkthroughs/admins/08-manage-reason-codes.md) and, for selection,
[Select reason codes](walkthroughs/assessors/20-select-reason-codes.md).

### Getting help / support

For problems this guide and the walkthroughs don't solve:

1. **Operational / engineering issues** (the app is down, emails won't send,
   deployment, environment, backups, an incident, the post-go-live hypercare
   window) — follow the **operations runbook** under [`docs/operations/`](../operations/):
   [deployment](../operations/deployment.md), [environment variables](../operations/environment-variables.md),
   [backup & restore](../operations/backup-restore.md), [incident response](../operations/incident-response.md),
   and [hypercare](../operations/hypercare.md).
2. **Support tickets & SLAs** — raise issues through the contracted support
   channel (Zoho Desk) per **MSA Schedule 3 (support model) and Schedule 6
   (SLAs)**. Your admin holds the support contact details and the agreed
   response/resolution targets.

### Index of detailed walkthroughs

The click-by-click walkthroughs are the screenshot-led companion to this guide.

**Assessor walkthroughs** — [`walkthroughs/assessors/`](walkthroughs/assessors/)

*Daily queue work*
- [01 — Triage the queue](walkthroughs/assessors/01-triage-the-queue.md)
- [02 — Open an application](walkthroughs/assessors/02-open-an-application.md)

*Inviting applicants (single)*
- [03 — Invite one applicant for a new bursary](walkthroughs/assessors/03-invite-applicant-new-bursary.md)
- [04 — Invite for an internal / ad-hoc bursary](walkthroughs/assessors/04-invite-internal-ad-hoc-bursary.md)

*Tab 1 — Reviewing the submission*
- [05 — Read the submitted application](walkthroughs/assessors/05-read-submitted-application.md)
- [06 — Verify uploaded documents](walkthroughs/assessors/06-verify-uploaded-documents.md)
- [07 — Upload a document on behalf of the applicant](walkthroughs/assessors/07-upload-document-on-behalf-of-applicant.md)
- [08 — Request missing documents](walkthroughs/assessors/08-request-missing-documents.md)

*Tab 2 — Running the assessment*
- [09 — Set up the assessment workspace](walkthroughs/assessors/09-set-up-assessment-workspace.md)
- [10 — Enter Stage 1 — Income](walkthroughs/assessors/10-enter-stage-1-income.md)
- [11 — Enter Stage 2 — Assets](walkthroughs/assessors/11-enter-stage-2-assets.md)
- [12 — Stage 3 — Living costs](walkthroughs/assessors/12-stage-3-living-costs.md)
- [13 — Stage 4 — Bursary impact](walkthroughs/assessors/13-stage-4-bursary-impact.md)
- [14 — Apply a manual adjustment](walkthroughs/assessors/14-apply-manual-adjustment.md)
- [15 — Property category and red flags](walkthroughs/assessors/15-property-category-and-flags.md)
- [16 — Save the assessment](walkthroughs/assessors/16-save-the-assessment.md)

*Tab 3 — Writing the recommendation*
- [17 — Build the family synopsis](walkthroughs/assessors/17-build-family-synopsis.md)
- [18 — Set accommodation, income, property](walkthroughs/assessors/18-set-accommodation-income-property.md)
- [19 — Record bursary award and payable fees](walkthroughs/assessors/19-record-bursary-award-and-payable-fees.md)
- [20 — Select reason codes](walkthroughs/assessors/20-select-reason-codes.md)
- [21 — Write the recommendation narrative](walkthroughs/assessors/21-write-recommendation-narrative.md)
- [22 — Complete the assessment](walkthroughs/assessors/22-complete-the-assessment.md)

*Sibling linking*
- [23 — Link siblings](walkthroughs/assessors/23-link-siblings.md)
- [24 — Re-order sibling priority](walkthroughs/assessors/24-reorder-sibling-priority.md)
- [25 — Break a sibling link](walkthroughs/assessors/25-break-sibling-link.md)

*Re-assessment (year 2+)*
- [26 — Open a re-assessment](walkthroughs/assessors/26-open-a-reassessment.md)
- [27 — Compare against the year-1 benchmark](walkthroughs/assessors/27-compare-against-year-1-benchmark.md)
- [28 — Pick reason codes (re-assessment)](walkthroughs/assessors/28-reassessment-reason-codes.md)

*Hand-off to the school*
- [29 — Generate a PDF for one application](walkthroughs/assessors/29-generate-pdf-for-application.md)
- [30 — Export recommendation list](walkthroughs/assessors/30-export-recommendation-list.md)

*Reports*
- [31 — Round summary](walkthroughs/assessors/31-round-summary.md)
- [32 — Bursary awards](walkthroughs/assessors/32-bursary-awards.md)
- [33 — Income distribution](walkthroughs/assessors/33-income-distribution.md)
- [34 — Property category distribution](walkthroughs/assessors/34-property-category-distribution.md)
- [35 — Reason code frequency](walkthroughs/assessors/35-reason-code-frequency.md)
- [36 — Active bursaries approaching final year](walkthroughs/assessors/36-active-bursaries-final-year.md)
- [37 — Sibling bursary summary](walkthroughs/assessors/37-sibling-bursary-summary.md)

**Admin walkthroughs** — [`walkthroughs/admins/`](walkthroughs/admins/)

*Round lifecycle*
- [01 — Create a new assessment round](walkthroughs/admins/01-create-new-assessment-round.md)
- [02 — Open a round](walkthroughs/admins/02-open-a-round.md)
- [03 — Close a round](walkthroughs/admins/03-close-a-round.md)
- [04 — View historical rounds](walkthroughs/admins/04-view-historical-rounds.md)

*Reference data management*
- [05 — Edit family type categories](walkthroughs/admins/05-edit-family-type-categories.md)
- [06 — Edit school fees](walkthroughs/admins/06-edit-school-fees.md)
- [07 — Edit the council tax default](walkthroughs/admins/07-edit-council-tax-default.md)
- [08 — Manage reason codes](walkthroughs/admins/08-manage-reason-codes.md)
- [09 — Edit email templates](walkthroughs/admins/09-edit-email-templates.md)

*Staff and applicant invitations*
- [10 — Invite a staff member](walkthroughs/admins/10-invite-a-staff-member.md)
- [11 — Batch re-assessment invitations](walkthroughs/admins/11-batch-reassessment-invitations.md)

*Privacy and compliance*
- [12 — Delete an applicant under GDPR](walkthroughs/admins/12-delete-applicant-gdpr.md)
- [13 — Audit log review (system-wide)](walkthroughs/admins/13-audit-log-review.md)

*Operations*
- [14 — Reset another staff member's MFA](walkthroughs/admins/14-reset-staff-mfa.md)
- [15 — Re-send or revoke an invitation](walkthroughs/admins/15-resend-or-revoke-invitation.md)

---

*For the parent/guardian side of every hand-off in this guide — accepting an
invitation, completing the form, uploading documents, checking an outcome — see
the companion [Applicant User Guide](applicant-guide.md).*
