---
title: "Epic 15 — implementation plan (autonomous execution)"
status: open
opened: 2026-08-20
opened_by: Brian Wagner
depends_on:
  - ./epic-15-go-live-sprint.md
  - ../../client-feedback/2026-08-17-charlotte-feedback.md
  - ../../client-feedback/2026-08-20-charlotte-feedback.md
related:
  - ./epic-14-implementation-plan.md    # prior art — §0 environment facts + §2 ground rules apply verbatim
  - ./epic-15-progress.md               # live sprint board — update as you go
  - ./source-materials/screenshots-2026-08-17-20/   # Charlotte's screenshots (committed)
---

# Epic 15 — implementation plan

Written to be executed by Claude Code sessions **starting from a brand-new
context with full autonomy** (Brian, 2026-08-20). Everything a session needs
is in this file, the epic, the two feedback catalogues, and the repo. Do not
assume conversation history exists.

## 0. Cold-start bootstrap (read this first, every session)

**Read, in order, before writing any code:**

1. Repo `CLAUDE.md` — the mandatory git workflow. Non-negotiable.
2. [`epic-15-go-live-sprint.md`](epic-15-go-live-sprint.md) — decisions
   D15-1..4, the item→WP map with screenshot decodes, the board.
3. The two catalogues: [`2026-08-17-charlotte-feedback.md`](../../client-feedback/2026-08-17-charlotte-feedback.md)
   (CH-01..25) and [`2026-08-20-charlotte-feedback.md`](../../client-feedback/2026-08-20-charlotte-feedback.md)
   (CI-01..13, incl. the verbatim Part 6 layout and the CI-13 column
   contracts). Ground truth for requirements.
4. [`epic-15-progress.md`](epic-15-progress.md) — what is done or in
   flight. Update it when you start and when you finish a WP.
5. **`epic-14-implementation-plan.md` §0 "Environment facts" and §2
   "Ground rules" apply verbatim** (Node/PATH, `.env` vs `.env.local`,
   nonprod-is-Charlotte's-environment, seed rules, append-only
   `audit_logs`, RLS-in-same-PR, service-role `profiles` writes, invalid
   local Resend key, `db-push.yml` migration path, CI gates, worktree
   Prisma hazard). Re-read them; they are not repeated here.
6. This plan's §1–§4, then **only** your WP's brief in §6.

**Environment facts new to this epic (verified 2026-08-20):**

- **Real family data arrives on nonprod from 21 Aug** (D15-1): the three
  internal applicants Charlotte sets up are REAL people. From the moment
  G3 confirms go-live, treat any non-`brian+…@meridiantech.group` /
  non-`*.test` parent account as protected client data: never open, modify,
  or delete it during development or browser verification. Throwaway
  fixtures only, clearly labelled, cleaned up after (no `auditLog`
  deletes).
- Round `2026/27` is `OPEN` on nonprod (2026-09-01 → 2026-11-30) with all
  four scenario windows seeded. Invitation sends are gated **only** on
  round status = OPEN — windows are merge-field/deadline config, not a
  send-time gate.
- The recovery email for password reset is sent by **Supabase Auth**, not
  Resend — it works from a local dev server. Check the Supabase project's
  auth redirect allowlist covers your origin before browser-testing G1.

**Authority (granted by Brian, 2026-08-20, for Epic 15 — D15-4):**

Identical to Epic 14: implement, test, push branches, open PRs to
`staging`, squash-merge your own PR once CI is green with the WP's
validation evidence in the PR body. Never `staging → main`; never
force-push; never bypass hooks; env-var *values* are flagged to Brian, not
set. Escalate (stop, report, do not improvise) on: destructive DB
operations; anything conflicting with a locked assumption (§3); anything
that would change v2 engine outputs; anything touching prod.
**Never email Charlotte or anyone external.** Questions for her go in
`epic-15-progress.md` §For Brian.

## 1. Exit criteria

1. **Day-0 (target: before Brian's green-light on 21 Aug)**: G1 — a parent
   can complete the full forgot-password → email link → set new password →
   sign in loop, browser-proven. G2 — no invitation can be prepared or
   sent without the child's first name AND surname; the recipient data
   contract (first name, surname, DOB, school, year of entry — no title)
   holds on Contact, direct-send, Invitation and Application. G3 — the
   go-live runbook exists with a green browser pass of invite → register →
   apply on the staging deploy, and §For Brian carries the green-light
   note + suggested reply points for Charlotte.
2. **Parent window (before 27 Aug)**: P1 — a paused application accepts
   parent uploads into the requested slots ONLY while paused; the moment
   the response is submitted the window is shut again; nothing else on a
   submitted application is parent-editable at any point. Regression-
   tested and browser-proven.
3. **Workspace train**: the assessment page has one compressed header row
   with the four-state strip (exactly one green), no old 4-tab row, no
   Actions row, no household card; Part 6 is reachable and fillable
   without completing the assessment first, laid out per Charlotte's
   spec; Parts 1–3 amended per CH-10..24; flags gone; tabs renamed
   (1-5)/(6); admin tab shows the scaffold. Zero change to computed
   values — the untouched v2 engine tests prove it.
4. **Comms**: sends are recorded and listable (X1); an invitation can be
   created without sending its email, sends accept an optional BCC, and
   §For Brian carries the Preview-scope reply-to env note (X2).
5. `epic-15-progress.md` fully ticked with evidence per WP; everything for
   Brian/Charlotte explicitly listed.

## 2. Ground rules (deltas on top of Epic 14 §2)

- **Branching**: `fix/e15-<wp>-<slug>` / `feature/e15-<wp>-<slug>` /
  `docs/e15-<wp>-<slug>` off freshly-pulled `staging`. One WP per PR
  unless the board pairs them. PRs target `staging`.
- **Train discipline**: W1 → W2 → M6 → M5 → M2 → M1 → M3 → M4 → M7 run
  **sequentially** — every one of them touches
  `assessment-form-v2.tsx` and/or the assessment routes/layout. Branch
  each after the previous merges. G, P and X lanes touch disjoint files
  and may run in parallel with the train and each other — but prefer
  one-at-a-time (Epic 13's parallel-worktree hazards).
- **The v2 engine is read-only**: `src/lib/assessment/v2/*` and
  `src/lib/assessment/{sibling,fee-year,…}.ts` must not change computed
  behaviour. Charlotte signed off Parts 2/4/5 calculations on 20 Aug —
  do not disturb them. UI-level sign display (M4/CH-24) is presentation
  only. If a WP seems to require engine change → escalate.
- **Copy is Charlotte's, verbatim** where supplied: Part 6 field labels
  from the CI-12 layout (including "SILBINGS'" as she wrote it — matches
  the existing C7 block), CI-13 column headers, status names
  NOT STARTED / PAUSED / COMPLETE / LOCKED. Internal identifiers may be
  clean; user-visible labels stay verbatim.
- **Never surface internal annotations in the UI** (CH-19's lesson): no
  LA numbers, no "sign-off pending", no engine terminology in
  user-visible helper text. Assessor-facing helper text is allowed only
  when it explains *her* workflow, not ours.
- Every WP updates `epic-15-progress.md` (status + PR link + evidence) in
  its own PR.

## 3. Locked assumptions (LA15-1..10)

Build to these; each is cheap to adjust if Charlotte answers differently.
If one becomes impossible or contradictory, escalate — do not invent a
third option.

| # | Assumption | If Charlotte disagrees |
|---|---|---|
| LA15-1 | The four states map to existing data: **NOT STARTED** = `Assessment.status NOT_STARTED` (or no assessment); **PAUSED** = `IN_PROGRESS` or `PAUSED` (i.e. anything saved, not complete — her definition "as soon as at least one entry has been saved"); **COMPLETE** = `COMPLETED`, no outcome; **LOCKED** = outcome recorded (the existing reopen-blocked semantics). No schema change; the strip is derived. | Re-map or add an explicit lock action |
| LA15-2 | The four-state strip is an **indicator** (one green at a time, per her mock `ch-image007`); transitions keep their existing verbs — Save/Pause/Complete on the form banner, outcome recording on Part 6. The strip is not four new buttons with four new actions. | Wire chips as actions |
| LA15-3 | Removing the old `Applicant Data / Assessment / Recommendation / History` row (CH-07) and the Actions row applies to **assessment routes only**. The application-detail tabs stay for the applications queue; nothing is deleted, only not rendered under `/assessment`. The blue "Mark Complete" disappears with the Actions row on assessment routes — the form's green Complete is the single completion affordance there. | Wider removal |
| LA15-4 | Part 6 ungating (CI-11): entering and saving award working data requires only an assessment **in any state**; the **formal outcome actions** (AWARDED / DOES_NOT_QUALIFY / …) still require COMPLETE. Pre-completion, AUTO cells bind to the **live** engine output (same source as SEE COMPUTATION); completion snapshot semantics are unchanged. | Ungate outcomes too, or re-gate |
| LA15-5 | "Bursary award year of entry" becomes a **Year 6–13 dropdown** (school year group — `entryYearGroup`, not the calendar year), empty by default, mandatory (CH-10/11, overturns Epic 14 LA-5). The remaining-years row autofills from the CH-12 matrix on selection and stays editable. Calendar `entryYear` remains in the data model for rounds/scheduling. | Rendering/range change |
| LA15-6 | CH-20: the MANUAL INCOME ADJUSTMENT **UI section is removed**; the engine input remains (absent = 0) and previously-saved non-zero adjustments are still honoured by the engine and visible only inside SEE COMPUTATION. | Full removal incl. engine input (escalate — engine change) |
| LA15-7 | CH-17 needs **no schema change**: `SchoolFees.effectiveFrom` already encodes the year dimension and `fee-year.ts` already resolves current/next per academic year. The change is admin UI + write path (choose the effective year, see all rows incl. future/history) + seeding Charlotte's four figures. | Schema move to explicit academicYear column |
| LA15-8 | X1: a new additive `email_log` table (RLS admin-read in the same migration) written best-effort by the three senders from merge time onward. No backfill — history starts at the WP's merge. The webhook may later update delivery status; not required this sprint. | Different storage/scope |
| LA15-9 | CI-03 needs **no code**: `RESEND_REPLY_TO_EMAIL` set in Vercel **Preview scope** → `fees@johnwhitgiftfoundation.org` makes staging behave like prod for the real applicants. Flag to Brian; do not set it. The prod-only fallback code stays as #318 shipped it. | Code-level env split |
| LA15-10 | CI-04: the deliverable is an explicit **"create invitation without sending"** option that yields a copyable registration link (she sends it from Outlook). Contact creation already sends nothing — say so in the reply notes rather than building anything there. | Different mechanism |

## 4. Ground truth (verified 2026-08-20 — re-verify anchors before relying)

Line numbers drift; grep before editing.

| Claim | Detail |
|---|---|
| `/reset-password/update` does not exist | `src/app/(auth)/reset-password/page.tsx` calls `resetPasswordForEmail(email, { redirectTo: origin + "/auth/callback?next=/reset-password/update" })` (~:33-39); `src/app/(auth)/auth/callback/route.ts` exchanges `?code` and redirects to `next` — a route with **no page**. No `updateUser`, no `PASSWORD_RECOVERY` handler anywhere. Middleware already treats `/reset-password*` as public (`src/middleware.ts` ~:41). Links to `/reset-password` from login, existing-account-accept, reassessment-signin |
| Child names are a whitespace split | Part 1 first/surname = split of `Application.childName` (`assessment-form-v2.tsx` ~:965-968). `Contact` HAS `childFirstName`/`childLastName` (optional; `childName` is the required composed backing store, `prisma/schema.prisma` ~:918-983) but they are never propagated — `Invitation` (~:986-1020) and `Application` (~:216) carry single `childName` only. Direct-send form has one `childName` field (`send-invitation-form.tsx` zod ~:62-83; server mirror `invitations/actions.ts` ~:82-86); invite-readiness = `missingRequiredInviteFields()` (`src/lib/contacts/contact-helpers.ts` ~:25-42) — child first name and DOB are NOT required today |
| Assessment status model | `Assessment.status` enum `NOT_STARTED\|IN_PROGRESS\|PAUSED\|COMPLETED` (`schema.prisma` ~:515, ~:1172); single writer `src/lib/applications/status.ts`; derived `ReviewPhase` maps IN_PROGRESS → label "Review in progress" (`review-phase-labels.ts` ~:26); queue vocabulary adds derived `LOCKED` (outcome recorded) — `src/lib/assessments/queue-status.ts` |
| Two Complete buttons | Blue "Mark Complete": `application-actions.tsx` ~:179-191 → `updateApplicationStatus(id, "COMPLETED")`. Green "Complete": `assessment-form-v2.tsx` ~:941-949 → `completeAssessmentAction` (gated `annualFees > 0`). Same column, different actions — CH-04's confusion is real |
| The three header layers | ALL in `src/app/(admin)/applications/[id]/layout.tsx`: breadcrumb ~:226-238; title block ~:241-305 (status badges already hidden on assessment routes via `HideOnAssessmentRoute` — `assessment-route-chrome.tsx`); Actions row = `application-actions.tsx` mounted ~:338-342; old 4-tab row `getTabItems()` ~:65-92 rendered ~:418-435; `ManageDisclosure` collapsed (CG-19). Workbook tab row: `src/components/admin/assessment-tab-nav.tsx` (`TABS` ~:18-24) |
| Recommendation gate | `src/components/admin/recommendation-surface.tsx` ~:76 `if (!assessment \|\| assessment.status !== "COMPLETED")` → "Assessment must be completed first" (~:85). Second guard ~:107-124: v2 + `recommendedPayableFees == null` → "Assessment snapshot incomplete". Consumers: recommendation page + `assessment/award/page.tsx` ~:148 |
| Award tab today | `assessment/award/page.tsx`: header card (~:100-131, CALCULATING BURSARY AWARD FOR + school + ANNUAL SCHOOL FEES + COMPLETED ON) + `SiblingFeesBlock` (3 manual rows → `Assessment.siblingDetails`; read-only when COMPLETED) + `RecommendationSurface`. Live engine shape: `AssessmentV2Output` (`v2/orchestrator.ts` ~:126-173) has every AUTO cell CI-12 needs (`actualRemainingDi`, `theoreticalBenchmarkDi`, `affordabilityAdjustedDi`, `recommendedPayableFees`, `awardSummary`) |
| Part 1 is hand-written JSX | `assessment-form-v2.tsx` ~:963-1105 (IIFE, no row-definition structure — unlike Parts 3/5's `WorkbookTable`/`WBRow`). Scholarship row is read-only "recorded on the Bursary Award tab" (~:1010-1018); remaining-years uses `calculateSchoolingYearsRemainingFromEntry` (`src/lib/assessment/schooling-years.ts`); children count shows "Default for this family type: N" (~:1071-1090); annual fees hidden, warns when ≤ 0 |
| Flags block | `assessment-form-v2.tsx` ~:1536-1556 (`E. Flags`, `dishonestyFlag` checkbox + credit-risk helper). Columns `Assessment.dishonestyFlag/creditRiskFlag` (~:511-512) stay (data), section goes (UI) |
| Admin tab empty states | `assessment/admin/page.tsx`: history empty "No history yet — …" ~:230-234; schedule empty ~:300-304; tables are hand-rolled in-page (~:236-291); data via `mergeYoyHistory` (`src/lib/assessments/admin-tab.ts`) + `BursaryAccount.preSystemHistory` |
| Assessments list fonts | `src/app/(admin)/assessments/page.tsx` — inline `<table>`; reference cell `font-mono text-xs` (~:218) vs neighbours `text-sm` sans (CH-01 = mono + smaller in one row) |
| Upload gate has no PAUSED exemption | `src/lib/documents/upload-authorization.ts` ~:78-85 → 409 "Cannot upload documents to a submitted application" whenever `formStatus === "SUBMITTED"`; zero "paused" hits in sign/confirm routes. `/respond` (`src/app/(portal)/respond/`) renders `FileUpload` per requested slot against the presigned pair — **parent re-uploads 409 as written** (latent defect; P1). `submitMissingDocsResponse` (`(portal)/actions.ts` ~:323) re-asserts PAUSED, resumes, preserves `formStatus=SUBMITTED`. Missing-docs request: `missing-docs-dialog.tsx` → `pauseApplication` (`applications/[id]/actions.ts` ~:201), requires phase NOT_STARTED, records slots in the `APPLICATION_PAUSED` audit row (`getLatestMissingDocsRequest`) |
| No email persistence, no BCC | Only `EmailTemplate` in the schema; senders (`src/lib/email/send.ts`: `sendEmail` ~:89, `sendBatchEmails` ~:190, `sendRawEmail` ~:315) log to console/Sentry only; Resend webhook verifies + logs, no DB write. `replyToAddress()` ~:55-62 = env var wins, else fees@ **only when `VERCEL_ENV === "production"`** (#318). Zero `bcc` hits repo-wide |
| Contact creation sends nothing | `createContactAction` (`contacts/actions.ts` ~:169-228) has no send. The only send is the explicit Invite action (`invite-actions.ts`), which always emails and rolls back invitation + auth user on failure (~:296-350) |
| School fees | `SchoolFees` (`schema.prisma` ~:719-728): `school + annualFees + effectiveFrom`, unique `[school, effectiveFrom]`. Write path hard-codes `effectiveFrom = today` (`settings/actions.ts` ~:124-165, insert-only); Settings shows one row per school (`getSchoolFees` most-recent; `settings/page.tsx` ~:224-262; `school-fees-form.tsx` "New version from today" ~:114 — no date input). Engine already year-aware: `getSchoolFeesForYear` → `resolveFeeYearPair`/`resolveEffectiveFeeRow` (`src/lib/assessment/fee-year.ts`, 1-Sep cutoff, anchored on `Round.academicYear`) feeding `defaultAnnualFees`/`defaultNextYearAnnualFees` |
| Rounds / send gate | `RoundWindow` (`schema.prisma` ~:92-104) per (round, scenario); resolvers `src/lib/rounds/{round-scenario,window-consumption}.ts`. Send gate = round `OPEN` only. Nonprod: 2026/27 OPEN with all 4 windows seeded (verified live 2026-08-20) |
| Tests / browser | No Playwright in-repo; browser verification = **Playwright MCP** against `npm run dev` (screenshots land in `.playwright-mcp/`). Vitest colocated `__tests__/` (153 files); engine suites `src/lib/assessment/v2/__tests__/` + `src/lib/assessment/__tests__/` (incl. `fee-year`, `recommendation-v2`, `sibling`); route suites for documents sign/confirm, invitations, assessment gates |

## 5. Sprint board

Sizes: S ≤ half day · M ~1 day · L 2 days+. Live status in
[`epic-15-progress.md`](epic-15-progress.md).

| Lane | WP | Size | Branch | Depends on |
|---|---|---|---|---|
| G | G1 password-reset loop | S–M | `fix/e15-g1-password-reset-loop` | — · **do first** |
| G | G2 invitation name contract | M | `fix/e15-g2-invitation-names` | — · day-0 |
| G | G3 go-live readiness pass + runbook | M | `docs/e15-g3-golive-readiness` | G1+G2 merged & deployed |
| P | P1 missing-docs window lock | M | `feature/e15-p1-missing-docs-window-lock` | — |
| W | W1 four-state lifecycle strip | M–L | `feature/e15-w1-assessment-lifecycle` | — (train start) |
| W | W2 header compression + tab-row removal + fonts | L | `feature/e15-w2-assessment-chrome` | W1 |
| M | M6 award tab ungate + rebuild | L | `feature/e15-m6-award-tab-rebuild` | W2 |
| M | M5 flags removal + tab rename | S | `fix/e15-m5-flags-tab-rename` | M6 |
| M | M2 per-year school fees admin | M | `feature/e15-m2-school-fees-years` | — (off-train OK; before M1) |
| M | M1 Part 1 rebuild | L | `feature/e15-m1-part1-rebuild` | M5 + M2 |
| M | M3 Part 2 blank + annotation strip | M | `fix/e15-m3-part2-blank` | M1 |
| M | M4 Part 3 overrides + sign display | M–L | `feature/e15-m4-part3-overrides` | M3 |
| M | M7 admin history scaffold | M | `feature/e15-m7-admin-scaffold` | M4 |
| X | X1 sent-emails log + view | M | `feature/e15-x1-sent-emails` | — |
| X | X2 no-send invitations + BCC | M | `feature/e15-x2-comms-controls` | X1 (touches senders) |

## 6. Work-package briefs

Each brief is self-contained: read §0–§4 + the brief + the files it names.

---

### G1 · Password-reset loop · S–M · `fix/e15-g1-password-reset-loop`

**Requirement (CI-01, day-0).** A parent who requests a reset must land on
a set-new-password form from the email link, set it, and be able to sign
in. Today the link's callback exchanges the code and redirects to
`/reset-password/update` — **a page that does not exist** (§4 row 1).

**Steps.**
1. Build `src/app/(auth)/reset-password/update/page.tsx` (client), styled
   like the existing auth pages: new password + confirm, zod-validated
   (align strength rules with `/register`), `supabase.auth.updateUser({
   password })`, success state → "Password updated" → link to sign in
   (or straight to the portal — the recovery session is live).
2. Handle the no-session case (expired/re-used link, direct visit): show
   "This link has expired" + a link back to `/reset-password`. Do not
   loop to `/login`.
3. Audit the callback error paths: `missing_code` / `session_exchange_
   failed` land on `/login?error=…` — make sure the login page actually
   renders a human message for those (add if missing).
4. Confirm the Supabase (nonprod) auth redirect allowlist covers the
   staging alias + localhost. If the dashboard needs a change, flag the
   exact URL list in §For Brian — do not change auth settings silently.
5. Tests: unit-test the page's validation + session-absent branch; the
   callback's `safeNext` already has coverage — extend if you touch it.

**Validation.** Browser E2E (Playwright MCP, `npm run dev`, throwaway
parent — NEVER `test3@…`): request reset → open the emailed link
(Supabase sends it; fetch from the throwaway inbox or use the Supabase
admin `generate_link` API via service role for a deterministic test) →
set password → sign out → sign in with the new password. Screenshots of
each beat. After merge+deploy, repeat once against the staging alias and
record it in the PR (this is the exact loop Charlotte hit).

---

### G2 · Invitation name contract · M · `fix/e15-g2-invitation-names`

**Requirement (CH-09, day-0).** No invitation without the child's first
name and surname. Recipient contract: first name, surname, date of
birth, assigned school, assigned year of entry — **no title**.

**Known state (§4 row 2).** Contact has optional `childFirstName`/
`childLastName` + required composed `childName`; the direct-send form
captures one `childName` string; Invitation/Application store the single
string; Part 1 whitespace-splits it. First names and DOB are nowhere
required.

**Steps.**
1. **Contact path**: make `childFirstName`, `childLastName`, `childDob`
   required in `ContactSchema` (create + update) and in
   `missingRequiredInviteFields()`; keep `childName` as the composed
   backing store. Hide/drop `childTitle` from the form UI (column stays).
   Handle legacy rows: editing an old single-name contact prompts for the
   split fields (pre-split the existing `childName` as a starting value).
2. **Direct-send path**: split the `childName` field into required
   `childFirstName` + `childLastName` (client zod + server
   `InvitationSchema`); compose `childName` server-side the same way
   `composeChildName()` does. Add DOB if the form lacks it, same rule.
3. **Propagation (additive migration)**: add nullable `childFirstName`
   `childLastName` to `Invitation` and `Application`; write them at
   invitation-create and in `create-from-invitation.ts`; Part 1's
   first/surname rows read the split columns when present, falling back
   to the whitespace split for legacy rows. No RLS work (existing
   tables).
4. Tests: schema validation both paths (empty first name refused, empty
   surname refused); `create-from-invitation` carries the split names;
   Part 1 helper prefers split over split-string.

**Validation.** Full local gates; browser: try to send an invitation with
a missing child first name (refused, message names the field), then a
complete one; confirm Part 1 on a fresh application shows the true
first/surname split. Screenshots. Migration confirmed applied on nonprod
post-merge (`db-push.yml` + `list_migrations`).

---

### G3 · Go-live readiness pass + runbook · M · `docs/e15-g3-golive-readiness`

**Requirement (CI-09, D15-1/2).** Prove the parent-facing path on the
staging deploy and hand Brian a runbook + reply points, so he can
green-light Charlotte the same day G1/G2 land.

**Steps.**
1. After G1+G2 are merged and the staging deploy is green: browser pass
   against the **staging alias** with a throwaway family — internal
   bursary request path (Charlotte's actual route: internal-request
   dialog → INTERNAL template) or contact+invite if that is what she'll
   use; register from the invitation email link; start the application;
   upload one document; password-reset loop once more on staging.
2. Verify round `2026/27` windows/dates make sense for a 27 Aug deadline
   — note (do not change) that the round's NEW deadline default vs her
   ad-hoc 27 Aug deadline: she sets the deadline expectation by email;
   the system's displayed deadline comes from the round/windows. If the
   displayed deadline would contradict "next Thursday", flag it in the
   runbook with the one-line fix (edit the round window date in admin —
   Charlotte or Brian can do it in the UI).
3. Write `docs/operations/go-live-runbook-2026-08.md`: exact steps for
   Charlotte (create contacts → invite → what parents see), what Brian
   must do first (Vercel Preview `RESEND_REPLY_TO_EMAIL` — LA15-9 — if
   he wants replies at fees@ from day one), throwaway-data hygiene now
   that real families share nonprod, and the data-transfer note
   (post-assessment transfer to prod is a later scripted exercise —
   out of scope this sprint).
4. Update `epic-15-progress.md` §For Brian: green-light note + suggested
   reply points for Charlotte's E7 (timeline per epic §4).

**Validation.** The runbook itself + screenshots of the staging pass in
the PR. Clean up the throwaway family (no `auditLog` deletes).

---

### P1 · Missing-docs window lock · M · `feature/e15-p1-missing-docs-window-lock`

**Requirement (CI-07/08).** While a missing-docs request is open the
parent may upload into the requested slots and do nothing else; once they
submit their response the window shuts. Assessor editability unaffected.

**Known state (§4 row "Upload gate").** The presigned sign/confirm pair
409s on `formStatus === "SUBMITTED"` with **no PAUSED exemption** — the
`/respond` flow's uploads are broken as written (latent defect Charlotte
has not hit yet). The request's slot list lives in the `APPLICATION_
PAUSED` audit row (`getLatestMissingDocsRequest`).

**Steps.**
1. Fix + implement in one stroke in `upload-authorization.ts`: allow a
   parent upload to a SUBMITTED application **iff** the application's
   assessment is `PAUSED` AND the target slot is in the latest
   missing-docs request's slot list. Anything else keeps the 409. The
   window closes automatically when `submitMissingDocsResponse` resumes
   the assessment (PAUSED → IN_PROGRESS) — that IS the one-shot (CI-07):
   verify `/respond` already redirects away when not paused, and the
   sign route now refuses again.
2. CI-08 sweep: enumerate every parent-writable server action / route
   for an application (wizard section saves, review, declaration…) and
   assert each refuses when `formStatus === "SUBMITTED"` — paused or
   not. Fix any hole found; the parent's only verb during the window is
   uploading requested slots + submitting the response.
3. Tests: sign/confirm route suite — paused+requested-slot allowed;
   paused+other-slot 409; resumed (post-response) 409 again; assessor
   multipart path unaffected. Extend
   `src/app/api/documents/__tests__/sign-route.test.ts` (the existing
   409 test pins today's behaviour — amend deliberately).

**Validation.** Browser E2E on a throwaway: submit → admin requests two
slots → parent `/respond` uploads into a requested slot (succeeds —
today it would 409), cannot upload elsewhere, submits response → window
shut (re-visit `/respond` redirects; direct upload attempt refused).
Screenshots. Note in the PR that this also fixes the latent 409.

---

### W1 · Four-state lifecycle strip · M–L · `feature/e15-w1-assessment-lifecycle`

**Requirement (CH-04/05/06, LA15-1/2).** Replace the confusing pair of
Complete buttons with one four-state strip — NOT STARTED · PAUSED ·
COMPLETE · LOCKED, exactly one green (`ch-image007`) — and hide
"Actions › Review in progress".

**Steps.**
1. Pure helper `deriveAssessmentLifecycleState(assessment)` →
   `NOT_STARTED | PAUSED | COMPLETE | LOCKED` per LA15-1, unit-tested
   against every (status × outcome) combination. Reuse/align with
   `queue-status.ts` — one vocabulary, not two (the queue's IN_PROGRESS
   and PAUSED both display as her PAUSED; decide whether the queue keeps
   its finer labels — default: queue unchanged, workspace uses the
   4-state strip).
2. Strip component (green = current, grey = others, her mock's order),
   rendered where W2 will mount it — build it standalone here, mount in
   the v2 form banner for now, W2 relocates.
3. On assessment routes, suppress the Actions row's "Review in progress"
   label + the blue Mark Complete (LA15-3 — W2 removes the whole row;
   here just stop the duplication if W2 hasn't landed: gate
   `application-actions.tsx` rendering under the existing
   `HideOnAssessmentRoute`/route-detection pattern in
   `assessment-route-chrome.tsx`).
4. The form banner keeps Save / Pause / Complete verbs (LA15-2);
   after outcome recording the strip shows LOCKED (reopen flow
   unchanged).

**Validation.** Unit tests on the derivation matrix; browser: drive one
throwaway assessment NOT STARTED → save (strip flips to PAUSED) →
Complete (COMPLETE) → record outcome on Part 6 post-M6 or via the
recommendation page (LOCKED); screenshot each state. Confirm the
applications-queue surfaces are unchanged.

---

### W2 · Header compression + old-tab removal + fonts · L · `feature/e15-w2-assessment-chrome`

**Requirement (CH-01/03/07/08, CI-06, LA15-3).** On assessment routes:
one header row per her mock (`ch-image003`) — mono reference + surname +
school chip, `Round: … Entry: …` beneath, the W1 strip, and the action
buttons (Reject & Restart · MANAGE · Request Missing Documents · SEE
COMPUTATION) — no breadcrumb layer, no Actions row, no old 4-tab row,
no household card. Fix the assessments-list font mix.

**Steps.**
1. In `applications/[id]/layout.tsx`, branch on assessment routes (the
   `HideOnAssessmentRoute` pattern already exists — consider a server-
   side segment check instead of client CSS hiding for whole layers):
   suppress breadcrumb, Actions row (`application-actions.tsx` mount)
   and the 4-tab row; render the compressed header. Non-assessment
   routes byte-identical.
2. Fold into the header: W1 strip; MANAGE keeps the existing disclosure
   content (CG-19); "Request Missing Documents" + "Reject & Restart"
   move from the Actions row (same dialogs); SEE COMPUTATION moves up
   from the form banner (CG-21 built it — relocate the trigger, keep
   behaviour/persistence).
3. Remove the household-summary card from the assessment view — locate
   via `grep -r "WHO IS ASSESSED"` / `"Lead applicant"` (`ch-image008`;
   likely the family-type/household card on the assessment page or
   detail layout). Render nothing in its place (the info stays on the
   Applicant Data tab).
4. CH-01: assessments list — reference cell to `text-sm` (keep
   `font-mono font-semibold`) so the row reads as one size; sanity-check
   the admin-tab header strip + detail `h1` for the same mono-size clash
   and align.
5. Careful with the middle-part item CH-07 ("remove the top line now
   replaced by the second line", `ch-image005` decode): that IS the old
   4-tab row vs the workbook row — covered by step 1. Do not remove
   anything else on that evidence.

**Validation.** Browser screenshots: assessment route (all five tabs) at
1280px + 375px with the new single header; an application-detail route
(non-assessment) unchanged; assessments list font-consistent. Unit-test
any extracted header component; confirm `Request Missing Documents` and
`Reject & Restart` still work from the new placement (dialog smoke in
browser).

---

### M6 · Award tab ungate + rebuild · L · `feature/e15-m6-award-tab-rebuild`

**Requirement (CI-11/12, LA15-4).** Part 6 is the natural continuation of
Part 5: reachable and fillable in any assessment state, laid out per
Charlotte's verbatim field list (catalogue 20 Aug §E8), with the formal
outcome actions still requiring COMPLETE.

**Known state (§4 rows "Recommendation gate" / "Award tab today").** The
gate is `recommendation-surface.tsx` ~:76; pre-completion there is no
snapshot (`recommendedPayableFees` null — the second guard), but the
live engine output (`AssessmentV2Output`) carries every AUTO value.

**Steps.**
1. Ungate: on the award tab, render the surface for any existing
   assessment. Bind AUTO cells to the **live** orchestrator output when
   status ≠ COMPLETED (same computation SEE COMPUTATION uses — reuse,
   don't duplicate) and to the completion snapshot when COMPLETED
   (unchanged). The recommendation *page* (non-assessment route) keeps
   its current gate — only the workbook tab ungates.
2. Working-data persistence pre-completion: the assessor's manual Part 6
   entries (affordability-adjusted DI override, recommended PF, %
   scholarship, award values, gap reasons, last PF, YoY reasons) must
   save without completing. Check what `RecommendationFormV2` persists
   and when; move any completion-coupled write to save-time. Snapshot
   semantics at Complete unchanged (the existing
   `complete-snapshot-guard` tests must stay green).
3. Layout to her list, order and labels verbatim (incl. "SILBINGS'"),
   AUTO vs MANUAL per the catalogue table: header (name + school
   selects), siblings block (exists — `SiblingFeesBlock`, relax its
   COMPLETED read-only to LOCKED-only per LA15-4), fee/DI AUTO rows,
   award summary, GAP block (9-code picker), YoY reasons (36-code
   picker), ASSESSMENT COMPLETED ON (auto date).
4. Outcome actions (AWARDED etc.): keep the COMPLETE requirement —
   disabled with a quiet inline note when not yet complete ("Complete
   the assessment to record the outcome") — that is the *only* gate
   text left on the tab.
5. Tests: gate matrix (tab renders per state; outcome actions gated);
   AUTO-cell parity — live output pre-completion equals snapshot values
   post-completion for the same inputs (fixture); persistence of manual
   fields pre-completion.

**Validation.** Browser E2E on a throwaway: open a fresh assessment →
Part 6 immediately reachable, AUTO cells populate as Parts 1–5 fill →
save manual award fields while IN PROGRESS → Complete → values persist,
outcome recordable → LOCKED. Screenshot the ungated tab in the
in-progress state (the exact thing Charlotte couldn't see). Engine test
suite untouched and green.

---

### M5 · Flags removal + tab rename · S · `fix/e15-m5-flags-tab-rename`

**Requirement (CI-10, CH-25).**
1. Delete the `E. Flags` section from `assessment-form-v2.tsx`
   (~:1536-1556). Columns stay; if a legacy row has `dishonestyFlag`
   set, nothing renders (data preserved, invisible).
2. Rename in `assessment-tab-nav.tsx`: `ASSESSMENT MODEL (1-5)` and
   `BURSARY AWARD CALCULATION (6)`. Sweep for other "(1-4)"/"(5)"
   strings (award page header, section F label "F. Assessor's Wizard" —
   leave F alone; check the C3-era copy).
3. Part 6 heading inside the award tab: her layout titles it "PART 5 —
   BURSARY AWARD CALCULATION" but CH-25 fixes the numbering at (6);
   render `PART 6 - BURSARY AWARD CALCULATION` and note the discrepancy
   in §For Brian → Charlotte (one line).

**Validation.** Unit snapshot of TABS labels; browser screenshot of the
renamed tab row + flag-free Part 5.

---

### M2 · Per-year school fees admin · M · `feature/e15-m2-school-fees-years`

**Requirement (CH-17, LA15-7).** Admin can record each school's pre-VAT
annual fee **per academic year** (current + next visible; history
retained). Charlotte's figures: 2025-26 Trinity £24,366.67 / Whitgift
£25,200.00 · 2026-27 Trinity £25,390.00 / Whitgift £26,175.00.

**Known state (§4 row "School fees").** Engine already year-aware via
`effectiveFrom` + `fee-year.ts` (1-Sep cutoff). The admin write path
hard-codes `effectiveFrom = today` and the Settings read collapses to
one row per school.

**Steps.**
1. Write path: `upsertSchoolFeesAction` accepts an academic-year choice
   (render as `2025-26` / `2026-27` / `+1`, stored as `effectiveFrom =
   1 September of the start year` — matching the resolver's cutoff);
   upsert on `[school, effectiveFrom]` instead of insert-only-today.
2. Settings UI: table shows **all** rows per school (year-labelled,
   newest first), edit per row, add-year action. Replace the "Saving
   creates a new versioned record…" / "Only the current (most recent)
   fee…" copy with the truth (per-year fees; assessments read the
   year matching their round, plus next year).
3. Seed her four figures via `seed-reference.ts` idempotent upsert
   (keyed `[school, effectiveFrom]`) so nonprod carries them — per repo
   seed rules, NOT the demo seed. Run `npm run seed:reference` against
   nonprod after merge and record it.
4. Tests: action upsert semantics (same year twice = update);
   `fee-year.test.ts` untouched (resolver unchanged); a fixture proving
   a 2026/27-round assessment picks 2026-27 fees as current and none/
   next-year rules as documented.

**Validation.** Browser: Settings shows both years per school; edit one,
reload, correct; a fresh assessment on the 2026/27 round shows the
2026-27 fee as its hidden annual fee (surface via SEE COMPUTATION or
the Part 1 warning threshold). Screenshots.

---

### M1 · Part 1 rebuild · L · `feature/e15-m1-part1-rebuild`

**Requirement (CH-10..16, LA15-5).** Part 1 matches her workbook table
(`ch-image016`): autofill = first name, surname, annual school fees;
manual = school (Trinity/Whitgift dropdown, switchable mid-assessment),
year of entry (Year 6–13 dropdown, empty, mandatory), scholarship
(1–100 %, manual), siblings 1–3, family category, remaining years
(matrix-autofilled, editable), number of schooling-age children (1–20,
**no default shown**).

**Steps.**
1. New assessment-level fields (additive migration): `assessmentSchool
   School?` and `scholarshipPct Decimal?` on `Assessment` (school must
   be switchable per CH-14 *without* touching `Application.school` —
   the assessment's school drives fee lookup + calculations for this
   run; default null → assessor must pick; consider prefilling from the
   application ONLY as the dropdown's suggested-but-unselected state,
   per the no-prefill principle). Wire fee lookup (annual fees autofill)
   to the **assessment school** once selected; while unselected, no
   fees, Complete stays gated (existing `annualFees > 0` gate does the
   mandatory-enforcement work).
2. Year of entry: replace the calendar-year `Input` with an empty
   mandatory Year 6–13 `Select` bound to a new `entryYearGroup`-typed
   assessment field (or reuse the application's `entryYearGroup` as the
   unselected suggestion — same pattern as school). On selection,
   autofill remaining-years from the CH-12 matrix (verify
   `schooling-years.ts` matches Y6→8 … Y13→1 exactly; fix the mapping
   there ONLY if it disagrees — it is not an engine-output module, but
   check its test + callers first).
3. Scholarship: manual percentage input (1–100) in Part 1, persisted on
   the assessment; the award tab's `% SCHOLARSHIP` reads/writes the same
   field (single source — coordinate with M6's persistence; M6 lands
   first, so extend it here).
4. Children count: drop the rendered default hint + the value seeding;
   accept 1–20, empty until entered (`ch-image015`).
5. Rebuild the section as a declarative table (the `WorkbookTable`/
   `WBRow` pattern Parts 3/5 use) in her row order — kill the IIFE.
6. Tests: matrix autofill; school switch re-derives fees (Trinity →
   Whitgift changes annual fees + downstream SEE COMPUTATION values —
   fixture with both schools' fees from M2); scholarship bounds;
   children bounds; empty-mandatory states block Complete.

**Validation.** Browser: fresh assessment — Part 1 opens with names
autofilled and everything else empty; pick Year 7 → remaining years 7;
pick Trinity → fees appear; switch to Whitgift → award figures change
(CH-14's real scenario, screenshot both); Complete blocked until
school+year picked. Engine suites green.

---

### M3 · Part 2 blank + annotation strip · M · `fix/e15-m3-part2-blank`

**Requirement (CH-18/19/20, LA15-6).**
1. CH-18: a fresh assessment's Part 2 (income table) must render every
   cell empty. Chase where the £40,000/£32,000 she saw came from —
   suspects: her own earlier entries on that assessment (answer in §For
   Brian if so — verify by DB inspection of her `TS-…` assessment,
   read-only), or a residual seed/prefill path. Prove with a test that
   a new v2 assessment yields zero income entries.
2. CH-19: strip every internal annotation from the UI — grep
   `assessment-form-v2.tsx` (+ Parts 3/5 `WBRow note=` props) for
   `LA-8`, `sign-off`, `engine`, `C40`, `CALC-` and reword or remove:
   the sole-trader note, the DLA/PIP note, the MANUAL INCOME ADJUSTMENT
   explainer (goes anyway), any others found. User-visible text must
   pass the §2 "no internal annotations" rule.
3. CH-20: remove the MANUAL INCOME ADJUSTMENT section per LA15-6 —
   input gone from the UI; engine input remains; stored non-zero
   adjustments still flow into computation and appear inside SEE
   COMPUTATION only.
4. Tests: empty-open regression (extend the C4 empty-open test);
   adjustment-preservation fixture (stored adjustment still counted).

**Validation.** Browser: fresh assessment Part 2 fully blank; an
assessment with a legacy adjustment still totals correctly in SEE
COMPUTATION; no annotation strings anywhere on the workspace (visual
sweep of all six parts). Screenshots.

---

### M4 · Part 3 overrides + sign display · M–L · `feature/e15-m4-part3-overrides`

**Requirement (CH-21/22/23/24).** All display/input-level; engine
read-only.

**Steps.**
1. CH-21 (`ch-image019`): the notional-rent add-back row keeps its
   4-option dropdown AND gains a manual £ override of the derived
   value. Model as an optional override input: empty → engine's derived
   figure; filled → the override feeds the engine's existing *input*
   for that line if one exists — **check the orchestrator input shape
   first**; if the add-back is engine-computed with no input for an
   override, render the override as a manual line the engine already
   accepts (e.g. via the notional-spend inputs) — and if no such input
   exists at all, STOP and escalate (engine change).
2. CH-22 (`ch-image020`): council-tax deduct becomes a manual editable
   field; the dropdown (band/default source) becomes an "apply default"
   affordance that fills the field, which stays editable. Same
   engine-input caveat as above — council tax IS an assessor input
   today (verify in the orchestrator input), so this should be pure UI.
3. CH-23 (`ch-image021`): "DISPLAY ONLY — ENTER TOTAL CASH HELD /
   TOTAL SAVINGS" must start empty on a fresh assessment — find the
   seeding path (these moved to Part 3 in C6); remove any non-assessor
   source.
4. CH-24 (`ch-image022`): DEDUCT rows display negative signed totals
   (−£19,000 style), ADD BACK rows positive — presentation of the
   existing `notionalSpendLines[]`; her screenshot shows the pattern
   already partially live ("correct sign" annotation) — finish it
   consistently across Parts 3–5 tables. No engine change; totals
   unchanged.
5. Tests: override precedence (empty vs filled); council-tax default-
   apply; sign-rendering helper unit tests.

**Validation.** Browser with a worked example: set the add-back dropdown
→ derived value shows; override it → SEE COMPUTATION reflects the
override; council-tax default applied then hand-edited; signs match her
screenshot convention. She re-verifies with real data afterwards — note
that in §For Brian.

---

### M7 · Admin history scaffold · M · `feature/e15-m7-admin-scaffold`

**Requirement (CI-13).** The assessment-admin tab renders the **empty
infrastructure** of both history tables instead of "No history yet…":
all column headers per her two tables (catalogue 20 Aug §E8) and a row
per academic year (account start → +8 years or the schedule horizon),
empty cells where no data exists. Data-bearing rows keep the existing
rendering (C8 built the real merge).

**Steps.** Replace the two empty states in `assessment/admin/page.tsx`
(~:230-234, ~:300-304) with scaffold renders; when a bursary account or
schedule doesn't exist yet, derive the year spine from the application's
round + entry year (Y6→8-style horizon from the CH-12 matrix); verify
CI-13's column contracts against what C8 already renders — add any
missing columns (Lifestyle Squeeze Ratio is in `AssessmentV2Output`;
"Living arrangement" — check `admin-tab.ts` for a source; if none
exists, render the column with empty cells and add it to the LA15-style
no-source list in §For Brian rather than inventing data).

**Validation.** Browser: a fresh assessment's admin tab shows both
scaffolds with full headers + empty year rows; the awarded throwaway
(Epic 14's) still shows its real rows merged in. Screenshots.
Unit-test the year-spine derivation.

---

### X1 · Sent-emails log + view · M · `feature/e15-x1-sent-emails`

**Requirement (CI-02, D15-3, LA15-8).** Charlotte can see what the
system has sent.

**Steps.**
1. Additive migration: `email_log` table (id, createdAt, toEmail,
   templateType?, subject, status `SENT|FAILED|SKIPPED`, resendId?,
   applicationId?, contactId?, sentBy?) — **RLS policies in the same
   migration** (admin/staff read, no client write — service/server
   writes only; follow the patterns in migrations `20260519163000` /
   `20260710205004`).
2. Write best-effort from all three senders in `send.ts` (never let a
   log failure fail a send); capture the Resend id on success.
3. Admin page `/emails` (nav under the comms/contacts group): reverse-
   chron table (when · to · template/subject · status), filter by email,
   pagination per the audit-page pattern. Label honestly: "records
   messages sent by the system from 21 Aug 2026" (no backfill).
4. Optional if cheap: the Resend webhook updates status
   (delivered/bounced) by resendId — nice, not required.
5. Tests: sender logging (success/failure/skip paths — extend
   `send.ts`'s suites with a mocked prisma), page query unit test.

**Validation.** Browser: trigger a real send on nonprod (invitation to a
throwaway), row appears with SENT; a skipped-template send logs SKIPPED.
Migration verified applied. Screenshots. RLS spot-check: anon/applicant
role sees nothing (query via MCP).

---

### X2 · No-send invitations + BCC · M · `feature/e15-x2-comms-controls`

**Requirement (CI-03/04/05, LA15-9/10).**

**Steps.**
1. CI-04: "Create invitation **without sending**" option on both invite
   paths (checkbox "Don't email — I'll send the link myself"): performs
   the same provisioning + Invitation create + audit, skips `sendEmail`,
   and surfaces the registration link (`/register?token=…`) in a
   copy-to-clipboard confirmation (it is already constructable from the
   token — see `registration_link` merge field). The invitation
   otherwise behaves identically (expiry, resend later allowed).
2. CI-05: optional BCC — plumb `bcc?: string` through `sendRawEmail` +
   the bulk wizard (input beside the reply-to display) and — decision
   kept small — ONLY the bulk/raw path; templated transactional sends
   stay bcc-free. Validate as email; pass to `resend.emails.send`.
3. CI-03: no code (LA15-9) — add to §For Brian: set Vercel
   **Preview**-scope `RESEND_REPLY_TO_EMAIL=fees@johnwhitgiftfoundation.org`
   before the first real invitations if replies must land at fees@ from
   day one (staging currently sends with no reply-to).
4. Tests: no-send path creates invitation + logs SKIPPED-style X1 row
   (or no row — decide and test it), never calls Resend; bcc passthrough
   unit test.

**Validation.** Browser: create a no-send invitation → copy link →
register with it (throwaway); bulk wizard accepts + shows bcc.
Screenshots.

---

## 7. Validation & evidence standards (every WP)

Identical to Epic 14 §7, restated short:

1. **Local gates** before any PR: `npx prisma validate` · `npx prisma
   format --check` · `npm run lint` · `npx tsc --noEmit` · `npm test` ·
   `npm run build`.
2. **Tests are part of the WP** — behavioural change → vitest beside the
   code; if a meaningful test is impossible, say why in the PR body.
3. **Browser verification for anything user-visible** — `npm run dev`
   against nonprod, driven via the **Playwright MCP tools**; screenshot
   every acceptance state named in the brief; summarise in the PR body.
   Day-0 WPs additionally verify once against the **staging alias**
   after merge+deploy. Throwaway data only; from 21 Aug the nonprod DB
   contains REAL families — never touch non-throwaway records; clean up
   (no `auditLog` deletes).
4. **Migrations** — `prisma migrate dev` locally; additive; RLS for new
   tables in the same PR; post-merge confirm on nonprod (`db-push.yml`
   green + `list_migrations` via MCP).
5. **Merged = evidence recorded** — PR body says what was validated and
   how; `epic-15-progress.md` row updated; anything for Brian/Charlotte
   appended, never dropped.
6. **CI is the authority** while schema PRs are in flight (worktree
   Prisma-client hazard).

## 8. Post-merge follow-ups this plan already knows about

Collect in `epic-15-progress.md` §For Brian as they become live:

- Brian: green-light Charlotte after G1/G2/G3 (day-0 gate); Vercel
  Preview `RESEND_REPLY_TO_EMAIL` (X2/CI-03); confirm the Supabase auth
  redirect allowlist if G1 flags it.
- Brian → Charlotte: timeline reply (epic §4); CH-02 = yes; the M5
  "Part 5 vs 6" numbering note; M4's "please re-verify Part 3 with your
  real-data case"; CI-13 no-source columns list (M7) if any; X1's
  "history starts 21 Aug" caveat.
- Staging browser pass of the full assessment path after the train
  merges, before Charlotte's next session.
- The three real applicants' post-assessment **data transfer to prod**
  is explicitly OUT of this sprint — needs its own plan once outcomes
  exist.
- `staging → main` promotion remains **Brian-only**, as always.
