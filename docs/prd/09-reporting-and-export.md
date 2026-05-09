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
