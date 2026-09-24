# 04 — The migration toolkit

The toolkit is a small TypeScript CLI in the repo (`scripts/gt-migration/`), run
with `tsx` like the existing backfill scripts. It is built in M3. This document is
its specification.

Design principles:

- **Deterministic build, separate from load.** `build` turns inputs into one
  canonical file with a content hash. `load` only ever reads that file. The same
  hash always produces the same writes.
- **Idempotent and resumable.** Every write is find-or-create on a natural key
  (`02-target-model.md` Part 1). Re-running a load after a crash completes it;
  re-running a finished load changes nothing and says so.
- **Everything created is ledgered**, in the target database and mirrored locally,
  *before* the irreversible part of each step where that is possible.
- **Small blast radius.** One account = one DB transaction. A failed account rolls
  itself back and is reported; the run continues until a tripwire says stop.
- **No personal data in logs.** Logs carry the account key hash and GT grant id,
  never names, emails or figures. Packs and canonical files stay in `../data/migration/`.

## 1. Layout

```
scripts/gt-migration/
  cli.ts                 command router (npm run mig -- <command>)
  config.ts              env targeting, paths, tolerances, tripwire thresholds
  state.ts               STATE.json / STATE.md read-write, gate helpers
  extract/               GT (SQL Server) → JSONL
    queries/*.sql        one file per extract; no SELECT *
  build/
    sheet.ts             parse her 273 sheet (csv export) → rows
    match.ts             sheet row ↔ GT grant ↔ latest assessment entity
    map-identity.ts      §1–§2 of 03-field-mapping
    map-assessment.ts    §3–§5
    reason-codes.ts      §6 crosswalk
    flags.ts             §8
    canonical.ts         assemble + hash
  calc/
    reference.ts         load the ReferenceBundle exactly as the app does
    run.ts               calculateAssessmentV2 wrapper, family ordering
    parity.ts            E9: reproduce existing assessments' snapshots
  load/
    identities.ts  accounts.ts  assessments.ts  documents.ts
    ledger.ts            DB ledger + local mirror, intent/done protocol
  verify/
    invariants.sql.ts    06-checks §1, as parameterised queries
    verify.ts            run them, compare to canonical, write results
  rollback/rollback.ts   ledger-driven, reverse dependency order
  packs/
    exceptions.ts  questions.ts  reconciliation.ts  ingest.ts   (xlsx via exceljs)
  __tests__/             fixtures are synthetic; never real rows
```

`package.json`: `"mig": "tsx scripts/gt-migration/cli.ts"`.

## 2. Commands

| Command | Writes to | What it does |
|---|---|---|
| `mig status` | – | Milestone, open gates and who each waits on, current hashes, last run per env. |
| `mig preflight --env <e>` | – | Every check in `05-milestones.md` M0 (and the prod-only ones for `prod`). Exit non-zero on any failure. |
| `mig extract --snapshot <id>` | `extract/<id>/` | Runs the SQL files against the local `jwf-mssql` container. Records row counts and a sha256 per file. |
| `mig build` | `canonical/<hash>/` | inputs + extract + `decisions.json` → `accounts.json`, `flags.json`, `build-report.md`. Updates `canonicalHash`; resets dependent gates if it changed. |
| `mig calc [--env <e>]` | `canonical/<hash>/calc-<env>.json` | Runs the engine for every unblocked account using the **target env's** reference bands. Read-only on the DB. |
| `mig parity --env <e>` | `runs/` | E9 parity check against existing assessments. |
| `mig pack <exceptions\|questions\|reconciliation>` | `packs/<date>/` | Builds an xlsx pack for Charlotte. |
| `mig ingest <file.xlsx>` | `decisions.json` | Reads a returned pack; validates; shows a diff; asks for confirmation before writing. |
| `mig load --env <e> --phase <p> [--only k1,k2] [--limit n] [--dry-run]` | target DB | One phase: `identities` \| `accounts` \| `assessments` \| `documents`. |
| `mig verify --env <e> [--run <id>]` | `runs/<id>/verify.json` | Post-load invariants + canonical comparison. |
| `mig rollback --env <e> --run <id> [--phase <p>] [--only k1,k2] [--dry-run]` | target DB | Ledger-driven removal. See `06-checks-and-rollback.md` §4. |
| `mig drill rollover --env nonprod --only k1,k2` | nonprod | M9 forward-compatibility drill. |

Every writing command prints, before doing anything: target env, Supabase project
ref, canonical hash, phase, account count, hold-back count, and whether an
approval exists for this exact (env, hash, phase). Then it waits for nothing on
nonprod, and **refuses on prod without a matching approval in `STATE.json`**.

## 3. Environments and guards

- Env files, gitignored (`.env.*` already is): `.env.migration.nonprod`, `.env.migration.prod`.
  Each holds only `DIRECT_URL` (session pooler, port 5432, owner role),
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIG_ENV=<nonprod|prod>`,
  `MIG_EXPECT_PROJECT_REF=<ref>`.
- The CLI loads **only** the file named by `--env` and refuses to start if:
  - the project ref parsed from `DIRECT_URL` or the Supabase URL ≠ `MIG_EXPECT_PROJECT_REF`, or either equals the known dead project ref `bzxoepyhmfvydoxfklft`;
  - `RESEND_API_KEY` is set in the process environment (nothing in the toolkit may be able to send mail);
  - `--env prod` and: no approval for this (hash, phase); or the last nonprod run of the same hash is not `verified`; or PR-C / PR-D objects are missing from the prod schema; or the working tree is dirty or not on a commit contained in `origin/main`.
- The toolkit imports app modules for behaviour it must not re-implement
  (`calculateAssessmentV2`, `generateSchedule`,
  `provisionApplicantAuthUser`, `dominantEmploymentStatus`, `computeContentDigest`,
  `schoolingYears` helpers). It must **not** import anything under `src/lib/email/`
  (the Resend module throws at import when the key is unset, which is a useful
  tripwire: if an import chain pulls it in, the toolkit fails at start-up. Fix the
  import, do not set the key).
- Prisma CLI commands are never part of the toolkit. Schema changes reach each
  environment only through merged PRs (`db-push.yml`).

## 4. The ledger

Table (PR-D), RLS admin-only:

```
data_migration_ledger
  id            uuid pk
  run_id        text        -- e.g. np-r1-20260926, prod-20261005
  phase         text        -- identities | accounts | assessments | documents
  account_key   text        -- sha256(normalised reference), not the reference itself
  entity_type   text        -- AuthUser | Profile | Contact | Application | ApplicationContributor |
                            -- Assessment | AssessmentEarner | AssessmentProperty | Recommendation |
                            -- BursaryAccount | BursaryScheduleEntry | Document | StorageObject
  entity_id     text        -- uuid, or the storage object key
  state         text        -- intent | done | rolled_back
  created_at    timestamptz
  unique (entity_type, entity_id)
```

Protocol:

- **DB rows:** ledger rows are inserted in the *same transaction* as the rows they
  describe, so they commit or vanish together (`state = done`).
- **External side effects** (auth users, storage objects) cannot join a DB
  transaction. For these: write `intent` (own small transaction) → perform the call
  → flip to `done`. A crash leaves an `intent` row; `rollback` and `load` both
  reconcile intents first (does the auth user / object exist? then adopt it or
  remove it).
- A row that **already existed** and was reused (an auth user for a parent who
  already has one) is **never ledgered**, so it can never
  be deleted by a rollback. The run manifest lists reuses separately.
- Local mirror: `runs/<run-id>/ledger.jsonl`, appended and fsynced per account.
  If the DB ledger and the mirror disagree at `verify`, that is a stop-the-line.

## 5. Load phases, ordering, hold-backs

```
identities  → one auth user + profile per lead email
accounts    → per account: contact, placeholder application (+primary contributor),
              bursary account, schedule entries (year 1 COMPLETE + linked)
assessments → per account: assessment (+earners, property),
              recommendation (+reason codes, gap reasons), account.benchmarkPayableFees
documents   → per account: storage objects + document rows   (M8)
```

- A phase processes only accounts whose **blocking flags for that phase are all
  resolved** (`03-field-mapping.md` §8). The rest are *held back*: listed in the run
  manifest with the flag and the decision id they wait on. A later run of the same
  phase picks them up once `decisions.json` resolves the flag. This is what lets
  the bulk of the accounts proceed while Charlotte works through the exceptions.
- Accounts are independent (S22: no sibling absorption), so holding one account
  back never holds back a sibling's account.
- Per-account transaction, `timeout` 30 s. Inside the transaction the toolkit
  re-reads what it wrote and asserts the per-account invariants (`06` §1, group A)
  *before commit*; a failed assertion throws and the transaction rolls back.
- Concurrency 1. 273 accounts is minutes; parallelism buys nothing and costs
  clarity. Documents phase: concurrency 4 for uploads, 1 for DB rows.
- `--limit` and `--only` exist so every phase starts with a **canary**: 5 accounts
  covering each class (Trinity rolling, Whitgift new, OP, a 3-child family, a PB),
  verified, then the rest.

## 6. Email-free creation paths (the only ones the toolkit may use)

| Need | Use | Never use |
|---|---|---|
| Parent login | `provisionApplicantAuthUser` → `auth.admin.createUser({ email_confirm: true, password: random })` | `inviteUserByEmail`, `generateLink`, `signUp`, `resetPasswordForEmail`, raw SQL on `auth.users` |
| Profile | `createProfile(tx, …)` | – |
| Contact | `tx.contact.create` (as `createContact`) | `sendInvitationFromContactAction` without `skipEmail` |
| Application, assessment, recommendation | direct Prisma creates | `submitApplication` (sends CONFIRMATION), `set-outcome-core` (sends OUTCOME_*) |
| Bursary account + schedule | `tx.bursaryAccount.create` + `generateSchedule` | – |
| Invitations | **none are created** by the migration | any invite action |

After every load, `verify` asserts `email_log` has **zero new rows** since the run
started and that no `invitations` rows were created.

## 7. The calculation step

- Reference bands, notional costs, family-type configs and fees are loaded from the
  **target** database through the same loader the assessment page uses
  (`getConfigsForAssessment` and the v2 reference-bundle builder), so nonprod
  rehearsals use nonprod bands and prod uses prod's. `verify` on nonprod therefore
  also compares the *reference data* of nonprod and prod and reports any
  difference: a rehearsal is only evidence if the bands match.
- **Parity (E9):** for every existing v2 assessment in the target env, rebuild the
  engine input from stored inputs, run the engine, and compare all snapshot
  columns to the penny. Known exception: the one stale prod row whose stored
  `recommended_payable_fees` predates the actual-leg rule; parity reports it
  separately instead of failing. Any other mismatch blocks the `assessments` phase.
- Calculation results are written to `calc-<env>.json` first, reviewed (M5 pack),
  and the load writes *those* numbers. The load re-runs the engine in-transaction
  and refuses to commit if the fresh result differs from the reviewed one (a band
  changed between review and load).

## 8. Testing the toolkit itself (M3 exit)

- Unit tests with **synthetic** fixtures only: name casing rules, reference
  parsing (standard, `24/25_…` form, stray spaces, missing comma), school/fund
  derivation, reason-code splitting, the sheet-arithmetic check, flag logic,
  schedule horizons including OP.
- An integration test against a throwaway local Postgres (or a Supabase branch)
  that loads 6 synthetic accounts, verifies, rolls back, and asserts the database
  is byte-for-byte back to its starting row counts, then loads again.
- `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` and `npm test` green in CI.
