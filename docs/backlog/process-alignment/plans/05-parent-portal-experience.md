---
title: Parent portal experience — guidance, drafts, deadlines & history
status: planned
severity: high
area: portal
wave: 2
depends_on: [01, 02, 03]
blocks: []
sources:
  - ../source-materials/feedback.md            # asks #2 (Section 1/2 tabs), #3 (T&Cs), #4 (new-vs-rolling); canonical statuses
  - ../source-materials/meeting-findings.md     # "Parent portal behavior"
  - ../source-materials/application-form-scoping.md  # Section 1 How-to-Apply + Section 2 Checklist copy
  - ../source-materials/terms-and-conditions.pdf     # parent T&Cs to display on the home page
related:
  - 00-current-state-map.md
  - 01-status-and-workflow-model.md
  - 02-application-form-rescope.md
  - 03-round-management.md
---

# 05 — Parent portal experience

**Objective.** Turn the parent portal from a single-application view into a
**guided, deadline-aware, multi-round account**. Add the home-page *How to
Apply* / *Checklist* tabs and an in-portal **T&Cs viewer**; surface the
new-vs-rolling choice as **two mutually-exclusive cards** (the inactive one
disabled); let parents **save and return** before the deadline behind a
**countdown banner + deadline-missed lockout**; give a **read-only submitted
summary** with a **downloadable submission PDF**; preserve **historic
summaries** across rounds and show the **upcoming-rounds lineup** for active
recipients; let parents **upload requested missing documents** through the
portal **without moving the submission date**; and **trim the internal status
leakage** so parents only ever see parent-safe labels.

This epic is the parent-facing pay-off of the lifecycle split in **01** and the
form rebuild in **02**, keyed to the per-application deadline introduced in
**03**. It consumes those primitives; it does not redefine them.

---

## 1. Background & rationale

[`feedback.md`](../source-materials/feedback.md) carries four explicit home-page
asks: **#2** "add two tabs on the left, *Section 1* and *Section 2*, covering the
*how to apply* and *checklist* aspects"; **#3** "attach and display [the T&Cs] on
the home page"; **#4** "create two visual options … one of the two needs to be
disabled when one is activated so that the parents do not fill the incorrect
form" — a **new application** (full form, mandatory ID section) vs a
**rolling-over** application (ID section hidden). The same note pins the
canonical form statuses (Created → Not started → In progress → Filled in →
**Received** for new / **Submitted** for rolling) and ties each submitted state
to "a submission summary PDF downloadable option … offered to the applicant".

The "Parent portal behavior" block of
[`meeting-findings.md`](../source-materials/meeting-findings.md) is the rest of
the scope, almost line-for-line:

> save drafts and return later **before deadline** · prevent editing once the
> **submission deadline has passed** · clear **banner/countdown** with time
> remaining · clear **deadline missed** state · after submission a **read-only
> summary** · **download submitted application as PDF** · preserve historic
> **submitted summaries/PDF downloads** · do **not** expose editable submitted
> applications · **remove/limit parent-facing status visibility** · expand to a
> **multi-round/account history view** · show the **lineup of upcoming rounds**
> for active recipients · parent-side upload of **requested missing documents
> through the portal** while **keeping the submission date intact** · keep the
> manual admin-side document attach flow too.

The copy for the two home-page tabs already exists in the scoping workbook:
[`application-form-scoping.md` §"Section 1 — How to Apply"](../source-materials/application-form-scoping.md)
(intro + FAQ topics + guidance notes) and §"Section 2 — Checklist" (upload
guidance + the document checklist, with the rider that **identity docs are only
required on the FIRST application** — the new-vs-rolling distinction that
motivates ask #4). The T&Cs document to display is
[`terms-and-conditions.pdf`](../source-materials/terms-and-conditions.pdf)
(present in source-materials; the parent's "legal customer" terms on accepting
an award).

---

## 2. Current state

See [00 §B](00-current-state-map.md#b-parent-application-form-srcappportal) and
[00 §C](00-current-state-map.md#c-status--workflow-transitions). In brief:

- **Landing page already branches three ways**
  (`(portal)/page.tsx`): an existing application shows a status card +
  "Sections complete X of 10" + Continue (`:182`, `:258`); a first-year invite
  with no application renders `OnboardingCard` (`:345`,
  `onboarding-card.tsx`); a pending re-assessment invite renders
  `ReassessmentCard` (`:338`, `reassessment-card.tsx`); else a neutral
  fallback (`:349`). So a **new-vs-rolling distinction already exists** — but as
  *two different cards shown in different states*, never as **two side-by-side
  options where the wrong one is visibly disabled**, and with **no How-to-Apply
  / Checklist / T&Cs anywhere on the landing page**. T&Cs text currently appears
  only inside the declaration step (per [00 §B](00-current-state-map.md#b-parent-application-form-srcappportal)).
- **Status leaks internal states to parents.** `(portal)/status/page.tsx:44`
  maps the fused enum to parent labels but still surfaces internal workflow:
  `NOT_STARTED → "Under Review"`, `PAUSED → "Paused"`, `COMPLETED → "Completed"`
  (`:47`), and an outcome card keyed on `QUALIFIES`/`DOES_NOT_QUALIFY` (`:218`,
  `:380`). The landing page reuses the same enum through a `toBadgeStatus`
  shim (`(portal)/page.tsx:30`) over the stale `status-badge.tsx`.
- **Submission summary is thin.** `(portal)/submitted/page.tsx` shows reference,
  submission date (`:50`), child name and round — a confirmation screen, **not a
  re-openable read-only render of what was submitted**, and **no PDF**. PDF
  generation exists only for the **assessor** recommendation
  (`/api/pdf/recommendation/[applicationId]/route.tsx`, `@react-pdf/renderer`,
  `runtime = "nodejs"`, renderer in `src/lib/pdf/recommendation-pdf.tsx`) — a
  parent-facing submission PDF is **new**.
- **No deadline mechanics.** Deadlines are round-level only
  (`Round.closeDate @db.Date`, no time-of-day — `schema.prisma:42`);
  `Invitation.expiresAt` is +30d and governs **registration**, not submission
  (`schema.prisma:424`). There is **no countdown, no lockout**, and **no
  per-application submission-by column** anywhere
  ([00 §D](00-current-state-map.md#d-rounds--invitations)). The footer copy
  *"Forms submitted late will not be assessed"* exists in the workbook but is
  not enforced.
- **Drafts already persist, but informally.** Each section saves JSONB and flips
  `isComplete`; the draft application sits at `PRE_SUBMISSION`
  (`apply/actions.ts:98`, `:139`) and "Continue" resumes it. There is **no
  explicit save-and-return affordance**, no "you can come back before <date>"
  framing, and **nothing stops edits after the deadline**.
- **Account is single-shot.** `BursaryAccount` (`schema.prisma:54`) is the
  per-child spine (ACTIVE/CLOSED, `firstAssessmentYear`, `entryYear`), but the
  portal only ever loads the **most-recent** application
  (`status/page.tsx:174` "any status", `submitted/page.tsx:27` most-recent
  SUBMITTED). There is **no multi-round history list** and **no upcoming-rounds
  lineup** (the forward schedule itself is Epic 10).
- **Missing-docs respond exists but is a status flip, not an upload.**
  `(portal)/actions.ts:291` `submitMissingDocsResponse` requires `PAUSED`
  (`:317`) and flips `PAUSED → NOT_STARTED` (`:327`, audit
  `MISSING_DOCS_RESPONDED` `:332`), emailing the assessor. The `/respond` page +
  `respond-client.tsx` host it. It **does not attach documents to the form**,
  does not retro-populate any section, and there is no portal upload that
  back-fills while holding `submittedAt`. The admin-side attach flow
  (`/api/documents`, [00 §B](00-current-state-map.md#b-parent-application-form-srcappportal))
  stays.

---

## 3. Target state

Everything below is **parent-facing presentation over 01/02/03 primitives** —
this epic adds no new lifecycle states, only views, guards, and copy.

### 3.1 Home page (information architecture)

The portal landing page gains a persistent left rail with two guidance tabs
above the application area, plus a T&Cs viewer:

- **Section 1 — How to Apply** and **Section 2 — Checklist** tabs, populated
  from the workbook copy
  ([scoping §1/§2](../source-materials/application-form-scoping.md)). Static,
  always reachable (before, during, and after an application), and identical for
  new and rolling applicants — except the Checklist's **identity-documents**
  block is shown as *"first application only"* and de-emphasised for rolling-over
  accounts.
- **Terms & Conditions** — `terms-and-conditions.pdf` rendered inline (viewer +
  download), reachable from the home page (ask #3). Acceptance is **recorded per
  submission** (Decision **D10**) — captured at the declaration step in Epic 02;
  this epic provides the *display* surface and links the recorded acceptance into
  the submitted summary.
- **Two application-type cards, mutually exclusive.** Where today a single card
  appears, show **both**: *New application* (full form incl. mandatory ID
  section) and *Rolling-over re-assessment* (ID section hidden). The card that
  matches the applicant's eligibility is **active**; the other is **rendered
  disabled** with a one-line reason ("You have an active bursary — this is a
  re-assessment year" / "This is a new application"). Eligibility is derived from
  the **invitation type** (first-year vs re-assessment) and the
  `Application.applicationType` from Epic 01 — *not* a free choice. This makes the
  existing implicit branch explicit and fool-proof, per ask #4.

### 3.2 Drafts, countdown & lockout

- A parent may **save and return** to a draft any number of times **before the
  per-application deadline**. (Section-level persistence already does the
  saving; this epic adds the explicit affordance + framing.)
- A **countdown banner** shows time remaining to submit, keyed on the
  **per-application submission-by datetime** from Epic 03 (falling back to
  `Round.closeDate` end-of-day where no per-app override is set). It renders on
  the dashboard and inside the wizard while the form is editable.
- When the deadline passes on a still-unsubmitted application, the portal enters
  a **deadline-missed lockout**: the form becomes read-only, the *Continue* /
  *Submit* actions are removed, and a clear "submission deadline passed" state is
  shown (mirroring the workbook's "Forms submitted late will not be assessed").
  Lockout is **presentation + server-guard**: the submit action rejects after the
  deadline so a stale tab cannot post.

### 3.3 Submitted summary & PDF

- After submission the application is **read-only**. The summary screen renders
  **what was submitted** — section-by-section answers + the list of uploaded
  documents + recorded T&Cs acceptance — not just the reference + date.
- A **"Download submission (PDF)"** action generates a parent-facing PDF of that
  same submitted snapshot. Per the canonical-status note, the download option is
  **offered** at submission and the offer "goes away if the applicant presses
  no" — modelled as a dismissible offer that does not block, while the PDF stays
  available from the history view indefinitely.
- The submitted state is labelled **"Received"** for new applications and
  **"Submitted"** for rolling-over, via the parent-safe projection from Epic 01
  (Decision **D2**). `submittedAt` is immutable (enforced in 01) — the summary
  and PDF always show the original date even after later document requests.

### 3.4 Multi-round account history & upcoming lineup

- The portal expands from "your one application" to an **account history**: a
  list of every application/round for this lead applicant's child(ren), each
  linking to its **preserved read-only summary + PDF**. Prior years are
  reference-only and never re-open as editable forms.
- For **active recipients**, show the **upcoming-rounds lineup** — the
  future/dormant rounds the account is scheduled into. The schedule itself is
  generated by Epic 10; this epic renders it (and shows an empty/neutral state
  until 10 lands).

### 3.5 Portal missing-document upload (submission date preserved)

- Extend the paused/missing-docs flow so the parent can **upload the requested
  documents directly in the portal**. Uploaded files attach to the application
  and **retro-populate** the relevant section data, while **`submittedAt` stays
  fixed** and the **form status stays Submitted/Received** — only the
  **assessment** moves (Paused → resumes), exactly the lifecycle independence
  01 unlocks.
- The existing **status-flip respond** action becomes one outcome of this richer
  flow; the **admin-side attach** path is retained for parents who still email
  documents.

### 3.6 Trimmed status visibility

- Parents see a **single parent-safe projection** of where things stand
  (e.g. *Draft → Received/Submitted → Being assessed → Outcome*), never the raw
  assessment internals (`IN_PROGRESS`, `PAUSED`) or the outcome enum names. The
  projection is the read-only consumer of Epic 01's mapping surface; this epic
  owns the labels, copy, and which steps are even shown to a parent.

---

## 4. Gap analysis

| # | Target | Today | Action |
|---|---|---|---|
| 1 | Home-page *Section 1 / Section 2* guidance tabs | none on landing (`page.tsx`); copy only in workbook | New static tabbed guidance from scoping §1/§2 |
| 2 | In-portal T&Cs viewer on home page | T&Cs only in declaration step | Render `terms-and-conditions.pdf`; link recorded acceptance (D10) |
| 3 | Two mutually-exclusive type cards (one disabled) | implicit branch: onboarding **xor** reassessment card (`:338`/`:345`) | Show both; disable the non-matching one; derive from invite + `applicationType` (01) |
| 4 | Save-and-return framing before deadline | section saves exist; no affordance/framing | Explicit save-and-return UI over existing persistence |
| 5 | Countdown banner | none | Client countdown keyed on per-app deadline (03) |
| 6 | Deadline-missed lockout | none; late submit not blocked | Read-only lockout + server-side submit guard |
| 7 | Read-only submitted **summary of answers** | confirmation screen only (`submitted/page.tsx`) | Render submitted section snapshot + docs + acceptance |
| 8 | Parent-facing **submission PDF** | only assessor recommendation PDF | New `/api/pdf/submission/[applicationId]` + renderer |
| 9 | "Received" vs "Submitted" label | both surfaced as internal enum | Parent-safe label from `applicationType` (01, D2) |
| 10 | Multi-round account history | most-recent app only | History list over `BursaryAccount` applications |
| 11 | Upcoming-rounds lineup (active) | none | Render schedule from Epic 10 (empty state until then) |
| 12 | Portal missing-doc upload, `submittedAt` preserved | status-flip only (`actions.ts:291`) | Upload + retro-populate; hold `submittedAt`; resume assessment |
| 13 | Trim internal status leakage | leaks relabelled internals (`status/page.tsx:47`) | Single parent-safe projection; drop internal steps |

---

## 5. Proposed approach

This epic is **mostly UI + a thin server surface**. The only schema it *owns* is
optional acceptance/PDF bookkeeping; the load-bearing columns
(`formStatus`, `applicationType`, immutable `submittedAt`, per-app deadline)
come from **01** and **03** and are treated as inputs.

### 5.1 Schema (Prisma + migration)

Minimal and additive. Most state already exists or arrives from 01/03.

```prisma
model Application {
  // (from 01) formStatus, applicationType, immutable submittedAt
  // (from 03) submissionDeadline DateTime?  ← per-app countdown/lockout key
  // + termsAcceptedAt   DateTime?   // when the parent accepted T&Cs for THIS submission (D10)
  // + termsVersion      String?     // which T&Cs doc/version was accepted
}
```

- **T&Cs acceptance per submission (D10).** Record `termsAcceptedAt` +
  `termsVersion` on the application at submit. (Acceptance is *captured* at the
  declaration step rebuilt in Epic 02; this epic defines the columns and reads
  them into the summary/PDF. If 02 lands them first, 05 only consumes.)
- **No new status columns.** Draft = `formStatus IN (NOT_STARTED, IN_PROGRESS,
  FILLED_IN)`; submitted = `SUBMITTED`; the countdown/lockout reads
  `submissionDeadline` (03), the history reads `BursaryAccount`, the upcoming
  lineup reads the Epic-10 schedule.
- **Submitted snapshot.** Prefer rendering the read-only summary + PDF from the
  **live section JSONB**, which is safe because the form is immutable post-submit
  and `submittedAt` is enforced (01). A frozen point-in-time `submissionSnapshot
  Json?` is **deferred** (see §9) unless retro-population (§5.2) is judged to
  mutate section data visibly — in which case capture the snapshot **at submit**
  in the same PR as the upload flow.

### 5.2 Server actions / API

- **Parent-safe projection (read model).** A `lib/portal/status-projection.ts`
  helper consumes Epic 01's mapping surface and returns
  `{ step, label, tone, showOutcome }` for parents — the **single** place portal
  views call. Replaces the inline maps in `status/page.tsx:44` and the
  `toBadgeStatus` shim in `page.tsx:30`. No internal enum names cross into the
  portal.
- **Deadline guard.** A `lib/portal/deadline.ts` helper resolves the effective
  submission datetime (`Application.submissionDeadline` ?? end-of-day
  `Round.closeDate`) and exposes `isPastDeadline(app)` /
  `timeRemaining(app)`. The **submit action** (`apply/actions.ts`, around the
  `SUBMITTED` write at `:463`) calls `isPastDeadline` and **rejects** after the
  deadline (server-side lockout), in addition to the UI hiding the control.
- **Submitted-summary loader.** A query returns the submitted application's
  section data + documents + `termsAcceptedAt/Version`, scoped under the
  applicant's RLS context (mirrors the existing `withUserContext` reads), for
  both the on-screen summary and the PDF route.
- **Submission PDF.** New `GET /api/pdf/submission/[applicationId]` mirroring the
  recommendation route (`@react-pdf/renderer`, `runtime = "nodejs"`,
  `requireApplicationAccess`), but **applicant-scoped** (lead applicant may fetch
  **their own** submitted application's PDF; reuses `withUserContext` + RLS).
  New renderer `src/lib/pdf/submission-pdf.tsx`.
- **Account history loader.** Lists applications for the signed-in lead
  applicant across rounds (via `BursaryAccount` / `leadApplicantId`), newest
  first, each with status + submitted date + links to summary/PDF.
- **Portal missing-doc upload.** Extend the `/respond` flow: accept uploads via
  the existing `/api/documents` attach path, then **retro-populate** the targeted
  section JSONB and resume the assessment (Paused → in-progress) **without
  touching `formStatus` or `submittedAt`**. Generalises
  `submitMissingDocsResponse` (`actions.ts:291`) so the status-flip is one branch
  and the upload+backfill is the other. Emits the same `MISSING_DOCS_RESPONDED`
  audit + assessor email already wired at `actions.ts:332`/`:371`. The
  invariant — **submission date fixed while documents arrive late** — is the
  payoff of 01 and a §10 acceptance criterion.

### 5.3 UI

- **Home page (`(portal)/page.tsx`) re-architecture.**
  - **Guidance rail:** a `PortalGuidanceTabs` component with *Section 1 — How to
    Apply* and *Section 2 — Checklist* panels (content from scoping §1/§2) plus a
    *Terms & Conditions* entry opening the PDF viewer. Always present, regardless
    of application state. (Left-rail placement per ask #2; on mobile collapses
    above the application area.)
  - **T&Cs viewer:** `TermsViewer` rendering `terms-and-conditions.pdf` inline
    with a download link.
  - **Application-type cards:** replace the single onboarding/reassessment branch
    (`:335`–`:346`) with an `ApplicationTypeChooser` showing **both** cards;
    the eligible one active, the other **disabled** with reason text. Reuses the
    existing `OnboardingCard` / `ReassessmentCard` bodies as the *active*
    content; the disabled card is a muted shell. Mutual exclusivity is enforced
    by eligibility, not by a toggle the parent can flip.
- **Countdown banner:** `SubmissionCountdown` (client) reading the resolved
  deadline; shows time remaining, switches to an **amber "closing soon"** state
  near the cut-off and a **"deadline passed"** state after. Rendered on the
  dashboard card and at the top of the wizard.
- **Deadline-missed lockout:** when past deadline and unsubmitted, the dashboard
  hides *Continue* (`page.tsx:288`) and shows the locked state; the wizard pages
  render read-only.
- **Submitted summary (`(portal)/submitted/page.tsx` → a reusable view):**
  expand from the current confirmation card (`:90`) into a **read-only render of
  the submitted answers + documents + acceptance**, with a **"Download
  submission (PDF)"** button and the dismissible-offer behaviour. The same view
  backs each history entry.
- **Status page (`(portal)/status/page.tsx`):** swap the internal maps (`:44`,
  `:104`, `:218`) for the parent-safe projection; the timeline shows only
  parent-meaningful steps (Draft → Received/Submitted → Being assessed →
  Outcome). Drop the `QUALIFIES`/`DOES_NOT_QUALIFY` literals in favour of the
  projection's outcome view.
- **Account history + upcoming lineup:** a new portal page (e.g.
  `(portal)/history`) listing past applications (read-only summaries/PDFs) and,
  for active recipients, the **upcoming-rounds lineup** (data from Epic 10; empty
  state until then). Add it to the portal nav.
- **Badges:** consume Epic 01's typed parent badge (or the projection's `tone`);
  remove the stale `status-badge.tsx` dependency from the portal
  (`page.tsx:23`, `:30`) — coordinated with 01's badge cleanup.

### 5.4 Seed / reference data

- No reference-data change. Extend **`seed:demo`** so fixtures exercise the new
  views: at least one **submitted** application with a downloadable summary, one
  **rolling-over active** account with **historic** prior-year summaries and an
  **upcoming-rounds** entry, one **paused/missing-docs** application to drive the
  portal upload, and one application with a **near/elapsed deadline** to show the
  countdown and lockout states. Guidance copy and the T&Cs PDF are static assets,
  not seed data.

---

## 6. Work breakdown (PR-sized)

- [ ] **PR-1 (home-page guidance + T&Cs):** `PortalGuidanceTabs` (*Section 1* /
      *Section 2* from scoping §1/§2) + `TermsViewer` for
      `terms-and-conditions.pdf`; wire into `(portal)/page.tsx`. Static, no
      schema. *(Ships independently of 01/02/03.)*
- [ ] **PR-2 (application-type chooser):** `ApplicationTypeChooser` showing both
      cards with the non-eligible one disabled; eligibility from invite type +
      `applicationType`. Reuses existing onboarding/reassessment bodies.
- [ ] **PR-3 (parent-safe projection):** `lib/portal/status-projection.ts`;
      replace inline maps in `status/page.tsx` + the `toBadgeStatus` shim; trim
      internal steps. *(Depends on 01.)*
- [ ] **PR-4 (countdown + lockout):** `lib/portal/deadline.ts`,
      `SubmissionCountdown`; dashboard + wizard banners; read-only lockout;
      **server-side submit guard** in `apply/actions.ts`. *(Depends on 03 for the
      per-app deadline; falls back to `closeDate` until then.)*
- [ ] **PR-5 (submitted summary + PDF):** read-only submitted-answers view;
      `/api/pdf/submission/[applicationId]` + `submission-pdf.tsx` renderer;
      dismissible download offer; "Received/Submitted" label. *(Depends on 01 for
      label + immutability; reads 02's section model.)*
- [ ] **PR-6 (account history + upcoming lineup):** `(portal)/history` page over
      `BursaryAccount`; preserved read-only summaries/PDFs; upcoming-rounds
      lineup (empty until Epic 10); add to portal nav.
- [ ] **PR-7 (portal missing-doc upload + acceptance columns):** generalise
      `submitMissingDocsResponse` into upload + retro-populate keeping
      `submittedAt`/`formStatus` fixed; add `termsAcceptedAt`/`termsVersion`
      columns + read them into the summary/PDF. *(Depends on 01 lifecycle
      independence; coordinate D10 capture with 02.)*

Ordering note: PR-1/PR-2 are deliverable ahead of the Wave-1/Wave-2 dependencies
and unblock client testing of the home-page asks (#2/#3/#4) early; PR-3→PR-7
land as 01/02/03 settle.

---

## 7. Open decisions

- **D2** — single submitted state with a derived **"Received" (new) /
  "Submitted" (rolling)** label. *(default: yes — single state, derived label.)*
  Drives §3.3, §5.2 projection. — [register](../README.md#5-decision-register).
- **D10** — `terms-and-conditions.pdf` is the final wording **and** acceptance is
  recorded **per submission**. *(default: display + record per submission.)*
  Drives the T&Cs viewer (§3.1) and the `termsAcceptedAt/Version` columns
  (§5.1). — [register](../README.md#5-decision-register).
- Inherited from **03**: whether the per-application deadline is a full datetime
  (needed for a precise hour/minute countdown) or a date with an assumed
  end-of-day cut-off. 05 reads whatever 03 provides; until 03 lands, the
  countdown/lockout fall back to end-of-day `Round.closeDate`.
- Copy confirmation: the *Section 1/2* tab and home-page T&Cs **display wording**
  should be lifted verbatim from the workbook / PDF; the scoping transcription
  summarises some FAQ answers, so the verbatim source is authoritative
  ([scoping note](../source-materials/application-form-scoping.md)).

---

## 8. Risks & mitigations

- **Hard dependency on 01/02/03.** Most of this epic is meaningless without the
  parent-safe projection (01), the rebuilt form/sections + declaration capture
  (02), and the per-app deadline (03). *Mitigation:* sequence so PR-1/PR-2
  (pure home-page guidance + the type chooser) ship first against today's
  primitives; gate PR-3→PR-7 behind the upstream merges; the deadline helper
  degrades to `closeDate` so PR-4 is demoable before 03.
- **Retro-population vs immutable submission.** Portal uploads that back-fill
  section data could *look* like the submitted application changed. *Mitigation:*
  keep `submittedAt`/`formStatus` provably fixed (01 trigger), and if the
  submitted **answers** must read exactly as at submission, freeze a
  `submissionSnapshot` at submit (§5.1) and render the summary/PDF from it rather
  than from live JSONB.
- **PDF parity / cost.** A second `@react-pdf/renderer` route on a Node runtime
  adds build + cold-start weight. *Mitigation:* reuse the recommendation route's
  shape and shared PDF primitives; generate on demand (no storage); applicant-RLS
  scope so a parent can only fetch their own.
- **Status-leak regressions.** Several portal surfaces read the fused enum today.
  *Mitigation:* route **every** portal status read through the projection helper
  and grep-gate direct enum/label usage in the portal, the same way 01 gates its
  status-service writers.
- **Disabled-card confusion.** A visibly disabled card must explain *why* or
  parents will think the portal is broken. *Mitigation:* always render reason
  copy and a "contact the Foundation" link on the disabled card.

---

## 9. Out of scope / deferred

- **Per-application deadline column & editable round dates** → **Epic 03** (05
  only reads the deadline and enforces the parent-side lockout).
- **Lifecycle states, immutable `submittedAt`, the parent-safe mapping surface,
  the new/rolling `applicationType`** → **Epic 01** (05 consumes them).
- **The form rebuild itself** (income sub-tables, ID-section new-vs-rolling
  variant, real declaration text + T&Cs acceptance capture) → **Epic 02** (05
  renders the home-page entry points and the post-submission read-only view, not
  the editable form).
- **Generating the forward round schedule** that feeds the upcoming-rounds lineup
  → **Epic 10** (05 renders it; shows an empty state until then).
- **Revoking portal access for closed accounts** → **Epic 10** (history remains
  read-only-visible while access policy is decided there).
- **Frozen `submissionSnapshot` JSONB** — deferred unless §8 retro-population
  forces it; default is to render from immutable live JSONB.

---

## 10. Acceptance criteria

- The portal home page shows **Section 1 — How to Apply** and **Section 2 —
  Checklist** tabs (workbook copy) and an inline **T&Cs viewer/download** of
  `terms-and-conditions.pdf`, available before/during/after an application.
- The home page presents **two application-type cards**; exactly **one is
  active** and the other is **visibly disabled with a reason**, derived from the
  applicant's eligibility — a parent cannot start the wrong form.
- A parent can **save and return** to a draft before the deadline; a
  **countdown banner** shows time remaining keyed on the **per-application**
  deadline; once it passes, the form is **read-only** and the **submit action is
  rejected server-side**.
- After submission the parent sees a **read-only summary of the submitted
  answers + documents + recorded T&Cs acceptance** and can **download a
  submission PDF**; the offer is dismissible and the PDF stays available from
  history.
- The submitted state reads **"Received"** for new and **"Submitted"** for
  rolling applications; the displayed **submission date never changes** even
  after later document requests.
- The portal shows a **multi-round account history** with each prior round's
  **preserved read-only summary/PDF** (never an editable form), and an
  **upcoming-rounds lineup** for active recipients (empty state until Epic 10).
- A parent can **upload requested missing documents in the portal**; the upload
  **retro-populates** the relevant section and resumes the **assessment**, while
  `submittedAt` and the **Submitted/Received** form status stay fixed; the
  admin-side attach path still works.
- **No internal workflow state** (`IN_PROGRESS`, `PAUSED`, raw outcome enum
  names) is ever shown to a parent — every portal status read goes through the
  parent-safe projection (grep-gate clean).
