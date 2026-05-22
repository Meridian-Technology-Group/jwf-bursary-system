---
title: Property Category report reads Assessment.propertyCategory but the value lives on Recommendation
status: open
severity: medium
area: schema
opened: 2026-05-20
opened_by: walkthrough-verification-pass
related:
  - docs/walkthroughs/assessors/34-property-category-distribution.md
  - docs/walkthroughs/assessors/15-property-category-and-flags.md
  - src/lib/db/queries/reports.ts (getPropertyCategoryDistribution)
  - src/components/admin/recommendation-form.tsx
---

## Context

Found verifying `assessors/34-property-category-distribution`. After
completing an assessment and saving a recommendation with **Property
Category = 9** for `WS-202627-0001`, the Property Categories card on
`/reports` still shows the empty state **"No data for this round yet"**.

Guide 34's verification says: "Sum of bar counts equals the count of
saved recommendations with a non-null `propertyCategory`." We have
exactly one such recommendation, so a bar of count 1 was expected.

Root cause: `getPropertyCategoryDistribution` (reports.ts ~L437) queries
the **Assessment** table:

```ts
where: { propertyCategory: { not: null }, ... },
select: { propertyCategory: true },
```

But property category is a **Recommendation-tab field**
(`assessors/15` states this explicitly), persisted to
`recommendations.property_category` by `saveRecommendationAction`. The
`assessments.property_category` column stays null. Verified in DB:
`recommendations.property_category = 9`, `assessments.property_category
= NULL`.

So the report's data source and the field's actual home are different
tables; the report can never count assessor-entered categories.

## Why it matters

The Property Category distribution report is permanently empty in normal
use — it will never reflect the categories assessors actually record.
The £750K-threshold scrutiny the report is meant to support (categories
9–12) is invisible. Medium severity: it's a reporting/visibility bug, not
a data-loss or workflow blocker, but the report is effectively dead.

## Proposed approach

fix code. Point `getPropertyCategoryDistribution` at the Recommendation
table (join Recommendation → Assessment → round, or filter
recommendations by round) and read `recommendation.propertyCategory`.
Mirror however the other report queries scope to a round.

Alternatively, if `Assessment.propertyCategory` is meant to be the
canonical column, have `saveRecommendationAction` also write it — but
reading from Recommendation is the smaller, more direct fix and matches
where the UI writes.

## Out of scope

The income/award reports read the correct sources and render fine; only
the property-category source is mismatched.
