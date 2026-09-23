# 07. Staff User Management

This guide covers creating, changing and removing staff accounts in the
application. Staff accounts are separate in Production and Staging: perform
each procedure in the environment where the account is needed.

Procedures in sections 2 to 6 are carried out in the admin console by a signed
in administrator, on the **Users** page (left sidebar, **Users**). Procedures in
sections 7 and 8 are carried out in Supabase and are needed only when no
administrator can do the work in the admin console.

---

## 1. Roles

**Admin** can do everything an Assessor can, and also manage rounds, settings,
email templates, staff users, data deletion and the audit log.

**Assessor** can work on applications: review documents, complete assessments,
produce recommendations, send applicant invitations, and run exports and
reports.

**Viewer** can read applications, exports and reports, and change nothing.

**Deleted** cannot sign in. It is the role given to a deactivated account.

Keep at least two administrators in Production at all times, so that one can
reset the other's two factor authentication.

---

## 2. Invite a staff member

1. On the **Users** page, in the invite form, enter the person's **email
   address**, **first name** and **last name**.
2. Choose the **role**: **Assessor** or **Viewer**. Administrators are created
   by promoting an Assessor; see section 3.
3. Click **Send Invite**, check the details in the **Send this staff invite?**
   dialog, and click **Confirm & send**.
4. The invitation appears under **Pending Staff Invitations**.

The person receives an email with a link valid for 72 hours. When they activate
their account, the invitation leaves the pending list and they appear under
**Staff Users**. Their first sign in is described in
[02. Access and Accounts](02-access-and-accounts.md), section 3.

### 2.1 Resend or revoke an invitation

In **Pending Staff Invitations**, on the invitation's row:

- **Resend invitation** sends a new email with a new 72 hour link. Use it when
  the original link has expired or the email was not received.
- **Revoke invitation** cancels the invitation. The link stops working.

---

## 3. Make a staff member an administrator

1. Invite the person as an **Assessor** (section 2) and wait for them to
   activate their account.
2. In **Staff Users**, on their row, change the role drop down to **Admin**.
3. Ask them to sign out and sign in again. The new role applies from their next
   sign in.

---

## 4. Change a role

In **Staff Users**, on the person's row, choose the new role in the drop down.
The change saves immediately and is recorded in the audit log. The person signs
out and in again for it to apply.

An administrator cannot change their own role.

---

## 5. Reset two factor authentication

Use when a staff member has lost or replaced the device holding their
authenticator app.

1. In **Staff Users**, on the person's row, click the shield icon (**Reset
   MFA**).
2. In the **Reset MFA** dialog, click **Reset MFA**.
3. The person is signed out everywhere. At their next sign in they set up two
   factor authentication again, as on their first sign in.

The reset is recorded in the audit log. An administrator cannot reset their own
two factor authentication; another administrator does it.

---

## 6. Deactivate a staff member

Use when a person leaves or no longer needs access.

1. In **Staff Users**, on the person's row, click the person icon with a cross
   (**Deactivate user**).
2. In the **Deactivate User** dialog, click **Deactivate**.

The account's role becomes **Deleted** and the person can no longer use the
system. Every application assigned to them becomes unassigned. The account
remains in the list marked **Deactivated**, and the action is recorded in the
audit log.

A staff member who forgets their password uses **Forgot password?** on the sign
in page. No administrator action is needed.

---

## 7. Reactivate a deactivated staff member

The admin console has no reactivate action. Use the Supabase SQL Editor (see
[06. Database Changes and Reference Data](06-database-changes-and-reference-data.md),
section 2) in the project for the environment concerned.

```sql
UPDATE profiles
SET role = 'ASSESSOR', updated_at = now()
WHERE lower(email) = lower('<email address>')
  AND role = 'DELETED';
```

The result must report **1 row affected**. Replace `'ASSESSOR'` with
`'VIEWER'` or `'ADMIN'` as required. The person signs in with their existing
password, or uses **Forgot password?** if they no longer know it.

---

## 8. No administrator can sign in

Use when every administrator has lost access, or to create the first
administrator in a new environment.

### 8.1 An administrator exists but has lost their authenticator device

In the Supabase SQL Editor for the environment concerned:

```sql
DELETE FROM auth.mfa_factors
WHERE user_id = (
  SELECT id FROM profiles WHERE lower(email) = lower('<administrator email address>')
);
```

The result must report at least **1 row affected**. The administrator signs in
and sets up two factor authentication again.

### 8.2 No administrator account exists

1. Supabase project, **Authentication**, **Users**, **Add user**, **Create new
   user**.
2. Enter the email address and a password of at least 12 characters. Tick
   **Auto Confirm User**. Click **Create user**.
3. Click the new user in the list and copy the **User UID**.
4. In the SQL Editor, run:
   ```sql
   INSERT INTO profiles (id, email, role, first_name, last_name, updated_at)
   VALUES ('<User UID>', '<email address>', 'ADMIN', '<first name>', '<last name>', now());
   ```
   The result must report **1 row affected**.
5. The person signs in at `/login` with the email address and password. In
   Production they set up two factor authentication at this point.

Always create the user in the Supabase dashboard as in step 1. A user inserted
directly into the `auth.users` table with SQL cannot sign in or reset their
password.

Vendor documentation: [Managing users](https://supabase.com/docs/guides/auth/managing-user-data) ·
[Multi factor authentication](https://supabase.com/docs/guides/auth/auth-mfa)
