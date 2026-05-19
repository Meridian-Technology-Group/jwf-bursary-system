---
title: prisma migrate deploy is not run on deploy — migrations applied manually
status: open
severity: medium
area: build, ci, ops
opened: 2026-05-13
opened_by: Claude (via Brian Wagner)
related:
  - package.json (build script)
  - commit 3a8c4fc (fix(build): drop prisma migrate deploy from build script)
  - CLAUDE.md (Schema / migration discipline)
---

## Context

The Vercel build script is `prisma generate && next build` — no
`prisma migrate deploy`. That was an intentional fix (commit `3a8c4fc`)
because the build was failing trying to reach the migrations database
during the Vercel build step. The trade-off: migrations now have to be
applied to each environment manually, via `prisma migrate deploy` from
a workstation or via the Supabase MCP `apply_migration` tool.

For PR #13, the RLS + email-templates migrations were applied to nonprod
via MCP before the PR was opened. Prod will need the same treatment
when staging promotes.

## Why it matters

- Easy to forget. A PR that adds a migration merges to staging and
  ships code that depends on a schema that isn't there yet.
- Manual application also means there is no single audit trail of
  which migration ran when; Supabase's migrations table tracks SQL
  runs but won't necessarily match Prisma's `_prisma_migrations`.
- The recovery story for "deploy first, migrate later" is not great —
  the Next.js server will hit Prisma errors at runtime.

## Proposed approach

Two options worth weighing:

1. **Pre-deploy migrate via GitHub Actions** — run
   `pnpm prisma migrate deploy` against the matching Supabase env
   (`supabase-nonprod` for `staging` pushes, `supabase-prod` for
   `main` pushes) using a stored connection string. Block Vercel
   deploy on success.
2. **A separate one-shot Vercel function or `vercel-build.sh`** that
   runs `prisma migrate deploy` against a known-good direct
   connection URL (not the pooled one), with a guarded fallback so
   build doesn't fail on transient network issues.

Option 1 is more standard and easier to reason about. The reason the
original attempt was reverted should be re-examined before doing this —
likely the pooled URL was used instead of the direct migration URL.

## Out of scope

Rebuilding the entire CI pipeline. This is a single missing step.
