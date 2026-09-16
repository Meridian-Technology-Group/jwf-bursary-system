# 12. Rollback and Recovery

This guide covers undoing a bad release, taking the site offline, and restoring
the database.

---

## 1. Choose the procedure

| Situation | Procedure |
|---|---|
| A release broke the site, and data is intact | Section 2: roll back the website |
| The site must stop serving users immediately, for example during a suspected data breach | Section 3: take the site offline |
| Data has been wrongly changed or deleted on a large scale | Section 4: restore the database |
| A few records were wrongly changed or deleted | Section 5: recover specific records |

Always roll back the website before considering a database restore. Most
problems after a release are in the code, not the data.

---

## 2. Roll back the website

Vercel keeps every previous deployment. Rolling back switches Production to an
earlier deployment in seconds, without rebuilding.

1. Open the Vercel project, **Deployments**, and filter the branch to `main`.
2. Find the last Production deployment that worked. The rows show the commit
   message and time of each deployment.
3. Open its **⋮** menu and choose **Instant Rollback**.
4. Check the deployment shown, click **Continue**, then **Confirm Rollback**.
5. Open <https://jwf-bursary-system.vercel.app/api/version> and confirm
   `commitShaShort` matches the deployment rolled back to.

While Production is rolled back, new merges to `main` build but do not go live.
To return to normal:

1. Fix the fault with a hotfix
   ([05. Making and Releasing Changes](05-making-and-releasing-changes.md),
   section 7) and wait for its deployment to show **Ready**.
2. On the Vercel project overview page, click **Undo Rollback** on the
   Production deployment panel.
3. Select the fixed deployment and click **Confirm**.

New merges to `main` go live automatically again from this point.

A rollback changes the code only. Database migrations from the rolled back
release remain applied. Because migrations only add to the database, the
earlier code continues to work.

Vendor documentation: [Instant Rollback](https://vercel.com/docs/instant-rollback) ·
[Promoting a deployment](https://vercel.com/docs/deployments/promoting-a-deployment)

---

## 3. Take the site offline

1. Open the Vercel project, **Settings**, **General**.
2. In the **Pause Project** section, click **Pause Project**.
3. Type the project name to confirm, then click **Pause Project**.

Every visitor to Production receives a `503 DEPLOYMENT_PAUSED` error page. No
requests reach the application.

To bring the site back, open the same page and click **Resume Project**. The
site returns within a few minutes without a redeployment.

Vendor documentation: [Pausing a project](https://vercel.com/docs/projects/managing-projects#pausing-a-project)

---

## 4. Restore the database

A restore returns the whole database to a chosen moment. **Every change made
after that moment is lost**: new applications, saved assessments, uploaded
document records, staff actions and audit log entries.

Uploaded files in Storage are not restored. A document deleted after the
chosen moment has its database record restored but its file remains deleted.

### 4.1 Before restoring

1. Take the site offline (section 3), so no new data is written during the
   restore.
2. Find the moment to restore to: the last moment before the damage. Use the
   admin console **Audit** page or the Vercel logs to find when the damaging
   action happened, and choose a moment one minute before it.
3. Record the chosen moment in UTC. Times during British Summer Time are one
   hour ahead of UTC.

### 4.2 Restore

1. Open `supabase-prod`, **Database**, **Backups**, **Point in Time**.
2. Click **Start a restore**.
3. Choose the date and time recorded in section 4.1.
4. Review the summary, confirm the project name is `supabase-prod`, and
   confirm the restore.
5. The project is unavailable until the restore completes. The larger the
   database, the longer this takes.

### 4.3 After restoring

1. In the SQL Editor, check the migrations:
   ```sql
   SELECT migration_name
   FROM _prisma_migrations
   ORDER BY started_at DESC
   LIMIT 1;
   ```
   The result must match the newest folder in `prisma/migrations/` on the `main`
   branch. If it is older, open GitHub, **Actions**, **DB push**, **Run
   workflow**, choose branch `main` and target `production`, and run it.
2. Resume the site (section 3).
3. Sign in to Production. Open an application, open one of its documents, and
   open its assessment.
4. Tell the Foundation's bursary team the moment the data was restored to, so
   that work done after it can be repeated.

Vendor documentation: [Point in time recovery](https://supabase.com/docs/guides/platform/backups#point-in-time-recovery)

---

## 5. Recover specific records

Restoring the whole database for a few records loses every other change made
since. Instead, restore a copy to a separate project and copy the records back.

1. Open `supabase-prod`, **Database**, **Backups**, and choose **Restore to a
   new project**. Choose the moment before the records were changed, and a
   name such as `supabase-prod-recovery`.
2. When the new project is ready, open its SQL Editor and find the records, for
   example:
   ```sql
   SELECT * FROM applications WHERE reference = '<application reference>';
   ```
3. Compare the records with the same records in `supabase-prod`, and correct
   `supabase-prod` through the admin console wherever the console allows it.
4. Delete the recovery project once the records are recovered: its
   **Project Settings**, **General**, **Delete project**. It holds a full copy
   of Production data.

Vendor documentation: [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
