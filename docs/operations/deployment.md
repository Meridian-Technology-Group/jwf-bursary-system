# Deployment Runbook

MSA Schedule 1 §4 deliverable (technical/operational guide). This runbook
explains how the John Whitgift Foundation (JWF) Bursary System is built and
deployed across environments, how database schema migrations reach each
database, and how to roll back a bad release. It is written so that an engineer
with **no prior Supabase, Vercel or GitHub Actions experience** can operate the
system from a cold start.

## Purpose

How the system is built and deployed across environments, and how schema
migrations reach each database.

---

## 1. The platforms, in plain terms

The system is a [Next.js 14](https://nextjs.org) (App Router) application written
in TypeScript. It depends on five external platforms. The first time each is
named below, here is what it is and the role it plays here:

- **Vercel** — the hosting platform. It runs the Next.js app, serves it on the
  public internet, and **automatically builds and deploys a new version every
  time code is pushed to GitHub**. Vercel is the equivalent of "the web server",
  but fully managed: there is no machine to log into.
- **Supabase** — a managed platform that bundles three things this app relies
  on: a **PostgreSQL database** (where all application data lives), **Auth**
  (login, sessions, multi-factor authentication), and **Storage** (the
  encrypted file bucket holding uploaded documents). There are two separate
  Supabase *projects*: `supabase-prod` (live data) and `supabase-nonprod`
  (staging/testing data).
- **GitHub** — where the source code lives, and where the CI (Continuous
  Integration) workflows run. CI = automated checks that run on every push.
- **Resend** — the transactional-email provider (invitation emails,
  password-reset links, status notifications). See
  [`environment-variables.md`](environment-variables.md) for its keys.
- **Vercel WAF** — Vercel's edge Web Application Firewall provides the
  login/password-reset **rate limiter** (a fixed-window rule defined in
  `vercel.json`). No external store or credentials are needed — see
  [`incident-response.md`](incident-response.md) §6.5. The only failure mode is
  the rule not being active in the Vercel project, which the go-live checklist
  guards.

> 📷 *Screenshot: Vercel dashboard project overview for the bursary system, showing the Production and Preview deployments side by side.*

---

## 2. Environment matrix

The project follows a **GitHub Flow + long-lived `staging`** branching model.
The authoritative rules are in [`CLAUDE.md`](../../CLAUDE.md); this table is the
operational summary.

| Git branch | Vercel environment | Supabase project | Public URL | Purpose |
|---|---|---|---|---|
| `main` | **Production** | `supabase-prod` | Live custom domain (e.g. `bursary.jwf.org.uk`) | Live service. Protected — no direct commits. |
| `staging` | **Preview (aliased)** | `supabase-nonprod` | Stable staging alias | Client testing. Long-lived integration branch. |
| `feature/*`, `fix/*`, `chore/*` | **Preview (per-branch)** | `supabase-nonprod` | Auto per-branch preview URL | Ephemeral work branches. |

Key consequences:

- **Production = `supabase-prod`. Every preview (staging and feature branches) =
  `supabase-nonprod`.** This routing is enforced by which environment-variable
  *scope* each value is set in on Vercel — see
  [`environment-variables.md`](environment-variables.md).
- `staging` is **aliased**: Vercel keeps a single stable preview URL pointing at
  the latest `staging` deployment, so the Foundation always tests the same
  address.
- Both `main` and `staging` are protected. Engineers branch off `staging`, open
  a PR to `staging`, and only the user promotes `staging → main`.

---

## 3. How a push becomes a deploy

Vercel is connected to the GitHub repository through the **Vercel GitHub
integration**. No manual deploy step is needed.

1. An engineer pushes a commit (or merges a PR) to any branch.
2. GitHub notifies Vercel via a webhook.
3. Vercel checks out that commit and runs the **build command** (§4).
4. On success, Vercel publishes the result:
   - Push to `main` → promoted to the **Production** domain.
   - Push to `staging` → published and the **staging alias** is updated.
   - Push to a `feature/*` branch → a unique **preview URL** is created (and
     posted as a comment on the PR).

In parallel, two GitHub Actions workflows run (§5): `ci.yml` (quality gates) and
`db-push.yml` (database migrations).

> 📷 *Screenshot: GitHub PR page showing the Vercel preview-deployment comment and the green CI checks.*

---

## 4. The build command

The build command is defined in [`package.json`](../../package.json):

```
build = prisma generate && next build
```

- `prisma generate` regenerates the type-safe Prisma database client from
  `prisma/schema.prisma`. It does **not** touch the database — it only writes
  client code.
- `next build` compiles the Next.js application (and runs `postinstall`'s
  `prisma generate` too).

The companion CI workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
runs on every PR and on pushes to `main`/`staging`. It validates the Prisma
schema, runs lint (non-blocking), typechecks with `tsc --noEmit`, and runs the
Vitest test suite. CI does not deploy anything — it is purely a quality gate.

Notes that matter operationally:

- The build **does not run migrations.** Schema changes are applied separately
  by `db-push.yml` (§5). This is deliberate — see §6.3.
- ESLint is skipped during `next build` (`eslint.ignoreDuringBuilds: true` in
  [`next.config.mjs`](../../next.config.mjs)); linting runs in CI instead.
- Security response headers (HSTS, CSP, `X-Frame-Options`, etc.) are defined in
  `next.config.mjs` and applied to every response.
- Deployments are pinned to the London region (`lhr1`) via
  [`vercel.json`](../../vercel.json), keeping compute in the UK alongside the
  UK/EEA Supabase data region (MSA clause 14.5, data residency).
- **Sentry** is part of the build: `@sentry/nextjs` is installed and the
  `@sentry/nextjs` plugin **uploads source maps during `next build`** (using
  `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`), so production stack
  traces map back to the original TypeScript. See §8 and
  [`environment-variables.md`](environment-variables.md).

---

## 5. The migration deploy path (authoritative)

Database schema changes are written as **Prisma migrations** — versioned SQL
files in `prisma/migrations/`. There are currently 20 applied migrations. The
golden rule (from `CLAUDE.md`): **every new migration ships in the same PR as
the code that needs it, and you never edit a migration that has already been
applied to staging or prod — you generate a new one.**

### 5.1 How migrations reach a database — `db-push.yml`

Migrations are applied automatically by the GitHub Actions workflow
[`.github/workflows/db-push.yml`](../../.github/workflows/db-push.yml). This is
the **real, primary migration path.** It runs on every push to `staging` and
`main`, and can also be triggered by hand.

It defines two jobs:

**`db-push-staging`** — runs when:
- a push lands on the `staging` branch, **or**
- the workflow is dispatched manually with `target = staging`.

It applies migrations to **`supabase-nonprod`** using two GitHub repository
secrets, `STAGING_DATABASE_URL` and `STAGING_DIRECT_URL`.

**`db-push-prod`** — runs when:
- a push lands on the `main` branch, **or**
- the workflow is dispatched manually with `target = production`.

It applies migrations to **`supabase-prod`** using `PROD_DATABASE_URL` and
`PROD_DIRECT_URL`.

Each job is **gated on its secrets**: the first step checks that both connection
strings are present. If either is missing, the job logs `Skipping … db push.
Missing: …` and exits without doing anything — it does not fail the build. This
is why the production secrets **must** be set as GitHub repository secrets before
go-live, or migrations silently will not apply to prod.

When the secrets are present, the job:
1. Checks out the repo.
2. Sets up Node 22.12.0 and runs `npm ci`.
3. Runs `npx prisma migrate deploy` with `DATABASE_URL` / `DIRECT_URL` set to the
   target environment's secrets.

`prisma migrate deploy` applies only migrations that have not yet run; it is safe
to re-run and never resets data.

> 📷 *Screenshot: GitHub → Actions → "DB push" workflow run, showing the "Push migrations to production" job and the "Prisma migrate deploy" step output.*

To trigger it manually (e.g. to apply a migration to prod after a `staging → main`
promotion if the automatic run was skipped):

1. GitHub repo → **Actions** tab → **DB push** workflow (left sidebar).
2. Click **Run workflow**.
3. Choose the branch and set **target** to `staging` or `production`.
4. Click **Run workflow** and watch the run log.

> 📷 *Screenshot: GitHub Actions "Run workflow" dropdown with the target = production option selected.*

### 5.2 Manual fallback

If GitHub Actions is unavailable, or a migration must be applied out-of-band,
apply it from a workstation:

1. Confirm Node 22.12.0 is on `PATH`.
2. Set `DATABASE_URL` and `DIRECT_URL` to the **intended** project's
   connection strings. The Prisma CLI reads `.env` (not `.env.local`) — so be
   certain `.env` points at the database you mean to change. Verify the project
   ref before any write.
3. Run:
   ```
   npx prisma migrate deploy
   ```
   `migrate deploy` uses `DIRECT_URL` (the session pooler on port 5432), not the
   transaction pooler.
4. Verify the applied migrations match `prisma/migrations/` (Supabase dashboard →
   the project → **Database** → **Migrations**, or list them via tooling).

Never run `prisma migrate deploy` against prod from a local machine without
explicit user approval, and never run `prisma migrate reset` against staging or
prod (`CLAUDE.md`).

### 5.3 Connection strings — pooler vs direct

`prisma/schema.prisma` uses two URLs:

- `url = env("DATABASE_URL")` — the **transaction pooler** on port **6543**, used
  by the running app for normal queries. ("Pooler" = a connection multiplexer
  that lets many serverless function instances share a small pool of Postgres
  connections.)
- `directUrl = env("DIRECT_URL")` — the **session pooler** on port **5432**, used
  for migrations, which need a stable single session.

Full details and value sources are in
[`environment-variables.md`](environment-variables.md).

> ℹ️ **Backlog status — closed.** The Vercel build deliberately does *not* run
> `prisma migrate deploy`; `db-push.yml` runs it instead via GitHub Actions
> against the matching Supabase project. This resolved (and closed) the former
> backlog item, now archived at
> [`archive/backlog/migrate-deploy-not-automated.md`](../archive/backlog/migrate-deploy-not-automated.md).
> **Residual go-live check:** each db-push job is gated on its DB secrets and
> *silently skips* if they're absent — confirm `PROD_DATABASE_URL` /
> `PROD_DIRECT_URL` (and the staging equivalents) are set in the GitHub repo
> secrets, or prod migrations would never run. The §5.2 workstation route
> remains the documented fallback.

---

## 6. Rules, rollback, and zero-downtime

### 6.1 Never commit directly to `main` or `staging`

Branch from `staging`, open a PR to `staging`, let CI pass, the user merges.
Hotfixes branch from `main`, PR to `main`, then backport to `staging`. Full
rules: [`CLAUDE.md`](../../CLAUDE.md).

### 6.2 `staging → main` promotion (production release)

Production releases happen **only when the user explicitly requests promotion.**

1. Open a PR from `staging` → `main`:
   ```
   gh pr create --base main --head staging
   ```
2. The PR body lists the commits being promoted:
   ```
   git log main..staging --oneline
   ```
3. **The user reviews and merges** — use a merge commit so the promoted history
   is preserved. No one auto-merges a `staging → main` PR.
4. The merge to `main` triggers (a) a Vercel Production build/deploy and (b) the
   `db-push-prod` job in `db-push.yml`. Confirm both succeed.
5. Confirm production-readiness items before announcing the release:
   - [ ] **WAF auth rate-limit rules active in Production** — both "Auth rate limit" firewall rules enabled & published (see docs/operations/waf-auth-rate-limiting.md)

### 6.3 Never run destructive migrations on prod

Do **not** run `prisma migrate reset`, `DROP`, or mass `UPDATE`/`DELETE` against
`supabase-prod` (or `supabase-nonprod`). `migrate deploy` is additive and safe;
`migrate reset` wipes data. If a migration is wrong, fix forward with a *new*
migration — never edit an applied one.

### 6.4 Rollback

Vercel keeps every past deployment as an **immutable build**, so rolling back the
*application* is near-instant:

1. Vercel dashboard → the bursary project → **Deployments**.
2. Find the last known-good deployment (each row shows the commit and time).
3. Click the **⋯** menu on that deployment → **Promote to Production** (also
   labelled **Instant Rollback** / **Rollback** depending on the view).
4. Confirm. Vercel re-points the Production domain at that build immediately —
   no rebuild required.

> 📷 *Screenshot: Vercel Deployments list with the ⋯ menu open on a previous deployment showing "Promote to Production".*

**Caveat — code vs schema.** A Vercel rollback reverts *code only*. If the bad
release also shipped a database migration, rolling back the code can leave the
app pointing at a newer schema. For schema-level recovery (restoring data to a
point in time) follow [`backup-restore.md`](backup-restore.md). Sequence: roll
back the app first to stop the bleeding, then assess whether a database restore
is needed. For incident handling around this, see
[`incident-response.md`](incident-response.md).

### 6.5 Zero-downtime deploys (NF-15)

Production hosting is on **Vercel Pro**, which provides zero-downtime, atomic
deployments (MSA Schedule 2). A new build is fully prepared before the domain is
switched to it, so users never hit a half-deployed state. Rollback (§6.4) is the
same mechanism in reverse and is equally instant.

---

## 7. First-time operator setup checklist

For an engineer taking the system over with no prior access:

1. **GitHub** — obtain write access to the repository. Confirm you can see the
   **Actions** tab and the repository **Secrets** (Settings → Secrets and
   variables → Actions). Confirm `STAGING_*` and `PROD_*` DB URL secrets exist.
2. **Vercel** — get added to the Vercel team that owns the bursary project.
   Confirm you can see **Deployments**, **Settings → Environment Variables**, and
   **Settings → Domains**.
3. **Supabase** — get added to both the `supabase-prod` and `supabase-nonprod`
   projects (Supabase organisation → invite member). Confirm you can open each
   project's **Database**, **Auth**, **Storage**, and **Logs** sections.
4. **Resend** — get added to the Resend account; confirm the sending domain is
   verified (see [`incident-response.md`](incident-response.md) §5.3).
5. **Zoho Desk** — get an agent seat for support ticketing (MSA Schedule 1 §1).
6. **Local clone** — install Node 22.12.0, run `npm ci`, copy `.env.example` to
   `.env.local`, and populate it from the **nonprod** project (never seed or
   migrate prod from a laptop without explicit approval). See
   [`environment-variables.md`](environment-variables.md).
7. Read [`backup-restore.md`](backup-restore.md),
   [`incident-response.md`](incident-response.md) and
   [`hypercare.md`](hypercare.md) before go-live.

---

## 8. Sentry (error monitoring)

Sentry is the runtime error-capture and alerting service (MSA Schedule 1 §1 and
Schedule 2) and is part of the deployed stack:

- **`@sentry/nextjs`** is installed and the Next.js Sentry instrumentation/config
  is in place, so unhandled exceptions (server, Edge, and browser) are captured
  automatically in production.
- The DSN is configured in the Vercel environment variables —
  `NEXT_PUBLIC_SENTRY_DSN` (client) and `SENTRY_DSN` (server) — across the
  Production and Preview scopes. See
  [`environment-variables.md`](environment-variables.md).
- During `next build`, the `@sentry/nextjs` plugin **uploads source maps** to
  Sentry (authenticated with `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` /
  `SENTRY_PROJECT`), so production stack traces resolve to the original
  TypeScript. The Sentry project uses EU data residency (MSA Schedule 5).
- Alerting and triage are documented in
  [`incident-response.md`](incident-response.md) §3, where Sentry is the primary
  detection channel; Vercel and Supabase logs are complementary.

---

See also: [`tdd/09-deployment-release.md`](../engineering/tdd/09-deployment-release.md).
