---
title: Migrate rate-limit.ts off the deprecated @vercel/kv SDK to @upstash/redis
status: open
severity: low
area: security, auth, deps, infra
opened: 2026-05-24
opened_by: brian
related:
  - src/lib/rate-limit.ts (imports `kv` from @vercel/kv)
  - package.json (@vercel/kv ^3.0.0, @upstash/ratelimit ^2.0.8)
  - prod-auth-rate-limiting-disabled.md (provisioning side)
  - rate-limiter-fails-open-when-kv-unset.md (same file; fold both into one PR)
---

## Context

Vercel KV was sunset as a first-party product (existing stores auto-migrated to
Upstash Redis in Dec 2024; new stores come from the Vercel Marketplace "Upstash
for Redis" integration). Alongside the product sunset, the **`@vercel/kv` SDK is
deprecated** in favour of `@upstash/redis`.

`src/lib/rate-limit.ts` still imports `{ kv } from "@vercel/kv"` and passes it as
the `redis` client to `@upstash/ratelimit`. It works today (the Marketplace
integration still injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`, which
`@vercel/kv` reads), but it's pinned to an abandoned package with reported
build-time issues.

## Why it matters

Low / debt. Nothing is broken while `@vercel/kv@3` keeps resolving and the
`KV_REST_API_*` vars are present. But it's an unmaintained dependency on the
auth security path, and the file is already being edited for the "fail loud in
prod" change (`rate-limiter-fails-open-when-kv-unset.md`) — cheapest to do both
in one PR rather than touch `rate-limit.ts` twice.

## Proposed approach

1. Replace the client construction:
   ```ts
   // before
   import { kv } from "@vercel/kv";
   // ...
   redis: kv,

   // after
   import { Redis } from "@upstash/redis";
   const redis = new Redis({
     url: process.env.KV_REST_API_URL!,
     token: process.env.KV_REST_API_TOKEN!,
   });
   // ...
   redis,
   ```
   Constructing explicitly (rather than `Redis.fromEnv()`) keeps the existing
   `KV_REST_API_*` env-var contract, so no Vercel env changes are needed.
   *(Alternatively switch to `Redis.fromEnv()` + the Upstash-native
   `UPSTASH_REDIS_REST_*` vars — but that forces an env-var rename in every
   environment; prefer the explicit-construction path.)*
2. Remove `@vercel/kv` from `package.json`; ensure `@upstash/redis` is a direct
   dependency (it's currently transitive via `@upstash/ratelimit`).
3. Update the file header comment (it says "on top of Vercel KV").
4. Fold in the `rate-limiter-fails-open-when-kv-unset` fail-loud change in the
   same PR — both edit this one file.
5. Verify locally (no KV → still no-ops with a warning) and on a preview deploy
   with the Marketplace store connected (throttles after 5 requests/15 min).

## Out of scope

- Provisioning the Upstash Redis store itself (`prod-auth-rate-limiting-disabled.md`).
- Changing the limiter window/threshold (5 req / 15 min) or the fail-open-in-dev
  behaviour.
