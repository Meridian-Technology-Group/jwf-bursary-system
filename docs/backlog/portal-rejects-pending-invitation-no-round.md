---
title: Portal dashboard shows "No invitation found" when invitation is PENDING or has null round_id
status: open
severity: high
area: portal-ui, invitations
opened: 2026-05-19
opened_by: walkthrough verification pass
related:
  - src/app/(portal)/page.tsx:47
  - src/lib/db/queries/invitations.ts (getLatestAcceptedInvitationForUser)
  - docs/walkthroughs/applicants/01-accept-invitation-and-set-up-account.md
---

## Context

While verifying applicants/01 against
`jwf-testing+applicant1@meridiantech.group`:

1. The user has a valid `invitations` row.
2. After logging in, the dashboard greeting renders correctly
   ("Welcome back, Brian") but the body says:

   > No invitation found
   >
   > We can't find an invitation linked to your account. Please
   > contact the Foundation if you believe this is an error.

3. Reading `src/app/(portal)/page.tsx:47`: the page calls
   `getLatestAcceptedInvitationForUser`, which only matches
   `status='ACCEPTED'`. A `PENDING` invitation that was created by
   admin/assessor intake but has not yet been "accepted" via the
   `/register?token=…` flow is invisible to the dashboard.

4. The same dashboard query (or the underlying invitation query)
   also drops rows where `round_id IS NULL`, so the seed-created
   applicant invitations (which had `round_id = NULL`) failed even
   after I set the status to ACCEPTED manually.

## Why it matters

The intended flow is: admin/assessor sends invitation → applicant
clicks /register link → fills password → status flips to ACCEPTED
→ portal then shows the onboarding card.

The bug fires when **the user already has an auth account and tries
to log in directly** (bypassing the /register link). They get the
"No invitation found" message even though their invitation exists
and is valid.

This is exactly the path a returning applicant takes after their
first session. And it's the path I needed for verification because
the test users were pre-seeded with auth accounts.

## Proposed approach

Either:

1. Loosen the dashboard query to include `PENDING` invitations,
   and have the onboarding card include a "this is your first
   sign-in, complete activation" step (essentially merge the
   register and onboarding flows).
2. Make the `/register?token=…` flow detect that the user already
   has an auth account and treat that as accept-only (flip
   `status` → `ACCEPTED`, redirect to `/`). Then the dashboard's
   ACCEPTED-only filter is fine.

Option 2 is closer to the documented walkthrough and the smaller
change. Today the register page does not appear to handle that
case — it tries to create a new auth user and would fail with an
already-exists error.

## Out of scope

- The stale-seed `round_id IS NULL` is a separate seed-data hygiene
  issue. The same query path needs to either tolerate NULL or the
  seed needs to attach every invitation to a round.
