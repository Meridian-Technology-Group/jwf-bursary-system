---
title: Enable auth rate limiting in production via Vercel WAF
status: done
severity: high
area: security, auth, infra
opened: 2026-05-24
opened_by: brian
related:
  - docs/operations/waf-auth-rate-limiting.md (runbook — CLI procedure)
  - src/lib/rate-limit.ts (legacy app-level limiter — to be removed)
  - src/app/(auth)/login/actions.ts, src/app/(auth)/reset-password/actions.ts (call sites to clean up)
  - docs/operations/environment-variables.md, docs/operations/incident-response.md, docs/operations/deployment.md
  - v1.0.0 release
---

## Context

Noticed during the v1.0.0 production cutover. The auth endpoints used an
**application-layer** limiter (`src/lib/rate-limit.ts`, `@upstash/ratelimit`
over Vercel KV, driven by `KV_REST_API_URL` / `KV_REST_API_TOKEN`). Those vars
were never set in Vercel Production, so v1.0.0 shipped with rate limiting
**disabled** (the lib logged a warning and no-opped, failing open).

Two facts changed the fix (2026-05-24):

1. **Vercel KV has been sunset** as a first-party product — there's no "Vercel
   KV" store to provision anymore (existing stores were migrated to Upstash
   Redis; new ones come from the Marketplace).
2. **Vercel WAF rate limiting is GA on the Pro plan** (fixed-window algorithm —
   exactly what this app uses). It's edge-enforced and costs ~$0.50 per 1M
   allowed requests. **Correction (2026-05-24):** it is *not* configurable in
   `vercel.json` — that surface only supports binary `deny`/`challenge`, no
   `rateLimit` window/limit/keys. Rate-limit rules are project-level firewall
   state created via the `vercel firewall` CLI (or dashboard/SDK) and published
   explicitly. See `docs/operations/waf-auth-rate-limiting.md`.

**Decision: move auth rate limiting to Vercel WAF and delete the app-level
limiter.** This removes the KV/Upstash store, the `@upstash/ratelimit` +
`@vercel/kv` dependencies, and the fail-open-when-unset failure mode, and blocks
brute force at the edge before it reaches a Function.

## Why it matters

Without throttling, the login and password-reset endpoints have no brute-force
or credential-stuffing protection. This is a PII system (bursary applications,
financial data), so an unthrottled auth surface is a real exposure. Production
is unprotected until the WAF rule is active — this stays **high** until then.

(Registration is invite-only via a 32-byte random token, so there is no open
register endpoint to brute-force; login + reset-password are the surfaces that
need throttling. The earlier "register" framing was loose.)

## Proposed approach

1. **Add the WAF rule(s)** via `vercel firewall rules add` — fixed-window,
   5 requests / 900 s (15 min), keyed by IP, action `deny` (429) or
   `challenge`. Use **two single-path rules** (`/login`, `/reset-password`)
   so the buckets stay independent — mirroring the deleted limiter's separate
   `login:` / `reset-password:` buckets. Stage, `vercel firewall diff`, then
   `vercel firewall publish`. Well within Pro's 40-rule allowance.
   See `docs/operations/waf-auth-rate-limiting.md` for the exact commands.
2. **Verify on a preview deploy:** >5 attempts in 15 min from one IP returns an
   edge 429/challenge before the sign-in action runs; a normal user is
   unaffected.
3. **Remove the app-level limiter:** delete `src/lib/rate-limit.ts`, drop the
   `checkLoginRateLimit` / `checkResetPasswordRateLimit` calls (and
   `RATE_LIMIT_MESSAGE` handling) from the login/reset actions, and remove the
   `@upstash/ratelimit` + `@vercel/kv` dependencies from `package.json`.
4. **Go-live check:** add "WAF auth rate-limit rule active in Production" to the
   deployment runbook's go-live checklist (replaces the old "confirm
   `KV_REST_API_*` set" check).

## Out of scope

- Tuning the window/threshold (keep 5 / 15 min to match current intent).
- Throttling document/export/PDF routes — auth surfaces only for now.
- Enterprise token-bucket algorithm — Pro's fixed-window is sufficient.

## Supersedes

- `rate-limiter-fails-open-when-kv-unset` — the fail-open concern is specific to
  the app-level limiter, which is being deleted. (Archived.)
- `migrate-rate-limit-off-vercel-kv-sdk` — no SDK to migrate once the code is
  removed. (Archived.)
