---
title: INVITATION template body should call out single-use + 30-day expiry
status: open
severity: low
area: invitations, copy
opened: 2026-05-13
opened_by: Claude (via Brian Wagner)
related:
  - docs/planning/APPLICANT_INVITATION_FLOW.md §4.4, §7
  - prisma/seed-data/email-templates.ts (INVITATION)
  - prisma/migrations/20260513220100_seed_email_templates/migration.sql
---

## Context

The `INVITE_STAFF` template body explicitly says "The link is
single-use and will expire in 72 hours." The `INVITATION` template
(for applicants) does not mention either property — only the
`{{deadline}}` for submitting the application itself, which is a
different concept.

## Why it matters

- Applicants who try the same link twice (e.g. after revoke/resend)
  hit an "invitation invalid" page with no context for why.
- Sharing a link with a partner is technically fine until one of them
  registers — the next click breaks. Easy to surprise families.

## Proposed approach

Update the template body in two places to keep them in sync:

1. `prisma/seed-data/email-templates.ts` — source for fresh local
   seeds.
2. A new forward-only migration that runs `UPDATE email_templates SET
   body = $$...$$, updated_at = now() WHERE type = 'INVITATION';`.
   Don't try to make the migration idempotent vs the new copy — just
   make it explicit that this changes the row.

Suggested addition (paragraph near the deadline mention):

> Please note that this invitation link is for {{applicant_name}}
> only and can be used a single time. It will expire after 30 days.
> If you have any difficulty accessing it, please contact the
> Bursary Office and we will issue you a new one.

Decide on copy with the Foundation before shipping.

## Out of scope

Internationalising the templates or moving copy into a CMS.
