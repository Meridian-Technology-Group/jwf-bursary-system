---
title: seed scripts use dotenv override:true — explicit env vars get clobbered
status: open
severity: medium
area: seed, ops
opened: 2026-05-19
opened_by: Claude (via Brian Wagner)
related:
  - prisma/seed-reference.ts
  - prisma/seed-demo.ts
  - docs/PRODUCTION_READINESS.md (B2 execution notes)
---

## Context

Both seed scripts start with:

```ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
```

`override: true` makes `.env.local` win over any variable already set in
`process.env`, including ones passed on the command line. Discovered
while seeding prod for B2 — running

```
DIRECT_URL=<prod-url> NEXT_PUBLIC_SUPABASE_URL=<prod-url> \
SUPABASE_SERVICE_ROLE_KEY=<prod-key> npm run seed:reference
```

silently re-seeded **nonprod** because `.env.local` (which points at
nonprod) overrode every variable. The script reported success against
prod URLs that were never actually used.

The B2 prod seed eventually had to be run by physically swapping
`.env.local` aside, running, and restoring it. That's brittle and one
restore-step away from leaking nonprod values into a prod run.

## Why it matters

- The seed scripts are the canonical path for reference data going into
  any environment. If they silently misroute, we can claim "prod is
  seeded" and be wrong — exactly the failure mode B2 was supposed to
  close.
- The destructive guard on `seed-demo.ts` only blocks accidental writes;
  it doesn't help when the writes go to the wrong environment.
- Vercel's CLI re-populates `.env.local` with nonprod values on
  `vercel env pull`, so a contributor's local file is the default
  state, not a deliberate choice.

## Proposed approach

Flip the override flag:

```ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: false });
```

With `override: false`, anything explicitly set in `process.env` (e.g.
on the command line, or from CI secrets) wins over `.env.local`.
`.env.local` still fills in gaps for the common local-dev case where
no env vars are passed, so the existing developer workflow keeps
working.

Apply to both `prisma/seed-reference.ts` and `prisma/seed-demo.ts`.

Add a `console.log` at the top of each script that prints the resolved
`NEXT_PUBLIC_SUPABASE_URL` (or just its project ref, not secrets) so
the operator can eyeball-confirm the target before any writes happen.

## Out of scope

A wider refactor to a dedicated `.env.staging` / `.env.prod` loader, or
moving seeds into a CLI subcommand with explicit `--env=prod` flags.
The override fix alone closes the silent-misroute hole.
