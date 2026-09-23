# 01. System Overview

This guide describes what the Bursary Assessment System is, the external
services it runs on, and what each service does. Read it before any other
guide in this set.

---

## 1. What the system is

The Bursary Assessment System is a web application that manages means tested
bursary applications for Trinity School and Whitgift School.

It has two parts:

- **Applicant portal.** Invited parents register, complete the financial
  application form, and upload supporting documents such as P60s, bank
  statements and passports.
- **Admin console.** Foundation staff manage annual rounds, invite applicants,
  assess submitted applications against the Foundation's financial model, and
  produce a recommendation for the school.

Both parts are one application, built from one codebase, with one database per
environment.

---

## 2. How the pieces fit together

```
                    Parent or staff member
                      (web browser)
                            |
                            v
      +-----------------------------------------------+
      |  VERCEL  (London region)                       |
      |  Hosts and serves the application.             |
      |  Firewall, rate limiting, scheduled jobs.      |
      +-----------------------------------------------+
          |                |                 |
          v                v                 v
   +-------------+  +-------------+  +--------------+
   |  SUPABASE   |  |   RESEND    |  |   SENTRY     |
   |  Database   |  |   Sends     |  |   Records    |
   |  Logins     |  |   email     |  |   errors     |
   |  Documents  |  |             |  |              |
   +-------------+  +-------------+  +--------------+

   Source code, automated checks and database migrations: GITHUB
```

**GitHub** holds the code. **Vercel** runs it. **Supabase** stores all data,
logins and documents. **Resend** sends email. **Sentry** records errors.

---

## 3. The services at a glance

**[Vercel](https://vercel.com)**, an application hosting platform, serves the
website, builds and deploys each new version, holds the configuration, and runs
the firewall and the scheduled jobs.

**[Supabase](https://supabase.com)**, a managed database platform, holds the
database, every user login, and every uploaded document.

**[Resend](https://resend.com)**, an email sending service, sends the
invitations, confirmations, reminders and outcome notices.

**[Sentry](https://sentry.io)**, an error monitoring service, records and
alerts on errors, both in the browser and on the server.

**[GitHub](https://github.com)**, a source code hosting and automation service,
stores the code, runs the automated checks, and applies database migrations.

Supabase runs on Amazon Web Services (AWS) in London. There is no separate AWS
account; AWS is relevant only because it determines where data is stored.

---

## 4. The services in detail

### 4.1 Vercel

**What it is.** A hosting platform for Next.js, the web framework the
application is written in. Vercel takes the code from GitHub, builds it, and
serves it. There are no servers to patch or maintain.

**What it does for this system.**

- Serves the application to parents and staff.
- Builds and deploys automatically. A merge to the `main` branch deploys
  Production. A merge to the `staging` branch deploys Staging.
- Stores all configuration and secrets as environment variables, separately
  for Production and Staging. See
  [03. Environment Variables](03-environment-variables.md).
- Holds two firewall rules that limit requests to the sign in and password
  reset pages to 5 per 15 minutes per IP address.
- Runs two scheduled jobs. See [09. Scheduled Jobs](09-scheduled-jobs.md).

**Region.** London (`lhr1`).

**Location.** <https://vercel.com/john-whitgift-foundation/jwf-bursary-system>

**Vendor documentation.**
[Overview](https://vercel.com/docs) ·
[Deployments](https://vercel.com/docs/deployments) ·
[Firewall](https://vercel.com/docs/vercel-waf) ·
[Cron jobs](https://vercel.com/docs/cron-jobs)

---

### 4.2 Supabase

**What it is.** A managed platform built around a PostgreSQL database, with an
authentication service and a file store alongside it.

**What it does for this system.**

- **Database.** Holds every application, assessment, contact, invitation,
  email log entry, audit log entry and configuration value.
- **Authentication.** Handles every login for parents and staff: passwords,
  sessions, password reset emails, and the authenticator app codes that staff
  enter when signing in to Production. The browser sends sign in details
  directly to Supabase, which limits repeated attempts.
- **Storage.** Holds every uploaded document, in a private bucket named
  `documents`. Uploads go directly from the browser to Supabase. Accepted
  formats are PDF, JPG and PNG, up to 20 MB each.
- **Row Level Security (RLS).** Rules inside the database that decide which
  rows each user can read and change. The application depends on these rules
  for data protection.

**Projects.** There are two Supabase projects. They are completely separate.

| Project name | Environment | Project reference |
|---|---|---|
| `supabase-prod` | Production | `tdnojrqkbccikfipthmk` |
| `supabase-nonprod` | Staging and local development | `lmkmgoqezgeeyjodbvzn` |

The project reference is the identifier that appears in the project's URL and
in its connection strings. Checking it is the reliable way to confirm which
project you are working in.

**Region.** AWS `eu-west-2` (London). All data is stored in the United Kingdom.

**Backups.** Daily backups with point in time recovery, which allows the
database to be restored to any moment within the retention window. See
[12. Rollback and Recovery](12-rollback-and-recovery.md).

**Location.** <https://supabase.com/dashboard>

**Vendor documentation.**
[Overview](https://supabase.com/docs) ·
[Authentication](https://supabase.com/docs/guides/auth) ·
[Storage](https://supabase.com/docs/guides/storage) ·
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) ·
[Backups](https://supabase.com/docs/guides/platform/backups)

---

### 4.3 Resend

**What it is.** A service that sends email on behalf of an application and
records the delivery outcome of each message.

**What it does for this system.** Sends every email the application generates:
applicant and staff invitations, submission confirmations, document requests,
reminders and outcome notices. The wording of these emails is held in the
database and edited by administrators under **Settings** in the admin console.

Password reset emails are the one exception. Supabase sends those. See
[10. Email](10-email.md).

**Addresses.** Email is sent from `bursary@updates.meridiantech.group`, and
replies go to `fees@johnwhitgiftfoundation.org`.

**Account.** Production and Staging use the same Resend account. An email sent
from Staging is delivered to the real recipient.

**Location.** <https://resend.com/overview>

**Vendor documentation.**
[Overview](https://resend.com/docs/introduction) ·
[Emails](https://resend.com/docs/dashboard/emails/introduction) ·
[Domains](https://resend.com/docs/dashboard/domains/introduction)

---

### 4.4 Sentry

**What it is.** A service that captures errors raised by an application,
groups identical errors together, and sends alerts.

**What it does for this system.** Records every unhandled error in Production,
both in the user's browser and on the server, with a stack trace that points
to the exact line of source code.

**Project.** `bursary-system`.

**Location.** <https://sentry.io>

**Vendor documentation.**
[Issues](https://docs.sentry.io/product/issues/) ·
[Alerts](https://docs.sentry.io/product/alerts/) ·
[Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

### 4.5 GitHub

**What it is.** A service that stores source code, tracks every change to it,
and runs automated tasks when the code changes.

**What it does for this system.**

- **Repository.** Stores the code at
  `Meridian-Technology-Group/jwf-bursary-system`.
- **Branches.** `main` is Production. `staging` is Staging. Both are protected
  branches, and changes reach them through pull requests.
- **Automated checks.** Every pull request runs schema validation, migration
  checks, a type check and the test suite.
- **Database migrations.** A merge to `staging` applies new database migrations
  to `supabase-nonprod`. A merge to `main` applies them to `supabase-prod`.
- **Releases.** Version numbers and `CHANGELOG.md` are generated from commit
  messages.

**Location.** <https://github.com/Meridian-Technology-Group/jwf-bursary-system>

**Vendor documentation.**
[Pull requests](https://docs.github.com/en/pull-requests) ·
[GitHub Actions](https://docs.github.com/en/actions)

---

## 5. External dependencies without an account

**[Have I Been Pwned](https://haveibeenpwned.com/API/v3#PwnedPasswords)**
rejects passwords that appear in known data breaches, at registration and at
password reset. Only the first five characters of a one way hash of the
password are sent, so the password itself never leaves the system. If the
service is unavailable the password is accepted, and registration and password
reset continue to work.

**The [npm registry](https://www.npmjs.com)** supplies the open source packages
installed during a build. If it is unavailable, new deployments fail and the
running site is unaffected.

---

## 6. The two environments

**Production** is the live service.

- Web address: <https://jwf-bursary-system.vercel.app>
- Git branch: `main`
- Supabase project: `supabase-prod`
- Holds the real applicants and their financial information
- Staff must use two factor authentication
- Scheduled jobs run

**Staging** is where changes are tested before release.

- Web address:
  <https://jwf-bursary-system-git-staging-john-whitgift-foundation.vercel.app>
- Git branch: `staging`
- Supabase project: `supabase-nonprod`
- Holds test data only
- Staff sign in without two factor authentication
- Scheduled jobs do not run

Email is the exception to the separation. Both environments send through the
same Resend account, so an email sent from Staging reaches the real recipient.

The application reports which build is running at `/api/version`. For example,
<https://jwf-bursary-system.vercel.app/api/version> returns the version number,
the Git commit and the environment of the build currently serving Production.

---

## 7. Related systems

**Microsoft 365.** The Foundation's email runs on Microsoft 365. Its Safe Links
feature opens every link in an incoming email to scan it. The application is
built so that this does not use up one time links: invitation and password
reset links are validated only when the form on the page is submitted.

**Symplectic Grant Tracker.** The system used before this one. Bursary records
from before this system went live are held there.
