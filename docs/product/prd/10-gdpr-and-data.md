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
