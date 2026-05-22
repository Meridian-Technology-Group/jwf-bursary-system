# Product Requirements Document
## John Whitgift Foundation — Bursary Assessment System

| Field | Value |
|-------|-------|
| **Author** | Meridian Technology Group (Brian Wagner) |
| **Version** | 1.2 |
| **Date** | 2026-02-22 |
| **Status** | Draft |

---

## How this document is organised

The document is split into one section per file under `docs/product/prd/`. This file (`_index.md`) is the index. To read top to bottom, follow the section list in order.

The TDD in `tdd/_index.md` says how the system is built. If this PRD and the TDD disagree, the PRD wins until the TDD is updated.

## Sections

### Context

- [ ] [01 Introduction & Purpose](01-introduction.md)
- [ ] [02 Target Audience & User Personas](02-personas.md)

### Functional Requirements (§3.1)

- [ ] [03 Applicant Portal (AP-01–AP-14)](03-applicant-portal.md)
- [ ] [04 Admin Console — Round & Application Management (AC-01–AC-09)](04-admin-round-management.md)
- [ ] [05 Admin Console — Assessment Engine (AE-01–AE-17)](05-assessment-engine.md)
- [ ] [06 Sibling Linking (SL-01–SL-05)](06-sibling-linking.md)
- [ ] [07 Assessment Output, Re-assessment & Internal Bursary (AO, RA, IB)](07-assessment-output.md)
- [ ] [08 Document Management, User Management & Email (DM, UM, EN)](08-data-operations.md)
- [ ] [09 Data Export & Reporting (DE-01–DE-04, RP-01–RP-09)](09-reporting-and-export.md)
- [ ] [10 GDPR, Data Governance & Name Masking (GD, NM)](10-gdpr-and-data.md)
- [ ] [11 Non-Functional Requirements (NF-01–NF-16)](11-non-functional.md)

### Use Cases & Design

- [ ] [12 Use Cases & User Stories (UC-01–UC-05, US-A, US-B, US-C)](12-use-cases.md)
- [ ] [13 Wireframes & Mockups](13-wireframes.md)

### Planning

- [ ] [14 Metrics & Success Criteria](14-metrics.md)
- [ ] [15 Assumptions, Constraints & Dependencies](15-assumptions.md)
- [ ] [99 Appendices](99-appendix.md)

## Reading paths

- **An engineer starting work on a feature.** Read 01, 02. Then jump to the relevant functional requirement section (03–10). Use the TDD `tdd/_index.md` for how it's built.
- **The Foundation bursary team.** Read 01 and 02. Skim 03–05 to confirm the applicant portal and assessment engine requirements are captured correctly.
- **A reviewer auditing compliance posture.** Read 10 (GDPR, data governance, name masking) and 11 (non-functional NF-06 through NF-16).
- **A new stakeholder.** Read 01 and 14 (success criteria). Use 15 for constraints and dependencies.

## Cross-references

- `docs/engineering/tdd/_index.md` — engineering blueprint; every PRD requirement is traced to an implementing component.
- `docs/product/specs/applicant-form.md` — field-by-field applicant portal form specification.
- `docs/product/specs/admin-console.md` — current admin console structure and workflows (baseline for the replacement).
- `docs/product/open-questions.md` — 30 requirements questions with stakeholder answers.
