# 08. Routine Health Checks

This guide is a checklist for confirming that Production is healthy. Each check
states where to look, what healthy looks like, and what to do otherwise.

- **Weekly:** sections 1 to 5.
- **Monthly:** sections 6 to 8.
- **After every release:** sections 1 and 2, and
  [05. Making and Releasing Changes](05-making-and-releasing-changes.md),
  section 6.

---

## 1. Errors (Sentry)

1. Open Sentry, **Issues**.
2. Set the project to `bursary-system`, the environment to `production`, and
   the time range to **Last 7 days**.

**Healthy:** no new unresolved issues.

**Otherwise:** open each new issue. The issue page shows the error message, the
page or server function where it occurred, the number of users affected, and a
stack trace pointing to the line of code.

- A known, harmless error, such as a browser extension interfering with the
  page: **Ignore** or **Archive** it.
- An error already fixed by a released change: **Resolve** it.
- A real fault: fix it through
  [05. Making and Releasing Changes](05-making-and-releasing-changes.md), then
  **Resolve** it once the fix is released.

Vendor documentation: [Issues](https://docs.sentry.io/product/issues/) ·
[Issue details](https://docs.sentry.io/product/issues/issue-details/)

---

## 2. Deployment and server logs (Vercel)

1. Open the Vercel project, **Deployments**.
2. The most recent row marked **Production** has status **Ready**.
3. Open the **Logs** tab. Filter **Environment** to **Production** and
   **Level** to **Error**.

**Healthy:** the Production deployment is **Ready**, and the error log holds no
repeated errors.

**Otherwise:** a deployment marked **Error** has not replaced the working
version; the previous deployment continues to serve the site. Open the failed
deployment and read **Build Logs** to find the cause. For repeated runtime
errors, click an entry to see its request path and message, and look for the
same error in Sentry.

Vercel keeps runtime logs for a limited period. Sentry is the long term record
of errors.

Vendor documentation: [Runtime logs](https://vercel.com/docs/logs/runtime) ·
[Build logs](https://vercel.com/docs/deployments/logs)

---

## 3. Scheduled jobs

Follow [09. Scheduled Jobs](09-scheduled-jobs.md), section 3.

**Healthy:** each job has run on schedule and returned status `200`.

---

## 4. Email delivery

1. Admin console, **Sent Emails**. Scan the **Status** column.
2. Resend, **Emails**. Filter to the last 7 days and scan the status column.

**Healthy:** statuses are `SENT` in the admin console, and `Delivered` in
Resend.

**Otherwise:** follow [10. Email](10-email.md), section 4.

---

## 5. Database advisors (Supabase)

1. Open `supabase-prod`, **Advisors**, **Security Advisor**.
2. Then **Advisors**, **Performance Advisor**.

**Healthy:**

- no items at level **ERROR** on either page
- the **RLS Enabled No Policy** item lists only the table `_prisma_migrations`,
  which the application never reads

**Otherwise:**

- **RLS Enabled No Policy** naming any other table means that table returns no
  data to the application. Fix it with a migration as described in
  [06. Database Changes and Reference Data](06-database-changes-and-reference-data.md),
  section 4.3.
- An **ERROR** item links to an explanation and a suggested fix. Fix it through
  [05. Making and Releasing Changes](05-making-and-releasing-changes.md).
- Items at level **WARN** and **INFO** are reviewed at the next planned change.

Vendor documentation: [Database advisors](https://supabase.com/docs/guides/database/database-advisors)

---

## 6. Backups (Supabase)

1. Open `supabase-prod`, **Database**, **Backups**.
2. Check **Point in time** recovery is enabled and shows a recoverable range
   ending within the last few minutes.

**Healthy:** recovery is available up to the present moment.

Vendor documentation: [Backups](https://supabase.com/docs/guides/platform/backups)

---

## 7. Capacity (Supabase)

1. Open `supabase-prod`, **Reports**, **Database**, and note the database size.
2. Open **Storage** and note the size of the `documents` bucket.

**Healthy:** both sizes are well within the limits shown on the organisation's
**Usage** page.

Vendor documentation: [Usage](https://supabase.com/docs/guides/platform/manage-your-usage)

---

## 8. Staff accounts

1. Admin console, **Users**.
2. Check every account under **Staff Users** belongs to someone who still needs
   access, with the correct role.
3. Check **Pending Staff Invitations** holds no invitations that should be
   revoked.

**Otherwise:** follow [07. Staff User Management](07-staff-user-management.md).
