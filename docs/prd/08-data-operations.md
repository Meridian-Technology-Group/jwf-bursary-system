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
