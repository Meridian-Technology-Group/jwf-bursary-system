---
title: CSP `script-src` excludes `unsafe-eval`, breaks `next dev` hydration
status: open
severity: medium
area: build, security
opened: 2026-05-19
opened_by: walkthrough verification pass
related:
  - next.config.mjs:20
  - docs/walkthroughs/VERIFICATION-PLAN.md
---

## Context

While running the walkthrough verification pass against `npm run dev`
on a fresh checkout of `chore/walkthrough-verification-pass`, the
login form never advanced past the Sign-in click. Console showed:

```
EvalError: Evaluating a string as JavaScript violates the following
Content Security Policy directive because 'unsafe-eval' is not an
allowed source of script: script-src 'self' 'unsafe-inline'.
  at @next/react-refresh-utils/dist/runtime.js
```

`next.config.mjs:23` sets `script-src 'self' 'unsafe-inline'` — no
`unsafe-eval`. Next.js dev mode's React Refresh runtime uses `eval`,
so the page's client bundles fail to hydrate. The form submit handler
never registers and clicking "Sign in" performs a default browser
GET back to `/login`, with no visible error.

Reproduced against staging (port 3100) on commit `068d380` with all
seed data loaded. Switching to a production build (`npm run build &&
npm run start`) makes the issue disappear because the production
bundle does not include React Refresh.

## Why it matters

- Local development against the real CSP headers is broken — anyone
  pulling the repo and running `npm run dev` will land on a login
  page that silently swallows submissions.
- The fix that's almost certainly going to be reached for is "wrap
  the headers function so dev mode appends `'unsafe-eval'`", which
  needs to be done deliberately rather than ad-hoc.
- The walkthrough verification pass is now executing against a
  locally-served prod build. That's acceptable for the pass itself
  but means manual exploration of the codebase by other developers
  will hit the same trap.

## Proposed approach

In `next.config.mjs`, branch the `script-src` value on
`process.env.NODE_ENV`:

- `production` → keep `'self' 'unsafe-inline'` (current value).
- `development` → add `'unsafe-eval'` so HMR/React Refresh works.

Alternative: nonce-based CSP (already TODO'd at `next.config.mjs:6`)
would also fix this as a side effect, but is a bigger lift and is
out of scope for unblocking dev mode now.

## Out of scope

- Migrating to a nonce-based CSP. Track separately.
- Any production CSP changes — the prod policy is correct as-is and
  matches the security audit.
