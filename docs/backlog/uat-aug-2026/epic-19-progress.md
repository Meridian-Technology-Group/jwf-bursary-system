---
title: "Epic 19 — live progress board"
status: open
opened: 2026-08-26
opened_by: Brian Wagner
related:
  - ./epic-19-assessor-ux-and-lifecycle.md
  - ./epic-19-implementation-plan.md
---

# Epic 19 — progress

Board for [`epic-19-assessor-ux-and-lifecycle.md`](epic-19-assessor-ux-and-lifecycle.md). Build detail in [`epic-19-implementation-plan.md`](epic-19-implementation-plan.md).

**Legend:** ✅ done · 🔶 blocked · ⬜ not started · 🔴 needs a decision · ⏭ awaiting Brian

---

## Starting position — 26 Aug 2026

- `origin/staging` == `origin/main` at `6f9e730`. Nothing stranded. Everything through CH-59 and the Epic 18 scoping doc is **in production**.
- **Charlotte completed the first live production assessment** (AJ · Trinity · Y11 · 2026/27) and confirmed *"the calculations are correct"*. Epic 17's calc thread is closed by the client.
- A **second live assessment** was due the evening of 26 Aug. Its feedback is not yet in this board.
- **She is unavailable Fri 28 Aug → Wed 2 Sep.** Thursday 27 Aug is the only window before the break.

---

## Status at a glance

| Tranche | WP | Item | State | PR |
|---|---|---|---|---|
| — | — | Epic 19 opened (scope + plan + board) | ✅ | this PR |
| T1 | WP-A1 | CH-60 · document viewer height | ⬜ | |
| T1 | WP-A2 | CH-61 · parent details field order | ⬜ | |
| T1 | WP-A3 | CH-62 · Assets & Liabilities grouping | ⬜ | |
| T2 | WP-A4 | CH-63 · typed `0` persists as `0` | 🔴 needs **D-E** | |
| T3 | H1 | Autosave indicator under network failure | ⬜ | |
| T3 | H2 | Dirty-nav guard | ⬜ | |
| T3 | H5 | Declaration footer at mobile widths | ⬜ | |
| T3 | H3 | One-time PDF 410 | ⬜ low | |
| T3 | H4 | UC repeat-slot + 409 | ⬜ low | |
| T4 | WP-B1 | Lifecycle state machine diagram + questions to her | ⬜ | |
| T5 | WP-C1 | F1 · retire name masking (closes finding 2.18) | 🔶 **D-B**, **D-C** | |
| T5 | WP-C2 | F12 · inline upload accessible name | ⬜ | |
| T5 | WP-C3 | F9 · staff upload content digest | ⬜ | |
| T5 | WP-C9 | retire the legacy recommendation route | 🔴 needs **D-F** | |
| T5 | WP-C4 | F10 · family-ID slot index keying | ⬜ | |
| T5 | WP-C5 | F8 · `INVESTMENT_PARENT_2` guard | 🔶 **D-D** | |
| T5 | WP-C6 | F11b / F11c · hidden-branch retention | 🔶 **D-A** | |
| T5 | WP-C7 | F6 · blank vs deliberate £0 (portal side) | 🔶 after WP-A4 | |
| T5 | WP-C8 | CH-27 · invitation preview, editable per send | ⬜ | |
| T6 | WP-B2 | "Stored as complete" | 🔶 after T4 | |
| T6 | WP-B3 | New Award transition | 🔶 after T4, **Q14** | |
| T6 | WP-B4 | Waiting list state | 🔶 after T4 | |
| T6 | WP-B5 | Closed & archived | 🔶 after T4, **Q15** | |
| T6 | WP-B7 | Remove the three decision buttons | 🔶 **after B3** | |
| T6 | WP-B6 | Closed & purged | 🔶 **last**, needs **Q10b** | |
| D | WP-D1 | **Q8 · savings-test deduction** | 🔴 **open, award-affecting** | |
| D | WP-D2 | CH-41 · property category → 5 | 🔶 **Q7** | |
| D | WP-D3 | CH-32 · single-invite BCC | ⬜ buildable on default | |
| D | WP-D4 | CH-33 / CH-34 · progress + forward view | 🔶 **Q5** | |
| D | WP-D5 | CH-47b · winter-window tax year | ⬜ **due before 10 Nov** | |
| D | WP-D6 | CH-48 · fees@ reply-to on staging | ⏭ Brian — env var | |
| E | WP-E1 | Domain / URL customisation with Alex | ⏭ Thu 27 Aug call | |
| E | WP-E2 | Grant Tracker migration — book the vendor call | ⏭ Thu 27 Aug call | |
| E | WP-E3 | £7,000 PO | ⏭ Charlotte chasing | |

---

## 🔴 Decisions outstanding

| ID | Question | Gates | Owner |
|---|---|---|---|
| D-A | Should a collapsed branch preserve what was typed? *(recommendation: keep "yes" — deletes F11b)* | WP-C6 | Brian |
| D-B | Does the queue keep its masked-by-default name toggle? | WP-C1 | Brian |
| D-C | Do `NAME_REVEAL` audit rows still earn their keep? | WP-C1 | Brian |
| D-D | How should a document rule read state from outside its own section? | WP-C5 | Brian |
| D-E | CH-63 — explicit "no override" control, or opt the two override fields out? *(recommendation: explicit control)* | WP-A4 | Brian |
| D-F | Legacy recommendation route — redirect or delete? | WP-C9 | Brian |

## 🔴 Questions for Charlotte — ask Thu 27 Aug or wait until 3 Sep

Priority order for the call. Full text in the [sprint doc's register](epic-19-assessor-ux-and-lifecycle.md#open-questions-register).

1. **Q8** — savings test: which deduction, raw or annualised? **Award-affecting.**
2. **Q7** — dropping the "with mortgage" rows makes 6 property categories unreachable. Knowing yes?
3. **Q11** — does the outcome email stop, or move to New Award? *If it stops, nobody is ever told.*
4. **Q14** — the account-reference prompt at New Award: edit an existing reference, or mint one?
5. **Q15** — is "closed & archived" reopenable?
6. **Q10b** — purge vs the 7-year retention guard and append-only `audit_logs`.
7. Q9 (debt ratio of exactly zero) · Q5 (her Assessment Admin layout email) · Q4 (BCC) · Q3 (debt labels) · Q6 (the £89,257.14 reconciliation)

---

## Notes and corrections

### CH-45 is done — the Epic 17 board's later note is stale

`epic-17-progress.md` carries a note timestamped **25 Aug 18:31** saying CH-45 *"is still open"* after Charlotte corrected herself about which page she had compared. That note was true when written and is **no longer true**: CH-45 shipped at **21:49** the same evening in `a581c2b` (PR #361), and it shipped against the **Assessments** page — the correct one. `src/app/(admin)/assessments/page.tsx:41` carries the CH-45 comment and the sort implementation. The Epic 17 status table is right; only the prose note below it is stale. Corrected in this PR.

### Q8 survived the promotion, and Charlotte's sign-off does not close it

Everything on `staging` was promoted on 25 Aug while Q8 was still marked *"promotion is ON HOLD pending Q8"*. That was a reasonable call — both her figures and the engine's produce a **negative** savings test for her example, so nothing is added back and her assessment is unaffected.

It remains open, and it remains award-affecting: **for a household with net savings above the cushion, Q8 decides whether anything is added back at all.** One live assessment, whose savings test came out negative, cannot exercise the branch where the two calculations diverge. Do not let *"the calculations are correct"* retire this.

### Production is no longer empty

Epic 17 leaned repeatedly on "prod holds zero assessments, so nothing is retro-changed". From 26 Aug that escape hatch is gone. Any change to a calculation, band, category or stored figure now needs its blast radius measured against live rows before promotion.

---

## Log

*(newest first — append as work lands)*

### 2026-08-26 · Epic 19 opened

Queued every pending item into one ordered list: Charlotte's 26 Aug batch (CH-60…63), Epic 18's lifecycle build, Epic 16's engineering residue, Epic 17's leftovers, and the two operational threads. Absorbed Epic 16's queue; Epic 18 keeps its spec and contributes Lane B. Catalogued the 26 Aug emails as [`2026-08-26-charlotte-feedback.md`](../../client-feedback/2026-08-26-charlotte-feedback.md).

Root causes located while scoping, so the build does not have to re-derive them:

- **CH-60** — `documents/page.tsx:75` (`h-[calc(100vh-260px)]`) and `document-list-client.tsx:349` (`max-h-[45%]`). Her constraint rules out the obvious fix: the search row is pinned, the *list* gives up height.
- **CH-61 / CH-62** — one cause. `DataBlock` (`application-section-cards.tsx:261`) renders `Object.entries(data)` in raw JSONB order. Her grouping for CH-62 **already exists as comments** in `slots.ts:40-59`.
- **CH-63** — `earner-form-v2.tsx:67`, `hasValue = v > 0`. Collides with the CH-21/22 override sentinel documented at `assessment-form-v2.tsx:540` and enforced in five places each for two award-affecting fields. Not a one-line fix; hence **D-E**.

Also surfaced: `allowNegative` on the admin `CurrencyInput` is passed by no consumer, so its `v !== 0` branch is dead code today.
