# 10. Email

This guide covers how the system sends email, where the wording of each email
is held, and how to find out what happened to a specific email.

---

## 1. Who sends what

| Email | Sent by | Wording held in |
|---|---|---|
| Applicant invitations, staff invitations, submission confirmations, document requests, reminders, outcome notices, messages from the bulk email tool | The application, through Resend | Admin console, **Settings**, **Email Templates** |
| Password reset | Supabase | Supabase project, **Authentication**, **Emails** |

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

| Project | Redirect URL |
|---|---|
| `supabase-prod` | `https://jwf-bursary-system.vercel.app/reset-password/update` |
| `supabase-nonprod` | `https://jwf-bursary-system-git-staging-meridian-tech-group.vercel.app/reset-password/update` and `http://localhost:3000/reset-password/update` |

Vendor documentation: [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates) ·
[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) ·
[SMTP settings](https://supabase.com/docs/guides/auth/auth-smtp)

---

## 4. Trace an email that did not arrive

### 4.1 Application emails

1. Admin console, **Sent Emails**. Search for the recipient's email address.

   | Result | Meaning | Action |
   |---|---|---|
   | No entry | The application did not send the email | Confirm the action that sends it was completed, for example that the invitation was actually sent |
   | `SKIPPED` | The template is switched off | Switch it on in **Settings**, **Email Templates**, then repeat the action |
   | `FAILED` | Resend refused the email | Hold the pointer over the `FAILED` badge to read the error; see section 5 |
   | `SENT` | Resend accepted the email | Continue to step 2 |

2. Resend, **Emails**. Search for the recipient's email address and open the
   email.

   | Status | Meaning | Action |
   |---|---|---|
   | **Delivered** | The recipient's mail server accepted it | Ask the recipient to check junk and quarantine folders. For Foundation addresses, the Foundation's Microsoft 365 administrator can check the quarantine. |
   | **Delivery delayed** | The recipient's mail server is temporarily refusing email | Resend retries automatically. Check again later. |
   | **Bounced** | The recipient's mail server rejected it permanently, usually because the address does not exist | Confirm the correct address with the recipient and send to that address |
   | **Complained** | The recipient marked it as spam | Contact the recipient by another means |
   | **Suppressed** | Resend did not send it, because this address previously bounced or complained | Confirm the address is now correct, remove it from the suppression list, and send again |

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

| Check | Where | Healthy |
|---|---|---|
| Sending domain | Resend, **Domains**, `updates.meridiantech.group` | **Verified** |
| API key | Resend, **API Keys** | The key used by the application exists |
| Environment variables | Vercel, **Settings**, **Environment Variables** | `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set for the environment. See [03. Environment Variables](03-environment-variables.md), section 3.3. |
| Resend service | <https://resend-status.com> | Operational |

---

## 6. "This link has expired"

A recipient who sees this message on an invitation or password reset page has
a link that has expired or has already been used.

| Link | Action |
|---|---|
| Applicant invitation | Admin console, **Invitations**, resend the invitation |
| Staff invitation | Admin console, **Users**, **Pending Staff Invitations**, **Resend invitation** |
| Password reset | The recipient requests a new reset from **Forgot password?** on the sign in page |

Links are validated only when the form on the page is submitted. Email
security scanners, such as Microsoft 365 Safe Links, open links without
submitting forms, so they do not use up a link.

---

## 7. Delivery notifications

Resend reports each email's delivery status to the application at
`https://jwf-bursary-system.vercel.app/api/webhooks/resend`. The application
writes each notification to the Vercel logs. The endpoint is configured in
Resend, **Webhooks**, and exists for Production only.
