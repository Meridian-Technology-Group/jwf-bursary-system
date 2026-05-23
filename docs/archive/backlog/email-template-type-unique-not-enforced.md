---
title: email_templates.type @unique is not enforced in the database
status: done
severity: medium
area: schema, drift
opened: 2026-05-13
opened_by: Claude (via Brian Wagner)
closed: 2026-05-23
related:
  - prisma/schema.prisma (EmailTemplate model)
  - prisma/migrations/20260301180442_initial_schema/migration.sql
---

> **CLOSED (2026-05-23): not a real defect — the constraint IS enforced.**
> The original investigation queried `pg_constraint`, but a Prisma `@unique`
> compiles to a unique **index**, not a table constraint — so it never showed up
> there. Verified via `pg_indexes` on **both** environments (2026-05-22 nonprod,
> 2026-05-23 prod): the unique index `email_templates_type_key` exists on
> `public.email_templates (type)` in each. The initial-schema migration creates
> it. No migration or data fix is needed.

## Context

`prisma/schema.prisma` declares `type EmailTemplateType @unique` on the
`EmailTemplate` model, but the actual Postgres table has no unique
constraint or index on `type` — only the primary key on `id`. Confirmed
on nonprod:

```
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'email_templates'::regclass;
-- only email_templates_pkey + the updated_by FK
```

The drift means Prisma's `findUnique({ where: { type } })` and the
idempotent template-seed migration both work by happy accident: nothing
actually prevents two rows with the same `type` from existing.

## Why it matters

- Two duplicate rows would make `findUnique` non-deterministic — the
  email sender would pick whichever Postgres returned first.
- Future migrations that rely on `ON CONFLICT (type)` will fail without
  a unique constraint, masking real bugs.
- The schema/DB mismatch will silently mislead anyone reading
  `schema.prisma`.

Low immediate risk because the admin UI is the only writer and it never
inserts duplicates today, but the latent failure mode is unbounded.

## Proposed approach

Single forward-only migration:

```sql
CREATE UNIQUE INDEX email_templates_type_key
  ON public.email_templates (type);
```

No data fix needed — nonprod and prod both have at most one row per
type today (verified). If a future audit finds duplicates, dedupe first.

## Out of scope

Backfilling a `type` column on any other table, or changing the
`EmailTemplateType` enum itself.
