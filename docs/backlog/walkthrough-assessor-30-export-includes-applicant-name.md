---
title: Recommendation export includes applicant First/Last Name, contradicting guide's GDPR claim
status: open
severity: medium
area: docs
opened: 2026-05-20
opened_by: walkthrough-verification-pass
related:
  - docs/walkthroughs/assessors/30-export-recommendation-list.md
  - src/app/api/exports/recommendations/route.ts
---

## Context

Found verifying `assessors/30-export-recommendation-list` against the
running app. Calling
`GET /api/exports/recommendations?roundId=…&format=csv` as the ASSESSOR
returns a CSV whose header is:

```
Reference,First Name,Last Name,School,Family Synopsis,Accommodation,
Income Category,Property Category,Bursary Award (%),Yearly Payable Fees,
Monthly Payable Fees,Reason Codes,Flags,Outcome
```

and the data row contains the child's actual name
(`WS-202627-0001,Child,Applicant,WHITGIFT,…`).

The guide's Notes section states the opposite:

> "For GDPR-sensitive distribution, the export does **not** include the
> applicant's full name or email."

So the doc and the implementation disagree about whether names are in
the export.

A secondary, smaller drift: the guide documents the filename as
`recommendations-<academicYear>.<format>`, but the actual
Content-Disposition filename is `recommendations-2026-27-2026-05-20.csv`
(academic year *plus* an export date).

## Why it matters

The guide explicitly reassures the assessor that the spreadsheet is safe
to distribute because it omits names. If a team relies on that claim and
emails the export externally, they would be leaking applicant names —
a GDPR exposure. Either the code should drop the name columns, or the
guide must be corrected so staff know to treat the export as
name-bearing PII.

## Proposed approach

Decide intent, then make doc and code agree:

- **If names should not be exported** (matches the guide's safety
  promise): fix code — remove `First Name` / `Last Name` columns from
  `route.ts` (and any XLSX equivalent). Reference is the non-PII join
  key.
- **If names are intentionally exported** (assessors need them for the
  school hand-off): fix doc — rewrite the GDPR note in guide 30 to say
  the export *does* include applicant names and must be handled as PII,
  and update the Columns list (currently omits First/Last Name).

Also reconcile the filename pattern in the guide with the actual
`recommendations-<academicYear>-<YYYY-MM-DD>.<format>`.

## Out of scope

XLSX-vs-CSV parity audit beyond the name columns.
