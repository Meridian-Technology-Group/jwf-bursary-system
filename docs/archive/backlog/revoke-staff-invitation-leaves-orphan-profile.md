---
title: Revoking a staff invitation leaves the profile + auth user in place
status: done
severity: low
area: admin-ui, invitations
opened: 2026-05-19
opened_by: walkthrough verification pass (post-fix re-run)
related:
  - src/app/(admin)/users/actions.ts (revokeStaffInvitationAction)
  - docs/guides/walkthroughs/admins/15-resend-or-revoke-invitation.md
---

## Context

After PR #35 fixed `walkthrough-admin-10-pending-invitation-not-visible`,
re-running admin/10 + admin/15 against the new Pending Staff Invitations
section uncovered a small cleanup gap:

- Invite `jwf-testing+wt-staff-02@meridiantech.group` → row lands
  in Pending Staff Invitations with PENDING pill. ✅
- Click Revoke → confirm dialog. ✅
- `staff_invitations.status` flips to `EXPIRED` in the DB. ✅
- **But** the corresponding `profiles` row (and auth user) is not
  cleaned up. After page refresh the email shows in the Staff Users
  table as a normal `ASSESSOR` with 0 assignments and "Joined" set
  to today.

The applicant-side `revokeInvitationAction` already does the
auth-user-and-profile cleanup. The staff variant should mirror it.

## Why it matters

Visual clutter and a misleading row in Staff Users for users who
never accepted. Doesn't break anything functionally — admin can
deactivate the user via the existing row action — but admin/15's
verification step ("If the recipient never accepted, their stub
auth user is removed.") is currently false.

## Proposed approach

Extend `revokeStaffInvitationAction` (src/app/(admin)/users/actions.ts)
with the same shape as the applicant flow:

```ts
// After flipping status to EXPIRED:
const supabase = createSupabaseAdminClient();
await supabase.auth.admin.deleteUser(existing.authUserId).catch(...);
await tx.profile.delete({ where: { id: existing.authUserId } }).catch(...);
```

Wrap each in `.catch()` so a partial cleanup doesn't fail the
revoke itself (the row is already EXPIRED so no link can be used).

## Out of scope

- Reworking the deactivate flow for already-accepted users; that's
  the separate "Deactivate" action and works correctly.
