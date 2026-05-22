## 5. Wireframes & Mockups

Detailed wireframes will be produced during the design phase. This section describes the **key screens** and their conceptual layout, referencing screenshots of the existing system where available.

### 5.1 Existing System Reference

Screenshots of the current Symplectic Grant Tracker system are available in the `screenshots/` directory and documented in:

- **[APPLICATION.md](../specs/applicant-form.md)** — every input component in the applicant portal, section by section
- **[ADMIN.md](../specs/admin-console.md)** — admin console screens, workflows, and assessment tools

These serve as the baseline for the replacement. The new system should replicate all documented functionality while improving usability, terminology (replacing grant-tracker jargon with bursary-specific language), and mobile responsiveness.

### 5.2 Key Screen Descriptions

#### 5.2.1 Applicant Portal

| Screen | Description |
|--------|-------------|
| **Registration** | Minimal form: email (pre-filled from invitation link), password creation, confirm password. |
| **Application Dashboard** | Landing page after login. Shows: application status (Draft/Submitted/Under Review/Outcome Available), section progress (list of sections with complete/incomplete indicators), deadline countdown, and a "Continue Application" button. For re-assessments, a note that address and child details are pre-populated. |
| **Section Form** | One screen per section (e.g., "Details of Child", "Parent/Guardian Details"). Left sidebar or top navigation shows all sections with status. Main area contains the form fields for the current section with inline validation. Document upload slots appear alongside their related fields. "Save" and "Next Section" buttons at the bottom. |
| **Validation Summary** | Pre-submission review screen. Lists every incomplete required field and missing upload, grouped by section. Each item links to the relevant field. A "Submit Application" button is enabled only when all requirements are met. |
| **Submitted Confirmation** | Read-only summary of the full application. Status shown as "Submitted". |

#### 5.2.2 Admin Console

| Screen | Description |
|--------|-------------|
| **Dashboard** | Tile or card-based summary of the current round: counts by status (Pre-Submission, Submitted, Not Started, Paused, Completed, Qualifies, Does Not Qualify). Quick links to the application queue and round settings. |
| **Application Queue** | Table view. Columns: Reference, School, Status, Submission Date, Assessor Notes flag, Red Flags. **Names are hidden by default** (data minimisation — see NM-01). A "Show Names" toggle reveals Child Name and Lead Applicant columns. Filterable by: status, school, round. Sortable by any column. Row click opens the application detail. |
| **Application Detail** | Tabbed view. **Tab 1: Applicant Data** — read-only view of everything the applicant submitted, section by section, with inline document viewer. **Tab 2: Assessment** — the assessor's data entry form (see below). **Tab 3: Recommendation** — structured recommendation text, reason codes, red flags. **Tab 4: History** — previous years' assessments (for re-assessments), audit trail. |
| **Assessment Form** | The core assessor workspace, displayed as a **split-screen layout** (see AE-17). **Left panel: document viewer** — displays the applicant's uploaded source documents (P60s, tax returns, bank statements). Includes a document selector dropdown/list, page navigation, and zoom controls. **Right panel: data entry form** — **header shows the bursary reference number (e.g., WS-xxx), not the family name** (data minimisation — see NM-02). Top section: family type category selector (auto-populates reference values), school (auto-populates fees), entry year (auto-populates years remaining). Main area: income entry per earner using anonymised labels ("Parent 1", "Parent 2") instead of real names (employment status → relevant income fields), benefit fields (included vs. excluded), property adjustments, savings fields. Bottom section: live calculation results showing each stage's output, final bursary amount, and payable fees (yearly + monthly). Manual adjustment field with reason text. The split ratio is adjustable (drag to resize). |
| **Sibling Linking** | Accessed from within an application detail. Search for another application by child name, reference, or lead applicant email. Link action creates the sibling relationship. Linked siblings are displayed as a list with their payable fees and bursary status. |
| **Recommendation & Reason Codes** | Structured form: family synopsis fields (auto-suggested from assessment data), accommodation status, income category, property category dropdown, bursary award (auto-populated from calculation), payable fees (auto-populated), red flag checkboxes, year-on-year reason code multi-select (for re-assessments), free-text summary field. |
| **Reference Table Management** | Settings screen. Tabbed interface: Notional Rents, Utility & Food Costs, School Fees, Council Tax Default, Property Classifications, Income Thresholds, Reason Codes. Each tab shows the current values in an editable table with "Save" confirmation. |
| **Invitation Management** | Form to invite a new applicant (email, name, child name, school) or batch-invite for re-assessments (select all active bursary holders). Email template preview before sending. |
| **Reports** | Left sidebar lists canned reports (Round Summary, Bursary Awards, Income Distribution, Property Categories, Reason Code Frequency, Approaching Final Year, Sibling Summary). Clicking a report opens it in the main area with filter controls at the top (round, school, date range) and the visualisation (chart + data table) below. An "Ad-hoc Report" option opens the report builder with dropdowns for data source, filters, grouping, and chart type. Every report has "Export CSV", "Export XLSX", and "Export Chart (PNG)" buttons. |

### 5.3 Application Form Sections (Applicant Portal)

The following sections map directly to the existing form documented in [APPLICATION.md](../specs/applicant-form.md), with noted improvements:

| # | Section | Key Fields | Improvements Over Current System |
|---|---------|------------|----------------------------------|
| 1 | Details of Child | School (dropdown), **Entry Year (new: dropdown — Year 6/7/9/12/Other)**, child's full name, DOB, address, birth certificate upload | Entry year is a new field not in the current system |
| 2 | Family Identification | Passport / right-to-remain uploads for each household member | **Hidden/disabled for re-assessments** (currently still shown) |
| 3 | Parent/Guardian Details | Contact info, employment status, employment evidence per parent. Conditional on sole-parent checkbox. | Clearer conditional logic — sole parent hides entire Parent 2 block |
| 4 | Dependent Children | Table of children in household (name, DOB, school, existing bursary) | Pre-populated family member names for re-assessments |
| 5 | Dependent Elderly | Table of elderly dependents (name, at home/in care) | Minor — unchanged |
| 6 | Other Information | Court orders, insurance, outstanding fees | Minor — unchanged |
| 7 | Parents' Income | Gross income table per parent (~14 line items), P60/tax document uploads | Clearer labelling: "yearly gross" with helper text explaining the difference from net |
| 8 | Assets & Liabilities | Property, vehicles, investments, bank statements (3 months), mortgages, overdrafts, HP | Structured upload slots for each bank account's statements |
| 9 | Additional Information | Free-text narrative, supporting evidence uploads | Unchanged |
| 10 | Declaration | Legal declaration checkbox | Unchanged |

---
