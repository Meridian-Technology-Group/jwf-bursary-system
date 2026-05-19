---
title: B8 — MFA (TOTP) for ADMIN / ASSESSOR / VIEWER
status: open
severity: critical
area: auth, security, compliance
opened: 2026-05-19
opened_by: Claude (via Brian Wagner)
related:
  - docs/PRODUCTION_READINESS.md (B8)
  - src/middleware.ts
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/login/actions.ts
  - MSA Schedule 4 §8 (mandatory MFA for staff roles)
  - MSA Schedule 1 §2 (Gate G3 / G4 sign-off)
---

## Context

MSA Schedule 4 §8 makes MFA mandatory for the ADMIN / ASSESSOR / VIEWER
roles. The §9 acceptance checkbox cannot be ticked until this lands.
Per the audit, the codebase has zero MFA implementation today
(`grep -ri "mfa\|enrollFactor\|aal2"` across `src/` returns nothing),
the middleware reads role from `app_metadata` but does not gate on
`aal2`, and the login page is single-factor only.

Deferred from the B-blocker queue on 2026-05-19 because the surrounding
B-blockers were closing fast and we wanted to converge those before
spending the ~3 days B8 needs.

## Why it matters

- Hard MSA acceptance gate — no Go-Live without it.
- Until it ships, every staff account is one credential leak away from
  full read/write on the entire bursary dataset (and the ability to
  rewrite reason codes, family-type configs, etc.).
- B9 narrowed write surface to admin-only via RLS, but read surface
  remains wide (admin/assessor/viewer can see every applicant's PII).

## Proposed approach

### Scope (single PR, ~3 days)

1. **Middleware** (`src/middleware.ts`): on `/admin/*`, require
   `session.aal === "aal2"` when role ∈ {ADMIN, ASSESSOR, VIEWER}.
   APPLICANTs remain unaffected (their bursary-application paths are
   single-factor). On `aal1` for a staff role, redirect to
   `/login/mfa`.

2. **New `/login/mfa` route**: server component that calls
   `supabase.auth.mfa.listFactors()` and branches:
   - **Setup form** (no TOTP factor yet): renders QR + plaintext
     secret returned by `supabase.auth.mfa.enroll({ factorType: "totp" })`,
     asks for the first 6-digit code, calls `mfa.verify` to confirm
     enrolment. Session is then elevated to `aal2`.
   - **Challenge form** (has TOTP factor): asks for 6-digit code,
     calls `mfa.challenge` + `mfa.verify`. Session elevates to `aal2`.

3. **Login action** (`src/app/(auth)/login/actions.ts`): after a
   successful `signInWithPassword` for a staff role, redirect to
   `/login/mfa` instead of `/admin`. APPLICANT flow unchanged.

4. **Documentation**: short admin/operator note explaining the
   lockout-recovery path (see below).

### Lockout recovery (MVP)

Supabase has no native backup-code mechanism for TOTP factors. In MVP
we accept that and document the manual recovery path:

```sql
-- Run via supabase-prod MCP / dashboard as a superuser:
DELETE FROM auth.mfa_factors WHERE user_id = '<uuid>';
```

After deletion, the user is back to `aal1` and will be prompted to
re-enrol on next staff route hit.

### Deferred to a follow-up after MVP MFA lands

- **Backup / recovery codes.** Generate 10 single-use codes at enrolment
  time, store as bcrypt hashes in a new `auth_recovery_codes` table,
  surface a "use a recovery code" link on the challenge page that
  accepts a code → marks it used → elevates to `aal2`.
- **Admin "reset MFA for another user" UI** — a settings page that
  uses `supabase.auth.admin.mfa.deleteFactor`. Today an admin can do
  this via MCP / dashboard.
- **Force re-enrolment policy** (e.g., on phone replacement) — same
  flow as admin reset.
- **WebAuthn factor** as an alternative to TOTP — Supabase supports it
  via the same MFA API surface.

## Implementation notes from initial investigation

- The Supabase Auth JS API supports TOTP MFA via
  `auth.mfa.enroll` / `auth.mfa.challenge` / `auth.mfa.verify` /
  `auth.mfa.listFactors` (see
  `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts`).
- `auth.mfa.enroll({ factorType: "totp" })` returns
  `data.totp.qr_code` (SVG string) and `data.totp.uri` (otpauth://).
  Render the SVG inline — no extra client lib needed.
- The session's JWT carries `aal: "aal1" | "aal2"`. Middleware can
  decode this directly without calling Supabase. For a cleaner read,
  use `auth.mfa.getAuthenticatorAssuranceLevel()` server-side.
- Existing staff accounts will be `aal1` after deploy and will be
  funnelled through `/login/mfa/setup` on their next admin route hit.
  No data migration required.

## Risk on deploy

On the day this lands, every staff user — including the developer
doing the deploy — will be redirected to `/login/mfa/setup` the moment
they touch an admin route. If anything in the enrolment flow is broken,
they can't enrol and can't access admin. Mitigations:

1. Ship with the lockout-recovery SQL above documented in the PR body
   so it can be applied via MCP within seconds.
2. Smoke the flow on staging with two test accounts (one fresh, one
   with a deliberately broken factor) before promoting to main.

## Out of scope for this entry

Schedule 4 §8 also calls for IP allow-lists, password rotation policies,
and session-timeout tuning. Those are separate audit items, not B8.
