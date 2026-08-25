---
title: "Epic 17 — live progress board"
status: open
opened: 2026-08-25
opened_by: Brian Wagner
related:
  - ./epic-17-assessment-verification-sprint.md
  - ./source-materials/screenshots-2026-08-23-24/README.md
---

# Epic 17 — progress

Board for [`epic-17-assessment-verification-sprint.md`](epic-17-assessment-verification-sprint.md).

## Status at a glance

| Lane | Item | State | PR |
|---|---|---|---|
| WP0 | Screenshot decode (Lane 0 subset) | ✅ **done** | #346 |
| 0 | CH-35 · assessment completable | ✅ **on `staging`** | #346 |
| 0 | CH-36 · before-VAT award summary | ✅ **on `staging`** | #346 |
| 1 | CH-42 · lifestyle squeeze (×100 + status only) | ✅ **on `staging`** | #346 |
| — | Sprint doc opened | ✅ | #345 |
| 1 | CH-37 · savings test below debt | ⬜ next | |
| 1 | CH-38 · savings band table (14 rows) | ⬜ next | |
| 1 | CH-39 · income categories 1→11 | ⬜ blocked on WP0 decode of `1a033733c3550e80/image001` | |
| 1 | CH-40 · debt-ratio `<` verification | ⬜ | |
| 1 | CH-41 · property category → 5 | 🔶 blocked on Q1 (her plain-English matrix) | |
| 2 | CH-43…CH-49 | ⬜ | |
| 3 | CH-32 · single-invite BCC | ⬜ buildable on default (option 1) | |
| 3 | CH-33/CH-34 · progress view + forward view | 🔶 blocked on Q5 (her layout email) | |

## ⏭ Awaiting Brian: promotion to production

**#346 is on `staging` and verified there. It is NOT in production.**

Charlotte assesses the two real internal applications on **production** this
evening, so Lane 0 only counts once `staging → main` is merged. Per `CLAUDE.md`
rule 6 that promotion needs an explicit instruction naming it, so it has not
been opened.

Promotion carries: #345 (sprint doc), #346 (CH-35 / CH-36 / CH-42) and the
`20260825090000_ch36_award_summary_before_vat` migration, which is additive and
applies to a production table holding **0 recommendations**.

## Lane 0 verification evidence (2026-08-25)

Local, before merge:

- `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` — clean
- `npx vitest run` — **2,190 tests / 162 files pass** (up 8 from 2,182)
- `npx prisma format --check` — clean

CI on #346: lint/typecheck/test + Vercel green. `staging` after merge: CI
success, **DB push success** — migration recorded on nonprod at 15:58:48 with
`applied_steps_count = 1`; both new columns present on `recommendations`.

Browser-verified on the staging alias as `brian.admin@jwf-bursary.test`,
against **Charlotte's own assessment** (`WS-202627-0008`, assessment
`7c98ec69-…`):

| Check | Result |
|---|---|
| Lifecycle chips are not controls | ✅ all four are `SPAN`; inactive carry only `text-slate-400` — no border, no `bg-`; current keeps `bg-success-600` |
| Model tab's Complete button | ✅ `disabled: false` — confirming the gate was never the problem |
| Award tab dead end | ✅ instruction now renders with an enabled **Complete assessment** button |
| CH-42 on the summary panel | ✅ reads `Lifestyle squeeze — AFFORDABLE, NO IMPACT`; no percentage, no `7631%` |
| Her six CH-36 fields | ✅ present, her labels, her order |

CH-36 arithmetic, driven live against her assessment (fees £26,175, 10%,
bursary £12,000 before VAT) — **matches to the penny**:

| Field | Rendered | Expected |
|---|---|---|
| Fees for next year — before VAT | £26,175.00 | £26,175.00 |
| Scholarship Spend — before VAT | £2,617.50 | £2,617.50 |
| Net fees — before VAT | £11,557.50 | £11,557.50 |
| Yearly Payable fees — incl. VAT | £13,869.00 | £13,869.00 |

**Her data was not modified.** The figures above were typed but never saved
(the recommendation form has no autosave); `updated_at` on her assessment
remained `2026-08-24 23:04:56` throughout.

The Complete button's server-action wiring — the one risk a render cannot
prove, since it crosses a route boundary — was exercised on a throwaway of
mine instead (`R-9`, assessment `1a27e962-…`): status → `COMPLETED`,
`completed_at` set, `ASSESSMENT_COMPLETE` audit row written, then reopened via
the UI back to `IN_PROGRESS` to leave it as found.

## Notes for the next session

- **A legacy dead end exists at `/applications/{id}/recommendation`** (the v1
  route). It still shows the old three-layer header with a blue **Mark
  Complete**, the old `Applicant Data / Assessment / Recommendation / History`
  tab row, and *"Assessment must be completed first"* — all of which CH-04,
  CH-07 and CI-11 removed from the v2 workspace at
  `/applications/{id}/assessment`. Charlotte is not using this route, so it is
  not urgent, but it is a live second front door to the same application and
  will confuse someone. Worth an item.
- WP0 is only part-done: 3 of 17 images pulled. The remaining decodes gate
  CH-39, CH-40, CH-41, CH-43, CH-44 and CH-46 — in particular **do not delete
  any dashboard banner before decoding `1a0357ecd2e12b6c/image001`**.
