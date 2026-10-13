---
title: "Epic 22 — CR-002 Phase 5: the parents' view"
status: "prepared — NOT approved. Do not build until Charlotte accepts the £1,300 quote in writing"
quote: "£1,300 net of VAT — sent 13 Oct 2026 12:36 BST, thread 1a12f98bb30f54cf (\"Bursary Portal's Parent View\")"
opened: 2026-10-13
opened_by: Brian Wagner
depends_on:
  - Charlotte's workbook "Bursary Portal's Parent View.xlsx" (12 Oct 2026 10:11 UTC, same thread). NEVER commit it or quote from it — it holds a real family's names, bank details and paused-assessment text. Everything this plan needs from it is restated below without personal data.
  - Charlotte's email 13 Oct 2026 08:33 UTC (scope: Home, My Bursary Application(s), My Application(s) Schedule, Help, My Details; Paused Assessment page parked)
  - ../cr-002-phase-4/epic-21-implementation-plan.md (Phase 4; merged to staging 13 Oct, on migration staging)
  - ../../contract/master-services-agreement.md (§9.2 licence / §9.3 change control)
code_surveyed_at: origin/staging d7e783a (13 Oct 2026)
---

# Epic 22 — CR-002 Phase 5: the parents' view

**This document is the handover.** It assumes no context beyond the repo and this file. Read §0–§3, then build the tranche you are given. It follows the shape of the Epic 21 plan; where a rule is not restated here, Epic 21 §3 applies.

**Gate: do not start building until Charlotte has accepted the quote in writing.** Then record the acceptance (date, Gmail message id) in the header and §0, answer or default the §2 decisions, and start at P1.

---

## §0 · Starting position (13 Oct 2026)

- **Phase 4 (Epic 21)** is merged to staging and live on migration staging; it is parked awaiting her reply (21 vs 22 May, footer). Phase 5 builds on it: the "Application" wording (F4), the T&Cs link on home (F5), `showOnPortal` on home (T5) and the rolling-over dates (T7) are already in.
- **Prod** has 2 ACTIVE accounts. The Grant Tracker live load (271 accounts, 245 parent logins) has not happened; it waits for the Phase 4 promotion. Phase 5 will most likely reach prod **after** the live load, so every page must work for migrated families: they have **no current application** (`PORTAL_APPLICATION` excludes migrated placeholders) and their schedule year 1 (2026-27) is COMPLETE with no form in the system.
- **Migration staging** (Supabase `ldqpzjizqvrairoojker`, Vercel env `rehearsal`, branch `chore/gt-rehearsal`) holds only migrated accounts. The test family **TS-NOWS01** (three children: Year 8, Year 11, Year 13 accounts) has a parent login there. There is **no non-migrated family** on migration staging, so draft/in-progress states are tested on **staging** (nonprod) with the demo seed applicants.
- **Quote, as sent** (the binding description of scope):
  1. Home £150 — rolling-over: each child "Currently in Year X at <school>", plus "You currently have X active bursaries with the John Whitgift Foundation"; new families: the first-application version. Removing "Your bursary portal is ready" and showing the three guidance sections (How to Apply, Checklist, Terms & Conditions) on every home page are **licence (no charge)**.
  2. My Bursary Application(s) £350 — one block per child: the family's last login, how much of the form is complete, and four options: start, carry on, see which sections still need an answer or a document, submit. Last login is the family's login, so the same time shows on each block.
  3. My Application(s) Schedule £300 — a table per child: academic year, school year, school, opening date, closing date, to be submitted by, completion, submission status, submission date.
  4. Help £200 — a question form that sends to the fees inbox with the bursary reference in the subject; Reply-To is the parent's own address, so she answers from Outlook; nothing lands in the portal.
  5. My Details £300 — the family's details; title editable directly; for other details "I need to amend these details" sends a request to the fees inbox like a Help question; password changes are self-service via reset.
- **Answers already given to her in the quote email** (treat as the spec unless she objects): previous years show their dates, status and submission date; migrated accounts' pre-portal years show as completed through Grant Tracker without completion/submission details; a new award's first year shows the new-applicant dates, every later year 15 April – 21 May. Two were **asked, not decided** (§2 D-1, D-2).

### What exists today (survey of `d7e783a`)

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
| Schedule data | `BursaryScheduleEntry`: academicYear, scheduleYear, status, availableOn, requiredBy, receivedOn, showOnPortal, roundId?, applicationId?. Submission date lives on `Application.submittedAt` | `schema.prisma:193-215` |
| Parent outcome | The portal **never shows an outcome**: `projectParentStatus` has only draft / submitted | `src/lib/portal/status-projection.ts` |
| Help | `/help` = guidance tabs only. `BURSARIES_CONTACT_EMAIL = fees@johnwhitgiftfoundation.org` as a mailto. No form, no rate limiting anywhere | `src/app/(portal)/help/page.tsx`, `guidance-content.ts:16`, `contact-bursary-team.tsx` |
| Email | Resend. `sendRawEmail(to, subject, body, {bcc})` always uses the fixed `replyToAddress()`; `EmailLog` written | `src/lib/email/send.ts:439`, L55-61 |
| My Details | **No page.** The parent-details form tells parents their details are in "Manage My Details" (dangling) | `src/components/portal/sections/parent-details-form.tsx:139` |
| Parent data | `Profile`: firstName, lastName, email, phone — **no title, no address**. `Contact` (admin-maintained, one per child): title, names, address, school, account link. Each year's form JSON (`PARENT_DETAILS.parent1Contact`) holds title/address/phones per application | `schema.prisma:13-39`, `:1077-1142`; `src/lib/schemas/parent-details.ts:40-70` |
| Profile RLS | `profiles_update_self` lets a user update their own row | `prisma/migrations/20260513090020_enable_row_level_security` L271 |
| Password | Self-service: `/reset-password` → email → `/reset-password/update` | `src/app/(auth)/reset-password/*` |

---

## §1 · Scope and charge

| # | Change | Charge | Tranche |
|---|---|---|---|
| 1 | Home: new-family and rolling-over variants, children with current year and school, active-bursary count | £150 | P1 |
| L1 | Remove "Your bursary portal is ready" | licence | P1 |
| L2 | The three guidance sections visible on every home page | licence | P1 |
| 2 | My Bursary Application(s): one block per child, last login, % complete, start / carry on / what's missing / submit | £350 | P2 |
| 3 | My Application(s) Schedule: a table per child with the nine columns | £300 | P3 |
| 4 | Help: question form → fees inbox, reference in subject, Reply-To parent | £200 | P4 |
| 5 | My Details: details view, title editable, amend requests to the fees inbox, password via reset | £300 | P5 |
| L3 | The "Manage My Details" sentence in the parent-details form points at the new page | licence | P5 |

Total charged **£1,300**. **Not in scope:** the Paused Assessment page (parked by her, 13 Oct) — the existing `/respond` flow and its nav item stay exactly as they are.

---

## §2 · Decisions

Mark each answered with date and source before building the tranche that needs it. "Default" = build on it and state it in the delivery email so she can object.

| ID | Question | Who | Default if no answer | Blocks |
|---|---|---|---|---|
| **D-1** | A rejected year: show "Unsuccessful" and drop the later years? (asked in the quote) **Note:** the portal has never shown an outcome to a parent (`projectParentStatus`: draft / submitted only). Showing "Unsuccessful" is a new disclosure, so it must only appear once the decision has been communicated (account closed with an unsuccessful reason, or the assessment in its final state after the decision letter) | Charlotte | As suggested in the quote: the year reads "Unsuccessful" and later years are not shown. **Which closes count:** close reasons are 14 free labels with no "unsuccessful" marker, and several must never be shown to a family (ID checks fail, dishonesty flag, disciplinary withdrawal). So add a per-reason tick "Show to the family as Unsuccessful" (Settings → Close Reasons), defaulted on only for the assessment-driven ones: "Assessment confirms above threshold, does not qualify", "Qualifies for a bursary but not part of admissions' final shortlist", "Internal bursary request but not eligible". She confirms or changes the ticks. An account closed with any other reason stays hidden, as today | P3 |
| **D-2** | Submission date after a pause: the original submission date? (asked in the quote) | Charlotte | Original `Application.submittedAt` (P3 accept test checks a pause/resume never moves it) | P3 |
| **D-3** | Home: keep today's per-child schedule table on the home page, or move it to the Schedule page (her Home sheet shows only the children list)? | Charlotte (via email) | **Move.** Home shows the children list with "View schedule"; the full table lives on My Application(s) Schedule | P1, P3 |
| **D-4** | "% Completion": which measure? | Brian | The wizard rail's item-level measure (Σsatisfied ÷ Σtotal, `getSectionGapStatuses`), used everywhere — the home page's section count is switched to it too, so the number never disagrees between pages | P2, P3 |
| **D-5** | "Last login": the current session or the previous one? Nothing records it today | Brian | **The previous sign-in** ("Last login: 11 October 2026, 22:26"). Recorded from deploy onwards; a family with no earlier recorded sign-in reads "First login since this page was added". One value per family login (as the quote says) | P2 |
| **D-6** | Help/amend emails outside prod: they must never reach the real fees inbox from staging or migration staging | Brian | New env var `PORTAL_ENQUIRY_INBOX` (Production = fees@johnwhitgiftfoundation.org; Preview = a Meridian test inbox). Unset → the form shows a **test-mode preview** of exactly what would be sent and sends nothing (so she can test it on migration staging, where email is off). Brian sets the vars; Claude does not run `vercel env add` | P4 |
| **D-7** | Send the parent a copy of their question? | Charlotte | No copy; on-screen confirmation "Sent to the bursary team. Our reply will come to <login email>" | P4 |
| **D-8** | Nav order and labels. Her sheet: Home · My Bursary Application(s) · My Application(s) Schedule · Help (?) · Paused Assessment page · My Details. Today there is also a Documents page | Charlotte (via email) | Home · My Bursary Application(s) · My Application(s) Schedule · Documents · Help · My Details. Missing Documents unchanged (shown only when paused, in its current place). The rail stepper nests under My Bursary Application(s) on `/apply/*` | P1 |
| **D-9** | My Details: where does the address come from? Profile has none; each child's Contact and each year's form have one | Brian | The lead's most recently updated Contact (the record the team edits when a family asks for an amendment), else the latest submitted form's parent 1 address. If the family's Contacts disagree, show the latest and say so in the amend email | P5 |
| **D-10** | My Details: her sheet has "These details are correct" beside each "I need to amend these details". Store a confirmation? | Charlotte | Not stored. Each row shows its value and "I need to amend these details"; no "correct" button (nothing would act on it). State it in the email | P5 |
| **D-11** | An email-address change is a login change (Supabase auth + Profile). There is no staff tool for it | Brian | The request goes to the fees inbox like any other; the team forwards it to Meridian, who changes it with the existing script path. No tool in this phase | P5 |
| **D-12** | Schedule "Submission status" wording | Charlotte (via email) | Scheduled · Open, not started · In progress · Submitted · Unsuccessful (D-1) · Completed through Grant Tracker (migrated year 1) | P3 |
| **D-13** | "Application Closing Date" vs "To be submitted by" — her sheet shows the same date in both | Brian | Closing = the round's window close (`submitBy` / `requiredBy`); To be submitted by = the family's own deadline (the existing E1 deadline chain, which includes any extension). Identical unless an extension was granted | P3 |
| **D-14** | Help: which reference goes in the subject when a family has several children? | Brian | The form asks "Which child is this about?" (one option per child, plus "General question"); the subject carries that child's latest application reference, or the account's child name when no application exists yet | P4 |
| **D-15** | Throttle for the question / amend forms (none exists in the app) | Brian | 5 per hour and 20 per day per login, counted from audit rows; over the limit → "Please email fees@… directly" | P4 |

---

## §3 · Ground rules

Epic 21 §3 applies in full (git flow, CI gates, migrations additive with policies in the same migration, enum caution, audit via `createAuditLog`, no jsdom → pure seams, prod blast radius in each PR, family codes not names). In addition:

- **No timeline.** Work in order; report progress per tranche.
- **Build in the sprint worktree** `../bursary-system-epic21` (it has deps and env files). One branch per tranche from fresh `origin/staging`. One tranche at a time (P1 → P5): P1–P3 share the home page, nav and schedule files.
- **Gates before every PR:** `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` · `npx prisma format --check` · `npx vitest run`. Don't run `npx prettier`.
- **Tick this plan** in each tranche's PR (its Status line).
- **Parent-facing copy is British English and plain** (her words where she gave them: "Welcome back", "You currently have X active bursaries with the John Whitgift Foundation", "Currently in Year X at <school>", "I need to amend these details"). Pages say "Application", never "Assessment" (F4).
- **Never expose staff-only data** to a parent: no assessor notes, outcomes before D-1's rule allows, financial figures, gap codes or GT documents. Every new query runs under the parent's own RLS context (`withUserContext`) unless a documented reason says otherwise.
- **Migrated families are first-class:** every page has an explicit migrated case (no current application, year 1 COMPLETE).
- **Email:** only P4/P5 send, only to `PORTAL_ENQUIRY_INBOX`, never to a parent. Nothing else in Phase 5 sends mail.

---

## §4 · Tranches and order

| P | Contents | Branch | Migration | Needs |
|---|---|---|---|---|
| **P1** | Home variants (#1) + L1 + L2 + nav restructure (D-8) | `feature/portal-home-parent-view` | none | D-3, D-8 |
| **P2** | My Bursary Application(s) (#2) + last-login recording + one progress measure | `feature/portal-my-applications` | `profiles.last_sign_in_at`, `profiles.previous_sign_in_at` | D-4, D-5 |
| **P3** | My Application(s) Schedule (#3), all of the family's accounts | `feature/portal-schedule-table` | `close_reasons.show_unsuccessful_to_family` (D-1) + its seed ticks | D-1, D-2, D-12, D-13 |
| **P4** | Help question form (#4) + the shared enquiry-mail module | `feature/portal-help-question-form` | none | D-6, D-7, D-14, D-15 |
| **P5** | My Details (#5) + L3 | `feature/portal-my-details` | `profiles.title` | D-9, D-10, D-11; P4 merged |

Merge order **P1 → P2 → P3 → P4 → P5**. After each merge: bring migration staging up (merge staging into `chore/gt-rehearsal`, no force-push; apply P2/P5 migrations by hand after checking the project ref, Epic 21 §6), browser-check, then the next tranche.

**Live load interaction.** The loader creates Profiles; P2/P5 only add nullable columns, so the loader and its rollback are unaffected. Optional toolkit follow-up (not charged): seed `profiles.title` from the GT parent title at load.

---

## §5 · Work packages

### P1 · Home (#1, L1, L2) and nav

**Status: NOT STARTED (awaiting approval).**

**Variants** (pure seam `homeVariant({ activeAccounts, hasApplication, hasInvitation })` in `src/lib/portal/home-state.ts`, extending `portalHomeMain`; unit-test every combination):
- **New family** (no ACTIVE account): heading "Welcome, {first name}"; "You currently do not have an active bursary."; with an invitation: "You have been invited to fill in the following bursary application for us to assess your household:" and the existing start/continue affordance (`ApplicationTypeChooser` or the continue card). Without an invitation: the existing `no-invitation` state.
- **Rolling-over family** (≥1 ACTIVE account): heading "Welcome back, {first name}"; "You currently have {n} active bursar{y|ies} with the John Whitgift Foundation."; one line per child: "{child name} — Currently in Year {X} at {school}". A pending invitation or an in-progress application for any child still shows its card below the list (a family can be both).
- **L1:** delete the "Your bursary portal is ready." subtitle (`page.tsx:409`). Keep the round line when there is an application.
- **L2:** a "Need help?" block on every variant with three always-visible cards: Section 1 — How to Apply, Section 2 — Checklist (each opens `/help` on that tab), Section 3 — Terms & Conditions (opens the PDF, `TERMS_AND_CONDITIONS_PATH`). Replace the quiet help line (L366-386) with it. Add a `?tab=` deep link to `PortalGuidanceTabs`.
- **D-3:** remove `ScheduleHome` from home (default); each child line links to the schedule page anchor for that child.

**Facts / helpers.**
- Children and counts: a new query `getFamilyAccountsForUser(tx, userId)` (ACTIVE accounts led by the user, with `childName`, `school`, `entryYearGroup`, `firstAssessmentYear`), under the user's RLS. Reuse the account select in `getScheduleHomeForUser` (`schedule.ts:211-239`).
- Current school year: `currentSchoolYear({ entryYearGroup, firstAssessmentYear, today })` built on `deriveCurrentYearGroupNumber` (`schooling-years.ts:251`). Cap at the school's final year (13; 11 at the OP partner school). Test the 20 August academic-year boundary.
- School name: the existing `schoolLabel`.

**Nav (D-8).** `buildPortalNav` becomes: Home · My Bursary Application(s) (`/applications`, P2; until P2 merges it keeps today's `applicationHref`) · My Application(s) Schedule (`/schedule`) · Documents · Help · My Details (`/my-details`, added by P5). The schedule item shows for any family with an account (not only the single resolved one). Update `portal-nav-schedule.test.ts` and the mobile header.

**Accept.**
- TS-NOWS01 (migration staging): "Welcome back, …"; "You currently have 3 active bursaries…"; three children, each "Currently in Year X at Trinity School" with the right year for 2026-27 (Year 8, Year 11, Year 13); the three guidance cards; no "Your bursary portal is ready".
- A demo applicant with an invitation and no account (staging): "Welcome, …", "You currently do not have an active bursary.", the invitation card.

**Blast radius.** Display only. Prod: the 2 families see the new home.

---

### P2 · My Bursary Application(s) (#2)

**Status: NOT STARTED (awaiting approval).**

**Page** `src/app/(portal)/applications/page.tsx`, nav "My Bursary Application(s)". One block per child (ACTIVE account, plus any child with an invitation or a non-migrated application but no account yet). Each block:
- Child's first name and surname as the heading; "Click on the following options to access the form."
- **Last login** (D-5): the family's previous sign-in, same on every block.
- **% Completion** (D-4) of that child's current application; "Not started" when none exists.
- **What would you like to do?** — four options, each enabled only when it applies (seam `applicationBlockActions(state)`, tested):
  - "I would like to start the application" — when the child has a pending invitation/re-assessment invite and no application: runs the existing `startApplicationAction` / `beginReassessmentAction` for that invitation.
  - "I have paused the application and would like to keep working on it" — a draft exists: `/apply/open/{id}?to=continue` (the first section not complete).
  - "I would like to see which sections still need an answer or a document upload" — a draft exists: `/apply/open/{id}?to=review`.
  - "I would like to submit the form" — a draft with no blocking gaps: `/apply/open/{id}?to=submit` (the Declaration section). Disabled with "Complete the sections listed above first" otherwise.
  - Submitted: the block says "Submitted on {date}" and offers "View status" (`/apply/open/{id}` → `/status`).
  - Migrated / between rounds: "Your next application opens on {date}" from the schedule; no actions.

**Open route.** `apply/open/[applicationId]/route.ts` accepts `?to=continue|review|submit` (whitelist; anything else is ignored), keeps the ownership check and cookie, then redirects. Pure `openTarget(to, app, sections)` tested.

**Progress (D-4).** Extract `applicationCompletion(sectionGapStatuses)` (Σsatisfied ÷ Σtotal, rounded, 0 when nothing started) from `portal-sidebar.tsx:134-152` into `src/lib/portal/`, and use it in the rail, this page, the home page and P3. Per child it costs one `getSectionGapStatuses` call; fine for a family's 1–4 children.

**Last login (D-5).** Migration `<ts>_profile_sign_in_times`: `profiles.last_sign_in_at TIMESTAMPTZ`, `profiles.previous_sign_in_at TIMESTAMPTZ`; no backfill. On each successful parent sign-in (password login action `src/app/(auth)/login/actions.ts`, the register flow's first sign-in, and `src/app/(auth)/auth/callback` if it creates a session) run `previous = last, last = now()` for that profile (admin context, one UPDATE; staff logins excluded). Seam `recordSignIn(prev)` → new values; tested.

**Accept.**
- Staging, demo applicant with two children (one draft at ~60%, one not started): two blocks; percentages match the wizard rail; each option lands on the right page for the right child; Submit is disabled while gaps remain.
- After signing out and in again, "Last login" shows the earlier sign-in.
- TS-NOWS01 (migration staging): three blocks, "Your next application opens on 15 April 2027" (the Year 13 account: no next year, so "Your bursary runs to the end of 2026-27").

**Blast radius.** Two nullable columns on `profiles`; written on each sign-in from deploy. No data changed.

---

### P3 · My Application(s) Schedule (#3)

**Status: NOT STARTED (awaiting approval).**

**Page** `/schedule` is rebuilt: one section per child — heading "{child name} — Currently in Year {X} at {school}" — then a table:

| Column | Source |
|---|---|
| Academic Year | `entry.academicYear` |
| School Year | `entryYearGroup + scheduleYear − 1` (existing, `schedule-home.ts:211-214`) |
| School | `schoolLabel(account.school)` |
| Application Opening Date | the existing opens chain (`availableOn` → window `opensOn` → round open), `schedule-home.ts:149-154` |
| Application Closing Date | window/round close (D-13) |
| To be submitted by | the E1 deadline chain incl. extensions (`schedule-home.ts:156-171`) |
| Completion Status | `applicationCompletion` of that year's application (P2); "—" for a future year; "Completed through Grant Tracker" for a migrated COMPLETE year |
| Submission Status | D-12 wording, from a pure `parentScheduleStatus(row)` |
| Submission Date | `Application.submittedAt` (D-2), else blank |

- **All of the family's accounts**, not one: replace `getPortalScheduleForUser`'s `findFirst` (the documented single-account assumption, `schedule.ts:127-168`) with a per-account list. `hasPortalSchedule` (the nav gate) becomes "any account with a visible row". Keep `showOnPortal` filtering in SQL.
- **D-1:** migration `<ts>_close_reason_show_unsuccessful`: `close_reasons.show_unsuccessful_to_family BOOLEAN NOT NULL DEFAULT false`, then tick the three default labels (an UPDATE of 3 reference rows; name it in the PR). Extend `seed-reference.ts` with the flag in **`create` only** (so a rerun never undoes her Settings edits) and add the tick to Settings → Close Reasons (audited like the other reference edits). Include a CLOSED account in the schedule only when its `closeReason.showUnsuccessfulToFamily` is true: rows up to and including the year of the last application, that year "Unsuccessful", later rows dropped. Every other CLOSED account stays hidden, as today. Check `loadPortalAccessState` (`src/lib/bursary-accounts/access.ts:77`) so such a family is not bounced to `/portal-closed` before seeing it — if they would be, keep today's behaviour and raise it with Brian rather than widening access.
- Rows link nowhere (her sheet has no actions here; P2 is the place to act).
- The old badge-list component `schedule-calendar.tsx` and `buildPortalScheduleRows` are retired once nothing uses them; keep `STATE_LABELS` only if still referenced.

**Seams and tests.** `parentScheduleStatus` (every status, migrated year 1, unsuccessful, submitted-then-paused keeps "Submitted" and the original date), `scheduleRowsForParent(account, entries, apps, today)`; extend `schedule-home.test.ts` for the shared date chains.

**Accept.**
- TS-NOWS01 (migration staging): three tables (Year 8 account: 2026-27 … 2031-32; Year 11: 2026-27 … 2028-29; Year 13: 2026-27 only); 2026-27 rows "Completed through Grant Tracker"; later rows 15 April / 21 May / "Scheduled"; a row hidden with the T5 toggle is absent.
- Staging: a submitted demo application shows its submission date; pausing and resuming it (admin) leaves the date unchanged (D-2).

**Blast radius.** One new column on `close_reasons` (3 rows ticked). Prod: no CLOSED accounts today, so no family sees a change until one is closed with a ticked reason.

---

### P4 · Help question form (#4)

**Status: NOT STARTED (awaiting approval).**

**Shared module** `src/lib/portal/enquiry.ts` (also used by P5):
- `composeEnquiry({ kind: 'QUESTION' | 'DETAILS_AMEND', parent, child?, reference?, body, field? })` → `{ subject, text }`. Pure, tested. Subject: `Bursary portal question — {reference}` (or `— {child name} (no application yet)` / `— general question`); P5 uses `Details change request — {reference or parent name}`. Body: parent name, login email, child, reference, the question, sent time (Europe/London), and an admin link to the application.
- `sendEnquiry(...)`: refuses when the throttle (D-15) is exceeded; sends with `sendRawEmail` to `PORTAL_ENQUIRY_INBOX` with **Reply-To = the parent's login email** (extend `sendRawEmail`'s options with `replyTo`; default unchanged for every other caller); writes an audit row `PORTAL_ENQUIRY_SENT` (metadata: kind, child account id, reference, EmailLog id — **not** the question text). D-6 test mode: inbox unset → return the composed email for an on-page preview, send nothing, audit `PORTAL_ENQUIRY_PREVIEWED`.
- Add the new audit keys to `AUDIT_ACTIONS`.

**Page** `/help`: at the top, "If you want to ask the bursary team a question as you are filling in the form, or if you are stuck, please email us directly using the section below." Then: child picker (D-14), the question (required, 10–5,000 characters), "Your question will be sent with your bursary reference directly to fees@johnwhitgiftfoundation.org." and "Our reply will be sent to {login email}." Below the form, the existing guidance tabs (unchanged). The server action runs as the parent (ownership of the chosen child checked server-side).

**Env (D-6).** Tell Brian to add `PORTAL_ENQUIRY_INBOX` (Production: fees@johnwhitgiftfoundation.org; Preview: a Meridian test inbox; `rehearsal` unset → preview mode). Document it in `.env.example`.

**Accept.**
- Staging (Preview inbox set): a question about one child arrives at the test inbox with "Bursary portal question — {reference}" in the subject; replying in the mail client addresses the parent's login email.
- Migration staging (unset): TS-NOWS01 sees the test-mode preview, nothing is sent, the audit row exists.
- The sixth question within an hour is refused with the fallback message.

**Blast radius.** No data change. Prod sends only when a parent submits the form.

---

### P5 · My Details (#5, L3)

**Status: NOT STARTED (awaiting approval).**

**Migration** `<ts>_profile_title`: `profiles.title TEXT` (nullable). No backfill; display falls back to the latest form's `parent1Contact.title` until the parent saves one.

**Page** `/my-details`, nav "My Details". Rows (her order): Title · Surname · First name · Address · Email address · Login / password.
- **Title:** editable inline (the same options as `parentTitleSchema`), saved to `profiles.title` under the parent's own RLS (`profiles_update_self`); audited `PROFILE_TITLE_CHANGED`.
- **Surname, first name, email:** from Profile. **Address:** D-9.
- Each of those rows: "I need to amend these details" → a short text box "What should it say?" → `sendEnquiry({ kind: 'DETAILS_AMEND', field, current, requested })` (P4 module, same inbox and throttle); confirmation "Sent to the bursary team, who will update it and reply to {login email}". No "These details are correct" button (D-10).
- **Login / password:** "Change your password" → `/reset-password` with the email prefilled (the existing self-service flow). No email to the team.
- **L3:** `parent-details-form.tsx:139` now says the details are on "My Details" and links to `/my-details`.
- Seam: `detailsRows({ profile, contacts, latestForm })` (sources and fallbacks, D-9), tested.

**Accept.**
- TS-NOWS01 (migration staging): the page shows the parent's name, the address from the latest Contact, the login email; changing the title persists across sign-out; an amend request shows the test-mode preview.
- Staging: an amend request reaches the test inbox with "Details change request — …" and Reply-To the parent.

**Blast radius.** One nullable column on `profiles`; written only when a parent saves a title.

---

## §6 · Validation path for every tranche

As Epic 21 §6:
1. Local gates.
2. PR → staging, CI green; smoke-test on the staging preview (`brian.admin@jwf-bursary.test` and a demo applicant).
3. Merge (standing authority for green PRs without data backfills; P2/P5 add columns only). **P3's migration ticks 3 reference rows: ask Brian before merging it.**
4. Migration staging: merge staging into `chore/gt-rehearsal` (no force-push); apply P2/P5 migrations by hand after checking the project ref is `ldqpzjizqvrairoojker`; wait for the `rehearsal` deploy; browser-check as admin and as the TS-NOWS01 family.
5. One email to Charlotte when all five are on migration staging, by family code, stating the defaults taken in §2.
6. Promotion (`staging → main`) only on Brian's explicit instruction, after her OK.

---

## §7 · Out of scope (logged, not built)

- **The Paused Assessment page** (her free-text-with-screenshots note, parent comments box, named uploads, greyed-after-submit, the menu item turning red). Parked by her 13 Oct; `/respond` and the gold Missing Documents item stay as they are.
- An admin tool to change a parent's login email (D-11).
- Storing a "details confirmed" date (D-10).
- Showing outcomes other than "Unsuccessful" (D-1) — awards are communicated as today.
- Any portal mailbox or reply thread — replies come by email (her requirement, 13 Oct).
- Anything new she raises while testing goes to a new quote.
