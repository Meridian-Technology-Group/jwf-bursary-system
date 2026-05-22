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
