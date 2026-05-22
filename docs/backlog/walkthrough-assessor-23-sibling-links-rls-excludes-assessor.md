---
title: Assessors cannot create/reorder/break sibling links (RLS write policy is admin-only)
status: open
severity: high
area: rls, sibling-linking
opened: 2026-05-22
opened_by: walkthrough-verification
related:
  - docs/walkthroughs/assessors/23-link-siblings.md
  - docs/walkthroughs/assessors/24-reorder-sibling-priority.md
  - docs/walkthroughs/assessors/25-break-sibling-link.md
  - src/app/api/siblings/route.ts (POST handler)
  - docs/backlog/walkthrough-assessor-09-reference-data-rls-excludes-assessor.md (same class, fixed in PR #37)
---

## Context

Walking assessor/23 (link siblings) as the ASSESSOR persona. Searched and
found the sibling bursary account, clicked **Link as Sibling**, and
`POST /api/siblings` returned **500**. The UI surfaced the raw Prisma error:

> Invalid `prisma.siblingLink.create()` invocation … PostgresError { code:
> "42501", message: "new row violates row-level security policy for table
> \"sibling_links\"" }

Confirmed the policies on `public.sibling_links`:

- `sibling_links_write` (cmd ALL) — `qual`/`with_check` = `is_admin()` only.
- `sibling_links_select` (cmd SELECT) — admin/viewer **OR** ASSESSOR **OR**
  the owning applicant.

So assessors can read sibling links but cannot write them, while the
Sibling Linker card is rendered specifically for assessors
(`applications/[id]/page.tsx` → `SiblingLinkerCard isAssessor`) and the
guide states "Signed in as ASSESSOR or ADMIN."

## Why it matters

This is the same RLS-excludes-assessor pattern as the reference-data bug
fixed in PR #37, and it blocks **three** guides at once:

- **23 link** — INSERT denied (the 500 above); raw error shown in UI.
- **24 reorder priority** — UPDATE denied. Confirmed empirically: the list
  reorders optimistically in the UI (Jordan jumps to Priority 1) but the DB
  `priority_order` is unchanged and **no error is shown** — a silent
  failure that reverts on reload.
- **25 break link** — DELETE denied. Confirmed empirically: clicking Unlink
  leaves both rows in `sibling_links` (count stays 2); the card still shows
  "(2 accounts)".

The three paths also handle the denial **inconsistently** (raw driver error
vs. silent no-op), which is its own UX bug regardless of the RLS fix.

Combined with `bursary-accounts-never-created.md`, sibling linking is
doubly unreachable in production: the data never exists, and even when it
does the assessor write is denied.

Secondary issue: the API route leaks the raw Prisma `ConnectorError`
(table name, column, SQL detail) to the client. The guide promises a
friendly "Failed to create sibling link" message; the handler should catch
and return that instead of the driver error.

## Proposed approach

Widen the write policy to include ASSESSOR (mirror PR #37). Either change
`sibling_links_write` to `is_admin_or_viewer()`-style including
`current_user_role() = 'ASSESSOR'`, or add explicit INSERT/UPDATE/DELETE
policies for the assessor role. Decide whether VIEWER should be read-only
(likely yes — keep VIEWER out of the write policy). Separately, wrap the
`POST /api/siblings` handler so RLS/Prisma errors return a sanitised
message.

## Out of scope

The display side (Linked Siblings card, priority badges, "This child"
chip) is verified separately by seeding a `sibling_links` row via the
service role; that confirms the SELECT path works for assessors and is not
a substitute for fixing the write policy.
