---
title: Data retention & account lifecycle — purge, revoke, and the rolling schedule
status: planned
severity: high
area: retention, lifecycle, schema, cron
wave: 4
depends_on: [01, 03]
sources:
  - ../source-materials/application-lifecycle-illustration.png  # new→approved→rolling; declined→archived; closed-when-complete; Year 1..6 schedule
  - ../source-materials/meeting-findings.md                     # "Data retention / account lifecycle"
related:
  - 00-current-state-map.md
  - 01-status-and-workflow-model.md
  - 03-round-management.md
  - prisma/schema.prisma
---

# 10 — Data retention & account lifecycle

**Objective.** Close the loop on the account lifecycle that Epic 01 opens.
Four things, all keyed off the outcome/account states 01 introduces:

1. **Tiered, automatic retention** — replace today's single flat **7-year**
   manual delete with an **auto-purge cron** that applies *different* horizons
   per outcome (purge declined/non-awarded early; a possible **6-year** hold for
   *qualifies-but-not-awarded*; keep **7 years** for *awarded*), while respecting
   the **append-only `AuditLog`** constraint.
2. **Portal-access revocation** — a **CLOSED** `BursaryAccount` (or a
   declined/archived application) must actually **revoke the parent's portal/login
   access**; today it changes nothing.
3. **Rolling active accounts** — on **AWARD**, promote the applicant into a
   rolling **ACTIVE** account and **generate the forward schedule** of future
   assessment rounds (the Year 1..6 rows in the illustration).
4. **The schedule itself** — a per-account multi-year schedule entity with
   `Available On` / `Required By` dates and a **Show/Hide on Portal** toggle per
   row, closing when the full schedule completes.

This epic owns the *outcome side effects*; Epic 01 owns the *states*. It cannot
land before 01 (it needs `AWARDED` / `QUALIFIES_NOT_AWARDED` / `archivedAt`) or
before 03 (it needs the round-generation primitives the schedule produces).

---

## 1. Background & rationale

The [lifecycle illustration](../source-materials/application-lifecycle-illustration.png)
is the authoritative model for this epic. Read top-to-bottom it says:

- **New application** → status shows as **"received"**; the possible outcomes are
  **APPROVED BURSARY** or **DECLINED BURSARY**.
- **If approved**, *"the form is used to generate a schedule of rounds for a given
  amount of years with submission dates; only one round [is] opened at a time in
  this section."* The grid then lists **Year 1..6**, each a row with: `Type`
  (AnnualType), `Status` (Received / **Scheduled**), `Manually Created` flag,
  **`Available On`** and **`Required By`** dates, **`Received On`**, `Contact
  Type(s)`, an Attach/Edit/View column (Edit · Regenerate PDF · View), and an
  **Action** column whose key control is **Show on Portal / Hide on Portal** per
  year. There is a **Regenerate Schedule** button.
- **If declined**, *"the form is archived."*
- **Rolling-over application** → status shows as **"submitted"**; the account is
  *"always active (as it has been approved)"* and becomes **closed** *"when the
  full schedule of assessments and applications has been completed."*

[`meeting-findings.md`](../source-materials/meeting-findings.md) ("Data retention
/ account lifecycle") restates the asks crisply:

> - Implement automatic **purge/deletion** for declined and non-awarded applications.
> - Support distinction between **active accounts** and **closed accounts**.
> - Revisit retention for **qualified but not awarded** applicants; Charlotte
>   raised possible six-year retention instead of immediate purge.
> - Revoke parent portal access appropriately when an account is no longer active.
> - For successful applicants, create/promote them into **active rolling bursary
>   accounts** with future rounds generated.

So the work is: a retention *policy* (with a DPO sign-off, [D6](#7-open-decisions)),
the *mechanism* to enforce it on a schedule, an *access-control* change tied to
account state, and the *forward-schedule* data model + generation that turns an
AWARD into the Year 1..6 grid.

---

## 2. Current state

See [00 §A (BursaryAccount)](00-current-state-map.md#a-data-model--enums-prismaschemaprisma)
and [00 §F (retention)](00-current-state-map.md#f-settings-auth-audit-retention).
In brief, with line citations re-confirmed against the repo:

**Retention is manual, flat, and per-application.**
- The only retention path is `gdprDeleteApplicantAction`
  (`src/app/(admin)/applications/[id]/actions.ts:503`), triggered by an admin from
  the GDPR delete dialog (`components/admin/gdpr-delete-dialog.tsx:129`).
- Its guard is a **flat 7 years from `submittedAt`**
  (`actions.ts:543`–`:553`): it refuses if `submittedAt > now − 7y`. There is no
  outcome-aware tiering — declined and awarded are treated identically.
- The cascade (`actions.ts:592`–`:710`) is thorough and is the **reference
  behaviour** for the auto-purge: it deletes Storage objects first
  (`:578`, non-fatal per-doc), then in one `withAdminContext` transaction deletes
  assessment children / recommendation / sections / documents, **anonymises** the
  `Application` (`childName → "[Child Removed]"`, `childDob → null`, `:625`),
  deletes the lead's `Invitation` rows, **nulls `AuditLog.userId`** (`:647`,
  never deletes audit rows), anonymises the `Profile` and sets `role → DELETED`
  (`:661`), deletes `ApplicationContributor` rows, and runs the dual-parent
  shared-profile guard (`:673`) before deleting the Supabase auth user(s)
  (`:720`, `:736`). Writes a `GDPR_DELETION` audit row (`:771`).
- The dual-parent secondary guard lives in
  `lib/db/queries/secondary-gdpr.ts` (`getSecondaryContributorForGdpr`,
  `decideSecondaryProfileErasure`) — a second parent's profile/auth is only
  erased when lawfully linked to nothing else.
- **There is no auto-purge job.** The *only* cron is `expire-invitations`
  (`vercel.json` → `/api/cron/expire-invitations`, `0 2 * * *` daily). That
  route (`src/app/api/cron/expire-invitations/route.ts`) is the **pattern to
  copy**: `GET`, `export const dynamic = "force-dynamic"`, fail-closed
  `Bearer ${CRON_SECRET}` auth, `withAdminContext`, and an audit row **only when
  something actually changed** (so nightly no-ops don't flood the trail).

**`AuditLog` is append-only.** DELETE is denied even under `service_role`
([00 §F](00-current-state-map.md#f-settings-auth-audit-retention); see also
project memory "audit_logs is append-only"). The manual cascade respects this by
*nulling* `userId` rather than deleting rows — the auto-purge **must** do the same.

**Account status exists but gates almost nothing.**
- `BursaryAccountStatus { ACTIVE, CLOSED }` (`prisma/schema.prisma:131`/`:615`)
  with `closedAt DateTime?` (`schema.prisma:66`).
- It is read in exactly **two** places: invitation eligibility
  (`lib/db/queries/invitations.ts:325`, filters to `ACTIVE`) and a reports tile
  (`lib/db/queries/reports.ts:573`, counts `ACTIVE`).
- It is **not referenced in `middleware.ts`** nor in any portal route. A
  parent whose account is `CLOSED` therefore keeps **full login + portal
  access**. Confirmed: no `BursaryAccountStatus` / `accountStatus` usage exists
  outside `invitations.ts` and `reports.ts`.
- Middleware *does* already force-log-out the **`DELETED`** role
  (`middleware.ts:142`–`:147`: signs out, redirects to `/login?error=account_deleted`,
  placed before the auth-route allowance so a deleted user can't linger on
  `/login`). The portal gate is `middleware.ts:158`–`:168` (`APPLICANT` only).
  This gives us **two** viable revocation mechanisms (see §5.2).

**No forward schedule exists.**
- `BursaryAccount` accumulates yearly `applications` + `recommendations`
  (`schema.prisma:69`,`:72`) but **nothing generates future `Round`s** and there
  is no per-account year horizon, no `Available On`/`Required By`, no
  Show/Hide-on-portal flag — none of the illustration's grid is modelled.
- The AWARD→account hop already exists but only *creates the account*, not the
  schedule: `set-outcome-core.ts:99`–`:110` (`createBursaryAccountForQualifies`)
  creates exactly one `BursaryAccount` (`status: "ACTIVE"`,
  `firstAssessmentYear: application.round.academicYear`) idempotently on
  `QUALIFIES`. This is the precise hook the schedule generation extends. Under
  Epic 01 the trigger becomes `outcome === AWARDED`.
- `Round` (`schema.prisma:38`) is keyed `academicYear @unique` with only
  `openDate` / `closeDate` / `decisionDate` (`@db.Date`). Per-round
  Available/Required dates and the single-open-round relaxation are **Epic 03's**
  remit; this epic *consumes* them.

---

## 3. Target state

Aligned to the illustration and [README §3](../README.md#3-the-canonical-status-model-the-spine).

### 3.1 Tiered retention policy (subject to [D6](#7-open-decisions) + DPO)

| Outcome (Epic 01 `AssessmentOutcome` / account) | Retention horizon | Anchored from | Action at expiry |
|---|---|---|---|
| **Declined** (`DOES_NOT_QUALIFY`, new app → `archivedAt`) | **shortest** — purge promptly after a short grace (default config; D6) | `archivedAt` (fallback `submittedAt`) | auto-purge (anonymise+delete, keep audit) |
| **Qualifies-not-awarded** (`QUALIFIES_NOT_AWARDED`) | **6 years** (Charlotte's proposal) | `submittedAt` | auto-purge |
| **Awarded** (`AWARDED`) | **7 years** after the account **closes** | `BursaryAccount.closedAt` | auto-purge |
| **In-flight** (no terminal outcome yet) | **never** auto-purged | — | skip |

The horizons are **configuration, not hard-coded** (so the DPO can re-cut them
without a deploy) — a small typed policy object (env- or settings-backed),
defaulting to the table above. The flat-7y manual guard is **replaced** by a
policy lookup so the manual `gdprDeleteApplicantAction` and the cron share one
source of truth.

### 3.2 Account lifecycle & access

- **ACTIVE** account → parent retains portal access (history view, upcoming-round
  lineup, missing-doc upload — Epic 05 surfaces these).
- **CLOSED** account (schedule complete, or admin-closed) → **portal access is
  revoked**: the parent can no longer log into the portal. Existing submitted
  summaries/PDFs remain in the system for staff; the *parent's* live access ends.
- A **declined/archived** application with **no** active account → same
  revocation (the applicant has no live relationship).
- Revocation is **reversible** in principle (re-award re-activates) and must not
  destroy data — it is an *access* state change, distinct from purge.

### 3.3 Rolling account + forward schedule (the illustration's grid)

On **AWARD**, the system:

1. Ensures an **ACTIVE** `BursaryAccount` (extends the existing idempotent create).
2. **Generates a schedule** of N future assessment years (N from the award /
   account horizon — e.g. years to the child's final eligible year). Each schedule
   row carries, per the illustration:
   - `year` (1..N), `type` (AnnualType for now),
   - `status` — **Scheduled** until that year's application is **Received**, then
     mirrors the live application/assessment,
   - `manuallyCreated` flag (admin-inserted rows vs generated),
   - **`availableOn`** (when the round/form opens to the parent) and
     **`requiredBy`** (submission-by) dates,
   - `receivedOn` (filled when that year's application is submitted),
   - **`showOnPortal`** — the per-row Show/Hide toggle (default: current/next
     year **Show**, far-future years **Hide**, matching the illustration where
     Years 1–3 are "Hide on Portal" *available* and 4–6 "Show on Portal").
3. Honours *"only one round opened at a time in this section"* — generation
   creates the **schedule rows** up front but only **materialises/opens** the
   current year's `Round` (via Epic 03), leaving future years `Scheduled`.
4. **Closes** the account (`status → CLOSED`, `closedAt = now`) when the **final**
   schedule row reaches a terminal state — *"when the full schedule of assessments
   and applications has been completed."*

A **Regenerate Schedule** action (admin) recomputes future, not-yet-received rows
(e.g. after a date-policy change), never touching `Received` history.

---

## 4. Gap analysis

| Target | Today | Action |
|---|---|---|
| Outcome-tiered retention horizons | flat 7y, manual only (`actions.ts:543`) | Policy object; both manual + cron read it |
| Auto-purge on a schedule | none (only `expire-invitations` cron) | New `/api/cron/purge-expired` route + `vercel.json` entry |
| Purge respects append-only audit | manual cascade does (`:647` nulls userId) | Reuse the cascade; cron **must** null-not-delete audit |
| Reuse of the proven cascade | logic inline in one server action | **Extract** cascade into a shared `lib/retention/purge.ts` |
| CLOSED ⇒ no portal access | CLOSED gates only invites+reports | Middleware/portal guard keyed on account status (or role→DELETED) |
| Declined/archived ⇒ no access | no effect | Same revocation path |
| Forward schedule entity | absent | New `BursaryScheduleEntry` model |
| Schedule generation on AWARD | only account *created* (`set-outcome-core.ts:99`) | Extend the AWARD side effect to generate rows |
| Show/Hide per year on portal | absent | `showOnPortal` flag + admin toggle + portal read (Epic 05) |
| Close-when-complete | `CLOSED` exists, never set automatically | Completion check sets `CLOSED`+`closedAt` |
| Per-row Available/Required dates | only round-level `openDate`/`closeDate` | Schedule columns; round-level wiring via Epic 03 |

---

## 5. Proposed approach

> **Sequencing within the epic.** 5.1(a) policy + 5.2 revocation are independent
> of the schedule and can ship first (they need only Epic 01's outcome states).
> 5.1(b) auto-purge cron follows. 5.3 schedule + 5.4 generation depend on Epic 03
> and are the largest slice — they land last.

### 5.1 Tiered retention + auto-purge cron

**(a) Policy (shared source of truth).**

- Introduce `src/lib/retention/policy.ts`: a typed `RetentionPolicy` mapping each
  terminal outcome → `{ years, anchor }` where `anchor ∈ {archivedAt, submittedAt,
  closedAt}`, plus a `graceDays` for declined. Defaults = §3.1 table; overridable
  via settings/env so the DPO can re-cut without a deploy ([D6](#7-open-decisions)).
- A pure `isPurgeable(application, account, now, policy): { purgeable, anchorDate,
  horizon }` function — **unit-tested** with fixtures per outcome (this is the
  GDPR-critical decision and must be provably correct).
- **Replace** the inline 7-year check in `gdprDeleteApplicantAction`
  (`actions.ts:543`) with `isPurgeable(...)` so the manual button and the cron
  cannot diverge. The manual action keeps its friendly error; it just sources the
  horizon from the policy.

**(b) Extract the cascade.**

- Move the transactional cascade body (`actions.ts:572`–`:763`) into
  `src/lib/retention/purge.ts` → `purgeApplication(tx, application, { reason })`,
  preserving **every** step and ordering: Storage-first, anonymise Application,
  delete sections/docs/assessment children/recommendation, **null `AuditLog.userId`
  (never delete)**, anonymise Profile + `role → DELETED`, dual-parent guard
  (`secondary-gdpr.ts`), Supabase auth deletion, `GDPR_DELETION`-style audit row.
  `gdprDeleteApplicantAction` becomes a thin caller (auth + policy + `purge`).
- This guarantees the cron and the manual path are byte-for-byte the same erasure,
  and that the **append-only audit invariant is honoured in one place**.

**(c) The cron.**

- New route `src/app/api/cron/purge-expired/route.ts`, modelled exactly on
  `expire-invitations/route.ts`: `GET`, `force-dynamic`, fail-closed
  `Bearer ${CRON_SECRET}`, `withAdminContext`.
- It **selects** terminal-outcome applications whose `isPurgeable` is true (bounded
  `take` per run to cap blast radius / Storage calls), purges each via
  `purgeApplication`, and writes **one summary audit row** *only if* anything was
  purged (mirroring the no-op-silent pattern). Per-item failures are logged and
  skipped (non-fatal), never aborting the batch.
- Register in `vercel.json` `crons` (e.g. weekly, `0 3 * * 0` — retention is not
  time-critical and a wide cadence limits load). Reuses the existing `CRON_SECRET`
  (already set in Production **and** Preview for `expire-invitations`).
- **Add a new audit action** `RETENTION_PURGE_CRON` to `lib/audit/actions.ts`
  (alongside `EXPIRE_INVITATIONS_CRON`, `GDPR_DELETION`) + a badge colour — so the
  audit page distinguishes automatic purges from manual GDPR deletes.
- **Dry-run safety:** gate destructive execution behind an env flag
  (`RETENTION_PURGE_ENABLED`, default off) so it can be deployed and observed in
  report-only mode first (logs *what it would purge* + counts) before the DPO
  green-lights live deletion — mirrors the cautious rollout used elsewhere
  (e.g. WAF/MFA env-gating in project memory).

### 5.2 Portal-access revocation on CLOSED / declined

Two mechanisms; pick per [D18](#7-open-decisions) — recommendation: **(A)** as
the durable default because it survives without touching the auth provider, with
**(B)** retained only inside the existing purge cascade.

**(A) Middleware/portal guard keyed on account status (recommended).**
- Extend the portal gate (`middleware.ts:158`–`:168`). Middleware only has
  JWT-level info (no Prisma), so the account state must be reachable there: either
  (i) a lightweight **portal layout/server-component guard**
  (`src/app/(portal)/layout.tsx`) that has Prisma access and redirects a parent
  with **no ACTIVE account** to a "portal closed" page, or (ii) stamp an
  `app_metadata.portal_access` claim on the JWT when the account flips
  ACTIVE↔CLOSED so middleware can gate without a DB hit. The layout-guard is
  simpler and avoids JWT-refresh races; the claim is faster at the edge. Prefer
  the **layout guard** unless edge latency matters.
- The rule: a parent retains portal access iff they have **≥1 ACTIVE
  `BursaryAccount`** *or* an application in a non-terminal state (still being
  assessed). Declined-only / all-CLOSED parents are redirected to a read-only
  "your bursary has concluded" page (no editable forms).

**(B) Role → DELETED (reuse the existing force-logout).**
- Middleware **already** hard-logs-out `role === "DELETED"` (`middleware.ts:142`).
  Setting `Profile.role = DELETED` instantly revokes access with zero new code in
  the gate. But `DELETED` is semantically *erased*, the manual cascade already
  uses it post-anonymisation, and it would mislabel a merely-closed (data-intact)
  parent. **Do not** repurpose `DELETED` for "account closed" — reserve it for
  erasure. (If a new state is wanted, that's an Epic 01 outcome/role concern, not
  this epic's to invent.)

**Revocation triggers:** account close (§5.3 completion check), admin manual
close, and outcome = declined on a new application with no other ACTIVE account.
Revocation is **idempotent** and **reversible** (re-award → ACTIVE → access
returns).

### 5.3 Forward-schedule entity (the grid)

New Prisma model — additive, owned by an account:

```prisma
model BursaryScheduleEntry {
  id               String                 @id @default(uuid()) @db.Uuid
  bursaryAccountId String                 @map("bursary_account_id") @db.Uuid
  scheduleYear     Int                    @map("schedule_year")      // 1..N (illustration "Year")
  academicYear     String                 @map("academic_year")      // e.g. "2027/28" — joins to Round.academicYear
  type             ScheduleEntryType      @default(ANNUAL)           // illustration "Type" = AnnualType
  status           ScheduleEntryStatus    @default(SCHEDULED)        // SCHEDULED → RECEIVED → COMPLETE
  manuallyCreated  Boolean                @default(false) @map("manually_created")
  availableOn      DateTime?              @map("available_on") @db.Date   // "Available On"
  requiredBy       DateTime?              @map("required_by")  @db.Date   // "Required By"
  receivedOn       DateTime?              @map("received_on")  @db.Date   // "Received On"
  showOnPortal     Boolean                @default(false) @map("show_on_portal") // Show/Hide on Portal
  roundId          String?                @map("round_id") @db.Uuid       // set once materialised (Epic 03)
  applicationId    String?                @map("application_id") @db.Uuid // set once that year's app exists
  createdAt        DateTime               @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime               @updatedAt @map("updated_at") @db.Timestamptz(6)
  bursaryAccount   BursaryAccount         @relation(fields: [bursaryAccountId], references: [id], onDelete: Cascade)

  @@unique([bursaryAccountId, scheduleYear])
  @@index([bursaryAccountId])
  @@index([roundId])
  @@map("bursary_schedule_entries")
}

enum ScheduleEntryType   { ANNUAL }                        // extensible; matches "AnnualType"
enum ScheduleEntryStatus { SCHEDULED RECEIVED COMPLETE }   // mirrors illustration "Scheduled"/"Received"
```

- `BursaryAccount` gains `scheduleEntries BursaryScheduleEntry[]` and (optional)
  `scheduleYears Int?` (the agreed horizon N).
- Migration is **additive** (new table + relation; nullable columns), per repo
  `CLAUDE.md` — no edit to applied migrations. No backfill needed for existing
  accounts beyond an optional one-shot generation pass (see §6 PR-5).

### 5.4 Generation, status mirroring, Show/Hide, close-when-complete

- **Generation service** `src/lib/bursary-accounts/schedule.ts`:
  `generateSchedule(account, { years, datesPolicy })` creates `SCHEDULED` rows for
  years 1..N with computed `availableOn`/`requiredBy` (date policy derived from the
  award round + the dates Epic 03 introduces). Idempotent and **re-runnable**
  (the **Regenerate Schedule** button) — only touches non-`RECEIVED` future rows.
- **Hook on AWARD:** extend `createBursaryAccountForQualifies`
  (`set-outcome-core.ts:99`, becoming the `AWARDED` branch under Epic 01) to call
  `generateSchedule` after ensuring the account — **behind the same interface
  Epic 01 stubs for the hand-off** (01 §5.2 notes the account/schedule logic sits
  behind an interface so 01 can land first). Idempotent: re-awarding doesn't
  duplicate rows.
- **Status mirroring:** when a scheduled year's `Round` opens (Epic 03) and the
  parent's application is submitted, set that entry `status → RECEIVED`,
  `receivedOn = submittedAt`, link `applicationId`/`roundId`; on assessment
  completion → `COMPLETE`. *"Only one round opened at a time"* is preserved by
  materialising rounds one year at a time, not all N up front.
- **Show/Hide on portal:** `showOnPortal` per row drives what the parent sees in
  the upcoming-round lineup (Epic 05 reads it). Admin toggles it from the schedule
  grid (the illustration's per-row Action). Generation defaults current/next year
  to **Show**, far-future to **Hide**.
- **Close-when-complete:** a completion check (run on assessment completion /
  schedule update) sets `BursaryAccount.status → CLOSED`, `closedAt = now()` once
  **every** schedule row is `COMPLETE` (or otherwise terminal). Closing fires the
  §5.2 revocation. This is the only *automatic* writer of `CLOSED` today.

### 5.5 Admin UI (schedule grid)

- A schedule grid on the account/recommendation view rendering the illustration's
  columns (`Year`, `Type`, `Status`, `Manually Created`, `Available On`,
  `Required By`, `Received On`, `Action`) with the **Regenerate Schedule** button
  and a **Show/Hide on Portal** toggle per row. Reuses existing admin table
  primitives. Editing future-row dates is admin-only and never edits `RECEIVED`
  history. (Deep build can be split out if scope demands — see §9.)

### 5.6 Seed / reference data

- Extend `seed-demo` so at least one demo `BursaryAccount` is **ACTIVE with a
  populated multi-year schedule** (mix of `RECEIVED` past + `SCHEDULED` future,
  some `showOnPortal`) and one is **CLOSED** (to exercise revocation). Add a
  declined/archived application to exercise purge eligibility logic (dates set so
  `isPurgeable` is demonstrable in a test, not destructively in seed).
- **No reference-table change**, so `seed-reference.ts` is untouched (per repo
  `CLAUDE.md`, reference seeds stay idempotent and demo-only data never leaks
  into reference seeding).

---

## 6. Work breakdown (PR-sized)

- [ ] **PR-1 (retention policy + cascade extraction):** add
      `lib/retention/policy.ts` (typed horizons, `isPurgeable`, unit tests);
      extract the cascade into `lib/retention/purge.ts`; refactor
      `gdprDeleteApplicantAction` to call both. **No behaviour change** to the
      manual path beyond sourcing the horizon from the policy. *(Depends on 01 for
      the outcome/`archivedAt` fields.)*
- [ ] **PR-2 (auto-purge cron):** `api/cron/purge-expired/route.ts` (copy
      `expire-invitations` shape); `RETENTION_PURGE_CRON` audit action + badge;
      `vercel.json` cron entry; `RETENTION_PURGE_ENABLED` dry-run gate (default
      off, report-only). Tests for selection + no-op-silent + append-only-audit.
- [ ] **PR-3 (portal-access revocation):** portal layout/middleware guard keyed
      on "≥1 ACTIVE account or in-flight app"; "bursary concluded" read-only page;
      wire revocation triggers (declined, manual close). Tests: CLOSED-account
      parent is redirected; ACTIVE parent is not; re-award restores access.
- [ ] **PR-4 (schedule schema):** additive `BursaryScheduleEntry` model + enums +
      `BursaryAccount` relation/`scheduleYears`; migration; Prisma client types.
      *(Depends on 03 for round date primitives the columns mirror.)*
- [ ] **PR-5 (generation + AWARD hook):** `lib/bursary-accounts/schedule.ts`
      (`generateSchedule`, idempotent); hook into the AWARD side effect behind the
      Epic-01 interface; one-shot generation for existing ACTIVE accounts
      (optional, behind a flag). Tests for generation determinism + idempotency.
- [ ] **PR-6 (status mirroring + close-when-complete):** mirror schedule rows to
      RECEIVED/COMPLETE as applications submit/complete; close account + fire
      revocation when all rows terminal. Tests for the close trigger.
- [ ] **PR-7 (admin schedule grid + Show/Hide):** the grid UI, per-row
      Show/Hide-on-portal toggle, Regenerate Schedule button, future-row date
      edit. *(Epic 05 consumes `showOnPortal` for the parent lineup — out of scope
      here.)*
- [ ] **PR-8 (seed):** demo fixtures per §5.6.

---

## 7. Open decisions

- **D6 — Retention policy** *(blocks this epic; default: tiered — 6-yr
  qualifies-not-awarded, 7-yr awarded, purge declined)* —
  [register](../README.md#5-decision-register). Owner: **Charlotte (+ DPO)**.
  Specifically needs: (i) the declined `graceDays` value; (ii) confirmation that
  awarded 7y anchors from **account close**, not first submission; (iii) the
  qualifies-not-awarded horizon (6y proposed). **DPO sign-off is a hard gate
  before `RETENTION_PURGE_ENABLED` is turned on in production.**
- **D18 (new) — Revocation mechanism:** middleware/portal guard keyed on account
  status (recommended) vs role→DELETED. *Default: layout/portal guard; reserve
  `DELETED` for erasure.* Raise into the register if it needs Charlotte/DPO input;
  otherwise Brian decides.
- **D19 (new) — Schedule horizon N:** how many future years to generate on
  AWARD (to child's final eligible year? a fixed term?) and the
  `availableOn`/`requiredBy` date policy. *Default: years-to-final-eligible-year;
  dates derived from the award round + Epic 03's per-round dates.* Owner:
  **Charlotte**. Depends on Epic 03's date model landing.

---

## 8. Risks & mitigations

- **Irreversible data loss / GDPR exposure.** An auto-purge that deletes too much
  (or too soon) is the highest-severity risk in the programme. *Mitigations:*
  (1) `RETENTION_PURGE_ENABLED` dry-run default (deploy → observe report-only →
  DPO green-light → enable); (2) one shared, unit-tested `isPurgeable` + one shared
  `purgeApplication` (no divergence between manual and cron); (3) bounded `take`
  per run; (4) per-item non-fatal failures; (5) the purge **anonymises** the
  Application (as the manual path does) rather than hard-deleting it, leaving the
  reference/audit lineage intact.
- **Append-only audit violation.** Deleting `AuditLog` rows fails under
  `service_role` (42501) and would roll back the whole purge transaction (project
  memory: "audit_logs is append-only"). *Mitigation:* the extracted cascade
  **nulls `userId`** and never deletes audit rows; a test asserts no `auditLog.delete*`
  call exists in the purge path; the cron writes (not deletes) its summary row.
- **Locking out an active parent.** A revocation-rule bug could block a parent
  mid-application. *Mitigation:* the access rule is "ACTIVE account **or**
  in-flight application", reversible, and covered by tests for the ACTIVE / CLOSED
  / declined / re-award cases. Ship behind the layout guard (easy to revert) before
  any JWT-claim approach.
- **Schedule ↔ Round drift.** This epic's `BursaryScheduleEntry` and Epic 03's
  `Round` model two views of the same timeline. *Mitigation:* the schedule is the
  *plan*; rounds are *materialised one year at a time* and linked back via
  `roundId`; Regenerate only touches non-`RECEIVED` rows. Coordinate the date
  semantics with Epic 03 so `availableOn`/`requiredBy` map cleanly to the round
  dates 03 introduces.
- **Dual-parent erasure correctness in the cron.** The shared-profile guard
  (`secondary-gdpr.ts`) must run for *every* purged application, not just manual
  ones. *Mitigation:* it lives inside the extracted `purgeApplication`, so the cron
  inherits it unchanged; add a fixture where a second parent is lawfully retained.
- **Cross-references not yet landed.** This epic hard-depends on 01 (states) and 03
  (round generation). *Mitigation:* it is **Wave 4** by design; PR-1/2/3 need only
  01, the schedule PRs gate on 03 — sequence accordingly.

---

## 9. Out of scope / deferred

- **The outcome *states* themselves** (`AWARDED`, `QUALIFIES_NOT_AWARDED`,
  `DOES_NOT_QUALIFY`, `Application.archivedAt`) → **Epic 01**. This epic consumes
  them.
- **Round generation / per-round Available-Required dates / single-open-round
  relaxation** → **Epic 03**. This epic schedules *into* that machinery.
- **Parent-facing rendering** of the upcoming-round lineup and the per-row
  Show/Hide visibility → **Epic 05** (this epic only provides `showOnPortal` and
  the revocation surface).
- **Award terminology** (final bursary + scholarship £, siblings, option choice)
  → **Epic 08**; the schedule stores whatever the award produces.
- **"Progress report"** (the illustration's *"New Progress Report"* — a
  cross-year schedule-of-completed-assessments report) is **noted but deferred**:
  reporting is Epic 18/Reports territory and not load-bearing for the lifecycle.
- **Inactivity/session-timeout logout** → **Epic 11** (distinct from
  account-state revocation).

---

## 10. Acceptance criteria

- `isPurgeable` returns the **outcome-specific** horizon for declined /
  qualifies-not-awarded / awarded, anchored from the correct field, and is proven
  by unit tests; the manual GDPR button and the cron both call it (no flat-7y
  literal remains for tiered outcomes).
- The auto-purge cron, when **enabled**, purges only eligible terminal-outcome
  applications, **never deletes an `AuditLog` row** (nulls `userId`), and writes a
  single summary audit row only when something was purged; with the env flag
  **off** it logs a report-only preview and changes nothing.
- A parent whose only `BursaryAccount` is **CLOSED** (or whose application is
  declined/archived) **cannot reach the portal** and is redirected to the
  concluded/closed page; a parent with an **ACTIVE** account or an in-flight
  application is unaffected; re-awarding restores access.
- On **AWARD**, an **ACTIVE** account exists **and** a forward schedule of N years
  is generated with `availableOn`/`requiredBy` dates and per-row `showOnPortal`
  defaults; re-running generation (Regenerate Schedule) is idempotent and never
  rewrites `RECEIVED` rows.
- As each scheduled year's application is submitted/assessed, its schedule row
  moves `SCHEDULED → RECEIVED → COMPLETE`; when **all** rows are terminal the
  account flips to **CLOSED** with `closedAt` set and access is revoked.
- The admin schedule grid renders the illustration's columns and the Show/Hide
  toggle; the demo seed shows an ACTIVE-with-schedule account and a CLOSED account.
- The schema migration is **additive** (new table + nullable columns) and ships in
  the same PR as the code that reads it, per repo `CLAUDE.md`.
- **DPO sign-off (D6) is recorded** before `RETENTION_PURGE_ENABLED` is set in
  production.
