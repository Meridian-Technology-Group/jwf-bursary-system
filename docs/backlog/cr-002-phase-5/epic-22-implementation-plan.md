---
title: "Epic 22 — CR-002 Phase 5: the parents' view"
status: "ACCEPTED — Charlotte accepted the revised £1,150 quote in writing, 13 Oct 2026 22:05 UTC (Gmail msg 1a1374c93f87ccc6). Ready to build"
quote: "£1,150 net of VAT — revised quote sent 13 Oct 2026 22:44 BST (msg 1a137396f33891af), replacing the £1,300 quote of 13 Oct 12:36 BST; thread 1a12f98bb30f54cf (\"Bursary Portal's Parent View\")"
opened: 2026-10-13
opened_by: Brian Wagner
depends_on:
  - Charlotte's workbook "Bursary Portal's Parent View.xlsx" (12 Oct 2026 10:11 UTC, same thread). NEVER commit it or quote from it — it holds a real family's names, bank details and paused-assessment text. Everything this plan needs from it is restated below without personal data.
  - Charlotte's email 13 Oct 2026 08:33 UTC (scope: Home, My Bursary Application(s), My Application(s) Schedule, Help, My Details; Paused Assessment page parked)
  - Charlotte's email 13 Oct 2026 21:34 UTC (msg 1a1372ff5d3b3206) — her answers: Help + My Details merged into "Contact us by email", "Rejected" = Reject and restart, the deep-link targets for My Bursary Application(s)
  - ../cr-002-phase-4/epic-21-implementation-plan.md (Phase 4; merged to staging 13 Oct, on migration staging; a rework is open — see §0)
  - ../../contract/master-services-agreement.md (§9.2 licence / §9.3 change control)
code_surveyed_at: origin/staging d7e783a (13 Oct 2026); reject-and-restart re-surveyed at cff0363 (14 Oct 2026)
---

# Epic 22 — CR-002 Phase 5: the parents' view

**This document is the handover.** It assumes no context beyond the repo and this file. Read §0–§3, then build the tranche you are given. It follows the shape of the Epic 21 plan; where a rule is not restated here, Epic 21 §3 applies.

> **Update 14 Oct 2026 — accepted and re-planned.** Charlotte accepted the revised quote (£1,150) on 13 Oct 22:05 UTC. Against the first version of this plan:
> - **Help and My Details are merged** into one tab, **"Contact us by email"** (£200). My Details is dropped (−£300), with its decisions D-9 to D-11.
> - **D-1 is reversed.** "Rejected" means the existing **Reject and restart**, not an award decision. "Unsuccessful" appears nowhere and award decisions stay off the family's pages. The close-reason tick and its reference-row migration are gone.
> - **New, £150: a record of each rejection**, so the schedule can show Submitted → Rejected → the new attempt (Reject and restart hard-deletes the form today).
> - **Tranches are renumbered in build order** (§4). The tranches that don't depend on the Phase 4 rework go first.

---

## §0 · Starting position (14 Oct 2026)

- **Phase 4 (Epic 21)** is merged to staging and live on migration staging. A **rework is open** in its own worktree (`../bursary-system-epic21`): one editable "Main synopsis" (T6), schedule dates following the round's window, the two rolling-over dates unified, each family's own deadline on the schedule row, and the admin schedule's "Shown to family" column fitting the card. **We told Charlotte Phase 5 starts once that rework is done.** Building Phase 5 in parallel is fine. But keep that order in what she sees: **don't put Phase 5 on migration staging before the Phase 4 rework is there** (§6), unless Brian says otherwise.
- **What depends on the rework:**
  - P5 (Schedule) reads the dates the rework changes ("Application Closing Date" and "To be submitted by", D-13). **Don't start P5 until the rework's date fixes are merged to staging.**
  - P4 (Home) edits the same home page as Phase 4's T1/T5/F5. She has said she'll reply separately on the parent-side Phase 4 items. **Start P4 after the rework is merged and her reply, if any, is handled.**
  - P1–P3 don't touch those files.
- **Prod** has 2 ACTIVE accounts. The Grant Tracker live load (271 accounts, 245 parent logins) has not happened; it waits for the Phase 4 promotion. Phase 5 will most likely reach prod **after** the live load, so every page must work for migrated families: they have **no current application** (`PORTAL_APPLICATION` excludes migrated placeholders) and their schedule year 1 (2026-27) is COMPLETE with no form in the system.
- **Prod has never used Reject and restart** (0 `APPLICATION_REJECTED_RESTART` audit rows, checked 14 Oct), so the rejection record (P3) needs no backfill.
- **Migration staging** (Supabase `ldqpzjizqvrairoojker`, Vercel env `rehearsal`, branch `chore/gt-rehearsal`) holds only migrated accounts. The test family **TS-NOWS01** (three children: Year 8, Year 11, Year 13 accounts) has a parent login there. There is **no non-migrated family** on migration staging, so draft/in-progress states are tested on **staging** (nonprod) with the demo seed applicants.
- **Quote, as accepted** (the binding description of scope):
  1. Home £150 — two versions, as in her sheet. Rolling-over: each child "Currently in Year X at <school>", plus "You currently have X active bursaries with the John Whitgift Foundation". New families: the first-application version. Removing "Your bursary portal is ready" and showing the three guidance sections (How to Apply, Checklist, Terms & Conditions) on every home page are **licence (no charge)**.
  2. My Bursary Application(s) £350 — one block per child: the family's last login (the same time on each block), how much of the form is complete, and four options, each landing in the right place: **start** → the start of the form; **keep working** → the first section still without a green tick; **see what still needs an answer or a document** → the validation section; **submit** → the end of the form.
  3. My Application(s) Schedule £300 — a table per child: academic year, school year, school, opening date, closing date, to be submitted by, completion, submission status, submission date.
  4. Contact us by email £200 — one tab, her wording at the top, no My Details tab. The question goes to fees@johnwhitgiftfoundation.org with the bursary reference in the subject. The reply goes to the lead applicant's email address held in the system, and the form shows that address as "From". Detail amendments use the same form; passwords stay with "Forgot password".
  5. Rejected rows £150 — keep a short record of each Reject and restart (the year, the submitted and rejected dates, nothing from the form) so the schedule shows the original submission "Submitted", then "Rejected", then the new application (0%, then "Submitted" once sent). The most recent submission for the year is the valid one.
- **Answers already given to her** (treat as the spec unless she objects):
  - Previous years show their dates, status and submission date.
  - Migrated accounts' pre-portal years show as completed through Grant Tracker, without completion or submission details.
  - A new award's first year shows the new-applicant dates; every later year shows 15 April – 21 May.
  - After a pause, the schedule keeps the original submission date (D-2).

### What exists today (survey of `d7e783a`, Reject and restart re-checked at `cff0363`)

| Area | Today | File |
|---|---|---|
| Nav | Home · [Missing Documents] · My Application · [Application Schedule] · Documents · Help & guidance. Missing Documents is gold/accent, shown only when paused | `src/components/portal/portal-nav.tsx` `buildPortalNav` L71-123 |
| Home | State seam `portalHomeMain` (application / invitation / none / no-invitation); heading "Welcome back, {first}" + "Your bursary portal is ready." (L409); per-child schedule table `ScheduleHome` above every state; quiet help line with T&Cs (L366-386) | `src/app/(portal)/page.tsx`, `src/lib/portal/home-state.ts` |
| Guidance | Only on `/help`: `PortalGuidanceTabs` (How to Apply · Checklist · T&Cs; FAQs collapsed `<details>`) | `src/components/portal/portal-guidance-tabs.tsx`, `src/lib/portal/guidance-content.ts` |
| Current year text | None. `deriveCurrentYearGroupNumber` exists, used only by reports | `src/lib/assessment/schooling-years.ts:251` |
| Multi-child | Cookie `jwf-active-application` picks the application every page follows; set by `/apply/open/[applicationId]` (GET) and the start actions. No switcher UI | `src/lib/portal/active-application.ts`, `src/app/(portal)/apply/open/[applicationId]/route.ts` |
| Progress | Two measures: home = complete sections ÷ 10 (9 rolling-over); wizard rail = Σsatisfied ÷ Σtotal items from `getSectionGapStatuses` | `page.tsx:148-185`; `src/lib/portal/section-gaps.ts:120-167`, `portal-sidebar.tsx:134-152` |
| What's missing | Error-severity gaps per section, listed on `/apply/review` | `src/app/(portal)/apply/review/page.tsx:437-540` |
| Last login | **Not tracked anywhere** (no Profile column; `auth.users.last_sign_in_at` is the *current* session and is never read) | `prisma/schema.prisma` Profile L13-39 |
| `/schedule` | A badge list (no dates) for **one** account only — `getPortalScheduleForUser` takes `findFirst` ACTIVE account; the home page shows all accounts | `src/app/(portal)/schedule/page.tsx`, `src/lib/db/queries/schedule.ts:127-189` |
| Schedule data | `BursaryScheduleEntry`: academicYear, scheduleYear, status (SCHEDULED / RECEIVED / COMPLETE), availableOn, requiredBy, receivedOn, showOnPortal, roundId?, applicationId? (**no FK**). Submission date lives on `Application.submittedAt` | `schema.prisma:193-215` |
| Schedule mirror | On submit, `mirrorApplicationToSchedule` sets the year's row RECEIVED with `applicationId` and `receivedOn`; on assessment completion, COMPLETE | `src/lib/bursary-accounts/lifecycle.ts:183`, `src/lib/applications/submission.ts:440` |
| Parent outcome | The portal **never shows an outcome**: `projectParentStatus` has only draft / submitted. It stays that way | `src/lib/portal/status-projection.ts` |
| Reject and restart | `rejectAndRestartApplication` (ADMIN/ASSESSOR) is allowed from review phases SUBMITTED / NOT_STARTED (assessment in progress) / PAUSED — **all post-submission**, so the rejected form always has a `submittedAt`. It **hard-deletes** the application (the `@@unique([roundId, leadApplicantId, childName, childDob])` tuple can't hold two), creates a blank one reusing the reference (`restartApplicationFromRejection`), audits `APPLICATION_REJECTED_RESTART` on the old id (metadata: fromStatus, reference, customMessage, clearedDocumentCount, newApplicationId — **no submitted date**), deletes the storage objects, and emails `APPLICATION_RESTART_REQUIRED`. **Trap:** it never touches the schedule row, so a rolling-over year stays RECEIVED, with the old submission date and the deleted application's id, until the new form is submitted | `src/app/(admin)/applications/[id]/actions.ts:356-512`, `src/lib/applications/create-from-invitation.ts:180-210` |
| Help | `/help` = guidance tabs only. `BURSARIES_CONTACT_EMAIL = fees@johnwhitgiftfoundation.org` as a mailto. No form, no rate limiting anywhere | `src/app/(portal)/help/page.tsx`, `guidance-content.ts:16`, `contact-bursary-team.tsx` |
| Email | Resend. `sendRawEmail(to, subject, body, {bcc})` always uses the fixed `replyToAddress()`; `EmailLog` written | `src/lib/email/send.ts:439`, L55-61 |
| "Manage My Details" | The parent-details form tells parents their details are in "Manage My Details", which doesn't exist | `src/components/portal/sections/parent-details-form.tsx:139` |
| Parent data | `Profile`: firstName, lastName, email, phone | `schema.prisma:13-39` |
| Password | Self-service: `/reset-password` → email → `/reset-password/update` | `src/app/(auth)/reset-password/*` |

---

## §1 · Scope and charge

| # | Change | Charge | Tranche |
|---|---|---|---|
| 2 | My Bursary Application(s): one block per child, last login, % complete, start / keep working / what's missing / submit | £350 | P1 |
| 4 | Contact us by email: question form → fees inbox, reference in subject, "From" = the lead applicant's address, reply to that address | £200 | P2 |
| L3 | The "Manage My Details" sentence in the parent-details form points at Contact us by email instead | licence | P2 |
| 5 | Rejected rows: a record of each Reject and restart, for the schedule | £150 | P3 |
| 1 | Home: new-family and rolling-over variants, children with current year and school, active-bursary count | £150 | P4 |
| L1 | Remove "Your bursary portal is ready" | licence | P4 |
| L2 | The three guidance sections visible on every home page | licence | P4 |
| 3 | My Application(s) Schedule: a table per child with the nine columns, including rejected rows | £300 | P5 |

Total charged **£1,150**. **Not in scope:** the Paused Assessment page (parked by her, 13 Oct) — the existing `/respond` flow and its nav item stay exactly as they are. My Details (dropped by her, 13 Oct).

---

## §2 · Decisions

"Default" = build on it and state it in the delivery email so she can object.

| ID | Question | Who | Answer / default | Tranche |
|---|---|---|---|---|
| **D-1** | A rejected year | Charlotte | **ANSWERED 13 Oct 21:34 UTC:** "Rejected" = Reject and restart (the console's rejected status), never "Unsuccessful" (families would read it as no award). The schedule shows the original submission ("Submitted", its date), a "Rejected" row (the rejection date), then the new attempt. Award decisions stay off the portal. Built by P3 (record) and P5 (rows) | P3, P5 |
| **D-2** | Submission date after a pause | Charlotte | **ANSWERED by acceptance** (stated in the accepted quote, 13 Oct 22:44 BST): the original `Application.submittedAt`; a pause/resume never moves it | P5 |
| **D-3** | Home: keep the per-child schedule table on the home page? | Charlotte | **ANSWERED 13 Oct 21:34 UTC** ("for the display to be just like what is on the spreadsheet"; her Home sheet has only the children list): **move it.** Each child line links to that child's table on My Application(s) Schedule | P4, P5 |
| **D-4** | "% Completion": which measure? | Brian | Default: the wizard rail's item-level measure (Σsatisfied ÷ Σtotal, `getSectionGapStatuses`), used everywhere — the home page's section count switches to it too, so the number never disagrees between pages | P1, P4, P5 |
| **D-5** | "Last login": the current session or the previous one? | Brian | Default: **the previous sign-in** ("Last login: 11 October 2026, 22:26"), recorded from deploy onwards; with no earlier recorded sign-in, "First login since this page was added". One value per family login, the same on every block (her words: "same login time, for all sections") | P1 |
| **D-6** | Contact emails outside prod must never reach the real fees inbox | Brian | Default: new env var `PORTAL_ENQUIRY_INBOX` (Production = fees@johnwhitgiftfoundation.org; Preview = a Meridian test inbox, Brian to choose). Unset → the form shows a **test-mode preview** of exactly what would be sent and sends nothing (so she can test on migration staging, where email is off). Brian sets the vars; Claude does not run `vercel env add` | P2 |
| **D-7** | Send the parent a copy of their question? | Charlotte | Default: no copy; on-screen confirmation "Sent to the bursary team. Our reply will come to {login email}" (her text: "We will send you our reply by email using your email address held in the system") | P2 |
| **D-8** | Nav order and labels | Charlotte | Default: Home · My Bursary Application(s) · My Application(s) Schedule · Documents · Contact us by email. Missing Documents unchanged (shown only when paused, in its current place). Each tranche changes its own item (P1 adds My Bursary Application(s) in place of My Application; P2 renames Help; P5 widens the schedule item's gate) | P1, P2, P5 |
| ~~D-9~~ ~~D-10~~ ~~D-11~~ | My Details address source, "details are correct" button, email-address changes | — | **WITHDRAWN** with My Details (13 Oct). An email-address change requested through the contact form is done by Meridian with the existing script path, as before | — |
| **D-12** | Schedule "Submission status" wording | Charlotte | Default: Scheduled · Open, not started · In progress · Submitted · Rejected · Completed through Grant Tracker (migrated year 1). Her example labels a restarted, not-yet-begun form "Scheduled"; we use "Open, not started" while its window is open and say so in the delivery email | P5 |
| **D-13** | "Application Closing Date" vs "To be submitted by" | Brian | Default: Closing = the round's window close; To be submitted by = the family's own deadline (the deadline chain, including any per-family extension). Identical unless an extension was granted. **Build on the Phase 4 rework's unified dates**, not on today's frozen `requiredBy`: R2 (#449) provides `scheduleRowDates({ availableOn, requiredBy, application })` in `src/lib/bursary-accounts/schedule-dates.ts` → `{ opensOn, closesOn, submitBy, hasOwnDeadline }`. Closing = `closesOn`; To be submitted by = `submitBy` (the per-application override, else `closesOn`). The rolling-over window tier applies to ROLLING_OVER only; NEW keeps the round's `closeDate` | P5 |
| **D-14** | Which reference goes in the subject when a family has several children? | Brian | Default: the form asks "Which child is this about?" (one option per child, plus "General question"); the subject carries that child's latest application reference, or the account's child name when no application exists yet | P2 |
| **D-15** | Throttle for the contact form (none exists in the app) | Brian | Default: 5 per hour and 20 per day per login, counted from audit rows; over the limit → "Please email fees@johnwhitgiftfoundation.org directly" | P2 |
| **D-16** | Her mock-up has a "Subject:" line under "From" | Brian | Default: the family types a short subject (optional, ≤120 characters); the email subject is `Bursary portal question — {reference} — {their subject}`. The reference is always added by the system, never typed | P2 |
| **D-17** | The old Help page's guidance tabs | Brian | Default: `/help` becomes "Contact us by email" (URL kept so old links work); the guidance tabs stay below the form, and P4's home cards deep-link to them (`/help?tab=`) | P2, P4 |
| **D-18** | After a Reject and restart, the year's schedule row (see the §0 trap) | Brian | Default: in the same transaction, reset the row to SCHEDULED, `receivedOn` null, `applicationId` = the new application (only if the row pointed at the rejected one). The rejection record keeps the old dates | P3 |
| **D-19** | "Completion Status" on the Submitted and Rejected rows of a rejected attempt | Brian | Default: "100% completed" on both (the form had been submitted, as in her example); the record stores no form data | P5 |

---

## §3 · Ground rules

Epic 21 §3 applies in full (git flow, CI gates, migrations additive with policies in the same migration, enum caution, audit via `createAuditLog`, no jsdom → pure seams, prod blast radius in each PR, family codes not names). In addition:

- **No timeline.** Work in order; report progress per tranche.
- **Build in the Phase 5 worktree** `../bursary-system-epic22` (its own deps and env files; `.env`/`.env.local` point at nonprod). The Phase 4 rework stays in `../bursary-system-epic21`, so each can be curated separately. One branch per tranche from fresh `origin/staging`. One tranche at a time.
- **Gates before every PR:** `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` · `npx prisma format --check` · `npx vitest run`. Don't run `npx prettier`.
- **Tick this plan** in each tranche's PR (its Status line).
- **Parent-facing copy is British English and plain** (her words where she gave them: "Welcome back", "You currently have X active bursaries with the John Whitgift Foundation", "Currently in Year X at <school>", her four "I would like to…" options, her Contact us heading). Pages say "Application", never "Assessment" (F4).
- **Never expose staff-only data** to a parent: no assessor notes (including the Reject and restart note — the family already has it in their email), outcomes, financial figures, gap codes or GT documents. Every new parent query runs under the parent's own RLS context (`withUserContext`) unless a documented reason says otherwise.
- **Migrated families are first-class:** every page has an explicit migrated case (no current application, year 1 COMPLETE).
- **Email:** only P2 sends, only to `PORTAL_ENQUIRY_INBOX`, never to a parent. Nothing else in Phase 5 sends mail.
- **New tables:** `ensure_rls` force-enables RLS on every new public table, so the policies ship in the same migration (patterns: `20260519163000`, `20260710205004`). Grants as narrow as the code needs.

---

## §4 · Tranches and order

| P | Contents | Branch | Migration | Needs | Waits for |
|---|---|---|---|---|---|
| **P1** | My Bursary Application(s) (#2) + last-login recording + one progress measure + its nav item | `feature/portal-my-applications` | `profiles.last_sign_in_at`, `profiles.previous_sign_in_at` | D-4, D-5, D-8 | — |
| **P2** | Contact us by email (#4) + the enquiry-mail module + L3 + the Help nav rename | `feature/portal-contact-us-by-email` | none | D-6, D-7, D-14–D-17 | — |
| **P3** | Rejection record (#5): table, written by Reject and restart; schedule-row reset | `feature/application-rejection-record` | new table `application_rejections` (+ RLS) | D-18 | — |
| **P4** | Home variants (#1) + L1 + L2 | `feature/portal-home-parent-view` | none | D-3, D-17 | Phase 4 rework merged; her parent-side Phase 4 reply handled |
| **P5** | My Application(s) Schedule (#3), all of the family's accounts, with rejected rows | `feature/portal-schedule-table` | none | D-1, D-2, D-12, D-13, D-19; P1 (progress), P3 (records) | Phase 4 rework's date fixes merged |

Merge order **P1 → P2 → P3 → P4 → P5**. After each merge, staging is browser-checked. Migration staging is brought up only per §6 step 4.

**Live load interaction.** The loader creates Profiles and accounts; P1 adds only nullable columns and P3 a new table that migrated accounts never write to, so the loader and its rollback (`assertUntouched` on `bursary_accounts.updated_at`) are unaffected. P3 must not touch `bursary_accounts`.

---

## §5 · Work packages

### P1 · My Bursary Application(s) (#2)

**Status: DONE — merged to staging 14 Oct (#443 + fix #444).** Built as planned, with these differences: the page is at **`/my-applications`** (the middleware treats `/applications*` as admin — #444); "Last login" is copied from Supabase's `auth.users.last_sign_in_at` by the portal layout (and the page) on the first load after a new sign-in, which covers every sign-in path without wiring each form; a per-invitation start action (`startInvitationApplicationAction`) was needed because both existing start actions take the family's latest invitation. Also fixed: starting a second child's re-assessment reused the first child's draft (idempotency now per account). Browser-checked on nonprod (test family `jwf-testing+applicant2`): block % = rail % (73.5), continue → first un-ticked section, review → `/apply/review`, submit disabled with gaps, last login = previous sign-in. TS-NOWS01 check waits for migration staging (§6.4).

**Page** `src/app/(portal)/applications/page.tsx`. **Nav:** "My Bursary Application(s)" replaces "My Application" in `buildPortalNav` (href `/applications`; the wizard rail still nests under it on `/apply/*`). One block per child (ACTIVE account, plus any child with an invitation or a non-migrated application but no account yet). Each block:
- Child's first name and surname as the heading; "Click on the following options to access the form."
- **Last login** (D-5): the family's previous sign-in, same on every block.
- **% Completion** (D-4) of that child's current application; "Not started" when none exists.
- **What would you like to do?** — her four options, each enabled only when it applies (seam `applicationBlockActions(state)`, tested). "Paused" here is her word for a form the family saved and left, **not** the admin PAUSE (Missing Documents):
  - "I would like to start the application" — the child has a pending invitation/re-assessment invite and no application: runs the existing `startApplicationAction` / `beginReassessmentAction` for that invitation, landing at the start of the form.
  - "I have paused the application and would like to keep working on it" — a draft exists: `/apply/open/{id}?to=continue` (the first section without a green tick).
  - "I would like to see which sections still need an answer or a document upload" — a draft exists: `/apply/open/{id}?to=review` (the validation section).
  - "I would like to submit the form" — a draft with no blocking gaps: `/apply/open/{id}?to=submit` (the end of the form, the Declaration). Disabled with "Complete the sections listed above first" otherwise.
  - Submitted: the block says "Submitted on {date}" and offers "View status" (`/apply/open/{id}` → `/status`).
  - Migrated / between rounds: "Your next application opens on {date}" from the schedule; no actions.
  - A form just restarted after a rejection is a draft like any other (0%, the start option's target is the start of the form).

**Open route.** `apply/open/[applicationId]/route.ts` accepts `?to=continue|review|submit` (whitelist; anything else is ignored), keeps the ownership check and cookie, then redirects. Pure `openTarget(to, app, sections)` tested.

**Progress (D-4).** Extract `applicationCompletion(sectionGapStatuses)` (Σsatisfied ÷ Σtotal, rounded, 0 when nothing started) from `portal-sidebar.tsx:134-152` into `src/lib/portal/`, and use it in the rail and this page (P4 and P5 reuse it). Per child it costs one `getSectionGapStatuses` call; fine for a family's 1–4 children.

**Last login (D-5).** Migration `<ts>_profile_sign_in_times`: `profiles.last_sign_in_at TIMESTAMPTZ`, `profiles.previous_sign_in_at TIMESTAMPTZ`; no backfill. On each successful parent sign-in (password login action `src/app/(auth)/login/actions.ts`, the register flow's first sign-in, and `src/app/(auth)/auth/callback` if it creates a session) run `previous = last, last = now()` for that profile (admin context, one UPDATE; staff logins excluded). Seam `recordSignIn(prev)` → new values; tested.

**Accept.**
- Staging, demo applicant with two children (one draft at ~60%, one not started): two blocks; percentages match the wizard rail; each option lands on the right page for the right child; Submit is disabled while gaps remain.
- After signing out and in again, "Last login" shows the earlier sign-in.
- TS-NOWS01 (migration staging): three blocks, "Your next application opens on 15 April 2027" (the Year 13 account: no next year, so "Your bursary runs to the end of 2026-27").

**Blast radius.** Two nullable columns on `profiles`; written on each sign-in from deploy. No data changed.

---

### P2 · Contact us by email (#4, L3)

**Status: DONE — merged to staging 14 Oct (#445).** As planned. The parent's question is HTML-escaped before sending (the shared `plainTextToHtml` doesn't escape). Browser-checked in test mode on nonprod (preview, audit row with no question text, `?tab=checklist`). **Brian to set `PORTAL_ENQUIRY_INBOX`** — Production: fees@johnwhitgiftfoundation.org; Preview: the Meridian test inbox; `rehearsal`: unset (test mode).

**Shared module** `src/lib/portal/enquiry.ts`:
- `composeEnquiry({ parent, child?, reference?, subject?, body })` → `{ subject, text }`. Pure, tested. Subject (D-16): `Bursary portal question — {reference}` (or `— {child name} (no application yet)` / `— general question`), then `— {their subject}` when given. Body: parent name, login email, child, reference, the question, sent time (Europe/London), and an admin link to the application.
- `sendEnquiry(...)`: refuses when the throttle (D-15) is exceeded; sends with `sendRawEmail` to `PORTAL_ENQUIRY_INBOX` with **Reply-To = the parent's login email** (extend `sendRawEmail`'s options with `replyTo`; default unchanged for every other caller); writes an audit row `PORTAL_ENQUIRY_SENT` (metadata: child account id, reference, EmailLog id — **not** the question text). D-6 test mode: inbox unset → return the composed email for an on-page preview, send nothing, audit `PORTAL_ENQUIRY_PREVIEWED`.
- Add the new audit keys to `AUDIT_ACTIONS`.

**Page** `/help` (URL kept, D-17), page title and nav label **"Contact us by email"**. At the top, her wording as the heading: "If you want to ask the bursary team a question as you are filling in the form or if you need any of your details amended, please email us directly using the section below." Then:
- "Your question will be sent with your bursary reference directly to the fees@johnwhitgiftfoundation.org email address."
- "We will send you our reply by email using your email address held in the system."
- **From:** the lead applicant's login email, read-only.
- **Which child is this about?** (D-14).
- **Subject** (optional, D-16).
- **Your question** (required, 10–5,000 characters).
- Send → confirmation (D-7) or, in test mode, the preview.
- Below the form, the existing guidance tabs (unchanged), with a `?tab=` deep link added to `PortalGuidanceTabs` for P4.
The server action runs as the parent (ownership of the chosen child checked server-side). Passwords: one line pointing at "Forgot password" on the sign-in page; no form option for it.

**L3.** `parent-details-form.tsx:139` stops mentioning "Manage My Details": "If any of these details need changing, use Contact us by email" linking to `/help`.

**Env (D-6).** Tell Brian to add `PORTAL_ENQUIRY_INBOX` (Production: fees@johnwhitgiftfoundation.org; Preview: a Meridian test inbox; `rehearsal` unset → preview mode). Document it in `.env.example`.

**Accept.**
- Staging (Preview inbox set): a question about one child arrives at the test inbox with "Bursary portal question — {reference} — {subject}"; replying in the mail client addresses the parent's login email.
- Migration staging (unset): TS-NOWS01 sees the test-mode preview, nothing is sent, the audit row exists.
- The sixth question within an hour is refused with the fallback message.

**Blast radius.** No data change. Prod sends only when a parent submits the form, and only once Brian has set the Production var.

---

### P3 · Rejection record (#5)

**Status: DONE — merged to staging 14 Oct (#446).** As planned, plus a `child_name` column so a first-year rejection (no account yet) can be matched to the child later. Verified on nonprod: Reject & restart on a review fixture wrote one row (dates, reference, replacement id, audit `rejectionRecordId`); RLS — owning parent sees 1, another parent 0, admin 1, a parent's insert is refused. The schedule-row reset (D-18) is unit-tested; nonprod has no pre-outcome rolling-over application with a RECEIVED row to try it on.

**Migration** `<ts>_application_rejections` — new table `application_rejections`:
- `id` uuid pk; `round_id` → rounds; `academic_year` text (copied, so the row reads without joins); `lead_applicant_id` → profiles **ON DELETE CASCADE**; `bursary_account_id` → bursary_accounts nullable, **ON DELETE CASCADE** (null for a new applicant with no account yet); `reference` text; `submitted_at` timestamptz (the rejected form's `submittedAt`; nullable for safety, always set in practice); `rejected_at` timestamptz default now(); `rejected_by` → profiles nullable ON DELETE SET NULL; `replacement_application_id` uuid, **no FK** (the replacement can itself be rejected and deleted later; the next record links on); `from_phase` text.
- Nothing from the form, and **not** the assessor's note (it stays in the audit log and the email).
- Index on `(bursary_account_id, academic_year)` and on `lead_applicant_id`.
- RLS in the same migration: the lead applicant SELECTs their own rows (`lead_applicant_id = auth.uid()`); ADMIN/ASSESSOR/VIEWER SELECT all; writes only via admin context (service_role). Grant SELECT to `authenticated`, INSERT to service_role only; no UPDATE/DELETE grants (rows go only by cascade — GDPR erasure of the profile or account removes them).
- Prisma model `ApplicationRejection`; no relation field added to `BursaryAccount` beyond Prisma's back-relation (no column on `bursary_accounts`).

**Write path.** In `rejectAndRestartApplication`, inside the existing transaction and **before** `restartApplicationFromRejection` deletes the row: select `submittedAt` too, and after the restart insert the record with `replacement_application_id = newApplicationId`. Add `rejectionRecordId` to the audit metadata.

**Schedule row (D-18).** In the same transaction, when the application has a `bursaryAccountId`: find the year's row (by academic year, `scheduleYearLabels`, as `mirrorApplicationToSchedule` does); if its `applicationId` is the rejected id, set status SCHEDULED, `receivedOn` null, `applicationId` = the new id. Never touch a COMPLETE row. Pure helper `scheduleRowAfterRestart(row, rejectedId, newId)` tested.

**Query** `getRejectionsForAccounts(tx, accountIds)` for P5 (under the parent's RLS on the portal; admin context elsewhere).

**Admin view.** None in this tranche: the audit trail already shows the rejection on the History tab. (Showing it on the admin schedule grid is not quoted.)

**Accept.**
- Unit: the record carries the old submitted date and the new application id; a second rejection of the replacement adds a second record; the schedule row resets only when it pointed at the rejected application.
- Staging: reject and restart a submitted demo rolling-over application → one `application_rejections` row (dates right, no form data); the schedule row reads SCHEDULED with the new application id; the parent's login can SELECT the row, another parent's can't.

**Blast radius.** One new table, empty on prod (Reject and restart never used there). Changes one admin action's transaction; its email and storage clean-up are untouched.

---

### P4 · Home (#1, L1, L2)

**Status: DONE — merged to staging 14 Oct (#448), on Brian's instruction before her parent-side Phase 4 reply (built on defaults; the PR lists what her reply could change).** One difference: `currentSchoolYear` is anchored like the schedule's School Year column (entry year-group in the first assessment year, +1 per academic year, turning on 20 August) rather than on `deriveCurrentYearGroupNumber` (1 September, entry calendar year), so Home and P5 agree. The elevated "New to bursary applications?" card went too (the L2 cards repeat it). `ScheduleHome` deleted. Child links point at `/schedule#account-{id}`; P5 adds the anchors. Not on migration staging.

**Variants** (pure seam `homeVariant({ activeAccounts, hasApplication, hasInvitation })` in `src/lib/portal/home-state.ts`, extending `portalHomeMain`; unit-test every combination):
- **New family** (no ACTIVE account): heading "Welcome, {first name}"; "You currently do not have an active bursary."; with an invitation: "You have been invited to fill in the following bursary application for us to assess your household:" and the existing start/continue affordance (`ApplicationTypeChooser` or the continue card). Without an invitation: the existing `no-invitation` state.
- **Rolling-over family** (≥1 ACTIVE account): heading "Welcome back, {first name}"; "You currently have {n} active bursar{y|ies} with the John Whitgift Foundation."; one line per child: "{child name} — Currently in Year {X} at {school}". A pending invitation or an in-progress application for any child still shows its card below the list (a family can be both).
- **L1:** delete the "Your bursary portal is ready." subtitle (`page.tsx:409`). Keep the round line when there is an application.
- **L2:** a "Need help?" block on every variant with three always-visible cards: Section 1 — How to Apply, Section 2 — Checklist (each opens `/help?tab=…`, D-17), Section 3 — Terms & Conditions (opens the PDF, `TERMS_AND_CONDITIONS_PATH`). Replace the quiet help line (L366-386) with it.
- **D-3:** remove `ScheduleHome` from home; each child line links to that child's table on `/schedule` (anchor).
- Re-check against whatever the Phase 4 rework changed on the home page before starting (T1/T5/F5 and the per-family deadline display).

**Facts / helpers.**
- Children and counts: a new query `getFamilyAccountsForUser(tx, userId)` (ACTIVE accounts led by the user, with `childName`, `school`, `entryYearGroup`, `firstAssessmentYear`), under the user's RLS. Reuse the account select in `getScheduleHomeForUser` (`schedule.ts:211-239`).
- Current school year: `currentSchoolYear({ entryYearGroup, firstAssessmentYear, today })` built on `deriveCurrentYearGroupNumber` (`schooling-years.ts:251`). Cap at the school's final year (13; 11 at the OP partner school). Test the 20 August academic-year boundary.
- School name: the existing `schoolLabel`.

**Accept.**
- TS-NOWS01 (migration staging): "Welcome back, …"; "You currently have 3 active bursaries…"; three children, each "Currently in Year X at Trinity School" with the right year for 2026-27 (Year 8, Year 11, Year 13); the three guidance cards; no "Your bursary portal is ready".
- A demo applicant with an invitation and no account (staging): "Welcome, …", "You currently do not have an active bursary.", the invitation card.

**Blast radius.** Display only. Prod: the 2 families see the new home.

---

### P5 · My Application(s) Schedule (#3)

**Status: NOT STARTED. Waits for the Phase 4 rework's date fixes (§0).**

**Page** `/schedule` is rebuilt: one section per child — heading "{child name} — Currently in Year {X} at {school}" (P4's helper; if P4 hasn't merged, build the helper here and P4 reuses it) — then a table:

| Column | Source |
|---|---|
| Academic Year | `entry.academicYear` |
| School Year | `entryYearGroup + scheduleYear − 1` (existing, `schedule-home.ts:211-214`) |
| School | `schoolLabel(account.school)` |
| Application Opening Date | `scheduleRowDates(...).opensOn` (R2, #449, `src/lib/bursary-accounts/schedule-dates.ts`) |
| Application Closing Date | `scheduleRowDates(...).closesOn` (D-13) |
| To be submitted by | `scheduleRowDates(...).submitBy`: the per-application override, else `closesOn` (D-13); `hasOwnDeadline` says an extension was granted |
| Completion Status | `applicationCompletion` (P1) of that year's application; "—" for a future year; "Completed through Grant Tracker" for a migrated COMPLETE year; "100% completed" on a rejected attempt's two rows (D-19) |
| Submission Status | D-12 wording, from a pure `parentScheduleStatus(row)` |
| Submission Date | `Application.submittedAt` (D-2); on a rejected attempt, its recorded `submitted_at`; the "Rejected" row shows the rejection date; else blank |

- **Rejected rows (D-1, from P3's records):** for a year with rejections, before that year's current row, add per record (oldest first) a "Submitted" row with the record's `submitted_at` and a "Rejected" row with its `rejected_at`, then the year's row for the current application. The dates columns repeat the year's dates, as in her example.
- **All of the family's accounts**, not one: replace `getPortalScheduleForUser`'s `findFirst` (the documented single-account assumption, `schedule.ts:127-168`) with a per-account list. `hasPortalSchedule` (the nav gate) becomes "any account with a visible row". Keep `showOnPortal` filtering in SQL; a hidden year hides its rejected rows too.
- CLOSED accounts stay hidden, as today (no outcome is ever shown).
- Rows link nowhere (her sheet has no actions here; P1 is the place to act).
- The old badge-list component `schedule-calendar.tsx` and `buildPortalScheduleRows` are retired once nothing uses them; keep `STATE_LABELS` only if still referenced.

**Seams and tests.** `parentScheduleStatus` (every status, migrated year 1, submitted-then-paused keeps "Submitted" and the original date) and `scheduleRowsForParent(account, entries, apps, rejections, today)` (one and two rejections in a year; a rejection in a hidden year); extend `schedule-home.test.ts` for the shared date chains.

**Accept.**
- TS-NOWS01 (migration staging): three tables (Year 8 account: 2026-27 … 2031-32; Year 11: 2026-27 … 2028-29; Year 13: 2026-27 only); 2026-27 rows "Completed through Grant Tracker"; later rows show the round's dates and "Scheduled"; a row hidden with the T5 toggle is absent.
- Staging: a submitted demo application shows its submission date; pausing and resuming it (admin) leaves the date unchanged (D-2). Rejecting and restarting it gives Submitted → Rejected → the new attempt at 0%; submitting the new attempt shows its date on the third row.

**Blast radius.** Display only. Prod: the 2 families see the new schedule page.

---

## §6 · Validation path for every tranche

As Epic 21 §6:
1. Local gates.
2. PR → staging, CI green; smoke-test on the staging preview (`brian.admin@jwf-bursary.test` and a demo applicant).
3. Merge (standing authority for green PRs without data backfills; P1 adds columns only, P3 a new empty table).
4. Migration staging: **only once the Phase 4 rework is on migration staging** (§0). Merge staging into `chore/gt-rehearsal` (no force-push); apply P1/P3 migrations by hand after checking the project ref is `ldqpzjizqvrairoojker`; wait for the `rehearsal` deploy; browser-check as admin and as the TS-NOWS01 family.
5. One email to Charlotte when all five are on migration staging, by family code, stating the defaults taken in §2.
6. Promotion (`staging → main`) only on Brian's explicit instruction, after her OK.

---

## §7 · Out of scope (logged, not built)

- **The Paused Assessment page** (her free-text-with-screenshots note, parent comments box, named uploads, greyed-after-submit, the menu item turning red). Parked by her 13 Oct; `/respond` and the gold Missing Documents item stay as they are.
- **My Details** (dropped by her 13 Oct), and with it an admin tool to change a parent's login email.
- Showing any outcome to a family — awards are communicated as today.
- Rejections on the admin schedule grid (the History tab's audit trail already shows them).
- Any portal mailbox or reply thread — replies come by email (her requirement, 13 Oct).
- Anything new she raises while testing goes to a new quote.
