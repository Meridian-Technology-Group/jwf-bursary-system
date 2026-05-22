---
title: Re-verify applicant-form.md field-by-field against the implemented portal
status: open
severity: medium
area: docs, specs, drift
opened: 2026-05-22
opened_by: Brian Wagner (via Claude, during user-guide authoring)
related:
  - docs/product/specs/applicant-form.md (the stale spec; carries a warning banner)
  - src/components/portal/sections/* (the implemented section forms)
  - prisma/schema.prisma (ApplicationSectionType enum — section source of truth)
  - docs/guides/applicant-guide.md + docs/guides/walkthroughs/applicants/ (reflect reality)
---

## Context

`docs/product/specs/applicant-form.md` is described everywhere as the
"complete field-by-field mapping" of the applicant portal, but it is a
**pre-build design artifact** and the implemented form has since
diverged from it. Two divergences are confirmed against code (code is
the source of truth):

1. **Section structure.** The live form has **10 sections with Family
   Identification as its own section**, per the `ApplicationSectionType`
   enum (`CHILD_DETAILS, FAMILY_ID, PARENT_DETAILS, DEPENDENT_CHILDREN,
   DEPENDENT_ELDERLY, OTHER_INFO, PARENTS_INCOME, ASSETS_LIABILITIES,
   ADDITIONAL_INFO, DECLARATION`). The spec folds Family ID into
   Section 1 and numbers the rest differently (and lists "Validation
   Summary" as a section, which is the review page, not a data section).
2. **Employment status.** The live form uses a **7-option** set that
   mirrors the assessor enum — `PAYE`, `BENEFITS`,
   `SELF_EMPLOYED_DIRECTOR`, `SELF_EMPLOYED_SOLE`, `OLD_AGE_PENSION`,
   `PAST_PENSION`, `UNEMPLOYED` (see
   `src/components/portal/sections/parent-details-form.tsx`, "mirror the
   assessor-side EmploymentStatus enum … See B11"). The spec lists a
   superseded set (Employed / Self-employed CIS / Self-employed and
   employed / Retired).

Because two independent things diverged, we **cannot assume the rest of
the field map is current** — the whole document needs a pass.

## Why it matters

- The spec is referenced as authoritative from the PRD (APPLICATION.md),
  the TDD, and the implementation plan. Anyone using it for QA, the
  Feature Verification Checklist, or screenshot capture will be misled.
- The applicant **guide** and **walkthroughs** were written from the
  live UI and are correct, so there is now a public, accurate source —
  which makes the stale spec the odd one out and a trap.

## Proposed approach

1. Walk every section of `applicant-form.md` against the implemented
   `src/components/portal/sections/*` and the section JSONB shapes in
   `src/types/application.ts`. Fix field names, options, conditional
   logic, and the section numbering to match.
2. Re-derive the upload slots per section from the actual form.
3. Once reconciled, remove the warning banner added at the top of the
   spec (2026-05-22).
4. Consider generating the field list from the TS types to prevent
   future drift, or add a note that the guide/walkthroughs are the
   user-facing source of truth and the spec is the build-time map.

## Out of scope

- Changing the form itself — this is a documentation reconciliation,
  not a behaviour change. If the audit surfaces a *form* bug, open a
  separate item.
