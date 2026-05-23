# Incident Response

MSA Schedule 1 §4 deliverable, with severity classes mapped to the MSA
Schedule 3 Service Levels. This runbook explains how production incidents are
detected, classified, communicated, and resolved. It is written for an engineer
with **no prior Supabase, Vercel or Sentry experience**.

## Purpose

How production incidents are detected, classified, communicated, and resolved.

---

## 1. Platforms you will use during an incident

- **Vercel** — hosts the Next.js app and serves it. During an incident you use
  it to read deployment status, runtime logs, and to **roll back** to a previous
  build. (Vercel = the managed web host; there is no server to SSH into.)
- **Supabase** — the managed PostgreSQL database, Auth, and Storage. You use its
  **Logs** to investigate database, auth, and storage errors, and its **Backups**
  for restores.
- **Sentry** — the runtime error-capture and alerting service, and the
  **primary detection mechanism** for this system. It captures unhandled
  exceptions automatically and alerts the on-call on new issues and error-rate
  spikes — see §3.1. Vercel and Supabase logs are complementary detail sources.
- **Resend** — the transactional-email provider; used to investigate email
  delivery failures.
- **Zoho Desk** — the support ticketing platform (MSA Schedule 1 §1). Every
  incident is tracked as a ticket here (§7).

---

## 2. Severity classification (MSA Schedule 3)

Tickets are triaged into one of four severity levels. **Response and resolution
times are measured during Business Hours: Monday–Friday, 09:00–17:30 UK time**
(except during the Hypercare Period and the annual application round, when surge
cover applies — see [`hypercare.md`](hypercare.md)).

| Severity | Definition (examples) | Initial response | Target resolution / workaround |
|---|---|---|---|
| **Critical** | Platform unavailable, or a major function inoperable with no workaround, during an active application round — e.g. system down; assessors cannot access applications; the calculation engine produces incorrect results. | **4 Business Hours** | **1 Business Day** |
| **High** | A major feature is broken with no easy workaround — e.g. a report fails to generate; document upload fails for a class of file types. | **1 Business Day** | **3 Business Days** |
| **Medium** | Minor bug or cosmetic issue with a workaround — e.g. a display issue on a non-critical page; a labelling inconsistency. | **2 Business Days** | Next maintenance cycle |
| **Low** | Questions, suggestions, enhancement requests — e.g. "Can we add a column to this report?" | **5 Business Days** | Reviewed at the next quarterly review (clause 9.6) |

**Service credits.** If a **Critical** response time is missed on three or more
occasions in any rolling three-month period, the Foundation is entitled to a
service credit of 2.5% of the Annual Licence Fee for each failure beyond the
first two, capped per clause 10.3 (MSA Schedule 3 §1).

---

## 3. Detection & monitoring

Sentry is the primary detection channel and the usual starting point; Vercel and
Supabase logs add deployment- and database-level detail once an issue is open.

### 3.1 Sentry (primary)

Sentry is configured via `@sentry/nextjs`, with the DSN set in the Vercel
environment variables (see [`environment-variables.md`](environment-variables.md)
and [`deployment.md`](deployment.md)). Unhandled exceptions in the running app —
server, Edge, and browser — are captured automatically and grouped into
**issues**. Alert rules notify the on-call on a new issue and on an error-rate
spike, routed to email/Zoho Desk.

When an alert fires (or to investigate proactively):

1. Sentry dashboard → the bursary project → **Issues**. Each issue shows the
   error, the number of events, when it was first/last seen, the release, and the
   number of affected users.
2. Open the issue to read the **stack trace** (source maps are uploaded at build
   time, so traces map to the original TypeScript), the request context, and
   breadcrumbs leading up to the error.
3. Note the **release** the issue appears in — this tells you whether a recent
   deploy introduced it and whether a Vercel rollback ([`deployment.md`](deployment.md)
   §6.4) is the fastest fix.
4. **Triage severity from the Sentry signal → MSA Schedule 3 (§2):** a spike of
   errors blocking a core flow during a round (login/MFA, application submit,
   assessment save) is **Critical**; a new issue breaking one feature with no
   easy workaround is **High**; a low-volume, non-blocking issue is **Medium**.
   Use the affected-user count and event rate to judge blast radius.

> 📷 *Screenshot: Sentry → Issues list for the bursary project, showing event counts, affected users and the release tag.*

> 📷 *Screenshot: Sentry → a single Issue detail page with the resolved stack trace and request context.*

### 3.2 Vercel

1. Vercel dashboard → the bursary project → **Deployments** to confirm the
   current Production build is healthy and identify the last good one.
2. **Logs** (or **Observability → Logs**) for runtime/function errors,
   status-code spikes, and request volume.

> 📷 *Screenshot: Vercel → project → Logs view filtered to 5xx responses on the Production deployment.*

### 3.3 Supabase

1. Supabase dashboard → select **`supabase-prod`** → **Logs**.
2. Inspect the relevant log source: **Postgres / Database** (query errors,
   connection saturation), **Auth** (login/MFA failures), **Storage** (upload /
   signed-URL errors).
3. **Database → Database health / Reports** for connection-pool exhaustion and
   CPU.

> 📷 *Screenshot: Supabase → `supabase-prod` → Logs, with the Postgres log source selected.*

Engineering tooling note: the same logs are reachable programmatically (the
Supabase MCP `get_logs` tool against the `supabase-prod` project), and
`get_advisors` surfaces security/performance advisories — useful during triage.

### 3.4 Reproduce & confirm

Confirm the incident from a clean session against the live URL before declaring
severity. Note the time window — you will need it for any PITR restore
([`backup-restore.md`](backup-restore.md)) — and cross-reference the Sentry issue
(§3.1) and Vercel/Supabase logs for the same window.

### 3.5 Sentry alert rules (as configured)

The Sentry project hosts the alert rules that drive on-call notification:

- an **issue alert** that fires when a new unhandled error appears, and
- a **metric alert** that fires on an error-rate spike,

both routed to email and Zoho Desk. To review or adjust them: Sentry → the
bursary project → **Alerts**. The Sentry project uses EU data residency
(MSA Schedule 5).

> 📷 *Screenshot: Sentry → Alerts, showing the new-issue and error-rate-spike rules and their notification targets.*

---

## 4. Escalation tree / on-call (fill in at go-live)

Use role placeholders; replace with names/contacts before go-live. Do not invent
contacts.

| Role | Contact | Responsibility |
|---|---|---|
| **Primary on-call (engineer)** | `___` | First responder; triage, fix or roll back, owns the ticket. |
| **Secondary / backup engineer** | `___` | Cover for leave/surge (MSA Schedule 6 bench cover). Engaged if primary unreachable within the response target. |
| **Engineering lead / escalation** | `___` | Decision authority on production restore and `staging → main` promotions; Foundation liaison for Critical incidents. |
| **Foundation primary contact** | `___` (JWF) | The Customer's named contact; receives status updates (§5). |
| **Data-protection contact** | `___` | Engaged for any personal-data incident (UK GDPR / MSA Schedule 4 breach-notification path). |

Escalation: if the response target for the severity is at risk of being missed,
escalate Primary → Secondary → Engineering lead.

---

## 5. Communication

- **Channel of record:** Zoho Desk ticket (§7). All updates, SLA timers and the
  resolution are recorded there (MSA Schedule 6).
- **Who is notified:** the Foundation primary contact for any **Critical** or
  **High** incident; the data-protection contact additionally for any suspected
  personal-data breach.
- **Cadence:** for a Critical incident, send an initial acknowledgement within
  the Schedule 3 response target, then updates at least **every 2–4 hours** until
  resolved or a workaround is in place; a closing summary at resolution. For
  High, a daily update until resolved.
- **Personal-data breach:** if personal data may be affected, follow the
  Schedule 4 breach-notification obligations — notify the Foundation **without
  undue delay** and assist with any regulator notification.

---

## 6. Triage runbook by failure class

For every class: confirm the symptom (§3.3), open/raise the Zoho Desk ticket,
set severity (§2), then work the first checks below.

### 6.1 Auth / MFA lockout

- **Symptom:** staff cannot log in, or are stuck in an MFA loop on `/admin/*`.
- First checks:
  1. Supabase → `supabase-prod` → **Auth → Logs** for failed sign-ins / token
     errors.
  2. Confirm `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the
     **Production** scope point at `supabase-prod`.
  3. MFA loop: the aal2 gate is `STAFF_MFA_ENFORCED` (defaults on in prod). As an
     emergency kill-switch, set `STAFF_MFA_ENFORCED=false` in the Production scope
     and redeploy — see `src/lib/auth/mfa-flag.ts` and
     [`environment-variables.md`](environment-variables.md). Treat disabling MFA
     as a temporary, logged measure; re-enable once the user can enrol.
  4. A single locked-out staff member: re-issue/reset their TOTP factor via
     Supabase → Auth → Users.

### 6.2 Database / connection

- **Symptom:** 5xx errors, Prisma connection errors, slow or timing-out queries.
- First checks:
  1. Supabase → `supabase-prod` → **Logs (Postgres)** and **Database health** for
     connection-pool exhaustion or CPU saturation.
  2. Confirm `DATABASE_URL` uses the **transaction pooler (6543)** and
     `DIRECT_URL` the **session pooler (5432)** — see
     [`environment-variables.md`](environment-variables.md).
  3. If a recent migration is implicated, confirm migration history matches
     `prisma/migrations/` ([`deployment.md`](deployment.md) §5).
  4. Data corruption / accidental mass change → restore per
     [`backup-restore.md`](backup-restore.md). Quiesce writes first.
  5. If a recent *deploy* is implicated → roll back the app
     ([`deployment.md`](deployment.md) §6.4).

### 6.3 Email delivery

- **Symptom:** invitation / reset / notification emails not arriving.
- First checks:
  1. Resend dashboard → **Logs / Emails** for the message status (delivered,
     bounced, blocked).
  2. Confirm the sending **domain is verified** in Resend and `RESEND_FROM_EMAIL`
     uses that domain; an unverified domain blocks delivery.
  3. Confirm `RESEND_API_KEY` is set in the right scope (the app throws at
     startup if missing).
  4. Webhook events not recording → confirm `RESEND_WEBHOOK_SECRET` is set; the
     `/api/webhooks/resend` handler rejects unsigned events.

> 📷 *Screenshot: Resend → Emails log showing per-message delivery status.*

### 6.4 Storage / document access

- **Symptom:** uploads fail, or document previews/downloads 403/404.
- First checks:
  1. Supabase → `supabase-prod` → **Storage** → confirm the `documents` bucket
     exists and is **Private**.
  2. Supabase → **Logs (Storage)** for signed-URL or permission errors.
  3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in the **Production** scope
     (server-only) — the storage helpers use the admin client. Never expose it
     client-side ([`environment-variables.md`](environment-variables.md) §5).
  4. Signed URLs expire after ~60 minutes by design — a stale link 403 is
     expected; re-issue rather than treating as an incident.

### 6.5 Rate-limiter behaviour

- **Symptom:** legitimate users throttled, or brute-force not being throttled.
- First checks: confirm `KV_REST_API_URL` / `KV_REST_API_TOKEN` are set in
  Production. If unset, the limiter **fails open** (disabled) — set them and
  redeploy (`src/lib/rate-limit.ts`).

---

## 7. Ticketing & routing (Zoho Desk)

- All incidents and support requests are tracked in **Zoho Desk** (MSA
  Schedule 1 §1, Schedule 6). The dedicated support email address auto-creates a
  ticket.
- On raising/triaging: set the **severity** (§2) so the SLA timer is correct;
  record detection source, timeline, and the Foundation-facing updates on the
  ticket.
- The ticket is the system of record for SLA compliance and the post-incident
  review.

---

## 8. Post-incident review template

Complete within 5 Business Days of resolving any Critical or High incident, and
attach to the Zoho Desk ticket.

```
# Post-Incident Review — <short title>

- Ticket ID (Zoho Desk):
- Severity (Schedule 3):
- Date/time detected (UK):
- Date/time resolved (UK):
- Response target met? (Y/N)        Resolution target met? (Y/N)

## Impact
- Who/what was affected, for how long, during a round? (Y/N)
- Personal data involved? (Y/N — if Y, Schedule 4 path followed?)

## Timeline
- HH:MM  detected via <Vercel/Supabase/Sentry/report>
- HH:MM  ...
- HH:MM  resolved

## Root cause
-

## Resolution / workaround
- (e.g. Vercel rollback to <deployment>; PITR restore to <timestamp>; env fix)

## Follow-up actions (owner, due date)
- [ ]
- [ ]

## Lessons / prevention
-
```
