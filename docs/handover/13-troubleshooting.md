# 13. Troubleshooting

This guide lists common problems by symptom, with the checks and fixes for
each. Start with section 1 for any problem that affects everyone.

---

## 1. First checks for any widespread problem

- **Supplier status.** No current incident on
  [Vercel](https://www.vercel-status.com),
  [Supabase](https://status.supabase.com),
  [Resend](https://resend-status.com),
  [GitHub](https://www.githubstatus.com) or
  [Sentry](https://status.sentry.io).
- **The Production deployment.** In the Vercel project, **Deployments**, the
  most recent Production row is **Ready**.
- **Recent releases.** In the GitHub repository, **Pull requests**,
  **Closed**, no promotion was merged just before the problem started.
- **Errors.** In Sentry, **Issues**, environment `production`, last 24 hours,
  no new issue matches the problem.

A vendor incident is resolved by the vendor. Follow its status page.

A problem that started immediately after a release is fixed fastest by rolling
back. See [12. Rollback and Recovery](12-rollback-and-recovery.md), section 2.

---

## 2. Sign in

### 2.1 A staff member cannot sign in

- **They have forgotten their password.** They use **Forgot password?** on the
  sign in page.
- **They have lost or replaced their authenticator device.** An administrator
  resets their two factor authentication. See
  [07. Staff User Management](07-staff-user-management.md), section 5.
- **Their account was deactivated.** See
  [07. Staff User Management](07-staff-user-management.md), section 7.
- **They have no account in this environment.** Staging and Production accounts
  are separate. Invite them in the environment they are using.
- **They have tried too many times.** The page shows a rate limit message.
  They wait a few minutes and try again. The limits are set in the Supabase
  project, **Authentication**, **Rate Limits**.

### 2.2 No staff member can sign in, or signing in returns to the sign in page

1. Confirm all three Supabase values in the Vercel scope point at the same
   project. See [03. Environment Variables](03-environment-variables.md),
   section 5.2.
2. Vercel project, **Logs**, Production, level **Error**. A message containing
   `password authentication failed` means the password in `DATABASE_URL` is
   wrong. Set the correct value and redeploy.
3. Supabase project, **Logs**, **Auth**. Look for errors at the time of the
   failed sign in.

### 2.3 Every staff member is stuck at the two factor authentication step

Use only when section 2.2 finds no cause and staff must regain access urgently.

1. In the Vercel Production scope, add `STAFF_MFA_ENFORCED` with value `false`,
   and redeploy. Staff can now sign in with email and password only.
2. Find and fix the cause.
3. Delete `STAFF_MFA_ENFORCED` from the Production scope, and redeploy.

Two factor authentication protects applicants' financial data. Keep step 1 in
place for the shortest time possible.

---

## 3. Pages and data

### 3.1 Lists are empty or data is missing across the whole admin console

1. Confirm the environment points at the correct Supabase project. See
   [03. Environment Variables](03-environment-variables.md), section 5.2.
2. Confirm `DATABASE_URL` uses the `app_user` user. See
   [03. Environment Variables](03-environment-variables.md), section 3.2.

### 3.2 One feature shows no data, or an assessment reports "Missing" reference data

A table is missing its Row Level Security policies.

1. Supabase project, **Advisors**, **Security Advisor**. Open **RLS Enabled No
   Policy** and note every table listed other than `_prisma_migrations`.
2. Add the policies with a migration. See
   [06. Database Changes and Reference Data](06-database-changes-and-reference-data.md),
   section 4.3.

### 3.3 A page shows "Something went wrong" or "Application error"

1. Sentry, **Issues**, environment `production`. Find the issue at the time of
   the error. The stack trace shows where the fault is.
2. If the issue started with a release, roll back. See
   [12. Rollback and Recovery](12-rollback-and-recovery.md), section 2.
3. Otherwise fix it through
   [05. Making and Releasing Changes](05-making-and-releasing-changes.md).

### 3.4 A parent cannot upload a document

- **"File too large"** means the file is over 20 MB. Ask them to reduce it, for
  example by scanning at a lower resolution or splitting a long PDF.
- **"Unsupported file type"** means the file is not a PDF, JPG or PNG. Ask them
  to save or export it as a PDF.
- **Any other failure** points at Supabase Storage. Check
  [Supabase status](https://status.supabase.com), then the Supabase project,
  **Logs**, **Storage**.

---

## 4. Email

See [10. Email](10-email.md), section 4 for a missing email, section 5 when all
emails fail, and section 6 for "This link has expired".

---

## 5. Deployments and migrations

### 5.1 A deployment shows Error

The previous deployment continues to serve the site.

1. Vercel project, **Deployments**, open the failed deployment, **Build Logs**.
2. Scroll to the first line in red. It names the file and the fault.
3. Fix it on a branch and merge through
   [05. Making and Releasing Changes](05-making-and-releasing-changes.md).

### 5.2 The CI check fails on a pull request

1. On the pull request, click **Details** beside the failed check.
2. Expand the failed step.

- **Typecheck.** Run the type check locally
  ([04. Local Development](04-local-development.md), section 8), fix each error
  reported, then commit and push.
- **Test.** Run `npm test` locally, fix the failing test or the code it tests,
  then commit and push.
- **Prisma schema formatting.** Run `npx prisma format`, then commit and push.
- **Migration SQL statement terminators.** A statement in a migration is
  missing its closing `;`. Add it, then commit and push.

### 5.3 The DB push workflow fails

See [06. Database Changes and Reference Data](06-database-changes-and-reference-data.md),
section 5.

---

## 6. Scheduled jobs

See [09. Scheduled Jobs](09-scheduled-jobs.md), section 3.

---

## 7. Suspected security incident

Examples: a secret shared outside the team, unexpected administrator accounts,
or unexplained deletions in the audit log.

1. If data is being accessed or changed without authorisation, take the site
   offline. See [12. Rollback and Recovery](12-rollback-and-recovery.md),
   section 3.
2. Rotate every secret that may be exposed. See
   [03. Environment Variables](03-environment-variables.md), section 5.3.
3. Admin console, **Users**. Deactivate any account that should not exist.
4. Admin console, **Audit**. Record what was accessed or changed, by which
   account, and when.
5. Inform the Foundation's data protection lead with the record from step 4.
   A breach of personal data must be reported to the Information
   Commissioner's Office within 72 hours of discovery when it poses a risk to
   the people affected.

Vendor documentation: [ICO personal data breaches](https://ico.org.uk/for-organisations/report-a-breach/)
