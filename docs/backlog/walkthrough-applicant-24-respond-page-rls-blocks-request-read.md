---
title: Applicant /respond page can't read the missing-docs request (audit_logs RLS)
status: closed
severity: high
area: rls
opened: 2026-05-22
opened_by: walkthrough-verification (pass 7)
closed: 2026-05-22
closed_by: PR #52 (read missing-docs request via admin context after ownership check)
related:
  - PR #51 (in-portal respond-to-missing-docs page)
  - PR #52 (fix: read missing-docs request via admin context after ownership check)
  - src/app/(portal)/respond/page.tsx
  - src/lib/db/queries/missing-docs.ts
  - prisma/migrations/20260520120000_fix_audit_logs_applicant_rls/migration.sql
  - docs/walkthroughs/applicants/24-respond-to-missing-documents-request.md
---

> **Closed (2026-05-22) by PR #52** (Option 1 below). Re-walked on a local prod
> build of merged `staging`: as applicant1 on the paused app WS-202627-0002
> (Jordan), the dashboard CTA opened `/respond`, which **now lists the requested
> slots** (Birth Certificate + Council Tax) with the assessor note — the previous
> "couldn't find the request details" empty state is gone. Uploaded a file to
> each slot, clicked Send to assessor; SQL confirmed the app transitioned
> `PAUSED → NOT_STARTED` and a `MISSING_DOCS_RESPONDED` audit row was written.
> The fix reads the request via admin context after an ownership check, keeping
> the audit row staff-owned. (Assessor-notification email on submit is still
> deferred — tracked in `applicant-missing-docs-response-no-assessor-email.md`.)

## Context

Re-walking applicant/24 after PR #51 built the in-portal `/respond`
page. As applicant1, the dashboard CTA ("Action needed: respond to a
document request" → `/respond`) appears correctly and `/respond`
resolves to the paused application (WS-202627-0002, Jordan Applicant).
But the page renders the **empty state** — "We couldn't find the
request details" — instead of listing the requested document slots.

Root cause: `getLatestMissingDocsRequest()`
(`src/lib/db/queries/missing-docs.ts`) reads the request from the
latest `APPLICATION_PAUSED` audit-log row. That row is written by the
**assessor** who pauses the application (`pauseApplication` records
`userId: user.id` — the assessor). The page runs under the applicant's
RLS context (`withUserContext(user.id, "APPLICANT")`), and the
`audit_logs_select` policy only allows:

```
is_admin_or_viewer() OR (current_user_id() IS NOT NULL AND user_id = current_user_id())
```

The applicant is neither admin/viewer nor the row's `user_id`, so the
SELECT returns zero rows → `requestedSlots` is empty → the respond
page shows the "couldn't find the request details" fallback. The
applicant can therefore never see the requested items, upload them, or
send a response. (Confirmed in the running prod build: app resolved
correctly, valid slots present in the DB, page still empty.)

## Why it matters

The entire purpose of PR #51 — letting an applicant respond to a
missing-documents request in-portal — is blocked. The happy path is
unreachable for every real applicant, because the pause is always
performed by an assessor, so the audit row is never owned by the
applicant. This is a launch-blocking functional defect for the
walkthrough applicant/24, not a cosmetic gap.

## Proposed approach

The applicant needs read access to the missing-docs request for their
**own** application. Options:

1. **Read the request via an admin/service context** in
   `RespondPage` (e.g. wrap the `getLatestMissingDocsRequest` call in
   `withAdminContext` after confirming the application belongs to the
   signed-in applicant). Lowest-risk; keeps the audit row staff-owned.
2. **Add a scoped SELECT policy** allowing an applicant to read
   `APPLICATION_PAUSED` audit rows whose `entity_id` is an application
   they lead (join `applications.lead_applicant_id = current_user_id()`).
   More surface area; needs care to avoid leaking other audit actions.
3. **Persist the request in a dedicated table** (or on the application)
   readable by the lead applicant, rather than inferring it from the
   audit log. Cleanest long-term; larger change.

Option 1 is the smallest fix and matches the existing
`withAdminContext` pattern used elsewhere for audit writes.

## Out of scope

- The missing assessor-notification email on submit (tracked separately
  in `applicant-missing-docs-response-no-assessor-email.md`).
- The `/respond` multi-application selection heuristic
  (`findFirst orderBy updatedAt desc`), which picks the most-recently-
  updated application rather than the paused one — noted but not the
  blocker here.
