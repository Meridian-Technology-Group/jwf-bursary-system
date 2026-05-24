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

1. Provision a Vercel KV (Upstash) store for the project.
2. Add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the Production
   environment (Preview already has staging coverage if desired).
3. Redeploy production; confirm the startup warning is gone and that a burst
   of auth requests gets throttled.

## Out of scope

Reworking the rate-limit strategy itself — the code is in place and works
when the KV vars are present. This entry is purely about provisioning the
production store and wiring the env vars.
