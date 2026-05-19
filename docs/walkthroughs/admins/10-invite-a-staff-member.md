# 10 — Invite a staff member

Backlink: [[README#Staff and applicant invitations]]

Sends a registration link to a new admin, assessor, or viewer. The
recipient sets their own password via the link.

## Prerequisites

- Signed in as `ADMIN`.
- You know the staff member's work email and which role to assign:
  - `ASSESSOR` — full case-work access.
  - `VIEWER` — read-only access.
  - (To create another `ADMIN`, the user must be promoted after
    initial invitation — see Notes below.)

## Steps

1. Sidebar → **Users**. You arrive at `/users` under the heading
   **User Management**.
2. Locate the **Invite Staff Member** section.
3. Fill the form:
   - **Email** *(required)* — e.g. `staff@example.com`.
   - **First Name** *(optional)*.
   - **Last Name** *(optional)*.
   - **Role** *(required)* — choose **ASSESSOR** or **VIEWER**.
4. Click **Send Invitation**.

## Verification

- The recipient receives the invitation email (template configurable
  via [[09-edit-email-templates]]).
- A new row appears in the **Staff Users** table with status
  reflecting the pending state.
- The recipient clicks the link, lands on `/register/staff`, sets a
  password, and signs in.

## Changing role or deactivating later

- In the **Staff Users** table, use the row's **Actions** to switch
  ASSESSOR ↔ VIEWER, or to **Deactivate** the user (marks them
  `DELETED` and removes them from active assignments).
- You cannot change your own role.

## Notes

- To promote a staff member to `ADMIN`, change their role from the
  table actions after they have accepted the invitation.
- If the invitation email is lost or expired, see
  [[15-resend-or-revoke-invitation]] (the same resend/revoke pattern
  applies for applicant invitations and is the canonical reference).
