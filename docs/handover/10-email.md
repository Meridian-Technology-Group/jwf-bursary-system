# 10. Email

This guide covers how the system sends email, where the wording of each email
is held, and how to find out what happened to a specific email.

---

## 1. Who sends what

**The application sends almost everything, through Resend:** applicant
invitations, staff invitations, submission confirmations, document requests,
reminders, outcome notices, and messages from the bulk email tool. The wording
of each is held in the admin console, under **Settings**, **Email Templates**.

**Supabase sends the password reset email.** Its wording is held in the
Supabase project, under **Authentication**, **Emails**.

Every email from the application is recorded in the admin console on the
**Sent Emails** page, and in Resend under **Emails**. Password reset emails
appear in neither; they are recorded in the Supabase authentication logs.

| Link in the email | Valid for |
|---|---|
| Applicant invitation | 30 days |
| Staff invitation | 72 hours |

---

## 2. Application email templates

Administrators edit the subject and body of each email in the admin console,
**Settings**, **Email Templates**. Words in double braces, such as
`{{applicant_name}}`, are replaced with the recipient's details when the email
is sent.

A template can be switched off. Emails for a switched off template are not
sent, and appear on the **Sent Emails** page with status `SKIPPED`. Invitation
templates and the application restart template cannot be switched off,
because they carry the links recipients need to register.

The admin user guide describes template editing in full.

---

## 3. Password reset email

The password reset email is configured separately in each Supabase project and
must match the application exactly. If it is changed, reset links stop working.

**Location:** Supabase project, **Authentication**, **Emails**, **Templates**,
**Reset Password**.

**Subject:**

```
Reset your password
```

**Body:**

```html
<h2>Reset your password</h2>
<p>We received a request to reset your password. Follow the link below to choose a new one.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

**Redirect URLs.** Supabase project, **Authentication**, **URL Configuration**,
**Redirect URLs** must include the reset page of every web address that serves
the project:

For `supabase-prod`, one entry:

```
https://jwf-bursary-system.vercel.app/reset-password/update
```

For `supabase-nonprod`, two entries:

```
https://jwf-bursary-system-git-staging-john-whitgift-foundation.vercel.app/reset-password/update
http://localhost:3000/reset-password/update
```

Vendor documentation: [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates) ·
[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) ·
[SMTP settings](https://supabase.com/docs/guides/auth/auth-smtp)

---

## 4. Trace an email that did not arrive

### 4.1 Application emails

1. Admin console, **Sent Emails**. Search for the recipient's email address.

   - **No entry** means the application never sent it. Confirm the action that
     sends it was completed, for example that the invitation was actually sent.
   - **`SKIPPED`** means the template is switched off. Switch it on in
     **Settings**, **Email Templates**, then repeat the action.
   - **`FAILED`** means Resend refused it. Hold the pointer over the `FAILED`
     badge to read the error, then see section 5.
   - **`SENT`** means Resend accepted it. Continue to step 2.

2. Resend, **Emails**. Search for the recipient's email address and open the
   email.

   - **Delivered** means the recipient's mail server accepted it. Ask the
     recipient to check their junk and quarantine folders. For Foundation
     addresses, the Foundation's Microsoft 365 administrator can check the
     quarantine.
   - **Delivery delayed** means the recipient's mail server is temporarily
     refusing email. Resend retries automatically, so check again later.
   - **Bounced** means the recipient's mail server rejected it permanently,
     usually because the address does not exist. Confirm the correct address
     with the recipient and send to that address.
   - **Complained** means the recipient marked it as spam. Contact them by
     another means.
   - **Suppressed** means Resend did not send it, because this address
     previously bounced or complained. Confirm the address is now correct,
     remove it from the suppression list, and send again.

Vendor documentation: [Email statuses](https://resend.com/docs/dashboard/emails/introduction) ·
[Suppressions](https://resend.com/docs/dashboard/emails/email-suppressions)

### 4.2 Password reset emails

1. Supabase project, **Authentication**, **Users**. Search for the email
   address. If no user is found, no email is sent: the address has no account
   in this environment.
2. Supabase project, **Logs**, **Auth**. Search for the email address and look
   for a recovery request and any error beside it.

Vendor documentation: [Auth logs](https://supabase.com/docs/guides/telemetry/logs)

---

## 5. All application emails are failing

When every entry on the **Sent Emails** page shows `FAILED`:

- **The sending domain.** In Resend, **Domains**, `updates.meridiantech.group`
  shows as **Verified**.
- **The API key.** In Resend, **API Keys**, the key the application uses still
  exists.
- **The environment variables.** In Vercel, **Settings**, **Environment
  Variables**, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set for the
  environment. See [03. Environment Variables](03-environment-variables.md),
  section 3.3.
- **The Resend service itself.** <https://resend-status.com> reports normal
  operation.

---

## 6. "This link has expired"

A recipient who sees this message on an invitation or password reset page has
a link that has expired or has already been used.

- **An applicant invitation:** admin console, **Invitations**, resend the
  invitation.
- **A staff invitation:** admin console, **Users**, **Pending Staff
  Invitations**, **Resend invitation**.
- **A password reset:** the recipient requests a new one from **Forgot
  password?** on the sign in page.

Links are validated only when the form on the page is submitted. Email
security scanners, such as Microsoft 365 Safe Links, open links without
submitting forms, so they do not use up a link.

---

## 7. Delivery notifications

Resend reports each email's delivery status to the application at
`https://jwf-bursary-system.vercel.app/api/webhooks/resend`. The application
writes each notification to the Vercel logs. The endpoint is configured in
Resend, **Webhooks**, and exists for Production only.
