---
title: B8 — MFA (TOTP) for ADMIN / ASSESSOR / VIEWER
status: closed
severity: critical
area: auth, security, compliance
opened: 2026-05-19
opened_by: Claude (via Brian Wagner)
closed: 2026-05-22
state: shipped to production behind a prod-only feature flag and enforced in prod (PR #56 → staging, PR #57 → main)
related:
  - PR #50 (MVP TOTP MFA gate, /login/mfa enrol+challenge, admin reset-MFA control) — built & verified
  - PR #53 (revert of #50 on staging) — MFA backed out pending the feature-flag + go-live decision
  - PR #54 (staging → main promotion) — explicitly EXCLUDED MFA
  - PR #56 (re-applied behind the STAFF_MFA_ENFORCED/VERCEL_ENV flag + idempotent enrol) — merged to staging
  - PR #57 (staging → main promotion) — shipped MFA to prod; enforced by the VERCEL_ENV=production default
  - docs/walkthroughs/admins/14-reset-staff-mfa.md
  - src/lib/auth/mfa-flag.ts
  - src/middleware.ts
  - src/app/(auth)/login/page.tsx
  - MSA Schedule 4 §8 (mandatory MFA for staff roles)
  - MSA Schedule 1 §2 (Gate G3 / G4 sign-off)
---

> **Status (2026-05-22): CLOSED — shipped to production and enforced.**
> The MVP (PR #50) was re-applied behind a production-only feature flag in
> **PR #56** (merged to `staging`), smoke-tested on `staging` with
> `STAFF_MFA_ENFORCED=true` (enrolment + login confirmed), then promoted to
> `main` in **PR #57**. Staff MFA is now **enforced in production** by default
> via `VERCEL_ENV === 'production'` (see "Decision: feature-flag"). The §8
> acceptance gate is satisfied.
>
> **Enforcement matrix:** prod = ON (default); staging/local = OFF unless
> `STAFF_MFA_ENFORCED=true`. Kill-switch: set `STAFF_MFA_ENFORCED=false` in the
> prod env + redeploy to disable without a code revert.
>
> **Recovery (MVP):** admin-reset-only — an ADMIN clears a staff member's
> factor from `/users`, or the manual SQL under "Lockout recovery". No
> self-service backup codes in the MVP (deferred — see below).
>
> **Still deferred to follow-ups:** backup/recovery codes, WebAuthn/passkey,
> force-re-enrolment policy. Tracked under "Deferred" below.

## Why it matters

- **Hard MSA acceptance gate** (Schedule 4 §8) — no production Go-Live without
  staff MFA; the §9 acceptance checkbox can't be ticked until it's enforced in
  prod.
- Until it's enforced, every staff account is one credential leak away from
  full read access to the entire bursary dataset (all applicant PII). B9
  narrowed the *write* surface to admin-only via RLS, but the *read* surface
  stays wide for admin/assessor/viewer.

## What was built (PR #50)

1. **Middleware aal2 gate** (`src/middleware.ts`): on `/admin/*`, staff roles
   {ADMIN, ASSESSOR, VIEWER} must be at `aal2`; `aal1` redirects to
   `/login/mfa?next=<path>`. `aal` is read by decoding the validated
   access-token JWT (no extra round-trip), **fail-closed** (decode failure →
   `aal1`). APPLICANTs are never gated.
2. **`/login/mfa` route**: server component that `listFactors()` and branches —
   **setup** (no factor: inline QR SVG + plaintext secret →
   `enroll`/`verify`) or **challenge** (factor exists: code only →
   `challenge`/`verify`). Verify elevates the session to `aal2`.
3. **Login redirect** (`src/app/(auth)/login/page.tsx`): staff sign-in routes
   to `/login/mfa` instead of `/admin`. APPLICANT flow unchanged.
4. **Admin "reset a staff member's MFA"** (`/users`, ADMIN-only): service-role
   `auth.admin.mfa.deleteFactor` + confirm dialog, writes a `RESET_STAFF_MFA`
   audit row. This satisfies walkthrough **admins/14** (it was in the deferred
   list below but was built because the guide needs it).

## Verified behaviour (walkthrough re-walk, on a local prod build)

- **Gate + enrolment:** staff login with no factor → `/login/mfa` setup; first
  TOTP code elevates to `aal2`; `/queue` then reachable **without** bouncing
  back (post-verify session/cookie refresh works).
- **Challenge:** with a factor present, `/login/mfa` shows the code-only
  challenge; a fresh code reaches `/queue`.
- **Applicant unaffected:** APPLICANT logs straight into the portal, no MFA.
- **Admin reset (admin/14):** the per-user Reset MFA control clears the
  target's `auth.mfa_factors` row and writes `RESET_STAFF_MFA` (SQL-confirmed).

## Decision: feature-flag MFA enforcement (2026-05-22)

Goal: enforce MFA **only in production**, so staging/local testing isn't
blocked — while keeping it impossible to accidentally ship prod with MFA off.

- **Where:** enforcement lives in exactly two places — the middleware `aal2`
  gate **and** the staff login → `/login/mfa` redirect. **Gate both on the
  flag.** The `/login/mfa` page and enrol/challenge can stay reachable
  regardless; only the *forced* enforcement is flagged.
- **Signal — do NOT use `NODE_ENV`.** Staging is also a production build
  (`NODE_ENV=production`) pointed at nonprod, so `NODE_ENV` can't distinguish
  prod from staging.
- **Recommended:** default-enforce when **`VERCEL_ENV === 'production'`**, with
  an explicit override env var (e.g. **`STAFF_MFA_ENFORCED`**). Result:
  - **Prod:** on by default (compliance-safe; can't forget to enable it).
  - **Staging / local:** off by default (easy testing).
  - **Staging smoke test:** set `STAFF_MFA_ENFORCED=true` in the staging env to
    exercise MFA with real staff before go-live.
- **Bonus — kill-switch.** With the explicit env var, MFA can be turned **off
  in prod by flipping the var + redeploy**, with no code revert. This directly
  de-risks the deploy-day lockout scenario below.
- **Trade-off:** staging no longer mirrors prod auth by default — so the
  discipline is to toggle the flag on in staging and have real staff enrol
  *before* trusting it in prod.

## Known rough edge — FIXED (PR #56)

The very first `/login/mfa` hit immediately after login could race and create a
**duplicate unverified factor** → "A factor with the friendly name … already
exists". Two fixes shipped in PR #56:

1. **Idempotent dedup** — unenrol stale **unverified** factors before `enroll`.
   The original loop iterated `listFactors().totp`, but the Supabase JS client
   only populates `.totp` with **verified** factors (unverified live in `.all`),
   so the dedup was a no-op; it now iterates `.all`.
2. **Unique friendly name** — the dedup alone can't help on a true first hit
   (the login `router.push` + `router.refresh` fires two concurrent server
   renders, each calling `enroll()` with the default empty name → collision).
   Each `enroll()` now gets a unique `staff-totp-<uuid>` friendly name, so
   concurrent enrolments both succeed; Supabase drops the orphan on verify.

Verified on the local prod build and on the staging smoke — no first-hit error.

## Lockout recovery

- **Admin reset (built):** an ADMIN clears another staff member's factor from
  `/users` (the admins/14 control).
- **Manual (superuser), e.g. if an admin is also locked out:**
  ```sql
  -- via supabase-prod MCP / dashboard:
  DELETE FROM auth.mfa_factors WHERE user_id = '<uuid>';
  ```
  After deletion the user is back to `aal1` and re-enrols on the next staff
  route hit.
- **Self-service backup codes are NOT in the MVP** (see deferred) — today a
  staff member who loses their authenticator depends on an admin / the SQL.

## Rollout runbook — DONE

1. ✅ Re-applied PR #50's code **with the feature flag** (gated the middleware
   gate + the login redirect) and fixed the duplicate-factor race — **PR #56**,
   merged to `staging`. Off in staging/local by default.
2. ✅ Smoke-tested on `staging` with `STAFF_MFA_ENFORCED=true` — enrolment +
   login confirmed working (2026-05-22).
3. ✅ No blocking issues surfaced.
4. ✅ **Prod turn-on** — promoted to `main` in **PR #57**; prod enforces via the
   `VERCEL_ENV=production` default. Every staff user is funnelled to
   `/login/mfa` on their next admin action.
5. ⏭️ **Operational watch:** confirm Foundation staff enrol successfully on
   their first prod sign-in; kill-switch (`STAFF_MFA_ENFORCED=false` + redeploy)
   and the lockout SQL remain on standby.

## Deferred to a follow-up (post-MVP)

- **Backup / recovery codes** — generate N single-use codes at enrolment, store
  as bcrypt hashes, accept one on the challenge page → elevate to `aal2`. (The
  main UX gap; decide whether it's needed *before* go-live — see Open
  decisions.)
- **Force re-enrolment policy** (e.g. on device replacement) — same path as
  admin reset.
- **WebAuthn / passkey** factor as a TOTP alternative (same Supabase MFA API).
- **IP allow-lists, password-rotation, session-timeout tuning** — separate
  Schedule 4 §8 items, not B8.

## Open decisions — RESOLVED (2026-05-22, owner: Brian)

1. **Flag signal:** ✅ **Both** — `VERCEL_ENV === 'production'` default + an
   explicit `STAFF_MFA_ENFORCED` override (kill-switch). Shipped in PR #56.
2. **Backup codes:** ✅ Ship MVP go-live with **admin-reset-only** recovery;
   self-service backup codes deferred to a follow-up.
3. **Rollout timing:** ✅ Staging smoke (2026-05-22) → prod turn-on the same day
   via PR #57. Real staff enrol on their next prod sign-in.

## Implementation notes (for re-applying #50 + flag)

- Supabase Auth JS supports TOTP via `auth.mfa.enroll` / `challenge` / `verify`
  / `listFactors` / `getAuthenticatorAssuranceLevel`.
- `enroll({ factorType: "totp" })` returns `data.totp.qr_code` (SVG) and
  `data.totp.uri` (otpauth://) — render the SVG inline, no extra client lib.
- The session JWT carries `aal: "aal1" | "aal2"`; middleware decodes it
  directly (Edge-safe) — fail-closed on decode error.
- Existing staff are `aal1` after enable; funnelled to setup on next admin hit.
  No data migration required (MVP MFA was code-only).
