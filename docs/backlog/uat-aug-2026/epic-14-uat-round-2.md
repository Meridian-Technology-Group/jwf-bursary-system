---
title: "Epic 14 — UAT feedback round 2, August 2026 (Charlotte)"
status: open
severity: high
area: assessment, admin, rounds, portal, email, uploads
opened: 2026-08-16
opened_by: Brian Wagner (source: Charlotte Perrier, 7 emails, 2026-08-16)
depends_on:
  - ./epic-13-uat-feedback.md
  - ./follow-ups.md
related:
  - Gmail messages 1a009b95bcb3ccd2 (Rounds & applications),
    1a009d228c39f4be (RE Application - applied testing feedback),
    1a009d4724d8b0ad (FW Bursary application received — Levi Amoah),
    1a009dd25562a8cf (RE Assessment of TS-202627-0002),
    1a009e2ebb90dc14 (Request Missing Documents),
    1a00a4e5911c9fcd (Testing the assessment model + workbook),
    1a00a63c8286ccab (Invitation emails)
  - source-materials: "ASSESSMENT MODEL REQUIREMENTS 16.08.26.xlsx"
    (attachment on 1a00a4e5911c9fcd — commit a copy to
    docs/backlog/uat-aug-2026/source-materials/ in WP-C0)
---

# Epic 14 — UAT feedback round 2, August 2026

Everything arising from Charlotte's seven emails of **2026-08-16** (her retest
of the Epic 13 Sprint 01 fixes plus her first real pass at the assessment
side). Item IDs `CG-*` are catalogued in §2 below with Gmail message pointers
for in-thread replies.

**Commercial position (Brian, 2026-08-16):** all of this is accepted as
pre-go-live acceptance remediation under the Build Fee — **no change request,
no new scope, no additional payment**. The assessment-workspace items are the
build being reconciled against the scoping workbook Charlotte has now supplied
(closing the long-open "get the latest scoping document and reconcile"
action from `meeting-findings.md`); the rest is UAT feedback. Nothing here
touches the four-stage calculation maths — Charlotte states explicitly in
CG-16: *"I have removed the calculations (they remain the same so there won't
be a change)"* — so MSA 9.3 is not engaged.

## 1. Goal & success criterion

Charlotte can:

1. **Finish her portal retest** — duplicate UC uploads rejected, 60-minute
   timer with extend, the new submit → "download my copy" → home flow — and
   then run **one final application test** before inviting a real family.
2. **Run a full assessment** in a workspace that matches her workbook: plain
   Excel-style tables for parts 1–4, no applicant-figure prefill, bursary
   award tab, assessment admin tab, and an assessments queue separate from
   the applications queue.
3. **See her operating calendar in the product**: the four round scenarios
   with admin-editable dates, and parents seeing a forward
   "Bursary Application Schedule" (per child, multiple children per login)
   instead of a history view.
4. **Send the right words**: five invitation template variants, the
   missing-documents email with her default copy, and parent replies landing
   at `fees@johnwhitgiftfoundation.org`.

Critical path: **Wave A (retest blockers) ships first** — she is days away
from wanting to onboard a real applicant. Wave C (assessment workspace) is
the largest block and gates her assessment sign-off. Waves D/E can land
behind it.

## 2. Item catalogue (CG-*)

| ID | Email (Gmail ID) | Item |
|----|---|---|
| CG-01 | Rounds (1a009b95…) | Four round scenarios (3 × new-application, 1 × rolling-over) with per-scenario academic year, **default tax year**, opening date, submission date; admin tab to edit the dates |
| CG-02 | Rounds | Parent portal shows a forward **Bursary Application Schedule** per child (academic year, school year, opening date, submission deadline, award communication date) with `START APPLICATION` / `LOCKED` / `SUBMITTED` row states; history rows may show as `SUBMITTED` |
| CG-03 | Rounds | New applicants (first application) see **one link only**, not the schedule |
| CG-04 | Rounds | One parent login must hold **multiple bursary recipients** (e.g. three children → three schedules, three applications, one account) |
| CG-05 | Levi Amoah fwd (1a009d47…) | Replies to `bursary@updates.meridiantech.group` must reach `fees@johnwhitgiftfoundation.org` |
| CG-06 | Levi Amoah fwd | Charlotte will reword the confirmation-email copy herself (needs the editable template — exists; no build) |
| CG-07 | Missing docs (1a009e2e…) | Questions: does the request email the parent, which address do they send documents back to, does the email carry the standard greeting or only the personal note? |
| CG-08 | Missing docs | Default subject *"JWF - Your bursary assessment has been paused."* + her default body (missing-items list, return-by date, "send us by email … we will attach them") |
| CG-09 | Retest (1a009d22…) | **UC duplicate detection does not work** — the same file was accepted twice in the UC slots (regression against Epic 13 D2) |
| CG-10 | Retest | Upload progress stalls at ~85% ("as if it was a large document") before completing |
| CG-11 | Retest | Session-expiry warning renders with text overflowing the modal template (cosmetic; behaviour correct) |
| CG-12 | Retest | Idle timer: set to **60 minutes**, warning near expiry, option to extend by a further 60 |
| CG-13 | Retest | Submission PDF: replace the "downloadable exactly once / never again" messaging with a bare flow — SUBMIT → confirmation → optional **DOWNLOAD MY COPY** → portal home. No explanatory text. (Amends the *presentation* of Epic 13 D13-4; the one-download rule itself stands.) |
| CG-14 | TS-202627-0002 (1a009dd2…) | Reopen button verified ✅; outcome section not found — folded into the Wave C IA (the outcome lives on the Recommendation tab today) |
| CG-15 | Assessment model (1a00a4e5…) | Remove applicant-figure **prefill/auto-report** from the assessment ("misleading"); assessor enters everything except the named autofill fields |
| CG-16 | Assessment model | Rebuild the workspace to the attached workbook: tabs **UPLOADED DOCUMENTS DISPLAY / APPLICATION FORM / ASSESSMENT MODEL (1-4) / BURSARY AWARD CALCULATION (5) / ASSESSMENT ADMIN**; plain Excel-style tables; calculations unchanged |
| CG-17 | Assessment model | Terminology: the page is an **ASSESSMENT**, not an application; assessments appear in their own **list of assessments due**; applications-admin and assessments-admin are separate surfaces |
| CG-18 | Assessment model | Header: hide the application "submitted" status block on the assessment view; keep only the bursary reference on the left |
| CG-19 | Assessment model | Collapse the second-parent / GDPR management card under the **MANAGE** button |
| CG-20 | Assessment model | Income: parent 1 and parent 2 as **two columns of one table**, Excel-style, per the scoping layout — not sequential tabs; remove the explanatory copy block |
| CG-21 | Assessment model | Hide the live computation behind a **SEE COMPUTATION** button; move the action buttons up to the tab banner |
| CG-22 | Assessment model | Part 1 table (11 rows) with her exact autofill/manual/hidden markings |
| CG-23 | Assessment model | **Pause** the split-screen documents-left panel; documents move to their own tab (supersedes AE-17 / Epic 06 layout — record as client change of direction, not silent drop) |
| CG-24 | Workbook | ASSESSMENT ADMIN tab: account synopsis, assessor's wizard notes, year-on-year history table, payable-fees schedule with per-year application/assessment/bursary status |
| CG-25 | Workbook | **Real reason-code lists supplied**: 36 year-on-year-change codes + 9 gap-from-recommended codes — closes outstanding client deliverable **D4** |
| CG-26 | Invitations (1a00a63c…) | **Five invitation templates**: new application TS / new application WS / internal application TS / internal application WS / rolling-over ("portal re-opened 12 April, 5–6 weeks to submit"); selectable when a contact / bursary recipient is created |

## 3. Answers & findings to feed back to Charlotte (no build, or shapes the build)

- **CG-04 (multi-child logins)** — *mostly supported already, with a portal
  gap.* One registered parent `Profile` can lead any number of
  `BursaryAccount`s, and `Contact` is deliberately one row **per child** per
  parent (`@@unique([profileId, childName, childDob])`) sharing the same
  email — so "three children, one login, three applications" is the data
  model today. What does **not** exist is the portal UX for it: the portal
  home assumes one active application journey. WP-E2 adds the per-child
  switcher/schedule. Answer to her question: *yes — create one contact per
  child using the same email address; her planned test (second recipient on
  the same parent email) should work for invite/registration today, and the
  portal presentation is being built.*
- **CG-07 (missing-docs mechanics)** — the feature already emails the lead
  applicant (MISSING_DOCS template), pauses the application, and gives the
  parent a **portal respond flow** (`/respond`) — the design intent is that
  documents come back through the portal, not by email. Her drafted copy
  ("send us by email … we will attach them") contradicts that; needs the
  decision in §6 Q2 before the template copy lands (WP-B2).
- **CG-14 (can't find the outcome)** — nothing is broken: outcomes are
  recorded on the **Recommendation** tab after the assessment is saved. The
  Wave C IA gives it an explicit home (`BURSARY AWARD CALCULATION (5)` +
  the recommendation flow); reply so she isn't hunting for it meanwhile.
- **CG-06 (confirmation copy)** — the CONFIRMATION template is editable
  today under Settings → Email Templates; point her at it (or take her
  wording and apply it).
- **Workbook quirk to confirm (low-stakes):** sheet "ASSESSMENT MODEL (1-4)"
  itself contains a *"PART 5 - HOUSEHOLD'S PERSONAL DEBT"* block, while the
  award sheet is also titled *"PART 5 - BURSARY AWARD CALCULATION"*. Epic
  assumes the debt/lifestyle-squeeze block belongs to the model tab (it is
  part 4's continuation) and "5" = the award tab, per her email's tab list.

## 4. User stories

### Theme A — finish the portal retest (Charlotte as applicant-tester)

- **US-A1** As an applicant, when I upload the same file into two Universal
  Credit slots, the second upload is rejected with a clear message, so I
  cannot satisfy the four-document UC requirement with one document.
  *Accept:* same-bytes file rejected across all UC slots of one application;
  distinct files accepted; error names the clashing slot. (CG-09)
- **US-A2** As an applicant, uploads progress smoothly to completion without
  a long stall at ~85%, or — where processing time is genuinely needed — the
  UI says what it is doing, so I don't assume the upload hung. (CG-10)
- **US-A3** As an applicant, I get 60 minutes of inactivity before sign-out,
  a warning before it happens (including in a background tab), and a
  one-click "give me another 60 minutes" extension. (CG-12)
- **US-A4** As an applicant, the session-expiry warning renders correctly
  inside its dialog on all viewports. (CG-11)
- **US-A5** As an applicant, after I press SUBMIT I see: confirmation the
  file was sent → a single **DOWNLOAD MY COPY** button (no warning text
  about it being my only chance) → and I end up back on my portal home.
  *Accept:* the one-download-only rule still holds server-side; the History
  page stays gone; no re-download link anywhere. (CG-13)

### Theme B — email plumbing & copy (Charlotte as bursary office)

- **US-B1** As a parent who hits Reply on any system email, my reply reaches
  the bursary team at `fees@johnwhitgiftfoundation.org`. (CG-05)
- **US-B2** As an assessor requesting missing documents, the email carries
  the agreed default subject and body (with the ticked items and the
  return-by date merged in), and I know exactly how the parent returns the
  documents. (CG-07, CG-08)
- **US-B3** As an admin inviting a family, I pick the situation — new
  application, internal bursary application, or rolling-over — and the right
  one of the five templates (school-specific where applicable) is used.
  *Accept:* five editable templates exist in Settings → Email Templates;
  the invite flow offers the choice at contact/recipient creation and at
  send; school resolves automatically from the contact. (CG-26)

### Theme C — the assessment workspace (Charlotte as assessor)

- **US-C1** As an assessor, I open an **Assessment** (so titled) from a list
  of **assessments due to be completed**, separate from the applications
  queue, and the assessment header shows the bursary reference without the
  application's submission-status block. (CG-17, CG-18)
- **US-C2** As an assessor, the workspace has exactly five tabs:
  **Uploaded Documents Display · Application Form · Assessment Model (1-4) ·
  Bursary Award Calculation (5) · Assessment Admin**. (CG-16)
- **US-C3** As an assessor, the Uploaded Documents tab gives me a filter, a
  listing of all documents, and a viewer for the selected one; the old
  left-hand split panel is retired. (CG-16, CG-23)
- **US-C4** As an assessor, the Application Form tab shows the applicant's
  entire form top-to-bottom (child details → declaration), read-only, with
  each section listing the *titles* of its uploaded documents — not the
  documents themselves. (CG-16)
- **US-C5** As an assessor, the Assessment Model tab opens **empty** except
  for the agreed autofill fields; nothing reports a result until I have
  entered figures. Part 1 is an 11-row table (first name & surname & remaining
  years & annual fees autofilled — fees hidden; year of entry, scholarship,
  three sibling rows, number of schooling-age children manual; family
  category a dropdown). (CG-15, CG-22)
- **US-C6** As an assessor, I enter household income in one Excel-style
  table with **Parent 1 and Parent 2 as two columns**, rows following the
  workbook's employment-status blocks (PAYE / self-employed director /
  sole-trader / benefits / between-roles / retired / separated-divorced /
  third-party support), ending in an auto-summed household overall net
  income row. No commentary text. (CG-20)
- **US-C7** As an assessor, parts 3–4 (notional spend benchmarking; assets,
  debt & lifestyle-squeeze profiling) render as plain tables mirroring the
  workbook rows, with her marked `AUTO FILLED` cells computed and `manual
  fill` cells editable; the running computation is hidden until I press
  **SEE COMPUTATION**; save/complete actions sit in the tab banner.
  (CG-16, CG-21)
- **US-C8** As an assessor, the Bursary Award Calculation tab covers the
  award sheet: sibling fees at JWF schools (three manual rows +
  school selector), annual fees / siblings' net payable fees, actual vs
  theoretical vs affordability-adjusted disposable income, recommended
  payable fees, next-year fees, scholarship %, award summary (scholarship
  value, bursary award value, payable fees next year, academic year,
  school's bursary spend before VAT), gap-from-recommendation with reason
  multi-select, last assessment's payable fees, year-on-year reason
  multi-select, completion date. (CG-16)
- **US-C9** As an assessor, the Assessment Admin tab holds the account
  synopsis, the assessor's-wizard notes ("things to look out for with this
  family"), the year-on-year history table (net income, savings, property
  equity, debt exposure, deltas, living arrangement, lifestyle squeeze), and
  the payable-fees schedule (per year: comments/reason codes, payable fees,
  YoY change, school year, submit-by date, application/assessment/bursary
  status). Populated automatically from prior assessments where they exist.
  (CG-24)
- **US-C10** As an assessor, the year-on-year and gap reason-code pickers
  offer Charlotte's real lists (36 + 9). (CG-25)
- **US-C11** As an admin, the second-parent and GDPR controls sit behind a
  **Manage** button instead of an always-open card. (CG-19)

### Theme D — rounds & scheduling model (Charlotte as admin)

- **US-D1** As an admin, I maintain the four round scenarios — NA current
  round/current year; NA next round/next year (winter window, 10 Nov–11 Apr);
  NA next round/next year (12 Apr–19 Aug); RA next round/next year (12 Apr–
  22 May) — each with academic year, **default tax year**, opening date and
  submission date, on an admin settings surface. (CG-01)
- **US-D2** As an admin, when I invite/start an application the correct
  scenario (and therefore default tax year for the income form, submission
  deadline, and email wording) is derived from the application type and
  today's date, overridable ad hoc for NA rounds. (CG-01)
- **US-D3** As a returning parent, my portal home shows the Bursary
  Application Schedule per child: future years `LOCKED`, the open year
  `START APPLICATION`, past years `SUBMITTED`. Award communication date
  shown per row. (CG-02)
- **US-D4** As a first-time applicant, I see a single "start your
  application" path, not a schedule. (CG-03)

### Theme E — multi-child households (Charlotte as admin; parents)

- **US-E1** As an admin, I can create several contacts (one per child) on
  the same parent email and invite each; the parent registers once. (CG-04)
- **US-E2** As a parent with several children, my portal home lists each
  child's schedule and lets me open/submit each child's application
  independently under one login. (CG-04, CG-02)

## 5. Work packages

Sizes: S ≤ half a day · M ~1 day · L 2 days+.

### Wave A — retest blockers (ship first, this week)

| WP | CG | Size | Change | Key code |
|---|---|---|---|---|
| **A1** | CG-09 | M | Fix duplicate detection: the sha-256 `content_digest` lands (verified in Sprint 01 browser pass) but the **rejection isn't enforced** on the UC slots. Find the gap — most likely the confirm endpoint computes the digest but the duplicate check isn't wired into the UC slot validation, or compares within-slot rather than across an application's UC slots. Enforce at confirm time (server), surface in the upload UI, and add a regression test uploading identical bytes to two UC slots. | `src/app/api/documents/` confirm route, `src/lib/portal/document-rules.ts`, `Document.contentDigest` |
| **A2** | CG-10 | S–M | Diagnose the ~85% stall: progress likely tracks only the browser→storage PUT, then sits while the confirm endpoint sniffs magic bytes + computes the digest. Either stream/hash more cheaply or add an honest "processing…" phase to the progress UI so the pause is explained. | `src/components/portal/file-upload.tsx` progress handling, confirm endpoint |
| **A3** | CG-12 | S | Idle timer to 60 min for applicants; warning modal offers "Stay signed in (+60 min)". Config via the (now-fixed) `NEXT_PUBLIC_SESSION_IDLE_MINUTES`; verify the background-tab warning path from Epic 13 B1 still fires at the new duration. | `IdleLogoutWatcher`, portal layout |
| **A4** | CG-11 | S | Fix the expiry-warning dialog overflow (text escaping the modal, per her screenshot). | session-warning dialog component |
| **A5** | CG-13 | M | Rework the post-submit flow: SUBMIT (existing confirm) → "application sent" state → single `DOWNLOAD MY COPY` button (no scarcity copy) → Continue → portal home. Server one-download rule (`submissionPdfDownloadedAt`) unchanged; declining the download **does not** burn the single download (button simply never shown again after leaving? — no: rule stays "one successful download"; leaving without downloading forfeits per D13-4/Q3 — confirm wording with nothing implying they can come back). Update `/submitted` page + PDF route messaging. | `src/app/(portal)/submitted/`, `src/app/api/pdf/submission/[applicationId]/route.tsx` |

### Wave B — email plumbing & copy

| WP | CG | Size | Change | Key code |
|---|---|---|---|---|
| **B1** | CG-05 | S | Add `replyTo` to every Resend send, from a new `RESEND_REPLY_TO_EMAIL` env (prod value `fees@johnwhitgiftfoundation.org`; nonprod points at a test inbox). This answers the ask directly — replies go to the fees inbox natively, no inbound forwarding infrastructure needed. Note for Brian: true *inbound mail to* `bursary@updates.meridiantech.group` still bounces/black-holes; if Charlotte also wants that mailbox to forward, that's a Resend/DNS inbound-routing task outside the app (tracked, not in this epic). Tell the user before adding the env var per repo CLAUDE.md. | `src/lib/email/send.ts` (3 send sites), env docs |
| **B2** | CG-07, CG-08 | S–M | MISSING_DOCS template: set her default subject + body via a new `*_seed_email_templates`-pattern migration (templates are migration-seeded — single source of truth). Merge fields: ticked-items list, return-by date (both already collected by `MissingDocsDialog`). Copy resolves §6 Q2 (portal respond vs email return) before merge. Standard header/greeting wrapper confirmed in the reply to her CG-07 question. | email-templates seed migration, `missing-docs-dialog.tsx` defaults |
| **B3** | CG-26 | M–L | Invitation template variants: extend `EmailTemplateType` (or add a variant key on `email_templates`) for `INVITATION_NEW_TS`, `INVITATION_NEW_WS`, `INVITATION_INTERNAL_TS`, `INVITATION_INTERNAL_WS`, `INVITATION_ROLLING`; seed all five via migration; Settings → Email Templates lists them. Invite flow: selector for *situation* (new / internal / rolling-over) at contact-create and invite-send; school half resolves from `Contact.school` — propose to Charlotte as 3-way choice rather than raw 5-way picker. Rolling-over invites default to the RA template (ties to D-wave dates for `{{deadline}}`/opening-date merge fields). Keep the existing generic INVITATION as fallback for one release. | `prisma/schema.prisma` enum, seed migration, `src/app/(admin)/invitations/`, contacts create dialog |

### Wave C — assessment workspace rebuild (the workbook)

| WP | CG | Size | Change | Key code |
|---|---|---|---|---|
| **C0** | — | S | Commit the workbook to `docs/backlog/uat-aug-2026/source-materials/assessment-model-requirements-2026-08-16.xlsx` + a field-map md (workbook row → component/engine field). It is the reference for every C-wave acceptance check. | docs only |
| **C1** | CG-17 | M | Terminology + queue: assessment surfaces titled "Assessment"; new **Assessments** nav item + list page (due / in progress / paused / completed / locked; assignee, reference; derives from existing `Assessment.status` — no schema change expected). Applications queue unchanged for application-lifecycle admin. | `src/components/admin/admin-nav.tsx`, new `src/app/(admin)/assessments/page.tsx` |
| **C2** | CG-18, CG-19, CG-21 | M | Assessment chrome: hide the form-status/right-hand header block on assessment routes (keep reference, left); fold the second-parent + GDPR card behind a `Manage` disclosure; move save/complete/pause actions into the tab banner; add `SEE COMPUTATION` toggle wrapping the live calc display (collapsed default). | `applications/[id]/layout.tsx`, `assessment-form-v2.tsx` |
| **C3** | CG-16, CG-23 | L | Five-tab IA inside the assessment: **Uploaded Documents Display** (filter row + document list + inline viewer — harvest from `document-list-client.tsx`; retire the split-screen panel), **Application Form** (read-only full form, per-section uploaded-document *titles*; reuse the applicant-data renderers), **Assessment Model (1-4)**, **Bursary Award Calculation (5)**, **Assessment Admin**. Record formally: supersedes PRD AE-17 split-screen and Epic 06's docs-left layout at client request (CG-23). | assessment route restructure, `split-screen.tsx` retirement |
| **C4** | CG-15, CG-22 | M | Kill applicant-figure prefill: assessor income/asset fields start empty (`prefill.ts` reduced to the sanctioned autofills); delete the "reported from application" display blocks. Part 1 table exactly per workbook: 11 rows, autofill = {first name, surname, remaining years, annual fees(hidden)}; manual = {year of entry, scholarship, siblings 1–3, schooling-age children}; dropdown = family category. Remaining-years + fees autofill stay engine-fed (AE-09/AE-11 unchanged). | `src/lib/assessment/v2/prefill.ts`, form section A |
| **C5** | CG-20 | L | Income as one two-column (P1 · P2) Excel-style table following the workbook's status blocks (unemployed-no-benefits, PAYE, SE-director ×4 rows, SE-partner/sole-trader, benefits ×10 rows, between-roles ×5, retired ×2, separated/divorced ×2, third-party support) with auto household-overall-net-income row. Storage stays the existing per-earner v2 model — this is a **presentation** change; row set must reconcile 1:1 with `v2/income.ts` inputs (any workbook row with no engine input → flag in the C0 field-map, don't invent maths). Remove the explanatory copy block. | form section B, `src/lib/assessment/v2/income.ts` (read-only reference) |
| **C6** | CG-16 | L | Parts 3–4 as plain tables mirroring workbook rows/labels: notional spend benchmarking (family structure selector, notional rent + add-backs, council tax + support add-back, essentials, car / public-transport notionals, JWF recipient allowance, savings adjustment block, school-fees insurance, total deducted notional spend, HNDI-after-NS, income category) and assets/debt/lifestyle (property structure, per-property values & equity, property/equity/financial categories, personal-debt block, Foundation arrears flag, lifestyle-squeeze ratios & status). All computed cells from the existing engine (`notional-spend.ts`, `debt.ts`, `profiling.ts`); `manual fill` cells editable. Engine changes out of scope — presentation + wiring only. | form sections C/D, v2 engine (reference) |
| **C7** | CG-16, CG-14 | L | **Bursary Award Calculation (5)** tab per the award sheet (US-C8 field list), consuming `award.ts` outputs + recommendation flow; sibling-fees rows link to sibling bursary accounts where they exist (manual name + school + fees otherwise). The recorded outcome gets its explicit home here / on the recommendation step — closes her CG-14 confusion. | new tab, `v2/award.ts`, recommendation form |
| **C8** | CG-24 | L | **Assessment Admin** tab: synopsis (reuse `Assessment` synopsis field / F-section), assessor's wizard notes (exists as section F — relocate), YoY history table + payable-fees schedule rendered from prior assessments/recommendations + `ScheduleEntry` rows (Epic 10) — computed, with manual comment cells. New columns only if the field-map proves a value isn't derivable. | new tab, `bursary-accounts` queries, Epic 10 schedule |
| **C9** | CG-25 | M | Reason codes: replace the 35 seeded placeholder codes with her **36 YoY** codes and add the **9 gap** codes as a second code set (`ReasonCode.kind` or equivalent); idempotent upserts in `seed-reference.ts`; both pickers multi-select (award tab + admin tab). Map/retire old codes already referenced by existing assessments (nonprod-only data — verify before deleting). Closes client deliverable **D4**. | `prisma/seed-reference.ts`, reason-code settings tab, pickers |

### Wave D — rounds & scheduling model

| WP | CG | Size | Change | Key code |
|---|---|---|---|---|
| **D1** | CG-01 | L | Round-scenario model: represent the four scenarios. Proposal — extend `Round` with `defaultTaxYear` + keep one Round per academic year, and add a light `RoundWindow` config (scenario → opening date, submission date, applicable application type) editable on an admin **Round settings** surface; RA windows default to 12 Apr → 22 May with award-communication date (reuse `Round.decisionDate`). NA windows ad hoc per her table. Scenario resolution helper: `(applicationType, today) → {academicYear, taxYear, window}` per her urgency/10-days-past-tax-year-end logic. Builds on Epic 13 E1's type-aware deadlines rather than replacing them. | `prisma/schema.prisma` Round, `src/lib/rounds/`, round dialogs/settings |
| **D2** | CG-01 | M | Consume the scenario: invitation merge fields (opening date, submission deadline) and the income form's tax-year derivation read the scenario's default tax year; ad hoc override preserved on NA. Reconcile with the existing dynamic tax-year rule engine from Epic 02 (rule engine wins where they disagree — flag in review). | invitations actions, income section tax-year source |
| **D3** | CG-02, CG-03 | L | Portal schedule as the returning-parent home: per-child schedule table (academic year, school year, opening date, deadline, award-communication date, state button `SUBMITTED` / `START APPLICATION` / `LOCKED`) built on Epic 10's `ScheduleEntry` + `buildPortalScheduleRows`; `START APPLICATION` launches/continues that year's application. First-time applicants (no account yet) keep the single-link journey (CG-03). | `src/app/(portal)/page.tsx`, `src/lib/bursary-accounts/portal-schedule.ts`, `(portal)/schedule` |

### Wave E — multi-child households

| WP | CG | Size | Change | Key code |
|---|---|---|---|---|
| **E1** | CG-04 | M | Verify + harden the invite/registration path for a second child on an existing parent email: contact-create allows same email + different child (guard is per-child today — confirm), invitation accept binds to the **existing** auth user instead of erroring, second `BursaryAccount`/application attaches to the same `Profile`. Add an integration test; fix whatever breaks. This is the check behind Charlotte's own planned test — pre-empt it. | contacts actions, invitation accept flow |
| **E2** | CG-04, CG-02 | L | Portal multi-application UX: home lists all of the login's children (one schedule block per child, per D3); application context (sidebar, autosave, submit) is per-application; switching children is explicit. Audit portal queries that assume "the user's single application". | portal layout/queries |

### Suggested PR sequencing

`A1+A2` → `A3+A4` → `A5` ‖ `B1` → `B2` → `B3` ‖ `C0` → `C1+C2` → `C3` →
`C4` → `C5` → `C6` → `C7` → `C8` → `C9` ‖ `D1` → `D2` → `D3` → `E1` → `E2`.
A and B are independent of C; D3/E2 depend on D1/E1. Tell Charlotte when
Wave A and Wave C land, separately — she asked to be pinged to retest both.

## 6. Open questions (fold into the reply emails)

1. **Q1 (CG-13):** confirm the forfeit rule — a parent who clicks past
   "DOWNLOAD MY COPY" without downloading cannot come back for it (the
   no-re-download decision stands, D13-4/Q3). The button copy will not warn
   them; is she happy that support requests are the accepted cost?
2. **Q2 (CG-07/08):** documents returned **by email to fees@** (her draft
   copy) or via the existing **portal respond flow** (the built path, keeps
   documents attached to the application automatically)? Template copy
   follows the answer. Recommend the portal flow with fees@ as fallback
   wording.
3. **Q3 (CG-26):** confirm a 3-way situation choice (new / internal /
   rolling-over) with the school auto-resolved is acceptable instead of a
   5-template picker (the five templates still exist and are editable).
4. **Q4 (CG-01):** the two "NA next round" scenarios differ only by default
   tax year (2025-26 before ~12 Apr, 2026-27 after) — confirm the boundary
   rule ("approx. 10 days after tax-year end") should be a fixed 12 April
   cutover each year.
5. **Q5 (CG-22):** Part 1 marks *year of entry* "manual edit" but it is set
   at invitation (Epic 13 D1 locked it admin-side) — confirm the assessment
   shows it prefilled-but-editable rather than empty.
6. **Q6 (workbook):** confirm the "PART 5 personal debt" block on the model
   sheet belongs to the ASSESSMENT MODEL (1-4) tab (§3 last bullet).
7. **Q7 (CG-24):** the YoY history table needs historical figures for
   existing bursary families (pre-system years, e.g. her 2023/24–2025/26
   example rows). Manual entry cells for pre-system years, or import?

## 7. Decisions to record

| # | Decision |
|---|---|
| D14-1 | **All round-2 feedback is acceptance remediation — no CR, no charge** (Brian, 2026-08-16). |
| D14-2 | **Split-screen document viewer retired at client request** (CG-23). Supersedes PRD AE-17 and Epic 06's docs-left target layout. Documents move to a dedicated tab. Recorded so the reversal is traceable to Charlotte's 16 Aug email, not a silent drop. |
| D14-3 | **Assessor enters figures; the system does not prefill applicant-declared values** (CG-15). This *is* PRD AE-01's original two-layer intent — the v2 prefill convenience is removed rather than a requirement changed. Reference-value autofill (AE-09: family-type notionals, fees, remaining years) stays. |
| D14-4 | **Calculation engine unchanged.** Wave C is presentation/IA over the existing v2 engine; any workbook row without an engine input is flagged in the C0 field-map for explicit sign-off, never silently implemented. |
| D14-5 | **Reply-handling via `replyTo`**, not inbound-mail forwarding (B1). Inbound routing for the updates subdomain is out of scope for the app. |

## 8. Out of scope

- Changes to the four-stage calculation maths (MSA 9.3; D14-4).
- Inbound mail routing/forwarding for `updates.meridiantech.group` (D14-5) —
  infrastructure task if Charlotte still wants it after `replyTo` ships.
- Re-download of the submission PDF (stands per D13-4).
- Per-field overrides of computed cells (stands per D13-3; the workbook's
  `manual fill` cells are inputs, not overrides of computed values).
- The paused docs-left panel returning in some future layout — parked until
  Charlotte asks (her words: "pause for the time being").
