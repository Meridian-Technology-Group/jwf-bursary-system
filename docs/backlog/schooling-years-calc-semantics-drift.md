---
title: schooling-years calc drift — two functions, two semantics, one column
status: open
severity: high
area: assessment, calculator
opened: 2026-05-19
opened_by: Claude (via Brian Wagner)
related:
  - src/lib/assessment/schooling-years.ts
  - src/components/admin/assessment-form.tsx
  - prisma/schema.prisma (Application.entryYear, BursaryAccount.entryYear)
  - docs/PRODUCTION_READINESS.md (B11)
---

## Context

Found while implementing B11. There are **two** functions that derive
"years of schooling remaining" from `Application.entryYear`, and they
expect contradictory semantics for the same Int column:

1. `src/lib/assessment/schooling-years.ts:calculateSchoolingYearsRemaining`
   treats `entryYear` as a **year-group number** (6, 7, 9, 12). The
   lookup table `TOTAL_YEARS_BY_ENTRY` only contains keys 6/7/9/12 and
   throws for anything else. The JSDoc says "Year 7 entry → 6 years
   total (Years 7–12)".

2. `src/components/admin/assessment-form.tsx:calcSchoolingYears` treats
   `entryYear` as a **calendar year** (2026, 2027…). It computes
   `yearInSchool = academicYear - entryYear + 1` and `remaining = 13 -
   yearInSchool`, clamped to [0, 13].

Meanwhile, the admin invitation flow
(`src/app/(admin)/queue/actions.ts:44` and
`src/components/admin/internal-request-dialog.tsx:84`) accepts and
stores calendar years in the range 2020–2040.

Net result on staging today:
- The schooling-years lib is **not called from any non-test code path**
  (grep across `src/` returns zero non-test imports).
- The assessor-side Tab 2 / Stage 4 calculation uses `calcSchoolingYears`
  with calendar-year arithmetic, which is internally consistent with
  what the invitation flow writes, but contradicts the JSDoc semantics
  in `schooling-years.ts` and the §4 spec wording (Y6/Y7/Y9/Y12/Other).

B11 added a year-group picker (`entryYearGroup`) to the portal but
deliberately did NOT touch `Application.entryYear` to avoid breaking the
assessor calc. So we now have a third state: portal stores a year-group
code in JSONB, admin writes a calendar year to the Int column, the
calculator does calendar-year arithmetic on the Int column, and the
schooling-years.ts lib (which encodes the actual spec semantics) sits
unused.

## Why it matters

Stage 4 of the bursary calculation gates the "years of fees remaining"
input, which feeds the overall award size. Right now an assessor enters
a calendar year (e.g. `2026`), the formula does
`13 - (2026 - 2026 + 1) = 12` — saying the child has 12 years of
schooling left, regardless of which year-group they entered. That's
plainly wrong; the assessor must be silently editing the value by hand
on every assessment, or relying on the `entryYearDisplay` UI to mask it.

Untangling this is small in code, but needs a product decision: which
of the three current states is the source of truth?

## Proposed approach

Pick one model and migrate the other two:

1. **Year-group is source of truth (recommended).** Matches the spec
   and the schooling-years.ts lib.
   - Add `entryYearGroup` as a first-class column on `Application`
     (and possibly `BursaryAccount`) — or read it from the JSONB the
     portal already writes after B11.
   - Repoint `calcSchoolingYears` in `assessment-form.tsx` at
     `getTotalSchoolingYears(entryYearGroup) - yearsSinceFirstAssessment`,
     killing the calendar-year branch.
   - Migrate the admin invitation dialog to ask for year-group, not
     calendar year. Backfill existing `Application.entryYear` rows
     (none yet on prod — easy now, hard later).

2. **Calendar year is source of truth.** Less work but contradicts the
   spec. Would require rewriting the schooling-years lib (currently
   correct per the spec) and ditching `entryYearGroup` from the portal
   (which §4 explicitly mandates).

Option 1 is the right call once we have product alignment. Sequence
this AFTER all live applications are submitted under the current bad
calc — there are none today, so there's a window to fix it cleanly.

## Out of scope

The §32 income-table reshape that B11 also flagged is a separate piece
of work — different surface, different schema.
