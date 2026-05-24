---
title: Set RESEND_WEBHOOK_SECRET in production (delivery events rejected)
status: open
severity: medium
area: email, infra
opened: 2026-05-24
opened_by: brian
related:
  - src/app/api/webhooks/resend/route.ts
  - .env.example (RESEND_WEBHOOK_SECRET)
  - v1.0.0 release
---

## Context

Noticed during the v1.0.0 production cutover. The Resend webhook handler
([src/app/api/webhooks/resend/route.ts](../../src/app/api/webhooks/resend/route.ts))
verifies the Svix signature using `RESEND_WEBHOOK_SECRET`. That var is **not
set in the Vercel Production environment**, so production v1.0.0 cannot
accept inbound delivery/bounce/complaint events from Resend.

## Why it matters

Email itself still sends (outbound `RESEND_API_KEY` is configured), but
delivery-status tracking is dark in production: no record of bounces,
complaints, or delivery confirmations. For a system that emails applicants
and assessors about bursary outcomes, losing bounce visibility means failed
notifications can go unnoticed.

## Proposed approach

1. In the Resend dashboard, find the production webhook's signing secret
   (Webhooks -> Signing Secret), or create a webhook pointing at the prod
   `/api/webhooks/resend` URL.
2. Add `RESEND_WEBHOOK_SECRET` to the Vercel Production environment.
3. Redeploy and confirm a test event is accepted (200) rather than rejected.

## Out of scope

Any change to the webhook handler logic — it already validates correctly
when the secret is present.
