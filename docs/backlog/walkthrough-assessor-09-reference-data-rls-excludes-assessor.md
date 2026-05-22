---
title: Assessment reference data (family-type/school-fees/council-tax) RLS excludes ASSESSOR role
status: open
severity: high
area: rls
opened: 2026-05-20
opened_by: walkthrough-verification-pass
related:
  - docs/walkthroughs/assessors/09-set-up-assessment-workspace.md
  - docs/walkthroughs/assessors/20-select-reason-codes.md
  - src/app/(admin)/applications/[id]/assessment/page.tsx
  - src/lib/db/queries/reference-tables.ts
  - src/components/admin/assessment-form.tsx (Family Type Category select)
  - src/components/admin/recommendation-form.tsx (Reason Codes picker)
---

## Context

Found while verifying `assessors/09-set-up-assessment-workspace` as the
ASSESSOR test user against the running app (localhost:3100,
supabase-nonprod). The assessment workspace's **Family Type Category**
select (Section A) renders with **zero options** for an ASSESSOR.

Root cause is RLS, confirmed via `pg_policies`. The SELECT policies on
the three assessment reference tables are gated to admin/viewer only:

- `family_type_configs_select` → `is_admin_or_viewer()`
- `school_fees_select` → `is_admin_or_viewer()`
- `council_tax_defaults_select` → `is_admin_or_viewer()`
- `reason_codes_select` → `is_admin_or_viewer()`

The reason-codes case surfaces in `assessors/20-select-reason-codes`:
the Reason Codes picker on the Recommendation tab shows **"No reason
codes available."** for an ASSESSOR even though 35 active codes exist in
`reason_codes`. The guide describes four selectable buckets (Income,
Property & Assets, Family Circumstances, Risk Flags) — none render.

The assessment page (`assessment/page.tsx`) loads `configs` inside
`withUserContext(user.id, ASSESSOR, …)`, so `getFamilyTypeConfigs` /
school-fee / council-tax lookups all return `[]` / null for an
ASSESSOR. `AssessmentForm` then maps over an empty `familyTypeConfigs`
prop → empty dropdown.

(The council-tax £2,480 and VAT 20% the assessor *does* see come from
the `assessments` row defaults seeded at begin-assessment, not from the
reference tables — which is why those appear populated and masked the
problem until the family-type dropdown was opened.)

## Why it matters

The ASSESSOR is the primary user of the assessment workspace, yet
cannot:
- Pick a **Family Type Category**, which drives notional rent, utility
  costs, and food costs feeding Stages 2 and 3 of the calculation. With
  no category selected these costs are 0, so Stage 2 == Stage 3 and the
  required-bursary maths is wrong.
- Have school annual fees / council-tax pre-populated from the
  reference tables on a fresh assessment (they fall back to assessment
  defaults only).

This is a functional blocker for the documented assessment flow, not
cosmetic. An assessor working a real application would silently produce
an under-specified calculation.

## Proposed approach

fix code (RLS). Broaden the SELECT policy on the three reference tables
to include the ASSESSOR role — there is presumably an
`is_admin_assessor_or_viewer()` helper (the application/assessment
policies already grant assessor read on assigned rows). Add a new
migration:

```sql
ALTER POLICY family_type_configs_select ON family_type_configs
  USING (is_admin_assessor_or_viewer());
-- same for school_fees_select, council_tax_defaults_select,
-- reason_codes_select
```

Reference data is non-sensitive (fee schedules, council-tax bands,
family-type cost tables) so widening read to assessors carries no
privacy risk. Alternatively, fetch configs under a system/service
context on the assessment page, but the RLS widening is cleaner and
matches intent.

## Out of scope

The CSP/iframe document-preview issue (separate backlog entry) and the
guide-09 copy claim that begin-assessment seeds "the school's annual
fees" and "family-type costs for category 1" (it seeds council tax + VAT
but leaves annual fees and family-type category blank — a smaller doc/seed
drift to reconcile after the RLS fix).
