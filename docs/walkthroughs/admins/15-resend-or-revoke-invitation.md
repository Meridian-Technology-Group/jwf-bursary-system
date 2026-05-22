# 15 — Re-send or revoke an invitation

Backlink: [[README#Operations]]

When an invitation email is lost, expired, or sent in error.
**Re-send** pushes a fresh link with a new 30-day expiry; **Revoke**
marks the invitation `EXPIRED` so the link cannot be used.

## Prerequisites

- Signed in as `ADMIN`.
- The invitation exists in the **Invitation History** table at
  `/invitations`.
- The invitation status is **PENDING** — accepted invitations cannot
  be resent or revoked (the recipient already has an account).

## Open the table

1. Sidebar → **Invitations** → you arrive at `/invitations`.
2. Scroll to the **Invitation History** table. Columns:
   **Email | Applicant | Child | School | Round | Status | Sent |
   Sent By | Actions**.
3. Status badges: **PENDING** (yellow), **ACCEPTED** (green),
   **EXPIRED** (grey).

## Re-send

1. Find the PENDING row.
2. In **Actions**, click **Resend**.
3. The system regenerates the invitation token, resets the 30-day
   expiry, and re-sends the email.

### Verification
- The **Sent** timestamp updates to now.
- The recipient receives a fresh email; the previous link is
  invalidated by the new token.

## Revoke

1. Find the PENDING row.
2. In **Actions**, click **Revoke**.
3. Confirm.

### Verification
- The status badge changes from **PENDING** to **EXPIRED**.
- The original link returns an "invitation expired" error if used.
- If the recipient never accepted, their stub auth user is removed.

## Notes

- To re-invite after revocation, send a fresh invitation from the
  **Send New Invitation** form on the same page.
- Same actions cover staff invitations sent via
  [[10-invite-a-staff-member]] — they appear in the same
  Invitation History table.
- All resend/revoke events are recorded in the audit log — see
  [[13-audit-log-review]].
