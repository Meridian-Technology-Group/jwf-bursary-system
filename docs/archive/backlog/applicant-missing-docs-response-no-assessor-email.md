---
title: No assessor-notification email when applicant responds to missing-docs
status: done
severity: low
area: email
opened: 2026-05-22
opened_by: walkthrough-verification (pass 7)
related:
  - PR #51 (in-portal respond-to-missing-docs page)
  - docs/guides/walkthroughs/applicants/24-respond-to-missing-documents-request.md
---

## Context

PR #51 added the in-portal "respond to a missing-documents request"
flow (`/respond`). When the applicant sends their uploaded documents
back, the application transitions out of PAUSED and a
`MISSING_DOCS_RESPONDED` audit row is written, but **no email is sent
to the assessor** to tell them the applicant has responded. The
implementer flagged this as a known follow-up: it needs a new
`EmailTemplateType` plus a migration to seed the template.

The applicant/24 guide's "What happens next" section says: *"The
assessor receives an email saying you've responded."* — so the guide
currently over-promises relative to what ships.

## Why it matters

Low. The status transition and audit row already give the assessor a
signal in-app (the application leaves the paused/awaiting-docs state
and reappears in the queue). The missing email just means the assessor
isn't actively pinged — they have to notice the queue change. Worth
closing for parity with the guide and to avoid silent waits.

## Proposed approach

1. Add a `MISSING_DOCS_RESPONDED` (or similarly named) value to the
   `EmailTemplateType` enum (Prisma schema + migration).
2. Seed the template via the `*_seed_email_templates` migration
   (single source of truth — not the demo seed), with the standard
   merge fields (reference, child name, assessor name, link to the
   application).
3. Fire the email from the `submitMissingDocsResponse` server action,
   addressed to the assigned assessor, alongside the existing audit
   write.

## Out of scope

- The RLS read blocker that previously prevented the respond page from
  loading the request at all. **Resolved in PR #52** (`b1300dd`, 2026-05-22)
  — the missing-docs request is now read under `withAdminContext` after the
  page confirms applicant ownership + PAUSED state. The respond flow is
  reachable, so this item is **no longer blocked** by it. (The cited
  `walkthrough-applicant-24-respond-page-rls-blocks-request-read.md` was
  never filed in-repo.)
