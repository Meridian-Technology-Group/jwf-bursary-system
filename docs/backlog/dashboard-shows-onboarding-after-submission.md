---
title: Applicant dashboard reverts to "Let's set up your application" after a successful submission
status: open
severity: high
area: portal-ui, applications
opened: 2026-05-20
opened_by: walkthrough verification pass (end-to-end applicant run)
related:
  - src/lib/db/queries/applications.ts:254 (getApplicationForUser)
  - src/app/(portal)/page.tsx
  - docs/walkthroughs/applicants/23-check-application-status.md
---

## Context

After applicant `WS-202627-0001` was submitted successfully
(status flipped to SUBMITTED, confirmed in DB), the applicant
dashboard at `/` no longer shows the application. Instead it renders
the first-run onboarding card:

> Let's set up your application
> Before you start, please confirm which Foundation school your
> child has been offered a place at…
> [Start my application]

The dedicated `/status` page is correct — it shows the submitted
application, the progress timeline (Draft → Submitted → Under Review
→ Outcome Available), and the decision date. Only the dashboard home
is wrong.

## Root cause

`getApplicationForUser` (`src/lib/db/queries/applications.ts:254`)
hard-filters `status: "PRE_SUBMISSION"`:

```ts
return tx.application.findFirst({
  where: { leadApplicantId: userId, status: "PRE_SUBMISSION" },
  ...
});
```

The dashboard (`src/app/(portal)/page.tsx`) calls this; once the app
is SUBMITTED the query returns null, the page takes the "no
application" branch, and because the invitation is ACCEPTED it shows
the onboarding card.

## Why it matters

- The applicant has just submitted and is told to start over. This is
  alarming ("did my submission disappear?") and a likely support call.
- Worse: clicking **Start my application** from this state re-enters
  the apply flow. `startApplicationAction` checks for an existing
  application before creating, but the UX of inviting a re-start on a
  submitted application is wrong and risks confusion or a second
  application depending on that guard's exact filter.

## Proposed approach

Separate the two needs:

- The **apply flow** legitimately wants the editable PRE_SUBMISSION
  draft — keep a `getDraftApplicationForUser` (PRE_SUBMISSION filter)
  for that.
- The **dashboard** wants "this user's current application whatever
  its status." Add `getCurrentApplicationForUser` (no status filter,
  most recent by updatedAt) and use it in `page.tsx`. When the
  returned application is not PRE_SUBMISSION, render the
  status/summary card (mirroring `/status`) with a link to `/status`,
  not the onboarding card.

Guard the onboarding card so it only renders when the user has an
ACCEPTED invitation AND no application of any status.

## Out of scope

- Re-assessment year-2 flow (a new PRE_SUBMISSION application against
  a new round is legitimate and should still show the apply CTA).
  The dashboard logic must distinguish "submitted for the current
  round" from "invited for a new round".
