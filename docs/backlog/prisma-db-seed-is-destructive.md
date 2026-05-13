---
title: prisma db seed is destructive — unsafe for shared environments
status: open
severity: high
area: build, seed
opened: 2026-05-13
opened_by: Claude (via Brian Wagner)
related:
  - prisma/seed.ts
  - prisma/seed-data/email-templates.ts
  - PR #13 (idempotent email templates migration)
---

## Context

`prisma/seed.ts` runs `deleteMany({})` against every domain table
(auditLog, recommendation, application, invitation, profile, etc.)
before recreating demo data. Running `pnpm prisma db seed` against a
shared environment would wipe real work. The build script doesn't run
the seed, so this hasn't fired yet, but the foot-gun is shipped.

PR #13 worked around this for one specific case by adding an idempotent
migration to seed the 8 email templates — that template content lives
in two places now (the seed file and the migration), which will rot
over time.

## Why it matters

- One mistyped `pnpm prisma db seed` against staging or prod erases
  production data.
- Reference data (email templates, family-type configs, reason codes,
  council-tax defaults, school fees) currently has no idempotent path
  into prod aside from one-off migrations.
- The demo profiles in the seed embed fixed UUIDs, so a re-seed of
  staging would conflict with any auth.users entries that staff have
  already linked to those IDs.

## Proposed approach

Split the seed into two scripts with distinct purposes:

1. **`prisma/seed-reference.ts`** — idempotent. Upserts only the
   reference tables (`email_templates`, `family_type_configs`,
   `school_fees`, `council_tax_defaults`, `reason_codes`). Safe to run
   against any environment. Wire into the build, or call it from a
   migration helper.
2. **`prisma/seed-demo.ts`** — current destructive behavior. Used only
   for local fresh starts. Gate behind an explicit env var like
   `ALLOW_DESTRUCTIVE_SEED=1` so it cannot run by accident.

Update `package.json:prisma.seed` to point at the demo seed, and
document the reference seed in `CLAUDE.md`. The migration-based
template seed from PR #13 stays — it's the one path into prod.

## Out of scope

Replacing the destructive seed with something fancier (e.g., factory
libraries). Goal here is just to make the unsafe path harder to hit
by accident.
