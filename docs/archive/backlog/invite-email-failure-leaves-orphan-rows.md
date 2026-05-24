---
title: Invitation email-send failure leaves an orphan auth user + invitation row
status: done
severity: medium
area: invitations, auth
opened: 2026-05-13
opened_by: Claude (via Brian Wagner)
related:
  - src/app/(admin)/invitations/actions.ts (createInvitationAction)
  - docs/archive/specs/invitation-flow.md §4.3
  - PR #12
---

## Context

`createInvitationAction` creates a Supabase auth user up front, then
writes Profile + Invitation + audit log in a single tx, then sends the
branded email via Resend. The transaction rollback path correctly
deletes the auth user when **the DB tx fails**, but if the **email
send fails after the tx commits**, the auth user and the invitation
row remain.

This first surfaced during nonprod smoke testing when the `INVITATION`
template was missing from the DB: the admin saw "Invitation created
but email failed to send", but a PENDING invitation row was already
in the table (along with an auth.users entry) and could be exercised
via the now-unknown `token`.

## Why it matters

- The admin has no automatic way to know whether the recipient ever
  got the email. They can use the new Resend button (PR #12) to
  retry, which generates a new token and re-emails — but the original
  orphan token is still valid until expiry.
- For a one-time edge case (template missing) this is a non-event.
  For a flapping email provider it could mean dozens of stale rows.
- A user who creates an invitation, sees an error, and gives up may
  later discover their account was already provisioned silently.

## Proposed approach

Move the email send **inside** the rollback boundary:

1. Send the email *inside* the try block, before the action returns.
2. If `sendEmail` returns `success: false`, throw — the catch
   triggers the auth-user rollback **and** explicitly deletes the
   invitation row we just created.
3. Surface a clear error to the admin: "Email failed to send. The
   invitation was rolled back — please try again."

Alternative: keep the row but mark it `status = FAILED` with a clear
admin UI affordance to delete or retry, and skip the auth-user
rollback (since the admin can recover by resending). This is more
work but avoids the user-experience cliff if Resend is briefly down
during a batch.

Decide based on how often the Resend API actually fails in prod.

## Out of scope

Retrying the Resend call. We get one shot per click; if it fails the
admin retries explicitly.
