# 11 — Batch re-assessment invitations

Backlink: [[README#Staff and applicant invitations]]

At the start of a new round, email every active bursary holder a
re-assessment invitation in one action. The batch creates one
invitation row per active bursary account, pre-populated with the
child and round.

## Prerequisites

- Signed in as `ADMIN`.
- A round is in `OPEN` status (see [[02-open-a-round]]).
- The active-bursary holders from prior rounds are the population
  that will receive the batch.

## Steps

1. Sidebar → **Invitations**. You arrive at `/invitations` under the
   heading **Invitations**.
2. In the **Send New Invitation** section, locate the **Send Batch
   Reassessment Invitations** button.
3. Click it. A dialog opens listing the active bursary holders that
   will be invited for the current `OPEN` round.
4. Review the list. Each row shows applicant email, child name, and
   school.
5. Confirm by clicking the send button in the dialog.

## Verification

- The **Invitation History** table now contains one PENDING row per
  recipient, each tagged with the current round.
- Recipients receive the *Re-assessment Invitation* email (template
  editable via [[09-edit-email-templates]]).
- Each link routes the applicant to the registration / re-assessment
  flow with their child and round pre-selected.

## Re-running

- The batch is safe to re-trigger — recipients who already have a
  PENDING or ACCEPTED invitation for that round are skipped (no
  duplicates). For lost emails on individual invitations, use the
  per-row **Resend** action — see
  [[15-resend-or-revoke-invitation]].

## Notes

- Single applicant invitations for first-time applicants are an
  Assessor workflow, not Admin. See `../assessors/`.
- The batch only fires for the current `OPEN` round. To invite for a
  different round, that round must be opened first.
