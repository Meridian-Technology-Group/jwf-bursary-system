# Repository Structure

A map of the codebase for an engineer picking up the John Whitgift Foundation
Bursary System for the first time. It explains the top-level layout, how the
Next.js App Router is organised, where the assessment engine lives, and how to
get the project running locally. (MSA Schedule 1 §4 / clause 13.1(c) deliverable.)

If you are new to **Supabase**, **Vercel**, or **Sentry**, the short version:
Supabase is our Postgres database plus authentication and file storage; Vercel
hosts the Next.js app and runs the build; Sentry captures runtime errors. You
do not need deep knowledge of any of them to navigate the code — the relevant
integration points are called out below.

---

## The stack at a glance

| Layer | Technology |
|---|---|
| Runtime | Node.js **22.12.0** (pinned in `.nvmrc`; Prisma 6 requires ≥ 22.12) |
| Framework | Next.js **14.2.x** (App Router, React 18) |
| Language | TypeScript 5 (`strict`) |
| ORM / DB | Prisma **6.19.x** → PostgreSQL (Supabase) |
| Auth / Storage | Supabase (SSR auth via `@supabase/ssr`, Storage for documents) |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| Email | Resend (with a Svix-signed inbound webhook) |
| Rate limiting | Vercel WAF (edge fixed-window rule in `vercel.json`) |
| Tests | Vitest |
| Hosting | Vercel (region `lhr1`) |

---

## Top-level layout

```
bursary-system/
├── src/                  Application source (see below)
├── prisma/               Schema, migrations, seed scripts, seed fixtures
├── scripts/              One-off operational scripts (tsx)
├── docs/                 Project documentation (this file lives here)
├── public/               Static assets served as-is
├── .github/workflows/    CI pipelines (ci.yml, db-push.yml)
├── package.json          Scripts + dependency manifest
├── package-lock.json     Locked dependency tree (npm ci uses this)
├── next.config.mjs       Next config + Content-Security-Policy headers
├── tailwind.config.ts    Tailwind theme (navy/gold palette, fonts)
├── tsconfig.json         TypeScript config (path alias @/* → src/*)
├── vitest.config.ts      Test runner config
├── vercel.json           Vercel deploy config (region pin)
├── components.json        shadcn/ui generator config
├── .nvmrc                Node version pin (v22.12.0)
├── .env.example          Template for required environment variables
└── CLAUDE.md             Git workflow rules (branch off staging, PR to staging)
```

Environment files: `.env` is read by the **Prisma CLI**; `.env.local` is read by
the **app and seed scripts**; `.env.staging` holds staging values. Keep them in
sync and pointed at the right Supabase project — see the
[environment variables runbook](../operations/environment-variables.md) for the
authoritative list and which key belongs where.

---

## `src/` — application source

```
src/
├── app/            Next.js App Router (routes, layouts, API handlers)
├── components/     React components (admin, portal, ui, shared, brand)
├── hooks/          Reusable client hooks
├── lib/            Business logic, data access, integrations
├── types/          Shared TypeScript types
└── middleware.ts   Edge auth + route-group protection (runs on every request)
```

### `src/middleware.ts`

Edge middleware that runs on every matched request. It refreshes the Supabase
session, then enforces route-group access: `(auth)` is public, `(portal)` is
APPLICANT-only, `(admin)` is ASSESSOR/VIEWER (and ADMIN). It reads the user's
role from the JWT `app_metadata` claim (stamped by a Supabase trigger) rather
than querying Postgres, because the Edge runtime has no Prisma access.
Authoritative server-side role checks happen in `src/lib/auth/roles.ts`.

---

## `src/app/` — App Router and route groups

A **route group** is a folder whose name is wrapped in parentheses, e.g.
`(admin)`. The parentheses tell Next.js to group routes for organisation and to
share a layout **without adding a path segment to the URL**. So a page at
`src/app/(admin)/queue/page.tsx` is served at `/queue`, not `/admin/queue`. We
use three groups to give applicants and staff separate layouts and access rules.

```
src/app/
├── (auth)/        Public authentication pages
│   ├── login/            /login  (+ login/mfa for the MFA challenge)
│   ├── register/         /register  (+ register/staff for invited staff)
│   ├── reset-password/   /reset-password
│   └── auth/callback/    OAuth / magic-link callback handler
│
├── (portal)/      Applicant-facing wizard (APPLICANT role)
│   ├── apply/[section]/  The sequential application wizard, one step per section
│   ├── apply/review/     Final review before submission
│   ├── submitted/        Post-submission confirmation
│   ├── status/           Applicant views their application status
│   └── respond/          Applicant responds to a request for more information
│
├── (admin)/       Staff console (ASSESSOR / VIEWER / ADMIN)
│   ├── queue/            The assessment work queue
│   ├── applications/[id]/  Single application detail + assessment
│   ├── rounds/[id]/      Funding rounds management
│   ├── reports/          Charts and reporting
│   ├── exports/          XLSX / CSV downloads
│   ├── audit/            Audit-trail viewer
│   ├── users/            Staff user management
│   ├── invitations/      Pending staff/applicant invitations
│   ├── settings/         Reference-data + email-template settings (tabbed)
│   └── admin/            Admin-only tools
│
└── api/           Route handlers (server endpoints, no UI)
```

The portal is a **sequential wizard** rather than free navigation, so applicants
correct one section at a time instead of hitting a wall of errors at the end.
The admin console uses a grouped sidebar that collapses on tablet widths.

### `src/app/api/` — route handlers

These are server-side endpoints (each is a `route.ts`). They handle work that
must not run in the browser — signed-URL minting, file streaming, PDF rendering,
webhook verification.

| Route | Purpose |
|---|---|
| `api/applications/names/` | Lookup of applicant names (typeahead) |
| `api/documents/[id]/url/` | Mint a presigned Supabase Storage URL for a document |
| `api/documents/[id]/verify/` | Mark an uploaded document as verified |
| `api/admin/documents/` | Admin document operations |
| `api/siblings/`, `api/siblings/[id]/`, `api/siblings/search/` | Sibling links + search |
| `api/exports/recommendations/` | Generate the recommendations export (XLSX/CSV) |
| `api/pdf/recommendation/[applicationId]/` | Render a recommendation PDF |
| `api/auth/logout/` | Sign-out endpoint |
| `api/webhooks/resend/` | Inbound Resend delivery events (Svix-signed) |

---

## `src/lib/` — business logic and integrations

This is where the real work lives. UI components stay thin and call into `lib`.

### `src/lib/assessment/` — the assessment engine

The heart of the system: a **pure, side-effect-free** calculation pipeline (no
DB, no UI), safe to import on client or server. `calculator.ts` orchestrates
four stages plus sibling and fee adjustments:

```
calculator.ts          Orchestrator — composes the pipeline below
├── stage1-income.ts    Stage 1: total household net income across earners
├── stage2-assets.ts    Stage 2: net assets after housing, council tax, savings
├── stage3-living.ts    Stage 3: household net disposable income (HNDI) after living costs
├── stage4-bursary.ts   Stage 4: required bursary, clamped to [0, annual fees]
├── sibling.ts          Deducts older siblings' fees from HNDI where applicable
├── payable-fees.ts     Payable fees after scholarship, VAT, manual adjustment
├── schooling-years.ts  Derives schooling years from the entry year-group
└── types.ts            Input/output type definitions for the engine
```

Every stage has a matching test file under
`src/lib/assessment/__tests__/` (`calculator`, `payable-fees`,
`schooling-years`, `sibling`, `stage1`–`stage4`). This is the most heavily
tested area of the codebase — change the maths here only with the tests green.
The client hook `src/hooks/use-assessment-calculation.ts` runs the same engine
live in the admin UI.

### `src/lib/db/` — data access

```
db/prisma.ts             Singleton PrismaClient (avoids dev hot-reload leaks)
db/queries/              One module per domain — the only place that touches Prisma
   applications.ts, assessments.ts, audit.ts, exports.ts, invitations.ts,
   missing-docs.ts, profiles.ts, reassessment.ts, recommendations.ts,
   reference-tables.ts, reports.ts, rounds.ts, siblings.ts, staff-invitations.ts
```

Keep all Prisma access in `db/queries`; components and route handlers import
these functions rather than the client directly.

### `src/lib/auth/` — authentication

```
roles.ts                getCurrentUser() + authoritative server-side role checks
create-profile.ts       Provisions a Profile row for a new auth user
mfa-flag.ts             MFA enrolment state
password-policy.ts      Password strength + HaveIBeenPwned breach check
supabase-server.ts      Supabase client for Server Components / route handlers
supabase-browser.ts     Supabase client for Client Components
supabase-middleware.ts  Supabase client used inside Edge middleware
supabase-admin.ts       Service-role client (server-only; never client-exposed)
```

The four `supabase-*` clients exist because the SSR pattern needs a different
cookie/transport setup per execution context (server, browser, middleware,
service-role). Pick the one that matches where your code runs.

### `src/lib/email/` — Resend integration

`resend.ts` (client), `send.ts` (dispatch), `template.ts` + `merge.ts` (merge
fields into seeded templates), `types.ts`. Merge logic is unit-tested in
`email/__tests__/merge.test.ts`. Note: email **template content** is seeded via
a Prisma migration, not via the seed scripts (see the quick-reference table).

### `src/lib/storage/` — document storage

`documents.ts` (upload/list/delete against the Supabase `documents` bucket) and
`sniff.ts` (magic-byte content-type sniffing to validate uploads).

### `src/lib/rate-limit.ts` — _deprecated, being removed_

The former application-layer limiter (Upstash Ratelimit over Vercel KV: 5
requests / 15-minute window, keyed by IP). **Auth rate limiting has moved to
Vercel WAF** — an edge fixed-window rule on `/login` and `/reset-password`
defined in `vercel.json`, with the same 5-per-15-minute / per-IP shape. This
file and its `@upstash/ratelimit` / `@vercel/kv` dependencies are slated for
removal; see
[`docs/backlog/prod-auth-rate-limiting-disabled.md`](../backlog/prod-auth-rate-limiting-disabled.md).

### Other `lib` modules

`schemas/` (Zod validation schemas for each wizard section), `pdf/`
(`recommendation-pdf.tsx`, the `@react-pdf/renderer` document), `export/`
(`xlsx.ts`, ExcelJS workbook builder), `applications/`, `audit/`,
`bursary-accounts/`, `documents/`, `portal/` (section-gap detection),
`data/countries.ts`, plus small utilities (`utils.ts`, `app-url.ts`, `log.ts`).

---

## `src/components/`

```
components/
├── ui/         shadcn/ui primitives (25 components: button, dialog, table, …)
├── admin/      Admin console components (incl. charts/ and settings/)
├── portal/     Applicant wizard components (incl. form-fields/ and sections/)
├── shared/     Cross-cutting components (loading, error, empty, status-badge)
└── brand/      Logo / brand marks
```

`ui/` is generated/managed by shadcn/ui (config in `components.json`); prefer
composing these primitives over hand-rolling. `admin/` and `portal/` are
feature-specific; `shared/` holds the loading/error/empty/status states reused
across both surfaces.

---

## `prisma/` — schema, migrations, seeds

```
prisma/
├── schema.prisma         Single source of truth for the data model
│                          (datasource uses url=DATABASE_URL, directUrl=DIRECT_URL)
├── migrations/           Ordered SQL migrations (incl. RLS policies + template seeds)
│   └── migration_lock.toml
├── seed-reference.ts     Idempotent reference-data seed (safe in any env)
├── seed-demo.ts          Destructive demo seed (gated by ALLOW_DESTRUCTIVE_SEED=1)
└── seed-data/            Fixture data imported by the seed scripts
       reference.ts, reason-codes.ts, email-templates.ts,
       demo-users.ts, demo-applications.ts, demo-documents.ts
```

Two database connections are configured: the **transaction pooler** (port 6543)
for runtime queries and the **session pooler** (port 5432) for migrations
(`DIRECT_URL`).

**Migrations are special here.** Beyond table changes, migrations also carry
PostgreSQL **Row-Level Security (RLS) policies** and the **email-template
seed** — so RLS and template content live in `prisma/migrations/`, not in
application code or the seed scripts. Never edit a migration already applied to
staging or prod; always generate a new one.

**Two seed scripts, different risk profiles:**

- `seed:reference` — idempotent upserts of reference tables only; ensures the
  storage bucket exists. Safe to run anywhere, including production.
- `seed:demo` — destructive; wipes and rebuilds local demo fixtures. Gated
  behind `ALLOW_DESTRUCTIVE_SEED=1` (set automatically by the npm script) so it
  cannot accidentally wipe a shared environment.

---

## `scripts/`

| Script | Purpose |
|---|---|
| `backfill-assessment-calculations.ts` | Re-runs the assessment engine over existing assessments to backfill stored calculation fields. Invoked via `npm run backfill:assessments`. |

---

## Toolchain and `package.json` scripts

| Script | Command | What it does |
|---|---|---|
| `dev` | `next dev` | Start the local dev server (hot reload). |
| `build` | `prisma generate && next build` | Generate the Prisma client, then build for production. |
| `start` | `next start` | Serve the production build (after `build`). |
| `lint` | `next lint` | Run ESLint (`eslint-config-next`). |
| `test` | `vitest run` | Run the full test suite once. |
| `test:watch` | `vitest` | Run tests in watch mode while developing. |
| `seed:reference` | `tsx prisma/seed-reference.ts` | Idempotent reference-data seed (safe in any env). |
| `seed:demo` | `ALLOW_DESTRUCTIVE_SEED=1 tsx prisma/seed-demo.ts` | Destructive local demo seed (gated). |
| `backfill:assessments` | `tsx scripts/backfill-assessment-calculations.ts` | Backfill stored assessment calculations. |
| `postinstall` | `prisma generate` | Auto-generates the Prisma client after `npm install`/`npm ci`. |

> Note: `next build` skips ESLint (`eslint.ignoreDuringBuilds`), because the
> repo has lint directives `next build` would treat as hard errors. CI runs
> `npm run lint` separately (non-blocking) for visibility.

### CI workflows (`.github/workflows/`)

- **`ci.yml`** — runs on every pull request and on pushes to `main`/`staging`.
  Steps: `npm ci`, `prisma validate`, `prisma format --check`, `npm run lint`
  (non-blocking), `tsc --noEmit` (typecheck), `npm test`. This is the gate that
  protects the integration branches.
- **`db-push.yml`** — runs on pushes to `staging`/`main` and via manual
  dispatch. Runs `prisma migrate deploy` against the matching Supabase project
  (staging vs production), each gated on its environment secrets being present.
  This is how schema migrations reach the databases — you do **not** run
  `migrate deploy` against staging/prod from a laptop.

---

## "Where do I find / change X?" quick reference

Every path below has been verified against the tree.

| I want to change… | Look here |
|---|---|
| The income calculation (Stage 1) | `src/lib/assessment/stage1-income.ts` |
| The net-assets calculation (Stage 2) | `src/lib/assessment/stage2-assets.ts` |
| The living-costs / HNDI calculation (Stage 3) | `src/lib/assessment/stage3-living.ts` |
| The bursary-amount calculation (Stage 4) | `src/lib/assessment/stage4-bursary.ts` |
| How the four stages compose | `src/lib/assessment/calculator.ts` |
| Sibling fee deductions | `src/lib/assessment/sibling.ts` |
| Payable fees (scholarship, VAT, adjustments) | `src/lib/assessment/payable-fees.ts` |
| Assessment-engine tests | `src/lib/assessment/__tests__/` |
| The applicant application wizard | `src/app/(portal)/apply/[section]/` |
| Validation rules for a wizard section | `src/lib/schemas/` |
| The admin application queue | `src/app/(admin)/queue/` |
| A single application's assessment screen | `src/app/(admin)/applications/[id]/` |
| Funding rounds | `src/app/(admin)/rounds/` |
| Reports and charts | `src/app/(admin)/reports/` + `src/components/admin/charts/` |
| Exports (XLSX/CSV) | `src/app/(admin)/exports/`, `src/app/api/exports/recommendations/`, `src/lib/export/xlsx.ts` |
| The audit-trail viewer | `src/app/(admin)/audit/` (data: `src/lib/db/queries/audit.ts`) |
| Reference data + settings UI | `src/app/(admin)/settings/` + `src/components/admin/settings/` |
| An email template's **content** | Seeded via a Prisma migration (`prisma/migrations/*_seed_email_templates`); not editable in app code |
| Email merge-field logic | `src/lib/email/merge.ts` |
| The recommendation PDF | `src/lib/pdf/recommendation-pdf.tsx` (route: `src/app/api/pdf/recommendation/[applicationId]/`) |
| Document upload / storage | `src/lib/storage/documents.ts` |
| Presigned document URLs | `src/app/api/documents/[id]/url/` |
| Auth route protection / redirects | `src/middleware.ts` |
| Server-side role checks | `src/lib/auth/roles.ts` |
| Password / breach policy | `src/lib/auth/password-policy.ts` |
| Rate limiting | `vercel.json` (Vercel WAF rule) — formerly `src/lib/rate-limit.ts` |
| The data model | `prisma/schema.prisma` |
| **RLS policies** | `prisma/migrations/` (e.g. `*_enable_row_level_security`) |
| Reference seed data | `prisma/seed-reference.ts` + `prisma/seed-data/reference.ts` |
| Security headers / CSP | `next.config.mjs` |
| Which Supabase project each env points at | [environment variables runbook](../operations/environment-variables.md) |

---

## Getting started

Prerequisites: Node **22.12.0** (use `nvm use` to read `.nvmrc`) and access to a
Supabase non-production project plus the matching keys.

```bash
# 1. Clone and select the right Node version
git clone <repo-url> && cd bursary-system
nvm use                       # reads .nvmrc → v22.12.0

# 2. Install exactly what the lockfile pins (also runs prisma generate)
npm ci

# 3. Configure environment variables
cp .env.example .env.local    # app + seeds read .env.local
cp .env.example .env          # Prisma CLI reads .env
#  → fill in real values; see the environment-variables runbook for which key
#    belongs where and which Supabase project to target.

# 4. Generate the Prisma client (also runs on postinstall/build)
npx prisma generate

# 5. Start the dev server
npm run dev                   # http://localhost:3000
```

See the [environment variables runbook](../operations/environment-variables.md)
for the full variable list and the Supabase/Vercel routing rules.

### Running tests

```bash
npm test           # run the suite once (what CI runs)
npm run test:watch # watch mode while developing
```

### Seeding data

```bash
npm run seed:reference   # idempotent reference data — safe in any environment
npm run seed:demo        # DESTRUCTIVE local demo fixtures — local only
```

`seed:demo` wipes profiles, applications, assessments and documents — never run
it against a shared environment. Email-template content is seeded by migration,
so `seed:reference` does **not** create templates.

---

See also: [`tdd/03-architectural-overview.md`](tdd/03-architectural-overview.md).
