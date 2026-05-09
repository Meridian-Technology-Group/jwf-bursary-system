# Technical Design Document
## John Whitgift Foundation — Bursary Assessment System

| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| **Author**        | John Whitgift Foundation / Development Team |
| **Version**       | 1.0                                         |
| **Date**          | 2026-02-22                                  |
| **Status**        | Complete                                    |
| **PRD Reference** | [[prd/_index\|PRD]] v1.2                    |

---

## How this document is organised

The document is split into one section per file under `docs/tdd/`. This file (`_index.md`) is the index. To read top to bottom, follow the section list in order.

If this TDD and the PRD disagree, the PRD wins until the TDD is updated.

## Sections

- [ ] [01 Introduction](tdd/01-introduction.md)
- [ ] [02 Design Goals & Constraints](tdd/02-design-goals-constraints.md)
- [ ] [03 Architectural Overview](tdd/03-architectural-overview.md)
- [ ] [04 Functional Requirements Mapping](tdd/04-functional-requirements.md)
- [ ] [05 Non-Functional Requirements Mapping](tdd/05-non-functional-requirements.md)
- [ ] [06 Data Design](tdd/06-data-design.md)
- [ ] [07 System Components & Modules](tdd/07-system-components.md)
- [ ] [08 Implementation Strategy](tdd/08-implementation-strategy.md)
- [ ] [09 Deployment & Release Strategy](tdd/09-deployment-release.md)
- [ ] [10 Revision History](tdd/10-revision-history.md)

## Reading paths

- **An engineer joining the team.** Read 01, 02, 03 in order. Then skim 06 (data model) and 07 (system components) to understand the architecture. Use 08 to find the build order.
- **The Foundation bursary team.** Read 01, 02, and 08 (development phases). The design goals in 02 confirm all PRD requirements are addressed.
- **Infrastructure / DevOps.** Read 03 (system architecture), 09 (deployment), and the security subsections of 03 (§3.4).
- **A reviewer auditing compliance posture.** Read 03 §3.4 (security architecture), 04 §4.13–4.14 (GDPR and data minimisation), 06 §6.5 (retention and deletion), 07 §7.7 (audit logging).
- **Future maintainers.** Read 01–03 for context, then the relevant component module in 07.

## Cross-references

- `docs/prd/_index.md` — product requirements, the source of truth for behaviour.
- `docs/planning/APPLICATION.md` — field-by-field application form specification.
- `docs/planning/ADMIN.md` — admin console structure and workflows.
- `docs/planning/OPEN_QUESTIONS.md` — 30 requirements questions with stakeholder answers.
