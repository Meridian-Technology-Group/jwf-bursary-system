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
- FAIL admins/10-invite-a-staff-member → `docs/backlog/walkthrough-admin-10-pending-invitation-not-visible.md` — invite is created in `staff_invitations` but the UI shows no "Pending" badge, no auto-refresh, and the row's Joined date is misleadingly today's date
- FAIL admins/11-batch-reassessment-invitations → `docs/backlog/walkthrough-admin-11-batch-reassess-wrong-location.md` — feature exists but on `/rounds/[id]`, not `/invitations` as the guide states; doc-only fix
- DEFERRED admins/12-delete-applicant-gdpr — needs a Phase-2-created applicant; will run at end of Phase 2
- PASS admins/13-audit-log-review — filters present, 17-event timeline incl. INVITE_STAFF / CREATE_ROUND / UPDATE_STAFF_ROLE
- BLOCKED admins/14-reset-staff-mfa → `docs/backlog/b8-mfa-for-admin-and-assessor.md` — MFA itself deferred (B8); admin reset flow will land alongside B8
- FAIL admins/15-resend-or-revoke-invitation — applicant invite Resend/Revoke icon-buttons present and titled correctly on `/invitations`; **but** the guide also promises staff invitations appear in the same table — they don't. Backlog: `docs/backlog/walkthrough-admin-10-pending-invitation-not-visible.md` (Related finding section)

### Assessor (37)

- PASS assessors/01-triage-the-queue — page, strapline, filters (Round/School/Status), Show Names toggle, table columns all match; empty state correct
- BLOCKED assessors/02-open-an-application — depends on at least one application existing; no successful intake yet (see assessor/04)
- PASS-WITH-CAVEAT assessors/03-invite-applicant-new-bursary — guide's own note that `/invitations` is admin-only is accurate (assessor is redirected to `/admin`); guide funnels assessor to assessor/04 which is currently broken
- FAIL assessors/04-invite-internal-ad-hoc-bursary → `docs/backlog/walkthrough-assessor-04-internal-request-admin-only.md` — button is shown to assessors but the server action requires ADMIN; submission silently redirects to `/admin` with no row created
- [ ] assessors/05-read-submitted-application
- [ ] assessors/06-verify-uploaded-documents
- [ ] assessors/07-upload-document-on-behalf-of-applicant
- [ ] assessors/08-request-missing-documents
- [ ] assessors/09-set-up-assessment-workspace
- [ ] assessors/10-enter-stage-1-income
- [ ] assessors/11-enter-stage-2-assets
- [ ] assessors/12-stage-3-living-costs
- [ ] assessors/13-stage-4-bursary-impact
- [ ] assessors/14-apply-manual-adjustment
- [ ] assessors/15-property-category-and-flags
- [ ] assessors/16-save-the-assessment
- [ ] assessors/17-build-family-synopsis
- [ ] assessors/18-set-accommodation-income-property
- [ ] assessors/19-record-bursary-award-and-payable-fees
- [ ] assessors/20-select-reason-codes
- [ ] assessors/21-write-recommendation-narrative
- [ ] assessors/22-complete-the-assessment
- [ ] assessors/23-link-siblings
- [ ] assessors/24-reorder-sibling-priority
- [ ] assessors/25-break-sibling-link
- [ ] assessors/26-open-a-reassessment
- [ ] assessors/27-compare-against-year-1-benchmark
- [ ] assessors/28-reassessment-reason-codes
- [ ] assessors/29-generate-pdf-for-application
- [ ] assessors/30-export-recommendation-list
- [ ] assessors/31-round-summary
- [ ] assessors/32-bursary-awards
- [ ] assessors/33-income-distribution
- [ ] assessors/34-property-category-distribution
- [ ] assessors/35-reason-code-frequency
- [ ] assessors/36-active-bursaries-final-year
- [ ] assessors/37-sibling-bursary-summary

### Applicant (29)

- [ ] applicants/01-accept-invitation-and-set-up-account
- [ ] applicants/02-invitation-link-expired
- [ ] applicants/03-reset-forgotten-password
- [ ] applicants/04-log-in-on-your-phone
- [ ] applicants/05-tour-of-the-dashboard
- [ ] applicants/06-section-1-details-of-child
- [ ] applicants/07-section-2-family-identification
- [ ] applicants/08-section-3-parent-guardian-details
- [ ] applicants/09-section-4-dependent-children
- [ ] applicants/10-section-5-dependent-elderly
- [ ] applicants/11-section-6-other-information
- [ ] applicants/12-section-7-parents-income
- [ ] applicants/13-section-8-assets-liabilities
- [ ] applicants/14-section-9-additional-information
- [ ] applicants/15-section-10-declaration
- [ ] applicants/16-upload-a-document
- [ ] applicants/17-upload-bank-statements-multi-file
- [ ] applicants/18-replace-a-document
- [ ] applicants/19-file-types-and-sizes
- [ ] applicants/20-upload-from-phone-camera
- [ ] applicants/21-pre-submission-review-page
- [ ] applicants/22-submit-application
- [ ] applicants/23-check-application-status
- [ ] applicants/24-respond-to-missing-documents-request
- [ ] applicants/25-read-your-outcome
- [ ] applicants/26-accept-reassessment-invitation
- [ ] applicants/27-complete-reassessment
- [ ] applicants/28-what-changes-year-on-year
- [ ] applicants/29-request-data-deletion

## When the pass is complete

- All 81 rows have a non-`[ ]` status.
- Every FAIL / BLOCKED row links to a backlog file that exists.
- Commit this file (with the populated checklist) on the
  `chore/walkthrough-verification-pass` branch and open a PR
  targeting `staging` summarising counts: `PASS / FAIL / BLOCKED /
  N/A`. Do not include any code or doc fixes in that PR — those are
  follow-on PRs driven by the backlog entries.
