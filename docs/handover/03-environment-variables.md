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

- **Vercel, Production scope.** Read by the Production website. Points at
  `supabase-prod`.
- **Vercel, Preview scope.** Read by the Staging website. Points at
  `supabase-nonprod`.
- **The `.env.local` file on your computer.** Read by the application when you
  run it locally, and by the scripts in this repository. Points at
  `supabase-nonprod`.
- **The `.env` file on your computer.** Read by the Prisma command line tool,
  which runs database migrations. Points at `supabase-nonprod`.
- **GitHub repository secrets.** Read by the workflow that applies database
  migrations. Points at both projects, under separate names.

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
means a default applies when it is not set. **Never** means the variable
must be left absent from that store.

| Variable | Vercel Production | Vercel Preview | `.env.local` | `.env` |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Required | Required | Never |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Required | Required | Never |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Required | Required | Never |
| `DATABASE_URL` | Required | Required | Required | Required |
| `DIRECT_URL` | Required | Required | Required | Required |
| `RESEND_API_KEY` | Required | Required | Required | Never |
| `RESEND_FROM_EMAIL` | Required | Required | Required | Never |
| `RESEND_REPLY_TO_EMAIL` | Required | Required | Optional | Never |
| `RESEND_INVITE_BCC_EMAIL` | Optional | Optional | Optional | Never |
| `RESEND_WEBHOOK_SECRET` | Required | Never | Never | Never |
| `NEXT_PUBLIC_APP_URL` | Required | Never | Never | Never |
| `CRON_SECRET` | Required | Optional | Never | Never |
| `RETENTION_PURGE_ENABLED` | Optional | Never | Never | Never |
| `RETENTION_DECLINED_GRACE_DAYS` | Optional | Optional | Never | Never |
| `RETENTION_CLOSED_GRACE_DAYS` | Optional | Optional | Never | Never |
| `RETENTION_QUALIFIES_NOT_AWARDED_YEARS` | Optional | Optional | Never | Never |
| `RETENTION_AWARDED_YEARS` | Optional | Optional | Never | Never |
| `STAFF_MFA_ENFORCED` | Never | Never | Never | Never |
| `NEXT_PUBLIC_SESSION_IDLE_ENABLED` | Optional | Optional | Optional | Never |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | Optional | Optional | Optional | Never |
| `NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS` | Optional | Optional | Optional | Never |
| `NEXT_PUBLIC_SENTRY_DSN` | Required | Never | Never | Never |
| `SENTRY_DSN` | Required | Never | Never | Never |
| `SENTRY_ORG` | Required | Never | Never | Never |
| `SENTRY_PROJECT` | Required | Never | Never | Never |
| `SENTRY_AUTH_TOKEN` | Required | Never | Never | Never |
| `ROUNDS_SINGLE_OPEN_ONLY` | Optional | Optional | Optional | Never |
| `SUPABASE_STORAGE_BUCKET` | Never | Never | Never | Never |

`STAFF_MFA_ENFORCED` and `SUPABASE_STORAGE_BUCKET` are listed as **Never**
because the correct behaviour is the default. Section 3 describes when each is
used.

---

## 3. Variables by purpose

Values in angle brackets, such as `<project reference>`, are descriptions of
the value to enter. Replace the whole placeholder, including the brackets.

### 3.1 Supabase connection

Connects the application to Supabase for logins and document storage.

**`NEXT_PUBLIC_SUPABASE_URL`** is `https://<project reference>.supabase.co`.
Find it in the Supabase project, **Connect** button at the top of the page,
**App Frameworks** tab.

**`NEXT_PUBLIC_SUPABASE_ANON_KEY`** is the key named `anon`, in the Supabase
project, **Project Settings**, **API Keys**.

**`SUPABASE_SERVICE_ROLE_KEY`** is the key named `service_role`, on the same
page.

`SUPABASE_SERVICE_ROLE_KEY` bypasses every data protection rule in the
database. It is used only by server code. Treat it as the most sensitive value
in the system.

### 3.2 Database connection

The application connects to the database through Supabase's connection pooler,
which shares a small number of database connections between many requests.
There are two connection strings, and they use **different database users**.

**`DATABASE_URL`** is used for every query the running application makes:

```
postgres://app_user.<project reference>:<app_user password>@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**`DIRECT_URL`** is used for database migrations and scripts:

```
postgresql://postgres.<project reference>:<database password>@aws-1-eu-west-2.pooler.supabase.com:5432/postgres
```

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

**`RESEND_API_KEY`** is the key that lets the application send at all, and
begins `re_`. Create it in Resend, **API Keys**, **Create API Key**, with the
permission **Sending access**. Every page that sends email fails without it.

**`RESEND_FROM_EMAIL`** is the sender address,
`bursary@updates.meridiantech.group`. Its domain must show as **Verified** in
Resend, **Domains**.

**`RESEND_REPLY_TO_EMAIL`** is where replies from recipients go,
`fees@johnwhitgiftfoundation.org`. When it is not set, Production uses that
same address and every other environment sends with no reply address.

**`RESEND_INVITE_BCC_EMAIL`** is the address pre-filled in the BCC box when an
administrator sends an individual invitation. When it is not set, Production
pre-fills `fees@johnwhitgiftfoundation.org` and every other environment leaves
the box empty.

**`RESEND_WEBHOOK_SECRET`** verifies the delivery notifications Resend sends
back, and begins `whsec_`. Find it in Resend, **Webhooks**, on the endpoint for
`https://jwf-bursary-system.vercel.app/api/webhooks/resend`, as **Signing
Secret**.

### 3.4 Application address

**`NEXT_PUBLIC_APP_URL`** is the Production web address,
`https://jwf-bursary-system.vercel.app`, with no trailing slash. The
application uses it to build the links in emails. Staging and local development
work out their own address, so they do not need it.

### 3.5 Scheduled jobs

**`CRON_SECRET`** proves that a request to a scheduled job came from Vercel.
Set it to a random string of 64 characters, generated by running
`openssl rand -hex 32` in a terminal. When it is not set, both scheduled jobs
refuse every request. See [09. Scheduled Jobs](09-scheduled-jobs.md).

### 3.6 Data retention

Controls the weekly job that permanently deletes applications once their
retention period has passed. See [09. Scheduled Jobs](09-scheduled-jobs.md).

**`RETENTION_PURGE_ENABLED`** set to `true` lets the job delete data. Any other
value, or leaving it unset, means the job reports what it would delete and
deletes nothing.

The four periods below are each a whole number. Leaving one unset keeps the
default shown.

- **`RETENTION_DECLINED_GRACE_DAYS`**, default `30`: days an application
  assessed as not qualifying is kept after it is archived.
- **`RETENTION_CLOSED_GRACE_DAYS`**, default `30`: days an application closed
  without an outcome is kept after it is closed.
- **`RETENTION_QUALIFIES_NOT_AWARDED_YEARS`**, default `6`: years an
  application that qualified but was not awarded is kept after submission.
- **`RETENTION_AWARDED_YEARS`**, default `7`: years an awarded bursary is kept
  after its account is closed.

### 3.7 Security and sessions

**`STAFF_MFA_ENFORCED`** should be left unset. Unset means two factor
authentication is required in Production and not required anywhere else, which
is the intended behaviour. `true` forces it on and `false` forces it off. Set
it to `false` in Production only as an emergency measure when staff cannot sign
in, as described in [13. Troubleshooting](13-troubleshooting.md), and remove it
once the cause is fixed.

The three settings below control the automatic sign out after a period of
inactivity. Leaving one unset keeps the default shown.

- **`NEXT_PUBLIC_SESSION_IDLE_ENABLED`**, default on: set it to `false` to turn
  automatic sign out off altogether.
- **`NEXT_PUBLIC_SESSION_IDLE_MINUTES`**, default `30`: minutes of inactivity
  before a user is signed out, between `1` and `720`.
- **`NEXT_PUBLIC_SESSION_IDLE_WARN_SECONDS`**, default `60`: seconds the
  warning is shown before the sign out happens.

### 3.8 Error monitoring

Sentry is configured in Production only.

**`NEXT_PUBLIC_SENTRY_DSN`** is the address Sentry receives errors at, a URL
beginning `https://`. Find it in Sentry, **Settings**, **Projects**,
`bursary-system`, **Client Keys (DSN)**.

**`SENTRY_DSN`** takes the same value as `NEXT_PUBLIC_SENTRY_DSN`.

**`SENTRY_ORG`** is the organisation slug, in Sentry, **Settings**, **General
Settings**, **Organization Slug**.

**`SENTRY_PROJECT`** is `bursary-system`.

**`SENTRY_AUTH_TOKEN`** is used during the build to upload source maps, which
let Sentry show the original source code in a stack trace. Create it in Sentry,
**Settings**, **Auth Tokens**, **Create New Token**.

When the DSN variables are not set, the application sends nothing to Sentry.

### 3.9 Behaviour switches

**`ROUNDS_SINGLE_OPEN_ONLY`** set to `true` allows only one assessment round to
be open at a time. Unset, several rounds can be open at once.

**`SUPABASE_STORAGE_BUCKET`** names the Supabase Storage bucket holding
documents. Leave it unset, which means `documents`.

### 3.10 Set automatically

Vercel and Node.js set these. Never add them manually.

- `VERCEL_ENV` and `NEXT_PUBLIC_VERCEL_ENV` hold `production` on Production and
  `preview` on Staging.
- `VERCEL_URL`, `VERCEL_BRANCH_URL` and `VERCEL_PROJECT_PRODUCTION_URL` hold
  web addresses of the current deployment.
- `VERCEL_GIT_COMMIT_SHA`, `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` and
  `VERCEL_GIT_COMMIT_REF` hold the Git commit and branch that was built.
- `NODE_ENV` holds `production` on both Production and Staging.
- `NEXT_RUNTIME` and `CI` hold internal build and runtime details.

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

**The database password**, which belongs to the `postgres` user. Reset it in
the Supabase project, **Project Settings**, **Database**, **Reset database
password**. Then update `DIRECT_URL` in the matching Vercel scope, in
`.env.local` and `.env` for Staging, and in the matching `*_DIRECT_URL` GitHub
secret.

**The `app_user` password.** Set a new one in the Supabase project, **SQL
Editor**, by running `ALTER ROLE app_user WITH PASSWORD '<new password>';`.
Then update `DATABASE_URL` in the matching Vercel scope, in `.env.local` and
`.env` for Staging, and in the matching `*_DATABASE_URL` GitHub secret.

**`SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.** Both come
from the same source, so both change together: the Supabase project, **Project
Settings**, **JWT Keys**. Changing the legacy JWT secret replaces both keys and
signs every user out. Then update both variables in the matching Vercel scope,
and in `.env.local` for Staging. See
[JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys).

**`RESEND_API_KEY`.** Create a new key in Resend, **API Keys**, update the
Vercel Production and Preview scopes and `.env.local`, redeploy, then delete
the old key.

**`RESEND_WEBHOOK_SECRET`.** In Resend, **Webhooks**, add a new endpoint for
`https://jwf-bursary-system.vercel.app/api/webhooks/resend` with all email
events, copy its signing secret into the Vercel Production scope, redeploy,
then delete the old endpoint.

**`CRON_SECRET`.** Generate a new value with `openssl rand -hex 32` and update
the Vercel Production scope, and the Preview scope if it is set there.

**`SENTRY_AUTH_TOKEN`.** Create a new token in Sentry, **Settings**, **Auth
Tokens**, update the Vercel Production scope, redeploy, then revoke the old
token.

Passwords generated for database users must contain only letters and numbers.
Symbols in a password break the connection string format.

Vendor documentation:
[Supabase database passwords](https://supabase.com/docs/guides/database/postgres/roles#passwords) ·
[Supabase API keys](https://supabase.com/docs/guides/api/api-keys) ·
[Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction)
