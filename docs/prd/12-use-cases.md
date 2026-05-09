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
