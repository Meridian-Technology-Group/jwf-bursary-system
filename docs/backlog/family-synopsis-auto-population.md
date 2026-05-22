---
title: Family synopsis does not auto-populate — docs imply it does
status: open
severity: low
area: assessment, recommendation, docs
opened: 2026-05-22
opened_by: Brian Wagner (via Claude, during user-guide authoring)
related:
  - src/components/admin/recommendation-form.tsx (familySynopsis state init)
  - docs/guides/walkthroughs/assessors/17-build-family-synopsis.md
  - docs/guides/walkthroughs/assessors/README.md (claims "auto-populated suggestions")
  - docs/product/prd/07-assessment-output.md (AO-01 family synopsis)
---

## Context

The assessor walkthrough index (and the README intent) describe the
recommendation **family synopsis** as "auto-populated suggestions from
assessment data (single/married, number of children, employment),
editable." In reality the field starts **empty** — it is initialised
from any existing recommendation, otherwise `""`:

```ts
// src/components/admin/recommendation-form.tsx
const [familySynopsis, setFamilySynopsis] = React.useState(
  recommendation?.familySynopsis ?? ""
);
```

Walkthrough `17-build-family-synopsis.md` correctly documents it as
manual entry; the index summary and the README over-promise. The new
admin/assessor guide follows walkthrough 17 (manual), so the guide is
correct — the inconsistency is in the index/README/PRD framing.

## Why it matters

Low. The assessor can write the synopsis by hand from the data already
on screen; nothing is broken. But the doc mismatch (a) sets a false
expectation for new staff, and (b) hides a small, genuinely useful
quality-of-life feature that the spec actually asked for.

## Proposed approach

Pick one:

1. **Build the auto-suggestion** (honour AO-01 / the index): pre-fill
   `familySynopsis` from assessment data on first open — e.g.
   "Married couple, two dependent children; Parent 1 PAYE, Parent 2
   self-employed" — derived from the earners' employment statuses,
   relationship status, and dependent counts. Keep it fully editable.
   This is the higher-value option and matches the documented intent.
2. **Or correct the docs**: update the assessor README summary (and
   PRD AO-01 if needed) to say the synopsis is manually written, so the
   docs match the build.

Recommend (1) — it's a small, self-contained enhancement and the spec
already calls for it. Default to (2) only if there's no appetite to
build it before go-live.

## Out of scope

- Auto-populating the other recommendation fields (accommodation,
  categories) — they already pre-fill from the assessment/calculation
  where applicable; this item is specifically the free-text synopsis.
