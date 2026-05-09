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
