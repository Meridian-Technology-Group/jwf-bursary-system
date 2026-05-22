---
title: Drop Invitation.applicantName once firstName/lastName fully cover it
status: open
severity: low
area: schema, cleanup
opened: 2026-05-13
opened_by: Claude (via Brian Wagner)
related:
  - docs/archive/specs/invitation-flow.md §3, §7
  - prisma/schema.prisma (Invitation model)
  - prisma/seed-data/email-templates.ts (INVITATION uses {{applicant_name}})
---

## Context

PR #11 added structured `firstName` / `lastName` columns to
`Invitation` but kept the legacy `applicantName` text column to avoid
churn in the seeded `INVITATION` email template (`{{applicant_name}}`)
and the admin Invitations list table. The send form (PR #12) composes
`applicantName` from `firstName + lastName` when not supplied.

## Why it matters

- Two sources of truth for "what name to display." `applicantName`
  can drift from `firstName + lastName` if anyone edits the row by
  SQL or via a future admin override.
- The `INVITATION` template still binds against `{{applicant_name}}`,
  so removing the column requires touching the template too.

## Proposed approach

1. Update all readers of `applicantName` to derive it on the fly:
   `[firstName, lastName].filter(Boolean).join(" ").trim()`.
   - Admin Invitations list table.
   - Email send call sites (`merge_data.applicant_name`).
2. Rename the template merge field from `applicant_name` to
   `recipient_name` (or just keep the name and switch the value
   source).
3. Forward-only migration: `ALTER TABLE invitations DROP COLUMN
   applicant_name;`
4. Remove the column from the Prisma schema, regenerate.

Do this only once the structured columns are populated for all
historical rows — for now they default to NULL, which means a
backfill is needed before dropping. Backfill via:

```sql
UPDATE invitations
SET first_name = split_part(applicant_name, ' ', 1),
    last_name  = NULLIF(substring(applicant_name FROM position(' ' IN applicant_name) + 1), '')
WHERE first_name IS NULL AND last_name IS NULL;
```

…with the same caveats as any name-split heuristic (single-word names,
multi-word surnames).

## Out of scope

Improving the name-split heuristic — punt to a manual review of rows
where the split looks wrong.
