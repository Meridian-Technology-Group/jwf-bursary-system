---
title: Defect fixes (P0) — the immediate demo bug list
status: planned
severity: high
area: bugfix
wave: 0
depends_on: []
sources:
  - ../source-materials/meeting-findings.md   # "Bugs / things that did not work as expected"
related:
  - 00-current-state-map.md                   # §C, §F root-cause several of these
  - 01-status-and-workflow-model.md           # owns the status-model bugs cross-ref'd below
  - 04-lead-applicant-contacts-and-invitations.md
  - 05-parent-portal-experience.md
---

# 12 — Defect fixes (P0)

**Objective.** Clear the immediate demo defect list captured in
[`meeting-findings.md`](../source-materials/meeting-findings.md) ("Bugs /
things that did not work as expected"). Unlike the other epics this is a
**defect register**, not a single feature: a bug-by-bug list ordered by
severity, each with symptom, root cause (`path:line` where pinned, else
"needs repro"), a fix sketch, and a note on whether it is **standalone**
(fixable here, now) or **owned by another epic** (cross-referenced and left
for that epic's structural work).

---

## 1. Background & rationale

This is **Wave 0**. The bugs below surfaced during the client demo on the
staging build. They are independent of the larger process-alignment rework
(Epics 01–11) and — crucially — they **block client testing**: the
show-names toggle, reference-data saves, round creation, and audit
timestamps all produce visibly-broken or misleading behaviour that erodes
tester confidence before the deeper rework even starts.

Per [README §6](../README.md#6-dependency-graph--sequencing), Wave 0 is pure
remediation with **no dependencies** and ships ahead of everything else.
Each standalone fix is a small, reversible, independently-shippable PR
against `staging`. Several were already root-caused during the codebase read
that produced [`00-current-state-map.md`](00-current-state-map.md) (§C, §F) —
those are marked **confirmed** below and cite exact lines; the remainder are
marked **needs repro** and carry a triage note.

A handful of items from the meeting list are *symptoms of the conflated
status model or the unlocked-invite model*. Those are **not** fixed here —
patching them in Wave 0 would be throwaway work that Epics 01/04/05 redo
properly. They are listed in [§3 Cross-epic](#3-bugs-owned-by-another-epic-cross-ref)
so nothing is dropped, with the owning epic named.

> **Confidence legend.** **[confirmed]** = root cause verified by reading the
> cited `path:line`, fix is mechanical. **[needs repro]** = reported in the
> demo, plausible cause noted, must be reproduced before a fix is committed.

---

## 2. Standalone bugs (fix now, in this epic)

Ordered by severity. Each is its own PR unless trivially grouped.

### 2.1 — Show-names toggle does nothing · **critical** · [confirmed]

- **Symptom.** An ADMIN clicks "Show names" in the queue/applications table;
  nothing happens — names stay masked, no error is shown.
- **Root cause.** Two faults compound:
  1. **Server over-restricts.** `GET /api/applications/names`
     (`src/app/api/applications/names/route.ts:27`) returns **403** for any
     role `!== ASSESSOR`. An ADMIN therefore gets Forbidden. (The route header
     comment even says "Requires ASSESSOR role" — the restriction is
     intentional but wrong for ADMIN.)
  2. **Client swallows the failure.** The fetch handler in
     `src/components/admin/application-table.tsx:707` throws on `!res.ok`, but
     the `catch` at **`application-table.tsx:726`** only `console.error`s —
     no toast, no inline error, no state change. The user sees a silent no-op.
- **Fix sketch.**
  - Server: allow **ADMIN** (and decide on VIEWER — see open decision below)
    alongside ASSESSOR at `route.ts:27`. Keep the `NAME_REVEAL` audit-log
    write (`route.ts:45`) for whichever roles are permitted so the reveal stays
    auditable.
  - Client: in the `catch` at `application-table.tsx:726`, surface the error
    to the user (toast/inline message) and reset `namesLoading`/`namesRevealed`
    so the toggle visibly fails rather than silently no-opping.
- **Open decision.** Should **VIEWER** be allowed to reveal names, or only
  ADMIN + ASSESSOR? Default: **ADMIN + ASSESSOR only** (VIEWER is read-only
  and least-privilege; reveal is a privileged, audited action). Confirm with
  Charlotte if VIEWER must see names. *(Not in the README decision register —
  it is a same-line implementation choice, recorded here.)*
- **Cross-ref.** Root-caused in [00 §F](00-current-state-map.md#f-settings-auth-audit-retention).

### 2.2 — Reference-data edits not saving in admin settings · **critical** · [confirmed]

- **Symptom.** An admin changes a Family-Type / School-Fees / Council-Tax
  value in Settings and saves. The **audit log records the change**, but the
  UI continues to show the old value — the edit appears not to persist.
- **Root cause.** These three reference tables are **append-only / versioned**:
  a "save" does an **INSERT** of a new row keyed `effectiveFrom @db.Date`
  (date, no time) under `@@unique([category, effectiveFrom])`. The read-side
  dedup (`src/lib/db/queries/reference-tables.ts:29` for family types; same
  pattern at `:66` school fees, `:100` council tax) orders **only** by
  `effectiveFrom desc` and keeps the first row per key. When the edit happens
  **on the same day** as the row it supersedes, both rows share the same
  `effectiveFrom` date, so the ordering between them is **non-deterministic** —
  Postgres may return the stale row first, which the dedup then keeps. The new
  value exists in the table (hence the audit entry) but never surfaces.
- **Fix sketch.** Two complementary changes (either fixes it; do both):
  1. **Add a `createdAt desc` tie-break** to every versioned read so the most
     recently-inserted same-day row wins:
     `orderBy: [{ category: "asc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }]`
     at `reference-tables.ts:29`, and the equivalents at `:66`, `:100`, and the
     "getAll…" variants (`:174`, `:194`) for consistency. *(All these models
     have a `createdAt` — verify in `prisma/schema.prisma`; `ReasonCodeRow`
     already exposes one.)*
  2. **Optionally upsert today's row** instead of always inserting: if a row
     with today's `effectiveFrom` exists, `update` it rather than INSERT a
     second same-day version. Prevents the duplicate-per-day rows entirely.
- **Scope note.** Affects **family-type / school-fees / council-tax** only.
  **reason-codes** and **email-templates** use a real `update` (single row,
  no `effectiveFrom` versioning) and are **not affected** — leave them.
- **Cross-ref.** Root-caused in [00 §F](00-current-state-map.md#f-settings-auth-audit-retention).

### 2.3 — Round creation shows "unexpected error" though the round was created · **high** · [confirmed]

- **Symptom.** Admin fills in the Create-Round dialog and submits. The round
  **is created** (it appears in the list on refresh), but the dialog shows
  **"An unexpected error occurred."**
- **Root cause.** **Next.js `redirect()` semantics**, not the single-OPEN
  guard. `createRoundAction` (`src/app/(admin)/rounds/actions.ts:56`) does its
  insert + audit inside `try`, then calls **`redirect("/rounds")` at
  `actions.ts:111`** — *outside* the try/catch. `redirect()` works by
  **throwing a `NEXT_REDIRECT` control-flow error**. Because this server
  action returns a `RoundActionResult` to the client (it is not awaited as a
  navigation), that throw propagates to the client transition as a rejected
  promise. The dialog's `onSubmit`
  (`src/components/admin/create-round-dialog.tsx:108`) does
  `const result = await createRoundAction(...)`; when the action *throws*,
  `result` is never assigned and the surrounding error path renders
  `"An unexpected error occurred."` (the fallback string at
  `create-round-dialog.tsx:110`) — even though the DB write already committed.
  > **Note.** The single-OPEN guard at `actions.ts:212` is in **`openRoundAction`**,
  > **not** `createRoundAction`, and throws *before* any write — it is **not**
  > the cause of this "created-but-errored" symptom. (Triaged and excluded.)
- **Fix sketch.** Make success an explicit, non-throwing return and let the
  **client** navigate:
  - Return `{ success: true }` from `createRoundAction` (drop the in-action
    `redirect` at `actions.ts:111`), then in `onSubmit`
    (`create-round-dialog.tsx:108`) close the dialog and `router.push("/rounds")`
    / `router.refresh()` on `result.success`.
  - **Or**, if the in-action redirect is kept, the client must treat a thrown
    `NEXT_REDIRECT` as success (re-throw it) rather than as an error — the
    explicit-return approach is cleaner and matches how `openRoundAction` /
    `closeRoundAction` already return `RoundActionResult` without redirecting.
  - Apply the same pattern to **`updateRoundAction`** (`actions.ts:168` has the
    identical `redirect` outside the try) to pre-empt the same bug on edit.
- **Cross-ref.** Round behaviour generally is Epic 03, but this is a
  **standalone error-handling bug** — fix it here; do not wait on 03.

### 2.4 — Audit timestamps render in UTC (1h behind London during BST) · **high** · [confirmed]

- **Symptom.** Audit-trail timestamps display **one hour behind** the actual
  London time during British Summer Time — entries look like they happened an
  hour earlier than they did.
- **Root cause.** `formatTimestamp` in the audit page
  (`src/app/(admin)/audit/page.tsx:53`) builds an `Intl.DateTimeFormat("en-GB", …)`
  with **no `timeZone` option**, so it formats in the runtime's zone (UTC on
  Vercel). During BST London is UTC+1, so every timestamp reads 1h early. The
  same `formatTimestamp` feeds `relativeTime` (`audit/page.tsx:65`), so the
  fallback absolute times are wrong too.
- **Fix sketch.** Add `timeZone: "Europe/London"` to the
  `Intl.DateTimeFormat` options at `audit/page.tsx:54`. (London, not a fixed
  `+01:00`, so GMT/BST is handled automatically.)
- **Related — same UTC risk, fix together.** The applications table renders
  submission dates with **date-fns** `format(d, "d MMM yyyy")` /
  `formatDistanceToNow(d, …)` in `formatSubmittedDate`
  (`src/components/admin/application-table.tsx:229` and `:231`). date-fns
  formats in the **runtime-local** zone with no zone control, so on a UTC
  server a just-past-midnight-London submission can show the **previous day**.
  Standardise on a single London-aware formatter (e.g. `formatInTimeZone` from
  `date-fns-tz`, or a shared `Intl` helper with `timeZone: "Europe/London"`)
  and reuse it in both places.
- **Cross-ref.** Root-caused in [00 §F](00-current-state-map.md#f-settings-auth-audit-retention).
  Broader **audit/history timeline accuracy** (correct *ordering* and event
  coverage, not just localisation) is [§3](#3-bugs-owned-by-another-epic-cross-ref).

### 2.5 — Stale / dead status-badge union · **medium** · [confirmed]

- **Symptom.** No direct user-visible defect today, but a latent
  inconsistency: a shared status component declares a status vocabulary that
  matches **no** Prisma enum, so any caller relying on it would mislabel or
  fall through to the raw-string fallback.
- **Root cause.** `src/components/shared/status-badge.tsx:24` declares
  `ApplicationStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "PAUSED" |
  "QUALIFIES" | "DOES_NOT_QUALIFY"`. The real Prisma enum
  (`prisma/schema.prisma`, see [00 §A](00-current-state-map.md#a-data-model--enums-prismaschemaprisma))
  has `PRE_SUBMISSION`, `NOT_STARTED`, `COMPLETED` — and **no** `DRAFT` or
  `IN_REVIEW`. The component is **dead/legacy**: real callers either map onto
  its accepted subset or build their own badges (e.g. the queue's local
  `mapStatus` at `application-table.tsx:238`; the portal's own
  `STATUS_LABELS` at `status/page.tsx:44`).
- **Fix sketch.** **In this epic:** the cheap, safe move is to **delete or
  clearly `@deprecated`-annotate** the stale union so nobody wires new code to
  it and CI/readers stop being misled. **Do not** invest in a "correct" badge
  here — Epic 01 replaces badges wholesale with **typed per-lifecycle** badges
  (`FormStatusBadge` / `AssessmentStatusBadge` / `OutcomeBadge`,
  [01 §5.3](01-status-and-workflow-model.md#53-ui)). Removing the dead union now
  is a clean prerequisite, not rework.
- **Cross-ref.** Replacement owned by **Epic 01**; this epic only removes the
  dead code. The *runtime* "inconsistent in-progress" mapping
  (`reports.ts:22` inProgress→PAUSED vs the dashboard tile labelling "In
  Progress / Assessment paused" at `(admin)/admin/page.tsx:170`) is a
  **status-model** defect — see [§3](#3-bugs-owned-by-another-epic-cross-ref).

### 2.6 — Admin wording appears in the assessor view · **medium** · [needs repro]

- **Symptom.** Strings written for the ADMIN persona (e.g. admin-only actions
  or "admin"-flavoured copy) appear in the **assessor** view, confusing
  assessors during the demo.
- **Root cause.** **needs repro** — exact strings/components not yet pinned.
  Triage starts in the shared admin/assessor layout and components gated by
  role: grep for hard-coded "Admin"/"admin"-labelled copy under
  `src/components/admin/` and `src/app/(admin)/**` that renders for
  `Role.ASSESSOR`, and check which nav/labels the assessor layout reuses from
  the admin shell.
- **Fix sketch.** Once located, gate the admin-only copy behind a role check
  (`role === Role.ADMIN`) or split the shared component's labels per role.
  Pure copy/visibility fix — no schema, no data.
- **Cross-ref.** Standalone (presentation only). Distinct from the broader
  **assessor UI rework** (layout, one-synopsis, doc nav) which is **Epic 06** —
  do *not* fold this into 06; it is a quick demo-blocker.

### 2.7 — User-guide / Notion delivery: shared links expired · **low** · [confirmed-cause]

- **Symptom.** Shared Notion user-guide links handed to the client were
  **inaccessible / expired**, so testers could not open the guide.
- **Root cause.** Expiring Notion public-share links (delivery/process issue,
  not a code defect).
- **Fix sketch.** Ship the **PDF backup** that already exists:
  `docs/guides/JWF-Bursary-System-User-Guide.pdf` (present in the repo,
  verified). Send the PDF alongside any Notion link as the durable fallback;
  if a live link is still wanted, re-share with a non-expiring/again-issued
  link. No code change.
- **Cross-ref.** Standalone; tracks the "send PDF user guides as fallback"
  process follow-up in [`meeting-findings.md`](../source-materials/meeting-findings.md).

---

## 3. Bugs owned by another epic (cross-ref — do NOT fix in Wave 0)

These were on the demo bug list but are **symptoms of structural work** that a
named epic does properly. Fixing them here would be throwaway. Listed so
nothing is lost; each carries its owning epic and current root-cause status.

| Reported bug | Why it is structural | Status | Owning epic |
|---|---|---|---|
| **Parent progress indicators / completion % wrong** ("X of 10" sidebar, landing-page count). | Three different denominators/derivations disagree: `portal-sidebar.tsx:234` uses filtered `countedSections.length`; `(portal)/page.tsx:263` uses a hard-coded `TOTAL_SECTIONS`; the review page recomputes via `isComplete` + a document-gap pass (`apply/review/page.tsx:497`). Needs the unified section-completeness source the form rebuild introduces. | [confirmed] (multi-source) | **05** (+ §A form/section model) |
| **Review/completion-count mismatch** in the parent review step ("fully complete" while still showing incomplete counts). | Same root as above — review page's "sections fully complete" (`apply/review/page.tsx:523`) re-derives completeness separately from the sidebar, so the two disagree. | [confirmed] (multi-source) | **05** |
| **Parent status leakage** — internal workflow states shown to parents (relabelled). | `(portal)/status/page.tsx:44-52` maps internal `NOT_STARTED → "Under Review"`, `COMPLETED → "Completed"`, etc. Trimming/parent-safe projection is the explicit job of the status split + portal rework. | [confirmed] | **01** (mapping surface) → **05** (visibility trim) |
| **Inconsistent "in progress"** across surfaces. | `reports.ts:22` maps `inProgress → PAUSED`; the dashboard tile labels that same count "In Progress / Assessment paused" (`(admin)/admin/page.tsx:170-171`); the enum has no real `IN_PROGRESS`. Resolved by adding the real state. | [confirmed] | **01** |
| **"Begin review" doesn't reflect a clean in-progress state.** | Admin "start review" sets assessment to `NOT_STARTED` (not a true in-progress) because `AssessmentStatus` has no `IN_PROGRESS` ([00 §C](00-current-state-map.md#c-status--workflow-transitions)). Same fix as above. | [confirmed] | **01** |
| **Invitation parent-vs-staff UX unclear** — wrong invite flow used in the demo. | The two flows already exist as separate models/code paths; the gap is UI clarity at the invite step, which Epic 04 redesigns around the contact register. | [needs repro] (UX) | **04** |
| **Required surname / child / school on invite slipping through.** | `createInvitationAction` makes `firstName/lastName/childName/school` optional (`invitations/actions.ts:54`, per [00 §D](00-current-state-map.md#d-rounds--invitations)); enforcing + **locking** these is core Epic 04 scope (D1). | [confirmed] | **04** |
| **Parent logout / session visibility missing.** | No clear logout affordance in the portal; part of the portal experience rework. | [needs repro] | **05** |
| **Cross-tab / session persona collisions** (login/out across personas → confused state). | Auth/session behaviour; relates to the optional inactivity-logout and session-handling work. Needs deliberate repro across tabs. | [needs repro] | **11** (auth/session) |
| **Audit/history timeline accuracy** (event coverage & ordering, beyond TZ). | The *localisation* slice is fixed in §2.4; correct *ordering/coverage* of timeline events ties into the status-model events the cockpit/audit consume. | [needs repro] | **01** / **03** (cockpit) |

> **Boundary rule.** Where a bug has both a cheap presentation fix and a deep
> structural fix, the **presentation** slice may land in Wave 0 only if it is
> genuinely throwaway-free (e.g. §2.4 TZ, §2.6 copy). The completion-count and
> status-leakage items are *not* in that category — their cheap fix would be
> redone by 01/05, so they are deferred wholesale.

---

## 4. Work breakdown (PR-sized)

Each standalone bug is an independent PR off `staging` (per repo `CLAUDE.md`);
no ordering between them, no schema changes, no migrations.

- [ ] **PR-A — show-names toggle** (§2.1): allow ADMIN (+ASSESSOR) in
      `route.ts:27`; surface the error in the `catch` at
      `application-table.tsx:726`. *(critical)*
- [ ] **PR-B — reference-data save** (§2.2): add `createdAt desc` tie-break to
      the versioned reads in `reference-tables.ts` (`:29`, `:66`, `:100`, and
      the getAll variants); optionally upsert same-day rows. *(critical)*
- [ ] **PR-C — round-create error handling** (§2.3): make
      `createRoundAction`/`updateRoundAction` return `{ success: true }` and
      navigate client-side in `create-round-dialog.tsx`. *(high)*
- [ ] **PR-D — timezone formatting** (§2.4): `timeZone: "Europe/London"` in
      `audit/page.tsx:54`; replace date-fns local formatting in
      `application-table.tsx:229/231` with a shared London-aware helper. *(high)*
- [ ] **PR-E — remove dead status-badge union** (§2.5): delete/`@deprecated`
      the stale union in `status-badge.tsx`; confirm no live callers break.
      *(medium — coordinate with Epic 01, but lands independently)*
- [ ] **PR-F — assessor copy** (§2.6): **repro first**, then gate admin-only
      strings out of the assessor view. *(medium)*
- [ ] **(no PR) — user guide** (§2.7): send the existing
      `docs/guides/JWF-Bursary-System-User-Guide.pdf` as the fallback; process,
      not code.

---

## 5. Open decisions

- **VIEWER name reveal** (§2.1): default **ADMIN + ASSESSOR only**; confirm
  with Charlotte if VIEWER must reveal names. Same-line implementation choice —
  not a README-register blocker.
- No other Wave-0 fix needs a stakeholder decision. The structural items in
  [§3](#3-bugs-owned-by-another-epic-cross-ref) inherit their owning epic's
  decisions (notably **D1** for invite locking, **D2** for the
  Received/Submitted label) — see the
  [README decision register](../README.md#5-decision-register).

---

## 6. Risks & mitigations

- **Show-names role widening** (§2.1) could over-expose names if VIEWER is
  added carelessly. *Mitigation:* default to ADMIN+ASSESSOR; keep the
  `NAME_REVEAL` audit-log write for every permitted role.
- **Reference-data tie-break** (§2.2) assumes a `createdAt` exists on the
  versioned models. *Mitigation:* confirm in `prisma/schema.prisma` before
  coding; if any model lacks it, fall back to the same-day **upsert** variant
  (no schema change needed). No migration in this epic either way.
- **Round redirect change** (§2.3) touches the create *and* edit flows.
  *Mitigation:* mirror the already-correct non-redirecting pattern of
  `openRoundAction`/`closeRoundAction`; manually verify both create and edit
  navigate and show no false error.
- **Dead-code removal** (§2.5) risks an unnoticed live caller. *Mitigation:*
  grep for `status-badge` imports before deleting; if any live caller exists,
  `@deprecated` instead and hand the real replacement to Epic 01.
- **Cross-epic creep:** the temptation to "just fix" the completion-count /
  status-leakage items in Wave 0. *Mitigation:* the boundary rule in
  [§3](#3-bugs-owned-by-another-epic-cross-ref) — defer anything 01/04/05 would
  redo.

---

## 7. Out of scope / deferred

- All structural items in [§3](#3-bugs-owned-by-another-epic-cross-ref)
  (progress counts, status leakage, invite locking, in-progress state, session
  collisions, timeline coverage) → their named epics (01/04/05/11/03).
- Any **schema change or migration** — Wave 0 is code-only by design.
- The typed per-lifecycle badge components → **Epic 01** (this epic only
  removes the dead union).

---

## 8. Acceptance criteria

The **demo bug list verifiably cleared**, with a repro/verification note per
fix. These are independently shippable and **unblock client testing** — none
waits on Wave 1+.

- **§2.1** An **ADMIN** toggles "Show names" and names appear (no 403);
  reveal writes a `NAME_REVEAL` audit entry; a forced failure now surfaces a
  visible error instead of a silent no-op. *(Repro: log in as ADMIN, toggle on
  in `/queue`.)*
- **§2.2** Editing a Family-Type / School-Fees / Council-Tax value **on the
  same day** and saving shows the **new** value immediately in Settings (not
  just in the audit log). *(Repro: edit a value twice in one day; the latest
  wins.)*
- **§2.3** Creating (and editing) a round **navigates to `/rounds`** and shows
  **no** "unexpected error"; the round is present. *(Repro: create a round via
  the dialog; confirm no error toast and the list updates.)*
- **§2.4** Audit timestamps and applications-table submission dates render in
  **Europe/London** (correct during BST, no off-by-one-hour, no off-by-one-day
  near midnight). *(Repro: compare an audit entry's displayed time to the known
  London time of the action during BST.)*
- **§2.5** The stale `status-badge.tsx` union is removed/`@deprecated` with **no
  live callers broken** (build + grep clean).
- **§2.6** No ADMIN-only copy renders in the **assessor** view. *(Repro: log in
  as ASSESSOR; inspect the previously-offending screens.)*
- **§2.7** The client receives a working **PDF user guide**
  (`docs/guides/JWF-Bursary-System-User-Guide.pdf`) as the durable fallback.
- Each PR is a focused, reversible change against `staging` with no schema
  migration.
