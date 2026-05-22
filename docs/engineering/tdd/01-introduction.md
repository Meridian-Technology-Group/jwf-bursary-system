## 1. Introduction

### 1.1 Project Overview

The John Whitgift Foundation requires a purpose-built bursary assessment platform to replace Symplectic Grant Tracker, which is being sunset on 31 December 2026. The replacement system manages the full lifecycle of means-tested bursary applications for Trinity School and Whitgift School in Croydon, South London.

The system comprises four functional areas:

1. **Applicant Portal** — an invitation-only, single-user web application where lead parents/guardians submit bursary applications with supporting financial documents.
2. **Admin Console** — an internal tool for Foundation assessors to manage assessment rounds, review submissions, perform standardised financial assessments, and produce recommendations.
3. **Assessment Engine** — a four-stage financial calculation model (income, net assets, living costs, bursary impact) that operates exclusively on assessor-entered data, producing bursary awards and payable fees.
4. **Annual Re-assessment Cycle** — workflow for yearly re-evaluation of active bursaries, with pre-population, year-on-year comparison, reason codes, and benchmark tracking.

The system handles approximately 100–200 applications per annual round, with 1–3 concurrent assessor users and up to 50 concurrent applicant sessions at peak.

### 1.2 Target Audience for This Document

| Audience | Interest |
|----------|----------|
| **Development team** | Architecture decisions, data model, component design, implementation approach |
| **Foundation bursary team** | Confirmation that the technical design supports all PRD requirements |
| **Infrastructure / DevOps** | Deployment strategy, hosting, security architecture |
| **Future maintainers** | Understanding of system structure, conventions, and decision rationale |

### 1.3 Reference Documents

| Document | Location | Description |
|----------|----------|-------------|
| Product Requirements Document | [PRD.md](../../product/prd/_index.md) | Full functional and non-functional requirements |
| Master Requirements / Domain Model | [README.md](../../README.md) | System overview, two-layer data model, calculation model, reference tables, domain concepts |
| Application Form Specification | [APPLICATION.md](../../archive/specs/applicant-form.md) | Field-by-field mapping of every applicant portal input (archived build spec) |
| Admin Console (legacy, discovery) | [ADMIN.md](../../archive/discovery/admin-console.md) | Legacy Grant Tracker admin console structure — as-is discovery baseline, not the system we built |
| Open Questions & Answers | [OPEN_QUESTIONS.md](../../archive/planning/open-questions.md) | 30 requirements questions with stakeholder answers (archived) |
| Assessment Model Spreadsheet | [Assessment Model Notional Calculations - BW.xlsx](../../product/assessment-model.xlsx) | Source spreadsheet for calculation model and reference tables |

---
