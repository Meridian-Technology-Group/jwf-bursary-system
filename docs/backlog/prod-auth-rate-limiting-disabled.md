---
title: Enable auth rate limiting in production (KV not configured)
status: open
severity: high
area: security, auth, infra
opened: 2026-05-24
opened_by: brian
related:
  - src/lib/rate-limit.ts
  - .env.example (KV_REST_API_URL / KV_REST_API_TOKEN)
  - v1.0.0 release
---

## Context

Noticed during the v1.0.0 production cutover. The auth endpoints use
`@upstash/ratelimit` backed by Vercel KV ([src/lib/rate-limit.ts](../../src/lib/rate-limit.ts)),
driven by `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Those vars are **not set
in the Vercel Production environment**, so production shipped v1.0.0 with
rate limiting disabled (the lib logs a warning at server start and no-ops).

## Why it matters

Without rate limiting, the login / password-reset / register endpoints have
no brute-force or credential-stuffing protection. This is a PII system
(bursary applications, financial data), so an unthrottled auth surface is a
real exposure, not a theoretical one. Deferred at launch as a conscious
trade-off, not a fix.

## Proposed approach

> **Note (2026-05-24): Vercel KV has been sunset.** The first-party "Vercel
> KV" product no longer exists — provision **Upstash for Redis via the Vercel
> Marketplace** (Storage → Marketplace → Upstash for Redis) instead. The
> Marketplace Redis integration still injects `KV_REST_API_URL` /
> `KV_REST_API_TOKEN` (the vars `src/lib/rate-limit.ts` reads), so **no code
> change is required to light up prod rate limiting** — the env-var contract is
> preserved. The deprecated `@vercel/kv` *SDK* is a separate cleanup, tracked in
> [migrate-rate-limit-off-vercel-kv-sdk.md](./migrate-rate-limit-off-vercel-kv-sdk.md).

1. From the project's **Storage → Marketplace** tab, install **Upstash for
   Redis** and connect it to the project (this replaces the old "Vercel KV"
   flow). Scope it to the **Production** environment (add Preview too if you
   want staging coverage).
2. Confirm the integration injected `KV_REST_API_URL` / `KV_REST_API_TOKEN`
   into Production. If it only exposes `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN`, either alias them to the `KV_REST_API_*` names
   or land the SDK-migration item first so the code reads the Upstash-native
   vars.
3. Redeploy production; confirm the `[rate-limit] … DISABLED` startup warning
   is gone and that a burst of auth requests gets throttled.

## Out of scope

Reworking the rate-limit *strategy* — the limiter logic is in place and works
when the vars are present. This entry is purely about provisioning the
production store and wiring the env vars. Migrating off the deprecated
`@vercel/kv` SDK is its own item (linked above).
