---
title: Display running version / build info in the app (for testers)
status: open
severity: low
area: ui, observability, build
opened: 2026-05-24
opened_by: brian
related:
  - package.json (version field)
  - automated-version-bumping.md
  - VERCEL_ENV / VERCEL_GIT_COMMIT_SHA / VERCEL_GIT_COMMIT_REF env
---

## Context

Noticed during the v1.0.0 cutover. There is currently no way, from inside the
running app, to tell *which build* you are looking at. With production, a
long-lived staging environment, and per-branch preview deployments all serving
the same UI, a tester cannot confirm whether they're exercising the change they
think they are.

## Why it matters

Branch-specific preview testing is the main use case: when validating a fix on
a preview URL, "is this actually the build with my fix?" should be answerable
without digging through Vercel. It also makes bug reports far more useful —
testers can quote the exact version/SHA/environment, which pairs directly with
the Sentry release tagging now wired in.

## Proposed approach

Surface a small build-info string somewhere unobtrusive (footer, `/about`, or
an admin-only diagnostics panel), sourced at build time from:

- `version` from `package.json`,
- `VERCEL_GIT_COMMIT_SHA` (short) and `VERCEL_GIT_COMMIT_REF` (branch),
- `VERCEL_ENV` (`production` | `preview` | `development`).

Expose them via `NEXT_PUBLIC_*` build-time vars (or a generated module) so they
render client-side. Consider also returning the same payload from a tiny
`/api/version` route for automated checks. Tie the value to the Sentry
`release`/`environment` so UI, error reports, and deploys line up.

## Out of scope

A full release-notes / changelog viewer in-app. This is just a version/build
fingerprint for identifying what's running.
