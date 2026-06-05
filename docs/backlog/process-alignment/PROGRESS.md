# Process Alignment — execution ledger

> **What this is.** The living *state* surface for the process-alignment
> programme. The [`plans/`](plans/) files are the **spec**; this file is the
> **progress**. Read it first at the start of every work session to recover
> where execution stands. Update it **inside the same PR** that completes a
> task so the tick rides the squash-merge into `staging` and is never lost to a
> separate clobberable commit.
>
> **Spec:** [README.md](README.md) (spine + decision register). **Owner:** Brian Wagner.

**Started:** 2026-06-05 · **Current focus:** scaffolding PR → Wave 0 (defects).

---

## How this ledger is maintained (rules)

1. **One epic ≈ one branch off `staging`**; one PR per work-breakdown item.
2. **Tick a box in the PR that completes it** — never in a standalone commit
   that a later rebase could overwrite. After each merge, `git pull` staging and
   rebase open epic branches so this ledger stays the single current truth.
3. **Never force-overwrite this file.** Advance epic-plan frontmatter
   `status:` (`planned → ready → in-progress → shipped`) the same way.
4. Migrations are **additive → backfill → tighten**, each in the PR that needs
   it; never edit an applied migration.
5. **Brian merges to `staging`; Brian alone promotes `staging → main`.**
   No auto-merge of these PRs.

---

## Wave / epic status

Legend: ⬜ not started · 🟡 in progress · ✅ shipped to staging · 🚫 blocked · ⏸ deferred

| Wave | Epic | Status | Blocked by | Branch / PRs |
|---|---|---|---|---|
| — | Scaffolding (plans + this ledger) | 🟡 | — | `chore/process-alignment-scaffolding` → PR pending |
| 0 | [12 Defect fixes](plans/12-defect-fixes.md) | ⬜ | — | — |
| 1 | [01 Status & workflow model](plans/01-status-and-workflow-model.md) | ⬜ | — | — |
| 1 | [03 Round management](plans/03-round-management.md) | ⬜ | 01 | — |
| 1 | [04 Lead-applicant contacts & invitations](plans/04-lead-applicant-contacts-and-invitations.md) | ⬜ | 01 | — |
| 2 | [02 Application form re-scope](plans/02-application-form-rescope.md) | ⏳ deps | 01, 04 (deps) · D3 ✅ · D11 artifact (build to workbook) | — |
| 2 | [05 Parent portal experience](plans/05-parent-portal-experience.md) | ⏳ deps | 01, 02, 03 (deps) · D10 ✅ | — |
| 3 | [06 Assessor experience & UI](plans/06-assessor-experience-and-ui.md) | ⏳ deps | 02 (dep) | — |
| 3 | [07 Calculations & fees](plans/07-assessment-calculations-and-fees.md) | ⏳ deps | 06 (dep) · D8/D14 narrow, non-blocking | — |
| 3 | [08 Recommendation & outcome](plans/08-recommendation-and-outcome.md) | ⏳ deps | 01, 07 (deps) · D7/D9 ✅ · D4 artifact (placeholders) | — |
| 3 | [09 Complex household / second parent](plans/09-complex-household-and-second-parent.md) | ⏳ deps | 02, 06 (deps) · D15–D17 build to workbook FAQ | — |
| 4 | [10 Data retention & account lifecycle](plans/10-data-retention-and-account-lifecycle.md) | ⏳ deps | 01, 03 (deps) · D6 ✅ (DPO signs years) · D19 narrow | — |
| 4 | [11 Auth & access](plans/11-auth-and-access.md) | ⬜ | none · D21 ✅ (SSO deferred) · D20 ✅ (idle watcher) | — |

---

## Active wave — Wave 0 (defect fixes, Epic 12)

Six independent PRs off `staging`, no schema, no migrations
([plan §4](plans/12-defect-fixes.md#4-work-breakdown-pr-sized)).

- [ ] **PR-A** — show-names toggle: allow ADMIN(+ASSESSOR) in `names/route.ts:27`; surface error in `application-table.tsx:726`. *(critical)*
- [ ] **PR-B** — reference-data save: `createdAt desc` tie-break in `reference-tables.ts` (`:29/:66/:100` + getAll). *(critical)*
- [ ] **PR-C** — round-create error: return `{success:true}` + client navigate in `create-round-dialog.tsx`; mirror to `updateRoundAction`. *(high)*
- [ ] **PR-D** — timezone: `timeZone:"Europe/London"` in `audit/page.tsx:54`; shared London formatter in `application-table.tsx:229/231`. *(high)*
- [ ] **PR-E** — remove dead `status-badge.tsx` union; grep for live callers first. *(medium, coordinate Epic 01)*
- [ ] **PR-F** — assessor copy: **repro first**, then gate ADMIN-only strings out of the assessor view. *(medium)*
- [ ] **(no PR)** — user guide: send `docs/guides/JWF-Bursary-System-User-Guide.pdf` as the durable fallback. *(process)*

**Open same-line decision:** VIEWER name reveal — default ADMIN+ASSESSOR only (confirm with Charlotte if VIEWER must reveal).

---

## Decision register — execution view

Mirrors [README §5](README.md#5-decision-register). Reconciled 2026-06-05 against
`meeting-findings.md` + `feedback.md`: Charlotte decided most "Charlotte" items in
the meeting — the register was written too defensively. ✅ = decided, safe to build.
📦 = **deliverable** she still owes (build to a working default now, swap on arrival).
🔎 = narrow technical confirm (build to default, flag).

| # | Owner | Status | Gates |
|---|---|---|---|
| D1 | Brian | ✅ school locked at invite; Q1 read-only; entry-year admin-side | 02, 04 |
| D2 | Brian | ✅ single `SUBMITTED` state, label by `applicationType` | 01, 05 |
| D5 | Brian | ✅ tax-year derives from `Round.academicYear` | 02 |
| D12 | Brian | ✅ one account per child keyed (childName + DOB) | 04 |
| D18 | Brian | ✅ status-keyed portal guard; `DELETED` = erasure only | 10 |
| D20 | Brian/Charlotte | ✅ build optional idle watcher; window TBC | 11 |
| D3 | Charlotte | ✅ rebuild form to workbook (meeting) | 02 |
| D7 | Charlotte | ✅ remove unused assessor PDF (meeting) | 08 |
| D9 | Charlotte | ✅ scholarship as distinct award (meeting) | 08 |
| D10 | Charlotte | ✅ display supplied T&Cs; record acceptance (feedback) | 05 |
| D13 | Charlotte | ✅ two concurrent rounds, 2-optimised UI (meeting) | 03 |
| D21 | Charlotte | ✅ SSO backlog — spike only, defer build (meeting) | 11 |
| D6 | Charlotte (+DPO) | ✅ purge declined / 6-yr q-n-a / 7-yr awarded (meeting); DPO signs year values | 10 |
| D4 | Charlotte | 📦 real reason codes — build on placeholders, swap when sent | 08 |
| D11 | Charlotte | 📦 final declaration text — build workbook-verbatim, swap if sent | 02 |
| D8 | Charlotte/finance | 🔎 VAT 20% applicability (not raised in meeting) — keep current, flag | 07 |
| D14 | Charlotte | 🔎 fee-uplift boundary split rule — default current-yr/12, flag | 07 |
| D15–D17 | Charlotte/Brian | 🔎 household scenario fine-detail — build to workbook FAQ; H7/H9 stay assessor flags | 09 |
| D19 | Charlotte | 🔎 forward-schedule horizon + date policy — default years-to-final-eligible | 10 |

**Nothing is decision-blocked.** The only real sequencing constraint is the
dependency graph (the waves). The two 📦 items (reason codes, declaration text) are
swap-in artifacts with working defaults. 🔎 items are narrow confirmations that
don't gate starting their epic. Critical path is purely: Wave 0 → 01 → {03, 04} →
Wave 2 → Wave 3 → Wave 4.

---

## Change log

- **2026-06-05** — Programme execution opened. Scaffolding (12 plans +
  current-state map) authored on `chore/process-alignment-scaffolding`. D2, D12,
  D18, D20 locked at defaults. This ledger created. Next: push scaffolding PR,
  then Wave 0.
