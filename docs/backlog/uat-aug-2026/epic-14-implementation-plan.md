---
title: "Epic 14 — implementation plan (autonomous execution)"
status: open
opened: 2026-08-16
opened_by: Brian Wagner
depends_on:
  - ./epic-14-uat-round-2.md
  - ./source-materials/assessment-model-requirements-2026-08-16.md
related:
  - ./sprint-01-implementation-plan.md   # Epic 13 precedent — war stories apply
  - ./epic-14-progress.md                # live sprint board — update as you go
---

# Epic 14 — implementation plan

This plan is written to be executed by Claude Code sessions **starting from a
brand-new context with full autonomy** (Brian, 2026-08-16). Everything a
session needs is in this file, the epic, the workbook extraction, and the
repo. Do not assume any conversation history exists.

## 0. Cold-start bootstrap (read this first, every session)

**Read, in order, before writing any code:**

1. Repo `CLAUDE.md` — the mandatory git workflow. Non-negotiable.
2. [`epic-14-uat-round-2.md`](epic-14-uat-round-2.md) — the requirement
   catalogue (CG-01..26), user stories, decisions D14-1..5.
3. [`source-materials/assessment-model-requirements-2026-08-16.md`](source-materials/assessment-model-requirements-2026-08-16.md)
   — Charlotte's workbook, extracted. **Ground truth for every C-wave WP.**
4. [`epic-14-progress.md`](epic-14-progress.md) — what is already done or
   in flight. Update it when you start and when you finish a WP.
5. This plan's §1–§4, then **only** your WP's brief in §6. Briefs are
   self-contained on purpose.
6. `sprint-01-implementation-plan.md` **§2 Ground rules only** — Epic 13's
   war stories (worktree Prisma-client hazard, `prisma format` CI trap,
   plan-edits-invisible-after-branch). All still apply verbatim.

**Environment facts (verified 2026-08-16):**

- Node: `export PATH="$HOME/.local/share/nvm/v22.12.0/bin:$PATH"` before any
  Prisma command (Prisma 6 needs ≥22.12).
- Prisma CLI reads `.env`; the app and seeds read `.env.local`. Both point at
  **nonprod** (`supabase-nonprod`). Verify the project ref before ANY direct
  DB write: nonprod is also **Charlotte's live test environment** — her
  `test3@johnwhitgiftfoundation.org` family and `TS-202627-0002` /
  `WS-202627-0010` data must never be modified or deleted.
- **Never** run `seed:demo` (destructive) or `prisma migrate reset` against
  nonprod. `seed:reference` is idempotent and safe.
- `audit_logs` is append-only at the DB level — cleanup scripts must not
  attempt `auditLog.delete*` or the whole transaction rolls back (42501).
- New tables get RLS force-enabled by the `ensure_rls` event trigger — a
  migration creating a table **must ship policies in the same PR** or every
  read comes back empty app-wide (patterns: migrations `20260519163000`,
  `20260710205004`).
- `profiles` is under RLS — scripts write it via the **service-role** client,
  never raw Prisma. Staff/test logins: use the project-local `/add-admin`
  skill. Standing nonprod admin: `brian.admin@jwf-bursary.test`.
- The local Resend key is **invalid** — emails cannot be sent from a local
  dev server. Validate email work with unit tests on rendering/merge and
  post-merge on staging (single Resend account across both Vercel scopes).
- Migration deploys: `db-push.yml` runs `prisma migrate deploy` against
  nonprod on push to `staging` (prod on push to `main`). A merged PR's
  migration auto-applies to nonprod. Keep migrations **additive**.

**CI gates (`.github/workflows/ci.yml`)** — run all of these locally before
opening a PR: `npx prisma validate` · `npx prisma format --check` ·
`npm run lint` · `npx tsc --noEmit` · `npm test` (vitest) · plus
`npm run build`. CI is the final authority (clean install + fresh
`prisma generate`), especially while schema-touching PRs are in flight.

**Authority (granted by Brian, 2026-08-16, for Epic 14):**

- Implement, test, push branches, open PRs **to `staging`**, and
  **squash-merge your own PR once CI is green** and the WP's validation
  evidence (§7) is recorded in the PR body.
- Never open or merge `staging` → `main`. Never force-push. Never bypass
  hooks. Never delete branches other than the one just merged.
- Adding/renaming **env vars** (WP-B1, WP-A3): make the code read them with
  safe defaults, document them, and **flag the Vercel-side value to Brian in
  the PR body** — do not run `vercel env add`.
- Escalate to Brian (stop, report, do not improvise) on: anything requiring
  a destructive DB operation; anything conflicting with a locked assumption
  (§3); anything that would change calculation outputs (LA-8/D14-4);
  anything touching prod.
- **Never email Charlotte or anyone external.** Client communication is
  Brian's. If a WP produces a question for Charlotte, write it into
  `epic-14-progress.md` under "For Brian → Charlotte".

## 1. Exit criteria

1. Wave A merged: duplicate UC uploads rejected end-to-end, upload progress
   honest, 60+60 idle timer, dialog overflow fixed, new post-submit
   download flow. Charlotte can retest same-day.
2. Wave B merged: every outbound email carries `replyTo`; missing-docs
   template carries Charlotte's copy; five invitation templates selectable.
3. Wave C merged: the assessment workspace matches the workbook extraction
   tab-for-tab and row-for-row (field-map committed, WP-C0), with **zero
   change to computed values** — proven by the untouched v2 engine unit
   tests plus the C0 parity test.
4. Wave D merged: four round scenarios configurable; portal shows the
   per-child forward schedule with SUBMITTED / START APPLICATION / LOCKED.
5. Wave E merged: a second child on the same parent email is invitable,
   registrable, and drivable through the portal under one login —
   integration-tested.
6. `epic-14-progress.md` fully ticked, with validation evidence linked per
   WP, and open items for Brian/Charlotte explicitly listed.

## 2. Ground rules

Everything in `sprint-01-implementation-plan.md` §2 applies. Deltas and
re-statements a cold session must not miss:

- **Branching**: `fix/e14-<wp>-<slug>` or `feature/e14-<wp>-<slug>` off
  freshly-pulled `staging`. One WP per PR unless the board pairs them. PRs
  target `staging`.
- **Sequential over parallel for Wave C.** C2–C8 all rework one surface
  (`assessment-form-v2.tsx` + the assessment route). Run them as a train,
  each branched after the previous merges. Waves A, B, D, E may run in
  parallel lanes with each other and with the C train (they touch disjoint
  files) — but prefer one-at-a-time unless confident; Epic 13's parallel
  worktree runs hit cwd and Prisma-client hazards (see sprint-01 §2).
- **The v2 engine is read-only this epic** (D14-4): `src/lib/assessment/v2/
  {income,notional-spend,debt,profiling,award,orchestrator}.ts` and their
  tests must not change behaviour. If a WP seems to require it → LA-8.
- **Copy is Charlotte's, verbatim** where she supplied wording (CG-08 email
  body, workbook labels including misspellings like "SILBINGS" — reproduce
  labels as written; fix nothing silently. Exception: plain typos in
  *internal* identifiers are fine; user-visible labels stay verbatim).
- **Terminology**: user-facing "Assessment"/"Assessments" per CG-17 applies
  to the surfaces WP-C1/C2 name — do not mass-rename routes, tables, or
  identifiers beyond the brief.
- Every WP updates `epic-14-progress.md` (status + PR link + evidence) in
  its own PR.

## 3. Locked assumptions (LA-1..8)

Charlotte has NOT yet answered the epic's §6 questions. To keep autonomous
sessions unblocked, Brian locked these defaults (2026-08-16). Build to
these; each is cheap to adjust if she answers differently. If implementing
against one becomes impossible or contradictory, escalate — do not invent a
third option.

| # | Assumption | If Charlotte disagrees |
|---|---|---|
| LA-1 | One-download rule stands (Epic 13 D13-4). Leaving the post-submit screen without downloading forfeits the copy. UI shows **no scarcity/warning copy** — just `DOWNLOAD MY COPY`. | Copy-level change only |
| LA-2 | Missing-docs email uses Charlotte's CG-08 copy verbatim (items list + return-by date merged). Replies land at `fees@…` via WP-B1 `replyTo`; parents may return documents by email, staff attach them. The portal `/respond` flow stays functional as the secondary path and the email does not mention it. | Template text edit |
| LA-3 | Invitation selector is a **3-way situation choice** (new / internal / rolling-over); school resolves from `Contact.school`. All five templates exist and are individually editable in Settings. | UI swap to 5-way picker; templates unchanged |
| LA-4 | The NA default-tax-year boundary is a **fixed 12 April** cutover (admin-editable dates cover drift). | Date/config change |
| LA-5 | Part 1 "Bursary award year of entry" and "Remaining years at the school" render **prefilled but editable** (from `Application.entryYear*` / engine), not empty. | Toggle prefill off |
| LA-6 | The workbook's "PART 5 personal debt + lifestyle squeeze" block renders on the **ASSESSMENT MODEL (1-4)** tab; "(5)" = the award tab. | Move a section |
| LA-7 | YoY-history / payable-fees-schedule rows for **pre-system years** are manual-entry cells; system years derive automatically. | Import instead of manual |
| LA-8 | Any workbook row with **no existing engine counterpart** is rendered as a display/manual cell wired to **no computation**, flagged in the WP-C0 field-map under "no engine source — needs sign-off", and listed for Brian. Never implement new maths (MSA 9.3 / D14-4). | New scope discussion (Brian) |

## 4. Ground truth (verified 2026-08-16 — re-verify anchors before relying)

Line numbers drift; verify with grep before editing. Corrections to the epic
are flagged ⚠️.

| Claim | Detail |
|---|---|
| No `replyTo` anywhere in the mailer | `src/lib/email/send.ts` — three `resend.emails.send` sites (~:108, :225, :297), all `from: fromAddress()` only; `fromAddress()` = `RESEND_FROM_EMAIL ?? "bursary@updates.meridiantech.group"` (~:31) |
| Email templates are migration-seeded | Repo `CLAUDE.md`: `*_seed_email_templates` migration is the single source of truth; `seed:reference` deliberately does NOT seed them |
| `EmailTemplateType` enum | `prisma/schema.prisma` (~:1184): INVITATION, CONFIRMATION, MISSING_DOCS, OUTCOME_*×4, REASSESSMENT, REMINDER, INVITE_STAFF, MISSING_DOCS_RESPONDED, SECONDARY_PARENT_*×3, APPLICATION_RESTART_REQUIRED, APPLICATION_EDITED_ON_BEHALF |
| Missing-docs flow exists | `src/components/admin/missing-docs-dialog.tsx` — picks outstanding slots, custom message, deadline (default +5d), pauses application, sends MISSING_DOCS; portal respond route at `src/app/(portal)/respond/` |
| `Document.contentDigest` exists & populates | Epic 13 D2; Sprint 01 browser pass confirmed a populated `content_digest` on upload. The **rejection** path is what CG-09 says fails — find where the duplicate check should run (likely the confirm endpoint or UC slot validation) and why it doesn't |
| v2 assessment form sections | `src/components/admin/assessment-form-v2.tsx`: `A. Family type & fees` (~:768), `B. Income entry` (~:831), `C. Notional spend` (~:945), `D. Property, debt & savings` (~:1056), `E. Flags` (~:1200), `F. Assessor's Wizard` (~:1223) |
| v2 engine modules | `src/lib/assessment/v2/`: award, debt, income, manual-adjustment, notional-spend, orchestrator, **prefill**, profiling, reference-bundle, save-gate, types |
| Admin nav has no Assessments item | `src/components/admin/admin-nav.tsx` (~:48-77): Dashboard / Applications(`/queue`) / All Rounds / Current Round / Contacts / Send Invitations / Reports / Exports / Audit Log / Users / Settings |
| Application detail tabs | `src/app/(admin)/applications/[id]/layout.tsx`: Applicant Data · Assessment · Recommendation · History; header card shows reference + school + status badges; Manage affordances (GDPR, second parent) already grouped below |
| ⚠️ A "Manage" grouping already exists | Same layout: `showManageCard` block — CG-19 is *collapse behind a button/disclosure*, not create from scratch |
| `Contact` is one-child-per-row | `prisma/schema.prisma` (~:874): `@@unique([profileId, childName, childDob])`, `email` indexed non-unique, `profileId` nullable — same email across several child-contacts is legal |
| `Round` shape | `academicYear @unique`, `openDate`, `closeDate`, `decisionDate?`, legacy `defaultSubmissionDeadline` (no readers), `defaultSubmissionDeadlineNew`, `defaultSubmissionDeadlineRollingOver` (Epic 13 E1/D13-8); resolver `src/lib/rounds/submission-deadline.ts` |
| `ApplicationType` | `NEW \| ROLLING_OVER` — Charlotte's "internal application" is today only a reason-code concept (code 35) + internal-request dialog, NOT an ApplicationType. WP-B3 keys templates on situation, not on a new enum value, unless D1 decides otherwise |
| Portal schedule exists | `src/app/(portal)/schedule/page.tsx` → `getPortalScheduleForUser` + `buildPortalScheduleRows` (`src/lib/bursary-accounts/portal-schedule.ts`) + `ScheduleCalendar`; backed by Epic 10 `ScheduleEntry`/`scheduleYears` |
| Portal home composition | `src/app/(portal)/page.tsx` + `application-type-chooser.tsx`, `onboarding-card.tsx`, `reassessment-card.tsx` — audit for single-application assumptions (WP-E2) |
| Idle timer | `IdleLogoutWatcher` in the portal layout; `NEXT_PUBLIC_SESSION_IDLE_MINUTES` / `_ENABLED` work since Epic 13 B1 (must be **literal** `process.env.NEXT_PUBLIC_*` reads — see follow-ups.md) |
| One-time PDF | `Application.submissionPdfDownloadedAt` + `src/components/portal/submission-download-offer.tsx` + `/submitted` page + `src/app/api/pdf/submission/[applicationId]/route.tsx` |
| Reason codes today | 35 seeded placeholder codes in `reason_codes` (via `seed:reference`); settings tab exists. Charlotte's real lists (36 YoY + 9 gap) are in the workbook extraction |
| `BursaryAccount.feesAccountCode` is GONE | Removed by Epic 13 D13-1a — the workbook's "Fees Account Code" column renders `Application.reference` instead (see extraction sheet-3 note) |

## 5. Sprint board

Sizes: S ≤ half day · M ~1 day · L 2 days+. Update live status in
[`epic-14-progress.md`](epic-14-progress.md), not here.

| Lane | WP | Size | Branch | Depends on |
|---|---|---|---|---|
| A | A1 dup-detection fix | M | `fix/e14-a1-uc-duplicate-rejection` | — |
| A | A2 upload progress honesty | S–M | `fix/e14-a2-upload-progress` | A1 merged (same surface) |
| A | A3 idle timer 60+60 | S | `fix/e14-a3-idle-timer-60` | — |
| A | A4 expiry-dialog overflow | S | `fix/e14-a4-expiry-dialog` | pair with A3, one PR ok |
| A | A5 post-submit download flow | M | `feature/e14-a5-submit-download-flow` | — |
| B | B1 replyTo | S | `feature/e14-b1-reply-to` | — |
| B | B2 missing-docs template | S–M | `feature/e14-b2-missing-docs-copy` | B1 (copy references replies) |
| B | B3 invitation variants | M–L | `feature/e14-b3-invitation-templates` | B2 pattern; D1 merge-field names if available (soft) |
| C | C0 field-map | S–M | `docs/e14-c0-field-map` | — (do FIRST in wave C) |
| C | C1 assessments queue + naming | M | `feature/e14-c1-assessments-queue` | C0 |
| C | C2 chrome (header/manage/banner/see-computation) | M | `feature/e14-c2-assessment-chrome` | C1 |
| C | C3 five-tab IA + documents tab + application-form tab | L | `feature/e14-c3-five-tabs` | C2 |
| C | C4 prefill removal + Part 1 | M | `feature/e14-c4-part1-prefill` | C3 |
| C | C5 income two-column table | L | `feature/e14-c5-income-table` | C4 |
| C | C6 parts 3–4 tables | L | `feature/e14-c6-notional-assets-tables` | C5 |
| C | C7 award tab | L | `feature/e14-c7-award-tab` | C6 |
| C | C8 assessment-admin tab | L | `feature/e14-c8-admin-tab` | C7 |
| C | C9 reason codes | M | `feature/e14-c9-reason-codes` | C7 (pickers) — data part can start any time |
| D | D1 round scenarios (schema+admin) | L | `feature/e14-d1-round-scenarios` | — |
| D | D2 scenario consumption | M | `feature/e14-d2-scenario-consumption` | D1 |
| D | D3 portal schedule home | L | `feature/e14-d3-portal-schedule-home` | D1 (dates), E1 (multi-child soft) |
| E | E1 second-child invite path | M | `fix/e14-e1-multi-child-invite` | — |
| E | E2 portal multi-application UX | L | `feature/e14-e2-portal-multi-child` | E1, D3 |

## 6. Work-package briefs

Each brief is self-contained: read §0–§4 + the brief + the files it names.

---

### A1 · UC duplicate-upload rejection · M · `fix/e14-a1-uc-duplicate-rejection`

**Requirement (CG-09).** Uploading the same file into two Universal Credit
slots of one application must be rejected with a message naming the clash.
Charlotte reproduced acceptance of a duplicate on 2026-08-16 (screenshot in
Gmail `1a009d228c39f4be`).

**Known state.** Epic 13 D2 added `Document.contentDigest` (sha-256,
computed server-side at upload confirm) and intended duplicate rejection for
the UC slots. The digest **populates** (verified in the Sprint 01 browser
pass). The rejection does not fire. Start by reading the D2 delivery:
`sprint-01-implementation-plan.md` §5 D2, the confirm endpoint under
`src/app/api/documents/`, and `src/lib/portal/document-rules.ts` /
`section-rules.ts` (UC rules ~:174-184).

**Steps.**
1. Reproduce in a vitest test first: two confirms with identical bytes into
   two UC slots → expect rejection. Watch it pass/fail to locate the gap
   (plausible causes: check compares within one slot; check runs on a
   validation path the presigned flow bypasses; digest committed after the
   uniqueness read; scope wider/narrower than one application).
2. Fix at the **server confirm** layer: within one application, a digest
   already present on another UC-slot document → 409 with a payload naming
   the existing slot/filename. Decide deliberately whether the rule is
   UC-slots-only (per D2) or any-slot-pair; default UC-only, note in PR.
3. Surface in `src/components/portal/file-upload.tsx` as human copy ("This
   is the same file you uploaded for …").
4. Regression tests: duplicate rejected; same file re-uploaded to the SAME
   slot (replace) still allowed; distinct files accepted.

**Validation.** Unit tests above; full local gates; browser check via
Playwright MCP against `npm run dev` — throwaway parent account (never
Charlotte's data), upload same PDF twice into UC slots, screenshot the
rejection, link evidence in the PR.

---

### A2 · Upload progress honesty · S–M · `fix/e14-a2-upload-progress`

**Requirement (CG-10).** Progress stalls at ~85% then completes. Diagnose;
either remove the stall or make the UI truthful.

**Likely mechanics.** Progress tracks the browser→storage PUT; the confirm
call (magic-byte sniff + sha-256 + `Document` row) happens after, unreported.
Read `file-upload.tsx` progress handling + the confirm endpoint.

**Steps.** Measure where time goes (large-ish PDF, ~6 MB). If confirm
dominates: (a) show a distinct determinate-to-indeterminate "Processing…"
phase after the PUT completes, and (b) check for cheap wins (streaming hash,
avoid double-reads). Do not weaken the sniff or digest (A1 depends on it).

**Validation.** Unit-test any confirm refactor; browser check with a >5 MB
file: progress reaches 100%/processing state without a silent multi-second
freeze; screenshot.

---

### A3 · Idle timer 60+60 · S · `fix/e14-a3-idle-timer-60`

**Requirement (CG-12, Charlotte's explicit preference).** Applicant idle
window 60 minutes; warning near expiry (including backgrounded tabs — that
path shipped in Epic 13 B1, do not regress it); warning offers a one-click
extension of a further 60 minutes.

**Steps.** Set the default minutes to 60 for the portal (keep
`NEXT_PUBLIC_SESSION_IDLE_MINUTES` override working — values must be read as
**literal** `process.env.NEXT_PUBLIC_*` expressions or they vanish in the
client bundle; see follow-ups.md for the Epic 13 postmortem). Ensure the
warning's "stay signed in" resets the full window (that IS the +60). Update
any copy that promises "30 minutes". Note in the PR body for Brian: Vercel
envs may pin the old value — flag, don't set.

**Validation.** Unit-test the config resolution (default 60, env override
wins). Browser check with a short test override (e.g. 1–2 min): warning
appears, extend works, expiry signs out; screenshots. Pair with A4 in one PR
if touching the same dialog.

---

### A4 · Expiry-warning dialog overflow · S · (pair with A3)

**Requirement (CG-11).** Warning text renders outside the modal (her
screenshot, Gmail `1a009d228c39f4be` image001). Fix the dialog layout
(long-copy wrap, small viewports). Browser-verify at 375px and desktop.

---

### A5 · Post-submit download flow · M · `feature/e14-a5-submit-download-flow`

**Requirement (CG-13, amends the *presentation* of Epic 13 D13-4; LA-1).**
Flow: SUBMIT (existing confirm dialog stays) → "file sent" confirmation →
single button **`DOWNLOAD MY COPY`** with **no explanatory/scarcity text** →
continue → portal home. The parent is not told it is their only chance; the
one-successful-download server rule is unchanged.

**Read.** `src/app/(portal)/submitted/`,
`src/components/portal/submission-download-offer.tsx`,
`src/app/api/pdf/submission/[applicationId]/route.tsx`, sprint-01 §5 D1.

**Steps.** Rework the submitted screen to the three-beat flow; strip
warning copy; after download (or explicit continue) land on portal home.
Keep the 410-after-consumed route behaviour. Do NOT reintroduce any
re-download surface elsewhere.

**Validation.** Component/unit tests for the state transitions; the PDF
route's consumed-flag tests still green. Browser: submit a **throwaway**
application end-to-end locally, screenshot each beat, confirm the button
disappears after download and `/submitted` revisit shows no download path.
(This consumes the throwaway's single download — fine; never do it on real
data.)

---

### B1 · replyTo on all sends · S · `feature/e14-b1-reply-to`

**Requirement (CG-05, D14-5).** Parent replies must reach
`fees@johnwhitgiftfoundation.org`.

**Steps.** Add `replyTo: replyToAddress()` to all three
`resend.emails.send` sites in `src/lib/email/send.ts`; helper reads
`RESEND_REPLY_TO_EMAIL ?? "fees@johnwhitgiftfoundation.org"`. Show the
reply-to alongside the from-address anywhere the UI previews the sender
(bulk wizard step 2 shows `fromAddress()` — check). Document the env var.
**PR body must flag to Brian**: set `RESEND_REPLY_TO_EMAIL` in Vercel
(Preview → a test inbox if desired; Production → fees@). Default makes prod
correct even if unset.

**Validation.** Unit test asserting every send path passes `replyTo`
(mock Resend). Local send is impossible (invalid key) — note that staging
verification is a Resend-dashboard/live-email check for Brian post-merge;
list it in `epic-14-progress.md` "For Brian".

---

### B2 · Missing-docs template copy · S–M · `feature/e14-b2-missing-docs-copy`

**Requirement (CG-07/08, LA-2).** Subject:
`JWF - Your bursary assessment has been paused.` Body: Charlotte's draft
verbatim (Gmail `1a009e2ebb90dc14`):

> Dear {{…}}
>
> Thank you for submitting your bursary application. We have had to pause
> our assessment as we are missing the following clarification/documents:
>
> {{missing_items}}
>
> Please kindly send us by email these documents and we will attach them to
> your application.
>
> Please ensure that we receive these additional document/information by
> {{deadline}}
>
> Kind regards
>
> JWF Bursary team

**Steps.** New `*_seed_email_templates`-pattern migration updating the
MISSING_DOCS row (subject + body; single source of truth is the migration —
never `seed:reference`). Wire merge fields: the ticked-slot list and the
dialog's deadline already exist in `missing-docs-dialog.tsx` — confirm they
reach the merge data (extend if not). Keep the standard HTML
wrapper/greeting (answers her CG-07 question — record the answer in
progress-file "For Brian → Charlotte": yes it emails the lead applicant;
replies go to fees@ once B1 ships; standard wrapper applies). Portal
`/respond` flow untouched (LA-2).

**Validation.** Merge/render unit tests (fields substituted, list formats,
date en-GB). Migration applies cleanly (`prisma migrate dev` locally). No
live send needed.

---

### B3 · Five invitation templates · M–L · `feature/e14-b3-invitation-templates`

**Requirement (CG-26, LA-3).** Five editable templates: new-TS, new-WS,
internal-TS, internal-WS, rolling-over (one, both schools). Selection =
situation (new / internal / rolling-over) chosen at contact-create and/or
invite-send; school auto-resolves from `Contact.school`.

**Design constraints.** Templates live in `email_templates` keyed by
`EmailTemplateType` — extend the enum
(`INVITATION_NEW_TS`, `INVITATION_NEW_WS`, `INVITATION_INTERNAL_TS`,
`INVITATION_INTERNAL_WS`, `INVITATION_ROLLING`) via an **additive**
migration + a seed migration inserting five rows (bodies: clone the current
INVITATION body; rolling-over body mentions the portal re-opening on 12
April and the submission window — merge fields for opening date + deadline,
sourced from the Epic 13 E1 resolver, NOT invitation-token expiry — that bug
class is documented in sprint-01 §3). Keep legacy `INVITATION` as fallback
when no situation is chosen. Settings → Email Templates must list all five
(check `template-labels.ts` / `locked-types.ts` for registration points).
Existing REASSESSMENT template: leave as-is; rolling-over *invitations* are
a different send than reassessment notifications — check
`src/app/(admin)/invitations/actions.ts` for which template each path uses
and route the rolling path to `INVITATION_ROLLING`.

**Steps.** Migration(s) → template resolution helper
`(situation, school) → EmailTemplateType` with tests → situation selector
UI on the contact-create dialog and invite-send step (default: NEW) →
persist the situation on `Invitation` (additive nullable column) so resends
reuse it.

**Validation.** Unit tests for resolution + each template's merge render;
`prisma format`; browser check of the selector and Settings list. Live-send
check listed for Brian post-merge.

---

### C0 · Field-map: workbook ⇄ engine/UI · S–M · `docs/e14-c0-field-map`

**Requirement.** The reconciliation artefact every C-wave WP builds
against, and the LA-8 sign-off list. **Do this before C1.**

**Steps.** Produce `docs/backlog/uat-aug-2026/epic-14-field-map.md`: one
row per workbook row (use the extraction doc) → target tab/section →
existing v2 engine input/output (`types.ts`, `income.ts`,
`notional-spend.ts`, `debt.ts`, `profiling.ts`, `award.ts`,
`reference-bundle.ts`, `prefill.ts`) or existing form field → fill mode →
status: `exists` / `presentation-only gap` / **`no engine source`** (LA-8
list). Also map every *current* form field with no workbook row (candidates
for removal — list, don't remove yet; flag for Brian). Read the engine
modules and their tests; do not guess.

**Validation.** Doc-only PR. The LA-8 list and removal-candidate list are
called out in the PR body and copied to `epic-14-progress.md` "For Brian".

---

### C1 · Assessments queue + naming · M · `feature/e14-c1-assessments-queue`

**Requirement (CG-17, US-C1).** A dedicated **Assessments** list, separate
from the applications queue; assessment surfaces titled "Assessment".

**Steps.**
1. New route `src/app/(admin)/assessments/page.tsx`: table of assessments —
   columns ≈ reference, school, assessment status (due/not started · in
   progress · paused · completed · locked-by-outcome), assignee, round;
   filter by status/assignee; row-click → the assessment workspace. Derive
   from existing `Assessment` + `Application` data (an application whose
   assessment hasn't started yet appears as "Not started" — decide the query
   shape; no schema change expected). Respect role scoping: ASSESSOR sees
   only assigned (mirror the guard in `applications/[id]/layout.tsx`).
2. Nav (`admin-nav.tsx`): add "Assessments" beside "Applications".
3. Titles: assessment page/tab headings say "Assessment …" not
   "Application …" (surface-level only — routes and identifiers stay).
4. Loading/empty states per the shared components.

**Validation.** Unit-test the status-derivation query helper. Browser:
nav → list renders nonprod's existing assessments with sane statuses;
ASSESSOR-role spot check (use `/add-admin` skill to mint an assessor);
screenshots.

---

### C2 · Assessment chrome · M · `feature/e14-c2-assessment-chrome`

**Requirement (CG-18/19/21).** On the assessment view: (a) hide the
application status-badge block — keep reference (+ school) on the left;
(b) second-parent + GDPR card collapses behind a **Manage** disclosure
(closed by default); (c) form actions (save / complete / pause / reopen)
move to a banner row level with the tab titles; (d) live calculation panel
hidden behind a **SEE COMPUTATION** toggle (collapsed default, state may
persist in `localStorage`).

**Read.** `applications/[id]/layout.tsx` (header + `showManageCard`),
`assessment-form-v2.tsx` (actions + calc display).

**Scope guard.** Applicant-data and recommendation routes keep their
current chrome; only assessment routes change. Reopen/complete logic
untouched — placement only.

**Validation.** Existing tests green; browser screenshots: default
(computation hidden, manage collapsed), expanded states, 13" laptop width.

---

### C3 · Five-tab IA · L · `feature/e14-c3-five-tabs`

**Requirement (CG-16/23, US-C2/C3/C4, D14-2).** The assessment workspace
becomes five tabs:
`UPLOADED DOCUMENTS DISPLAY · APPLICATION FORM · ASSESSMENT MODEL (1-4) ·
BURSARY AWARD CALCULATION (5) · ASSESSMENT ADMIN`.

**Steps.**
1. Restructure the assessment route into a tabbed shell (sub-routes or
   client tabs — prefer sub-routes for deep-linking;
   `applications/[id]/assessment/(tabs)` layout).
2. **Uploaded Documents Display**: filter row (text on slot/filename +
   "verified only"), document list (slot · filename · verified · contributor
   — grouping logic exists in `document-list-client.tsx`), inline viewer for
   the selection. Harvest from `document-list-client.tsx`; **retire the
   split-screen** (`split-screen.tsx`) from this route (delete if no other
   importer — check first). Keep presigned-URL caching and keyboard nav if
   cheap.
3. **Application Form**: read-only full application, child details →
   declaration, reusing the applicant-data renderers from
   `applications/[id]/page.tsx`; per section, list its uploaded documents'
   **titles/filenames only** (no viewer here). Include a link "open in
   Uploaded Documents".
4. Tabs 3–5 mount the existing form sections as placeholders in this PR
   (Assessment Model = current sections A–D; Award = current recommendation
   pointer; Admin = current E/F) — C4–C8 rework the contents. Keep every
   existing save path working at each merge.

**Validation.** All local gates; browser walk of the five tabs on nonprod
data (an existing completed assessment + an in-progress one), screenshots
per tab; confirm document viewer parity (open, page, zoom if present);
confirm nothing writes on the read-only tabs.

---

### C4 · Prefill removal + Part 1 · M · `feature/e14-c4-part1-prefill`

**Requirement (CG-15/22, D14-3, LA-5).** Assessment Model opens **empty**
except sanctioned autofill; Part 1 renders as the extraction's 11-row table.

**Steps.**
1. `src/lib/assessment/v2/prefill.ts`: strip applicant-declared **figure**
   prefill (income amounts, savings, debts, property values). Keep:
   recipient first name/surname, remaining-years derivation, annual fees
   (reference data), year-of-entry (LA-5, editable), and reference-bundle
   notionals (they fill on family-category selection per AE-09 — that is
   reference autofill, not applicant data; keep the Epic-07-style
   don't-clobber-edited behaviour if present).
2. Delete "reported from application" display blocks in the form (the
   *Application Form tab* is now where declared values live — CG-15's
   "cross-reference" home, satisfying PRD AE-01).
3. Part 1 table per the extraction: 11 rows, exact labels, fill modes
   (annual fees autofilled + **hidden** — feeds the engine, not displayed;
   sibling rows 1–3 manual text; family category dropdown; schooling-age
   children manual number).
4. **Persistence audit**: existing in-flight assessments on nonprod keep
   their saved values (prefill changes affect NEW/empty forms only — do not
   null out saved data).

**Validation.** Engine tests untouched & green (D14-4). New unit tests:
prefill output shape. **Parity check**: run the orchestrator on a fixture
before/after — identical outputs for identical inputs. Browser: open a fresh
assessment → fields empty except the sanctioned set; screenshot.

---

### C5 · Income two-column table · L · `feature/e14-c5-income-table`

**Requirement (CG-20, US-C6).** One Excel-style table, workbook Part 2 rows
exactly (extraction §Part 2), **Parent 1 · Parent 2 as two value columns**,
status-block row groups, auto household-total row. Remove the explanatory
copy block. No commentary.

**Constraints.** Storage stays the existing per-earner v2 model —
presentation change; map each row 1:1 to `v2/income.ts` inputs via the C0
field-map. A row with no engine input → LA-8 (render manual/display,
no maths, flag). Rows the engine has but the workbook lacks → keep the
storage, surface per field-map recommendation, flag in PR. Zero-income and
manual-adjustment paths (Epic 13 C2) must keep working; the adjustment line
stays visible near the total.

**Validation.** Engine tests green; component tests for row→field binding
both columns; parity fixture (same inputs → same household total as before).
Browser: enter figures in both columns, verify total matches the engine's
prior rendering for the same figures; screenshots (desktop + 13" width —
the table must scroll gracefully, not break layout).

---

### C6 · Parts 3–4 tables · L · `feature/e14-c6-notional-assets-tables`

**Requirement (CG-16, US-C7, LA-6).** Notional-spend benchmarking, assets
categories, personal-debt + lifestyle-squeeze — as plain tables mirroring
the extraction row-for-row (labels verbatim), computed cells from
`notional-spend.ts` / `debt.ts` / `profiling.ts`, manual cells editable,
per the C0 field-map. Family-structure selector mirrors Part 1's category
(display-back, per the workbook note). LA-8 for any unmapped row (likely
candidates: car/public-transport notionals, JWF recipient allowance,
savings cushion, school-fees insurance — the field-map decides; if the
engine lacks them they render inert + flagged, no invented maths).

**Validation.** Engine tests green; parity fixture unchanged; component
binding tests; browser screenshots of all three blocks with a filled
example; confirm SEE COMPUTATION (C2) still reconciles with the table's
AUTO cells.

---

### C7 · Bursary Award tab · L · `feature/e14-c7-award-tab`

**Requirement (CG-16/14, US-C8).** The award sheet as tab 4 (extraction
sheet 2): sibling-fees block (3 manual rows + school selects; where the
sibling has a JWF bursary account, offer a picker that fills name/school/net
payable fees — manual otherwise), the income/benchmark figures
(`award.ts` outputs), manual recommendation cells, award summary, gap block
(gap value + 9-code multi-select), last-assessment payable fees + 36-code
multi-select, completed-on date. This tab is where the **outcome/
recommendation** flow gets its explicit home — integrate with the existing
recommendation form/actions rather than duplicating them (link or embed;
the recommendation's own save/lock rules unchanged). Snapshot semantics:
completed assessments are never recomputed — the tab renders snapshots for
COMPLETED, live values for in-progress.

**Reason-code pickers depend on C9's data — coordinate: land C9's seed
first or behind, but the picker component belongs here.**

**Validation.** Engine/award tests green; unit tests for the sibling-picker
fill and gap computation display; browser: drive a full assessment →
award → record outcome on a throwaway nonprod application; screenshots.
Confirm reopen (Epic 13 C1) still blocks after outcome.

---

### C8 · Assessment Admin tab · L · `feature/e14-c8-admin-tab`

**Requirement (CG-24, US-C9, LA-7).** Tab 5 per extraction sheet 3:
1. **Account synopsis** + **Assessor's wizard** free-text blocks (section F
   equivalents — relocate/rename the existing wizard section; check what
   persistence exists — `Assessment` fields vs checklist rows — and reuse,
   don't duplicate). Editable per existing rules; header strip shows
   recipient name · reference · school (reference = `Application.reference`;
   `feesAccountCode` is gone — see §4).
2. **YoY history table**: system years derive from prior assessments'
   snapshots (overall net income, savings, property equity, debt exposure,
   living arrangement, lifestyle squeeze) + computed deltas; **pre-system
   years are manual-entry cells** (LA-7 — needs an additive storage spot,
   e.g. a small `assessment_history_manual` table WITH RLS policies in the
   same migration, or a JSONB column on `BursaryAccount`; prefer the JSONB
   column for a first cut — no new table, no new policies).
3. **Payable-fees schedule table**: academic year · reason codes · payable
   fees · Δ · school year · submit-by · application status · assessment
   status · bursary status — derive from `ScheduleEntry` (Epic 10),
   applications, recommendations; future rows "Scheduled / Not started".

**Validation.** Query-helper unit tests with a multi-year fixture (deltas,
n/a first year); browser on a nonprod account with ≥2 assessment years
(seeded demo data has multi-year fixtures — if not on nonprod, build the
fixture as a unit test and browser-check the single-year render);
screenshots.

---

### C9 · Real reason codes · M · `feature/e14-c9-reason-codes`

**Requirement (CG-25, closes client deliverable D4).** Replace the 35
placeholder codes with Charlotte's **36 YoY** codes; add the **9 gap** codes
as a second set. Lists verbatim in the extraction (note the duplicate "5"
in the gap list — renumber sequentially 1–10→dedupe to 9 distinct codes,
flag the renumbering for Brian→Charlotte).

**Steps.** Schema: add a set/kind discriminator to `reason_codes` if absent
(additive). `seed-reference.ts`: idempotent upserts for both sets; decide
the fate of the old 35 (nonprod references exist? — query first via
supabase-nonprod MCP read-only; deactivate/flag rather than delete if
referenced). Settings → Reason Codes tab shows both sets. Pickers (C7)
consume by kind.

**Validation.** Seed runs twice idempotently (test or scripted assert);
settings tab renders both sets; unit test the picker filtering.

---

### D1 · Round scenarios · L · `feature/e14-d1-round-scenarios`

**Requirement (CG-01, US-D1, LA-4).** Represent Charlotte's four scenarios
(epic §CG-01 table): NA-current (any time, 20 Aug–19 Aug), NA-next-winter
(10 Nov–11 Apr, default tax year = *previous*), NA-next-spring/summer
(12 Apr–19 Aug, default tax year = *current*), RA (12 Apr–22 May, fixed).
Each: academic year, **default tax year**, opening date, submission date —
admin-editable ("ad hoc" for NA dates).

**Proposed shape (validate against the code before committing to it).**
Keep `Round` = one per academic year. Add additive columns or a small
`round_windows` config keyed `(roundId, scenario)` with
`{opensOn, submitBy, defaultTaxYear}`; scenario enum
`NA_CURRENT | NA_NEXT_WINTER | NA_NEXT_SPRING | RA`. RA rows default
12 Apr / 22 May; award-communication date = existing `Round.decisionDate`.
A pure resolver `resolveRoundScenario({applicationType, onDate})` returns
the scenario + derived defaults, unit-tested across the year boundary
matrix (19/20 Aug, 10 Nov, 11/12 Apr, 22 May edges). Builds ON Epic 13
E1's two type-aware deadline columns — reconcile rather than duplicate:
the E1 columns can become the derived storage the resolver writes, or the
resolver supersedes them; pick after reading
`src/lib/rounds/submission-deadline.ts` and its callers, and record the
choice in the PR body. **If a new table is created: RLS policies in the
same migration** (admin-only read/write — copy the pattern migrations named
in §0).

Admin UI: extend the round create/edit dialogs or a "Round settings"
section — four scenario rows, dates + tax year editable.

**Validation.** Resolver unit tests (the full boundary matrix + LA-4's
12 Apr cutover); migration additive + `prisma format`; browser: edit dates
in the admin UI, values persist; screenshots.

---

### D2 · Scenario consumption · M · `feature/e14-d2-scenario-consumption`

**Requirement (CG-01, US-D2).** Invitations and the application derive
tax year + deadline + opening date from the D1 resolver: invitation merge
fields (`{{deadline}}` = effective submission deadline — NEVER token
expiry; four historical injection sites listed in sprint-01 §3, re-check),
B3's rolling template gets opening date + deadline; the income form's
assessed-tax-year derivation reads the scenario default. **Reconcile with
Epic 02's dynamic tax-year rule engine — the rule engine wins where they
disagree; document any disagreement in the PR rather than silently
overriding.** NA ad hoc override: per-application deadline override exists
(Epic 13 E1 3-tier resolver) — keep it as the override mechanism.

**Validation.** Unit tests: merge-field sourcing per scenario; tax-year
derivation per scenario incl. the rule-engine precedence. Browser: create
invitations in two scenarios (mock dates via scenario config, not system
clock), inspect rendered template preview.

---

### D3 · Portal schedule home · L · `feature/e14-d3-portal-schedule-home`

**Requirement (CG-02/03, US-D3/D4).** Returning parents (≥1 bursary
account) land on the **Bursary Application Schedule**: per child, one row
per academic year — academic year · school year · opening date · submission
deadline · award communication date · state button. States: past+submitted →
`SUBMITTED` (label only); open year with startable/continuable application →
`START APPLICATION` (launches/continues it); future → `LOCKED` (inert).
First-time applicants (no account) keep the current single-path home (CG-03)
— the chooser/onboarding cards remain their journey.

**Read.** `src/app/(portal)/page.tsx` + cards,
`src/lib/bursary-accounts/portal-schedule.ts`,
`src/app/(portal)/schedule/page.tsx`, Epic 10's `ScheduleEntry`.

**Steps.** Extend `buildPortalScheduleRows` (or a sibling) to emit the
row-state machine + dates from D1 scenario config (RA dates for rolling
years); render on portal home for account-holders; `/schedule` route can
share the component. In-flight-application states (draft rolling
application) map to `START APPLICATION`→"Continue". Multi-account users:
one schedule block per child (E2 finishes the multi-child journey; D3
renders blocks for all accounts the profile leads — read-only correct even
before E2).

**Validation.** Unit tests on the row-state machine (submitted / open /
locked / continue, boundary dates). Browser as a seeded parent with an
account + history; screenshot; first-time throwaway sees the old journey.

---

### E1 · Second child on one login · M · `fix/e14-e1-multi-child-invite`

**Requirement (CG-04, US-E1).** Verify-and-fix the full path: admin creates
a second contact with the SAME email + different child → invites → parent
who already has an auth account accepts → second application/account binds
to the same `Profile`. Charlotte will run exactly this test herself — make
it work before she does.

**Steps.** Integration test (vitest, service-role/test harness) of the
accept flow for an email with an existing auth user; walk
`src/app/(admin)/invitations/actions.ts` + the accept/registration route.
Expected trouble spots: accept assumes "create new auth user" and errors on
existing email; contact-create friendly-dupe guard scoped per child
(verify); portal queries keyed "the profile's application" (fix reads that
break; full UX is E2). Fix what the test finds.

**Validation.** The integration test; browser: mint contact #2 on an
existing nonprod throwaway email, invite (email won't send locally — build
the accept URL from the DB token, documented gotcha), accept while signed
in / signed out, confirm one login sees both; screenshots. Clean up
throwaways (skip `auditLog` deletes — append-only).

---

### E2 · Portal multi-application UX · L · `feature/e14-e2-portal-multi-child`

**Requirement (CG-04/02, US-E2).** One login, several children: portal home
lists each child's schedule block (D3); opening a child's application sets
an explicit context (sidebar, autosave, submit all operate on that
application); switching children is explicit (home or a switcher in the
portal chrome).

**Steps.** Audit `(portal)` server components/queries for
single-application assumptions (`findFirst` by profile, "the current
application" helpers); thread an explicit application id (route param —
`/apply` likely already keyed by application? verify; if implicit-by-profile,
introduce `?app=`/segment carefully and keep old links redirecting);
per-application autosave keys; submit/confirmation flows correctly scoped.

**Validation.** Integration test: two applications, one profile — writes
to A never touch B. Browser: two-child throwaway from E1, fill both
part-way, switch back and forth, verify isolation + correct schedule
states; screenshots.

---

## 7. Validation & evidence standards (every WP)

1. **Local gates** before any PR: `npx prisma validate && npx prisma format
   --check` (if schema touched, run `npx prisma format` first) ·
   `npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run build`.
2. **Tests are part of the WP**, not optional: behavioural change → vitest
   in the nearest `__tests__/`; engine parity fixtures for C4–C7; the
   boundary matrix for D1. If you cannot write a meaningful test, say why
   in the PR body.
3. **Browser verification** for anything user-visible: `npm run dev`
   against nonprod, drive with the Playwright MCP tools, screenshot the
   acceptance-criteria states, attach/summarise in the PR body. Use
   throwaway data only; never touch Charlotte's `test3@…` /
   `charlotteperrier@…` records; clean up afterwards (no `auditLog`
   deletes).
4. **Migrations**: authored with `prisma migrate dev` locally; additive;
   RLS policies in the same PR for any new table; after merge, confirm
   application on nonprod (`db-push.yml` run green + supabase-nonprod MCP
   `list_migrations`).
5. **Merged = evidence recorded**: PR body contains what was validated and
   how; `epic-14-progress.md` row updated (status, PR #, evidence note,
   anything "For Brian").
6. **CI is the authority.** Local `tsc`/`build` are advisory while other
   schema PRs are in flight (worktree Prisma-client hazard — sprint-01 §2).

## 8. Post-merge follow-ups this plan already knows about

Collect these in `epic-14-progress.md` as they become live:

- Brian: set `RESEND_REPLY_TO_EMAIL` (B1) and confirm idle-timer env values
  (A3) in Vercel; live-email spot check after B1/B2/B3 reach staging.
- Brian → Charlotte: ping for retest after Wave A merges; again after Wave
  C; answers to epic §6 Q1–Q7 (built to LA-1..7 meanwhile); the LA-8
  no-engine-source list from C0; the gap-code renumbering (C9); reply to
  CG-07 (mechanics) and CG-14 (where outcomes live).
- Staging browser pass of the full assessment path (C-train) before
  Charlotte's session — same discipline as Epic 13's post-merge pass.
- The `staging → main` promotion remains **Brian-only**, as always.
