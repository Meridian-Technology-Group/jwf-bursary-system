# 01. System Overview

**Audience:** anyone operating or supporting the John Whitgift Foundation
Bursary Assessment System.

**Assumed knowledge:** none of the services named below. General IT competence
is assumed; prior experience of Vercel, Supabase, Resend or Sentry is not.

**What this document covers:** what the system is, the external services it
runs on, what each one does, and where to find it. Read this first. The
task specific procedures are in the runbooks listed in section 8.

---

## 1. What the system is

The Bursary Assessment System is a web application that manages means tested
bursary applications for Trinity School and Whitgift School. It replaces
Symplectic Grant Tracker, which Digital Science is retiring on 31 December 2026.

It has two faces:

- **Applicant portal.** Invited parents register, complete a long financial
  application form, and upload supporting documents (P60s, bank statements,
  passports, and so on).
- **Admin and assessment console.** Foundation staff manage annual rounds,
  invite applicants, assess submitted applications against the Foundation's
  financial model, and produce a recommendation for the school.

It is a single application, not a suite. There is one codebase, one database
per environment, and one deployment pipeline.

**Scale, for context:** roughly 44 pages and 17 API endpoints, 38 database
tables, 97 database migrations applied to date. Current version 1.3.1.

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

   Source code, code review and automated deployment: GITHUB
```

In plain terms: **GitHub** holds the code, **Vercel** runs it, **Supabase**
stores everything, **Resend** sends the email, **Sentry** tells you when
something breaks.

---

## 3. The services at a glance

| Service | What it is | What it does here |
|---|---|---|
| [Vercel](https://vercel.com) | Application hosting platform | Runs the live website, builds and deploys new versions, edge firewall, scheduled jobs |
| [Supabase](https://supabase.com) | Managed database and backend platform | PostgreSQL database, staff and parent logins, uploaded document storage |
| [Resend](https://resend.com) | Transactional email service | Sends invitations, confirmations, reminders and outcome notices |
| [Sentry](https://sentry.io) | Error monitoring service | Captures and alerts on application errors, browser and server |
| [GitHub](https://github.com) | Source code hosting and automation | Stores the code, runs automated tests, applies database migrations |

All five are paid accounts administered by Meridian Technology Group, who issue
access to them.

Amazon Web Services does not appear in that list because there is no AWS
account to administer. Supabase runs on AWS underneath, which matters only for
data residency; see section 4.2.

---

## 4. The services in detail

### 4.1 Vercel (hosting)

**What it is.** A hosting platform built for Next.js, the web framework this
application is written in. You give it a GitHub repository; it builds the code
and serves the resulting website on a global network. It replaces what would
traditionally be a web server you had to patch and maintain yourself.

**What it does here.**

- Serves the live application to parents and staff, at
  `jwf-bursary-system.vercel.app`.
- Rebuilds and redeploys automatically whenever code is merged. Merging to the
  `main` branch updates production; merging to `staging` updates the test site.
- Holds all configuration secrets (database passwords, API keys) as environment
  variables, kept separately for the live and test environments.
- Runs the **firewall** that rate limits sign in and password reset attempts,
  currently 5 attempts per 15 minutes per IP address.
- Runs two **scheduled jobs**: expiring old invitations daily at 02:00, and the
  data retention purge weekly on Sundays at 03:00.

**Where it runs.** Functions execute in Vercel's London region (`lhr1`).

**Where to find it.** <https://vercel.com/meridian-tech-group/jwf-bursary-system>

**Vendor documentation.**
[Overview](https://vercel.com/docs) ·
[Environment variables](https://vercel.com/docs/environment-variables) ·
[Deployments and rollback](https://vercel.com/docs/deployments) ·
[Firewall](https://vercel.com/docs/vercel-waf) ·
[Cron jobs](https://vercel.com/docs/cron-jobs)

---

### 4.2 Supabase (database, logins, document storage)

**What it is.** A managed platform built around a PostgreSQL database. Alongside
the database it provides two services this system relies on: an authentication
service that handles user accounts and passwords, and a file store for uploads.
Think of it as the system's single source of truth.

**What it does here.**

- **Database.** Every application, assessment, contact, invitation, audit log
  entry and configuration value. 38 tables.
- **Authentication.** All logins, for both parents and staff. It issues the
  session, handles password resets, and provides the two factor authentication
  (authenticator app codes) that staff accounts require in production.
- **Storage.** Every document a parent uploads, in a bucket named `documents`.
- **Row Level Security.** Database level rules that decide which rows each user
  may read. This is a genuine security boundary, not a convenience. A new table
  added without matching rules will silently return no data.

**There are two separate Supabase projects.** They share nothing.

| Project | Purpose | Project reference |
|---|---|---|
| `supabase-prod` | Live data, real applicants | `tdnojrqkbccikfipthmk` |
| `supabase-nonprod` | Staging and testing | `lmkmgoqezgeeyjodbvzn` |

**Data residency.** Both projects run in AWS `eu-west-2`, which is London. All
applicant data therefore stays in the United Kingdom.

**Backups.** The contract requires daily automated backups plus point in time
recovery with a window of at least 30 days, which the Supabase Pro tier
provides. Point in time recovery means the database can be restored to any
moment within that window, not just to the previous night. The current setting
is visible in the dashboard under **Database**, then **Backups**. The restore
procedure is in `docs/operations/backup-restore.md`.

**Where to find it.** <https://supabase.com/dashboard>

**Vendor documentation.**
[Overview](https://supabase.com/docs) ·
[Backups and point in time recovery](https://supabase.com/docs/guides/platform/backups) ·
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) ·
[Authentication](https://supabase.com/docs/guides/auth) ·
[Storage](https://supabase.com/docs/guides/storage)

---

### 4.3 Resend (email)

**What it is.** A service that sends automated email from an application and
reports what happened to each message (delivered, opened, bounced). It exists
because sending email directly from a web server results in most of it landing
in spam folders.

**What it does here.** Sends every automated message the system produces:
applicant invitations, submission confirmations, document request reminders,
password resets and outcome notices. The message templates are stored in the
database and are editable by administrators in the admin settings.

**Addresses.** Messages are sent from `bursary@updates.meridiantech.group`, a
domain verified in Resend for this purpose. Every message carries a reply to
header pointing at `fees@johnwhitgiftfoundation.org`, so when a parent replies
it reaches the Foundation's bursary inbox rather than the sending domain.

**One account, both environments.** Unusually, the live and test environments
share a single Resend account and API key. Only production has a webhook
registered, so delivery events are recorded for live mail only. This is
deliberate.

**Where to find it.** <https://resend.com/overview>

**Vendor documentation.**
[Overview](https://resend.com/docs/introduction) ·
[Domain verification and DNS](https://resend.com/docs/dashboard/domains/introduction) ·
[Webhooks](https://resend.com/docs/dashboard/webhooks/introduction)

---

### 4.4 Sentry (error monitoring)

**What it is.** A service that captures errors thrown by the application,
groups them, and alerts you. Without it, a parent hitting a broken page produces
no record anywhere.

**What it does here.** Captures both browser side and server side exceptions
from the live application, with the stack trace mapped back to the original
source code. It is the first place to look when a user reports that something
did not work.

Note that when the Sentry configuration is absent the monitoring silently does
nothing rather than failing. Local development and automated tests therefore
send no data.

**Project.** `bursary-system`.

**Where to find it.** <https://sentry.io>

**Vendor documentation.**
[Next.js integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/) ·
[Issue alerts](https://docs.sentry.io/product/alerts/)

---

### 4.5 GitHub (code and automation)

**What it is.** Where the source code lives, where changes are reviewed, and
where the automation that tests and releases those changes runs.

**What it does here.**

- **Repository.** `Meridian-Technology-Group/jwf-bursary-system`. Two permanent
  branches: `main` is production, `staging` is the test environment.
- **Automated checks.** On every proposed change, GitHub Actions installs the
  code, validates the database schema, runs the type checker and runs the test
  suite. A change that fails these should not be merged.
- **Database migrations.** This is the important one. When code is merged to
  `staging`, GitHub automatically applies any new database changes to
  `supabase-nonprod`. When code is merged to `main`, it applies them to
  `supabase-prod`. Database changes are not applied by Vercel and are not
  applied by hand.
- **Release notes.** The `CHANGELOG.md` file and version numbers are maintained
  automatically from commit messages.

**Where to find it.** <https://github.com/Meridian-Technology-Group/jwf-bursary-system>

**Vendor documentation.**
[GitHub Actions](https://docs.github.com/en/actions) ·
[Repository secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)

---

## 5. Services used without an account

These require no sign in, no key and no payment, but they are external
dependencies and are listed for completeness.

| Service | Purpose | Failure behaviour |
|---|---|---|
| [Have I Been Pwned](https://haveibeenpwned.com/API/v3#PwnedPasswords) | Checks new passwords against known breached password lists at registration and reset. Only the first five characters of a hash are sent, so the password itself never leaves the system. | Fails open. If the service is unreachable the password is accepted and the event is logged. Sign up is never blocked by an outage. |
| [npm registry](https://www.npmjs.com) | Source of the open source packages installed at build time. | A registry outage prevents new deployments but does not affect the running site. |
| [Node.js](https://nodejs.org) | The JavaScript runtime the application executes on. Version 22.12.0 is required. | Not applicable; it is bundled into the deployment. |

A full inventory of the 412 open source packages that ship in production, with
their licences, is in `docs/engineering/open-source-manifest.md`.

---

## 6. Two systems that sit alongside it

Neither is part of the application, but both come up when supporting it.

**Microsoft 365 / Exchange Online.** The Foundation's own mail system. Its Safe
Links feature opens every link in an arriving email in order to scan it, which
consumes single use links such as password resets and invitations. The
application is built to tolerate this: those links are only validated when the
form is submitted, never when the page loads. Worth knowing before diagnosing a
report that a link was already used.

**Symplectic Grant Tracker.** The legacy Digital Science platform the Foundation
used before this system, retiring on 31 December 2026. Historical bursary
records still live there.

---

## 7. The two environments

Everything above exists twice. Keeping them straight is the single most
important operational habit.

| | Production (live) | Staging (test) |
|---|---|---|
| Branch | `main` | `staging` |
| Web address | `jwf-bursary-system.vercel.app` | Fixed Vercel preview address |
| Database | `supabase-prod` | `supabase-nonprod` |
| Data | Real applicants, real financial information | Test data only |
| Staff two factor authentication | Enforced | Off, to keep testing simple |
| Email | Real addresses. Treat every send as if it reaches a parent. | Same Resend account, so the same caution applies |

Note the last row. Because both environments share one Resend account, a test
send from staging is a real email to a real inbox. There is no sandbox.

---

## 8. Where to go next

Operational runbooks, all under `docs/operations/`:

| Document | Covers |
|---|---|
| `deployment.md` | How a change reaches production, and how to roll one back |
| `environment-variables.md` | Every configuration value, where it lives, and which environment uses which |
| `backup-restore.md` | Backup policy and the restore procedure |
| `incident-response.md` | What to do when the system is broken |
| `hypercare.md` | The post launch support arrangement |
| `waf-auth-rate-limiting.md` | The sign in rate limiting rules |
| `resend-domain-setup.md` | Verifying an email sending domain |

User facing guides are under `docs/guides/`, and the documentation map is
`docs/README.md`.
