# 25 — Break a sibling link

Backlink: [[README#Sibling linking]]

Remove a single sibling from the family group. Both children's future
calculations are recomputed without absorption.

## Prerequisites

- The two children are currently linked.
- Signed in as `ASSESSOR` or `ADMIN`.

## Steps

1. Open the **Applicant Data** tab, scroll to **Linked Siblings**.
2. On the sibling row you want to remove, click the **Unlink** ghost
   button (unlink icon, right-most).
3. The row expands to an inline confirmation panel:
   *"Remove `<Child name>` from this sibling group?"* with
   **Cancel** and **Confirm Unlink** (rose) buttons.
4. Click **Confirm Unlink**. The request is `DELETE
   /api/siblings/[id]`.
5. On success the row disappears from the list. If the family group
   now has 0 or 1 members, the group itself remains as a stub but is
   no longer surfaced.

## What changes server-side

- The `SiblingLink` row is hard-deleted.
- An audit entry records the unlink.
- Subsequent assessments for either child will not absorb the other's
  payable fees.

## Verification

- The **Linked Siblings** card no longer shows the removed child.
- The calculation sidebar on either child's next assessment refresh
  does not show the *Sibling payable fees absorbed* line for the
  removed sibling.

## Troubleshooting

- *"Failed to remove sibling link"* — usually an RLS / permission
  issue; verify the current user is `ASSESSOR` or `ADMIN` and assigned
  to the application.
- The other child's previously-saved assessments are **not**
  retroactively re-calculated. If a historical assessment now looks
  wrong, open it and re-save to refresh the snapshot
  ([[16-save-the-assessment]]).
