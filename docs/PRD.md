# Product Requirements Document
## John Whitgift Foundation — Bursary Assessment System

| Field | Value |
|-------|-------|
| **Author** | Meridian Technology Group (Brian Wagner) |
| **Version** | 1.2 |
| **Date** | 2026-02-22 |
| **Status** | Draft |

---

## Table of Contents

1. [Introduction & Purpose](#1-introduction--purpose)
2. [Target Audience & User Personas](#2-target-audience--user-personas)
3. [Features & Functionality](#3-features--functionality)
4. [Use Cases & User Stories](#4-use-cases--user-stories)
5. [Wireframes & Mockups](#5-wireframes--mockups)
6. [Metrics & Success Criteria](#6-metrics--success-criteria)
7. [Assumptions, Constraints & Dependencies](#7-assumptions-constraints--dependencies)

---

## 1. Introduction & Purpose

### 1.1 Overview

The John Whitgift Foundation provides means-tested bursaries to families applying for places at **Trinity School** and **Whitgift School** in Croydon, South London. The bursary programme assesses the financial circumstances of applicant families and awards fee reductions — expressed as nominal pound amounts ("payable fees") — to those who demonstrate genuine need.

The Foundation currently operates its bursary lifecycle on **Symplectic Grant Tracker** (Digital Science), a research-grant management platform never designed for means-tested bursary assessment. On 14 July 2025, Digital Science announced Grant Tracker will be **sunset on 31 December 2026**, making replacement mandatory.

This document specifies the requirements for a **purpose-built bursary assessment platform** that replaces Grant Tracker and is designed from the ground up for the Foundation's specific workflow: applicant portal, assessor console, financial calculation engine, and annual re-assessment cycle.

### 1.2 Objectives

| # | Objective | Measurable Outcome |
|---|-----------|-------------------|
| O-1 | **Replace Grant Tracker before sunset** | System live and processing applications before 31 Dec 2026 |
| O-2 | **Preserve the existing assessment model** | Four-stage calculation produces identical results to the current spreadsheet model for a set of test cases |
| O-3 | **Improve the applicant experience** | Modern, mobile-responsive portal with clear progress tracking — reducing incomplete submissions and back-and-forth emails |
| O-4 | **Improve assessor efficiency** | Reduce time per assessment through pre-population, auto-calculation, sibling linking, and structured data entry — replacing manual spreadsheet work |
| O-5 | **Maintain GDPR compliance** | 7-year retention enforcement, right-to-deletion support, no school access to the system, encrypted document storage |
| O-6 | **Enable year-on-year continuity** | Benchmark tracking, re-assessment pre-population, and reason codes give the assessor a longitudinal view of each bursary account |

### 1.3 Product Vision

> A single, purpose-built platform where families can submit bursary applications with confidence, and the Foundation's assessor can efficiently validate documents, run standardised financial assessments, produce recommendations for schools, and manage the annual re-assessment cycle — replacing a repurposed grant-management tool with a system that fits the job.

---

## 2. Target Audience & User Personas

### 2.1 User Segments

The system serves three distinct user groups, only two of which interact with the platform directly:

| Segment | System Access | Volume |
|---------|--------------|--------|
| **Applicant (Lead Parent/Guardian)** | Applicant Portal | ~100-200 per annual round |
| **Assessor (Foundation Bursary Staff)** | Admin Console | 1-3 concurrent users |
| **School (Headmaster / Admissions)** | None (receives external exports) | 2 schools |

### 2.2 Persona: Lead Applicant

| Attribute | Detail |
|-----------|--------|
| **Who** | A parent or legal guardian applying for a bursary for their child. Typically the parent with primary custody, or one parent acting on behalf of a married/partnered couple. |
| **Context** | Their child has been offered a place (or is being considered for a place) at Trinity or Whitgift. The family believes they cannot afford the full school fees. They have been invited to apply by the Foundation. |
| **Technical comfort** | Varies widely — from digitally confident professionals to parents with limited English or low digital literacy. |
| **Goals** | Submit a complete, accurate application with all supporting documents within the deadline. Understand what is required at each step. Receive a clear outcome. |
| **Pain points with current system** | <ul><li>Confusing form layout — unclear what is required vs. optional</li><li>Difficulty understanding financial terminology (net vs. gross, monthly vs. yearly)</li><li>No clear progress indicator — unsure if the application is complete</li><li>Cannot easily see which documents are missing</li><li>Must re-enter all information from scratch for annual re-assessments with minimal pre-population</li><li>Receives no in-system status updates — relies on email from the assessor</li></ul> |
| **Single-user model** | Only the lead applicant has portal access. They answer on behalf of both parents. There is no second-parent login. |

### 2.3 Persona: Foundation Assessor

| Attribute | Detail |
|-----------|--------|
| **Who** | A member of the Foundation's bursary team responsible for reviewing applications, verifying financial data against source documents, running the assessment calculation, and producing recommendations for schools. |
| **Context** | Processes ~100-200 applications per annual round (new + re-assessments), plus ad-hoc internal bursary requests year-round. Works alone or with 1-2 colleagues. Is the sole maintainer of reference tables (notional rents, food/utility costs, school fees, council tax default). |
| **Technical comfort** | Confident with spreadsheets and the current Grant Tracker system. Not a developer, but comfortable with structured data entry and configurable settings. |
| **Goals** | Accurately assess each family's financial position. Produce a defensible, consistent recommendation. Manage the annual cycle efficiently. Maintain historical continuity across years for each bursary account. |
| **Pain points with current system** | <ul><li>Assessment is partly done in external spreadsheets — not integrated into the system</li><li>No side-by-side year-on-year comparison during re-assessments</li><li>Sibling linking is manual and fragile</li><li>No payable fees benchmark tracking — must manually compare against prior years</li><li>Recommendation text is stored in a plain text box with no structure</li><li>Missing documents require email communication outside the system, then manual re-attachment</li><li>The system uses research-grant terminology (grants, progress reports, funding rounds) that doesn't match the bursary domain</li><li>Limited export capabilities for reporting to schools</li></ul> |
| **Key responsibility** | The assessor builds an independent financial picture from source documents (P60s, tax returns, bank statements). They do **not** use the applicant's declared figures for the calculation — only the uploaded evidence. This "two-layer" model is fundamental to the role. |

### 2.4 Persona: School Headmaster / Admissions

| Attribute | Detail |
|-----------|--------|
| **Who** | The Headmaster (or delegated admissions staff) at Trinity School or Whitgift School. |
| **Context** | Receives the Foundation's bursary recommendations externally (spreadsheet export) and decides which candidates receive bursary-supported places, based on the recommendation, entrance exam results, and available funds. |
| **System access** | **None.** All communication is external due to GDPR. The school never logs into or views the bursary system. |
| **What they receive** | A recommendation per candidate containing: family synopsis (single/married, number of children, employment roles), accommodation status, income and property categories (not precise figures), bursary award recommendation (nominal £), payable fees recommendation (yearly/monthly), and any red flags. |
| **Implication for the product** | The system must produce a structured, exportable recommendation. No school-facing UI is required. |

---

## 3. Features & Functionality

### 3.1 Functional Requirements

Requirements are organised by module. Priority uses MoSCoW notation: **M** = Must Have, **S** = Should Have, **C** = Could Have (Phase 2).

#### 3.1.1 Applicant Portal

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| AP-01 | **Invitation-only registration** | M | Applicants cannot self-register. An admin sends an invitation (email with unique registration link). The applicant clicks the link, creates a password, and gains access to their application. |
| AP-02 | **Single-user access model** | M | Only the lead applicant (the invited parent/guardian) has portal access. They complete all sections on behalf of both parents. No second-parent login. |
| AP-03 | **Multi-step application form** | M | The form is divided into logical sections (child details, family ID, parent details, household composition, financial commitments, income, assets & liabilities, additional circumstances, declaration). The applicant can navigate between sections freely. See [APPLICATION.md](../APPLICATION.md) for the full field-by-field specification. |
| AP-04 | **Conditional logic** | M | Sections and fields show/hide based on prior answers. Key conditions: sole-parent status hides Parent 2 sections; "Yes" to property ownership reveals mortgage/value fields; employment status reveals corresponding evidence upload fields. Full conditional map in [APPLICATION.md](../APPLICATION.md). |
| AP-05 | **Entry year collection** | M | A required field in the child details section: dropdown with options Year 6, Year 7, Year 9, Year 12. For internal bursary requests, an "Other" option with a free-text year group field. This value feeds into the schooling-years-remaining calculation. |
| AP-06 | **Document upload** | M | Each evidence requirement (passport, P60, bank statements, council tax bill, etc.) has a dedicated upload slot. Accepted formats: PDF, JPEG, PNG. Maximum file size: 20 MB per file. Multiple files per slot where applicable (e.g., 3 months of bank statements). |
| AP-07 | **Save and resume** | M | The applicant can save progress at any point and return across multiple sessions. Partial data is persisted server-side. Session timeout does not lose unsaved work within a section. |
| AP-08 | **Progress tracking** | M | A visual indicator (e.g., step list or progress bar) shows which sections are complete, incomplete, or not started. Incomplete sections display which required fields or uploads are missing. |
| AP-09 | **Validation summary** | M | Before submission, the applicant sees a summary of all incomplete or invalid fields across all sections. They can click through to the relevant section to fix issues. Submission is blocked until all required fields and uploads are present. |
| AP-10 | **Declaration and submission** | M | The final section is a legal declaration (checkbox + signature/confirmation). Once submitted, the application becomes read-only to the applicant. |
| AP-11 | **Re-assessment pre-population** | M | For annual re-assessments: lead applicant's address, child details, and family member names are pre-populated from the previous year's application. The identification documents section is hidden/disabled (ID is only checked in year 1). All financial sections must be completed afresh. |
| AP-12 | **Mobile-responsive design** | M | The portal must be fully functional on mobile devices and tablets. Many applicants will complete the form on a phone. |
| AP-13 | **Status visibility** | S | The applicant can see the current status of their application (e.g., Draft, Submitted, Under Review, Outcome Available) without needing to contact the assessor. |
| AP-14 | **In-app messaging or notifications** | S | Notifications within the portal when the assessor requests additional documents or when an outcome is available, complementing email notifications. |

#### 3.1.2 Admin Console — Round & Application Management

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| AC-01 | **Round management** | M | Create, configure, and close assessment rounds. Each round has: academic year label (e.g., "2026/27"), application open date, application close date, and a funding decision target date. Only one round is active at a time for new applications; previous rounds remain accessible for historical viewing. |
| AC-02 | **Applicant invitation** | M | The assessor enters an applicant's email address (and optionally name, child name, school) to generate an invitation. The system sends the invitation email with a unique registration link. For re-assessments, the system re-activates existing accounts and resets their application to "not submitted" status. |
| AC-03 | **Application queue** | M | A filterable, sortable list of all applications in the current round. Default columns: reference, school, status (Pre-Submission / Submitted / Not Started / Paused / Completed / Qualifies / Does Not Qualify), submission date, assessor notes flag. Child name and lead applicant are hidden by default and revealed via a toggle (see NM-01). |
| AC-04 | **Application detail view** | M | Full read-only view of everything the applicant submitted: all form fields and all uploaded documents. Documents viewable inline (PDF/image viewer) or downloadable. |
| AC-05 | **Document verification** | M | The assessor can mark each required document as received/verified (green tick) or missing. A summary shows overall document completeness at a glance. |
| AC-06 | **Missing documents workflow** | M | When documents are missing, the assessor can: (a) send a templated email to the applicant requesting specific items, (b) set the assessment status to "Paused", (c) attach documents received by email to the application, (d) regenerate/update the application to reflect the new documents. |
| AC-07 | **Application status management** | M | Assessment statuses: Not Started → Paused (awaiting documents) → Completed. Outcome: Qualifies (with nominal £ bursary amount and payable fees) or Does Not Qualify. Status changes are logged. |
| AC-08 | **Bulk operations** | S | Batch actions: send reminder emails to all applicants with incomplete submissions, batch status updates for round closure. |
| AC-09 | **Dashboard** | S | At-a-glance summary of the current round: counts by status (pre-submission, submitted, not started, paused, completed, qualifies, does not qualify). |

#### 3.1.3 Admin Console — Assessment Engine

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| AE-01 | **Two-layer data model** | M | Applicant-entered data (document collection layer) and assessor-entered data (calculation input layer) are stored separately. The calculation engine operates exclusively on assessor-entered figures. The applicant's declared values are visible to the assessor as a cross-reference but do not feed into any calculation. |
| AE-02 | **Assessor data entry form** | M | A structured form where the assessor enters verified NET income figures derived from source documents. Fields per earner: employment status, net pay, individual benefit amounts (with separate sections for included vs. excluded benefits), net dividends, net self-employed profits, pension amounts. Total is per household (Parent 1 + Parent 2 combined). |
| AE-03 | **Stage 1: Total Household Net Income** | M | Sums assessor-entered net income for both earners by employment type. Supports: PAYE employed, on benefits, self-employed (director), self-employed (sole trader/partner), old age pension, past employment pension, unemployed (£0). See README.md for the full income component table. |
| AE-04 | **Benefit inclusion/exclusion** | M | Separate input fields for: (a) benefits counted as income (parent's DLA, ESA, PIP, Carer's Allowance), (b) benefits excluded from income (child's disability benefits). Only included benefits feed into the income total. |
| AE-05 | **Stage 2: Net Assets Position** | M | Property adjustments: deduct notional rent (looked up from Family Type Category), add back if mortgage-free, add additional property income if >1 property, deduct council tax (always Band D Croydon default). Savings adjustments: (cash savings + ISAs/PEPs/shares) / school-age children / schooling years remaining = Derived Savings Annual Total, added back to income. |
| AE-06 | **Stage 3: Family Living Costs** | M | Deduct notional utility + food costs (looked up from Family Type Category). Produces HNDI after NS (Household Net Disposable Income after Necessary Spending). |
| AE-07 | **Stage 4: Bursary Impact** | M | Required Bursary = Annual School Fees − HNDI after NS. If positive, this is the bursary award (nominal £). If zero or negative, no bursary needed. |
| AE-08 | **Payable fees calculation** | M | Gross Fees (pre-VAT) − Scholarship (% of gross) − Bursary Award (nominal £) = Net Yearly Fees. Net Yearly Fees + VAT (20%) = Yearly Payable Fees. Yearly / 12 = Monthly Payable Fees. Scholarship defaults to 0% if none. |
| AE-09 | **Auto-lookup of reference values** | M | Family Type Category selection automatically populates: notional rent, utility costs, food costs. School selection automatically populates annual fees. Council tax defaults to Band D Croydon. Entry year automatically populates schooling years remaining. All auto-populated values are visible and editable (override capability). |
| AE-10 | **Manual adjustment field** | M | A field for the assessor to enter manual adjustments to the calculated payable fees (positive or negative), with a required reason text. This supports exceptional cases (pastoral grounds, honouring historical benchmarks) without hard-coding the logic. |
| AE-11 | **Schooling years remaining** | M | Auto-calculated from entry year (Year 6 = 8, Year 7 = 7, Year 9 = 5, Year 12 = 2). For re-assessments, auto-decrements based on original entry year and current assessment year. Editable for override (internal bursary requests at non-standard years). |
| AE-12 | **Configurable reference tables** | M | The assessor can view and update all reference tables through the admin console: Family Type Categories, Notional Rents, Utility & Food Costs, Property Classification categories, Council Tax default, School Fees (per school), Income Guideline Thresholds. Changes take effect for the current and future rounds; historical rounds retain the values that were active at the time of assessment. |
| AE-13 | **Property classification** | M | The assessor selects a property category (1-12) for reporting purposes. The system flags if the property category exceeds qualifying criteria (one property < £750K) as a potential disqualification. This is advisory, not an automatic rejection. |
| AE-14 | **Qualitative checklist tabs** | M | In addition to the financial calculation, the assessor has structured context panels for: Bursary Assessment Details (summary), Living Conditions / Other JWF Children, Debt Situation, Other Fees with the Foundation, Staff Situation, Financial Profile Impact (life events). These are notes/context fields that support the recommendation but do not feed into the calculation. |
| AE-15 | **Year-on-year comparison** | S | During re-assessment, the assessor sees the previous year's assessor-entered figures alongside the current year's fields for side-by-side comparison. |
| AE-17 | **Split-screen document viewer** | M | The assessment form displays as a split-screen layout: the left panel shows the applicant's uploaded source documents (with navigation between documents), and the right panel shows the assessor's data entry form. The assessor can read figures directly from P60s, tax returns, and bank statements while entering verified values, without switching tabs or windows. The document panel supports zoom, page navigation, and switching between uploaded files. |
| AE-16 | **Automatic change flagging** | C | Detect and highlight significant year-on-year changes (income drop/rise >20%, new property, change in household composition) to draw the assessor's attention. Phase 2. |

#### 3.1.4 Sibling Linking

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| SL-01 | **Manual sibling linking** | M | The assessor can explicitly link two or more applications as siblings. The system does not auto-detect siblings. Linking is by assessor action (e.g., search for and select a related application). |
| SL-02 | **Sequential income absorption** | M | When siblings are linked, the child with the oldest bursary award (chronologically first) absorbs the household's disposable income. Their payable fees are set based on HNDI. |
| SL-03 | **Sibling fee deduction** | M | Child 1's payable fees automatically appear as a deduction in Child 2's disposable income calculation. If a third child exists, Child 1 + Child 2's payable fees are deducted for Child 3, etc. |
| SL-04 | **Cross-school sibling support** | M | Sibling linking works across schools (one child at Trinity, another at Whitgift). The family is assessed as one unit regardless of school. |
| SL-05 | **Sibling succession** | M | When a linked child leaves school (bursary ends), the next sibling becomes the primary bursary holder and takes on the payable fees. The system must support re-ordering sibling priority. |

#### 3.1.5 Assessment Output & Recommendations

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| AO-01 | **Structured recommendation** | M | For each completed assessment, the system generates a recommendation containing: family synopsis (single/married, number of children, employment roles), accommodation status, income category, property category (1-12, not precise figures), bursary award recommendation (nominal £), payable fees recommendation (yearly and monthly), and red flags (dishonesty, credit risk). |
| AO-02 | **Recommendation stored per account per year** | M | Each recommendation is stored against the bursary account for the specific assessment year, building a longitudinal history. The assessor can view previous years' recommendations when performing re-assessments. |
| AO-03 | **Year-on-year reason codes** | M | For re-assessments, the assessor selects one or more reason codes (from a configurable list of ~35 codes) explaining why payable fees have changed compared to the previous year. Codes are multi-select checkboxes. The full list of current codes is documented in [README.md](../README.md#year-on-year-change-reason-codes). |
| AO-04 | **Reason code configuration** | M | Admins can add new reason codes, deprecate (hide) existing ones, and edit labels. Deprecated codes remain visible on historical records but are not selectable for new assessments. |
| AO-05 | **Red flags** | M | The assessor can tag an assessment with: Dishonesty flag (misrepresentation detected in documents), Credit risk flag. These appear prominently in the recommendation and in the application list view. |
| AO-06 | **Export for schools** | M | The recommendation can be exported as a spreadsheet (CSV or XLSX) for external transmission to school admissions. The export contains only the recommendation-level data (categories, not precise financial figures) to comply with GDPR. |
| AO-07 | **PDF summary** | S | Generate a PDF summary of the complete application and assessment for archival or internal review purposes. |

#### 3.1.6 Annual Re-assessment Cycle

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| RA-01 | **Re-assessment invitation** | M | When a new round opens, the assessor can trigger re-assessment invitations for all active bursary holders. The system sends a prewritten (templated) email and resets each holder's application to "not submitted" status in the portal. |
| RA-02 | **Selective invitation** | M | The assessor can also invite individual applicants (not just batch all active holders). This supports internal bursary requests and late additions. |
| RA-03 | **Application pre-population** | M | Re-assessment applications pre-populate: lead applicant's address, child details (name, DOB, school), and family member names from the previous year. Financial sections are blank. |
| RA-04 | **ID section hidden** | M | The identification documents section (passports, right-to-remain) is hidden/disabled for re-assessments. ID is only checked in year 1. |
| RA-05 | **Bursary account reference** | M | Active bursary accounts use a school-prefixed reference: **WS-** (Whitgift School) or **TS-** (Trinity School), followed by the child's identifier. This reference persists across years. |
| RA-06 | **Progress schedule** | M | Each bursary account shows a year-by-year schedule of assessments (Year 1, Year 2, ... up to the final year based on entry year). Each year shows: status (Scheduled / Received / Approved / Rejected), available date, required-by date, received date. |
| RA-07 | **Benchmark display** | S | During re-assessment, display the original (first year) payable fees as a benchmark alongside the current calculation. Flag if the new payable fees would fall below the benchmark floor. |
| RA-08 | **Benchmark tracking dashboard** | C | A longitudinal view showing payable fees history across all years for a bursary account, with the original benchmark highlighted. Phase 2. |

#### 3.1.7 Internal Bursary Requests

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| IB-01 | **Ad-hoc application creation** | M | The assessor can create an application outside the standard round cycle for pastoral/emergency reasons. The parent is invited and completes the same application form. |
| IB-02 | **Non-standard entry year** | M | Internal bursary requests can occur at any year group (not just Year 6/7/9/12). The entry year field accepts any year, and schooling years remaining is calculated accordingly. |
| IB-03 | **Conversion to rolling bursary** | M | An internal bursary request, once approved, becomes a standard bursary account that is re-assessed annually in subsequent rounds. |

#### 3.1.8 Document Management

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| DM-01 | **Structured upload slots** | M | Each required document type (passport, birth certificate, P60, tax return, bank statements, council tax bill, etc.) has a named upload slot in the application form. Applicants upload to the correct slot; the assessor can see at a glance which slots are filled. |
| DM-02 | **Admin document attachment** | M | The assessor can attach documents to an application on behalf of the applicant (for documents received by email). |
| DM-03 | **Inline viewing** | M | Documents (PDF, images) can be viewed inline in the admin console without downloading. |
| DM-04 | **Encrypted storage** | M | All uploaded documents are encrypted at rest. Access is controlled — only the applicant (their own documents) and authenticated admin users can view them. |
| DM-05 | **Retention and deletion** | M | Documents follow the GDPR retention policy: 7-year retention for active/completed bursaries, purge after appeal window for rejected applications, support for right-to-deletion requests. Deletion is permanent and irreversible. |
| DM-06 | **ID document carry-forward** | M | For re-assessments, ID documents from year 1 are retained on the account and visible to the assessor, but the applicant is not asked to re-upload them. |

#### 3.1.9 User Management & Authentication

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| UM-01 | **Invitation-based applicant registration** | M | Applicants register via a unique, time-limited link sent by the admin. Registration requires: email (pre-filled from invitation), password creation. |
| UM-02 | **Applicant authentication** | M | Email + password login. Password reset via email. Session management with appropriate timeout. |
| UM-03 | **Admin authentication** | M | Email + password with multi-factor authentication (MFA). |
| UM-04 | **Admin roles** | M | At minimum, an "Assessor" role with full access to all system functions including reference table management. A read-only "Viewer" role should be available for future use. |
| UM-05 | **Account persistence across rounds** | M | Applicant accounts persist between rounds. For re-assessments, the existing account is re-activated — the applicant does not re-register. |

#### 3.1.10 Email Notifications

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| EN-01 | **Invitation email** | M | Sent when the admin invites a new applicant. Contains: registration link, application deadline, brief instructions. |
| EN-02 | **Submission confirmation** | M | Sent automatically when the applicant submits their application. |
| EN-03 | **Missing documents request** | M | Triggered by the assessor. Templated email specifying which documents are needed. |
| EN-04 | **Outcome notification** | M | Sent when the assessment is complete. Content varies by outcome (qualifies / does not qualify). |
| EN-05 | **Re-assessment invitation** | M | Sent to existing bursary holders when a new round opens. Contains: portal link, submission deadline. |
| EN-06 | **Templated and configurable** | M | All email templates are editable by the admin through the console. Templates support merge fields (applicant name, child name, school, deadline, etc.). |
| EN-07 | **Reminder emails** | S | The assessor can send batch reminders to applicants who have not yet submitted by a configurable date. |

#### 3.1.11 Data Export & Reporting

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| DE-01 | **Recommendation export** | M | Export the school-facing recommendation as CSV/XLSX (one row per application, columns for synopsis fields, categories, award, payable fees, flags). |
| DE-02 | **Field-level data export** | M | Export any filterable subset of application and assessment data (e.g., all applications for a round, all active bursaries, all assessments for a school) as CSV/XLSX. |
| DE-03 | **Report export** | M | Any canned or ad-hoc report (see 3.1.13) can be exported as CSV or XLSX with a single click. Charts export as PNG/PDF. |
| DE-04 | **Audit trail** | S | Immutable log of all create/update/delete operations on applications and assessments. Records: timestamp, user, entity, field, old value, new value. Viewable per application in the admin console. |

#### 3.1.13 Reporting & Analytics

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| RP-01 | **Round summary report** | S | Canned report showing the current (or selected) round at a glance: total applications, breakdown by status (Pre-Submission, Submitted, Not Started, Paused, Completed), breakdown by outcome (Qualifies, Does Not Qualify), breakdown by school. Displayed as a table with accompanying bar/pie charts. |
| RP-02 | **Bursary awards report** | S | Total bursary £ awarded per school per round, average payable fees (yearly/monthly), count of full bursaries (£0 payable fees) vs. partial bursaries, total number of active bursary accounts. Trend line across multiple rounds. |
| RP-03 | **Income distribution report** | S | Histogram or banded bar chart showing the distribution of assessed household net income across applications in a round. Bands configurable (e.g., £0-£10K, £10K-£20K, ... £80K-£90K, £90K+). Filterable by school and outcome. |
| RP-04 | **Property category distribution** | S | Bar chart showing the count of applications by property classification (1-12) for a selected round. Highlights categories above the £750K qualifying threshold. |
| RP-05 | **Year-on-year reason code frequency** | S | For re-assessment rounds: ranked list of which reason codes were most frequently selected, with counts and percentages. Useful for spotting trends (e.g., increased unemployment, more salary increases). |
| RP-06 | **Active bursaries approaching final year** | S | List of bursary accounts where the child is in their penultimate or final year (Year 12 or Year 13). Helps the assessor and schools plan for upcoming bursary exits. |
| RP-07 | **Sibling bursary summary** | S | Report showing all families with linked sibling bursaries: family reference, children (by reference), schools, individual payable fees, combined household bursary total. Names are hidden by default per NM-03. |
| RP-08 | **Ad-hoc report builder** | S | An interactive query tool allowing the assessor to: (a) select a data source (applications, assessments, active bursaries), (b) apply filters (round, school, status, outcome, property category, income range, entry year), (c) choose dimensions to group by (school, round, outcome, property category, family type), (d) choose a visualisation (table, bar chart, pie chart, line chart), (e) view the result and export it. The tool operates on pre-defined fields — not raw SQL. |
| RP-09 | **Report scheduling** | C | Ability to schedule canned reports to run automatically (e.g., weekly round summary email to the assessor). Phase 2. |

#### 3.1.12 GDPR & Data Governance

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| GD-01 | **7-year retention** | M | All application and assessment data is retained for 7 years from the end of the bursary (child leaves school), then automatically flagged for deletion. |
| GD-02 | **Rejected application purge** | M | Applications that result in "Does Not Qualify" are purged after the 4-week appeal window expires. |
| GD-03 | **Right-to-deletion** | M | The admin can process a data deletion request for any applicant. Deletion removes all personal data, uploaded documents, and assessment records. The action is logged (the log entry records that a deletion occurred, not the deleted data). |
| GD-04 | **No school access** | M | The system has no school-facing portal or login. All information is transmitted to schools externally via exports. |
| GD-05 | **Data encryption** | M | All data encrypted at rest (database and document storage) and in transit (TLS). |

#### 3.1.14 Data Minimisation & Name Masking

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| NM-01 | **Default name masking in application queue** | M | The application queue displays reference number, school, status, and submission date. Applicant and child names are hidden by default. The assessor can toggle a "Show Names" control to reveal names when needed (e.g., to identify an applicant for communication). |
| NM-02 | **Anonymised labels in assessment form** | M | The assessment form header displays the bursary reference number, not the family name. Earner fields use anonymised labels ("Parent 1", "Parent 2", "Child") instead of real names. The assessor's financial calculation is not influenced by applicant identity. |
| NM-03 | **Anonymised reports and analytics** | M | Reports and analytics use aggregate data and reference numbers by default, not names. The recommendation export (which is sent to schools) is the only export that includes applicant names, as schools require them for identification. |
| NM-04 | **Name-revealed contexts** | M | Full names are displayed in contexts where identification is necessary: applicant detail view (Tab 1: Applicant Data), communication/email screens, and the recommendation output. These contexts require names for their function. |
| NM-05 | **Audit logging of name reveal** | M | When an assessor toggles name visibility in a masked context (e.g., revealing names in the application queue), the action is logged with timestamp, user, and context. This supports GDPR accountability by recording when personal identifiers were accessed outside their default-hidden state. |

### 3.2 Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NF-01 | **Performance** | Page load time (applicant portal) | < 2 seconds on 4G connection |
| NF-02 | **Performance** | Assessment calculation execution | < 1 second after assessor submits data |
| NF-03 | **Performance** | Document upload | Support files up to 20 MB; upload completes within 30 seconds on broadband |
| NF-04 | **Availability** | Uptime | 99.5% (excluding planned maintenance windows) |
| NF-05 | **Scalability** | Concurrent users | Support up to 50 concurrent applicant portal sessions and 5 concurrent admin sessions |
| NF-06 | **Security** | Authentication | Password hashing (bcrypt/argon2), MFA for admin, rate-limited login attempts, account lockout after repeated failures |
| NF-07 | **Security** | Authorisation | Role-based access control. Applicants can only access their own application. Admins can access all applications within their permissions. |
| NF-08 | **Security** | Data protection | OWASP Top 10 compliance. Input validation and output encoding to prevent XSS, SQL injection, CSRF. Content Security Policy headers. |
| NF-09 | **Security** | Document access | Pre-signed, time-limited URLs for document viewing. No direct public access to stored files. |
| NF-10 | **Security** | Virus scanning | All uploaded files scanned for malware before storage. |
| NF-11 | **Accessibility** | WCAG compliance | WCAG 2.1 Level AA for the applicant portal. |
| NF-12 | **Browser support** | Supported browsers | Latest 2 versions of Chrome, Firefox, Safari, Edge. Mobile Safari and Chrome on iOS/Android. |
| NF-13 | **Backup** | Data backup | Daily automated backups with 30-day retention. Point-in-time recovery capability. |
| NF-14 | **Data residency** | Hosting location | UK data centre (GDPR compliance for UK personal data). |
| NF-15 | **Maintainability** | Deployment | Zero-downtime deployments. Staging environment for pre-production testing. |
| NF-16 | **Security** | Data minimisation | Personal identifiers (names, email addresses) are masked by default in assessment and reporting contexts. Revealed only in contexts where identification is necessary (applicant detail, communication, recommendation export). See functional requirements NM-01 through NM-05. |

---

## 4. Use Cases & User Stories

### 4.1 Use Cases

#### UC-01: New Bursary Application (Standard Entry)

```
Actor:          Lead Applicant + Assessor
Trigger:        Child is offered a place at Trinity or Whitgift
Precondition:   Assessor has the applicant's email address from admissions
```

1. Assessor creates an invitation in the admin console (enters email, child name, school).
2. System sends invitation email with unique registration link.
3. Applicant clicks link, creates password, and lands on the application form.
4. Applicant completes the form across multiple sessions (save and resume), uploading all required documents.
5. Applicant reviews the validation summary, resolves any missing fields/uploads.
6. Applicant ticks the declaration checkbox and submits.
7. System sends submission confirmation email to applicant.
8. Application appears in the assessor's Submitted queue.
9. Assessor opens the application and reviews document completeness.
   - **If documents are missing:** Assessor pauses the assessment, sends a missing-documents email. Applicant provides documents (by email or upload). Assessor attaches any emailed documents and resumes.
10. Assessor opens the assessment form and enters verified NET income figures from source documents (P60, tax returns, bank statements).
11. System auto-populates reference values (notional rent, living costs, school fees, council tax) based on family type category, school, and entry year.
12. System calculates: Total Household Net Income → Net Assets Position → HNDI after NS → Required Bursary.
13. System calculates payable fees (applying scholarship % and bursary £, adding VAT).
14. Assessor reviews qualitative checklist tabs (living conditions, debt, staff situation, financial profile impact).
15. Assessor selects property classification (1-12) and records any red flags.
16. Assessor completes the recommendation text (family synopsis, categories, award, payable fees).
17. Assessor marks assessment as Completed with outcome: Qualifies or Does Not Qualify.
18. System sends outcome notification email to applicant.
19. Assessor exports recommendation and sends to school externally.
20. School Headmaster decides whether to offer a bursary-supported place.

```
Postcondition:  Application is completed with an outcome. If Qualifies,
                a bursary account is active with reference WS-xxx or TS-xxx.
```

---

#### UC-02: Annual Re-assessment

```
Actor:          Lead Applicant + Assessor
Trigger:        A new assessment round opens for the upcoming academic year
Precondition:   The applicant has an active bursary account from a previous year
```

1. Assessor opens the new round and triggers re-assessment invitations (batch or individual).
2. System sends re-assessment invitation email to all active bursary holders.
3. Each applicant's portal resets to "not submitted" with a new blank application for the current round. Address, child details, and family member names are pre-populated. ID section is hidden.
4. Applicant logs in, reviews pre-populated data, completes all financial sections with current-year figures and uploads new supporting documents.
5. Applicant submits.
6. Assessor opens the re-assessment. Previous year's assessor-entered figures are displayed alongside the current fields for comparison.
7. Assessor enters new verified NET figures from current-year source documents.
8. System runs the four-stage calculation and payable fees formula.
9. Assessor compares new payable fees against the historical benchmark (first year's payable fees).
   - If payable fees would increase: assessor verifies a positive financial change justifies the increase.
   - If payable fees would decrease: assessor confirms the family's situation has worsened.
10. Assessor selects year-on-year reason codes explaining any change.
11. Assessor completes the recommendation and marks assessment as Completed.
12. System sends outcome notification.
13. Assessor exports updated recommendation to school.

```
Postcondition:  Bursary account is renewed for the new year with updated
                payable fees. Reason codes and recommendation are stored
                against this year's record.
```

---

#### UC-03: Sibling Application

```
Actor:          Lead Applicant + Assessor
Trigger:        A second child from a family with an existing bursary
                is offered a place at a Foundation school
Precondition:   Child 1 already has an active bursary account
```

1. Assessor invites the same lead applicant for a new application (Child 2).
2. Applicant completes the application for Child 2 (same financial data, different child details).
3. Assessor processes Child 2's application through the standard assessment.
4. Assessor manually links Child 2's application to Child 1's bursary account (sibling link).
5. System deducts Child 1's payable fees from Child 2's disposable income calculation.
6. Because Child 1 has absorbed most/all disposable income, Child 2 qualifies for a near-full or full bursary.
7. When Child 1 eventually leaves school, Child 2's record is updated to become the primary bursary holder, and their payable fees are recalculated accordingly.

```
Postcondition:  Both children have linked bursary accounts. Financial
                calculations reflect the sequential absorption model.
```

---

#### UC-04: Internal Bursary Request

```
Actor:          Lead Applicant + Assessor
Trigger:        A parent of a current student contacts the school due to a
                sudden change in financial circumstances (job loss, illness,
                bereavement, etc.)
Precondition:   The child is already attending a Foundation school (may or
                may not have an existing bursary)
```

1. Assessor creates an ad-hoc invitation for the parent outside the standard round.
2. Parent registers (or logs in if existing account) and completes the full application form.
3. Assessor processes the assessment using the same four-stage model.
4. If the entry year is non-standard (e.g., the child is currently in Year 10), the assessor overrides the schooling-years-remaining field.
5. Assessment is completed. If the family qualifies, a new bursary account is created.
6. In subsequent annual rounds, this bursary is re-assessed alongside all other active bursaries.

```
Postcondition:  A new bursary account is created mid-year. It becomes a
                rolling bursary for future re-assessment cycles.
```

---

#### UC-05: Data Deletion Request

```
Actor:          Applicant (via email/phone) + Assessor
Trigger:        An applicant requests deletion of their personal data
Precondition:   The applicant's data exists in the system
```

1. Applicant contacts the Foundation requesting data deletion.
2. Assessor locates the applicant's record(s) in the admin console.
3. Assessor initiates the deletion process, confirming the scope (which applications/accounts).
4. System permanently deletes: all personal data, all uploaded documents, all assessment records, all recommendations.
5. System creates an audit log entry recording that a deletion was performed (date, admin user, anonymised reference — not the deleted data itself).
6. Assessor confirms deletion to the applicant.

```
Postcondition:  No personal data for this applicant remains in the system.
                An audit record of the deletion exists.
```

---

### 4.2 User Stories

#### Applicant Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-A01 | As an **applicant**, I want to receive a clear invitation email so that I know how to access the portal and what is expected of me. | Email contains: registration link, deadline, brief instructions. Link expires after a configurable period (e.g., 30 days). |
| US-A02 | As an **applicant**, I want to save my progress and return later so that I don't have to complete the entire form in one sitting. | Partial data persists across sessions. Unsaved changes within a section are warned on navigation away. |
| US-A03 | As an **applicant**, I want to see which sections are complete and which have missing fields so that I know exactly what is left to do. | Progress indicator shows complete/incomplete/not-started per section. Incomplete sections list the specific missing fields. |
| US-A04 | As an **applicant**, I want to upload documents to clearly labelled slots so that I know exactly which documents go where. | Each document type has a named slot (e.g., "Parent 1 — P60"). Upload supports PDF, JPEG, PNG up to 20 MB. |
| US-A05 | As an **applicant**, I want to see a validation summary before submitting so that I can fix any errors before my application is reviewed. | A pre-submission screen lists all incomplete required fields and missing uploads, with links to the relevant section. Submission is blocked until all requirements are met. |
| US-A06 | As an **applicant**, I want my address and child details pre-filled for re-assessments so that I don't have to re-enter information the Foundation already has. | For re-assessments: address, child name/DOB/school, and family member names are pre-populated. ID section is hidden. |
| US-A07 | As an **applicant**, I want to see the status of my application so that I know whether it has been received and is being reviewed. | Portal shows current status: Draft, Submitted, Under Review, Outcome Available. |
| US-A08 | As an **applicant**, I want the form to adapt to my circumstances so that I only see fields that are relevant to me. | Sole parent: Parent 2 sections hidden. Not a homeowner: mortgage fields hidden. Employed: employment evidence upload shown. Etc. |

#### Assessor Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-B01 | As an **assessor**, I want to see a queue of submitted applications sorted by date so that I can process them in order. | Application list is filterable by status, school, round. Sortable by submission date, child name, reference. |
| US-B02 | As an **assessor**, I want to view uploaded documents inline so that I can verify figures without downloading files. | PDF and image documents open in a viewer within the admin console. |
| US-B03 | As an **assessor**, I want to enter verified NET income figures from source documents so that the calculation uses accurate data, not applicant declarations. | Assessment form has a separate section for assessor-entered data. Applicant's declared figures are visible as read-only cross-reference. |
| US-B04 | As an **assessor**, I want the system to auto-calculate the bursary and payable fees when I enter the financial data so that I don't need an external spreadsheet. | After entering data, the four-stage calculation and payable fees formula run automatically. Results display immediately. |
| US-B05 | As an **assessor**, I want to link sibling applications so that the second child's assessment correctly deducts the first child's payable fees. | A "Link Sibling" action lets me search for and connect related applications. Child 1's payable fees automatically appear as a deduction in Child 2's calculation. |
| US-B06 | As an **assessor**, I want to see previous year's figures alongside current year during re-assessments so that I can spot changes. | Side-by-side comparison view showing assessor-entered values from the prior year next to current-year entry fields. |
| US-B07 | As an **assessor**, I want to select reason codes for year-on-year changes so that I can explain payable fee changes to the school. | Multi-select checkbox list of configurable reason codes. Selected codes are stored against the assessment record and included in the recommendation export. |
| US-B08 | As an **assessor**, I want to update reference tables (notional rents, food costs, school fees, council tax) so that the calculations reflect current values each year. | Admin settings screen where I can view and edit all reference table values. Changes take effect for the current round. Historical rounds retain their original values. |
| US-B09 | As an **assessor**, I want to export recommendations as a spreadsheet so that I can send them to the school's admissions team. | Export button generates CSV/XLSX with one row per application: synopsis fields, categories, award, payable fees, flags, reason codes. |
| US-B10 | As an **assessor**, I want to send templated emails to applicants for missing documents, reminders, and outcomes so that I don't have to write each email from scratch. | Email templates with merge fields. Triggered from within the application detail view. Template content editable by admin. |
| US-B11 | As an **assessor**, I want to create ad-hoc applications for internal bursary requests so that I can handle pastoral cases outside the standard round cycle. | A "Create Application" action allows me to invite a parent and create an application at any time, outside the current round's normal intake. |
| US-B12 | As an **assessor**, I want to process a data deletion request so that I can comply with GDPR when an applicant asks for their data to be removed. | A "Delete Applicant Data" action permanently removes all personal data, documents, and assessment records. An audit log entry is created. The action requires confirmation. |
| US-B13 | As an **assessor**, I want the assessment form to show reference numbers instead of names so that my financial assessment is not influenced by the applicant's identity. | Assessment form header shows bursary reference number (e.g., WS-xxx). Earner fields labelled "Parent 1", "Parent 2", "Child" — not real names. Applicant names are accessible via the Applicant Data tab but not present in the calculation workspace. |
| US-B14 | As an **assessor**, I want to toggle name visibility in the application queue so that I can find an applicant when I need to communicate with them, while keeping the default view anonymised. | Application queue hides names by default. A "Show Names" toggle reveals the Child Name and Lead Applicant columns. Toggling names on is logged for GDPR accountability. |
| US-B15 | As an **assessor**, I want to view source documents and the data entry form side-by-side so that I can read figures from P60s, tax returns, and bank statements while entering them, without switching between tabs or windows. | Assessment form displays as a split-screen: left panel shows the document viewer (with document selector, page navigation, zoom), right panel shows the data entry form. Split ratio is draggable. |

#### Reporting Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-C01 | As an **assessor**, I want to see a summary of the current round's applications by status and outcome so that I know how the round is progressing. | Round summary report shows counts by status and outcome, broken down by school, with bar/pie chart visualisation. |
| US-C02 | As an **assessor**, I want to see the total bursary awards and average payable fees per school so that I can report to the Foundation's leadership on financial exposure. | Bursary awards report shows totals, averages, and counts per school per round, with trend lines across rounds. |
| US-C03 | As an **assessor**, I want to see which year-on-year reason codes are most common so that I can spot trends in family circumstances across the portfolio. | Reason code frequency report ranks codes by count for a selected round, with percentages. |
| US-C04 | As an **assessor**, I want to see which bursary holders are approaching their final year so that I can plan for capacity and inform the schools. | Report lists bursary accounts in Year 12 or Year 13, with school, payable fees, and expected end date. |
| US-C05 | As an **assessor**, I want to build ad-hoc reports by choosing filters and chart types so that I can answer questions that canned reports don't cover. | Report builder lets me select data source, apply filters (round, school, status, income range, property category), choose grouping dimensions, pick a visualisation type, and export the result. |
| US-C06 | As an **assessor**, I want to export any report as Excel or CSV so that I can share it with colleagues or use it in other tools. | Every report (canned or ad-hoc) has an "Export" button producing CSV or XLSX. Charts can be exported as PNG or PDF. |

---

## 5. Wireframes & Mockups

Detailed wireframes will be produced during the design phase. This section describes the **key screens** and their conceptual layout, referencing screenshots of the existing system where available.

### 5.1 Existing System Reference

Screenshots of the current Symplectic Grant Tracker system are available in the `screenshots/` directory and documented in:

- **[APPLICATION.md](../APPLICATION.md)** — every input component in the applicant portal, section by section
- **[ADMIN.md](../ADMIN.md)** — admin console screens, workflows, and assessment tools

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

The following sections map directly to the existing form documented in [APPLICATION.md](../APPLICATION.md), with noted improvements:

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

## 6. Metrics & Success Criteria

### 6.1 Launch Criteria

The system is considered ready for launch when all of the following are met:

| # | Criterion | Verification |
|---|-----------|-------------|
| LC-1 | All "Must Have" functional requirements (Section 3.1) are implemented and tested | QA sign-off against each requirement ID |
| LC-2 | The four-stage assessment calculation produces correct results for a set of agreed test cases | Side-by-side comparison with the existing spreadsheet model using 10+ real (anonymised) historical cases |
| LC-3 | Payable fees calculation matches the documented formula (scholarship %, bursary £, VAT) | Validated against `image001.png` reference example |
| LC-4 | Data migration from Grant Tracker is complete for all active bursary accounts | 100% of active accounts migrated; spot-check 20% for data accuracy |
| LC-5 | GDPR compliance review passed | Independent review confirms: encryption at rest/transit, retention policies, deletion capability, no school access to system |
| LC-6 | Applicant portal tested on mobile devices | Functional on latest Chrome/Safari (iOS and Android) at common viewport sizes |
| LC-7 | Assessor has completed end-to-end testing with real workflow scenarios | Assessor confirms: can process a new application, re-assessment, sibling link, internal bursary request, recommendation export, and data deletion |

### 6.2 Key Performance Indicators (Post-Launch)

| KPI | Metric | Target | Measurement Method |
|-----|--------|--------|-------------------|
| **Application completion rate** | % of invited applicants who submit a complete application | > 85% (baseline: measure current rate for comparison) | System analytics: invitations sent vs. applications submitted per round |
| **Incomplete submission rate** | % of submitted applications that are initially paused for missing documents | < 30% (improvement over current) | Count of applications entering "Paused" status vs. total submitted |
| **Assessment turnaround time** | Average days from submission to completed assessment | < 10 working days | Timestamp difference: submission date → assessment completion date |
| **Assessor time per assessment** | Average time the assessor spends in the assessment form per application | < 45 minutes (target; baseline to be established) | Self-reported or session-duration tracking |
| **Re-assessment pre-population accuracy** | % of pre-populated fields that do not require correction | > 95% | Assessor feedback / field-edit tracking |
| **System availability** | Uptime during assessment round periods (March-June) | 99.5% | Uptime monitoring |
| **Applicant satisfaction** | Applicant rating of the portal experience | > 4.0 / 5.0 | Optional post-submission survey (if implemented) |

### 6.3 Definition of Done (Per Feature)

A feature is considered done when:

1. Code is written, reviewed, and merged
2. Unit and integration tests pass
3. The feature works end-to-end in the staging environment
4. Acceptance criteria (from user stories) are verified
5. No critical or high-severity bugs remain open
6. The feature is documented (user-facing help text, admin guide if applicable)

---

## 7. Assumptions, Constraints & Dependencies

### 7.1 Assumptions

| # | Assumption | Risk if Wrong | Mitigation |
|---|-----------|---------------|-----------|
| A-1 | **Single assessor workflow.** The system is primarily operated by 1-2 assessors. There is no need for multi-level approval workflows, committee voting, or per-school access partitioning. | If the Foundation hires more staff or changes process, role-based access would need expansion. | Build a role-based access system (even if only "Assessor" and "Viewer" roles are used initially) so new roles can be added later. |
| A-2 | **Low concurrency.** Peak usage is ~50 concurrent applicant sessions and ~5 admin sessions. The system does not need to scale for thousands of users. | Unlikely to be wrong given 2 schools and ~200 applications per year. | Standard cloud hosting with auto-scaling capability provides headroom. |
| A-3 | **Qualitative checklist tabs are notes/context panels.** The six non-calculation checklist tabs (Living Conditions, Debt Situation, Other Fees, Staff Situation, Financial Profile Impact, Bursary Assessment Details) contain unstructured or lightly-structured fields that do not feed into the calculation engine. | If any tab contains structured data that feeds into the calculation, the data model would need revision. | Design a flexible schema for checklist tabs (JSON fields or configurable form builder) that allows adding structured fields later without migration. |
| A-4 | **Years remaining auto-decrements.** The "schooling years remaining" field auto-calculates from entry year and current assessment year, with the assessor able to override for non-standard cases. | If the assessor expects fully manual control, the auto-calculation would be a nuisance. | Auto-calculated value displayed as the default in an editable field. The assessor can override without friction. |
| A-5 | **Email + password authentication is sufficient for applicants.** No SSO or social login is required. | Some applicants may expect social login. | The invitation-link model means applicants don't need to remember the portal URL or create an account proactively. Password reset via email covers recovery. SSO can be added later. |
| A-6 | **The school fees in the reference tables are pre-VAT amounts.** VAT is applied at the payable fees stage, not in the school fees table. | If the stored fees are VAT-inclusive, the payable fees formula would double-count VAT. | Confirm with the assessor. Label the field clearly as "Annual Fees (ex-VAT)" in the reference table UI. |
| A-7 | **Existing email infrastructure.** A transactional email service (SendGrid, AWS SES, Postmark, or equivalent) will be available for sending invitation, confirmation, and notification emails. | If no email service is available, email delivery would be unreliable. | Email service setup is a standard infrastructure task. Budget and configure during environment setup. |

### 7.2 Constraints

| # | Constraint | Impact |
|---|-----------|--------|
| C-1 | **Hard deadline: 31 December 2026.** Grant Tracker is sunset on this date. The replacement system must be live and processing applications before this deadline. Realistically, it should be ready before the 2026/27 assessment round opens (typically March 2026). | Limits scope — only "Must Have" features are guaranteed for launch. "Should Have" and "Phase 2" features are delivered post-launch. Requires aggressive but realistic project planning. |
| C-2 | **GDPR and UK data protection law.** All personal data must be stored in the UK, encrypted at rest and in transit, and subject to retention/deletion policies. The school must never have system access. | Constrains hosting provider (UK data centre), shapes the data model (retention flags, deletion capability), and prohibits a school-facing portal. |
| C-3 | **The assessment model must be preserved.** The four-stage calculation, payable fees formula, and reference tables are well-established and trusted by the Foundation. The new system must produce the same results as the existing spreadsheet model. | Limits innovation in the calculation engine — it must replicate, not reinvent. Configurable reference tables allow values to change, but the formula logic is fixed. |
| C-4 | **Assessor judgment is paramount.** Many rules (benefit inclusion/exclusion, benchmark enforcement, exceptional adjustments) are assessor-driven, not system-enforced. The system should inform and calculate, not restrict or automate decisions. | The system must avoid hard-coded business rules that prevent the assessor from overriding results. Manual adjustment fields and editable auto-populated values are essential. |
| C-5 | **External school communication only.** Recommendations are sent to schools as spreadsheet exports outside the system. No API integration with school systems is required or permitted. | Simplifies the system (no external integrations) but means the export format must be comprehensive and clearly structured. |
| C-6 | **Budget and team size.** The Foundation is a charity. The development budget is finite and the team is small. The system must be maintainable by a small team and cost-effective to host. | Favours proven, well-supported technology over cutting-edge stacks. Favours managed services over self-hosted infrastructure. Avoids over-engineering. |

### 7.3 Dependencies

| # | Dependency | Owner | Status | Risk |
|---|-----------|-------|--------|------|
| D-1 | **Data migration from Symplectic Grant Tracker.** Active bursary accounts, historical assessment data, uploaded documents, benchmark payable fees, and sibling linkages must be extracted from Grant Tracker and imported into the new system. | Foundation + Development Team | **Not yet started — needs investigation** | **High.** Grant Tracker's export capabilities are unknown (limited REST API v7.0, no public documentation). If data cannot be exported programmatically, manual migration may be required. This is the single highest-risk dependency. |
| D-2 | **Grant Tracker access for migration.** The existing system must remain accessible during the migration window to extract data. | Digital Science (Grant Tracker vendor) | Active (system available until 31 Dec 2026) | Medium. The sunset date is fixed. Migration must complete before this date with margin for verification. |
| D-3 | **Cloud hosting environment.** A UK-based cloud hosting environment (AWS, Azure, or GCP) must be provisioned for the application, database, and document storage. | Development Team / Foundation IT | Not yet started | Low. Standard procurement. |
| D-4 | **Transactional email service.** An email delivery service must be configured for sending invitation, notification, and reminder emails. | Development Team | Not yet started | Low. Standard service (SendGrid, AWS SES, or equivalent). |
| D-5 | **Domain and SSL certificate.** A domain name for the applicant portal and admin console, with a valid SSL certificate. | Foundation IT | Not yet started | Low. |
| D-6 | **Assessment model test cases.** A set of real (anonymised) historical assessment cases with known correct outcomes, to validate that the new calculation engine produces identical results to the existing spreadsheet model. | Foundation Assessor | Not yet started | Medium. The assessor needs to prepare these. Without them, calculation accuracy cannot be verified. |
| D-7 | **Stakeholder availability for UAT.** The Foundation assessor must be available for user acceptance testing before launch. | Foundation Assessor | Assumed available | Low. The assessor is the primary stakeholder and is engaged in the project. |

---

## Appendices

### Appendix A: Reference Documents

| Document | Location | Description |
|----------|----------|-------------|
| README.md | `../README.md` | Master requirements document: system overview, two-layer data model, lifecycle, calculation model, reference tables, domain concepts, scope |
| APPLICATION.md | `../APPLICATION.md` | Complete field-by-field mapping of every input in the applicant portal |
| ADMIN.md | `../ADMIN.md` | Documentation of the current admin console structure and workflows |
| OPEN_QUESTIONS.md | `../OPEN_QUESTIONS.md` | 30 requirements questions with stakeholder answers |
| Assessment Model Spreadsheet | `./Assessment Model Notional Calculations - BW.xlsx` | Source spreadsheet for the four-stage calculation model and reference tables |
| Payable Fees Logic | `../payable_fees_logic.png` | Visual reference for the payable fees formula |
| Progress Report Schedule | `../image002.png` | Year-by-year re-assessment tracking in the current system |
| Reason Codes | `../image003.png` | Year-on-year bursary change reason codes |

### Appendix B: Glossary

Key terms are defined in the [Key Domain Concepts](../README.md#key-domain-concepts) section of README.md. The most critical terms for this PRD:

| Term | Definition |
|------|-----------|
| **Payable Fees** | The amount the family actually pays after scholarship and bursary deductions, plus VAT |
| **HNDI after NS** | Household Net Disposable Income after Necessary Spending — the key calculation output |
| **Two-Layer Data Model** | The separation between applicant-entered data (document collection) and assessor-entered data (calculation input) |
| **Benchmark** | The payable fees from the first year's assessment, acting as a floor for subsequent years |
| **Reason Codes** | Configurable codes explaining year-on-year changes in payable fees |
| **Lead Applicant** | The single parent/guardian with portal access, answering on behalf of the household |

### Appendix C: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-22 | — | Initial draft |
| 1.1 | 2026-02-22 | — | Added data minimisation & name masking requirements (3.1.14 NM-01–NM-05), user stories US-B13/US-B14, non-functional requirement NF-16, updated wireframe descriptions for Application Queue and Assessment Form |
| 1.2 | 2026-02-22 | — | Added split-screen document viewer requirement (AE-17), user story US-B15, updated Assessment Form wireframe description |
