---
title: BursaryAccount rows are never created by any code path
status: open
severity: high
area: schema, sibling-linking, reassessment
opened: 2026-05-22
opened_by: walkthrough-verification
related:
  - src/lib/db/queries/siblings.ts (reads bursary_accounts; never creates)
  - src/lib/db/queries/reassessment.ts (reads prior-year via bursary_account)
  - src/lib/db/queries/invitations.ts (getActiveBursaryHolders reads ACTIVE accounts)
  - docs/walkthroughs/assessors/23-link-siblings.md (prereq assumes account "created on submission")
---

## Context

While unblocking the sibling-linking (assessor 23/24/25) and re-assessment
(assessor 26/27/28, applicant 26/27/28) walkthroughs, traced the full code
base for any write to `bursary_accounts`. There is **none** — no
`prisma.bursaryAccount.create`, no upsert, no raw insert anywhere under
`src/`. The table is only ever read:

- `searchBursaryAccounts()` / `getSiblingLinks()` (sibling linking)
- `getPreviousYearApplication()` / `getPreviousAssessment()` (re-assessment)
- `getActiveBursaryHolders()` (batch re-assessment invites)

The assessor/23 guide states the prerequisite "The current application has
a `bursaryAccountId` (created on submission)." Submission does **not**
create a bursary account (verified: WS-202627-0001 submitted, assessment
COMPLETED, `bursary_account_id` still null).

## Why it matters

Two whole feature areas are unreachable in production:

- **Sibling linking** — the Sibling Links section only renders when the
  application has a `bursary_account_id` (`applications/[id]/page.tsx:222,282`).
  With no creation path, it never renders, and the sibling search returns
  nothing because `bursary_accounts` is always empty.
- **Re-assessment** — `getActiveBursaryHolders()` returns only ACTIVE
  bursary accounts, so the batch re-assessment invite (admin/11) finds zero
  holders. Year-on-year benchmark/comparison (assessor/27) reads
  `bursary_accounts.benchmark_payable_fees`, which never exists.

These were classified as "blocked on test data" in the verification plan,
but the real cause is a missing feature: nothing promotes an approved
application into an ongoing `BursaryAccount`.

## Proposed approach

Create the `BursaryAccount` (and set `application.bursary_account_id` +
`benchmark_payable_fees`) at the point an assessment outcome is confirmed as
QUALIFIES (the OutcomeDialog confirm path, assessor/22). That is the natural
"this child now holds a bursary" moment and gives both the benchmark figure
(year-1 `yearly_payable_fees`) and the link the sibling/re-assessment
features need. Alternative: create the account on submission (matches the
guide's wording) but that would create accounts for applicants who are later
declined.

## Out of scope

The walkthrough pass seeded bursary accounts directly in nonprod (UUIDs
prefixed `f1000000-…`) to verify the consuming UI. That seed is test-only
and not a fix.
