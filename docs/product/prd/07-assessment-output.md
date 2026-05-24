#### 3.1.5 Assessment Output & Recommendations

| ID | Requirement | Priority | Detail |
|----|-------------|----------|--------|
| AO-01 | **Structured recommendation** | M | For each completed assessment, the system generates a recommendation containing: family synopsis (single/married, number of children, employment roles), accommodation status, income category, property category (1-12, not precise figures), bursary award recommendation (nominal £), payable fees recommendation (yearly and monthly), and red flags (dishonesty, credit risk). **As shipped (v1.0.0):** the family synopsis is a free-text field the assessor **writes manually** (it opens blank on a new assessment); it is **not** auto-populated or auto-suggested from assessment data. Auto-suggestion of the synopsis from relationship status, dependent counts, and employment is a deferred enhancement tracked in `docs/backlog/family-synopsis-auto-population.md`. The accommodation status, income category, and property category pre-fill from the assessment/calculation where applicable. |
| AO-02 | **Recommendation stored per account per year** | M | Each recommendation is stored against the bursary account for the specific assessment year, building a longitudinal history. The assessor can view previous years' recommendations when performing re-assessments. |
| AO-03 | **Year-on-year reason codes** | M | For re-assessments, the assessor selects one or more reason codes (from a configurable list of ~35 codes) explaining why payable fees have changed compared to the previous year. Codes are multi-select checkboxes. The full list of current codes is documented in [README.md](../../../README.md#year-on-year-change-reason-codes). |
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
