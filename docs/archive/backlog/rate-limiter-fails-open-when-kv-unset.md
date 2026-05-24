---
title: Auth rate limiter fails OPEN when KV env vars are unset
status: won't-do
severity: medium
area: security, ops, auth
opened: 2026-05-23
opened_by: Brian Wagner (via Claude, during reference/runbook authoring)
closed: 2026-05-24
related:
  - prod-auth-rate-limiting-disabled.md (the superseding WAF decision)
---

> **CLOSED (2026-05-24): SUPERSEDED.** This fail-open behaviour is a property of
> the **application-layer** limiter (`src/lib/rate-limit.ts`), which is being
> **deleted** in favour of **Vercel WAF** edge rate limiting. WAF has no
> KV env var to miss, so it cannot fail open the same way — its only failure
> mode is the rule being absent/disabled, which the deployment go-live checklist
> now guards (see
> [prod-auth-rate-limiting-disabled.md](./prod-auth-rate-limiting-disabled.md)
> and `docs/operations/incident-response.md` §6.5). Original context retained
> below for history.

## Context

The auth rate limiter (`src/lib/rate-limit.ts`, `@upstash/ratelimit` over Vercel
KV) **fails open**: when `KV_REST_API_URL` / `KV_REST_API_TOKEN` are not set, it
becomes a no-op that *always allows*, logging a single warning at module load:

```
[rate-limit] KV_REST_API_URL / KV_REST_API_TOKEN not set — rate limiting is DISABLED.
```

This is the right behaviour for local dev, but in production it means a missing
or mistyped KV secret **silently disables login/auth throttling** — with only a
one-line server-start warning to signal it.

## Why it matters

Medium (security). NF-06 calls for rate-limited login attempts and lockout.
If the KV vars aren't present in the Vercel **Production** scope (easy to miss —
they are not in `.env.example` as required values, and the failure is silent),
brute-force protection is off in prod and nobody is alerted.

## Proposed approach

Pick one (not mutually exclusive):

1. **Fail loud in production.** If `VERCEL_ENV === 'production'` and the KV vars
   are unset, throw at startup (or surface a Critical Sentry event) rather than
   silently degrading — so a misconfiguration can't reach live traffic unnoticed.
2. **Pre-go-live gate.** Add "confirm `KV_REST_API_*` set in Vercel Production"
   to the deployment runbook's go-live checklist (and verify during hypercare).
3. **Observability.** Emit a Sentry breadcrumb/event when the limiter is disabled
   in a non-local environment, so the incident-response detection path catches it.

Recommend (1) + (2): make prod refuse to run unprotected, and check it at go-live.

## Out of scope

- Replacing the rate-limiter implementation or tuning its thresholds.
- The separate MFA gate (already enforced in prod).
