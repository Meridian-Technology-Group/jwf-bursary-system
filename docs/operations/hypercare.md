# Hypercare Playbook

MSA clause 9.4 deliverable. This runbook sets out the cadence and routing for
the two-week intensive support period immediately after go-live. It is written
for an engineer with **no prior Supabase, Vercel or Sentry experience**.

## Purpose

The cadence and routing for the two-week intensive support period immediately
after go-live.

---

## 1. What hypercare is

**Hypercare** is a short, heightened-support window straight after a system goes
live, when problems are most likely to surface and the team watches the service
closely and responds fast.

Under **MSA clause 9.4**, during the Hypercare Period the Supplier provides
**priority response and daily check-ins** (by email or video call, as agreed) to
the Foundation's primary contact, **at no additional charge** (it is included in
the Build Fee). It is the final gate (G4) activity before moving to
business-as-usual (BAU) support.

---

## 2. The hypercare window

- **Duration:** the **two weeks immediately following Go-Live** (MSA clause 9.4
  and the definition of "Hypercare Period").
- **Go-Live:** the week commencing **22 June 2026** (MSA Schedule 1, Gate G4).
- **Exact start/end dates:** **confirm at go-live.** The window begins on the
  actual cutover date and runs 14 calendar days. Record the confirmed dates
  here:

  | | Date (confirm at go-live) |
  |---|---|
  | Go-Live / hypercare start | `___` (w/c 22 June 2026) |
  | Hypercare end (start + 14 days) | `___` |

During hypercare (and during the annual application round), **surge cover**
applies — response is not limited to standard Business Hours in the way the
Schedule 3 SLAs otherwise are (MSA Schedule 6).

---

## 3. Daily check-in

A short daily check-in runs every Business Day of the window.

- **Format:** email or video call, as agreed with the Foundation primary
  contact (clause 9.4).
- **Attendees:** the Supplier's primary on-call engineer and the Foundation
  primary contact (escalation roles per
  [`incident-response.md`](incident-response.md) §4 join as needed).
- **What is reviewed each day:**
  1. **Error rates / health** — **Sentry** is the primary signal: review the
     new-issue count and the error rate for the last 24 hours (and any alerts
     that fired). Cross-check with Vercel and Supabase logs. See
     [`incident-response.md`](incident-response.md) §3.
  2. **Support tickets** — new and open Zoho Desk tickets, with severity and SLA
     status (Schedule 3).
  3. **Key user flows confirmed working:**
     - Login + staff **MFA** (aal2 enrol/challenge),
     - Application **submit** (applicant),
     - **Document upload** (and signed-URL download),
     - **Assessment save** (assessor),
     - **Email delivery** (invitation / reset / notification, via Resend).
  4. **Yesterday's actions** — follow-ups closed or carried over.

> 📷 *Screenshot: Zoho Desk ticket list filtered to open tickets, used in the daily check-in.*

---

## 4. Triage & routing during hypercare

Any issue raised in a check-in or via a ticket is handled through the standard
incident process — hypercare changes the *attention and cadence*, not the
method:

1. Raise / confirm a **Zoho Desk** ticket.
2. Classify severity against **MSA Schedule 3** and follow the triage runbook in
   [`incident-response.md`](incident-response.md) (auth/MFA, DB, email, storage).
3. Use the rollback / restore procedures as needed:
   [`deployment.md`](deployment.md) §6.4 (Vercel rollback) and
   [`backup-restore.md`](backup-restore.md) (PITR restore).
4. Communicate per [`incident-response.md`](incident-response.md) §5; raise the
   item at the next daily check-in regardless of severity.

---

## 5. Daily hypercare log

Fill in one row per Business Day for the duration of the window. Keep this log
as the clause 9.4 evidence of daily check-ins.

| Date | Checks performed | Issues raised (ticket / severity) | Status | Actions / owner |
|---|---|---|---|---|
| `___` | Error rates · tickets · login/MFA · submit · upload · assessment save · email | `___` | Green / Amber / Red | `___` |
| `___` |  |  |  |  |
| `___` |  |  |  |  |
| `___` |  |  |  |  |
| `___` |  |  |  |  |
| `___` |  |  |  |  |
| `___` |  |  |  |  |
| `___` |  |  |  |  |
| `___` |  |  |  |  |
| `___` |  |  |  |  |

(Add rows as needed to cover all 14 days. "Status" = overall day rating.)

---

## 6. Exit criteria — moving from hypercare to BAU

At the end of the two-week window, confirm all of the following before standing
down to business-as-usual support. If any is unmet, agree with the Foundation
whether to extend hypercare or track the item as a normal ticket.

- [ ] The full two-week window has elapsed (or an earlier exit is agreed in
      writing with the Foundation).
- [ ] **No open Critical incidents**, and no High incidents outside their
      Schedule 3 resolution target.
- [ ] All five key flows (§3) verified working in production for several
      consecutive days: login/MFA, application submit, document upload,
      assessment save, email delivery.
- [ ] Error rates are stable — **Sentry** shows no recurring unhandled errors and
      no unexplained spikes, corroborated by Vercel/Supabase logs.
- [ ] The daily log (§5) is complete and any follow-up actions have owners and
      due dates.
- [ ] Backup posture confirmed: daily backups + PITR ≥ 30 days active on
      `supabase-prod`, and the restore drill is logged
      ([`backup-restore.md`](backup-restore.md) §6).
- [ ] Escalation/on-call contacts and the Foundation contact are finalised in
      [`incident-response.md`](incident-response.md) §4.

On exit, support transitions to the standard **Schedule 3 SLAs** (Business
Hours, with surge cover during the annual application round) and the standard
incident process in [`incident-response.md`](incident-response.md).
