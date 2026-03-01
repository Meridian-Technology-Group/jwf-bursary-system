# Admin Portal (Management Console) - System Documentation

## Overview

The John Whitgift Foundation Bursary Portal uses the **Symplectic Grant Tracker** (part of Digital Science) as its management console. The admin interface is accessed at `bursaries.johnwhitgiftfoundation.org/console/`. It provides a full grant lifecycle management system repurposed for bursary assessments.

---

## Main Menu Structure

The top-level navigation has two tabs: **MAIN MENU** and **ADMIN**, plus **A-Z** and **Find a Page** search.

### MAIN MENU

| Category | Sub-items |
|----------|-----------|
| **Funding** | Grants, Rounds |
| **Pre-Award** | Applications, Submitted, Pre-Approved, Pre-Rejected, Reviews |
| **Contracting & Post-Award** | Approved, Grants, Active Grants, Closed Grants, Progress Reports |
| **Monitoring & Evaluation** | Reports |
| **Finance** | *(Out of scope)* |
| **Communications & Content** | *(Out of scope)* |

### ADMIN Menu

| Category | Sub-items |
|----------|-----------|
| **Grants & Reviews** | Master Grant Types, Grant Types, Help Pages, Participant Workflow, Manage Reviews, Progress Report Groups |
| **Templates** | Document Templates, Document Template Design, Document Types, Sections, Merge Tags, Email Templates |
| **Data Import & Export** | Ad Hoc Grants |
| **Forms** | Manage Forms, Form Designer |
| **Monitoring & Evaluation** | Manage Results, Report Types, Reserved Funds |
| **Finance** | *(Out of scope)* |
| **Contacts & Content** | Contact Types, Organisation Categories, Grant Organisation Types, Organisation Positions, Mapping, Classifications, Generic Lookup |

---

## Dashboard / Home

The console home page displays:
- A **bar chart** per round showing application counts split by **Pre-submission** (dark blue) and **Post-submitted** (gold/amber) status.
- A **review data panel** (may show "No review data to display" if none pending).

---

## 1. Funding

### 1.1 Rounds

**Path:** Funding > Rounds

The Rounds page is the top-level container for each bursary assessment cycle (e.g. "Bursary Assessment 2026/27"). Each academic year has its own round.

#### Search / Filter

| Filter | Type | Notes |
|--------|------|-------|
| Name | Text input | |
| Status | Dropdown (Any) | e.g. Applications Open, Applications Closed, Active Projects |
| Grant Type | Dropdown (Any) | e.g. Bursary Assessment |
| Applications Open On | Date input | |
| *Advanced fields* | Expandable | Additional filter criteria available via "enable advanced fields" link |

**My Filter** row (persistent filters): Grant Manager, Grant Manager 2, Team, Meeting, Round, Grant Type, Programme — each with their own sub-selectors.

Actions: **Search**, **Clear**, **Save...** (save filter), **Show As Chart** toggle, **New** (create new round).

#### Rounds List Table

| Column | Description |
|--------|-------------|
| Name | Round name (link to detail), e.g. "Bursary Assessment 2026/27" |
| Status | Current status of the round |
| Applications Open On | Date applications became available |
| Applications Close On | Deadline for submissions |
| Funding Decision On | Date bursary decisions are made |

**Observed statuses:** Applications Open, Applications Closed, Active Projects.

**Historical rounds visible:** Going back to at least 2019/20, demonstrating year-on-year bursary assessment cycles.

#### Round Detail Page

**Path:** Funding > Rounds > [Round Name]

**Left sidebar navigation:**

| Section | Description |
|---------|-------------|
| **Details** | Core round configuration (see below) |
| **Validation** | Validation rules/status for the round |
| **Edit** | Edit round settings |
| **Copy** | Duplicate the round |
| **Application Forms** | Linked application form(s) |
| **Progress Reports** | Progress report configuration for this round |
| **Calendar** | Timeline/scheduling |
| **View Access** | Portal access control (see below) |
| **Classifications** | Category/tag assignments |
| **Documents** | Attached documents |

**Round Details fields:**

| Field | Example Value | Notes |
|-------|--------------|-------|
| Name | Bursary Assessment 2026/27 | |
| Round Status | Applications Open | |
| Configuration Level | Planning | |
| Published | Yes | |
| Grant Type | Bursary Assessment | |
| Application Form | New Bursaries - Application Form - V2 | Which form template applicants fill in |
| Sample Form Type | not published | |
| Visibility | Public | Public = open to all registered users |
| Short (code) | (blank) | |
| Reference Format | 24/25\_[school]\_[name]\_[seq] | Auto-generated reference pattern |

**Application summary counters at top:**

| Counter | Description |
|---------|-------------|
| Pre Submission | Applications started but not yet submitted |
| Submitted | Applications completed and submitted |
| Rejected | Applications that have been rejected |

The detail page also shows a portal URL for the application form entry point.

#### View Access

**Path:** Funding > Rounds > [Round Name] > View Access

Controls who can access and apply through the portal for this round.

**Open round notice:**
> "This round is currently open to the public and all registered users can see it and apply through the portal. To block or limit a contact's ability to apply to this round, add an access restriction here. To change this round's visibility, go to the Round Visibility page."

**Bulk actions:**
- Add multiple contacts...
- Add lead applicants (or submitted applications) from a round...
- Add contacts from a spreadsheet...

**Select Contact modal** (for adding individual contacts):

| Search Field | Type |
|-------------|------|
| Name | Text input |
| Organisation | Text input |
| Email | Text input |
| Grant Ref | Text input |

With **Search**, **Clear**, and **New...** (create new contact) buttons.

**Access list table:**

| Column | Description |
|--------|-------------|
| Name | Contact name (link) |
| Organisation | Associated organisation |
| Email | Contact email |
| Permission | Access level, e.g. "Create Application (1 only)" |
| Action | Manage actions |

### 1.2 Grants

**Path:** Funding > Grants

Individual bursary applications are modelled as "Grants" in the system. Each submitted application becomes a grant record.

---

## 2. Pre-Award

This section manages applications from submission through to approval/rejection.

### 2.1 Pre-Award Sidebar

| Section | Description |
|---------|-------------|
| **Process Existing** | Workflow for processing submitted applications |
| **Submitted** | Newly submitted, awaiting validation |
| **Pre-Approved** | Applications approved at pre-award stage |
| **Pre-Rejected** | Applications rejected at pre-award stage |

### 2.2 Submitted

**Path:** Pre-Award > Applications > Submitted

Instruction: *"The grid below shows all the submitted grants that have yet to be validated. To validate the grant and start the review process, click on the link in the Action column for the appropriate grant and you will be taken to the grant's validation page."*

#### Search / Filter

| Filter | Type |
|--------|------|
| Reference | Text input |
| Lead Applicant | Text input |
| Organisation | Dropdown (Any) |
| Region | Dropdown (Any) |

Plus the standard **My Filter** row (Grant Manager, Grant Manager 2, Team, Meeting, Round, Grant Type, Programme).

Tabs: **Search**, **Saved Filters**, **Export**.

#### Submitted Applications Table

| Column | Description |
|--------|-------------|
| Reference | Auto-generated reference (link), e.g. "24/25\_Old Palace School\_Oghenaobekhai Omozuapo\_085" |
| Round | Which bursary round, e.g. "Bursary Assessment" |
| Lead Applicant | Parent/guardian name who submitted |
| Email | Applicant's email address |
| Submitted On | Date of submission |
| School | Target school (e.g. "CM Palace", "Trinity School") |
| PDF | Link to generate/view PDF of the application |
| Action | **"Validate"** link to begin validation process |

**Bulk action:** "Validate All" button at top-right to batch-validate.

---

## 3. Contracting & Post-Award

Manages approved bursaries through their active lifecycle.

### 3.1 Active Grants

**Path:** Contracting & Post-Award > Active Grants

Instruction: *"The grid below shows all grants that have been 'activated'. Click on the 'Notify' link to notify the lead applicant of the grant's activation. Click on the 'Close' link to close the grant and write off any remaining..."*

#### Search / Filter

| Filter | Type |
|--------|------|
| Reference | Text input |
| Round | Dropdown (Any) |
| End Date | Date input |
| Activation Notified | Dropdown (Any) |

Plus the standard **My Filter** row.

#### Active Grants Table

| Column | Description |
|--------|-------------|
| (Checkbox) | For bulk selection |
| Reference | Grant reference (link) |
| Lead Applicant | Parent/guardian name |
| (Contact name) | Possibly child name or secondary contact |
| Round | Bursary Assessment year |
| Status | e.g. "Active" |
| End Date | When the bursary period ends |
| Action | **Notify** (notify applicant of activation) / **Close** (close the grant) |

### 3.2 Progress Reports (List View)

**Path:** Contracting & Post-Award > Progress Reports

The Progress Reports section is used for **annual re-assessment** of bursaries. Each active bursary generates periodic progress reports that must be completed and reviewed.

#### Left Sidebar

| Section | Description |
|---------|-------------|
| **Progress Reports** | Main list of all progress reports |
| **Overdue Reports** | Reports past their due date |
| **Reminders** | Reminder management |

#### Search / Filter

| Filter | Type | Notes |
|--------|------|-------|
| Reference | Text input | |
| Bursary Status | Dropdown (Any) | |
| Report Type | Dropdown (Any) | |
| Report Status | Dropdown (Any) | |
| Grant Type | Dropdown (Any) | |
| Required By | Date input | |
| Last Reminder Sent | Date input | |
| Assessment Status | Dropdown (Any) | |
| Flagged | Dropdown (Any) | With asterisk, likely a custom flag |
| Visible On Portal | Dropdown (Any) | Whether the report is shown to the applicant |

Plus the standard **My Filter** row and "enable advanced fields" link.

#### Bulk Actions

- **Send reminders for selected progress reports** (link)
- **Mark all selected as shown on portal** (link)
- **Mark all selected as hidden on portal** (link)

#### Progress Reports Table

| Column | Description |
|--------|-------------|
| (Checkbox) | For bulk selection |
| Bursary Flagged | Flag indicator |
| Reference | Grant reference (link) |
| Required On | When the report is due |
| Report Status | e.g. Completed (Resubmit), Closed, Not Started |
| Remitted/Submitted | Whether submitted |
| Approved/Assessment | Whether assessed/approved |
| Assessment Start Date | When assessment began |
| Assessment Status | e.g. Complete, Not Started |
| Completed Date | When completed |
| Visible On Portal | Whether applicant can see it |
| Action | Context-dependent actions |

**Observed report statuses:** Completed (Resubmit), Closed, Not Started, Required (Overdue).

#### Export Configuration

The Export panel (accessed via the Export tab) allows granular field selection for data export:

**Available export fields include:**
- Bursary Flagged
- Reference
- Report Status
- Reminded On
- Assessed
- Required On
- Lead Applicant
- Child
- Pupil Name
- Pupil Year
- Bursary Assessment Top Information (group field, 23 sub-values)
- Final Bursary Offer
- *(and more)*

**Export settings:**
- Select: All / None toggle
- Sort: Logical / Alphabetical
- Shows count of selected fields, records, and total cells to export
- Warning about export time for large datasets
- **Export...** button generates the file

### 3.3 Progress Reports (Individual Grant View)

**Path:** Contracting & Post-Award > [Grant] > Progress Reports

When viewing progress reports for a specific grant, the detail page shows the full report schedule.

#### Search / Filter

| Filter | Type |
|--------|------|
| Type | Dropdown (Any) |
| Status | Dropdown (Any) |
| Available On | Date input |
| Required On | Date input |
| Received On | Date input |
| For Monitoring | Dropdown (Any) |

#### Schedule Table

| Column | Description |
|--------|-------------|
| Year | Sequential number (1, 2, 3...) |
| Type | Report type, e.g. "AnnualType" |
| Status | e.g. Required (Overdue), Closed, Complete (Rejected) |
| Manually Created | Whether manually added |
| Available On | When the report becomes available to fill |
| Required On | Deadline |
| Required By | Who requires it |
| Received On | Date received |
| Contact Type(s) | |
| Attach/Edit/View | Document actions - Edit (for open), View (for closed) |
| Action | Context actions: "Bursary Committee Review", "Notify Recipient & Close", "Show on Portal", "Hide on Portal" |

**Action buttons:**
- **Regenerate Schedule** - Recreate the report schedule
- **New Progress Report** - Manually create a new report

---

## 4. Monitoring & Evaluation

**Path:** Monitoring & Evaluation > Reports

Listed in the main menu but not captured in detail in the screenshots. Provides reporting and analytics across all bursary data.

---

## 5. Individual Grant (Application) Detail

**Path:** Funding > Grants > [Reference]

Each application/grant has a comprehensive detail page.

### Left Sidebar Navigation

| Section | Description |
|---------|-------------|
| **Details** | Core grant information and timeline |
| **Checklist** | Assessment checklist with tabs (see below) |
| **Validation** | Data validation status |
| **Edit** | Edit grant details |
| **Reviews** | Review records and assessments |
| **Contacts** | Associated contacts (parents, child) |
| **Progress Reports** | Annual re-assessment reports |
| **Relationships** | Links to other grants/contacts |
| **Research Outputs** | (Likely unused for bursaries) |
| **Summary** | Overview/summary view |
| **Emails** | Email history for this grant |
| **Documents** | Uploaded documents |
| **Closure Summary** | End-of-grant summary |
| **Classifications** | Tags and categories |
| **Funding** | Financial details |
| **Alert** | Alert/notification settings |

### Grant Detail Panel

**Grant events timeline:**
- Visual timeline bar showing key dates:
  - Created On
  - Submitted On
  - Deadline period (e.g. "01/06/2025 - 30/06/2032")
- Year markers across the timeline (2024, 2025, ... 2032)

**Grant History** section (audit trail of changes)

**Application summary:**

| Field | Description |
|-------|-------------|
| Reference | Auto-generated reference, e.g. "24/25\_Old Palace School\_Oghenaobekhai Omozuapo\_085" |
| JWF Account Code | Foundation internal account code |
| Child Name | Name of the child the bursary is for |
| Synopsis | Summary text |
| Current Amount | Current bursary amount |

### Checklist (Assessment Form)

**Path:** Funding > Grants > [Reference] > Checklist

The Checklist is the **admin-side assessment tool** used to evaluate each bursary application. It has multiple tabs for different aspects of the financial assessment.

#### Checklist Tabs

| Tab | Description |
|-----|-------------|
| **Details (Bursary Assessment)** | Core assessment details |
| **Sorry Living Conditions / Other Children on a JWF School** | Living conditions assessment and other siblings at Foundation schools |
| **Debt Situation** | Applicant's debt assessment |
| **Other Fees with the Foundation** | Any other fees owed to the Foundation |
| **Staff Situation - With the Foundation** | Whether applicant is Foundation staff |
| **Survey / Impact on Financial Profile Section** | Financial profile impact analysis |
| **Net Assets Position** | Calculated net assets (see detail below) |

#### Net Assets Position Tab (Detailed)

Instructions:
- *"Please enter 0 where no cost is applicable."*
- *"YOU MUST SELECT THE SAVE BUTTON AT THE BOTTOM OF THE PAGE OR MOVE BETWEEN TABS ON THIS PAGE FOR CHANGES TO BE SAVED"*

**Family Type Category section:**

| Field | Type | Notes |
|-------|------|-------|
| Family Type Category | Dropdown (1-6) | "ENTER A FIGURE BETWEEN 1 AND 6" |

**Property Section:**

| Field | Type | Notes |
|-------|------|-------|
| Deduct Notional Rent | Auto-calculated | "This value will automatically be calculated but only show in this field when the page is saved" |
| If the owned property is mortgage free | Currency / calculated | "DEDUCT IN THE AVERAGE YEARLY RENTAL INCOME ON [property]..." |
| If more than one property is owned | Currency / calculated | "ADD BACK IN THE ADDITIONAL YEARLY PROPERTY INCOME" |

This tab performs financial calculations to determine the net asset position of the applicant family, factoring in property ownership, mortgage status, and rental income equivalents.

---

## 6. Admin Configuration

### 6.1 Grants & Reviews

| Item | Description |
|------|-------------|
| **Master Grant Types** | Top-level grant type definitions |
| **Grant Types** | Specific grant types (e.g. "Bursary Assessment") |
| **Help Pages** | Portal help content management |
| **Participant Workflow** | Workflow state configuration for application processing |
| **Manage Reviews** | Review process configuration |
| **Progress Report Groups** | Grouping configuration for progress reports |

### 6.2 Templates

| Item | Description |
|------|-------------|
| **Document Templates** | Templates for generated documents (letters, notifications) |
| **Document Template Design** | Visual template designer |
| **Document Types** | Classification of document types |
| **Sections** | Reusable template sections |
| **Merge Tags** | Dynamic data placeholders for templates (e.g. applicant name, amounts) |
| **Email Templates** | Email notification templates |

### 6.3 Data Import & Export

| Item | Description |
|------|-------------|
| **Ad Hoc Grants** | Manual grant creation / bulk import |

### 6.4 Forms

| Item | Description |
|------|-------------|
| **Manage Forms** | List and manage all application forms |
| **Form Designer** | Visual form builder for creating/editing application forms |

### 6.5 Monitoring & Evaluation (Admin)

| Item | Description |
|------|-------------|
| **Manage Results** | Configure result/outcome tracking |
| **Report Types** | Define types of reports (e.g. AnnualType) |
| **Reserved Funds** | Fund reservation management |

### 6.6 Contacts & Content (Admin)

| Item | Description |
|------|-------------|
| **Contact Types** | Define types of contacts (applicant, guardian, etc.) |
| **Organisation Categories** | Categorise organisations (schools, etc.) |
| **Grant Organisation Types** | Organisation type definitions for grants |
| **Organisation Positions** | Role/position definitions within organisations |
| **Mapping** | Data mapping configuration |
| **Classifications** | Taxonomy/tagging system management |
| **Generic Lookup** | Custom lookup list management |

---

## Application Lifecycle (Observed Workflow)

Based on the screenshots, the bursary application follows this lifecycle:

```
1. ROUND CREATED (Funding > Rounds)
   Admin creates a new bursary assessment round for the academic year.
   Sets open/close dates, links application form, configures visibility.
        |
        v
2. PRE-SUBMISSION (applicant portal)
   Applicants register, start filling in the application form.
   Status: "Pre Submission" (counted on round dashboard).
        |
        v
3. SUBMITTED (Pre-Award > Submitted)
   Applicant completes and submits the application.
   Appears in the Submitted queue for admin validation.
        |
        v
4. VALIDATION (Pre-Award > Submitted > Validate)
   Admin clicks "Validate" to check the application.
   Validates data completeness and starts review process.
        |
        v
5. PRE-APPROVED or PRE-REJECTED (Pre-Award)
   Application is either pre-approved or pre-rejected.
        |
        v
6. APPROVED (Contracting & Post-Award > Approved)
   Application is formally approved.
        |
        v
7. ACTIVATED (Contracting & Post-Award > Active Grants)
   Grant is activated. Admin can "Notify" the applicant.
   Bursary period begins (shown on timeline, e.g. 2025-2032).
        |
        v
8. ANNUAL RE-ASSESSMENT (Progress Reports)
   Periodic "AnnualType" progress reports are generated on a schedule.
   Reports cycle through: Required → Submitted → Assessed → Closed.
   Admin can send reminders, review, and approve/reject.
        |
        v
9. CLOSURE (Grant Detail > Closure Summary)
   When the bursary ends, the grant is closed via the "Close" action.
```

---

## Common UI Patterns

### Search & Filter
Every list view follows a consistent pattern:
- **Search** tab with field-specific filters
- **Saved Filters** tab for reusable filter configurations
- **Export** tab for data export
- **My Filter** row with persistent filter selectors (Grant Manager, Grant Manager 2, Team, Meeting, Round, Grant Type, Programme)
- **Search**, **Clear**, **Save...** action buttons

### Data Tables
All list views use sortable, paginated data tables with:
- Clickable column headers for sorting
- Checkbox column for bulk selection
- Reference links to detail pages
- Context-sensitive Action column

### Export
Export is available on most list views with:
- Granular field selection (checkboxes)
- Field grouping for multi-value exports
- Cell count preview
- Logical or Alphabetical field ordering
- File download generation
