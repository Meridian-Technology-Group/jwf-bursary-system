# Microsoft SSO — feasibility spike (D21)

**Status:** spike / feasibility note only — **no implementation.**
**Epic:** [11 — Auth & access](../backlog/process-alignment/plans/11-auth-and-access.md) §5.2.
**Decision gate:** **D21** — after this spike, the client decides whether to
commission the build. Default if unanswered: stay on email/password + TOTP; SSO
remains a backlog item.

> **One-line verdict.** Microsoft (Entra ID) sign-in is **feasible** on the
> current Supabase stack with a **small amount of app code** plus a **client-IT
> tenant configuration**. The real engineering work is **not** the OAuth wiring
> (largely already present) — it is **how a federated identity acquires a role**.
> Estimated build: **~1–2 days** for a wired proof-of-concept; a **hardened
> production build is a further, separately-estimated** piece.

---

## 1. Why this is a spike, not a build

The client raised "federated Microsoft sign-in / SSO" explicitly as a **backlog
item**, not a must-have (see `source-materials/meeting-findings.md`,
"Authentication / access"). It is a genuine new capability — unlike "disable MFA
in staging", which was already solved. Nothing in the data model, the bursary
process, or any other epic depends on it. So it is scoped here as a costed
feasibility note that lets the client fund (or shelve) it with eyes open.

## 2. Current auth baseline (what SSO has to slot into)

- **Provider:** Supabase Auth, **email/password + TOTP (aal2)** only. No
  `signInWithOAuth`, no Azure/Microsoft provider, no SAML/OIDC anywhere in `src/`.
- **Callback plumbing already exists:** `/auth/callback` terminates Supabase
  OAuth/PKCE redirects and is whitelisted in `middleware.ts`. An OAuth round-trip
  would reuse it largely unchanged.
- **Roles come from the JWT:** `app_metadata.role`, stamped by a Supabase DB
  function/trigger at sign-up and read in `middleware.ts` (`getRoleFromSession`)
  and `src/lib/auth/roles.ts`. **A federated user arrives without that stamp.**
- **MFA gate:** `isStaffMfaEnforced()` (`src/lib/auth/mfa-flag.ts`) forces staff
  to aal2 in prod via the middleware. SSO interacts with this (see §5).

## 3. Provider wiring (the easy ~20%)

Supabase Auth ships a first-class **Azure (Microsoft Entra ID)** OAuth provider.

- **App side (code):** a "Sign in with Microsoft" button on `(auth)/login`
  calling:
  ```ts
  supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: "email", redirectTo: `${appUrl}/auth/callback` },
  });
  ```
  The existing `/auth/callback` exchanges the code for a session. This is a small,
  self-contained addition.
- **Tenant side (client IT — NOT code):** an **Entra ID app registration**
  (client id + secret), with redirect URIs for the prod origin **and each preview
  origin that must support SSO**, configured into the Supabase project's Azure
  provider settings. This is the **client/IT dependency** — flag it early; it
  gates any real round-trip.

## 4. Role mapping — the real work (the hard ~80%)

Today every account gets `app_metadata.role` stamped at sign-up. An SSO user
authenticates against Entra and lands in Supabase **with no role**, so
`getRoleFromSession` falls through to the `APPLICANT` default
(`middleware.ts`) — which would **mis-route a staff member into the parent
portal**. The build cannot ship until this is resolved. Options, roughly
increasing in robustness and cost:

1. **Domain allowlist → default staff role.** If the email domain is the
   Foundation's, stamp a default staff role (e.g. `VIEWER`) on first SSO sign-in
   via an auth hook / `on_auth_user_created` trigger, then elevate manually in the
   `/users` admin. Simplest; relies on a trusted domain and a manual elevation
   step.
2. **Admin invite / claim step.** SSO sign-in for an un-provisioned identity
   lands in a "pending — ask an admin to grant access" holding state; an ADMIN
   binds the role. Safest least-privilege posture; adds a provisioning flow.
3. **Entra group-claim → role mapping.** Map Entra security-group membership
   (group claims in the token) to {ADMIN, ASSESSOR, VIEWER}. Best long-term (IT
   manages access centrally) but the heaviest: requires group claims configured on
   the tenant **and** a mapping table/trigger on our side.

**Recommendation:** for a first build, **option 1 (domain allowlist → `VIEWER`)
plus manual elevation**, with option 3 as a documented later upgrade. Whichever is
chosen, the role-stamp must live in the **same DB trigger/hook** that already
stamps email/password sign-ups, so there is one source of truth for roles.

## 5. MFA interaction (D21 sub-decision)

If Entra enforces MFA upstream, decide whether Supabase should still require aal2
(`isStaffMfaEnforced()`) for SSO sessions, or treat the IdP as the second factor.
A Supabase OAuth session is typically **aal1** unless the user also enrols a
Supabase TOTP factor — so with the gate **on**, an SSO staff user would be bounced
to `/login/mfa` and asked to enrol a *second* second-factor, which is poor UX if
Entra already did MFA. The build should special-case SSO sessions in the
`middleware.ts` aal2 gate (e.g. skip the Supabase aal2 requirement when the
identity provider is `azure` and the tenant enforces MFA). This is a deliberate
trust decision for the client + their IT, not a default.

## 6. Account model & coexistence

- **Staff-only, most likely.** Parents use email/password; SSO is for Foundation
  staff. Keep the email/password + TOTP path as-is for applicants.
- **Identity linking.** If a staff member already has an email/password account at
  the same address, Supabase **identity linking** governs whether the Azure
  identity attaches to the existing user or creates a duplicate. The build must
  decide and configure this (link-by-email vs separate identities) to avoid
  split-brain staff accounts.

## 7. What does NOT change

- Parent applicant auth (email/password + TOTP).
- The role model itself ({ADMIN, ASSESSOR, VIEWER, APPLICANT}) and RLS — SSO only
  changes *how a role is acquired*, not what roles mean.
- Rate limiting (Vercel WAF) and the existing logout/CSRF route.
- Data model / Prisma schema — **no migration** is required for SSO; roles live in
  `app_metadata`, not a Prisma table.

## 8. Effort & risks

| Item | Effort | Owner |
|---|---|---|
| "Sign in with Microsoft" button + callback reuse | hours | dev |
| Entra app registration + redirect URIs + Supabase provider config | hours | **client IT** (blocking dependency) |
| Role-stamp strategy (option 1) + auth hook/trigger | ~1 day | dev |
| MFA-interaction decision + middleware special-case | hours | dev + client |
| Identity-linking config + testing | hours | dev |
| **Wired PoC total** | **~1–2 days** | — |
| Hardened production build (group claims, multi-origin, tests, runbook) | **separately estimated** | — |

**Key risks:**
- **Role-mapping gap** — an un-stamped SSO user defaulting to `APPLICANT` and
  being mis-routed. *Mitigation: the role-stamp strategy is the build's central
  deliverable; do not ship SSO until it is in place.*
- **Tenant dependency** — no Entra app registration ⇒ no round-trip. *Mitigation:
  raise the IT dependency at commissioning, before any dev time is spent.*
- **MFA double-prompt** — SSO staff asked to enrol a second TOTP on top of Entra
  MFA. *Mitigation: settle the §5 decision up front.*

## 9. Recommendation

**Feasible and low-code for the happy path; the cost is the role-mapping design,
not the OAuth.** Recommend the client decide D21 with this note in hand: if
commissioned, build option 1 (domain-allowlist role stamp + manual elevation) as
a ~1–2-day PoC on a feature branch, demonstrate the Entra round-trip and the
role-stamp end to end, then scope the hardened production build separately. Until
then, the system stays on email/password + TOTP and SSO remains in the backlog.
