---
title: Current-state map — grounded snapshot of the build
status: reference
area: program
opened: 2026-06-05
opened_by: process-alignment program
related:
  - ../README.md
  - prisma/schema.prisma
---

# 00 — Current-state map

A grounded snapshot of how the system works **today** (as of 2026-06-05),
captured from a full read of the codebase. Every epic plan cites this
document instead of re-deriving current state, so the gap analyses stay
consistent. Line references are `path:line` against the repo at the time
of writing — treat them as signposts, re-confirm before editing.

> **Headline:** the data model is materially further along than the client
> feedback assumes. Several "new" asks are *rework of existing primitives*,
> not greenfield. The single biggest structural problem is that
> `ApplicationStatus` collapses three independent lifecycles into one enum.

---

## A. Data model & enums (`prisma/schema.prisma`)

**Core spine that already exists:**

- `Profile` (`:13`, `role: Role`) — the lead applicant *is* a Profile;
  there is **no separate admin-managed contact record**.
- `BursaryAccount` (`:54`) — persistent per-child spine, `status` ACTIVE/CLOSED
  (`:615`), `closedAt`, `firstAssessmentYear`, `entryYear`. The "rolling
  account" concept partially exists but has **no forward schedule** of future
  rounds.
- `Application` (`:80`) — `roundId`, `bursaryAccountId?`, `school`, `entryYear?`,
  `isReassessment: Boolean` (`:91`), `status: ApplicationStatus`,
  `submittedAt?` (`:94`). New-vs-rollover is *inferred* from
  `bursaryAccountId == null` + `isReassessment`, not modelled explicitly.
- `ApplicationSection` (`:126`) — form data is **JSONB per section**
  (`data: Json`) keyed by `ApplicationSectionType` (10 values) and
  `ownerContributorId`. This is how the wizard persists.
- `ApplicationContributor` (`:156`, PRIMARY/SECONDARY, `@@unique([applicationId, role])`)
  — the **dual-parent model** already shipped.
- `Assessment` (`:209`, 1:1 with Application) + `AssessmentEarner`,
  `AssessmentProperty`, `AssessmentChecklist` (6 free-text tabs), `Recommendation`
  (`:309`, separate model), `ReasonCode` (`:335`, M:N), `SiblingLink` (`:359`).
- Reference data: `FamilyTypeConfig`, `SchoolFees`, `CouncilTaxDefault` — all
  versioned by `effectiveFrom @db.Date`.
- `Invitation` (`:411`, applicant) and `StaffInvitation` (`:442`, staff) —
  **already two separate models / code paths**.

**The enum problem (`:525`):**

```prisma
enum ApplicationStatus {            // conflates 3 lifecycles
  PRE_SUBMISSION  SUBMITTED         // form lifecycle
  NOT_STARTED  PAUSED  COMPLETED    // assessment lifecycle
  QUALIFIES  DOES_NOT_QUALIFY       // outcome lifecycle
}
enum AssessmentStatus { NOT_STARTED  PAUSED  COMPLETED }   // no IN_PROGRESS
enum AssessmentOutcome { QUALIFIES  DOES_NOT_QUALIFY }     // binary
enum BursaryAccountStatus { ACTIVE  CLOSED }
```

There is **no `IN_PROGRESS`** for either form or assessment — it is derived
ad-hoc and inconsistently (`reports.ts:22` maps it to PAUSED;
`assessment-form.tsx:778` derives it as "neither COMPLETED nor PAUSED").
`components/shared/status-badge.tsx:24` declares a **stale union**
(`DRAFT|IN_REVIEW|…`) that matches no enum — legacy/dead.

**Not modelled at all:** admin-managed lead-applicant contact register;
per-application submission deadline (only `Round.closeDate`); multi-year
forward round schedule; explicit new-vs-rollover application *type*;
enforced submission immutability (incidental only — no later writer exists).

---

## B. Parent application form (`src/app/(portal)/`)

Sequential one-page-per-section wizard at `/apply/[section]`, driven by
`SECTION_ORDER` (`apply/[section]/page.tsx:60`); forms in
`src/components/portal/sections/`. Per-section react-hook-form + Zod
(`section-form.tsx`); cross-section gap analysis in `lib/portal/section-gaps.ts`
feeds the sidebar tri-state and the Review screen.

**11 steps:** child-details, family-id, parent-details, dependent-children,
dependent-elderly, other-info, parents-income, assets-liabilities,
additional-info, review, declaration.

**Live STUBS** ("future work package" placeholders): dependent-elderly
details, other-info court-order upload, assets other-properties repeatable
table, additional-info circumstance uploads.

**Biggest divergence:** income is a **flat 14-line model per parent**
(`income-form.tsx:31`) vs the scoping doc's **status-driven sub-tables**
(Employed/Self-employed/Benefits/Unemployed/Retired/Divorced) — no March
payslip, no itemised benefits rows, no SA302 numeric fields, no P45 block.

**School & entry-year are parent-picked**, not locked: school is chosen on
the onboarding card (`onboarding-card.tsx:91`) *and* re-picked in step 1
(`child-details-form.tsx:80`); entry-year group is a free select (`:108`).
Required-doc rules are **bespoke per section** in `section-gaps.ts`, not a
reusable "required-if-value>0" engine. Uploads → `/api/documents` → Supabase
Storage. **No "How to apply" / "Checklist" / T&Cs on the portal landing page**
(`(portal)/page.tsx`); T&Cs text appears only inside the declaration step.
A new-vs-rolling distinction *does* exist on the landing page (onboarding card
vs `reassessment-card.tsx`).

---

## C. Status & workflow transitions

Central transition graph: `(admin)/applications/[id]/actions.ts:52`.
Key points: create→`PRE_SUBMISSION` (multiple call sites); submit→`SUBMITTED`
+`submittedAt` (`apply/actions.ts:463`); admin starts review→`NOT_STARTED`;
pause→`PAUSED` (`actions.ts:196`); complete→`COMPLETED` (`assessments.ts:288`);
outcome→`QUALIFIES`/`DOES_NOT_QUALIFY` (`lib/applications/set-outcome-core.ts:151`,
creates ACTIVE `BursaryAccount` on QUALIFIES).

- **Pause deadline is email-only** — computed inline (`actions.ts:214`), sent
  in the `MISSING_DOCS` email, **never persisted** to a column. No
  retro-population of the form from late docs.
- **`submittedAt` is immutable only by accident** — no later writer exists,
  but nothing enforces it.
- **Parent leakage:** `(portal)/status/page.tsx:47` shows internal
  `NOT_STARTED`→"Under Review", `COMPLETED`→"Completed" — internal states
  surfaced (relabelled).

---

## D. Rounds & invitations

- `Round` (`:38`) keyed `academicYear @unique`; dates `openDate`/`closeDate`
  (`@db.Date`, no time), `decisionDate?`. **No "available"/"required" dates.**
- **"Only one OPEN round" enforced in the action layer**, not the DB:
  `rounds/actions.ts:212` throws if another OPEN round exists. `getActiveRound`,
  the queue bulk re-assessment, and the invite-form default all assume a single
  open round — removing the guard touches all of these.
- **Round dates not editable via UI** — `updateRoundAction` exists
  (`rounds/actions.ts:118`) but has **zero UI callers**.
- **No per-application deadline** column anywhere.
- **Round Cockpit (#18)** built: `/rounds` + `/rounds/[id]`,
  `components/rounds/*`, `lib/db/queries/round-cockpit.ts`; watchlist rules
  4/5/6 derive from `AuditLog` (no `pausedAt`/`decidedAt` columns), rule 7 from
  a `RECOMMENDATION_EXPORT` audit action. Plan:
  `docs/engineering/round-cockpit-implementation-plan.md`.
- **Invites:** parent (`Invitation`, `createInvitationAction`) — `email`+`roundId`
  required, `firstName/lastName/childName/school` **all optional**
  (`invitations/actions.ts:54`); staff (`StaffInvitation`,
  `inviteStaffAction`). Parent dropdown is populated from **all** rounds
  unfiltered (`invitations/page.tsx:105`). Neither send has a confirmation step
  (only the queue bulk action does). School is **not locked** — when omitted,
  the parent picks it via onboarding. Entry-year is never captured at invite.
- **One-account-per-child:** uniqueness is `Application @@unique([roundId,
  leadApplicantId, childName])` (`:108`) — twins with the same first name
  collide; no DOB-based dedupe; `BursaryAccount` keyed only by `reference`.

---

## E. Assessor, assessment, calculations, outcome

- **Layout:** `SplitScreen` (`components/admin/split-screen.tsx`) — docs left,
  form right; below `md` collapses to a tab switcher. The calc panel
  (`CalculationDisplay`) is a **nested sticky right rail inside the form pane**
  (`assessment-form.tsx:1372`) → docs|form|calc three-up is cramped on a laptop.
  Doc nav is a single dropdown + Prev/Next + `[`/`]` (workable but no list view).
- **Assessment fields:** Reference Data, Income (P1/P2 tabs), Property & Savings,
  Payable Fees (scholarship %, **VAT %**, manual adjustment), Flags.
- **Qualitative boxes = 8 spread across two screens:** 6 `AssessmentChecklist`
  tabs (`ChecklistTab` enum) rendered *below* the split-screen (off-screen during
  data entry) + `Recommendation.familySynopsis` + `summary`. All go **read-only on
  completion**. Client wants **one** synopsis, always visible, editable after
  completion.
- **Calculations:** pure engine in `src/lib/assessment/` (`calculator.ts:33`),
  4 stages → payable fees (`payable-fees.ts:38`, monthly = annual/12). Unit-tested.
  **School fees:** single most-recent `SchoolFees` row per school — **no
  current-vs-next-year concept.** Auto-fill **overwrites** assessor edits on
  category/year change (`assessment-form.tsx:415`).
- **Reason codes:** 35 **generic placeholder** codes (`seed-data/reason-codes.ts`),
  selected on the recommendation form, editable in settings.
- **Outcome:** binary `QUALIFIES`/`DOES_NOT_QUALIFY` (`recommendation-form.tsx`,
  `set-outcome-core.ts`). **Assessor-side PDF** exists at
  `/api/pdf/recommendation/[applicationId]` — only reachable from the
  recommendation page's Download button.
- **Scholarship** = a single `scholarshipPct` (no £ award concept).
  **Siblings** = `SiblingLink` + sequential income absorption (`sibling.ts`);
  no "choice between views/options" in the outcome.

---

## F. Settings, auth, audit, retention

- **Settings** (`(admin)/settings/page.tsx`, 5 tabs). Reference-data edits do
  **versioned INSERTs** keyed `effectiveFrom @db.Date` with `@@unique([category,
  effectiveFrom])`; the read dedup orders only by `effectiveFrom desc` with **no
  `createdAt` tie-break** (`reference-tables.ts:29`) → same-day edits sort
  non-deterministically, so the new value may not surface even though the audit
  log recorded it. **(Root cause of the "edit doesn't save" bug.)**
- **Show-names toggle:** `/api/applications/names/route.ts:27` returns 403 for
  any role ≠ ASSESSOR, so an **ADMIN** toggling on gets 403; the client
  `catch` only `console.error`s (`application-table.tsx:726`) → silent failure.
  **(Root cause of the "show names does nothing" bug.)**
- **Auth/MFA:** Supabase SSR (`middleware.ts`), role from JWT `app_metadata`.
  **MFA (TOTP/aal2) is implemented and already env-gated** — `mfa-flag.ts:29`
  `isStaffMfaEnforced()` honours `STAFF_MFA_ENFORCED`, else defaults to
  `VERCEL_ENV === "production"`. The "disable MFA in staging" ask is **largely
  already met** (verification, not build). No SSO, no inactivity timeout.
- **Audit:** `/audit/page.tsx`; `formatTimestamp` (`:54`) has **no `timeZone`**
  → renders UTC, 1h behind London during BST. **(Root cause of the audit
  timestamp bug.)** `AuditLog` is append-only (DELETE denied even under
  service_role).
- **Retention:** manual `gdprDeleteApplicantAction` with a flat **7-year** guard
  (`applications/[id]/actions.ts:543`). **No auto-purge job.** `BursaryAccount`
  ACTIVE/CLOSED gates invitation eligibility & reports only — **a CLOSED-account
  parent keeps full portal/login access** (no middleware/portal check). Only cron
  is `expire-invitations` (daily).

---

## G. Already satisfied / partially built (do **not** rebuild)

| Requirement | Status today | Where |
|---|---|---|
| Dual-parent / second-parent | **Shipped** | `ApplicationContributor`, `secondary-*` |
| Rolling account spine (ACTIVE/CLOSED) | **Partial** — no schedule | `BursaryAccount` |
| Sibling consideration in calc | **Built** | `SiblingLink`, `sibling.ts` |
| Separate parent vs staff invite models | **Built** (UI clarity gap) | `Invitation` / `StaffInvitation` |
| Env-gated MFA (off staging / on prod) | **Built** — verify only | `mfa-flag.ts` |
| Immutable `submittedAt` | **Incidental** — not enforced | `apply/actions.ts:463` |
| Validation summary / review screen | **Built** | `apply/review/page.tsx` |
| Recommendation as separate model | **Built** | `Recommendation` |

---

## H. Cross-cutting gaps (one-line index → owning epic)

- One enum, three lifecycles → **[01]**
- Income flat-model vs status-driven sub-tables; live stubs; dynamic tax-year → **[02]**
- Single-open-round guard; unwired editable dates; no per-app deadline → **[03]**
- No contact register; optional/unlocked invite fields; twin dedupe → **[04]**
- No portal How-to-apply/Checklist/T&Cs; no draft/countdown/lockout; status leakage → **[05]**
- Cramped three-up layout; 8 qualitative boxes; auto-fill overwrites → **[06]**
- No current+next-year fees; calc validation vs historicals → **[07]**
- Binary outcome; placeholder reason codes; scholarship-as-percentage; unused PDF → **[08]**
- Separated/divorced/widowed logic depth; question subset → **[09]**
- No auto-purge; CLOSED ≠ access revoked; flat 7-yr retention; no schedule → **[10]**
- MFA verify; SSO; inactivity timeout → **[11]**
- show-names 403; reference-data ordering; audit TZ; round-create error → **[12]**
