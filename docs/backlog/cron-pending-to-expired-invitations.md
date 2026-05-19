---
title: Cron job to expire PENDING invitations after expiresAt
status: open
severity: low
area: invitations
opened: 2026-05-13
opened_by: Claude (via Brian Wagner)
related:
  - docs/planning/APPLICANT_INVITATION_FLOW.md §7
  - prisma/schema.prisma (Invitation model)
---

## Context

Plan §7 lists this as an explicit follow-up. Invitations carry an
`expiresAt` (default: 30 days). The acceptance flow already refuses
expired tokens, but the `status` column never auto-transitions from
`PENDING` to `EXPIRED`, so the admin Invitations page shows stale
PENDING rows indefinitely. Same gap exists in the staff flow.

## Why it matters

- Operationally noisy — admins can't filter the list to "actually
  outstanding" invitations without manually checking each `expiresAt`.
- A future Resend-based "nag" feature can't target real outstanding
  invitations without doing the same date math at query time.

## Proposed approach

Either:

1. **Vercel Cron** — `app/api/cron/expire-invitations/route.ts` runs
   nightly, updates `WHERE status = 'PENDING' AND expiresAt < now()`
   to `status = 'EXPIRED'`. Audit-log each transition with the cron
   user. Cover both `Invitation` and `StaffInvitation`.
2. **Supabase pg_cron** — same SQL on a nightly schedule, kept
   entirely inside the DB. Simpler ops, but harder to audit and
   harder to observe failures.

Recommend Vercel Cron — it shares the same logging path as the rest
of the app.

## Out of scope

Sending reminder emails before expiry. Separate backlog item if it
becomes a real ask.
