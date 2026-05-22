---
title: GDPR delete fails — app_user lacks UPDATE grant on audit_logs (whole cascade rolls back)
status: open
severity: high
area: rls
opened: 2026-05-22
opened_by: walkthrough-verification-pass
related:
  - docs/walkthroughs/admins/12-delete-applicant-gdpr.md
  - src/app/(admin)/applications/[id]/actions.ts
---

## Context

Verifying `admins/12-delete-applicant-gdpr`. Seeded a clean, eligible
throwaway applicant (`jwf-testing+gdpr-throwaway@…`, profile + COMPLETED
application `WS-202627-0009`, one section, no bursary account, no
documents) and back-dated `submitted_at` to 8 years ago so the 7-year
retention guard would not block it.

Ran the 2-step deletion flow in the admin UI (Delete (GDPR) → "Proceed
to Confirmation" → type DELETE → "Permanently Delete Data"). The dialog
returns the generic catch-all error:

> "Failed to perform GDPR deletion. Please try again."

Nothing is deleted or anonymised — verified by SQL the profile still has
its real name/email/role=APPLICANT, the application section count is
unchanged (1), `child_name` is unchanged, and the auth user still exists.
The whole `withAdminContext` cascade transaction rolled back atomically.

## Root cause

`gdprDeleteApplicantAction` (actions.ts) runs the cascade inside
`withAdminContext`, which only sets `request.jwt.claims.role =
'service_role'` via `SET LOCAL` so RLS *policies* treat the txn as a
bypass. But the underlying Postgres connection role stays **`app_user`**
(the runtime role per `prisma.ts`). Table-level GRANTs are separate from
RLS, and `app_user` has only `INSERT, SELECT` on `public.audit_logs` (no
`UPDATE`):

```
app_user      | INSERT
app_user      | SELECT
```

Step (h) of the cascade does
`tx.auditLog.updateMany({ where: { userId }, data: { userId: null } })`
to anonymise the audit trail (Art. 17). That `UPDATE audit_logs …`
throws `permission denied for table audit_logs`, which rolls back the
whole transaction and surfaces as the generic error.

Confirmation: running the identical cascade SQL directly via a
privileged role (MCP `execute_sql`, with `rollback`) succeeds with no
error — so the SQL is valid; only the *grant* under `app_user` is the
blocker. The audit-log INSERT-only design was deliberate, but the GDPR
anonymisation UPDATE was overlooked.

## Why it matters

GDPR right-to-erasure (admin/12) is **completely non-functional in
production** — the documented happy path always fails for an eligible
applicant. This is a legal/compliance obligation, not a nicety.

## Proposed approach

The cascade genuinely needs to UPDATE `audit_logs`. Options:

1. Grant `UPDATE` on `audit_logs` to `app_user` in a new migration, and
   keep the RLS update policy gated to `current_user_role() =
   'service_role'` so only the admin-context path can do it. (Mirrors how
   other service-role-only writes are handled.)
2. Run the GDPR cascade on a connection that actually authenticates as a
   higher-privileged Postgres role (separate Prisma datasource), rather
   than relying solely on the JWT-claim RLS bypass while staying
   `app_user`.

Option 1 is the smaller change and matches the existing pattern. Add a
regression test that exercises the full cascade.

## Out of scope

- Fixing the dialog copy mismatch vs the guide (separate doc note —
  guide says a single "I understand, delete" button / "Permanently
  Delete Applicant Data?" title; actual UI is a two-step "GDPR Data
  Deletion" → "Confirm Permanent Deletion" type-DELETE flow). The 2-step
  destructive behaviour the guide promises is present, just worded
  differently.
