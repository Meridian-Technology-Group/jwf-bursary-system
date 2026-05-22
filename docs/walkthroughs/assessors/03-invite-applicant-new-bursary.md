# 03 — Invite one applicant for a new bursary

Backlink: [[README#Inviting applicants (single)]]

Send a single registration link to a family who has been offered a
place. The system records the invitation and emails the recipient a
tokenised URL.

> **Note:** the `/invitations` page currently requires `ADMIN`. Where
> Assessors need to send a single invitation as part of intake, ask an
> Admin to action it, or use the **Internal Request** flow on the queue
> page (see [[04-invite-internal-ad-hoc-bursary]]) which is open to
> Assessors and produces the same applicant invitation email.

## Prerequisites

- Signed in as `ADMIN`.
- At least one round exists; ideally the round is `OPEN`.
- You have the applicant's email address.

## Steps

1. Sidebar → **Invitations**. You land at `/invitations` under the
   heading **Invitations** with strapline *"Send bursary application
   invitations and track their status."*
2. The **Send New Invitation** card sits at the top. Fill in:
   - **Email** *(required)* — applicant's email.
   - **First Name** / **Last Name** *(optional)* — used in the merge
     fields of the email body.
   - **Display Name** *(optional)* — overrides the first + last
     fallback.
   - **Child Name** *(optional)*.
   - **School** — *Any / Not specified*, *Trinity School*, or
     *Whitgift School*.
   - **Round** *(required)* — defaults to the most recent `OPEN` round.
3. Click **Send Invitation**. On success the green banner reads
   *"Invitation sent to `<email>`"*, the form resets, and the invitation
   appears in the **Invitation History** table below.

## What happens server-side

- An `Invitation` row is created with status `PENDING` and a one-time
  token.
- The `INVITATION` email template is rendered with merge fields
  (applicant name, child name, round academic year, registration link)
  and sent via Resend.
- An audit-log entry is written.

## Verification

- The new row in **Invitation History** shows status badge **PENDING**
  (yellow), the *Sent* date, and your name under *Sent By*.
- The **Actions** column offers a row menu — see
  [[../admins/15-resend-or-revoke-invitation]] for follow-up actions.
- The applicant receives an email containing a link of the form
  `/register?token=…`.

## Troubleshooting

- **"A valid email address is required"** — Zod validation on the
  client; correct the email field.
- **"An application round is required"** — the round dropdown was left
  on the placeholder; select a round.
- **Email not delivered** — check Resend deliverability dashboard; the
  webhook log is visible under the audit trail
  ([[../admins/13-audit-log-review]]).
