---
title: Auth & access — verify MFA gating, scope Microsoft SSO, optional inactivity logout
status: planned
severity: low
area: auth, access
wave: 4
depends_on: []
sources:
  - ../source-materials/meeting-findings.md    # "Authentication / access"
related:
  - 00-current-state-map.md
  - src/lib/auth/mfa-flag.ts
  - src/middleware.ts
  - docs/operations/waf-auth-rate-limiting.md
  - docs/operations/environment-variables.md
---

# 11 — Auth & access

**Objective.** Close out the three small "Authentication / access" asks from the
client demo. In order of effort, smallest first:

1. **MFA in staging vs prod** — *already built and env-gated*; this is a
   **verification + documentation** task, not a build.
2. **Optional inactivity / session-timeout logout** — a small, self-contained
   build if the client wants it.
3. **Federated Microsoft sign-in / SSO** — a genuine new capability; scoped here
   as a **time-boxed spike**, explicitly **not** a committed build.

This epic is deliberately the lightest in the programme. It has **no schema
change** and **no dependency on any other epic** — it can be picked up in any
wave (slotted at Wave 4 only because it is low priority, not because it is
blocked).

> **Honesty note.** The single biggest item the client raised — "disable MFA in
> staging" — was already solved before the demo. The real action there is to
> *confirm the staging env is configured as intended and write it down*, so the
> client's request is visibly closed rather than silently met.

---

## 1. Background & rationale

[`meeting-findings.md`](../source-materials/meeting-findings.md)
("Authentication / access") lists exactly four lines:

- Disable **MFA in staging/test** to make testing easier.
- Keep **MFA enforced in production** for admin/assessor roles.
- Add **federated Microsoft sign-in / SSO** as a backlog item.
- Consider an optional **session timeout / inactivity logout** policy.

The first two describe behaviour the system **already has** (see §2). The third
is explicitly tagged by the client as *a backlog item*, not a must-have — so it
belongs here as a spike with an effort estimate, not as a delivery commitment.
The fourth is a "consider" — a candidate policy that needs a stakeholder
decision before any code is written.

None of these touch the data model, the bursary process, or any other epic; this
is purely an access-layer epic.

---

## 2. Current state

See [00 §F](00-current-state-map.md#f-settings-auth-audit-retention).
Grounded against the code as of 2026-06-05:

**MFA — built and environment-gated (the ask is essentially met):**

- TOTP enrolment + challenge flow lives at `src/app/(auth)/login/mfa/`
  (`page.tsx`, `mfa-setup-form.tsx`, `mfa-challenge-form.tsx`, `actions.ts`).
  `actions.ts` calls Supabase `auth.mfa.challenge()` / `auth.mfa.verify()` to
  elevate the session to **aal2**.
- The middleware gates all admin routes on aal2 **only when enforcement is
  enabled**: `src/middleware.ts:189` checks `isStaffMfaEnforced()`, and when true
  reads the `aal` claim from the validated access-token JWT
  (`getAalFromJwt(session?.access_token)`, `middleware.ts:193`), redirecting
  staff still at aal1 to `/login/mfa` (`middleware.ts:195`). APPLICANTs are never
  gated (`middleware.ts` comment, lines 24–26).
- The enforcement switch is `isStaffMfaEnforced()` at
  `src/lib/auth/mfa-flag.ts:29`: env `STAFF_MFA_ENFORCED` is authoritative when
  set (`"true"`/`"1"` → on, anything else → off, acting as a prod kill-switch);
  when **unset** it defaults to `VERCEL_ENV === "production"`
  (`mfa-flag.ts:34`).
- The login page applies the **same** flag client-side only to avoid an
  `/admin → /login/mfa` flash (`src/app/(auth)/login/actions.ts:16`
  `isStaffMfaEnforcedAction`, consumed at
  `src/app/(auth)/login/page.tsx:83-86`); the middleware remains the
  authoritative gate.

**Net effect today:** MFA is **ON in production** (default, can't be forgotten)
and **OFF in staging/preview/local** (default, testing isn't blocked) for
ADMIN / ASSESSOR / VIEWER — exactly what the client asked for. The flag is
documented in [`environment-variables.md:124`](../../../operations/environment-variables.md)
but is flagged there as **"Missing from `.env.example`"**.

**SSO — does not exist.** No `signInWithOAuth`, no Azure/Microsoft provider, no
SAML/OIDC anywhere in `src/` (grep clean). Auth is Supabase **email/password +
TOTP** only.

**Inactivity / session timeout — does not exist.** Logout is **explicit POST
only** (`src/app/api/auth/logout/route.ts`), with an Origin/Referer CSRF check
(route.ts:18-35) and a 303 redirect to `/login`. There is **no idle timer, no
`signOut`-on-inactivity, no max-session policy** in app code — session lifetime
is whatever the Supabase JWT/refresh-token defaults are. (The only `"idle"`
matches in the codebase are unrelated UI save-states.)

**Rate limiting** is handled at the **Vercel WAF layer**
([`waf-auth-rate-limiting.md`](../../../operations/waf-auth-rate-limiting.md)),
not in application code — out of scope for this epic, noted so it isn't
re-implemented.

---

## 3. Target state

1. **MFA gating — verified & documented.** `STAFF_MFA_ENFORCED` is confirmed
   **unset** on the staging Vercel scope (so the `VERCEL_ENV === "preview"`
   default keeps it off) and confirmed on/intended on prod, with the behaviour
   written into the env-vars matrix and `.env.example`. No behavioural change.
2. **Microsoft SSO — decisioned, with a costed spike outcome.** A short spike
   establishes the Supabase **Azure (Microsoft Entra ID) provider** approach,
   the role-mapping/JWT implications, and an effort estimate, so the client can
   decide whether to fund the build. No production SSO ships under this epic
   unless the client explicitly commissions it after the spike.
3. **Inactivity logout — built only if the client opts in.** If approved
   (decision **D20**), a client-side idle watcher signs the user out after
   a configurable period of no interaction, with a short "you'll be signed out"
   warning, applied to staff (and optionally portal) sessions.

---

## 4. Gap analysis

| Target | Today | Action |
|---|---|---|
| MFA off in staging, on in prod | **Already true** (`mfa-flag.ts:34` default) | **Verify** staging env; no code change |
| `STAFF_MFA_ENFORCED` discoverable by ops | Documented in env matrix; **absent from `.env.example`** | Add to `.env.example` with a comment |
| Microsoft / Entra SSO sign-in | None (no OAuth provider) | **Spike**: Supabase Azure provider + role mapping; estimate; backlog decision |
| Inactivity / max-session logout | None (explicit POST logout only) | **Optional build**: idle watcher → `/api/auth/logout`; gated on D20 |
| Rate limiting | Vercel WAF (out of scope) | none |

---

## 5. Proposed approach

No Prisma schema change in this epic. No reference/seed-data change.

### 5.1 MFA gating — verify & document (no code change to the gate)

- Confirm the staging Vercel scope has **no** `STAFF_MFA_ENFORCED` value set
  (Vercel → Project → Settings → Environment Variables, *Preview* scope). The
  `mfa-flag.ts:34` default then keeps it off for `VERCEL_ENV === "preview"`.
- Confirm prod relies on the same default (or has an explicit `STAFF_MFA_ENFORCED`
  on if the team prefers to make it explicit) — already covered operationally by
  the incident-response kill-switch note.
- **Doc-only changes:**
  - Add `STAFF_MFA_ENFORCED` to `.env.example` with a one-line comment (closes
    the gap flagged at `environment-variables.md:124`).
  - Add a short "MFA in non-prod" note to the env-vars matrix / runbook stating
    the verified staging posture so a future env reset can't silently re-enable
    it.
- **No change** to `mfa-flag.ts`, `middleware.ts`, or the login flow. The
  existing `STAFF_MFA_ENFORCED=true` smoke-test path (used for the demo, see
  `docs/demo-script.md`) remains the way to *temporarily* exercise MFA on
  staging without making it the default.

### 5.2 Microsoft SSO — time-boxed spike (Supabase Azure provider)

Deliver a written spike outcome, not production code. The spike should establish:

- **Provider wiring.** Supabase Auth ships an **Azure (Microsoft Entra ID)**
  OAuth provider. The app-side call is `supabase.auth.signInWithOAuth({ provider:
  "azure", options: { scopes: "email", redirectTo: <app>/auth/callback } })`
  from a new "Sign in with Microsoft" button on `(auth)/login`. The existing
  `/auth/callback` route already terminates Supabase OAuth/PKCE redirects (it is
  whitelisted in `middleware.ts:41`), so the callback plumbing largely exists.
- **App registration.** An Entra ID app registration (client id/secret, redirect
  URIs for prod + each preview origin) configured into the Supabase project's
  Azure provider settings. This is **client-tenant config**, not code — flag it
  as a client/IT dependency.
- **Role mapping — the real work.** Today roles come from `app_metadata.role`,
  stamped by a Supabase DB function/trigger and read in `middleware.ts:67`
  (`getRoleFromSession`) and `roles.ts`. An SSO user arrives **without** that
  stamp, so the spike must decide how a federated identity acquires a role:
  domain-allowlist → default role, an admin invite/claim step, or a mapping from
  Entra group claims. This is the part that makes SSO a build, not a config
  toggle.
- **MFA interaction.** If Entra enforces MFA upstream, decide whether Supabase
  should still require aal2 (`isStaffMfaEnforced`) for SSO users or treat the IdP
  as the second factor — affects the `middleware.ts:189` gate for SSO sessions.
- **Account model.** Whether SSO is staff-only (most likely — parents use
  email/password) and how it coexists with existing email/password accounts for
  the same address (Supabase identity linking).

**Spike effort estimate:** ~**1–2 days** to produce a wired proof-of-concept on
a feature branch (button → Azure round-trip → role-stamp strategy demonstrated)
plus the written recommendation. A **production build** (hardened role mapping,
group-claim handling, multi-origin redirect config, tests, runbook) is a
**further, separately-estimated** piece — do not start it without an explicit
client go-ahead. Tracked as decision **D21**.

### 5.3 Optional inactivity / session-timeout logout (gated on D20)

If the client opts in, a focused client-side build:

- A small idle-watcher component (mounted in the admin layout, and optionally the
  portal layout) listening for activity events (`mousemove`, `keydown`, `click`,
  `visibilitychange`), debounced. After **N** minutes of no activity it shows a
  brief "You'll be signed out shortly" warning, then POSTs to the existing
  `/api/auth/logout` (which already clears Supabase cookies + redirects), so no
  new logout primitive is needed.
- The timeout window is a constant/env-config (e.g. `SESSION_IDLE_MINUTES`),
  defaulting to a sensible value (e.g. 30 min) and applied to **staff** by
  default; whether to also apply it to the **parent portal** is part of D20.
- This is an *idle* (inactivity) timeout layered on top of Supabase's own
  JWT/refresh expiry; it does not change Supabase token lifetimes. If a hard
  **absolute** max-session is also wanted, that is a Supabase Auth project
  setting (token expiry), noted but not built in app code.
- **Server enforcement note.** The idle watcher is a UX convenience; the
  authoritative session boundary remains Supabase token expiry checked in
  `middleware.ts` via `getUser()`. A purely client-side timer can be defeated, so
  if the requirement is *security-grade* rather than *convenience*, the spike
  should weigh shortening the Supabase JWT TTL instead — call this out when
  presenting D20 so the client picks the right tool.

### 5.4 UI

- 5.1: none (env + docs only).
- 5.2 spike: a throwaway "Sign in with Microsoft" button on the login page on a
  spike branch; not merged unless the build is commissioned.
- 5.3: an unobtrusive idle-warning toast/dialog; no new pages.

---

## 6. Work breakdown (PR-sized)

Proportionate to a small epic — most of the weight is verify/document and a
spike, with one optional build.

- [ ] **PR-1 (docs, no behaviour change):** add `STAFF_MFA_ENFORCED` to
      `.env.example` with a comment; add a "MFA in non-prod (verified off on
      staging)" note to the env-vars matrix / runbook. *(closes the §5.1 ask)*
- [ ] **OPS task (no PR):** verify the staging Vercel scope has
      `STAFF_MFA_ENFORCED` unset (default-off) and record the result in the PR-1
      note. *(the actual "disable MFA in staging" confirmation)*
- [ ] **SPIKE branch (not merged):** Supabase Azure-provider PoC + written
      role-mapping recommendation and a build estimate → feeds **D21**.
      *(§5.2)*
- [ ] **PR-2 (optional, gated on D20):** idle-watcher component +
      `SESSION_IDLE_MINUTES` config, wired to the existing
      `/api/auth/logout`; warning UX; mounted in admin (and optionally portal)
      layout. *(§5.3)*

---

## 7. Open decisions

Added to the programme [Decision register](../README.md#5-decision-register) as
auth-specific items (owner: Brian for technical posture; Charlotte/JWF IT for the
SSO commercial/tenant decision):

- **D20** — Do we want an inactivity-logout policy, and if so: what idle
  window, and does it apply to the parent portal as well as staff? Or is the
  Supabase token-TTL the better lever? *(Default if unanswered: do not build;
  keep explicit logout only.)* — gates **PR-2**.
- **D21** — After the SSO spike, does the client commission the Microsoft
  SSO build? Requires an Entra app registration on the client's tenant and a
  role-mapping strategy decision. *(Default if unanswered: remain on
  email/password + TOTP; SSO stays in backlog.)* — gates any SSO build PR.

---

## 8. Risks & mitigations

- **"Disable MFA in staging" misread as a build.** It's already done — the risk
  is wasted effort or accidentally weakening prod. *Mitigation:* this epic is
  scoped as verify+document; **no change** to `mfa-flag.ts`/`middleware.ts`.
- **Env drift re-enabling MFA on staging.** A future env reset could set
  `STAFF_MFA_ENFORCED` or change `VERCEL_ENV` handling. *Mitigation:* PR-1
  records the intended staging posture in the runbook + `.env.example`.
- **SSO role-mapping gap.** A federated user with no `app_metadata.role` would
  fall through `getRoleFromSession` to `APPLICANT` (`middleware.ts:77`) and could
  be misrouted. *Mitigation:* the spike's central deliverable is the role-stamp
  strategy; no SSO ships until it's resolved (D21).
- **Client-side idle timer is not a hard security control.** It can be bypassed.
  *Mitigation:* present D20 with the Supabase-TTL alternative so the client
  chooses convenience vs security-grade; don't oversell the timer.
- **Don't regress rate limiting.** Auth abuse is handled at the Vercel WAF
  (`waf-auth-rate-limiting.md`). *Mitigation:* leave it untouched; this epic adds
  no app-layer auth throttling.

---

## 9. Out of scope / deferred

- **Parent-portal logout visibility** (meeting "logout visibility was missing").
  The admin nav has logout (`src/components/admin/admin-nav.tsx`); the portal has
  no logout control. That is a **defect fix → [Epic 12]**, not an access-policy
  change, so it is handled there.
- **Cross-persona session collisions** (meeting "login/out across personas
  caused confusion") → **[Epic 12]** defect list.
- **Auth rate limiting** — owned by the Vercel WAF runbook; not re-implemented
  here.
- **Production Microsoft SSO build** — deferred behind the spike + D21; only
  the spike is in scope now.
- **Hard absolute max-session / Supabase JWT-TTL changes** — a Supabase project
  setting, noted in §5.3 but not built in app code under this epic.

---

## 10. Acceptance criteria

- **MFA:** `STAFF_MFA_ENFORCED` is confirmed unset on staging (recorded in the
  runbook), present in `.env.example` with a comment, and staff sign-in on
  staging reaches `/admin` **without** an MFA challenge while prod still gates on
  aal2 — with **no change** to `mfa-flag.ts` or `middleware.ts`.
- **SSO:** a spike outcome exists — a PoC branch demonstrating the Supabase Azure
  round-trip and a written role-mapping recommendation with a build estimate —
  and D21 is on the register for the client to decide. No SSO code is merged
  to staging/prod under this epic.
- **Inactivity logout:** either D20 is "no" (nothing built, decision
  recorded), or the idle watcher signs an inactive staff user out via
  `/api/auth/logout` after the configured window, with a prior warning, applied
  per the D20 scope.
- No Prisma migration and no reference/seed-data change land in this epic.
