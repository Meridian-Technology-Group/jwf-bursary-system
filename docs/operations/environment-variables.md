# Environment Variables

MSA Schedule 1 §4 deliverable (technical/operational guide). This is the
authoritative list of every environment variable the system reads, what each is
for, whether it is a secret, where its value comes from, and which value each
environment uses. It is written for an engineer with **no prior Supabase,
Vercel or Resend experience**.

## Purpose

The authoritative list of environment variables, where each is set, and which
project/value each environment uses.

---

## 1. The three places variables live

There are three distinct stores. Mixing them up is the single most common cause
of an environment misroute, so read this first.

| Store | Read by | When | Notes |
|---|---|---|---|
| **Vercel-managed environment variables** | The deployed app on Vercel | Production / Preview / Development runs | The source of truth for anything that runs *on Vercel*. Set in the Vercel dashboard (§4). Scoped per environment — see §2. |
| **`.env.local`** | The app **and** the seed scripts when run **locally** | `npm run dev`, `npm run seed:reference`, `npm run seed:demo` | Git-ignored. Populate from the **nonprod** project for local work. The seed scripts load it with `override: false`, so an explicit `process.env`/CI value wins over it. |
| **`.env`** | The **Prisma CLI** (`prisma migrate`, `prisma generate`) | Migrations and schema work from a workstation | Git-ignored. **Must point at the database you intend to change.** A stale `.env` is how a migration can hit the wrong project — verify the project ref before any write. |

- **Vercel** stores deploy-time/run-time variables for the hosted app.
- **`.env.local`** is for local app + seed runs.
- **`.env`** is read *only* by the Prisma CLI.

`.env.example` (committed) is the template — copy it to `.env.local` and fill it
in. Note that `.env.example` is currently **missing** two optional variables that
code reads: `NEXT_PUBLIC_APP_URL` and `SUPABASE_STORAGE_BUCKET` (both have safe
fallbacks — see the matrix). It also does not list `STAFF_MFA_ENFORCED` or
`ALLOW_DESTRUCTIVE_SEED` (both are intentionally opt-in). This is flagged for a
follow-up.

---

## 2. Vercel environment scopes → Supabase projects

When you add a variable in Vercel you choose one or more **scopes**: Production,
Preview, Development. The routing rule for this system is:

- **Production** scope → values for the **`supabase-prod`** project (the live
  custom domain, served from `main`).
- **Preview** scope → values for the **`supabase-nonprod`** project (staging
  alias and all `feature/*` previews).

So the *same variable name* (e.g. `NEXT_PUBLIC_SUPABASE_URL`) holds a **different
value** in Production vs Preview. This per-scope split is what keeps live data on
prod and test data on nonprod. See [`deployment.md`](deployment.md) §2.

---

## 3. The authoritative variable matrix

Scope key: **Public** = exposed to the browser (any `NEXT_PUBLIC_*` var; never
put a secret here). **Server** = readable only in server/Edge code. **Secret** =
server-only and sensitive; treat as a credential.

### Supabase (Auth + client)

| Variable | Scope | Where the value comes from | Production value | Preview value | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase dashboard → project → **Settings → API → Project URL** | `supabase-prod` URL | `supabase-nonprod` URL | Distinct per env. Read by the browser, server, and seed clients. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase → project → **Settings → API → Project API keys → `anon` `public`** | `supabase-prod` anon key | `supabase-nonprod` anon key | Safe to expose; gated by Row-Level Security. Distinct per env. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Supabase → project → **Settings → API → Project API keys → `service_role`** | `supabase-prod` service-role key | `supabase-nonprod` service-role key | **Bypasses RLS — full admin.** Server-only (used by the admin client for Storage and admin auth). **Never** place in a `NEXT_PUBLIC_*` var. See §5. |

### Database (Prisma)

| Variable | Scope | Where the value comes from | Production value | Preview value | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | **Secret** | Supabase → project → **Connect** → **Transaction pooler** (port **6543**) | `supabase-prod` transaction-pooler URL | `supabase-nonprod` transaction-pooler URL | Used by the running app for queries. `url` in `schema.prisma`. |
| `DIRECT_URL` | **Secret** | Supabase → project → **Connect** → **Session pooler** (port **5432**) | `supabase-prod` session-pooler URL | `supabase-nonprod` session-pooler URL | Used by `prisma migrate deploy`. `directUrl` in `schema.prisma`. Also stored as the GitHub Actions secrets `STAGING_DIRECT_URL` / `PROD_DIRECT_URL` for `db-push.yml`. |

> 📷 *Screenshot: Supabase "Connect" panel showing the Transaction pooler (6543) and Session pooler (5432) connection strings.*

### Email (Resend)

| Variable | Scope | Where the value comes from | Production value | Preview value | Notes |
|---|---|---|---|---|---|
| `RESEND_API_KEY` | **Secret** | Resend dashboard → **API Keys** → create key | Prod-domain key | Nonprod/test key | The app throws at startup if this is unset (`src/lib/email/resend.ts`). Use distinct keys per env. |
| `RESEND_FROM_EMAIL` | Server | The verified sending address on the Resend-verified domain | `bursary@jwf.org.uk` (on the verified domain) | Same or a test address | **Domain must be verified in Resend before go-live (G4).** Falls back to a default address in `src/lib/email/send.ts` if unset. |
| `RESEND_WEBHOOK_SECRET` | **Secret** | Resend dashboard → **Webhooks** → endpoint → **Signing Secret** (`whsec_…`) | Prod signing secret | Nonprod signing secret | Required by `/api/webhooks/resend` to verify event signatures (Svix). The handler rejects events when this is unset. Was previously commented out in staging — confirm it is set in both scopes. |

> 📷 *Screenshot: Resend dashboard → Webhooks → endpoint detail showing the Signing Secret field.*

### Rate limiting (Vercel KV / Upstash)

| Variable | Scope | Where the value comes from | Production value | Preview value | Notes |
|---|---|---|---|---|---|
| `KV_REST_API_URL` | Server | Vercel dashboard → **Storage** → the KV/Upstash store → **`.env` tab** | Prod KV REST URL | Nonprod KV REST URL | Used by `@upstash/ratelimit` for auth throttling (5 req / 15 min, by IP). |
| `KV_REST_API_TOKEN` | **Secret** | Same store → **`.env` tab** | Prod KV token | Nonprod KV token | Pairs with the URL. **If either is unset, the rate limiter fails OPEN (silently disabled)** — login/reset throttling is off (`src/lib/rate-limit.ts`). Required in Production. |

> 📷 *Screenshot: Vercel → Storage → KV store → ".env" tab listing KV_REST_API_URL and KV_REST_API_TOKEN.*

### App / Vercel

| Variable | Scope | Where the value comes from | Production value | Preview value | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public | Set manually to the live origin | `https://bursary.jwf.org.uk` (prod domain) | Optional | Highest-priority source for server-generated links (invite/reset emails) in `src/lib/app-url.ts`. If unset, the app falls back to the Vercel system URLs below. **Missing from `.env.example`.** |
| `SUPABASE_STORAGE_BUCKET` | Server | Set manually if a non-default bucket is used | Optional (default `"documents"`) | Optional | Read by the document-URL route; defaults to `"documents"`. **Missing from `.env.example`.** |
| `NODE_ENV` | Server | Set automatically by the build/runtime | `production` | `production` (preview builds are production builds) | Do **not** use to tell prod from staging — both are `production`. Use `VERCEL_ENV` instead. |
| `VERCEL_ENV` | Server | Set automatically by Vercel | `production` | `preview` (or `development` locally) | Distinguishes prod from staging/preview. Drives the MFA default (below) and the `app-url.ts` production-alias logic. |
| `VERCEL_URL` | Server | Set automatically by Vercel | per-deployment hostname | per-deployment hostname | Per-deployment unique URL; lowest-priority link fallback. |
| `VERCEL_BRANCH_URL` | Server | Set automatically by Vercel | branch hostname | branch hostname | Stable per-branch URL; used for preview-originated links. |
| `VERCEL_PROJECT_PRODUCTION_URL` | Server | Set automatically by Vercel | stable prod alias | (set but ignored on previews) | Used as the production link origin only when `VERCEL_ENV === "production"`. |
| `ALLOW_DESTRUCTIVE_SEED` | Server | Set only by the `seed:demo` npm script | not set | not set | Gate for the destructive demo seed. The `npm run seed:demo` script sets `ALLOW_DESTRUCTIVE_SEED=1` itself; never set it globally and never run the demo seed against a shared env. |

### MFA (multi-factor authentication)

| Variable | Scope | Where the value comes from | Production value | Preview value | Notes |
|---|---|---|---|---|---|
| `STAFF_MFA_ENFORCED` | Server | Set manually only to override the default | unset (defaults **on** in prod) | unset (defaults **off** in preview) | Forces staff (ADMIN/ASSESSOR/VIEWER) through the aal2 TOTP gate. `aal2` = "Authenticator Assurance Level 2", i.e. a second factor has been verified. Logic in `src/lib/auth/mfa-flag.ts`: when unset, enforced iff `VERCEL_ENV === "production"`; `"true"`/`"1"` forces on, anything else forces off (a prod kill-switch). **Missing from `.env.example`.** |

### Sentry (error monitoring)

Sentry is wired via `@sentry/nextjs` (see [`deployment.md`](deployment.md) §8 and
[`incident-response.md`](incident-response.md) §3). "DSN" = Data Source Name, the
endpoint Sentry events are sent to.

| Variable | Scope | Where the value comes from | Production value | Preview value | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Public | Sentry dashboard → **Settings → Projects → [project] → Client Keys (DSN)** | Prod project DSN | Same DSN (or a nonprod project DSN) | Client-side DSN. Safe to expose. Captures browser errors. |
| `SENTRY_DSN` | Server | Same Client Keys (DSN) page | Prod project DSN | Same DSN (or a nonprod project DSN) | Server/Edge DSN. Captures server-side exceptions. |
| `SENTRY_AUTH_TOKEN` | **Secret** | Sentry dashboard → **Settings → Auth Tokens** → create token | Build-time token | Build-time token | Used only at **build time** to upload source maps. Keep secret; scope to the org/project. |
| `SENTRY_ORG` | Server | Sentry dashboard → **Settings → Organization** (the slug) | org slug | org slug | Build-time; identifies the Sentry organisation for source-map upload. |
| `SENTRY_PROJECT` | Server | Sentry dashboard → **Settings → Projects** (the project slug) | project slug | project slug | Build-time; identifies the Sentry project for source-map upload. |

---

## 4. Adding or rotating a variable in Vercel

1. Vercel dashboard → the bursary project → **Settings** → **Environment
   Variables**.
2. **Key** = the variable name (exactly, case-sensitive).
3. **Value** = the secret/value.
4. **Environments** = tick the correct scope(s): **Production** for
   `supabase-prod` values, **Preview** for `supabase-nonprod` values. Tick only
   what applies — a prod secret must **not** be ticked for Preview.
5. **Save**.
6. **Redeploy for it to take effect.** Existing deployments do not pick up new
   values — trigger a new deployment (push, or Deployments → ⋯ → **Redeploy**).

> 📷 *Screenshot: Vercel → Settings → Environment Variables, "Add New" form with the Production / Preview / Development scope checkboxes visible.*

**To rotate a secret** (e.g. a leaked service-role key):
1. Generate the new value at the source (Supabase / Resend / KV dashboard).
2. Update the value in Vercel for the correct scope(s) and **Save**.
3. Update `.env.local` / `.env` and the matching GitHub Actions secrets
   (`STAGING_*` / `PROD_*` for DB URLs) where relevant.
4. **Redeploy.** Then revoke the old value at the source.

---

## 5. The service-role-key danger

`SUPABASE_SERVICE_ROLE_KEY` **bypasses Row-Level Security and grants full
database and Storage admin**. Three hard rules:

1. **Never** assign it to a `NEXT_PUBLIC_*` variable, and never reference it in
   client code — that would ship full admin rights to every browser.
2. Keep it in the **Secret** scope only; it is read solely by server code
   (`src/lib/auth/supabase-admin.ts`, Storage helpers).
3. If it is ever exposed, rotate it immediately (§4) and treat it as a security
   incident — see [`incident-response.md`](incident-response.md).

The same care applies to `DATABASE_URL`, `DIRECT_URL`, `RESEND_API_KEY`,
`RESEND_WEBHOOK_SECRET`, and `KV_REST_API_TOKEN`.
