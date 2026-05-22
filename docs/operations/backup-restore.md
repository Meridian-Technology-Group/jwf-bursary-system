# Backup & Restore

MSA Schedule 1 §4 deliverable and the NF-13 backup requirement. This runbook
explains how the database and document storage are backed up, how long backups
are kept, and exactly how to restore. It is written for an engineer with **no
prior Supabase experience**.

## Purpose

How database and storage backups are taken, retained, and restored.

---

## 1. Key terms (defined once)

- **Supabase** — the managed platform hosting this system's PostgreSQL
  database, Auth, and file Storage. Backups are a feature of the Supabase
  *project*, configured in its dashboard. There are two projects:
  `supabase-prod` (live) and `supabase-nonprod` (staging/testing).
- **PITR (Point-In-Time Recovery)** — the ability to restore the database to
  *any* moment within a retention window (e.g. "12:07 last Tuesday"), not just to
  a nightly snapshot. Supabase implements this by continuously archiving the
  database's write-ahead log.
- **RPO (Recovery Point Objective)** — how much data you can afford to lose,
  measured as the gap between the last recoverable point and the incident.
- **RTO (Recovery Time Objective)** — how long it should take to get back up
  and running after you decide to restore.
- **WAL (Write-Ahead Log)** — the stream of every change made to Postgres; PITR
  replays it to reconstruct any moment in time.

---

## 2. Backup policy (NF-13 / MSA clause 7.2)

The contract requires (MSA clause 7.2(c) and Schedule 4 §8): **daily automated
backups, with point-in-time recovery to a window of not less than thirty (30)
days.** This is delivered by running each Supabase project on the **Pro tier**.

| Capability | Provided by | Requirement | Notes |
|---|---|---|---|
| Daily automated backups | Supabase Pro | Daily | Nightly logical/physical snapshot, managed. |
| Point-in-time recovery (PITR) | Supabase Pro add-on | ≥ 30-day window | Restore to any second within the retained window. |
| Data residency | Supabase project region | UK/EEA | Confirm region is UK/EEA (MSA clause 14.5). |

> ⚠️ **Confirm before sign-off.** The codebase cannot prove the tier — it is a
> dashboard/billing setting. An operator must verify, **on `supabase-prod`**,
> that the Pro tier is active and that PITR retention is set to **≥ 30 days**.
> Steps:
> 1. Supabase dashboard → select the **`supabase-prod`** project.
> 2. **Database** → **Backups**.
> 3. Confirm a daily backup schedule is shown and that **Point in Time Recovery**
>    is enabled with a retention of **30 days or more**.
> 4. Repeat the check on **`supabase-nonprod`** (drills run there; PITR must be
>    enabled there too for a realistic drill).
>
> 📷 *Screenshot: Supabase → Database → Backups page for `supabase-prod`, showing the daily backup schedule and the PITR window set to ≥ 30 days.*

If PITR is not enabled or retention is below 30 days, enable it: **Database →
Backups → Point in Time Recovery → enable / increase retention** (this is a paid
add-on and may take time to build up a full window). Treat a sub-30-day window
as a contractual gap to remediate before go-live.

---

## 3. Storage (the documents bucket)

Uploaded documents live in a **private Supabase Storage bucket** named
`documents` (see `src/lib/storage/documents.ts`; bucket name is overridable via
`SUPABASE_STORAGE_BUCKET`, default `"documents"`). Access is always via
short-lived signed URLs — the bucket is not public.

**Important distinction:** PITR covers the **PostgreSQL database**, not the
Storage object store in the same way. The database holds the *metadata* about
each document (the row in the `documents` table, including its `storagePath`); the
*file bytes* live in Storage. A PITR restore brings back the metadata rows, but
**it does not, on its own, roll Storage objects back to that timestamp.**

Operational consequences:

- **Deleting a document row** via PITR-reachable history is recoverable; the file
  in Storage is a separate object and is only recoverable if it was not also
  hard-deleted from the bucket.
- A restore to an *earlier* point can therefore leave metadata referring to files
  that were later deleted from Storage, or files in Storage with no metadata row.
  After any restore, run the integrity check in §5.4.
- For defence-in-depth, schedule a periodic export of the `documents` bucket
  (Supabase dashboard → **Storage** → bucket → download, or the Supabase CLI /
  Management API) and keep it alongside DB backups. Track this as an enhancement
  if not yet automated.

> 📷 *Screenshot: Supabase → Storage → `documents` bucket, showing it is Private with signed-URL access.*

---

## 4. RPO / RTO statement

| Objective | Target | Basis |
|---|---|---|
| **RPO (max data loss)** | **≈ a few minutes** for the database | PITR replays WAL continuously, so the recoverable point is very close to the incident. Storage objects: RPO depends on the most recent bucket export (see §3). |
| **RTO (time to recover)** | **≤ 1 Business Day** for a Critical restore | Aligns with the MSA Schedule 3 Critical resolution/workaround target. A PITR restore itself typically completes in tens of minutes to a couple of hours depending on database size; the budget allows for decision-making, verification, and re-pointing the app. |

These targets sit inside the Schedule 3 Critical-severity envelope — see
[`incident-response.md`](incident-response.md) §2.

---

## 5. Restore procedure (step by step)

> **Decide first, then restore.** A restore overwrites data. Before starting:
> declare an incident (see [`incident-response.md`](incident-response.md)),
> identify the exact point in time to restore *to* (the last good moment, just
> before the corrupting event), and notify the Foundation contact. If only the
> app is broken (not the data), prefer a Vercel rollback —
> [`deployment.md`](deployment.md) §6.4 — and skip the database restore.

### 5.1 Quiesce writes

To avoid losing new data created after the restore point, stop new writes where
practical: put the app into a maintenance state, or pause the relevant round.
For a true data-corruption incident this also prevents the corruption spreading.

### 5.2 Run the PITR restore

1. Supabase dashboard → select the affected project (**`supabase-prod`** for a
   live incident; **`supabase-nonprod`** for a drill).
2. **Database** → **Backups** → **Point in Time Recovery** (or the **Restore**
   tab).
3. Choose the **target timestamp** — the last known-good moment, in the correct
   timezone (UK). Pick a point *before* the corrupting event.
4. Review the confirmation dialog carefully — it states the restore is
   destructive and irreversible for data after that point.
5. Confirm and start the restore. Supabase rebuilds the database to that moment.

> 📷 *Screenshot: Supabase → Database → Backups → Point in Time Recovery, with the date/time picker open and the confirmation dialog visible.*

### 5.3 Re-point and re-verify the application

1. If the restore produced a new database endpoint, update `DATABASE_URL` /
   `DIRECT_URL` in Vercel (and the GitHub `*_DATABASE_URL` / `*_DIRECT_URL`
   secrets), then **redeploy** — see
   [`environment-variables.md`](environment-variables.md) §4. (For an in-place
   PITR restore the connection strings usually do not change.)
2. Confirm the app starts and authentication works.

### 5.4 Verify integrity

After any restore, before reopening to users:

1. **Row counts / spot checks.** Confirm key tables (`profiles`,
   `applications`, `assessments`, `documents`, `bursary_accounts`) hold the
   expected data for the restored point.
2. **Migration consistency.** Confirm the Prisma migration history matches
   `prisma/migrations/` (Supabase → **Database** → **Migrations**). If the
   restore predates a migration the running code depends on, re-apply migrations
   via `db-push.yml` (see [`deployment.md`](deployment.md) §5).
3. **Storage ↔ metadata reconciliation.** For a sample of recent applications,
   confirm each `documents` row's `storagePath` resolves to a real object (open
   one via a signed URL) and that there are no obviously orphaned files. See §3.
4. **Key user flows.** Run a login + MFA, open an application, download a
   document, and save an assessment.
5. Record the outcome in the drill log (§6) or the incident review.

### 5.5 Reopen and communicate

Lift the maintenance state, confirm with the Foundation contact, and close the
incident with a post-incident review
([`incident-response.md`](incident-response.md) §6).

---

## 6. Restore-drill log

A restore drill is a rehearsal of §5 against **`supabase-nonprod`**. The MSA
documentation requirement (and the production-readiness assessment) call for at
least **one logged drill before go-live**. Log each drill here.

| Date | Environment | Restore-to point | Duration (start→verified) | Outcome | Operator | Notes |
|---|---|---|---|---|---|---|
| **PENDING** | nonprod | — | — | **PENDING — drill not yet executed; required evidence for sign-off** | — | Execute one PITR restore against `supabase-nonprod`, verify per §5.4, and record the result here before G4 sign-off. |

> Do not mark this complete until a real drill has run. The PENDING row is the
> outstanding sign-off item.
