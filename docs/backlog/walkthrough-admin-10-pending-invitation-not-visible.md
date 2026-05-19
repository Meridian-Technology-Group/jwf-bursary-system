---
title: Pending staff invitations not visually distinguished on `/users`
status: open
severity: medium
area: admin-ui, invitations
opened: 2026-05-19
opened_by: walkthrough verification pass
related:
  - docs/walkthroughs/admins/10-invite-a-staff-member.md
  - docs/walkthroughs/admins/15-resend-or-revoke-invitation.md
---

## Context

Walkthrough `admins/10-invite-a-staff-member.md` step 5 promises:

> A new row appears in the **Staff Users** table with status
> reflecting the pending state.

Reality on the prod build of `chore/walkthrough-verification-pass`:

- `POST` succeeds; the row is created in `public.staff_invitations`
  with `status='PENDING'`.
- After page refresh, the Staff Users table on `/users` includes a
  row for the invited email **but the row is indistinguishable
  from a registered user**. It shows the chosen role chip
  (`ASSESSOR`) and a Joined date of today — not "Pending" or
  "Invited" or any other visual marker. The Actions cell offers the
  same role-switch dropdown as for real users.
- The page also does not auto-refresh after the form submit — the
  toast doesn't fire and the new row only appears after a manual
  reload. This is the second symptom of the same gap.

Two real consequences:

1. An admin who follows the guide cannot confirm the invitation
   landed (they look at the table and see something that looks like
   a real user with today's "Joined" date).
2. The "Joined" column is actively misleading — it shows today as
   the join date, but the user has not yet activated their account.

## Why it matters

Invitations are the entry point for every new staff member. The
admin needs a reliable read on "did this go out, has it been
accepted yet, do I need to re-send (per admins/15)". Without a
pending badge or a separate Pending Invitations section, the admin
must inspect the database to answer that question.

## Proposed approach

Two options, not mutually exclusive:

1. **Add a Pending Invitations section / table** above or below
   Staff Users on `/users`, listing rows from
   `staff_invitations WHERE status='PENDING'` with the
   resend/revoke actions referenced in
   [[15-resend-or-revoke-invitation]]. This is the model the
   walkthrough cross-link assumes already exists.
2. **Or** render unaccepted-yet rows inline in the Staff Users
   table with a clear `PENDING` status badge, an explicit "Invited"
   date column (replacing the misleading "Joined" date), and the
   resend/revoke actions in place of the role-switch dropdown.

Either fix should also surface the toast on successful invite, and
revalidate the table after the server action returns (the form is
clearly bypassing the revalidate path today — `router.refresh()`
or the equivalent server-action revalidate is missing).

## Related finding — `/invitations` does not show staff invitations

While verifying [[15-resend-or-revoke-invitation]] I also confirmed
the wider symptom: `/invitations` reads from `public.invitations`
(applicant intake) only. `public.staff_invitations` rows — the
table backing the form on `/users` — are not displayed anywhere
that surfaces a Resend or Revoke action.

The admin/15 guide explicitly says:

> Same actions cover staff invitations sent via
> [[10-invite-a-staff-member]] — they appear in the same Invitation
> History table.

That claim is currently false. There are two reasonable fixes:

1. Extend `/invitations` to UNION applicant + staff invitations
   into one history table with a type chip; or
2. Build a separate Pending Staff Invitations table on `/users`
   with its own resend/revoke actions, and update the admin/15
   guide cross-link accordingly.

Option 2 maps more cleanly to the current data model (separate
tables, separate flows) and avoids forcing a polymorphic actions
column.

## Out of scope

- Email delivery itself — Resend is wired and the invitation row
  was created; deliverability is its own backlog topic.
- Role promotion (ASSESSOR → ADMIN) — also flagged in the guide
  Notes but not under test here.
