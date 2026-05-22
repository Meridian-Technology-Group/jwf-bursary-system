---
title: Pre-submission review page shows every section "Not started" despite is_complete=true
status: open
severity: high
area: portal-ui, applications
opened: 2026-05-20
opened_by: walkthrough verification pass (end-to-end applicant run)
related:
  - docs/walkthroughs/applicants/21-pre-submission-review-page.md
  - src/app/(portal)/apply/review/page.tsx
  - src/lib/portal/section-gaps.ts
---

## Context

Filled all 9 data sections of application `WS-202627-0001` through the
portal end-to-end. Each section's **Save and Continue** passed
server-side Zod validation and advanced. Confirmed in the DB:

```
section            is_complete
CHILD_DETAILS      true
FAMILY_ID          true
PARENT_DETAILS     true
DEPENDENT_CHILDREN true
DEPENDENT_ELDERLY  true
OTHER_INFO         true
PARENTS_INCOME     true
ASSETS_LIABILITIES true
ADDITIONAL_INFO    true
```

All 9 `application_sections` rows have `is_complete = true`.

**But** the pre-submission review page (`/apply/review`) shows:

- "Sections fully complete: **0 of 10**" / **0%**
- Every section row labelled **Not started**

Simultaneously the page banner reads "Looks complete — review your
details below and proceed to the Declaration when ready." — directly
contradicting the 0-of-10 counter on the same screen.

## Why it matters

This is the screen the applicant relies on to confirm they're done.
Showing "Not started" for sections they just completed will make
applicants think their data was lost, prompting either re-entry or a
support call. The contradictory "Looks complete" banner makes it
worse — the page disagrees with itself.

It also undermines applicants/21 (the walkthrough that documents this
page) — the guide describes the completion counts as meaningful.

## Likely cause

The review page derives section status from
`getSectionGapStatuses` (`src/lib/portal/section-gaps.ts`) — a
document-gap computation — rather than from the persisted
`application_sections.is_complete` flag. Because this run skipped
the *optional* document uploads, the gap computation treats every
section as having outstanding items and reports "Not started",
even though the section data itself is saved and valid.

The sidebar progress bar uses the same gap source and shows 0% too.

## Proposed approach

Decide what "complete" means for the review page and make the counter,
the per-row label, and the banner agree:

- If sections are complete when `is_complete = true` (data saved +
  validated), read that flag for the row label and the N-of-10
  counter; surface document gaps as a separate "documents
  outstanding" sub-note rather than collapsing the whole section to
  "Not started".
- Or, if document uploads are genuinely required for completeness,
  then the schemas should mark those document IDs required (they're
  currently `.optional()`), the section's `is_complete` should be
  false until docs are attached, and **Save and Continue** should not
  have advanced. Right now the two notions of "complete" disagree.

Either way the "Looks complete" banner and the "0 of 10" counter must
not both render on the same state.

## Out of scope

- Whether documents should be mandatory at submission — that's a
  policy question for the Foundation. This entry is about the
  review page contradicting the persisted state.
