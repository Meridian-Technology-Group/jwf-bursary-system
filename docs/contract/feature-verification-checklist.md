# Feature Verification Checklist

**John Whitgift Foundation Bursary Assessment Platform**

> A walk-through checklist for the Foundation to verify the software against the original specification. Tick each item that works as expected; flag anything that is missing, broken, or unexpected with a short note.

---

## How to use this document

1. **Work through the sections in order.** They roughly follow how an applicant and then an assessor would use the system, so the app should "lead" you through them naturally.
2. **Where to find it.** Each section starts with a short orientation and an indication of where in the app to look.
3. **Tick boxes.** Each verifiable behaviour has a checkbox: `[ ]` means "not yet checked", `[x]` means "this works as I'd expect". You can tick boxes by editing this file, or print it and use a pen.
4. **Notes.** At the end of each section there's a **Notes / issues found** block — write a short line here for anything that doesn't behave as you'd expect, is missing, or that you want to discuss.
5. **You don't need a developer.** Everything below should be checkable from the live application — no database, server logs, or developer tools required. If something can only be confirmed by looking "under the hood", it isn't on this list.
6. **If something is unclear, flag it rather than fail it.** A feature may be implemented in a different place than expected — flag it as a question and we'll talk it through.

### Conventions

- **Portal** = the applicant-facing site (the parent/guardian login).
- **Admin Console** = the assessor-facing site (Foundation staff login).
- **Reference numbers** like `WS-001` / `TS-001` are bursary account identifiers (Whitgift / Trinity).
- **Lead applicant** = the parent/guardian who is the primary contact on the application.
- **Round** = an annual assessment cycle (e.g. 2026/27).
- **Re-assessment** = the annual re-evaluation of an existing bursary holder, as distinct from a brand-new application.

### Severity levels (when you write a note)

When you flag an issue in a section's Notes block, please tag it with one of:

- **Blocker** — the system can't go live with this missing or wrong.
- **Important** — must be fixed before the next application round, but a manual workaround exists.
- **Minor** — cosmetic, polish, or a future enhancement.
- **Question** — not sure if this is wrong; want to discuss.

---

## Test accounts to use

Before starting, confirm you have working credentials for:

- [ ] An **applicant** account (parent/guardian) — to verify the Portal.
- [ ] An **assessor** account — to verify the Admin Console.
- [ ] A **viewer** account (read-only assessor) — to verify read-only access works, if applicable.
- [ ] At least one **test application** has been pre-loaded with sample data so you can see how a complete record looks.

---

# Part 1 — Applicant Portal

The Portal is what a parent or guardian sees when applying for a bursary. It is invitation-only — applicants cannot sign themselves up.

## 1. Getting in (Applicant)

**Where to find it:** the Portal login page (separate from the Admin Console).

- [ ] An applicant **cannot register themselves** from the Portal home page (no "Sign up" or "Create account" button visible).
- [ ] When you click the link in an invitation email, you arrive on a registration screen with the email address **pre-filled** for you.
- [ ] The registration link is **time-limited** — old or expired invitation links show a sensible error message rather than letting you register.
- [ ] You can set a password during registration.
- [ ] After registering, you can log in with email + password.
- [ ] You can request a **password reset** via email if you forget your password.
- [ ] The login, registration, and password reset pages work on a **mobile phone** (you can read them, tap fields, and submit without horizontal scrolling).

**Notes / issues found:**

>


## 2. Portal dashboard

**Where to find it:** the first screen after logging in to the Portal.

- [ ] After logging in, you see a clear **application status** (e.g. Draft, Submitted, Under Review, Outcome Available).
- [ ] The dashboard shows a **section-by-section progress indicator** with a tick / "complete" mark next to finished sections.
- [ ] The application **deadline** is shown somewhere on the dashboard.
- [ ] There is a clear **"Continue Application"** (or equivalent) button that takes you back to where you left off.
- [ ] If this is a **re-assessment**, the dashboard makes that clear (e.g. a note saying "This is your re-assessment for 2026/27") and indicates that some fields have been pre-filled.

**Notes / issues found:**

>


## 3. The 10-section application form

**Where to find it:** Portal → "Continue Application" / the application wizard.

The application is split into ten sections. Each one should be completable independently, with progress saved as you go.

- [ ] The form has exactly **ten sections** in this order:
  1. [ ] Details of Child
  2. [ ] Family Identification (passports / right-to-remain documents)
  3. [ ] Parent/Guardian Details
  4. [ ] Dependent Children
  5. [ ] Dependent Elderly
  6. [ ] Other Information
  7. [ ] Parents' Income
  8. [ ] Assets & Liabilities
  9. [ ] Additional Information
  10. [ ] Declaration
- [ ] You can **move between sections freely** in any order (not forced to do them sequentially).
- [ ] You can **save your progress at any point** and come back later — partial data persists across sessions.
- [ ] If your session times out mid-section, your already-saved data is **not lost**.
- [ ] A **left-hand sidebar** (on desktop) shows all ten sections with status indicators (complete / incomplete).
- [ ] On a phone, the progress indicator collapses sensibly (e.g. a horizontal stepper) without losing the ability to navigate.
- [ ] Each section has **Next** and **Previous** buttons in addition to the section list.

**Notes / issues found:**

>


## 4. Form fields and entry

**Where to find it:** within the application sections.

- [ ] **School** is a dropdown limited to Trinity School and Whitgift School.
- [ ] **Entry year** is a dropdown offering Year 6, Year 7, Year 9, Year 12, and an "Other" option.
- [ ] **Employment status** is a dropdown per parent (PAYE, Benefits, Self-Employed Director, Self-Employed Sole, Old Age Pension, Past Employment Pension, Unemployed).
- [ ] **Dependent children** and **Dependent elderly** are entered in **table-style** rows where you can add and remove entries.
- [ ] The **Declaration** section has a legal declaration text and a checkbox you must tick.
- [ ] **Date of birth** fields use a date picker.
- [ ] **Currency fields** (income, assets, etc.) format as money (£) sensibly.
- [ ] Validation errors appear **next to the field** that has the problem, not in a single big list at the top.

**Notes / issues found:**

>


## 5. Form logic that adapts to your answers

**Where to find it:** within the application sections — try the trigger answers below to see the form change.

- [ ] Ticking **"sole parent"** hides all Parent 2 fields.
- [ ] Saying you **own property** reveals mortgage and property value fields.
- [ ] Choosing **PAYE** for a parent reveals a P60 upload slot for that parent; choosing **Self-Employed** reveals different upload slots.
- [ ] The **dependent children** and **dependent elderly** tables only require entries if you have any.
- [ ] The **gross income** table shows the right line items for the employment type chosen.
- [ ] The form changes happen **immediately** when you change an answer — you don't need to save or reload.

**Notes / issues found:**

>


## 6. Document uploads

**Where to find it:** within the application sections — each required document has its own named slot.

- [ ] Each required document has a **named upload slot** (e.g. "Parent 1 — P60", "Birth Certificate", "Three months bank statements").
- [ ] You can **upload multiple files** to a single slot where it makes sense (e.g. three separate monthly bank statements).
- [ ] Only **PDF, JPEG and PNG** files are accepted — other file types (e.g. .docx, .zip) are rejected with a clear error.
- [ ] Files **over 20 MB** are rejected with a clear error.
- [ ] During upload you see a **progress indicator** and a success or error message.
- [ ] A filled slot shows a clear visual indicator (tick, "uploaded" label, or similar).
- [ ] Empty required slots are flagged on the pre-submission review page.
- [ ] You can **upload from a phone** — the file picker on iOS / Android works and accepts photos taken with the camera.
- [ ] **For end-to-end document verification:** when testing, use distinct, slot-named filenames (e.g. `parent1-p60-TEST.pdf`, `bank-jan-TEST.pdf`) so that on the assessor side you can confirm each file lands in the correct slot — see Section 14 ("Document round-trip integrity").

**Notes / issues found:**

>


## 7. Pre-submission review and submission

**Where to find it:** the last step of the wizard — the review / submit page.

- [ ] There is a dedicated **review page** that lists everything still needed before you can submit, grouped by section.
- [ ] Each "incomplete" line on the review page is **clickable** and jumps you to the relevant section.
- [ ] The **Submit** button is **disabled** until every required field and required upload is in place.
- [ ] You must tick the **legal declaration** checkbox before the Submit button enables.
- [ ] Submitting shows a clear **confirmation page** with a read-only summary of what was submitted.
- [ ] An automated **confirmation email** arrives at the applicant's address shortly after submission.
- [ ] After submission, the application becomes **read-only** — you can no longer edit any field.
- [ ] The dashboard now shows status as **"Submitted"** with the submission date/time.

**Notes / issues found:**

>


## 8. Re-assessment (year 2 and beyond)

**Where to find it:** Portal, when logged in as an applicant who was previously a bursary holder in a new round.

- [ ] When a new round opens, existing bursary holders receive a **re-assessment invitation email** with a direct link.
- [ ] Logging in for re-assessment, the dashboard makes it clear this is a re-assessment (not a new application).
- [ ] The following fields are **pre-filled** from last year:
  - [ ] Lead applicant's address
  - [ ] Child name, date of birth, school
  - [ ] Names of dependent family members
- [ ] **All financial sections** (income, assets, liabilities) start **blank** and must be re-entered fresh.
- [ ] The **Family Identification** section (passports / right-to-remain) is **not shown** on re-assessment — these are only checked in year one.
- [ ] Pre-filled fields are **editable** — the applicant can correct or update them.

**Notes / issues found:**

>


# Part 2 — Admin Console (Assessor / Foundation Staff)

The Admin Console is what Foundation staff use to manage the bursary scheme: invite applicants, assess applications, write recommendations, run reports, and configure the system.

## 9. Getting in (Assessor)

**Where to find it:** Admin Console login (separate URL from the applicant Portal).

- [ ] Assessor login uses **email + password**.
- [ ] **Multi-factor authentication** is required for assessors (e.g. you are prompted for a code from an authenticator app on each new login).
- [ ] You can request a **password reset** via email.
- [ ] After several failed login attempts, the account is **temporarily locked** or further attempts are rate-limited.
- [ ] An applicant account **cannot** access the Admin Console (try logging in to /admin with applicant credentials — you should be blocked or redirected).
- [ ] A **viewer** account can view applications and reports but **cannot** edit, save, or delete anything.

**Notes / issues found:**

>


## 10. Admin dashboard

**Where to find it:** the first screen after logging in to the Admin Console.

- [ ] The dashboard shows **at-a-glance tiles** for the current round, including total applications and a breakdown by status.
- [ ] There is a tile or section showing **outcome distribution** (Qualifies / Does Not Qualify) for completed assessments.
- [ ] The dashboard has **quick links** to: application queue, round settings, create invitation, reports.
- [ ] A **recent activity** panel shows the latest assessments completed, applications submitted, and significant status changes.

**Notes / issues found:**

>


## 11. Managing application rounds

**Where to find it:** Admin Console → Rounds (or Settings → Rounds).

- [ ] You can **create a new round** with: academic year label (e.g. "2026/27"), application open date, application close date, and a funding decision target date.
- [ ] You can **edit** a round's dates before it closes.
- [ ] You can **close a round** — after closure, no new applications can be submitted against it.
- [ ] You can see a **list of all rounds** with their status (Draft / Open / Closed).
- [ ] Historical rounds are **still viewable** for reporting and comparison.
- [ ] Only **one round** is active for new applications at a time.

**Notes / issues found:**

>


## 12. Inviting applicants

**Where to find it:** Admin Console → Invitations (or "Invite Applicant" button).

- [ ] You can send an **individual invitation** by entering at minimum the applicant's email; optional fields include applicant name, child name, and school.
- [ ] Clicking **Send** generates a unique registration link and emails it to the applicant.
- [ ] The invitation email contains: the unique link, the application deadline, and brief instructions.
- [ ] You can trigger a **batch re-assessment** invitation that emails every active bursary holder for the new round.
- [ ] You can invite an applicant **outside the normal round** for an internal/pastoral bursary request.
- [ ] You can see which invitations have been sent, which links have been used, and which are still outstanding.

**Notes / issues found:**

>


## 13. The application queue (list of applications)

**Where to find it:** Admin Console → Applications (or Queue).

- [ ] Applications are listed in a **table** with at least these columns: reference number, school, status, submission date.
- [ ] **Names are hidden by default** in the queue — you see reference numbers, not applicant or child names.
- [ ] A **"Show Names"** toggle reveals names in the queue; turning it on is logged in the audit trail.
- [ ] A **red flag indicator** column is visible when an application is flagged (dishonesty / credit risk).
- [ ] You can **filter** the queue by: status, school, round, and outcome.
- [ ] You can **sort** by any column (reference, school, status, submission date).
- [ ] Long lists are **paginated** (you don't get a single 500-row scroll).
- [ ] Clicking a row opens the **application detail view** for that application.
- [ ] You can **select multiple rows** with checkboxes and perform a bulk action (e.g. send reminders, batch status update).

**Notes / issues found:**

>


## 14. Application detail — Tab 1: Applicant Data

**Where to find it:** Admin Console → click any row in the queue → "Applicant Data" tab.

- [ ] The first tab is a **read-only view** of everything the applicant submitted, presented in the same ten sections as the Portal.
- [ ] All **uploaded documents** are listed with: document name / slot, filename, upload date.
- [ ] You can **view a document inline** in the browser (PDF / image) without downloading it.
- [ ] You can **download** a document.
- [ ] PDFs and images have **page navigation** and **zoom** controls.
- [ ] You can **mark a document as verified** with a checkbox (or equivalent).
- [ ] You can **upload a document on behalf of the applicant** (for documents received by email).
- [ ] You can trigger a **"Request Documents"** email that lists exactly which documents are missing and is customisable before sending.

### Document round-trip integrity

This is one of the most important integrity checks: the document the assessor sees in a slot must be the **exact same file the applicant uploaded into that exact same slot**. A mis-routed or mis-labelled document — e.g. a bank statement appearing under "Parent 1 P60", or Parent 2's payslip appearing under Parent 1 — could silently corrupt an assessment.

**Set-up:** As a test applicant, upload **distinct, identifiable test files** to each named slot. Use filenames that name the slot, for example:

- `parent1-p60-TEST.pdf` → "Parent 1 — P60"
- `parent2-p60-TEST.pdf` → "Parent 2 — P60"
- `birth-certificate-TEST.pdf` → "Birth Certificate"
- `bank-jan-TEST.pdf`, `bank-feb-TEST.pdf`, `bank-mar-TEST.pdf` → "Three months bank statements"

Then open the same application in the Admin Console and confirm:

- [ ] Every slot the applicant filled on the Portal side **contains a file** on the assessor side (no slot is silently empty).
- [ ] The **filename** shown on the assessor side matches the filename the applicant uploaded.
- [ ] **Opening the document** in the assessor view (inline viewer) shows the **same content** as the file the applicant uploaded — visually identical PDF / image, same number of pages, same text.
- [ ] **Parent 1's documents stay on Parent 1**, and Parent 2's stay on Parent 2 — no cross-routing between earners.
- [ ] **Multi-file slots** show **all** uploaded files (e.g. all three monthly bank statements), not just the first or the most recent.
- [ ] If the applicant **replaces** a file (uploads a new version into the same slot before submission), the assessor side shows the **new version**, not the old one. Confirm by replacing `parent1-p60-TEST.pdf` with `parent1-p60-v2-TEST.pdf`.
- [ ] If the applicant **adds** a file to a multi-file slot after their first save, the new file appears in the assessor view **alongside** the original (the original is not overwritten or hidden).
- [ ] **Upload date / time** shown on the assessor side matches when the applicant uploaded the file (within a minute or two).
- [ ] The **document picker / dropdown in the Assessment workspace (Tab 2)** lists the same files under the same labels as Tab 1 — no slot reordering, no label drift.
- [ ] A document **uploaded by the assessor** on behalf of the applicant is visually distinguished (e.g. an "uploaded by assessor" indicator) from applicant-uploaded files.
- [ ] **Cross-account isolation** — set up two distinct test applicants with their own documents. Confirm Applicant A's documents **never** appear in Applicant B's record, and vice versa.
- [ ] **Downloaded vs. inline-viewed content matches** — downloading a document and opening it locally shows the **same file** as the inline viewer (i.e. the inline viewer isn't fetching a different file than the download button).

**Notes / issues found:**

>


## 15. Application detail — Tab 2: Assessment (the calculation engine)

**Where to find it:** Admin Console → application detail → "Assessment" tab. This is the assessor's main workspace.

### Layout

- [ ] The assessment uses a **split-screen** layout: the document viewer on the left, the data entry form on the right.
- [ ] The left panel lets you **pick which document** to view from a dropdown / list.
- [ ] You can review documents and enter figures **without switching pages**.
- [ ] The header shows the **bursary reference number** (e.g. WS-001), **not** the applicant's family name.
- [ ] Earner labels say **"Parent 1" / "Parent 2"** — not real names.

### Reference value auto-population

- [ ] Selecting a **family type category** auto-fills notional rent, utility costs, and food costs.
- [ ] Selecting a **school** auto-fills annual school fees (pre-VAT).
- [ ] Selecting an **entry year** auto-calculates schooling years remaining.
- [ ] **Council tax** defaults to Band D Croydon.
- [ ] All auto-populated values are **editable** — you can override any of them.

### Stage 1 — Income

- [ ] Per parent: employment status dropdown, plus the right input fields for that employment type (e.g. Net pay for PAYE, Net dividends for Self-Employed Director).
- [ ] Per parent: a separate input for **included** benefits (DLA, ESA, PIP, Carer's Allowance).
- [ ] Per parent: a separate input for **excluded** benefits (child disability benefits — do not count).
- [ ] A live-updating **total income per earner** is shown.
- [ ] A live-updating **household total net income** is shown at the bottom.

### Stage 2 — Assets

- [ ] **Mortgage-free** checkbox; ticking it adds notional rent back into the calculation.
- [ ] Inputs for **additional property count** and **annual income from additional properties**.
- [ ] **Cash savings** and **ISAs / PEPs / shares** inputs.
- [ ] **School-age children count** is used in the savings divisor.
- [ ] **Derived savings annual total** is auto-calculated and visible.
- [ ] **Notional rent** and **council tax** show alongside.
- [ ] A live-updating **net assets yearly valuation** is shown.

### Stage 3 — Living costs

- [ ] Utility costs and food costs auto-populated from family type, but editable.
- [ ] A live-updating **HNDI after Necessary Spending** is shown.

### Stage 4 — Bursary impact

- [ ] **Required Bursary** is auto-calculated and shown (Annual fees − HNDI after NS).
- [ ] **Payable fees** breakdown is visible, showing:
  - [ ] Gross fees (pre-VAT)
  - [ ] Scholarship percentage (editable, default 0%)
  - [ ] Bursary award (£)
  - [ ] Net yearly fees
  - [ ] VAT (20%)
  - [ ] **Yearly payable fees** (final)
  - [ ] **Monthly payable fees** (yearly ÷ 12)
- [ ] All intermediate values are visible so you can sanity-check the calculation.

### Manual adjustment

- [ ] A **manual adjustment** field accepts a positive or negative £ amount.
- [ ] If the adjustment is not zero, a **reason** text field becomes required.
- [ ] The adjustment is reflected in the final payable fees.

### Property classification

- [ ] A **property category** dropdown (1–12) is available.
- [ ] Categories that exceed the **£750K qualifying threshold** show an advisory warning (not an automatic rejection).

### Save & status

- [ ] You can **save** the assessment at any point.
- [ ] An **assessment status** dropdown lets you mark the assessment as Not Started / Paused / Completed.
- [ ] When status is Completed, an **outcome selector** appears: Qualifies / Does Not Qualify.
- [ ] Re-opening a saved assessment loads all your entered figures back exactly.

### Calculation accuracy — worked checks

Beyond confirming the form *looks* right, the assessor must verify the engine produces the **correct numbers** for inputs they control. These checks complement the formal **Calculation Parity Test** required by Schedule 1 §3 of the Master Services Agreement (≥10 historical cases, ≤5% material equivalence to the existing spreadsheet).

**Worked example you can enter and verify by hand:**

Two-parent household, both PAYE, one child applying to Trinity in Year 7. No savings, no additional property, not mortgage-free.

| Field | Value to enter |
|---|---|
| Parent 1 employment | PAYE |
| Parent 1 net pay | £24,000 |
| Parent 2 employment | PAYE |
| Parent 2 net pay | £18,000 |
| Included / excluded benefits | £0 / £0 |
| Cash savings | £0 |
| ISAs / PEPs / shares | £0 |
| Additional properties | 0 |
| Mortgage-free | No |
| Family type | (one whose defaults show, e.g., notional rent £6,000, utilities £2,400, food £4,800 — note the values that appear) |
| Council tax | (leave at Band D Croydon default — note the value: £____) |
| School | Trinity |
| Entry year | Year 7 |
| Scholarship % | 0 |
| Manual adjustment | £0 |

Tick each line as you confirm the engine's displayed result:

- [ ] **Stage 1 (Household net income)** = £24,000 + £18,000 = **£42,000**.
- [ ] **Stage 2 (Net assets yearly valuation)** = Stage 1 − notional rent − council tax + £0 savings + £0 additional property income.
- [ ] **Stage 3 (HNDI after NS)** = Stage 2 − utilities − food.
- [ ] **Stage 4 (Required Bursary)** = Annual Trinity Year 7 fees (pre-VAT) − Stage 3 HNDI (or £0 if Stage 3 already exceeds fees).
- [ ] **Net yearly fees** = Gross fees − bursary award (scholarship is 0%, so it doesn't reduce gross).
- [ ] **Yearly payable fees** = Net yearly fees × 1.20 (VAT).
- [ ] **Monthly payable fees** = Yearly payable fees ÷ 12.

If any line is off by more than a rounding penny, that is a **Blocker** — flag immediately.

**Edge-case checks (do each on a fresh test application):**

- [ ] **Sole parent** — ticking "sole parent" makes Stage 1 = Parent 1's contribution only. Parent 2's previously-entered values are fully ignored, not still summed silently.
- [ ] **Unemployed earner** — switching an earner to "Unemployed" sets their contribution to £0 in Stage 1, regardless of any value typed earlier.
- [ ] **Included vs. excluded benefits** — moving £1,000 from the "excluded benefits" box (child disability) to the "included benefits" box (DLA / ESA / PIP / Carer's Allowance) increases Stage 1 by **exactly £1,000**.
- [ ] **Mortgage-free toggle** — ticking "mortgage-free" *adds* notional rent back into the assets position (Stage 2 increases). Confirm the sign is correct — this is easy to invert.
- [ ] **Additional property income** — entering £5,000 of annual income from an additional property increases Stage 2 by **£5,000**.
- [ ] **Savings divisor** — £40,000 cash savings, 2 school-age children, 5 schooling years remaining produces a derived savings annual of £40,000 ÷ 2 ÷ 5 = **£4,000**, added to the calculation.
- [ ] **Reference value override** — manually overriding notional rent / utilities / food in the form changes the result immediately, and the override **survives a save and reload** (the family-type default is not silently re-applied on save).
- [ ] **Scholarship 100%** — setting scholarship to 100% takes net yearly fees to **£0** before VAT (boundary case).
- [ ] **Bursary award exceeds net fees** — payable fees **floor at £0**, with no negative payable fees / phantom credit.
- [ ] **Required Bursary floor at zero** — if Stage 3 HNDI ≥ annual fees, Required Bursary is **£0**, not a negative number.
- [ ] **Manual adjustment direction** — a *positive* manual adjustment **increases** payable fees; a *negative* adjustment **decreases** them. The sign convention matches the UI label.
- [ ] **Manual adjustment vs. VAT** — confirm whether the manual adjustment is applied before or after VAT, and that the rule matches the assessor's expectation. Flag if unclear (this is one of the open questions for Part 5).
- [ ] **Live recalculation** — changing any input updates Stage 1–4 results **immediately**, with no save needed.
- [ ] **Save-and-reload integrity** — saving the assessment and re-opening it shows **identical** Stage 1–4 results (no silent drift from re-evaluation against current reference table values).

**Sibling deduction maths:**

Set up two test children in the same family. Assess Child 1 first and complete with yearly payable fees of (say) **£6,000**. Then open Child 2 with Child 1 linked.

- [ ] Child 2's calculation shows Child 1's £6,000 yearly fees as a **deduction line** against Child 2's disposable income.
- [ ] Child 2's Stage 3 / Stage 4 reflects the deduction (Child 2's effective HNDI is £6,000 lower than it would be without the link).
- [ ] Child 1's calculation is **unaffected** by linking Child 2.
- [ ] Adding a third child shows **Child 1 + Child 2** payable fees deducted from Child 3's disposable income.
- [ ] **Re-ordering priority** (Child 2 becomes primary) recalculates Child 1's deduction to £0 against the new primary, and the new primary absorbs disposable income first.

**Re-assessment benchmark behaviour:**

- [ ] When the current-year calculation would produce payable fees **below** the year-1 benchmark, a visual warning is shown — but the calculation is **not silently overridden**. The assessor still controls the final outcome via the manual adjustment field with a required reason.
- [ ] When current-year fees are **above** the benchmark, no benchmark warning appears.
- [ ] The benchmark value displayed is the **year-1 original** payable fees, not last year's figure.

**The formal Calculation Parity Test (acceptance gate):**

Per Schedule 1 §3 of the Master Services Agreement, the engine must produce results materially equivalent to the Foundation's existing assessment spreadsheet for ≥10 anonymised historical cases, each within 5% of the spreadsheet result.

- [ ] The Foundation has supplied **ten anonymised historical cases** to the supplier (Foundation obligation, due **15 May 2026** under Schedule 1).
- [ ] The supplier has run all ten through the engine and produced a side-by-side comparison report.
- [ ] All ten cases meet the **5% material-equivalence threshold**, or any deviations are explained (rounding, edge-case treatment, documented improvements to the assessment model).
- [ ] You, as the assessor, **agree** that the engine is fit to assess real-world bursary applications.

### Re-assessment-specific extras

When viewing a re-assessment (year 2+):

- [ ] **Previous year's figures** are shown side-by-side with the current year's entry fields.
- [ ] The **benchmark** (original year-1 payable fees) is displayed as a reference floor.
- [ ] If the new calculation would fall **below the benchmark**, a visual warning appears.

**Notes / issues found:**

>


## 16. Application detail — Tab 3: Recommendation

**Where to find it:** Admin Console → application detail → "Recommendation" tab.

- [ ] The recommendation form pulls **family synopsis** suggestions from assessment data (single/married, number of children, employment) but they are editable.
- [ ] **Accommodation status** can be set to Renting / Mortgaged / Mortgage-free.
- [ ] **Income category** is shown as a band label (e.g. "£15K–£25K"), not a precise figure.
- [ ] **Property category** (1–12) is carried over from the assessment.
- [ ] **Bursary award** and **payable fees** (yearly + monthly) are pre-filled from the calculation, editable.
- [ ] **Red flag checkboxes** for dishonesty and credit risk are present.
- [ ] **Year-on-year reason codes** (multi-select) are visible on re-assessments — around 35 codes are available to choose from.
- [ ] Deprecated reason codes are **hidden from new assessments** but still visible on historical records.
- [ ] A **free-text summary** field is available for the recommendation narrative.
- [ ] The recommendation can be **saved** as Draft or finalised as Completed.

**Notes / issues found:**

>


## 17. Application detail — Tab 4: History & Audit Trail

**Where to find it:** Admin Console → application detail → "History" tab.

- [ ] A **year-by-year schedule** lists every assessment for this bursary account, with academic year, status, available date, required-by date, and received date.
- [ ] You can **click into any prior year** to view that year's full assessment and recommendation.
- [ ] A chronological **audit log** for this application shows: timestamp, user, action, brief description (e.g. status changes, document uploads, name reveals).
- [ ] The audit log is **read-only** — there is no edit or delete button on individual entries.

**Notes / issues found:**

>


## 18. Sibling linking

**Where to find it:** Admin Console → application detail → "Link Sibling" (or equivalent action).

- [ ] You can **search for related applications** by child name, reference number, or lead applicant email.
- [ ] Clicking a search result **creates the link** and reflects it on both records.
- [ ] Linked siblings are **listed visibly** in the assessment, with reference, child name, payable fees, and status.
- [ ] The eldest sibling's payable fees **automatically deduct** from the next sibling's disposable income in the calculation.
- [ ] For three siblings, the first two siblings' payable fees both deduct from the third.
- [ ] Sibling linking works **across schools** (one child at Trinity, another at Whitgift) — the family is treated as one unit.
- [ ] You can **re-order sibling priority** when a child leaves school, so the next child becomes the primary holder.
- [ ] You can **break a sibling link** if it was set up wrongly.

**Notes / issues found:**

>


## 19. Internal / ad-hoc bursary requests

**Where to find it:** Admin Console → applications → "Create Application" or equivalent (outside the normal round).

- [ ] You can create an application **outside the standard round cycle** for a pastoral or emergency request.
- [ ] The **entry year** field accepts non-standard years (not only 6, 7, 9, 12) — e.g. "Year 10" for a mid-school request.
- [ ] **Schooling years remaining** is editable rather than fixed.
- [ ] If approved, the request **rolls into the standard cycle** and is re-assessed annually like other bursaries.
- [ ] It is assigned the same **WS-xxx / TS-xxx** reference format.

**Notes / issues found:**

>


## 20. Application status workflow

**Where to find it:** Admin Console → application detail → status controls.

- [ ] Application status can move through: **Pre-Submission → Submitted → Under Review → Completed**, with outcome of **Qualifies** or **Does Not Qualify**.
- [ ] You can put an application on **Paused** while waiting for documents.
- [ ] Every status change is **logged in the audit trail** with timestamp and user.
- [ ] You can perform **bulk status updates** from the application queue.

**Notes / issues found:**

>


# Part 3 — Reports, Exports, and Settings

## 21. Reports & analytics

**Where to find it:** Admin Console → Reports.

The following canned reports should be available. For each, confirm the chart renders, the data looks right, the filters work, and the export button produces a sensible CSV/XLSX.

- [ ] **Round summary** — total applications, breakdown by status, breakdown by outcome, breakdown by school. Chart and data table.
- [ ] **Bursary awards** — total £ awarded, average yearly and monthly payable fees, count of full vs partial bursaries, trend across rounds.
- [ ] **Income distribution** — histogram of household net income in bands, filterable by school and outcome.
- [ ] **Property category distribution** — bar chart by category 1–12, with the £750K threshold visually highlighted.
- [ ] **Reason code frequency** — ranked list of reason codes for a selected round, with counts and percentages.
- [ ] **Active bursaries approaching final year** — list of bursary accounts in Year 12 / Year 13, with current payable fees and expected end date.
- [ ] **Sibling bursary summary** — list of families with linked siblings, with per-child fees and combined household total.
- [ ] Each report supports a **round filter** and (where relevant) a **school filter**.
- [ ] Each report supports **Export CSV**, **Export XLSX**, and (for charts) **Export PNG**.
- [ ] By default, reports use **reference numbers, not names**.

### Ad-hoc report builder (if present)

- [ ] You can pick a **data source** (Applications, Assessments, Active Bursaries).
- [ ] You can apply **filters** (round, school, status, outcome, property category, income range, entry year).
- [ ] You can pick **dimensions** for grouping (up to three: school, round, outcome, property category, family type, status).
- [ ] You can pick a **chart type** (table, bar, pie, line).
- [ ] You can **export** the result (CSV, XLSX, PNG).

**Notes / issues found:**

>


## 22. Exports for schools

**Where to find it:** Admin Console → Exports (or "Export Recommendations" button on the Recommendation tab / Reports page).

- [ ] You can export the recommendation list as **CSV** or **XLSX**.
- [ ] The export contains one row per application with: applicant name, child name, school, reference number, family synopsis, income **category** (not precise figure), property **category** (not precise value), bursary award (£), yearly payable fees, monthly payable fees, red flags, reason codes, outcome.
- [ ] You can export for a **specific round** and/or **specific school**.
- [ ] The exported file opens cleanly in Excel / Google Sheets and is well-formatted.

**Notes / issues found:**

>


## 23. PDF generation

**Where to find it:** Admin Console → application detail → "Download PDF" (or equivalent button on the Recommendation tab).

- [ ] A **Download PDF** button is available on the recommendation view.
- [ ] The generated PDF contains a complete summary of the assessment and recommendation in a readable layout.
- [ ] The PDF opens in any standard PDF reader (Preview, Acrobat, browser).

**Notes / issues found:**

>


## 24. Admin settings — reference tables

**Where to find it:** Admin Console → Settings.

Confirm each of the following reference tables is editable in the UI:

- [ ] **Family type categories** (1–6) — with notional rent, utility costs, food costs per category.
- [ ] **School fees** — annual fees per school (pre-VAT), with an effective date.
- [ ] **Council tax default** — Band D Croydon amount, editable.
- [ ] **Property classifications** — categories 1–12 with descriptions and thresholds.
- [ ] **Income guideline thresholds** — configurable income bands used in reporting.
- [ ] **Reason codes** — the ~35 year-on-year reason codes, including: add new, edit label, mark deprecated, set sort order.
- [ ] Changes are **saved** with one click and take effect immediately for new assessments.
- [ ] **Historical assessments** continue to display the reference values that were in effect at the time (i.e. editing today does not retroactively change past assessments).

**Notes / issues found:**

>


## 25. Admin settings — email templates

**Where to find it:** Admin Console → Settings → Email Templates.

Confirm each of the following templates exists and can be edited:

- [ ] **Invitation email** — sent when an applicant is invited.
- [ ] **Submission confirmation** — auto-sent when an applicant submits.
- [ ] **Missing documents request** — sent by the assessor.
- [ ] **Outcome notification — Qualifies**.
- [ ] **Outcome notification — Does Not Qualify**.
- [ ] **Re-assessment invitation** — sent when a new round opens.
- [ ] **Reminder email** — sent to applicants who have not submitted.

For each template:

- [ ] Subject line is editable.
- [ ] Body text is editable.
- [ ] A list of **available merge fields** (e.g. `{{applicant_name}}`, `{{child_name}}`, `{{school}}`, `{{deadline}}`) is shown.
- [ ] Changes are saved with one click and take effect for future emails.

**Notes / issues found:**

>


## 26. Audit log (system-wide)

**Where to find it:** Admin Console → Audit (or similar).

- [ ] There is a **system-wide audit page** showing all logged actions across applications.
- [ ] You can **filter** the audit log by user, action type, entity type, and date range.
- [ ] The audit log is **read-only** — no edit or delete buttons.
- [ ] **Name reveal** actions in the queue are recorded with timestamp and user.

**Notes / issues found:**

>


## 27. GDPR — right to deletion

**Where to find it:** Admin Console → application detail → "Delete Applicant Data" (or equivalent button).

- [ ] A **Delete Applicant Data** action is available on each application.
- [ ] Triggering it shows a **two-step confirmation dialog** (you cannot delete in one click).
- [ ] The dialog clearly lists what will be deleted (application, documents, assessments, recommendation, profile).
- [ ] After deletion, the application **no longer appears** in the queue or reports.
- [ ] The applicant **can no longer log in** with their old credentials.
- [ ] An **audit log entry** is created recording the deletion (date, admin user, anonymised reference) — but this entry contains **no personal data**.

**Notes / issues found:**

>


## 28. Email notifications (end-to-end)

**Where to find it:** check by triggering each action from the Admin Console and confirming the email arrives in the relevant inbox.

- [ ] **Invitation email** arrives when an assessor sends an invitation.
- [ ] **Submission confirmation** arrives in the applicant's inbox after submission.
- [ ] **Missing documents request** arrives when triggered by the assessor.
- [ ] **Outcome notification** arrives when an assessment is completed and the outcome is recorded.
- [ ] **Re-assessment invitation** arrives when an assessor triggers a batch re-assessment.
- [ ] **Reminder email** arrives when an assessor triggers a reminder.
- [ ] Each email correctly substitutes the **merge fields** (the applicant's name, child name, school, deadline, etc. are present rather than `{{placeholders}}`).
- [ ] Emails are received within a reasonable time (a minute or two, not hours).

**Notes / issues found:**

>


# Part 4 — Cross-Cutting Concerns

## 29. Privacy and data minimisation

These are not in a single menu — they are behaviours you should expect to see across the Admin Console.

- [ ] In the application queue, **names are hidden by default** — you see reference numbers, not applicant or child names.
- [ ] The **Show Names** toggle is clearly labelled and the act of toggling is recorded in the audit trail.
- [ ] In the **assessment workspace** (Tab 2), the header shows the reference number, not the family name; earner labels say "Parent 1" / "Parent 2".
- [ ] **Reports** by default show reference numbers, not names.
- [ ] The recommendation **export to schools** does include names (the school needs them), but income and property values are shown as **categories** (e.g. "£15K–£25K"), not precise figures.
- [ ] The school **has no login** to the system — they only receive exports.

**Notes / issues found:**

>


## 30. Mobile, accessibility, and browser support

Confirm these on a phone (iPhone or Android) and at least one secondary desktop browser.

- [ ] The **applicant Portal** is fully usable on a phone — you can read every page, tap fields, upload documents, and submit.
- [ ] The Portal works on the latest two versions of **Chrome, Firefox, Safari, and Edge**.
- [ ] Keyboard-only users can navigate the Portal: **Tab** moves between fields, **Enter / Space** activates buttons, **Escape** closes dialogs.
- [ ] Text on every page has acceptable **colour contrast** — nothing illegible against its background.
- [ ] Form fields have visible **labels** (not just placeholder text that disappears as you type).

**Notes / issues found:**

>


## 31. Performance and stability

Subjective but important — note anything that feels slow or breaks under realistic use.

- [ ] The Portal feels **fast** on a typical broadband connection — pages load within a couple of seconds, with no spinners that hang.
- [ ] The **live assessment calculation** updates instantly as you type, with no perceptible delay.
- [ ] **Document upload** completes in a reasonable time for a 20 MB file.
- [ ] You can leave the assessment workspace **open for an hour**, return, and continue without losing data or being silently logged out mid-edit.
- [ ] Nothing visibly crashes, throws a stack trace, or shows a "Something went wrong" page during normal use.

**Notes / issues found:**

>


## 32. Security touchpoints you can see from the UI

You won't be auditing the server, but a few things should be visible from the browser.

- [ ] Every page is served over **HTTPS** (the browser shows a padlock; no "Not Secure" warning).
- [ ] Logging out actually logs you out — you can't hit the browser **Back** button and see protected pages.
- [ ] A **viewer**-role user cannot save, edit, or delete (the buttons are either hidden or disabled with a clear "read-only" indication).
- [ ] You cannot share a **document URL** from one logged-in session and have it open in another browser without authentication — the link should either ask for login or expire.

**Notes / issues found:**

>


---

# Part 5 — Open Questions / Things to Discuss

Items below are described in the original specification but may need clarification before you can confidently sign them off. Please review and let us know your preference for each.

1. **Email template editor format.** Should the editor be a simple text box (with `{{merge_tags}}`), or a "what you see is what you get" editor (with a toolbar like a Word document)?
2. **In-portal applicant notifications.** Should the applicant see a **notification badge** on the dashboard for things like "Outcome available" and "Documents needed", or are emails alone sufficient?
3. **Family type category selection.** Should the assessor pick the family type manually from the dropdown, or should the system suggest one automatically based on the declared household composition?
4. **Manual adjustment reason — free text or dropdown?** Should the "reason for manual adjustment" be a free-text field, or a dropdown of pre-defined reasons (e.g. "Honouring year-1 benchmark", "Pastoral grounds", "Other")?
5. **Reason code deprecation visual.** When a reason code is deprecated, should it be greyed out and disabled in the new-assessment picker, hidden entirely, or shown only in a separate "Historical codes" list?
6. **PDF summary content.** What exact content should the downloadable PDF include — full application + assessment + recommendation, or recommendation only?
7. **Property £750K threshold.** Today this is an advisory warning that does not block the calculation. Do you want it to also block the outcome (force "Does Not Qualify"), or keep it advisory?
8. **Re-assessment pre-population vs. staleness.** If a pre-filled address from last year is now out of date, should the field be **pre-filled but editable** (current behaviour), or **left blank** to force the applicant to re-enter it deliberately?
9. **Locked post-submission view.** After submission, should the applicant see their submitted form in a **read-only locked view**, or simply see a "Submitted — awaiting outcome" summary page with no detail?
10. **Reference table effective-date scheduling.** Should the UI let you schedule a reference value change for a future date (e.g. "new school fees effective from 1 September"), or is "edit and save now" enough?

---

# Sign-off

Once every section above has been walked through, please record an overall judgement here.

**Reviewer name:** ____________________________

**Date of review:** ____________________________

**Overall outcome (tick one):**

- [ ] **Accept** — feature set matches expectations; remaining items are minor/cosmetic.
- [ ] **Accept with caveats** — the feature set is acceptable but a list of "Important" items must be fixed before go-live (see notes throughout).
- [ ] **Hold** — one or more "Blocker" items prevent acceptance; need to be addressed before sign-off.

**Summary comments:**

>


---

> *This checklist tracks user-visible features only. Behaviours that can only be confirmed at the database, server, or code level (e.g. encryption-at-rest, audit log immutability in the database, row-level security policies) are covered by the Master Services Agreement's security clauses and the independent security review at gate G3, rather than by this walk-through.*
