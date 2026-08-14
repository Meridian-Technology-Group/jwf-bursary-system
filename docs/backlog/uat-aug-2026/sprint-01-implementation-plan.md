---
title: "Epic 13 Sprint 01 — implementation plan (all waves A–E)"
status: open
severity: high
area: portal, assessment, uploads, references, deadlines
opened: 2026-08-14
opened_by: Brian Wagner
depends_on:
  - ./epic-13-uat-feedback.md
sources:
  - ../../client-feedback/2026-08-13-charlotte-feedback.md
---

# Epic 13 Sprint 01 — implementation plan

**Audience:** a Claude Code session (or engineer) executing this sprint. This
document is self-contained enough to work from, but you MUST read first:

1. [`epic-13-uat-feedback.md`](epic-13-uat-feedback.md) — the epic: decisions
   D13-1…D13-8, per-WP scope, out-of-scope list. **Decisions are locked; do not
   relitigate them.**
2. [`../../client-feedback/2026-08-13-charlotte-feedback.md`](../../client-feedback/2026-08-13-charlotte-feedback.md)
   — the CF-01…33 catalogue with Gmail pointers (source of truth for what she
   actually said).
3. Repo `CLAUDE.md` — mandatory git workflow. Branch off `staging`, PR to
   `staging`, one PR per WP, conventional commits, never touch `main`.

**Sprint goal (single sentence).** Charlotte can complete and submit her
real-data test application without losing work, then run a full assessment
end-to-end on it — including a divorced/separated two-parent case with a manual
income adjustment — and reopen and amend a completed assessment.

**Scope:** the whole epic — all 19 work packages across waves A–E, four additive
schema migrations.

---

## 1. Sprint exit criteria

The sprint is done when all of the following hold on `staging`:

- [ ] A 20 MB PDF uploads successfully from the parent portal (no 413), and a
      spoofed-extension file is still rejected server-side.
- [ ] Charlotte's `test3@…` application reaches `SUBMITTED` with no
      section blocked by a validation dead-end (cohabiting, zero-income,
      remarried-question, parent-2 number entry all pass).
- [ ] Navigating between sidebar tabs mid-edit never silently discards input;
      returning to a half-filled section restores what was typed.
- [ ] An ADMIN or the assigned assessor can reopen a `COMPLETED` assessment
      (no outcome set), change a figure, and re-complete it; the attempt is
      refused server-side once an outcome exists.
- [ ] A manual income adjustment with a mandatory reason flows into household
      net income, the recommendation snapshot, the PDF and the XLSX export.
- [ ] `Application.reference` accepts an arbitrary duplicate-tolerant value
      (`TS-SMITH05-Smith, Bob`) and the child's name renders beside it on every
      admin surface.
- [ ] The submission PDF downloads exactly once and returns 410 thereafter; the
      applicant History page is gone.
- [ ] A round carries separate new-application and rolling-over deadlines, and
      the invitation email's `{{deadline}}` shows the submission deadline, not
      the token expiry.
- [ ] `npm run test` green (111 test files today), `npx tsc --noEmit` clean,
      `npm run build` clean, all four migrations applied to nonprod via
      `db-push.yml`.

---

## 2. Ground rules (apply to every work package)

- **Branching**: `fix/uat-<wp>-<slug>` (or `feature/…` where the WP adds
  capability) off freshly-pulled `staging`. PR targets `staging`. One WP per PR
  unless the table below explicitly pairs them. Do not merge your own PR unless
  the user has granted standing merge authority in-session.
- **Node**: `export PATH="$HOME/.local/share/nvm/v22.12.0/bin:$PATH"` before any
  Prisma command.
- **Migrations**: additive only — new nullable columns, new indexes. One
  migration per PR, shipped in the same PR as the code that needs it. Author via
  `prisma migrate dev` locally; merged PRs auto-apply to nonprod via
  `db-push.yml`. Never mutate an applied migration. **Column drops get their own
  follow-up PR after staging verification** (the Epic 01 PR-6 / #177 precedent).
- **RLS**: no new tables are planned in this sprint, so no new policies are
  required. If a WP grows a table, the policy ships in the same PR — a table
  without policies reads empty app-wide (`ensure_rls` event trigger).
- **Tests**: `npm run test` (vitest, 111 test files). Every behavioural change
  gets a test in the nearest `__tests__/` sibling. Run `npx tsc --noEmit` and
  `npm run build` before opening each PR.
- **Never recompute completed assessments.** Assessment rows snapshot their
  outputs. C1 (reopen) is the one deliberate exception and is gated on "no
  outcome set".
- **Client-facing copy** comes from the CF catalogue verbatim where Charlotte
  supplied wording. Do not paraphrase her email address or guidance text.
- **⚠️ Parallel worktrees: the generated Prisma client is not reliably isolated.**
  Observed 2026-08-14 while running WP agents in git worktrees: **9 of 10
  worktrees had their own `node_modules`, but one symlinked to the parent
  repo's.** In a symlinked worktree, `prisma generate` rewrites the *shared*
  client — so a schema-changing branch can leave another agent type-checking
  against a client that does not match its own `schema.prisma`. C4b hit exactly
  this: `tsc` claimed `reference` was still required on
  `BursaryAccountUncheckedCreateInput` after its migration dropped it.
  Consequences:
  - **CI is the authority, not local `tsc`/`build`** — CI does a clean install
    and a fresh `generate`. Local green is a smoke test while schema-changing
    PRs are in flight.
  - Re-run `npx prisma generate` from your own worktree immediately before the
    final verification pass.
  - Do not run `prisma generate` in the main checkout while agents are running.
  - A phantom type error about a column another in-flight PR drops or adds is
    this, not your code. Regenerate before you debug it.

---

## 3. Verified ground truth (checked against the tree at `ae4bdb4`)

These anchors were re-verified before planning. Three are **corrections to the
epic** — read them before starting the affected WP.

| Claim | Status | Detail |
|---|---|---|
| `saveSectionDraft` is dead code | ✅ confirmed | `src/app/(portal)/apply/actions.ts:290`; only caller is a test. **But** a second implementation exists at `src/app/(contribute)/contribute/actions.ts:161` — see §5 B2 scope note. |
| `ASSESSMENT_TRANSITIONS.COMPLETED` is `[]` | ✅ confirmed | `src/lib/applications/status.ts:173-178`. The doc comment immediately above states there is *deliberately* no exit edge — that comment must be amended by C1, not just the table. |
| `saveAssessmentAction` has no server-side status guard | ✅ confirmed | `src/app/(admin)/applications/[id]/assessment/actions.ts:282`; the only `COMPLETED` checks live in `completeAssessmentAction`. The lock is client-only at `assessment-form-v2.tsx:244`. |
| `manualAdjustment` / `manualAdjustmentReason` exist | ✅ confirmed | `prisma/schema.prisma:394-395`, `Decimal? @default(0)` and `String?`. **C2 needs no migration.** |
| `Application.reference` is `@unique` | ✅ confirmed | `prisma/schema.prisma:138` + raw index in `prisma/migrations/20260709130000_reference_case_insensitive_unique/`. |
| **`BursaryAccount.reference` is also `@unique`** | ⚠️ **correction** | `prisma/schema.prisma:71`. C4 drops the constraint on **`Application` only** — leave the bursary-account reference unique. |
| `AuditLog.action` is an enum | ⚠️ **correction** | It is a plain `String` (`prisma/schema.prisma:981`). A new `ASSESSMENT_REOPENED` action needs entries in `src/lib/audit/actions.ts` (`AUDIT_ACTIONS` map ~:48-61 **and** the colour map ~:290-302) — **no migration**. |
| Upload client "assumes a JSON body on platform errors" | ⚠️ **correction** | `file-upload.tsx` already does `await response.json().catch(() => ({}))` and falls back to `` `Upload failed (${status})` ``. There is no crash — the defect is that the parent sees the opaque string `Upload failed (413)`. A1 still maps 413 to human copy, but as polish, not a crash fix. |
| `MAX_SIZE_MB = 20` vs Vercel's ~4.5 MB body cap | ✅ confirmed | `src/lib/uploads/accepted-types.ts:44`. Root cause of CF-14 — unfixable by config while bytes route through the API. |
| `docPresent` accepts an array with **any** non-empty id | ✅ confirmed | `src/lib/portal/document-rules.ts:176-180`. This is exactly where D2's `minCount` belongs. |
| `UC_MONTHLY` rule already exists | ✅ confirmed | `src/lib/portal/section-rules.ts:174-184`, `ucMonthlyDocumentIds` array, label already says "3 monthly … documents are required" — the label lies today; D2 makes it true. |
| `LOAN_AGREEMENT` slot does not exist | ✅ confirmed | `src/lib/documents/slots.ts:57` has `LOAN_STATEMENT` only. |
| Invitation `{{deadline}}` = token expiry | ✅ confirmed, **wider than stated** | **4** injection sites, not 2: `src/app/(admin)/invitations/actions.ts:261, 430, 862, 1349` — all `expiresAt.toLocaleDateString("en-GB")`. E1 must fix all four (862 is the resend path, 1349 the reassessment path). |
| Review page reads year-of-entry from the section blob | ✅ confirmed | `renderChildDetails(raw)` at `src/app/(portal)/apply/review/page.tsx:131-140` reads `d.entryYearGroup` off the blob; `application-summary.ts` already reads the `Application` columns. |
| `effectiveSubmissionDeadline` is 3-tier | ✅ confirmed | `src/lib/rounds/submission-deadline.ts:68-90`; `endOfDay()` normalisation applies to both date-only tiers and must apply to both new E1 fields. |
| Persistent submission-PDF link | ✅ confirmed | `src/components/portal/submission-download-offer.tsx:24` and `src/app/(portal)/history/page.tsx:114`. Both are D1 targets. |

---

## 4. Sprint board

Sizes: **S** ≤ half a day · **M** ~1 day · **L** ~2 days+. "Mig" = ships a
schema migration.

| # | WP | CF | Title | Size | Mig | Depends on | Branch |
|---|---|---|---|---|---|---|---|
| 1 | **A1** | 14, 20, 24 | Presigned direct-to-Supabase uploads | **L** | — | — | `fix/uat-a1-presigned-uploads` |
| 2 | **A2** | 13 | Remarried-question matrix | M | — | — | `fix/uat-a2-remarried-matrix` |
| 3 | **A3** | 17 | Cohabiting validates as Married | S | — | — | `fix/uat-a3-cohabiting-validation` |
| 4 | **A4** | 21 | Zero-income path progresses | M | — | — | `fix/uat-a4-zero-income-path` |
| 5 | **A5** | 18 | Number entry fix for parent 2 | S | — | — | `fix/uat-a5-a8-portal-smalls` |
| 6 | **A6** | 23 | Remove year of entry from applicant input entirely | M | — | — | `fix/uat-a6-entry-year-removal` |
| 7 | **A7** | 25 | Plain submission-failure message | S | — | — | ↑ paired |
| 8 | **A8** | 31 | Bursary-team contact copy | S | — | — | ↑ paired |
| 9 | **B1** | 15,16,19,22 | Guarded sidebar nav + "kicked out" fix | **L** | — | — | `fix/uat-b1-dirty-nav-guard` |
| 10 | **B2** | 29 | Autosave on `saveSectionDraft` | **L** | — | B1 | `feature/uat-b2-autosave` |
| 11 | **C1** | 10, 01 | Reopen assessment + server-side lock | **L** | — | — | `feature/uat-c1-reopen-assessment` |
| 12 | **C2** | 02, 07 | v2 manual income adjustment line | M | — | — | `feature/uat-c2-manual-adjustment` |
| 13 | **C3** | 03 | Remove Set Qualifies / Does Not Qualify | S | — | C1 | `chore/uat-c3-remove-legacy-outcome` |
| 14 | **C4a** | 04 | Application reference becomes a free-text label | M | ✅ | — | `feature/uat-c4a-application-reference` |
| 14b | **C4b** | 04 | Account stops exposing an identifier | M | ✅ | C4a | `chore/uat-c4b-account-deidentify` |
| 15 | **D1** | 27 | Strict one-time submission PDF | M | ✅ | — | `feature/uat-d1-one-time-pdf` |
| 16 | **D2** | 28 | UC `minCount` + duplicate digest | **L** | ✅ | A1 | `feature/uat-d2-uc-multi-upload` |
| 17 | **D3** | 30 | Loan agreement slot + required copy | S | — | — | `fix/uat-d3-loan-documents` |
| 18 | **D4** | 32 | Separate REVIEW from SUBMIT | M | — | — | `fix/uat-d4-review-submit-split` |
| 19 | **E1** | 11, 12 | Type-aware round deadlines + email fix | **L** | ✅ | — | `feature/uat-e1-typed-deadlines` |

**Totals:** 20 WPs (C4 split in two under D13-1a) · 5 migrations · 6 L / 8 M /
6 S · 17 PRs (A5/A7/A8 pair up; E1b follows E1). All open questions answered —
nothing is decision-blocked.

### Branch topology (stacked PRs — nothing merges to `staging` during the sprint)

The plan branch is the **stack root**. Every stack head branches from it and
targets it as its PR base; each subsequent WP branches from its predecessor and
targets that. GitHub retargets automatically as ancestors merge, so the stack
collapses cleanly in order once `staging` opens up.

```
staging
└── chore/epic-13-sprint-plan            ← stack root (this plan, PR #268)
    ├── fix/uat-a1-presigned-uploads     ← Track 1 head
    │   └── fix/uat-a2-… → a3 → a4 → a6 → a5+a7+a8 → b1 → b2 → d4 → d3 → d2
    ├── feature/uat-c1-reopen-assessment ← Track 2 head
    │   └── feature/uat-c2-… → c3
    └── feature/uat-c4a-application-reference  ← Track 3 head
        └── chore/uat-c4b-… → d1 → e1 → e1b
```

Rules while stacked:

- **Never merge to `staging`** until the whole sprint is reviewed — the sprint
  is a stack, not a series of independent drops.
- **Green CI is the bar** for each PR; review happens on the stack.
- Rebase a branch onto its parent when the parent gains commits; never
  force-push a branch someone else has based work on without saying so.
- Migrations stay unapplied while stacked (`db-push.yml` only fires on a push to
  `staging`), so a migration PR is safe to leave open.

### PR trains and parallelism

Three tracks run concurrently; within a track, order is strict.

```
Track 1 (portal — Charlotte's blocker):  A1 → A2 → A3 → A4 → A6 → A5+A7+A8 → B1 → B2 → D4 → D3 → D2
Track 2 (assessment):                    C1 → C2 → C3
Track 3 (admin/data):                    C4a → C4b → D1 → E1 → (E1b)
```

- **A1 ships first and alone.** It is the single change that unblocks her
  submission; get it on staging before starting anything else so she can
  re-test the birth-certificate upload while the rest is in flight.
- **A5, A7 and A8 are one PR** (three independent one-file fixes; separate PRs
  cost more review than they save). **A6 is no longer among them** — Q1's answer
  grew it into a multi-file removal that also touches the admin invite path and
  carries a data backfill, so it ships alone.
- **D2 depends on A1** (repeat-slot upload UI is built on the new transport).
- **C3 depends on C1** — removing the legacy outcome buttons while COMPLETED is
  still a terminal state would leave no way back from a mis-set state.
- **B2 depends on B1** — autosave without the dirty-guard produces two
  competing "did my work save?" mechanisms.
- Only one migration is in flight per track at a time; if two migration PRs are
  open simultaneously (C4a, C4b, D1, E1 are all Track 3, so they serialise
  naturally), rebase the later one after the earlier merges.

---

## 5. Work package detail

### Wave A — unblock submission

#### A1 · Presigned direct-to-Supabase uploads · **L**
**CF-14, CF-20, CF-24** · **D13-6** · no migration

The 413 is Vercel's ~4.5 MB request-body limit; the app advertises 20 MB
(`accepted-types.ts:44`). File bytes must stop transiting the API route.

New shape (three steps, replacing one multipart POST):

1. `POST /api/documents/sign` — auth + contributor resolution (reuse the
   existing logic in `src/app/api/documents/route.ts:41-...`, including the
   SECONDARY namespace rule), validates `slot`, declared MIME against
   `ACCEPTED_MIME`, and declared size against `MAX_SIZE_BYTES`; builds the same
   storage path (`documents/{appId}[/secondary]/{slot}/{uuid}_{safeName}`) and
   returns a Supabase **signed upload URL** + token.
2. Client PUTs the bytes straight to Supabase Storage.
3. `POST /api/documents/confirm` — downloads the object back, runs the
   **magic-byte sniff** (`src/lib/storage/sniff.ts`) on the leading bytes,
   deletes the object and returns 415 on mismatch, otherwise creates the
   `Document` row and returns it in today's `UploadedDocument` shape.

Notes:
- Signed upload URLs are minted with the service-role admin client
  (`createSupabaseAdminClient`) and are single-use, so **no storage RLS policy
  change is needed** and the bucket stays private.
- The sniff must not be dropped — `docs/security-audit.md` §2.10 is the
  standing requirement. Downloading the first ~64 bytes back (Range request) is
  enough; do not pull whole 20 MB files into the route.
- Add `uploadDocumentSigned()` beside the existing `uploadDocument()` in
  `src/lib/storage/documents.ts`; leave `uploadDocument()` in place — the admin
  upload route (`/api/admin/documents`) still uses it and is not in scope.
- Client: replace `uploadFile()` in `src/components/portal/file-upload.tsx`
  (~:150-174) with the three-step flow. Keep `MAX_CONCURRENT_UPLOADS = 5`. Map a
  413/507 from either leg to plain copy ("That file couldn't be uploaded — it
  may be too large. Maximum 20 MB.") rather than `Upload failed (413)`.
- **CF-20 and CF-24 outcomes (recorded 2026-08-14, PR #271):** CF-20 could not
  be reproduced → **WP F3**, re-test on preview after B1. CF-24 does **not**
  reproduce as a transport fault; tracing it found a real latent bug in the
  passport slots → **WP F2**. Neither is closed.
- **Stored-XSS vector found and closed during A1.** Supabase stores a
  client-supplied `Content-Type` verbatim, and `/api/documents/[id]/url` serves
  documents **inline** — so a `text/html` object declared as `application/pdf`
  at sign time would have been stored XSS, a risk the old server-side-upload
  transport did not have. The confirm endpoint now rejects a stored content
  type that differs from the one allowlisted at sign time, in addition to the
  magic-byte sniff. This is new attack surface created by moving to presigned
  uploads — keep both checks.

**Done when:** a 20 MB PDF uploads end-to-end on a preview deploy; a `.pdf`-named
Word file is still rejected with `WORD_DOCUMENT_MESSAGE` or the sniff 415; the
`Document` row carries the right contributor id and namespace for a SECONDARY
uploader; CF-20/CF-24 each have a recorded outcome.

#### A2 · Remarried-question matrix · M
**CF-13** · no migration

Ask the remarried/new-partner question per Charlotte's matrix:

| Relationship status | Sole parent = YES | Sole parent = NO |
|---|---|---|
| Single, Widowed, Separated, Divorced | ask | ask |
| Married, Civil Partnership, Cohabiting | ask | **do not ask** |

Also remove the auto-generated sentence *"if so we assess your current household
together…"*. Inputs feed `src/lib/household/rules.ts` — the rules engine itself
is **out of scope** (epic §Out of scope); this is a form-visibility change only.

**Done when:** a table-driven test covers all 7 statuses × 2 sole-parent values;
the removed sentence appears nowhere in the portal.

#### A3 · Cohabiting validates as Married · S
**CF-17** · no migration

Cohabiting currently blocks progression on the parent/guardian step. Align its
required-field set with Married in the section schema. Check the same status
list is not duplicated elsewhere (search for the status enum's other consumers
before editing one site).

**Done when:** a cohabiting household completes the parent/guardian step; test
pins Married and Cohabiting to the same required-field set.

#### A4 · Zero-income path · M
**CF-21** · no migration

£0.00 across the board with every "no income in the assessed tax year" box
ticked must progress. Two layers to check: the income section's Zod schema
(a `.positive()`/`.min(1)` where `.min(0)` is meant) and the document rules —
`requiredIfValueGt0` should already no-op at zero, so confirm the block is
validation, not a phantom document gap, before editing.

**Done when:** an all-zero income section saves as complete and the stepper
advances; test covers the zero case for both parents.

#### A5 · Parent-2 number entry · S
**CF-18** · no migration

The select-0-on-focus / no-leading-zero-accumulation behaviour is applied to
parent 1's fields only. Extract it to a shared input component (or shared
handler) and apply to parent 2's fields. Do not fork the logic.

#### A6 · Remove year of entry from applicant input entirely · M
**CF-23** · **Q1 answered 2026-08-14 (Brian)** · no migration

> **Q1 decision (Brian, 2026-08-14).** Year of entry is a property of the
> application but is **JWF-facing only**. The applicant must not be able to
> enter, update or change it — **including validation** — and must not be shown
> it either. The `Application.entryYear` / `entryYearGroup` columns, set
> admin-side, are the sole source and are rendered on admin surfaces only.

The field is already absent from the form UI (`child-details-form.tsx` has no
`entryYear` reference at all), but residue remains in five places:

- `src/lib/schemas/child-details.ts:89` — `entryYearGroup:
  entryYearGroupSchema.optional()` is still in the applicant schema. **Remove
  it** (and `entryYearGroupSchema` itself if nothing else imports it).
- `src/types/application.ts:24` — `ChildDetailsData.entryYearGroup` is declared
  **non-optional**, already inconsistent with the optional schema. Remove.
- `src/lib/applications/submission.ts:306-327` — submission reads
  `entryYearGroup` out of the CHILD_DETAILS blob and promotes it to the column.
  Remove the blob read. **Safe:** the expression is
  `application.entryYearGroup ?? childEntryYearGroup`, so an admin-set column
  already wins and cannot be clobbered.
- **Applicant-facing displays are removed outright, not re-pointed** (JWF-facing
  only). Drop the "Year of entry" row from `renderChildDetails`
  (`src/app/(portal)/apply/review/page.tsx:131-140`) and from

  > **Correction (2026-08-14, found during A6):** this list originally included
  > `src/app/(portal)/schedule/page.tsx:43`. That line is **not a display** — it
  > passes `entryYearGroup` into `buildPortalScheduleRows()` as a derivation
  > input that fixes the start of the Year 6 → Year 13 span. The group is never
  > rendered. Removing it would drop the calendar into the `OTHER`/null branch
  > (no "Year N" labels, no greyed span) while hiding nothing from the
  > applicant. **Left in place**, correctly.

  `src/lib/portal/application-summary.ts:124-147` — the `yearOfEntry` builder
  and its `entry?.entryYearGroup ?? d.entryYearGroup` blob fallback both go.
  Verified `application-summary.ts` has **only** applicant-facing consumers
  (`submitted-summary.tsx`, `submission-loader.ts`, `submission-pdf.tsx`), so
  removing the row there cannot strip it from an admin screen. It also drops
  out of the submission PDF, which is correct — that is the applicant's copy.
- `section-page-client.tsx:273` carries an `entryYearGroup: undefined` shim to
  clear as well.
- Admin surfaces keep rendering the columns unchanged — the assessment engine
  (`schooling-years.ts`), reports and exports are unaffected.

**⚠️ This creates a dependency the epic did not anticipate.** Once the blob
fallback goes, the column is the only source — and **the invite path does not
require it**: `src/lib/applications/create-from-invitation.ts:95` writes
`entryYearGroup: source.entryYearGroup ?? null` with a comment stating it is
optional. The data shows the consequence — on nonprod, **only 8 of 35
applications have `entry_year_group` set, and 3 of the NULLs are already
submitted** (checked 2026-08-14). Only `internal-request-dialog.tsx:76` treats
it as mandatory today. **The data half is already resolved** (see below); the
code half is not.

So this WP must also:

- **Make `entryYearGroup` mandatory wherever an application is created
  admin-side** — the invitation path and contact creation, matching the
  `z.enum` treatment `internal-request-dialog.tsx` already uses.
  `src/lib/contacts/contact-helpers.ts:37` already flags a missing entry year in
  its completeness check, so the contact model expects it.
- ~~Backfill the existing NULLs~~ — **DONE on nonprod, 2026-08-14.** All 35
  applications now carry both columns (was 8/35 group, 12/35 year). Rule used,
  per Brian's "infer from the round": `entry_year` ← the round's academic-year
  start (`academicYear.slice(0,4)`, the same rule `submission.ts:322` applies at
  submit); `entry_year_group` ← `Y7`, the standard senior entry point.
  `coalesce` guarded, so pre-existing values (`OTHER`, `Y6`, `Y9`, `Y12`) were
  left untouched. Not production data — prod is unaffected and the columns are
  not in the prod schema path for this epic.

  > DOB-derivation was considered and rejected: against this data's entry years
  > it yields out-of-enum groups (Y5/Y8) for 3 of the 5 real rows, and `OTHER`
  > is worse still — `schooling-years.ts:107` documents that `OTHER` has no
  > defined total, so it would break the very assessments this backfill exists
  > to protect. Uniform `Y7` is in-enum and safe. Any specific scenario Charlotte
  > needs can be set through the admin UI.

**Done when:** no applicant-facing schema, type, validation path **or display**
mentions entry year; the columns still render on admin surfaces; a new
admin-created application cannot be created without one.

#### A7 · Plain submission-failure message · S
**CF-25** · no migration

The submit action currently surfaces internal query/diagnostic detail to the
applicant. Replace with "Your application can't be submitted yet." plus the
actionable section list where one is available. Log the real error via
`logError` — do not swallow it.

#### A8 · Bursary-team contact copy · S
**CF-31** · no migration

Add "please contact the bursary team by email at
fees@johnwhitgiftfoundation.org" to the relevant guidance copy. Use the address
verbatim.

### Wave B — data safety

#### B1 · Guarded navigation + the "kicked out" error · **L**
**CF-15, CF-16, CF-19, CF-22** · **D13-7** · no migration

Three distinct defects under one WP:

1. **Raw anchors.** `src/components/portal/portal-sidebar.tsx:~201` renders each
   step as `<a href={...}>`, so a full page load discards unsaved form state.
   Convert to client-side navigation with a dirty-state guard: if the section
   form is dirty, prompt save-or-discard before navigating.
2. **The "kicked out" error (CF-15).** There is no session timer in the code —
   the epic is right that this is an error path, not a timeout. Reproduce by
   completing the parent/guardian section, capture the real failure (server
   action error, most likely unhandled), and fix it. **If it cannot be
   reproduced, say so on the PR rather than closing it as fixed.**
3. **Income tab disabled after re-login (CF-22).** Check the stepper's
   status derivation for a stale/short-circuited read after a fresh session.

**Done when:** navigating away from a dirty section prompts; the prompt's
"save" path actually persists; CF-15 has a recorded root cause; a re-login
leaves every reachable tab reachable.

#### B2 · Autosave · **L**
**CF-29** · **D13-7** · depends on B1 · no migration

Wire the existing, uncalled `saveSectionDraft` (`apply/actions.ts:290`) to a
debounced client writer (2–3 s idle, plus on blur and on guarded navigation),
with a visible "Saving… / Saved HH:MM / Unsaved changes" indicator. Drafts
restore on return; the stepper must keep showing the section as incomplete
(`isComplete=false`) so a draft never reads as done.

Two things the epic does not call out, both mandatory here:

- **Scope: the contributor flow has its own copy.**
  `src/app/(contribute)/contribute/actions.ts:161` is a second
  `saveSectionDraft`. The second parent hits the same data-loss risk. Either
  cover both flows in this PR or state explicitly on the PR that the
  contributor flow is deferred, and open the follow-up.
- **Provenance churn risk.** `saveSectionDraft` calls
  `clearedProvenanceForApplicantSave` — a CR-001 behaviour that reclaims
  assessor-stamped fields on every draft save. A debounced autosave fires that
  path dozens of times per section. Confirm reclaiming is idempotent and cheap;
  if it is neither, gate the provenance clear on an actual value change rather
  than on every write. `apply/__tests__/save-section-provenance.test.ts:180`
  already pins the current behaviour — extend it deliberately.

**Done when:** typing then closing the tab and returning restores the text;
the indicator never claims "Saved" for a failed write; provenance tests still
pass and cover the repeated-autosave case.

### Wave C — assessment editability & references

#### C1 · Reopen assessment · **L**
**CF-10, CF-01** · **D13-2** · no migration

- Add `COMPLETED: ["IN_PROGRESS"]` to `ASSESSMENT_TRANSITIONS`
  (`src/lib/applications/status.ts:173-178`) **and rewrite the doc comment above
  it** — it currently states the absence of an exit edge as a deliberate design
  rule, with a state-model citation. The comment must now record the exception
  and its gate.
- New `reopenAssessmentAction` in
  `src/app/(admin)/applications/[id]/assessment/actions.ts`: ADMIN or assigned
  assessor only; refuses when an outcome/award exists (`canSetOutcome` already
  keys off `COMPLETED`, so reopening naturally re-blocks outcome-setting —
  the guard here is the reverse direction: don't reopen *after* an outcome).
  Writes an `ASSESSMENT_REOPENED` audit entry.
- **Add `ASSESSMENT_REOPENED` to `src/lib/audit/actions.ts` in both places** —
  the `AUDIT_ACTIONS` map (~:48-61) and the colour map (~:290-302). No migration:
  `AuditLog.action` is a `String`.
- **Mark the recommendation stale.** A reopened assessment's existing
  recommendation must be re-confirmed before an outcome can be set again.
- **Revert `closeAccountIfComplete` effects on reopen.** Note
  `Application.closedAt` is documented set-once; this is a deliberate,
  commented exception — document it at the field and in the action.
- **Close the client-only lock.** `assessment-form-v2.tsx:244` computes
  `isReadOnly` in the browser; `saveAssessmentAction` (actions.ts:282) has **no
  server-side status check**. Add one in this PR so the lock is real whenever it
  applies — this is a live authorisation gap independent of the reopen feature.
- CF-01 ("incorrect auto-entered information") is prefill she could not correct
  because of the lock. Verify against her data once reopen is on staging; if
  values are still wrong after reopening, that is a new WP.

**Done when:** reopen works for both roles, is refused post-outcome, is
audited; a direct `saveAssessmentAction` call against a COMPLETED assessment is
rejected server-side (test this at the action layer, not through the UI); the
recommendation re-confirmation gate is enforced.

#### C2 · v2 manual income adjustment line · M
**CF-02, CF-07** · **D13-3** · **no migration** (fields already exist at
`prisma/schema.prisma:394-395`)

Port v1's `manualAdjustment` + mandatory `manualAdjustmentReason` into the
calc-v2 form as an income adjustment line, applied **after** earner aggregation
in `calculateHouseholdNetIncome` (`src/lib/assessment/v2/income.ts:83-86`).
Surface it in the recommendation snapshot and the XLSX export.

> **Correction (2026-08-14):** this WP originally said "and the PDF". **There is
> no assessor-side recommendation PDF** — route, renderer and download button
> were all removed in Epic 08 under D7 as exposing assessor-internal figures
> (recorded in the header comment of `recommendation/page.tsx:7-9`). The only
> surviving PDF is the applicant-facing submission PDF, which must **not** carry
> assessor internals, so the adjustment must not be added to it. If a printable
> assessor artefact is wanted, that is a separate decision, not part of C2.

- Reason is mandatory whenever the amount is non-zero — enforce in the Zod
  schema, not just the UI.
- Signed value (negative allowed) so it can deduct as well as add.
- Primary use is the divorced/separated parent-2 add-on (E3 spec). CF-05/06/09
  were verified against `src/lib/household/rules.ts` and already behave
  correctly — **the rules engine stays untouched**.
- Per-field overrides of calculated cells are explicitly out of scope (D13-3).

**Done when:** the adjustment changes the recommended award by exactly its
amount in an engine test; it appears in snapshot, PDF and export; a non-zero
amount with a blank reason fails validation server-side.

#### C3 · Remove the legacy outcome buttons · S
**CF-03** · **D13-5** · depends on C1

Remove the "Set Qualifies" / "Set Does Not Qualify" buttons and their confirm
dialog (`src/components/admin/application-actions.tsx:313-337`), retire the
`setOutcome(QUALIFIES)` path, and update the two guides that document them
(`docs/guides/admin-assessor-guide.md:279`,
`docs/guides/walkthroughs/assessors/02-open-an-application.md:32`). Outcomes
remain solely via the v2 recommendation form's 3-way decision.
`AssessmentOutcome.QUALIFIES` stays in the schema as vestigial — do not drop the
enum value in this sprint.

This supersedes the CP10 "Set Qualifies" item on the calc-v2 staging pass.

#### C4 · Reference becomes a pure label; the account stops exposing one · **L** · **migration**
**CF-04** · **D13-1 as amended by D13-1a**

> **D13-1a (Brian, 2026-08-14) — amends D13-1.** There is **one** user-facing
> reference and it lives on the **Application**. The bursary account is an
> internal container for awarded applicants and **exposes no reference or ID to
> the user at all**. `BursaryAccount.feesAccountCode` and
> `BursaryAccount.reference` are therefore both redundant and are removed.
>
> | | Holds | Editable | Unique | User-facing |
> |---|---|---|---|---|
> | `Application.reference` | default `{Child} – {School} – {Year group} – {Academic year}`, **re-edited at award** to the fees-system code (`TS-SMITH05-Smith, Bob`) for reconciliation | ✅ free text, anything | ❌ | ✅ the only one |
> | `Application.id` (UUID) | database identity | — | ✅ PK | ❌ never shown as an identifier |
> | `BursaryAccount.id` (UUID) | database identity | — | ✅ PK | ❌ |
>
> **The reference is a label, not an identity.** It defaults to the readable
> format at creation and is edited later — typically when a bursary is awarded —
> so it can be reconciled against the external fees system. Uniqueness is not
> enforced at any layer, because two applications legitimately may carry the
> same reconciliation label.
>
> **Requirement 3 is already satisfied — no work needed.** Verified:
> `Application.id` is already `@id @default(uuid()) @db.Uuid`
> (`prisma/schema.prisma:133`), and **every** FK relation in the schema points
> at `id`, never at `reference` (checked all 6 `bursaryAccount` relations plus
> the application ones). There is no surrogate key to introduce — dropping the
> `reference` unique constraint leaves database uniqueness resting on PKs that
> already carry it. Admin URLs (`/applications/{uuid}`) already use the UUID;
> that is routing, not a user-facing identifier, and is unchanged.
>
> **ROLLING_OVER inherits the edited reference** (D13-1's rule, confirmed as Q5
> on 2026-08-14). Once the reference has been edited to the fees-system code,
> that code is what continuity depends on, so next year's application inherits
> it rather than regenerating the dated default. A never-edited default is
> regenerated for the new year — see C4a for the exact rule.
>
> **Data check (2026-08-14):** nonprod holds 3 bursary accounts, **0 with a
> `fees_account_code` set** — never used, so the drop needs no backfill. Prod
> could not be queried (see §8 risks); CALC-10 is not promoted to `main`, so
> the column is not expected to exist there — **verify before C4b lands.**

> **D13-1b (Brian, 2026-08-14) — name masking is retired.** D13-1a's default
> reference format embeds the child's name, and the reference renders on the
> queue and the assessment workspace. That defeats **NM-01..05** (PRD: "child
> name and lead applicant are hidden by default and revealed via a toggle") and
> security finding **2.18** (`docs/archive/quality/security-audit.md:438`, UK
> GDPR Art. 5(1)(c), whose recommendation was explicit that "render-side hiding
> is not data minimisation"). Presented as a four-way choice; Brian chose:
> **names are visible — masking is obsolete.**
>
> Consequence: C4a's audited `getApplicationChildNameForHeader` stands. But the
> codebase is now **half-masked and self-contradictory** — `getApplicationWithDetails`
> still omits names "per finding 2.18", the queue still defaults to masked, and
> the PRD still specifies the toggle. That inconsistency is a defect in its own
> right: the next reader cannot tell which behaviour is intended. Retiring it
> properly is **WP F1** below.

Ships as two PRs.

##### C4a · Application reference becomes a free-text label

- **Migration**: drop `@unique` from `Application.reference`
  (`prisma/schema.prisma:138`) and drop the raw `lower(reference)` unique index
  from `20260709130000_reference_case_insensitive_unique`. Replace with a
  **non-unique** index on `lower(reference)` so search stays fast.
- New default format for NEW applications:
  `{Child first last} – {School name} – {Year group} – {Academic year}`
  (e.g. `Bob Smith – Trinity School – Year 6 – 2027-28`). Rewrite
  `generateApplicationReference` (`src/lib/applications/reference.ts:21-34`) —
  the current `TS-20252026-0001` sequence counter goes away, which also
  removes an existing race (it counts rows to derive the next number).
- **ROLLING_OVER inherits the edited reference** (Q5, decided 2026-08-14).

  > ⚠️ **There are TWO reassessment creation paths, not one** — found during
  > C4b, 2026-08-14. Besides `reassessment.ts:339`,
  > `createReassessmentApplicationAction`
  > (`src/app/(admin)/invitations/actions.ts:~1018`) also creates a
  > `ROLLING_OVER` application; it built its reference as
  > `` `REA-${account.reference}-${roundId}` ``, off the bursary-account code
  > C4b drops. **Both paths must apply the inheritance rule via ONE shared
  > helper** — a forked copy of the comparison will drift. C4a's tests did not
  > catch this because they exercise only the other path; each path needs its
  > own test.

  `src/lib/db/queries/reassessment.ts:339` currently calls
  `generateApplicationReference` for the new year's application. Change it to:

  > inherit the prior application's reference **unless** that reference is
  > byte-identical to the default the generator would produce for the *prior*
  > application — i.e. it was never edited — in which case generate a fresh
  > default for the new year.

  The point of the carry-forward is that a human-entered fees-system code
  survives into next year. An untouched default is not such a value, and
  inheriting it verbatim would drag a stale academic year (`… – 2027-28`) onto a
  2028-29 application. Detection is a pure recompute-and-compare against the
  prior application's own child/school/year-group/academic-year — no audit-log
  lookup, no extra column, deterministic. **A human-entered value is never
  discarded**; only an exact, unedited default is regenerated.

  If that comparison proves awkward in practice, the fallback is unconditional
  inheritance (simpler, at the cost of stale years on never-edited references) —
  but do not choose it silently; note it on the PR.
- **The reference must stay editable after award** — this is the primary use
  (reconciliation against the external fees system once a bursary exists).
  `updateApplicationReferenceAction` already has no lifecycle-state gate
  ("explicitly exempt from state-gating", Story 11.1) and works in archived and
  closed states; keep it that way and add a test pinning it, since C1's new
  status guards land in the same sprint and must not accidentally catch it.
- `validateReferenceInput` stays non-blank-only (already correct at :44-54).
- **Remove the app-layer uniqueness enforcement too** — dropping the index is
  not sufficient. `updateApplicationReferenceAction`
  (`src/app/(admin)/applications/[id]/actions.ts:1071-1118`) performs a
  case-insensitive `findFirst` pre-check that throws *"X is already in use by
  another application"*, and its catch block maps `"Unique constraint"` to a
  second rejection message. Both must go, along with the uniqueness paragraphs
  in the action's doc comment.
- **Child name displayed beside the reference** on: the admin application table
  (`src/components/admin/application-table.tsx:892`), the application header, the
  assessment header, exports, and outcome emails.
- Verify the admin search box and the XLSX export behave with duplicate
  references. All joins are on UUID (verified — no FK uses `reference`), so
  duplicates are safe, but any code that *looks up* by reference must be found
  and made non-`findUnique`. Grep for `reference:` in `where` clauses.

##### C4b · The account stops exposing an identifier

The bursary account is an internal container for awarded applicants. Both of its
user-facing codes go; its identity is its UUID PK.

- **Migration**: drop `bursary_accounts.fees_account_code` **and**
  `bursary_accounts.reference` (with its unique index). Per the §2 column-drop
  rule this is the one place a drop ships with its own code — the columns have
  no readers left after the changes below, and there is nothing to cut over to.
  **Re-verify both environments for non-null `fees_account_code` immediately
  before merging** (nonprod clean on 2026-08-14; prod unverified).
- **Delete** `src/lib/bursary-accounts/reference.ts`
  (`generateBursaryAccountReference`) and its call in
  `src/lib/applications/account-promotion.ts:119-122`. This also removes the
  count-based sequence race noted earlier — no replacement generator.
- **Delete** the fees-code editor:
  `src/components/admin/fees-account-code-field.tsx` and
  `updateFeesAccountCodeAction`
  (`src/app/(admin)/applications/[id]/bursary-account-actions.ts:102-155`), plus
  its render sites at `applications/[id]/page.tsx:308,450,581,693` and
  `assessment/page.tsx:183-198`. Note `assessment/page.tsx:190` short-circuits
  the whole header block on `!feesAccountCode && !watchOut` — check what that
  block still renders once the code is gone.
- **Replace the four account-reference display sites with the child's name**
  (the account already carries `childName`): `recommendation/page.tsx:191`,
  `src/lib/db/queries/siblings.ts:147`, `sibling-linker.tsx:221`,
  `sibling-list.tsx:289`. These are sibling-picker surfaces where staff choose
  an account — a name plus school/entry year identifies it better than `BA-…`
  ever did.
- **Audit**: `createAuditLog` context strings that interpolate
  `account.reference` (e.g. `bursary-account-actions.ts:139`) switch to
  `childName`. **Keep `BURSARY_ACCOUNT_FEES_CODE_UPDATED` defined** in
  `src/lib/audit/actions.ts` even though nothing writes it any more —
  `audit_logs` is append-only and historical rows still carry that string;
  removing the constant would render them unlabelled in the audit UI.

**Done when:** two applications can hold the identical reference; the generated
application default matches the format above and is inherited on rollover; an
admin can edit an awarded application's reference to `TS-SMITH05-Smith, Bob`
and it renders on the application table, headers, exports and outcome emails;
no bursary-account reference or fees code appears anywhere in the UI; both
columns are gone with no data lost.

### Wave D — portal content & document requirements

#### D1 · Strict one-time submission PDF · M · **migration**
**CF-27** · **D13-4**

- **Migration**: `applications.submission_pdf_downloaded_at timestamptz?`.
- `GET /api/pdf/submission/[applicationId]` stamps the column on first
  successful render and returns **410 Gone** thereafter.
- Remove the applicant History page (`src/app/(portal)/history/page.tsx`), its
  nav item (`src/components/portal/portal-nav.tsx:115-118`), and
  `loadAccountHistory`.
- Remove the persistent download link on `/submitted`
  (`src/components/portal/submission-download-offer.tsx:24`) — the offer becomes
  a one-shot at submission time, with copy stating plainly that this is the only
  chance to save it.
- Applicants keep status visibility; only answer-browsing goes.

Stamp *after* `renderToBuffer` succeeds, not before — a failed render must not
consume the single download.

**Q3 decided (Brian, 2026-08-14): build it regardless.** Ship the mechanism and
the copy; no client gate. The support consequence (a parent who loses the file
must email the bursary team) is accepted — make the one-shot copy explicit
enough that it is not a surprise.

#### D2 · UC multi-upload + duplicate detection · **L** · **migration**
**CF-28** · depends on A1

- Add `minCount` to the `DocPresence` rule shape and enforce it in `docPresent`
  (`src/lib/portal/document-rules.ts:172-180`) — today an array satisfies the
  rule with **one** id (`id.some(...)`). Set `minCount: 3` on the `UC_MONTHLY`
  rule (`src/lib/portal/section-rules.ts:174-184`), whose label already promises
  three; total UC requirement becomes 4 files (3 monthly + 1 statement).
- Repeat-slot upload UI on the benefits section (built on A1's transport).
- **Migration**: `documents.content_digest text?` (sha-256), computed
  server-side in A1's confirm endpoint, plus an index on
  `(application_id, content_digest)`. Reject or warn when the same digest
  appears twice within one application — pick reject for the UC slots
  specifically (she uploaded the same file three times), warn elsewhere.
- `src/lib/portal/section-rules.test.ts` pins evaluator behaviour — extend it
  deliberately, do not loosen existing assertions.

Digest computation needs the bytes: compute it in the confirm endpoint from the
Range/stream already being read for the sniff, so there is one download, not two.

#### D3 · Loan documents · S
**CF-30**

Drop "(optional)" from the loan statement copy
(`src/components/portal/sections/assets-liabilities-form.tsx:710-712`) and add a
`LOAN_AGREEMENT` slot to `src/lib/documents/slots.ts`, required whenever a loan
is declared (`requiredIfValueGt0` — the pattern already used for
`UC_STATEMENT`).

**Q2 decided (Brian, 2026-08-14): required only when a loan is declared.**
Use `requiredIfValueGt0`; no assumption marker needed.

#### D4 · Separate REVIEW from SUBMIT · M
**CF-32**

Today the declaration save auto-calls `submitApplication`
(`src/app/(portal)/apply/[section]/section-page-client.tsx:442-455`) — saving the
declaration *is* submitting. Decouple:

- Declaration page gets a distinct **SUBMIT** button (explicit, confirmed) and a
  **REVIEW** button returning to `/apply/review` with no submission prompt.
- Fix the footer/page label disagreement — "Review and Submit"
  (`src/components/portal/apply-footer.tsx:47`) vs "Submit Application".
- Preserve the CR-001 carve-out already in that code path: on-behalf editing
  never auto-submits.

**Done when:** saving the declaration does not submit; submitting requires the
explicit button; the review round-trip loses nothing.

### Wave F — discovered during the sprint

These were **not** in the epic. Each was found while building a WP and is
recorded here rather than fixed inline, so the discovering PR stays scoped.

| WP | Source | Change | Size |
|---|---|---|---|
| **F1** | D13-1b | **Retire NM-01..05 name masking coherently.** Brian retired masking on 2026-08-14, but the codebase now contradicts itself. Remove the `childName` omission from `getApplicationWithDetails` (`src/lib/db/queries/applications.ts:429-468`) and the "Assessment tab MUST NOT call this" prohibition on `getApplicationNamesForReveal` (~:516); decide whether the queue's masked-by-default toggle stays; update the PRD (`docs/product/prd/04-admin-round-management.md:7`, AC-03) and mark finding 2.18 superseded rather than open. **Decide deliberately whether `NAME_REVEAL` audit rows are still wanted** — if names are simply visible, an audit row per page load is cost without a purpose, and C4a currently writes one on every detail-page load. | M |
| **F5** | A4 + A3 | **Unseeded defaults leak raw Zod internals — a defect *class*, not one bug.** A required field absent from a form's `getDefaultValues` stays `undefined`; the base-type check then fails **before** any `refine`/`superRefine` runs, and the banner renders bare Zod text naming no field ("Invalid input: expected string, received undefined"). Two instances found independently on the same day: A4's `documentsConfirmed` seeded for `parent1Income` only (Parent 2's checkbox also mounted uncontrolled), and Charlotte's CF-17 blocker. Two consequences worth fixing generally: **(a)** audit every section form for required fields missing from its defaults, especially in conditionally-rendered blocks; **(b)** make the error banner name the offending field — a pathless error cost hours of diagnosis here and is hostile to applicants, who cannot act on it at all. **Assessed during A3: (b) is NOT cheap** — `flattenErrors` has the path, but turning `parent2Contact.firstName` into copy a parent should read needs a field-label registry spanning every section. Separate PR. A3 removed the *unnamed raw Zod* class; the residual gap is that two parents' identical messages still don't say **which parent**. | M |
| **F6** | A4 | **Blank and a deliberate £0 are indistinguishable at field level** (pre-existing, not introduced by A4). Every currency cell is seeded to `0` on mount, so "never touched" and "typed 0" are identical in the stored blob; `CurrencyInput` also writes `""` on clear and leaves it `""` on blur, which `z.coerce.number()` turns into `0`. A4 works around it with a per-parent declaration at section level, which is sound — but the underlying ambiguity remains and will bite any future rule that needs to tell the two apart. | M |
| **F4** | C3 | **`setApplicationOutcomeLegacy` is orphaned dead code.** Its only caller was the `setOutcome` server action that C3 deleted, and nothing tests it (`src/lib/applications/set-outcome-core.ts:318`). C3 could not remove it because that file is C1-owned in an ancestor branch. Verified orphaned by `git grep` on the C3 branch — the sole hit is its own definition. Delete it once the stack lands. | S |
| **F2** | A1 (CF-24) | **Duplicate passport slot loses a document.** `src/components/portal/sections/family-id-form.tsx:354` and `:377` render two uploads ("UK Passport" and "Passport") against the **same slot** while writing to **different fields** (`ukPassportDocumentId` vs `passportDocumentId`). For a non-British family member one of the two can be lost. This — not the 413 — is the likelier cause of CF-24 ("passport not accepted, left that tab unfinished"). Genuine latent data-loss bug. | M |

#### F3 · Confirm CF-20 on preview (not a build)

CF-20 (re-upload error after data loss) **could not be reproduced** during A1.
The old client rendered every failure as `Upload failed (<status>)`, so the
original screenshot does not reveal the status code. Reproducing it needs the
CF-19 data-loss state, which is B1/B2 territory. **Re-test on preview once A1 +
B1 are deployed**; the new error copy is specific enough to diagnose it if it
recurs. Do not close CF-20 until that test happens.

### Wave E — deadlines & invitation email

#### E1 · Type-aware round deadlines · **L** · **migration**
**CF-11, CF-12** · **D13-8**

- **Migration (additive)**: add `rounds.default_submission_deadline_new` and
  `rounds.default_submission_deadline_rolling` (both `date?`); backfill both
  from the existing `default_submission_deadline`. **Keep the legacy column** —
  cut readers over in this PR, drop the column in a follow-up PR (E1b) once
  staging is verified, per the Epic 01 PR-6/#177 precedent.
- `effectiveSubmissionDeadline` (`src/lib/rounds/submission-deadline.ts:68-90`)
  gains a type branch on `Application.applicationType`
  (`NEW` | `ROLLING_OVER`, `prisma/schema.prisma:151`). Precedence stays
  `app override → round default (typed) → round closeDate`. **Both new tiers are
  date-only and must go through `endOfDay()`** — skipping it locks applicants
  out a day early.
- `SubmissionDeadlineRound` is a structural type consumed by several call
  sites; update every `select:` that feeds it —
  `src/app/(portal)/status/page.tsx:70`, `(portal)/page.tsx:173`,
  `apply/[section]/page.tsx:109`, `(admin)/applications/[id]/page.tsx:505`,
  `(admin)/queue/bulk-email-actions.ts:128`, `(admin)/rounds/actions.ts`
  (create + edit paths, ~:49-207).
- Round create/edit dialogs surface both fields; the rolling deadline defaults
  to the April date.
- **Invitation email `{{deadline}}` fix — all four sites**:
  `src/app/(admin)/invitations/actions.ts:261, 430, 862, 1349`. Each currently
  injects `expiresAt` (the invitation token expiry, now+30d). Replace with the
  effective submission deadline for that application/round+type. Where the token
  expiry genuinely needs communicating (it does — the link stops working), add a
  separate merge field rather than overloading `{{deadline}}`.

**Q4 decided (Brian, 2026-08-14): one global date per round, defaulting to
April.** Not per-school — two date columns on `Round` is the whole model.

---

## 6. Migration summary

| WP | Migration | Shape | Risk |
|---|---|---|---|
| C4a | drop `Application.reference` unique + `lower(reference)` unique idx; add non-unique `lower(reference)` idx | constraint drop | Low — no FK uses it; verify no `findUnique({where:{reference}})` remains |
| C4b | drop `bursary_accounts.reference` (+ its unique idx) and `bursary_accounts.fees_account_code` | **column drops** | Low — no FK uses either (all 6 account relations point at `id`); `fees_account_code` 0 non-null on nonprod (2026-08-14); **re-verify prod before merge** |
| D1 | `applications.submission_pdf_downloaded_at timestamptz?` | additive | None |
| D2 | `documents.content_digest text?` + `(application_id, content_digest)` idx | additive | Backfill is not required — existing rows keep NULL and skip duplicate detection |
| E1 | `rounds.default_submission_deadline_{new,rolling} date?` + backfill | additive | Legacy column retained; drop in follow-up E1b |

No new tables → **no new RLS policies required** this sprint. If that changes,
the policy ships in the same PR (see §2).

---

## 7. Test strategy

- **Unit (vitest)** — the default. Every rule/engine change gets a test:
  A2 (status × sole-parent matrix), A3, A4 (zero-income), C1 (transition table +
  server-side guard at the action layer), C2 (adjustment arithmetic), C4
  (reference generation + duplicate tolerance), D2 (`minCount`, digest
  collision), E1 (typed resolver × 3 tiers × 2 types, including the `endOfDay`
  boundary).
- **Regression watch** — these files encode behaviour this sprint changes:
  `src/lib/portal/__tests__/section-rules.test.ts` (D2),
  `src/app/(portal)/apply/__tests__/save-section-provenance.test.ts` (B2),
  and whatever pins `submission-deadline` (E1). Extend deliberately; a loosened
  assertion needs a comment explaining why.
- **Manual on preview deploy** — A1 (real 20 MB file), B1/B2 (dirty-nav and
  autosave are timing-dependent), D1 (one-shot download → 410), D4 (submit
  flow).
- **Gate on every PR**: `npm run test`, `npx tsc --noEmit`, `npm run build`.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| A1 rewrites the upload path Charlotte is already stuck on — a regression here is worse than the 413 | Ship A1 alone and first; keep `uploadDocument()` and the admin route untouched; manual test on preview before merge |
| Autosave (B2) multiplies `clearedProvenanceForApplicantSave` calls, potentially thrashing assessor provenance | Verify idempotence; gate the clear on real value change if needed; extend the provenance test |
| C1 reopens a state the whole model treats as terminal | Server-side guard added in the same PR; outcome gate; audit entry; doc comment rewritten so the exception is legible to the next reader |
| C4a/C4b remove uniqueness guarantees other code may quietly rely on | Grep every `reference` `where` clause before merging; confirm no `findUnique`; test duplicate search + export |
| **C4b drops columns and prod could not be inspected** — `supabase-prod` rejected the read-only user's password on 2026-08-14 (`28P01`). CALC-10 is not promoted to `main`, so `fees_account_code` is not expected to exist in prod, but that is inference, not verification | Fix the prod read-only credential (worth doing regardless — it blocks every prod check), then confirm before merging C4b |
| C4a makes the reference editable post-award while C1 adds new status guards in the same sprint — a guard could accidentally catch the reference edit | The reference is explicitly exempt from state-gating (Story 11.1); C4a adds a test pinning editability in archived/closed states |
| CF-15 ("kicked out") may not reproduce | B1 ships the other three fixes regardless; record the non-reproduction on the PR rather than closing it silently |
| E1's structural type is consumed by 6+ call sites | The `select:` list in §5 E1 is the complete set as of `ae4bdb4` — re-grep before starting |

---

## 9. Open questions — all answered

**Brian answered Q1–Q5 on 2026-08-14. Nothing is blocked and no
`ASSUMPTION(...)` markers are needed.**

| Q | CF | Question | Answer | Affects |
|---|---|---|---|---|
| Q1 | 23 | Is year of entry still parent-entered? | **Remove it from applicant input entirely, including validation — and from applicant-facing display.** It remains a property of the application but is JWF-facing only | A6 — grew from S to M; nonprod backfill already done |
| Q2 | 30 | Loan agreement always, or only when declared? | **Only when a loan is declared** | D3 — `requiredIfValueGt0` |
| Q3 | 27 | Accept the one-time-PDF support consequence? | **Build it regardless** | D1 — no client gate |
| Q4 | 12 | Rolling-over deadline: global per round or per-school? | **One global date per round, defaulting to April** | E1 — two date columns, no per-school structure |
| Q5 | 04 | On rollover, inherit the edited reference or regenerate? | **Inherit** (a never-edited default is regenerated) | C4a; folded into D13-1a |

**Still to relay to Charlotte** (informational, not blocking): the CF-08 and
CF-11 corrections, and the CF-23 diagnosis — her Details-of-the-Child blocker
is the birth-certificate upload (CF-14), not year of entry.

Also to send back (no build needed): the CF-08 and CF-11 corrections and the
CF-23 diagnosis from the epic's "Corrections" section.

---

## 10. Progress tracker

Update the status column as PRs merge. `—` = not started.

| WP | Status | PR | Notes |
|---|---|---|---|
| A1 | ✅ merged-ready | [#271](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/271) | CI green. Deletes the multipart route. Found + fixed a stored-XSS vector (see below) |
| A2 | ✅ merged-ready | [#274](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/274) | Matrix in one place; stale answers cleared live **and** in persisted blobs |
| A3 | ✅ fixed | [#277](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/277) | Root cause: `parent2Contact.*` (7 strings) + `parent1Contact.email` unseeded in `getDefaultValues`. **No validation rule changed.** Also fixed the contribute-flow schema mismatch |
| F5 | in progress | | systemic defaults sweep — on the critical path |
| A4 | ✅ merged-ready | [#278](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/278) | CI green. Root cause was the legibility tick, not the numbers — see F5 |
| A5 + A7 + A8 | — | | paired PR |
| A6 | ✅ merged-ready | [#276](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/276) | CI green. Correctly refused the schedule-page removal (derivation input, not display) |
| B1 | in progress | | |
| D1 | in progress | | migration |
| B1 | — | | |
| B2 | — | | |
| C1 | ✅ merged-ready | [#269](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/269) | CI green. Closed a live authz gap: `saveAssessmentAction` had no server-side status check |
| C2 | ✅ merged-ready | [#272](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/272) | CI green. No recommendation PDF exists — see the C2 correction |
| C3 | ✅ merged-ready | [#273](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/273) | 16 insertions / 180 deletions. Orphaned `setApplicationOutcomeLegacy` → F4 |
| C4a | ✅ merged-ready | [#270](https://github.com/Meridian-Technology-Group/jwf-bursary-system/pull/270) | CI green. Migration authored by hand, unapplied |
| C4b | in progress | | migration (column drops) |
| D1 | — | | migration |
| D2 | — | | migration |
| D3 | — | | |
| D4 | — | | |
| E1 | — | | migration |
| E1b | — | | legacy column drop, after E1 verified |
