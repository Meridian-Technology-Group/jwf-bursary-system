# 03. Environment Variables

The application reads its configuration from environment variables: named
values such as database addresses, API keys and feature switches. The code is
identical in every environment. The environment variables are what make
Production talk to the Production database and Staging talk to the Staging
database.

This guide lists every variable, what it controls, where it is set, and what
its value must be.

---

## 1. Where variables are stored

The same variable names are stored in five places. Each place serves one
environment.

| Store | Read by | Points at |
|---|---|---|
| Vercel, **Production** scope | The Production website | `supabase-prod` |
| Vercel, **Preview** scope | The Staging website | `supabase-nonprod` |
| `.env.local` file on your computer | The application running on your computer, and the scripts in this repository | `supabase-nonprod` |
| `.env` file on your computer | The Prisma command line tool, which runs database migrations | `supabase-nonprod` |
| GitHub repository secrets | The workflow that applies database migrations | Both, under separate names |

Three rules hold everywhere:

1. **Production scope values always belong to `supabase-prod`.** Every other
   store belongs to `supabase-nonprod`, except the four GitHub secrets whose
   names start with `PROD_`.
2. **Variables whose names start with `NEXT_PUBLIC_` are visible to anyone
   using the website.** Never put a password or secret key in one.
3. **A change in Vercel takes effect only after the next deployment.** See
   section 5.1.

Vercel also has a **Development** scope. This system does not use it.

---

## 2. Quick reference

**Required** means the application or a feature fails without it. **Optional**
means a default applies when it is not set. **Do not set** means the variable
must be left absent from that store.

| Variable | Vercel Production | Vercel Preview | `.env.local` | `.env` |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Required | Required | Do not set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Required | Required | Do not set |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Required | Required | Do not set |
| `DATABASE_URL` | Required | Required | Required | Required |
| `DIRECT_URL` | Required | Required | Required | Required |
| `RESEND_API_KEY` | Required | Required | Required | Do not set |
| `RESEND_FROM_EMAIL` | Required | Required | Required | Do not set |
| `RESEND_REPLY_TO_EMAIL` | Required | Required | Optional | Do not set |
| `RESEND_INVITE_BCC_EMAIL` | Optional | Optional | Optional | Do not set |
| `RESEND_WEBHOOK_SECRET` | Required | Do not set | Do not set | Do not set |
| `NEXT_PUBLIC_APP_URL` | Required | Do not set | Do not set | Do not set |
| `CRON_SECRET` | Required | Optional | Do not set | Do not set |
| `RETENTION_PURGE_ENABLED` | Optional | Do not set | Do not set | Do not set |
| `RETENTION_DECLINED_GRACE_DAYS` | Optional | Optional | Do not set | Do not set |
| `RETENTION_CLOSED_GRACE_DAYS` | Optional | Optional | Do not set | Do not set |
| `RETENTION_QUALIFIES_NOT_AWARDED_YEARS` | Optional | Optional | Do not set | Do not set |
| `RETENTION_AWARDED_YEARS` | Optional | Optional | Do not set | Do not set |
| `STAFF_MFA_ENFORCED` | Do not set | Do not set | Do not set | Do not set |
| `NEXT_PUBLIC_SESSION_IDLE_ENABLED` | Optional | Optional | Optional | Do not set |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | Optional | Optional | Optional | Do not set |
| `NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS` | Optional | Optional | Optional | Do not set |
| `NEXT_PUBLIC_SENTRY_DSN` | Required | Do not set | Do not set | Do not set |
| `SENTRY_DSN` | Required | Do not set | Do not set | Do not set |
| `SENTRY_ORG` | Required | Do not set | Do not set | Do not set |
| `SENTRY_PROJECT` | Required | Do not set | Do not set | Do not set |
| `SENTRY_AUTH_TOKEN` | Required | Do not set | Do not set | Do not set |
| `ROUNDS_SINGLE_OPEN_ONLY` | Optional | Optional | Optional | Do not set |
| `SUPABASE_STORAGE_BUCKET` | Do not set | Do not set | Do not set | Do not set |

`STAFF_MFA_ENFORCED` and `SUPABASE_STORAGE_BUCKET` are listed as **Do not set**
because the correct behaviour is the default. Section 3 describes when each is
used.

---

## 3. Variables by purpose

Values in angle brackets, such as `<project reference>`, are descriptions of
the value to enter. Replace the whole placeholder, including the brackets.

### 3.1 Supabase connection

Connects the application to Supabase for logins and document storage.

| Variable | Value to set | Where to find the value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project reference>.supabase.co` | Supabase project, **Connect** button at the top of the page, **App Frameworks** tab |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key>` | Supabase project, **Project Settings**, **API Keys**, the key named `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service_role key>` | Supabase project, **Project Settings**, **API Keys**, the key named `service_role` |

`SUPABASE_SERVICE_ROLE_KEY` bypasses every data protection rule in the
database. It is used only by server code. Treat it as the most sensitive value
in the system.

### 3.2 Database connection

The application connects to the database through Supabase's connection pooler,
which shares a small number of database connections between many requests.
There are two connection strings, and they use **different database users**.

| Variable | Value to set | Used for |
|---|---|---|
| `DATABASE_URL` | `postgres://app_user.<project reference>:<app_user password>@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true` | Every query the running application makes |
| `DIRECT_URL` | `postgresql://postgres.<project reference>:<database password>@aws-1-eu-west-2.pooler.supabase.com:5432/postgres` | Database migrations and scripts |

How to build each value:

1. Supabase project, **Connect** button, **Connection String** tab.
2. For `DATABASE_URL`, choose **Transaction pooler** (port `6543`). Copy the
   string, then:
   - replace the user `postgres.` with `app_user.`
   - replace `[YOUR-PASSWORD]` with the `app_user` password
   - add `?pgbouncer=true` to the end
3. For `DIRECT_URL`, choose **Session pooler** (port `5432`). Copy the string
   and replace `[YOUR-PASSWORD]` with the database password.

`app_user` is a restricted database user that obeys the data protection rules.
The application must never connect as `postgres`, which ignores them.

If either password is unknown, set a new one. See section 5.3.

### 3.3 Email

| Variable | Value to set | Notes |
|---|---|---|
| `RESEND_API_KEY` | `<Resend API key>`, beginning `re_` | Resend, **API Keys**, **Create API Key**, permission **Sending access**. Every page that sends email fails without it. |
| `RESEND_FROM_EMAIL` | `bursary@updates.meridiantech.group` | The sender address. Its domain must show as **Verified** in Resend, **Domains**. |
| `RESEND_REPLY_TO_EMAIL` | `fees@johnwhitgiftfoundation.org` | Where replies from recipients go. When not set, Production uses `fees@johnwhitgiftfoundation.org` and every other environment sends with no reply address. |
| `RESEND_INVITE_BCC_EMAIL` | `<email address>` | The address pre-filled in the BCC box when an administrator sends an individual invitation. When not set, Production pre-fills `fees@johnwhitgiftfoundation.org` and every other environment leaves the box empty. |
| `RESEND_WEBHOOK_SECRET` | `<signing secret>`, beginning `whsec_` | Resend, **Webhooks**, the endpoint for `https://jwf-bursary-system.vercel.app/api/webhooks/resend`, **Signing Secret**. Verifies delivery notifications sent by Resend. |

### 3.4 Application address

| Variable | Value to set | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://jwf-bursary-system.vercel.app` | The Production web address, with no trailing slash. Used to build the links in emails. Staging and local development work out their own address when it is not set. |

### 3.5 Scheduled jobs

| Variable | Value to set | Notes |
|---|---|---|
| `CRON_SECRET` | `<random string of 64 characters>` | Proves that a request to a scheduled job came from Vercel. Generate a value by running `openssl rand -hex 32` in a terminal. When not set, both scheduled jobs refuse every request. See [09. Scheduled Jobs](09-scheduled-jobs.md). |

### 3.6 Data retention

Controls the weekly job that permanently deletes applications once their
retention period has passed. See [09. Scheduled Jobs](09-scheduled-jobs.md).

| Variable | Value to set | Default when not set |
|---|---|---|
| `RETENTION_PURGE_ENABLED` | `true` to delete data. Any other value, or not set, means the job reports what it would delete and deletes nothing. | Report only |
| `RETENTION_DECLINED_GRACE_DAYS` | Whole number of days an application assessed as not qualifying is kept after it is archived | `30` |
| `RETENTION_CLOSED_GRACE_DAYS` | Whole number of days an application closed without an outcome is kept after it is closed | `30` |
| `RETENTION_QUALIFIES_NOT_AWARDED_YEARS` | Whole number of years an application that qualified but was not awarded is kept after submission | `6` |
| `RETENTION_AWARDED_YEARS` | Whole number of years an awarded bursary is kept after its account is closed | `7` |

### 3.7 Security and sessions

| Variable | Value to set | Default when not set |
|---|---|---|
| `STAFF_MFA_ENFORCED` | Leave unset. `true` forces two factor authentication on for staff. `false` forces it off. Set `false` in Production only as an emergency measure when staff cannot sign in (see [13. Troubleshooting](13-troubleshooting.md)), and remove it once resolved. | Required in Production, not required elsewhere |
| `NEXT_PUBLIC_SESSION_IDLE_ENABLED` | `false` to turn off automatic sign out after inactivity | On |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | Whole number of minutes of inactivity before a user is signed out, between `1` and `720` | `30` |
| `NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS` | Whole number of seconds the sign out warning is shown before sign out | `60` |

### 3.8 Error monitoring

Sentry is configured in Production only.

| Variable | Value to set | Where to find the value |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | `<DSN>`, a URL beginning `https://` | Sentry, **Settings**, **Projects**, `bursary-system`, **Client Keys (DSN)** |
| `SENTRY_DSN` | The same value as `NEXT_PUBLIC_SENTRY_DSN` | As above |
| `SENTRY_ORG` | `<organisation slug>` | Sentry, **Settings**, **General Settings**, **Organization Slug** |
| `SENTRY_PROJECT` | `bursary-system` | |
| `SENTRY_AUTH_TOKEN` | `<auth token>` | Sentry, **Settings**, **Auth Tokens**, **Create New Token**. Used during the build to upload source maps, which let Sentry show original source code in stack traces. |

When the DSN variables are not set, the application sends nothing to Sentry.

### 3.9 Behaviour switches

| Variable | Value to set | Default when not set |
|---|---|---|
| `ROUNDS_SINGLE_OPEN_ONLY` | `true` to allow only one assessment round to be open at a time | Several rounds can be open at once |
| `SUPABASE_STORAGE_BUCKET` | Leave unset. The name of the Supabase Storage bucket holding documents. | `documents` |

### 3.10 Set automatically

Vercel and Node.js set these. Never add them manually.

| Variable | Contains |
|---|---|
| `VERCEL_ENV` and `NEXT_PUBLIC_VERCEL_ENV` | `production` on Production, `preview` on Staging |
| `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | Web addresses of the current deployment |
| `VERCEL_GIT_COMMIT_SHA`, `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF` | The Git commit and branch that was built |
| `NODE_ENV` | `production` on both Production and Staging |
| `NEXT_RUNTIME`, `CI` | Internal build and runtime details |

`ALLOW_DESTRUCTIVE_SEED` is set by the `npm run seed:demo` command itself.
Never set it anywhere. See [06. Database Changes and Reference Data](06-database-changes-and-reference-data.md).

### 3.11 GitHub repository secrets

Used only by the workflow that applies database migrations. GitHub repository,
**Settings**, **Secrets and variables**, **Actions**.

| Secret | Value |
|---|---|
| `STAGING_DATABASE_URL` | The `DATABASE_URL` value for `supabase-nonprod` |
| `STAGING_DIRECT_URL` | The `DIRECT_URL` value for `supabase-nonprod` |
| `PROD_DATABASE_URL` | The `DATABASE_URL` value for `supabase-prod` |
| `PROD_DIRECT_URL` | The `DIRECT_URL` value for `supabase-prod` |

When a pair is missing, the workflow skips that environment without failing,
and migrations are not applied.

---

## 4. Complete files for local development

### 4.1 `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://lmkmgoqezgeeyjodbvzn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-nonprod anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-nonprod service_role key>

DATABASE_URL=postgres://app_user.lmkmgoqezgeeyjodbvzn:<supabase-nonprod app_user password>@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.lmkmgoqezgeeyjodbvzn:<supabase-nonprod database password>@aws-1-eu-west-2.pooler.supabase.com:5432/postgres

RESEND_API_KEY=<Resend API key>
RESEND_FROM_EMAIL=bursary@updates.meridiantech.group
```

### 4.2 `.env`

```
DATABASE_URL=postgres://app_user.lmkmgoqezgeeyjodbvzn:<supabase-nonprod app_user password>@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.lmkmgoqezgeeyjodbvzn:<supabase-nonprod database password>@aws-1-eu-west-2.pooler.supabase.com:5432/postgres
```

Both files are excluded from Git and must never be committed.

---

## 5. Procedures

### 5.1 Add or change a variable in Vercel

1. Open the Vercel project, **Settings**, **Environment Variables**.
2. To change an existing variable, find it in the list, open the menu at the
   end of its row and choose **Edit**. To add a new one, use the form at the top of the page.
3. **Key:** the variable name, exactly as written in this guide.
4. **Value:** the value.
5. **Environments:** tick **Production** for a `supabase-prod` value, or
   **Preview** for a `supabase-nonprod` value. Never tick both for a variable
   whose value differs between environments.
6. **Save**.
7. Redeploy the affected environment. Open **Deployments**, find the most recent
   deployment for that environment (Production, or Preview on the `staging`
   branch), open its **⋮** menu and choose **Redeploy**.
8. When the deployment shows **Ready**, confirm the change took effect.

Vendor documentation: [Environment variables](https://vercel.com/docs/environment-variables)
and [Redeploying](https://vercel.com/docs/deployments/managing-deployments#redeploy-a-project).

### 5.2 Confirm which Supabase project an environment uses

1. Vercel project, **Settings**, **Environment Variables**.
2. Find `NEXT_PUBLIC_SUPABASE_URL` for the scope in question and click the eye
   icon to reveal its value.
3. The project reference is the part before `.supabase.co`.
   `tdnojrqkbccikfipthmk` is `supabase-prod`. `lmkmgoqezgeeyjodbvzn` is
   `supabase-nonprod`.
4. Reveal `DATABASE_URL` and `DIRECT_URL` for the same scope. Both must contain
   the same project reference.

A mismatch between these three values causes sign in failures and missing data.

### 5.3 Rotate a secret

Rotate a secret immediately if it has been exposed: pasted into an email or
chat, committed to Git, or shown on screen to someone who should not have it.

In every case: generate the new value at the source, update every store that
holds it (section 2), redeploy, and confirm the site works.

| Secret | Generate the new value | Update |
|---|---|---|
| Database password (`postgres` user) | Supabase project, **Project Settings**, **Database**, **Reset database password** | `DIRECT_URL` in the matching Vercel scope, `.env.local` and `.env` (Staging only), and the matching `*_DIRECT_URL` GitHub secret |
| `app_user` password | Supabase project, **SQL Editor**, run `ALTER ROLE app_user WITH PASSWORD '<new password>';` | `DATABASE_URL` in the matching Vercel scope, `.env.local` and `.env` (Staging only), and the matching `*_DATABASE_URL` GitHub secret |
| `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project, **Project Settings**, **JWT Keys**. Changing the legacy JWT secret replaces both keys and signs every user out. See [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys). | Both variables in the matching Vercel scope, and `.env.local` (Staging only) |
| `RESEND_API_KEY` | Resend, **API Keys**, create a new key, then delete the old key after redeploying | Vercel Production and Preview scopes, and `.env.local` |
| `RESEND_WEBHOOK_SECRET` | Resend, **Webhooks**: add a new endpoint for `https://jwf-bursary-system.vercel.app/api/webhooks/resend` with all email events, copy its signing secret, then delete the old endpoint after redeploying | Vercel Production scope |
| `CRON_SECRET` | Run `openssl rand -hex 32` | Vercel Production scope, and Preview scope if set |
| `SENTRY_AUTH_TOKEN` | Sentry, **Settings**, **Auth Tokens**, create a new token, then revoke the old one | Vercel Production scope |

Passwords generated for database users must contain only letters and numbers.
Symbols in a password break the connection string format.

Vendor documentation:
[Supabase database passwords](https://supabase.com/docs/guides/database/postgres/roles#passwords) ·
[Supabase API keys](https://supabase.com/docs/guides/api/api-keys) ·
[Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction)
