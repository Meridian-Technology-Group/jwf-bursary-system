# 02. Access and Accounts

This guide covers getting access to each service the system runs on, and
signing in to the application as a member of staff.

---

## 1. Service accounts

Access to each service is granted by an existing administrator of that service
sending an invitation to your email address. Accept each invitation, set a
password, and turn on two factor authentication for your own account
immediately.

**Vercel.** Ask the team owner for **Member** on the `john-whitgift-foundation`
team, shown as **JWF**. That role allows viewing deployments and logs, rolling
back a release, editing environment variables, and managing firewall rules.
See [Managing team members](https://vercel.com/docs/rbac/managing-team-members)
and [Two factor authentication](https://vercel.com/docs/two-factor-authentication).

**Supabase.** Ask the organisation owner for **Administrator** on the
organisation holding both projects. That role allows running SQL, viewing logs
and advisors, managing authentication users and project settings, and restoring
backups. See [Access control](https://supabase.com/docs/guides/platform/access-control)
and [Enable MFA](https://supabase.com/docs/guides/platform/multi-factor-authentication).

**Resend.** Ask a team admin for **Admin** on the team. That role allows
viewing sent emails and their delivery status, and managing domains, API keys
and webhooks. See [Team settings](https://resend.com/docs/dashboard/settings/team)
and [Two factor authentication](https://resend.com/docs/knowledge-base/how-can-i-add-mfa).

**Sentry.** Ask the organisation owner or a manager for **Member** on the
organisation, with access to the `bursary-system` project. That role allows
viewing and resolving issues and editing alert rules. See
[Organisation membership](https://docs.sentry.io/organization/membership/) and
[Two factor authentication](https://docs.sentry.io/organization/authentication/two-factor-authentication/).

**GitHub.** Ask the organisation owner for **Write** on the
`jwf-bursary-system` repository. That role allows creating branches, opening
and merging pull requests, and running workflows by hand. See
[Repository access](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/managing-an-individuals-access-to-an-organization-repository)
and [Two factor authentication](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication).

---

## 2. Confirming access

Once all invitations are accepted, confirm each of the following opens without
an error.

- The Vercel project:
  <https://vercel.com/john-whitgift-foundation/jwf-bursary-system>
- Both Supabase projects, `supabase-prod` and `supabase-nonprod`, listed at
  <https://supabase.com/dashboard/projects>
- The Resend emails list: <https://resend.com/emails>
- The Sentry project `bursary-system`: <https://sentry.io/issues/>
- The GitHub repository:
  <https://github.com/Meridian-Technology-Group/jwf-bursary-system>

---

## 3. Signing in to the application as staff

Staff accounts are created by an administrator inside the application. See
[07. Staff User Management](07-staff-user-management.md) for how an account is
created.

### 3.1 First sign in to Production

Production requires two factor authentication for every staff account. An
authenticator app is needed on a phone or computer: Microsoft Authenticator,
Google Authenticator and 1Password all work.

1. Open the invitation email and follow the link. The link is valid for 72
   hours.
2. The **Activate your staff account** page opens. Set a password of at least
   12 characters and submit.
3. You are signed in automatically and the **Set up two-factor authentication**
   page opens with a QR code.
4. Open the authenticator app, add a new account, and scan the QR code.
5. Enter the six digit code shown in the authenticator app.
6. The admin console opens.

### 3.2 Later sign ins to Production

1. Sign in with email address and password.
2. Enter the current six digit code from the authenticator app.

### 3.3 Signing in to Staging

Staging does not require two factor authentication. Sign in at
<https://jwf-bursary-system-git-staging-john-whitgift-foundation.vercel.app/login>
with email address and password only.

Staging and Production have separate user accounts. An account on one does not
exist on the other.

### 3.4 Lost authenticator device

Another administrator resets the two factor authentication from the **Users**
page. See [07. Staff User Management](07-staff-user-management.md), section 5.
