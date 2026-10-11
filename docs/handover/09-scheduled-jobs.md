# 09. Scheduled Jobs

The system runs two jobs on a schedule. Vercel starts each job by calling an
address in the application at the scheduled time. The schedule is defined in
`vercel.json` in the repository.

Scheduled jobs run in Production only. Vercel does not run them for Staging.

---

## 1. The jobs

**Expire invitations**, at `/api/cron/expire-invitations`, runs every day at
02:00. It marks applicant and staff invitations whose link has passed its
expiry date as **Expired**, so they no longer show as pending in the admin
console. It writes one audit log entry on any run that expired at least one
invitation.

**Purge expired data**, at `/api/cron/purge-expired`, runs every Sunday at
03:00. It finds applications whose retention period has passed and, when
deletion is enabled, permanently deletes them and their documents. It processes
at most 100 applications per run.

Times are in UTC. During British Summer Time they run one hour later in UK
time.

---

## 2. How the jobs are protected

Each job checks that the request carries the value of the `CRON_SECRET`
environment variable. Vercel adds it automatically. A request without it
receives status `401 Unauthorized` and the job does nothing. When `CRON_SECRET`
is not set in the Production scope, every run is refused.

See [03. Environment Variables](03-environment-variables.md), section 3.5.

---

## 3. Confirm the jobs ran

1. Open the Vercel project, **Settings**, **Cron Jobs**.
2. Both jobs are listed with their schedules. Click **View Logs** on a job.
3. The log shows each run with its status code.

- **`200`** means the job ran successfully. No action needed.
- **`401`** means `CRON_SECRET` is missing or wrong. Set it in the Production
  scope and redeploy.
- **`500`** means the job failed. Open the log entry to read the error, and
  look for the same error in Sentry.

Vendor documentation: [Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

---

## 4. Run a job immediately

This uses the Vercel command line tool, installed in
[04. Local Development](04-local-development.md), section 1.

1. From the `jwf-bursary-system` folder, connect the folder to the Vercel
   project. This is needed once per computer.
   ```
   vercel login
   vercel link --scope john-whitgift-foundation --project jwf-bursary-system
   ```
2. Run the job:
   ```
   vercel crons run /api/cron/expire-invitations
   ```
   or
   ```
   vercel crons run /api/cron/purge-expired
   ```
3. Confirm the run in **View Logs** as in section 3.

Running a job outside its schedule is safe. Each job only acts on records that
are due.

Vendor documentation: [vercel crons](https://vercel.com/docs/cli/crons)

---

## 5. Data retention

### 5.1 Retention periods

An application becomes due for deletion when its retention period has passed.

- **Assessed as not qualifying:** kept 30 days from the date it was archived.
  Set by `RETENTION_DECLINED_GRACE_DAYS`.
- **Closed without an outcome:** kept 30 days from the date it was closed. Set
  by `RETENTION_CLOSED_GRACE_DAYS`.
- **Qualified but not awarded:** kept 6 years from the date it was submitted.
  Set by `RETENTION_QUALIFIES_NOT_AWARDED_YEARS`.
- **Awarded:** kept 7 years from the date the bursary account was closed. Set
  by `RETENTION_AWARDED_YEARS`.
- **Still in progress:** kept indefinitely.

Setting a variable replaces the period shown.

### 5.2 Report only mode

Deletion is off unless `RETENTION_PURGE_ENABLED` is set to `true` in the
Production scope. While it is off, the job lists in its log how many
applications it would delete under each outcome, and their reference numbers,
and deletes nothing.

To see what the job would delete, open its **View Logs** (section 3) and read
the line beginning `[cron/purge-expired] DRY-RUN`.

### 5.3 Turn deletion on

Deletion is permanent. Deleted applications and documents cannot be recovered
except by restoring the whole database.

1. Read the most recent report only log (section 5.2) and confirm every listed
   application is due for deletion.
2. Confirm the retention periods in section 5.1 are the periods the Foundation
   has approved. Set any variable whose approved value differs from the default.
3. In the Vercel Production scope, add `RETENTION_PURGE_ENABLED` with value
   `true`, and redeploy. See [03. Environment Variables](03-environment-variables.md),
   section 5.1.
4. After the next Sunday run, open **View Logs** and confirm status `200`.
5. In the admin console, **Audit**, confirm an entry with action
   `RETENTION_PURGE_CRON` recording the number of applications deleted. No
   entry is written when nothing was due.

To turn deletion off, delete `RETENTION_PURGE_ENABLED` from the Production
scope and redeploy.
