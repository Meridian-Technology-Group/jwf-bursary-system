---
title: B8 — MFA (TOTP) for ADMIN / ASSESSOR / VIEWER
status: open
severity: critical
area: auth, security, compliance
opened: 2026-05-19
opened_by: Claude (via Brian Wagner)
state: built + verified, then reverted; held for feature-flag + go-live decision
related:
  - PR #50 (MVP TOTP MFA gate, /login/mfa enrol+challenge, admin reset-MFA control) — built & verified
  - PR #53 (revert of #50 on staging) — MFA backed out pending this decision
  - PR #54 (staging → main promotion) — explicitly EXCLUDED MFA
  - docs/walkthroughs/admins/14-reset-staff-mfa.md
  - src/middleware.ts
  - src/app/(auth)/login/page.tsx
  - MSA Schedule 4 §8 (mandatory MFA for staff roles)
  - MSA Schedule 1 §2 (Gate G3 / G4 sign-off)
---

> **Status (2026-05-22): built and verified, then deliberately reverted.**
> The MVP was implemented in **PR #50** and verified end-to-end on a local
> prod build (see "Verified behaviour" below). It was then **reverted from
> `staging` in PR #53** and **excluded from the `staging → main` promotion
> (PR #54)**. So **no environment enforces staff MFA today** (prod, staging,
> and local are all single-factor right now).
>
> It was held back for two reasons, both tracked here:
> 1. **Make it feature-flagged** so it only enforces in production and doesn't
>    block testing in staging/local (see "Decision: feature-flag" below).
> 2. **Settle the go-live questions** (backup codes vs admin-reset-only; the
>    rollout window) before turning it on (see "Open decisions").
>
> The code is preserved in git history. **Re-enable by re-applying #50 *with*
> the feature flag added** (preferred over a plain revert-of-the-revert, so the
> flag ships at the same time).

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

## Known rough edge (fix before turn-on)

The very first `/login/mfa` hit immediately after login can race and create a
**duplicate unverified factor** → "A factor with the friendly name … already
exists". A page reload (when no verified factor exists) recovers and shows the
setup screen. Before go-live, make enrol idempotent: unenrol/dedupe any stale
**unverified** factor before calling `enroll`. (Non-blocking, but real staff
shouldn't see it on day one.)

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

## Rollout runbook (recommended)

1. Re-apply PR #50's code **with the feature flag added** (gate the middleware
   gate + the login redirect); fix the duplicate-factor race. Off in
   staging/local by default.
2. Set `STAFF_MFA_ENFORCED=true` on the **staging** env; have the real
   Foundation staff (e.g. Alex, Charlotte, the assessors) enrol + smoke-test on
   the staging URL. (This is the b8 mitigation — a real pre-prod smoke.)
3. Fix anything the smoke surfaces.
4. **Coordinated prod turn-on** in a window: enable in the Vercel **Production**
   env (or rely on the `VERCEL_ENV` default), with the lockout SQL ready and an
   admin on standby. Every staff user is funnelled to `/login/mfa/setup` on
   their next admin action.
5. Confirm a couple of staff enrol successfully; keep the env kill-switch handy.

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

## Open decisions (need owner input)

1. **Flag signal:** `VERCEL_ENV === 'production'` default, explicit
   `STAFF_MFA_ENFORCED` env var, or **both** (recommended)?
2. **Backup codes:** build self-service recovery codes **before** go-live, or
   ship MVP go-live with **admin-reset-only** recovery and add codes after?
3. **Rollout timing:** when to run the staging smoke + the coordinated prod
   turn-on, and which staff enrol first.

## Implementation notes (for re-applying #50 + flag)

- Supabase Auth JS supports TOTP via `auth.mfa.enroll` / `challenge` / `verify`
  / `listFactors` / `getAuthenticatorAssuranceLevel`.
- `enroll({ factorType: "totp" })` returns `data.totp.qr_code` (SVG) and
  `data.totp.uri` (otpauth://) — render the SVG inline, no extra client lib.
- The session JWT carries `aal: "aal1" | "aal2"`; middleware decodes it
  directly (Edge-safe) — fail-closed on decode error.
- Existing staff are `aal1` after enable; funnelled to setup on next admin hit.
  No data migration required (MVP MFA was code-only).
