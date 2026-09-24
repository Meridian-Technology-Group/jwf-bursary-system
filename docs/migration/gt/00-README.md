# Grant Tracker → Bursary System migration runbook

**Status:** plan, 19 September 2026. Nothing in here has been executed.
**Owner:** Brian Wagner (Meridian). **Client decision-maker:** Charlotte Perrier (JWF Head of Fees & Bursaries).
**Executor:** Claude Code, working from this folder, one milestone at a time.

This folder is the single source of truth for moving the 273 live bursary accounts
out of Grant Tracker (GT) into the production bursary system. It is written to be
handed to a fresh Claude Code session with no other context.

> **No personal data in this folder.** These documents are committed to the repo.
> Every file that names a family, a pupil, an email address or a figure lives in
> `../data/migration/` (outside the repo, never committed, never published as an
> artifact). Refer to accounts here only by *class* ("the two pastoral boarders")
> or by count.

## Read in this order

| File | What it is | When you need it |
|---|---|---|
| `00-README.md` | This file: operating rules, state and resume protocol, milestone index | Every session, first |
| `01-decisions.md` | Decision register: what Charlotte and Brian have settled, what is open, and the default the toolkit uses until they answer | Before any design choice |
| `02-target-model.md` | What one migrated account looks like in the new system, row by row, and the system changes that must ship first | M1, M3 |
| `03-field-mapping.md` | GT field → new-system field, the reason-code crosswalk, the flag rules | M2, M3 |
| `04-toolkit.md` | The migration toolkit: commands, state files, the ledger, environment guards, idempotency | M3 |
| `05-milestones.md` | The runbook proper: M0–M9, each with preconditions, steps, automatic checks, outputs, exit gate, rollback | Every working session |
| `06-checks-and-rollback.md` | Invariants, tripwires, stop-the-line rules, and the rollback procedures | Before any load; whenever a check fails |
| `07-charlotte-loop.md` | How review packs go out, how her answers come back in, and how a paused run resumes | M2, M5, M6 |

## What is being migrated, in one paragraph

273 bursary accounts (221 rolling-over, 50 new awards, 2 pastoral boarders) across
247 lead-applicant email addresses. For each account the new system receives: a
contact-register entry, a parent profile (with a login, but **no email is sent**),
an active bursary account with its remaining years scheduled from the pupil's
2026-27 school year, a locked placeholder application carrying her GT reference,
an assessment **recalculated by the current model** from the GT inputs Charlotte
trusts, a recommendation carrying **her** 2026-27 award and payable fees as the
confirmed figures, the latest cycle's documents plus GT's PDF of the application
or annual review. GT's own calculated results, progress
reports, application-form data, email correspondence and finance/report sections
do **not** come across. History before 2026-27 and closed accounts are deferred
(M9).

## Hard dates

| Date | What |
|---|---|
| **Fri 2 Oct 2026** | GT access ends, including read-only. After this Charlotte cannot look anything up on GT's screens. |
| end of March 2027 | Parents are told they have a login (about 2 weeks before the portal re-opens for re-assessment). |
| 12 Apr – 22 May 2027 | Rolling re-assessment window. Every migrated account must roll over normally by then (proved in M9). |

We hold a full GT database copy (10 Sep 2026) and the document archive, so the
**build and the import do not depend on 2 Oct**. What does: every question that
can only be answered by Charlotte looking at GT. M2 exists to get all of those
questions to her in the first two days.

## Operating rules for the executor

These are in addition to the repo's `CLAUDE.md`, which always applies (branch off
`staging`, PR to `staging`, never push to `main`/`staging`, only Brian promotes).

1. **One milestone at a time, in order**, except where `05-milestones.md` says two
   may overlap. Never start a milestone whose entry gate is not recorded as passed
   in `STATE.json`.
2. **State before action.** At the start of every session run `npm run mig -- status`
   and read `../data/migration/STATE.md`. If they disagree with what you expected,
   stop and reconcile before doing anything else.
3. **Dry-run first, always.** Every command that writes has `--dry-run`. A real run
   is only allowed when the dry-run for the *same inputs hash* passed its checks.
4. **Nonprod twice, then prod.** Two complete, clean rehearsals on nonprod, the
   second one signed off by Charlotte, before anything is written to prod.
5. **Prod writes need Brian's explicit approval for that run**, recorded in
   `STATE.json` under `approvals[]` with the run id and the inputs hash. Approval
   for one run does not carry to the next. No prod write, and no prod rollback, on
   your own initiative.
6. **Charlotte's word must be explicit.** Never infer a decision from silence, tone
   or a related remark. If her reply is ambiguous, record it as `unclear`, keep the
   default, and ask Brian.
7. **You draft, Brian sends.** Emails to Charlotte or Alex are created as Gmail
   drafts (`brian@meridiantech.group`), never sent.
8. **Stop-the-line conditions are absolute** (see `06-checks-and-rollback.md` §3).
   When one fires: stop, do not retry, do not "fix forward", write an incident note
   to `STATE.md`, and tell Brian.
9. **Never send an email to a parent.** The import must use only the email-free
   creation paths listed in `04-toolkit.md` §6. The toolkit refuses to start if
   `RESEND_API_KEY` is present in its environment.
10. **Verify the target before any DB write**: print the Supabase project ref parsed
    from the connection string, compare it with `--env`, and refuse on mismatch.
    (The Prisma CLI reads `.env`; the app and scripts read `.env.local`. They have
    pointed at different projects before.)
11. **Trust CI for type-checking, not a warm local cache**:
    `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit`. The tsconfig has no `target`,
    so iterating a `Set`/`Map` directly is a compile error in CI.
12. **Report faithfully.** A check that failed is reported as failed, with its
    output. A step that was skipped is reported as skipped.

## State and resume protocol

All run state lives outside the repo in `../data/migration/` (created in M0):

```
../data/migration/
  STATE.json            machine state: milestone, gates, approvals, run ids, hashes
  STATE.md              human log: one dated entry per session, newest first
  decisions.json        Charlotte's and Brian's rulings, per account and global
  inputs/               her spreadsheets, as received, with sha256 + received date
  extract/<snapshot>/   raw GT extract (JSONL), one folder per GT snapshot
  canonical/<hash>/     accounts.json + flags.json built from inputs+extract+decisions
  packs/<date>/         review packs sent to Charlotte (xlsx) and her returned copies
  runs/<run-id>/        per-run manifest, local ledger mirror, check results, logs
  docs-staging/         decrypted documents for the current cycle (deleted after M7)
```

`STATE.json` shape (the toolkit owns it; do not hand-edit except to record an approval):

```json
{
  "milestone": "M2",
  "gates": {
    "M0.exit": { "passed": true, "at": "2026-09-20T10:12:00Z", "by": "auto" },
    "M2.charlotte-exceptions": { "passed": false, "waitingOn": "charlotte", "sentAt": "…", "pack": "packs/2026-09-21/exceptions.xlsx" }
  },
  "snapshots": { "gt": "20260910", "sheet273": "<sha256>", "trustedFields": "<sha256>" },
  "canonicalHash": "<sha256>",
  "runs": [ { "id": "np-r1-20260926", "env": "nonprod", "phases": ["identities","accounts"], "status": "verified" } ],
  "approvals": [ { "runId": "prod-20261005", "canonicalHash": "…", "by": "brian", "at": "…", "scope": "load:all" } ],
  "incidents": []
}
```

**Resuming after a pause** (the normal case, because Charlotte's answers take days):

1. `npm run mig -- status` → shows the current milestone and every open gate with who it waits on.
2. For each gate waiting on Charlotte, follow `07-charlotte-loop.md` §3 to look for her reply (Gmail thread + the Drive folder). Ingest anything new.
3. Re-run `npm run mig -- build`. If `canonicalHash` changed, every downstream gate that depended on it is automatically reset to "not passed": re-run the checks; never carry a pass across a hash change.
4. Continue from the first milestone whose exit gate is not passed.

Work that does **not** depend on Charlotte continues while gates are open: the
runbook marks which steps are blocked by which decision, and the toolkit loads
accounts whose flags are all resolved while holding back the rest (see
`04-toolkit.md` §5, "hold-backs").

## Milestones at a glance

| # | Milestone | Depends on | Human gate at exit | Target |
|---|---|---|---|---|
| M0 | Preflight: environments, snapshots, state folder, backups confirmed | – | Brian: real data on nonprod OK; doc-archive password | 20 Sep |
| M1 | System changes ship (Old Palace school, PB fund, migrated mode, ledger table, reason codes, defects that would mislead at 273×) | M0 | Brian merges PRs; later promotes to main | 21–25 Sep |
| M2 | Extract, canonical build, exception + questions pack to Charlotte | M0 | Charlotte: rulings (before 2 Oct) | 20–22 Sep |
| M3 | Toolkit built and unit-tested against fixtures | M0 (M1 for load phases) | – | 22–26 Sep |
| M4 | Rehearsal 1 on nonprod: full load, verify, **full rollback drill**, reload | M1, M2 build, M3 | – | 26–27 Sep |
| M5 | Reconciliation pack to Charlotte (GT vs recalculated, per account) | M4 | Charlotte: review, gap codes, flagged accounts | 28 Sep – 1 Oct |
| M6 | Rehearsal 2 on nonprod with her rulings; sign-off | M5 | **Charlotte signs off**; Brian approves prod run | 1–5 Oct |
| M7 | Production load (identities → accounts → assessments), verify | M6, M1 on `main` | Brian approves; Charlotte spot-checks | after sign-off |
| M8 | Documents (latest cycle + GT PDFs) to prod; archive the rest | M7 | Alex: archive location | trails M7 |
| M9 | Forward-compatibility drill (2027-28 rollover on nonprod), clean-up, deferred scope (prior years per her option 1–4, closed accounts) | M7 | Charlotte: which prior-year option | Oct |

M1, M2 and M3 run in parallel. The critical path to 2 Oct is **M2** (her GT
look-ups) and **M5** (anything in the reconciliation that sends her back to GT).
Everything else can finish after GT is switched off.
