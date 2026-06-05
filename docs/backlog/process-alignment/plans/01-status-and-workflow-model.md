---
title: Status & workflow model — split the conflated lifecycle
status: planned
severity: critical
area: schema, workflow
wave: 1
depends_on: []
blocks: [02, 03, 04, 05, 08, 10]
sources:
  - ../source-materials/feedback.md            # canonical status definitions
  - ../source-materials/application-lifecycle-illustration.png
  - ../source-materials/meeting-findings.md    # "Status / workflow model redesign"
related:
  - 00-current-state-map.md
  - prisma/schema.prisma
---

# 01 — Status & workflow model

**Objective.** Replace the single `ApplicationStatus` enum (which fuses three
lifecycles) with three independent, correctly-named lifecycles — **form**,
**assessment**, and **outcome/account** — and the supporting columns
(persisted pause deadline, enforced immutable submission date, new-vs-rolling
type). This is the keystone the rest of the programme reads.

---

## 1. Background & rationale

[`feedback.md`](../source-materials/feedback.md) gives the client's canonical
status lists, and the
[lifecycle illustration](../source-materials/application-lifecycle-illustration.png)
shows how a new application becomes (or doesn't become) a rolling active
account. [`meeting-findings.md`](../source-materials/meeting-findings.md)
("Status / workflow model redesign") asks specifically to *separate the
form/assessment/outcome lifecycles*, *fix the submission date once submitted*,
*add a submitted-but-awaiting-docs state*, *clarify Paused*, and *replace the
binary qualify/does-not-qualify*.

These are all one structural change: the lifecycles are independent in reality
but fused in the schema, which is why "submitted but awaiting documents" is
currently impossible to express and why Paused clobbers the submitted state.

---

## 2. Current state

See [00 §A, §C](00-current-state-map.md#a-data-model--enums-prismaschemaprisma).
In brief:

- `ApplicationStatus` (`prisma/schema.prisma:525`) = `PRE_SUBMISSION, SUBMITTED,
  NOT_STARTED, PAUSED, COMPLETED, QUALIFIES, DOES_NOT_QUALIFY` — three
  lifecycles in one column.
- `AssessmentStatus` has **no `IN_PROGRESS`**; "in progress" is derived
  inconsistently (`reports.ts:22` ↔ `assessment-form.tsx:778` ↔ `admin/page.tsx:170`).
- Transition graph centralised at `(admin)/applications/[id]/actions.ts:52`.
- Pause deadline is **email-only**, never persisted (`actions.ts:214`).
- `submittedAt` is **immutable only by accident** (`apply/actions.ts:463`).
- Binary outcome via `AssessmentOutcome` + `set-outcome-core.ts:151` (creates
  ACTIVE `BursaryAccount` on QUALIFIES).
- Parent status page leaks internal states relabelled (`status/page.tsx:47`).
- `components/shared/status-badge.tsx:24` is a **stale union** — dead code.

---

## 3. Target state

Three lifecycles (per [README §3](../README.md#3-the-canonical-status-model-the-spine)):

**Form** — `Application.formStatus`:
`CREATED → NOT_STARTED → IN_PROGRESS → FILLED_IN → SUBMITTED`
- `CREATED` = invite sent, applicant has not logged in.
- `NOT_STARTED` = logged in ≥ once, no section started.
- `IN_PROGRESS` = at least one section started, not all complete.
- `FILLED_IN` = all required fields + documents complete, not yet submitted.
- `SUBMITTED` = submitted; displayed as **"Received"** for new applications and
  **"Submitted"** for rolling-over (label derived from application type — see D2).
  `submittedAt` is fixed at this point and never changes.

**Assessment** — `Assessment.status` (add `IN_PROGRESS`):
`NOT_STARTED → IN_PROGRESS → PAUSED → COMPLETED`
- `PAUSED` carries an **optional persisted deadline** (`pausedUntil`) by which
  the applicant must upload/email missing docs; the upload retro-populates the
  form. Crucially this no longer touches `formStatus`, so a paused assessment
  keeps the application visibly *Submitted/Received*.

**Outcome / account** — `Assessment.outcome` (replace binary) + account state:
`DOES_NOT_QUALIFY | QUALIFIES_NOT_AWARDED | AWARDED`
- `AWARDED` → create/continue an **Active** `BursaryAccount` and generate the
  forward round schedule (Epic 10).
- `DOES_NOT_QUALIFY` on a *new* application → application **archived**.
- `BursaryAccountStatus` ACTIVE → CLOSED unchanged (closure logic in Epic 10).

New/rolling is made **explicit**: `Application.applicationType: NEW | ROLLING_OVER`
(replaces the inferred `bursaryAccountId == null` + `isReassessment` heuristic;
keep `isReassessment` as a derived/back-compat accessor during migration).

---

## 4. Gap analysis

| Target | Today | Action |
|---|---|---|
| 3 separate status fields | 1 fused enum | New `formStatus` + outcome enum; repurpose `AssessmentStatus` |
| Form `IN_PROGRESS`, `FILLED_IN`, `CREATED` | absent | New enum values + derivation from section completion |
| "Received" vs "Submitted" label | both = `SUBMITTED` | Derive label from `applicationType` |
| Assessment `IN_PROGRESS` | derived ad-hoc | Add enum value; set on first assessor save |
| Persisted pause deadline | email-only | `Assessment.pausedUntil DateTime?` |
| Immutable submission date | incidental | DB-level guard + app-level invariant |
| Submitted **and** awaiting docs | impossible (Paused clobbers) | Falls out of lifecycle separation |
| 3 outcomes | binary | Extend `AssessmentOutcome` |
| Explicit new/rolling type | inferred | `Application.applicationType` enum |
| No parent leakage of internal states | leaks (relabelled) | Parent-facing status projection (Epic 05 consumes) |

---

## 5. Proposed approach

### 5.1 Schema (Prisma + migration)

New enums; rename/repurpose existing. Migration is **additive then backfilled
then tightened**, in three ordered migrations within one PR:

```prisma
enum ApplicationFormStatus { CREATED NOT_STARTED IN_PROGRESS FILLED_IN SUBMITTED }
enum ApplicationType { NEW ROLLING_OVER }
enum AssessmentStatus { NOT_STARTED IN_PROGRESS PAUSED COMPLETED }   // + IN_PROGRESS
enum AssessmentOutcome { DOES_NOT_QUALIFY QUALIFIES_NOT_AWARDED AWARDED }

model Application {
  // + formStatus     ApplicationFormStatus @default(CREATED)
  // + applicationType ApplicationType      @default(NEW)
  // + archivedAt      DateTime?
  // keep `status` temporarily as @deprecated; drop in a later migration
}
model Assessment {
  // + pausedUntil DateTime?
  // status: now includes IN_PROGRESS; outcome: new 3-value enum
}
```

**Backfill** (data migration, deterministic mapping from the old fused enum):

| old `ApplicationStatus` | `formStatus` | `Assessment.status` | `outcome` |
|---|---|---|---|
| PRE_SUBMISSION | derive (CREATED/NOT_STARTED/IN_PROGRESS/FILLED_IN from sections) | NOT_STARTED | — |
| SUBMITTED | SUBMITTED | NOT_STARTED | — |
| NOT_STARTED (assessment) | SUBMITTED | IN_PROGRESS | — |
| PAUSED | SUBMITTED | PAUSED | — |
| COMPLETED | SUBMITTED | COMPLETED | — |
| QUALIFIES | SUBMITTED | COMPLETED | AWARDED *or* QUALIFIES_NOT_AWARDED (see D-note) |
| DOES_NOT_QUALIFY | SUBMITTED | COMPLETED | DOES_NOT_QUALIFY |

> *D-note:* legacy `QUALIFIES` maps to `AWARDED` where a `BursaryAccount` was
> created, else `QUALIFIES_NOT_AWARDED`. Verify against `BursaryAccount` rows
> during backfill.

**Immutability:** enforce `submittedAt` write-once via a Postgres trigger
(raise if `OLD.submittedAt IS NOT NULL AND NEW.submittedAt <> OLD.submittedAt`)
plus an app-level invariant in the submit action. (Trigger is the durable
guard; the app check gives a friendly error.)

### 5.2 Server actions / API

- Introduce a single **status service** (`src/lib/applications/status.ts`) that
  owns the legal transition tables for each lifecycle and is the only writer.
  Migrate the scattered writers (`apply/actions.ts`, `assessments.ts`,
  `(admin)/applications/[id]/actions.ts`, `(portal)/actions.ts`,
  `set-outcome-core.ts`) to call it.
- `formStatus` derivation helper reads `ApplicationSection.isComplete` +
  `section-gaps.ts` to compute IN_PROGRESS / FILLED_IN.
- `pauseAssessment` persists `pausedUntil`; the missing-docs email reads it
  instead of recomputing inline (`actions.ts:214`).
- Outcome action writes the 3-value `AssessmentOutcome`; AWARDED hands off to
  the account/schedule logic (Epic 10) behind an interface so 01 can land first.

### 5.3 UI

- **Delete/replace** the stale `status-badge.tsx`; introduce typed badges per
  lifecycle (`FormStatusBadge`, `AssessmentStatusBadge`, `OutcomeBadge`).
- Admin/assessor views show all three; **parent views consume a projection**
  (Epic 05) that maps internal → parent-safe labels.
- Assessment header pill uses the real `IN_PROGRESS` instead of the derived
  guess (`assessment-form.tsx:778`).

### 5.4 Seed / reference data

- Update demo seed (`seed-demo`) to populate the new fields across its fixtures
  so each lifecycle state is represented. No reference-data change.

---

## 6. Work breakdown (PR-sized)

- [ ] **PR-1 (schema, additive):** new enums + columns (`formStatus`,
      `applicationType`, `archivedAt`, `Assessment.pausedUntil`,
      `AssessmentStatus.IN_PROGRESS`, 3-value `AssessmentOutcome`), nullable/defaulted.
- [ ] **PR-2 (backfill):** data migration per the mapping table; verify against
      `BursaryAccount`. Idempotent, reversible-by-design.
- [ ] **PR-3 (status service):** central transition service + migrate all
      writers; delete inline pause-deadline math; wire `pausedUntil`.
- [ ] **PR-4 (derivation + badges):** form-status derivation from sections;
      typed badge components; remove stale `status-badge.tsx`; fix assessment pill.
- [ ] **PR-5 (immutability):** `submittedAt` trigger migration + app invariant + test.
- [ ] **PR-6 (cutover):** drop the deprecated fused `status` column once all
      readers are migrated; update reports/dashboard/cockpit queries.

---

## 7. Open decisions

- **D2** — single submitted state + derived "Received/Submitted" label.
  *(default: yes)* — [register](../README.md#5-decision-register).
- Confirms needed before **PR-6 cutover** that no external/report consumer reads
  the old fused `status` string directly.

---

## 8. Risks & mitigations

- **Wide blast radius** — `status` is read in dashboard tiles, reports, queue,
  round cockpit, watchlist. *Mitigation:* keep the deprecated column through
  PR-1→PR-5; cut over readers before dropping it in PR-6; grep-gate in CI.
- **Backfill ambiguity** (legacy QUALIFIES → awarded vs not) — *Mitigation:*
  join to `BursaryAccount`; dry-run the mapping and diff counts before applying.
- **Round Cockpit watchlist** derives rules 4/5/6 from `AuditLog` (no timestamp
  columns). Adding `pausedUntil`/`archivedAt` lets some rules read real columns —
  coordinate with Epic 03/10 but don't regress the cockpit in this epic.

---

## 9. Out of scope / deferred

- Forward round-schedule generation on AWARD → **Epic 10**.
- Parent-facing label projection & visibility trimming → **Epic 05** (01 only
  provides the safe mapping surface).
- Outcome terminology for scholarships/siblings → **Epic 08**.

---

## 10. Acceptance criteria

- An application can be `formStatus = SUBMITTED` while its assessment is
  `PAUSED` — both render correctly and independently.
- `submittedAt` cannot be changed after first set (trigger test proves it).
- Pause sets a persisted `pausedUntil`; the missing-docs email and the portal
  countdown read the same value.
- All status writes go through the status service; no direct `status` enum
  writes remain (CI grep clean).
- Backfill reproduces today's effective states for every existing row (verified
  by a before/after count diff).
- Demo seed shows every state across the three lifecycles.
