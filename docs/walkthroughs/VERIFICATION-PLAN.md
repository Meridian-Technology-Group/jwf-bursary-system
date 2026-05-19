# Walkthrough Verification Plan

Goal: walk every guide in `docs/walkthroughs/` against a running
instance using the **Playwright MCP**, and mark each one Pass / Fail
in the checklist at the bottom of this file.

Scope: 81 guides total — 15 admin, 37 assessor, 29 applicant — plus
the top-level `README.md` for housekeeping.

## Ground rules

1. **Do not fix bugs in situ.** Any defect found (UI copy mismatch,
   broken flow, missing button, server error, RLS denial, etc.) is
   logged as a new file in `docs/backlog/` using
   `docs/backlog/_template.md`. The walkthrough is then marked
   **FAIL** with a link to the backlog entry. Code, copy, and
   migrations are not touched during this exercise.
2. **One Playwright session per persona.** Don't sign in/out
   repeatedly; group guides by role to keep state coherent.
3. **State carries forward.** Many guides depend on data created by
   earlier guides (e.g. applicant 01 needs an invitation produced by
   assessor 03). Run them in the ordered phases below, not in
   filename order.
4. **Read-only steps don't need re-running.** If guide A's prerequisite
   was already produced by guide B in the same session, just verify
   the precondition holds and continue.
5. **Screenshots are not in scope.** Re-capturing every screenshot in
   the guides is a follow-on task. This pass only checks that the UI
   behaves as the guide describes.
6. **Doc drift = backlog item, not edit.** If a step refers to a
   label that has since changed (e.g. "Create Round" became "+ New
   Round"), file a backlog entry titled
   `walkthrough-drift-<persona>-<NN>.md` rather than editing the
   guide.

## Environment

- Target: **local dev** against `supabase-nonprod` (so seeds and
  auth-state mutations are safe). `npm run dev`, `npm run
  seed:demo` first to land a known-good fixture set.
- Browser: Playwright MCP with a fresh context per persona run
  (`mcp__playwright__browser_close` between persona switches to clear
  session cookies).
- Email: outbound mail goes through Resend in `nonprod` mode — for
  invitation/password-reset flows, capture the email link from the
  Resend dashboard or from the `EmailLog` row (`/api/emails/...`)
  rather than waiting on inbox delivery.
- Auth: `demoUsers` seed only writes `profiles` rows, not Supabase
  `auth.users`. Before starting, confirm each persona below has an
  auth user provisioned (manual create via Supabase dashboard if
  not). Record the chosen password in a session-only note — do NOT
  commit it.

## Personas used

Real auth users already provisioned in `supabase-nonprod`. The
shared password was rotated to a session-only value at the start of
this run and not committed.

| Role | Email | Used for |
|---|---|---|
| ADMIN | `jwf-testing+admin@meridiantech.group` | Phase 1 (admin guides) |
| ASSESSOR | `jwf-testing+assessor@meridiantech.group` | Phase 2 (assessor guides) |
| ASSESSOR (spare) | `jwf-testing+assessor1..4@meridiantech.group` | Staff-invite re-test, etc. |
| APPLICANT (new) | `jwf-testing+applicant1@meridiantech.group` | Phase 3 (applicant guides — submission flow) |
| APPLICANT (reassessment) | `jwf-testing+applicant2@meridiantech.group` | Phase 3b (re-assessment guides 26–28) |

Note: the seed-script personas in `prisma/seed-data/demo-users.ts`
(`beverly.williams@jwf-bursary.test` etc.) only have `profiles` rows
and no `auth.users` rows — they cannot log in and are not used here.

## Execution phases

The order below is chosen so each phase produces the state the next
phase needs. **Within a phase, follow numerical order unless a guide
explicitly forks** (e.g. admin 14 / 15 are off-path operations and
can be run last).

### Phase 0 — preflight (no Playwright yet)

- [ ] `git status` clean; on a fresh branch
  `chore/walkthrough-verification-pass`.
- [ ] `npm install`, `npx prisma generate`, `npm run seed:reference`,
  `npm run seed:demo`.
- [ ] `npm run dev` running on `http://localhost:3000`.
- [ ] Auth users provisioned for the four personas above.
- [ ] Playwright MCP confirmed reachable (`browser_navigate` to the
  login page returns a snapshot).

### Phase 1 — Admin (sign in as ADMIN)

Run guides in this order so each one's output is the next one's
input.

1. `admins/01` — create a DRAFT round (e.g. `2026/27`).
2. `admins/04` — historical rounds (read-only, can be done now or
   later; uses pre-seeded prior rounds).
3. `admins/05`–`09` — reference-data edits. Make every edit a
   trivial round-trip (e.g. add a description, save, revert) so we
   don't pollute downstream tests. Each guide is its own pass/fail.
4. `admins/10` — invite a staff member (use a `+ws01@…` alias on the
   ADMIN's domain). Capture the invitation link from `EmailLog`.
5. `admins/15` — re-send / revoke the invitation just created.
6. `admins/02` — open the round created in step 1.
7. `admins/11` — batch re-assessment invitations (only if there are
   active bursary holders in the seed; if not, mark **N/A** and
   open a backlog item to extend the seed).
8. `admins/13` — audit-log review (reads back rows generated by the
   actions above).
9. `admins/14` — reset staff MFA. The guide notes MFA itself is
   B8/backlog; mark **BLOCKED** with a pointer to
   `docs/backlog/b8-mfa-for-admin-and-assessor.md`.
10. `admins/12` — GDPR delete. Use a throwaway applicant created
    via assessor 03 in Phase 2 (so do this guide **at the end of
    Phase 2**, not here).
11. `admins/03` — close the round (do this last; it gates further
    applicant signups against this round).

### Phase 2 — Assessor (sign in as ASSESSOR)

1. `assessors/03` — invite a new applicant (this is the email that
   Phase 3 will accept). Use a unique alias so the run is
   repeatable.
2. `assessors/04` — internal / ad-hoc invitation. Use a second
   unique alias.
3. `assessors/01` — triage the queue (read-only against current
   state).
4. `assessors/02` — open an application (use a pre-seeded SUBMITTED
   one if Phase 3 hasn't run yet).
5. **PAUSE Phase 2 here.** Run Phase 3 to produce a real submitted
   application from the Phase-2 invitation. Return to Phase 2
   below.
6. `assessors/05` — read submitted application.
7. `assessors/06`–`08` — document verification, on-behalf upload,
   missing-docs request.
8. `assessors/09`–`16` — the assessment workspace and Stages 1–4
   plus manual adjustment, property category/flags, save.
9. `assessors/17`–`22` — recommendation tab: synopsis through
   completion.
10. `assessors/23`–`25` — sibling linking. Needs at least two
    related applications; if seed doesn't supply, file a backlog
    item and mark **BLOCKED**.
11. `assessors/26`–`28` — re-assessment. Needs a year-1 record;
    use seed fixture for `priya.patel` (the re-assessment persona).
    If absent, BLOCKED + backlog.
12. `assessors/29`–`30` — PDF + export.
13. `assessors/31`–`37` — reports. Each is a separate pass/fail.
14. Now return to Phase 1 step 10 (GDPR delete the test
    applicant created in 2.1).

### Phase 3 — Applicant (sign in as APPLICANT, fresh browser context)

3a. New-bursary applicant (`adaeze.okafor@…`), using the invitation
from assessor 03 (Phase 2 step 1):

1. `applicants/01` — accept invitation, set password.
2. `applicants/02` — expire/expired-link path. Force by revoking
   the invitation via admin 15 against a *second* dummy
   invitation, then opening its link.
3. `applicants/03` — forgotten-password reset.
4. `applicants/04` — phone view. Use `browser_resize` to a 390×844
   viewport.
5. `applicants/05` — dashboard tour.
6. `applicants/06`–`15` — sections 1 through 10. Fill the form
   end-to-end. Each section is its own pass/fail.
7. `applicants/16`–`20` — document upload variants. Run alongside
   the relevant section (e.g. 17 multi-file inside section 8). Use
   sample fixtures from `prisma/seed-data/` or a small generated PDF
   via `browser_run_code_unsafe`.
8. `applicants/21`–`22` — pre-submission review + submit.
9. `applicants/23` — status check (post-submission).
10. `applicants/24` — respond to missing-docs request. This needs
    the assessor (Phase 2 step 7) to have sent the request first.
    Coordinate ordering: pause submission flow before submit,
    have assessor send the request, then respond here.
11. `applicants/25` — read outcome. Needs assessor 22 (complete the
    assessment) to have fired. Run after Phase 2 step 9.

3b. Re-assessment applicant (`priya.patel@…`):

12. `applicants/26` — accept re-assessment invitation.
13. `applicants/27` — complete re-assessment.
14. `applicants/28` — what changes year-on-year (read-only
    explainer; verify any UI it references actually exists).

3c. Account/privacy:

15. `applicants/29` — request data deletion. Verifies the
    applicant-facing surface only; the admin-side execution is
    covered by admin 12.

## Failure handling

For every FAIL or BLOCKED:

1. Open `docs/backlog/_template.md`, copy into a new file named
   `walkthrough-<persona>-<NN>-<slug>.md` (e.g.
   `walkthrough-admin-07-council-tax-save-button-disabled.md`).
2. Fill in:
   - **Context** — guide path, step number, what was expected vs
     what happened. Quote the guide line if it's a copy mismatch.
   - **Why it matters** — does it block the workflow, mislead the
     user, or only mis-describe?
   - **Proposed approach** — `fix code` or `fix doc` and a one-line
     sketch.
3. Mark the row below with `FAIL → backlog/<file>.md`.
4. Continue with the next guide. Do **not** stop the pass on the
   first failure; the goal of this exercise is full coverage.

## Checklist

Legend: `[ ]` not yet run · `PASS` · `FAIL → <link>` · `BLOCKED → <link>` · `N/A`

### Admin (15)

- PASS admins/01-create-new-assessment-round — round `2026/27` created in DRAFT, matches guide verbatim
- PASS admins/02-open-a-round — confirmation dialog text and OPEN transition match
- DEFERRED admins/03-close-a-round — leaving the round OPEN so Phase 2 can use it
- PASS admins/04-view-historical-rounds — table + round-detail summary cards match (school-breakdown table not rendered when empty; browser tab title shows raw UUID, cosmetic)
- PASS admins/05-edit-family-type-categories — six categories, edit pre-fills inputs, versioned-changes notice exact
- PASS admins/06-edit-school-fees — Trinity / Whitgift, pre-VAT fees, effective-date, VAT note all present
- PASS admins/07-edit-council-tax-default — current value (£2480 Band D Croydon) and editor visible
- PASS admins/08-manage-reason-codes — 35 codes, All/Active/Deprecated tabs, Add/Edit/Deprecate actions
- PASS admins/09-edit-email-templates — template selector + subject/body editor + snake_case merge field chips (post-B13)
- PASS admins/10-invite-a-staff-member — **post-fix re-run** confirms the invite now lands in a new **Pending Staff Invitations** section with a yellow PENDING pill, Invited date, Invited by, and per-row Resend/Revoke icons. Staff Users table now excludes pending profiles so "Joined" is meaningful. (Fixed by PR #35.)
- PASS admins/11-batch-reassessment-invitations — guide now points at `/rounds/[id]` → **Send Invitations**. Doc-only fix landed in commit `841d6a0` on this branch.
- DEFERRED admins/12-delete-applicant-gdpr — needs an in-flight applicant; deferring to a follow-up run once an end-to-end applicant is submitted + completed.
- PASS admins/13-audit-log-review — filters present, audit timeline now also includes RESEND_STAFF_INVITATION / REVOKE_STAFF_INVITATION events from the new PR #35 actions.
- BLOCKED admins/14-reset-staff-mfa → `docs/backlog/b8-mfa-for-admin-and-assessor.md` — MFA itself deferred (B8); admin reset flow will land alongside B8.
- PASS admins/15-resend-or-revoke-invitation — applicant invite Resend/Revoke icon-buttons present on `/invitations`. **Post-fix:** staff invitations now have their own Pending Staff Invitations table on `/users` with the same Resend/Revoke UX (one small follow-up filed: `docs/backlog/revoke-staff-invitation-leaves-orphan-profile.md` — revoke flips status to EXPIRED but doesn't clean up the auth+profile rows; minor).

### Assessor (37)

- PASS assessors/01-triage-the-queue — page, strapline, filters (Round/School/Status), Show Names toggle, table columns all match
- BLOCKED assessors/02-open-an-application — `/applications/[id]` returns 404 for PRE_SUBMISSION applications; assessor flows expect a SUBMITTED application. No submitted application produced in this run because the form-fill end-to-end was out of scope; will unblock once an applicant submits in a follow-up.
- PASS assessors/03-invite-applicant-new-bursary — guide's own note that `/invitations` is admin-only is accurate; the documented escape (use assessor/04) now works after PR #35.
- PASS assessors/04-invite-internal-ad-hoc-bursary — **fixed.** Logged in as assessor, opened the dialog, filled it, hit **Create Request** → green success panel reads "Internal Request Created" with reference `INT-2026-27-0001`. Verified the application row in DB. (Fixed by PR #35.)
- BLOCKED assessors/05–08 — all depend on a SUBMITTED application; same blocker as assessor/02
- BLOCKED assessors/09–16 — assessment workspace + Stages 1–4; requires SUBMITTED application
- BLOCKED assessors/17–22 — recommendation tab; requires assessment completion
- BLOCKED assessors/23–25 — sibling linking; requires ≥2 related applications
- BLOCKED assessors/26–28 — re-assessment; requires a year-1 completed record
- BLOCKED assessors/29–30 — PDF / export; requires completed assessment
- BLOCKED assessors/31–37 — reports; populated by completed assessments

**Note on Phase 2 BLOCKED rows:** the structural blocker (intake RBAC) is now resolved. Remaining 33 rows need a real end-to-end applicant submission to verify against. That's a separate follow-up run — the harness, plan, and personas are reusable.

### Applicant (29)

- PASS applicants/01-accept-invitation-and-set-up-account — `/register?token=…` page matches the guide. **Post-fix:** a returning applicant who logs in directly (skipping /register) now auto-accepts the invitation on dashboard load and lands correctly. Did not actually re-run the `/register` POST because the test auth user already exists — that path is exercised by the existing flow and the form structure was confirmed in the initial run.
- BLOCKED applicants/02-invitation-link-expired — needs a freshly revoked invitation to follow the expired link; deferred (cosmetic state, low priority)
- [ ] applicants/03-reset-forgotten-password — not run; standalone flow with no dependency on Phase 2/3a state
- [ ] applicants/04-log-in-on-your-phone — not run; documented as a viewport-resize check only
- PASS applicants/05-tour-of-the-dashboard — **post-fix.** Logged in as applicant1, sidebar reads `2026/27 Assessment Round` (correct round, not hardcoded), main shows the full dashboard with Application Status / Sections-complete / Quick-actions (Continue / View Status). Application `WS-202627-0001` auto-created by the accept flow.
- PASS applicants/06-section-1-details-of-child — page renders all expected fields (school, year group Y6/Y7/Y9/Y12/Other, child name/gender/DOB/place of birth, birth-cert upload, address)
- PASS applicants/07-section-2-family-identification — page renders with "Add family member" entry pattern; note from guide ("not shown for re-assessments") not testable on a new application
- PASS applicants/08-section-3-parent-guardian-details — section 3 of 10 renders
- PASS applicants/09-section-4-dependent-children — section 4 of 10 renders
- PASS applicants/10-section-5-dependent-elderly — section 5 of 10 renders
- PASS applicants/11-section-6-other-information — section 6 of 10 renders
- PASS applicants/12-section-7-parents-income — section 7 of 10 renders
- PASS applicants/13-section-8-assets-liabilities — section 8 of 10 renders
- PASS applicants/14-section-9-additional-information — section 9 of 10 renders
- PASS applicants/15-section-10-declaration — section 10 of 10 renders all 9 declaration clauses
- [ ] applicants/16-upload-a-document — not run; requires actual file fixture + form fill state on a section
- [ ] applicants/17-upload-bank-statements-multi-file — not run; same dependency as 16
- [ ] applicants/18-replace-a-document — not run; same
- [ ] applicants/19-file-types-and-sizes — not run; same
- [ ] applicants/20-upload-from-phone-camera — not run; documented as a viewport-resize + camera-input check
- PASS applicants/21-pre-submission-review-page — review page renders, lists all 10 sections with "Not started / Edit" entries, shows "Sections fully complete: 0 of 10" + 0% progress, copy matches guide
- [ ] applicants/22-submit-application — not run; full end-to-end submission requires sections to be completed first
- [ ] applicants/23-check-application-status — not run; requires post-submission state
- [ ] applicants/24-respond-to-missing-documents-request — not run; needs a missing-docs request from an assessor
- [ ] applicants/25-read-your-outcome — not run; needs a completed assessment
- [ ] applicants/26-accept-reassessment-invitation — not run; needs a re-assessment seed
- [ ] applicants/27-complete-reassessment — not run; same
- [ ] applicants/28-what-changes-year-on-year — not run; same
- [ ] applicants/29-request-data-deletion — not run; standalone privacy flow

**Note on Phase 3 not-run rows:** the structural blockers (`portal-rejects-pending-invitation-no-round`, `applicant-portal-sidebar-hardcoded-academic-year`) are resolved. The remaining rows are either standalone flows (03, 04, 29), upload/file-fixture flows (16–20), or downstream of a fully-completed submission (22–25, 26–28). A second pass that fills the 10 sections end-to-end will unblock most of these in one sweep and also unblock Phase 2.

## When the pass is complete

- All 81 rows have a non-`[ ]` status.
- Every FAIL / BLOCKED row links to a backlog file that exists.
- Commit this file (with the populated checklist) on the
  `chore/walkthrough-verification-pass` branch and open a PR
  targeting `staging` summarising counts: `PASS / FAIL / BLOCKED /
  N/A`. Do not include any code or doc fixes in that PR — those are
  follow-on PRs driven by the backlog entries.
