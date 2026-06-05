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
| 2 | [02 Application form re-scope](plans/02-application-form-rescope.md) | 🚫 | 01, 04, **D3** | — |
| 2 | [05 Parent portal experience](plans/05-parent-portal-experience.md) | 🚫 | 01, 02, 03, **D10** | — |
| 3 | [06 Assessor experience & UI](plans/06-assessor-experience-and-ui.md) | 🚫 | 02 | — |
| 3 | [07 Calculations & fees](plans/07-assessment-calculations-and-fees.md) | 🚫 | 06, **D8, D14** | — |
| 3 | [08 Recommendation & outcome](plans/08-recommendation-and-outcome.md) | 🚫 | 01, 07, **D4, D7, D9** | — |
| 3 | [09 Complex household / second parent](plans/09-complex-household-and-second-parent.md) | 🚫 | 02, 06, **D15–D17** | — |
| 4 | [10 Data retention & account lifecycle](plans/10-data-retention-and-account-lifecycle.md) | 🚫 | 01, 03, **D6, D19** | — |
| 4 | [11 Auth & access](plans/11-auth-and-access.md) | ⬜ | **D21** (SSO only) | — |

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

Mirrors [README §5](README.md#5-decision-register). ✅ = resolved and safe to build against.

| # | Owner | Status | Gates |
|---|---|---|---|
| D1 | Brian | ✅ school locked at invite; Q1 read-only; entry-year admin-side | 02, 04 |
| D2 | Brian | ✅ single `SUBMITTED` state, label by `applicationType` | 01, 05 |
| D5 | Brian | ✅ tax-year derives from `Round.academicYear` | 02 |
| D12 | Brian | ✅ one account per child keyed (childName + DOB) | 04 |
| D18 | Brian | ✅ status-keyed portal guard; `DELETED` = erasure only | 10 |
| D20 | Brian/Charlotte | ✅ build optional idle watcher; window TBC (non-blocking) | 11 |
| D3 | Charlotte | ⏳ income sub-table rebuild | **02** |
| D4 | Charlotte | ⏳ real reason codes | **08** |
| D6 | Charlotte (+DPO) | ⏳ retention tiers | **10** |
| D7 | Charlotte | ⏳ remove assessor PDF | **08** |
| D8 | Charlotte | ⏳ VAT applicability | **07** |
| D9 | Charlotte | ⏳ scholarship as £ award | **08** |
| D10 | Charlotte | ⏳ T&Cs final wording + per-round acceptance | **05** |
| D11 | Charlotte | ⏳ declaration wording (default: workbook verbatim) | **02** |
| D13 | Charlotte | ⏳ concurrent-round cap (UI shape) | **03** |
| D14 | Charlotte | ⏳ fee year driving payable-monthly | **07** |
| D15–D17 | Charlotte/Brian | ⏳ custody / guardian / remarried modelling | **09** |
| D19 | Charlotte | ⏳ forward-schedule horizon + date policy | **10** |
| D21 | Charlotte | ⏳ commission MS SSO build after spike | **11** |

**Critical path unblocked now:** Wave 0 (no decisions) and Epic 01 (D2 ✅).
Epics 03/04 unblock once 01's schema lands (D1/D12 ✅). Waves 2–3 mostly await
Charlotte.

---

## Change log

- **2026-06-05** — Programme execution opened. Scaffolding (12 plans +
  current-state map) authored on `chore/process-alignment-scaffolding`. D2, D12,
  D18, D20 locked at defaults. This ledger created. Next: push scaffolding PR,
  then Wave 0.
