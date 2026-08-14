---
title: "Epic 13 — UAT feedback, August 2026 (Charlotte)"
status: open
severity: high
area: portal, assessment, uploads, references, deadlines
opened: 2026-08-14
opened_by: Brian Wagner (source: Charlotte Perrier, 7 emails, 2026-08-13)
related:
  - ../../client-feedback/2026-08-13-charlotte-feedback.md
  - Gmail threads 19f4c3dbcb32ca24, 19f6bc803f005771, 19ffab125e22978b, 19ffac63225c97e4
---

# Epic 13 — UAT feedback, August 2026

All changes (bug fixes and requests) arising from Charlotte's applied-testing
feedback of 2026-08-13. Item IDs (`CF-*`) refer to the catalogue in
[`docs/client-feedback/2026-08-13-charlotte-feedback.md`](../../client-feedback/2026-08-13-charlotte-feedback.md),
which carries the Gmail message pointers for in-thread replies.

## Goal & success criterion

Charlotte can **complete and submit** her real-data test application
(test3@…), then run a **full assessment end-to-end** on it — including a
divorced/separated two-parent case with a manual income adjustment — and
reopen/amend a completed assessment. That is the gating path to go-live.

Critical path: **Wave A unblocks her submission** and should ship first,
independently of everything else.

## Decisions (locked 2026-08-14, Brian)

| # | Decision |
|---|---|
| D13-1 | **Reference becomes a non-unique label.** Drop `@unique` on `Application.reference` and the raw `lower(reference)` unique index; identity stays on the internal UUID. Reference must be editable to *anything* (hard requirement: must match the external fees system, e.g. `TS-SMITH05-Smith, Bob`). Default generated format for NEW applications: `{Child first last} – {School name} – {Year group} – {Academic year}` (e.g. `Bob Smith – Trinity School – Year 6 – 2027-28`). Child name displayed alongside the reference on all admin surfaces. (CF-04 + Charlotte's 09 Jul ask.) |
| D13-2 | **Assessment reopen: allowed until an outcome is set.** "Reopen assessment" (ADMIN + assigned assessor) flips COMPLETED → IN_PROGRESS with an audit entry; blocked once an outcome/award has gone out. Existing recommendation is marked stale and must be re-confirmed; account close is reverted automatically on reopen. (CF-01/02/10.) |
| D13-3 | **Assessor edit scope = adjustment line, not per-field overrides.** Port the v1 `manualAdjustment` + mandatory `manualAdjustmentReason` into the calc-v2 form as an income adjustment line. Covers the divorced/separated parent-2 add-on spec (CF-07); calculated cells stay derived. Per-field overrides explicitly out of scope. |
| D13-4 | **Strict one-time submission PDF.** Remove the applicant History page and all on-screen answer browsing; the submission PDF is downloadable **once, at submission**, then never again (consumed-flag state). (CF-27.) |
| D13-5 | **Remove the legacy "Set Qualifies" / "Set Does Not Qualify" buttons.** They write the schema-documented vestigial `AssessmentOutcome.QUALIFIES` path and duplicate the live 3-way decision in the v2 recommendation form. Supersedes the CP10 "Set Qualifies" staging-pass item. (CF-03.) |
| D13-6 | **Uploads move to presigned direct-to-Supabase.** The 413 (CF-14) is Vercel's ~4.5 MB request-body cap, below the app's advertised 20 MB; routing file bytes through the API can't be fixed by config. |
| D13-7 | **Autosave built on the existing `saveSectionDraft` primitive** (validation-skipping draft upsert, currently dead code) + debounced client writer + dirty-navigation guard; sidebar raw `<a href>` links converted to guarded client-side nav. (CF-15/16/19/22/29.) |
| D13-8 | **Deadlines become application-type-aware on the Round**: `defaultSubmissionDeadline` splits into a rolling-over deadline and an editable new-applications deadline; the 3-tier resolver (`app override → round default → round close`) gains the type branch. Invitation email `{{deadline}}` semantics fixed (today it is the invitation-token expiry, now+30d — not the submission deadline). (CF-11/12.) |

## Corrections to feed back to Charlotte (no build needed / misdiagnosed)

- **CF-23 (year of entry)**: the field was already removed from the parent
  form (Epic 02 PR-6, D1 — locked admin-side at invite) and is `.optional()`
  in the schema, so it cannot block the tab. The "–" on the review page is a
  read from the wrong source (`apply/review/page.tsx:139` reads the legacy
  section blob instead of `Application.entryYear/entryYearGroup` like
  `application-summary.ts` already does) — small fix, WP-A6. Her actual
  Details-of-the-Child blocker is almost certainly the birth-certificate
  upload failing (CF-14): `BIRTH_CERTIFICATE` is the tab's only
  `requiredAlways` document rule.
- **CF-08 (parent-2 savings/debts/cars excluded)**: already the current
  behaviour — `AssessmentProperty` prefills assets/debts/transport solely
  from the primary contact's ASSETS_LIABILITIES section. Verified, no change.
- **CF-11 (where is the deadline editable?)**: a per-round submission
  deadline **is** editable today (round create/edit dialogs + per-application
  override card); the confusion is the invitation email injecting token
  expiry as "{{deadline}}" — fixed under WP-E1.

## Work packages

### Wave A — Unblock submission (critical path, ship first)

| WP | CF | Change | Key code |
|---|---|---|---|
| **A1** | CF-14, CF-20, CF-24 | Presigned direct-to-Supabase uploads; keep server-side magic-byte sniff + `Document` row creation via a confirm endpoint. Fix client error handling that assumes a JSON body on platform errors. Investigate CF-20 (re-upload error after data loss) and CF-24 (passport rejection for family member) once the transport is fixed — both are plausibly the same 413/limit surface. | `src/app/api/documents/route.ts`, `src/components/portal/file-upload.tsx:150-174`, `src/lib/uploads/accepted-types.ts:44` |
| **A2** | CF-13 | Remarried-question logic per Charlotte's matrix (rows = relationship status, cols = sole-parent Y/N): Single/Widowed/Separated/Divorced → ask in both; Married/Civil-Partnership/Cohabiting → ask only when sole-parent = YES. Remove the auto-generated sentence "if so we assess your current household together…". | parent/guardian section form + `src/lib/household/rules.ts` inputs |
| **A3** | CF-17 | Cohabiting must validate the same as Married on the parent/guardian step (currently blocks progression). | section schema/validation for parent details |
| **A4** | CF-21 | Zero-income path: £0.00 + all "no income in the assessed tax year" boxes ticked must progress. | income section schema + document rules |
| **A5** | CF-18 | Number-entry fix (select-0-on-focus, no leading-zero accumulation) applied to **parent 2's** fields — currently parent-1 only. | income section inputs |
| **A6** | CF-23 | Review page reads year-of-entry from `Application.entryYear/entryYearGroup` (align with `application-summary.ts:124-147`). | `src/app/(portal)/apply/review/page.tsx:139-140` |
| **A7** | CF-25 | Submission failure shows a plain "your application can't be submitted yet" message — no internal query/diagnostic detail. | submit action error surface |
| **A8** | CF-31 | Add "please contact the bursary team by email at fees@johnwhitgiftfoundation.org" to the relevant guidance copy. | portal copy |

### Wave B — Data safety (the compound data-loss bug)

| WP | CF | Change | Key code |
|---|---|---|---|
| **B1** | CF-15, CF-16, CF-19, CF-22 | Sidebar tabs: raw `<a href>` → client-side nav with a dirty-state guard (save-or-confirm before leaving). Investigate the "kicked out" error she hit after completing parent/guardian (session/timer question — none exists in code; likely an unhandled action error; reproduce and fix). Fix income tab showing disabled after re-login. | `src/components/portal/portal-sidebar.tsx:199`, `src/components/portal/section-form.tsx` |
| **B2** | CF-29 | Autosave: debounced draft writes via the existing `saveSectionDraft` action (skips Zod, `isComplete=false`); visible "saved/unsaved" indicator; drafts restored on return. Decide draft-vs-complete interaction with the stepper status. | `src/app/(portal)/apply/actions.ts:290-330` (existing, uncalled) |

### Wave C — Assessment editability & references

| WP | CF | Change | Key code |
|---|---|---|---|
| **C1** | CF-10, CF-01 | **Reopen assessment** (D13-2): add `COMPLETED → IN_PROGRESS` to `ASSESSMENT_TRANSITIONS`; writer + `ASSESSMENT_REOPENED` audit action; gate on "no outcome set"; mark recommendation stale (must re-confirm before outcome); revert `closeAccountIfComplete` effects on reopen (note `Application.closedAt` is currently documented set-once — needs a deliberate exception). Button visible to ADMIN + assigned assessor. Note the current lock is client-side only (`isReadOnly`, `assessment-form-v2.tsx:244`); add a server-side status guard to `saveAssessmentAction` at the same time so the lock is real when it applies. CF-01's "incorrect auto-entered information" = prefill values she couldn't correct because of the lock; verify with her data after reopen ships. | `src/lib/applications/status.ts:174-178`, `src/app/(admin)/applications/[id]/assessment/actions.ts:282-386` |
| **C2** | CF-02, CF-07 | **v2 manual income adjustment line** (D13-3): amount + mandatory reason, added to household income after earner aggregation; shown in the recommendation snapshot and PDF. Fields already exist on `Assessment` (`manualAdjustment`, `manualAdjustmentReason`) — wire into v2 form, `calculateHouseholdNetIncome`, snapshot, and exports. Primary use: divorced/separated parent-2 income add-on per the E3 spec (CF-05/06/09 verified against `src/lib/household/rules.ts` — behaviour already matches; the adjustment line is the missing piece). | `src/components/admin/assessment-form-v2.tsx`, `src/lib/assessment/v2/income.ts:83-86` |
| **C3** | CF-03 | Remove "Set Qualifies"/"Set Does Not Qualify" buttons + confirm dialog; retire the `setOutcome(QUALIFIES)` path; update the two user guides that document them. Outcomes remain solely via the v2 recommendation form's 3-way decision. | `src/components/admin/application-actions.tsx:313-337`, `docs/guides/admin-assessor-guide.md:279`, `docs/guides/walkthroughs/assessors/02-open-an-application.md:32` |
| **C4** | CF-04 | **Reference model** (D13-1): migration dropping `@unique` + the `lower(reference)` index; new NEW-application default format `{Child} – {School} – {Year group} – {Academic year}`; ROLLING_OVER keeps carrying the existing reference forward; child name displayed next to reference in admin table, application header, assessment header, exports, and outcome emails. Keep `validateReferenceInput` non-blank-only. Check the search box and XLSX export still behave with duplicate references (all joins are on UUID — verified no FK usage). | `src/lib/applications/reference.ts:21-34`, `src/components/admin/application-table.tsx:892`, `prisma/schema.prisma:138` |

### Wave D — Portal content & document requirements

| WP | CF | Change | Key code |
|---|---|---|---|
| **D1** | CF-27 | **Strict one-time PDF** (D13-4): remove the History nav item + `/history` page + `loadAccountHistory`; remove the persistent download link on `/submitted`; add a consumed flag (e.g. `Application.submissionPdfDownloadedAt`) checked by the PDF route — one successful download at submission time, 410/gone after. Applicants keep status visibility only. | `src/app/(portal)/history/page.tsx`, `src/components/portal/portal-nav.tsx:115-118`, `src/app/api/pdf/submission/[applicationId]/route.tsx` |
| **D2** | CF-28 | UC uploads: new `minCount` on the document-rule `DocPresence` (or a new rule kind) so `UC_MONTHLY*` requires **3 distinct files** in addition to the `UC_STATEMENT` (4 total); repeat-slot upload UI. **Duplicate detection**: add a content digest column to `Document` (sha-256, computed server-side at confirm), reject/warn when the same digest appears twice in one application. `section-rules.test.ts` pins evaluator behaviour — extend deliberately. | `src/lib/portal/document-rules.ts:172-180`, `src/lib/portal/section-rules.ts:160-183`, `prisma/schema.prisma` Document |
| **D3** | CF-30 | Loan documents: drop "(optional)" from the loan statement; add a new `LOAN_AGREEMENT` slot, **required whenever a loan is declared** (`requiredIfValueGt0` pattern — see open question Q2). | `src/components/portal/sections/assets-liabilities-form.tsx:710-712`, `src/lib/documents/slots.ts` |
| **D4** | CF-32 | Separate REVIEW and SUBMIT: decouple the declaration save from the auto-`submitApplication` call; declaration page gets a distinct SUBMIT button plus a REVIEW button returning to `/apply/review` with no submission prompt; fix the footer/page label disagreement ("Review and Submit" vs "Submit Application"). | `src/app/(portal)/apply/[section]/section-page-client.tsx:447-455`, `src/components/portal/apply-footer.tsx:47` |

### Wave E — Deadlines & invitation email

| WP | CF | Change | Key code |
|---|---|---|---|
| **E1** | CF-11, CF-12 | Type-aware round deadlines (D13-8): `Round.defaultSubmissionDeadline` → two fields (new vs rolling-over), surfaced in the round create/edit dialogs; `effectiveSubmissionDeadline` resolves by `Application.applicationType`; rolling deadline defaulting to the April date. Fix invitation + reassessment templates so `{{deadline}}` is the **effective submission deadline** (token expiry communicated separately or aligned). | `src/lib/rounds/submission-deadline.ts:68-84`, `src/app/(admin)/invitations/actions.ts:135-136,261,369-430`, round dialogs |

## Open questions for Charlotte (fold into the reply emails)

1. **Q1 (CF-23):** confirm the Details-of-the-Child blocker disappears once
   the birth-certificate upload is fixed — year of entry is no longer a
   parent-entered field.
2. **Q2 (CF-30):** is the loan agreement required for *every* applicant, or
   only when a loan/debt is declared? (Epic assumes: only when declared.)
3. **Q3 (CF-27):** confirm she accepts the support consequence of a strict
   one-time PDF: a parent who loses the file cannot re-download and will
   email the bursary team.
4. **Q4 (CF-12):** confirm the rolling-over deadline is a single global date
   per round (next April) rather than per-school.

## Out of scope

- Per-field overrides of calculated assessment cells (D13-3 chose the
  adjustment line; revisit only if Charlotte's testing shows it's not enough).
- Reopening an assessment **after** an outcome is set (D13-2).
- Any change to the H1–H11 household rules engine — E3's spec was checked
  against it and current behaviour already matches (advisory gates, parent-1
  category, parent-2 assets excluded).
- Server-side session timers (none exist; CF-15's "kicked out" is an error
  path to fix, not a timeout to remove).

## Sequencing / PR plan

> **Execution plan:** [`sprint-01-implementation-plan.md`](sprint-01-implementation-plan.md)
> turns the work packages below into an executable sprint — sized board, branch
> names, dependency trains, per-WP acceptance criteria, migration summary, test
> strategy, and a progress tracker. It also records corrections where the code
> disagreed with this epic's diagnosis (`BursaryAccount.reference` stays unique;
> `AuditLog.action` is a String, not an enum; the upload client already guards
> against non-JSON error bodies; the invitation `{{deadline}}` bug has four
> injection sites, not two).

Branch off `staging` per CLAUDE.md; one PR per WP unless trivially small
(A5–A8 can pair up). Suggested order: **A1 → A2–A8 → B1 → B2 → C1 → C2 →
C3+C4 → D1–D4 → E1.** Wave A alone unblocks Charlotte's submission; C1+C2
unblock her assessment test. Schema migrations (C4 reference indexes, D1
consumed flag, D2 digest column, E1 round fields) each ship in the same PR
as their code, additive, with RLS policies where new tables appear (none
planned).
