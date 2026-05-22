# API Reference

> **STATUS: STUB** — MSA Schedule 1 §4 deliverable (API reference). To be
> completed before go-live (B15). Source of truth is `src/app/api/**`.

## Purpose
Reference for the application's HTTP endpoints and server actions: route,
method, auth/role requirements, request/response shape, and audit behaviour.

## To complete
- [ ] Route handlers under `src/app/api/**` (documents, exports, pdf,
      applications/names, siblings, webhooks, …) — method, params, guards.
- [ ] Server actions by area (apply, invitations, queue, assessment,
      recommendation, rounds, settings, GDPR) — inputs, side effects, audit rows.
- [ ] Auth model: role gates, RLS context (`withUserContext` /
      `withAdminContext`), and rate-limited endpoints.
- [ ] Error conventions and status codes.

See also: [`tdd/07-system-components.md`](tdd/07-system-components.md).
