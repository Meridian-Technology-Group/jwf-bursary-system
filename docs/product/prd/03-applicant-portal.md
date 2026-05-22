## 3. Features & Functionality

### 3.1 Functional Requirements

Requirements are organised by module. Priority uses MoSCoW notation: **M** = Must Have, **S** = Should Have, **C** = Could Have (Phase 2).

#### 3.1.1 Applicant Portal

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| AP-01 | **Invitation-only registration** | M | Applicants cannot self-register. An admin sends an invitation (email with unique registration link). The applicant clicks the link, creates a password, and gains access to their application. |
| AP-02 | **Single-user access model** | M | Only the lead applicant (the invited parent/guardian) has portal access. They complete all sections on behalf of both parents. No second-parent login. |
| AP-03 | **Multi-step application form** | M | The form is divided into logical sections (child details, family ID, parent details, household composition, financial commitments, income, assets & liabilities, additional circumstances, declaration). The applicant can navigate between sections freely. See [APPLICATION.md](../../archive/specs/applicant-form.md) for the full field-by-field specification. |
| AP-04 | **Conditional logic** | M | Sections and fields show/hide based on prior answers. Key conditions: sole-parent status hides Parent 2 sections; "Yes" to property ownership reveals mortgage/value fields; employment status reveals corresponding evidence upload fields. Full conditional map in [APPLICATION.md](../../archive/specs/applicant-form.md). |
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
