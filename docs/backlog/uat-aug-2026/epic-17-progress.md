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
| A1 | CH-37 · savings test dependency order | ✅ **on `staging`** | #354 |
| A2 | CH-38 · savings band table (15 rows) | ✅ **on `staging`** | #355 |
| A3 | CH-39 · income categories 1→11 | ✅ **on `staging`** | #355 |
| — | Implementation plan | ✅ | #353 |
| 1 | CH-40 · debt-ratio `<` verification | ⬜ | |
| 1 | CH-41 · property category → 5 | 🔶 **Q1 answered**; now gated on **Q7** (dropping with-mortgage rows kills 6 categories) | |
| 1 | CH-52 · affordability cap at full incl-VAT fees | ⬜ **Q2 answered**, ready | |
| 2 | CH-43…CH-49 | ⬜ | |
| 2 | CH-50 · fees column header "(excluding VAT)" | ⬜ ready | |
| 2 | CH-51 · fees admin: max payable incl. VAT column | ⬜ ready | |
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

## 25 Aug follow-up from Charlotte (msg `1a03a0ef60dcb5b9`)

Arrived 17:54 UTC — **25 minutes before the promotion merged**, so it responds to
the morning email, not to what is now live. Decoded in full; five screenshots
committed.

- **Q1 and Q2 both answered**, unblocking CH-41 and creating CH-52.
- **CH-41 is a spec change, not a bug.** Her household has a £179,000 mortgage on
  a £450,000 home, so her Table 2 as written genuinely yields category 3 — what
  the engine returns. Her expected 5 comes from her footnote asking to drop the
  "with mortgage" rows entirely. The morning email called it a bug; it was not.
- **Her matched figure is total market value, not equity** — her prose and her
  screenshot disagree, and the screenshot wins.
- **New Q7 gates CH-41**: dropping those rows makes categories 2, 3, 6, 8, 10, 12
  unreachable. Her wording was tentative; she should decide that knowingly.
- **New Q6**: her £89,257.14 illustration does not reconcile with her own grid
  (that income is in the 25% band; her arithmetic implies fees of £31,240, which
  is neither figure she quotes). The rule is clear, the example is not — build the
  rule.
- **Two new trivial items**, CH-50 and CH-51, on the School Annual Fees admin.
- She confirmed the Kaluba explanation, and apologised for a block that never
  happened — Lane 0 shipped without either answer.
- **Outside the sprint**: she is proposing a Grant Tracker call on data migration
  and integration, next week or the week of 7 Sept, and awaits Brian's
  availability.

## ✅ Tranche A complete on `staging` — 25 Aug

**Promotion is ON HOLD pending Q8**, not merely awaiting Brian. Proving CH-37
turned up an award-affecting question about which figure the savings test
deducts, and promoting a change to savings treatment with that open would be the
wrong order. See Q8 in the sprint doc and §4 row 2 of the implementation plan.

Everything else in the tranche is independently promotable if Brian would rather
split it: CH-38's bands and CH-39's categories are reference-data corrections she
supplied directly, and CH-37's change is display-only.

### The headline for her

**CH-37 was never a calculation fault.** `notional-spend.ts` already computed the
savings test and already added it back when positive, with both branches
unit-tested. The engine takes every input and computes once, so form ordering
could not affect the figure. What was missing was any way to *see* the debt input
at the point it is consumed — now surfaced in Part 3 directly above the test,
with the formula spelled out on the row.

Her suggestion to relocate the rows into Part 5 was **not** implemented: the
add-back is summed into Part 3's `TOTAL DEDUCTED NOTIONAL SPEND`, so moving it
would split that total across two parts. Flagged for her decision.

### Verified on the staging alias (assessment `R-9`, throwaway)

| Check | Result |
|---|---|
| Dependency order in Part 3 | ✅ adjusted savings → **derived yearly debt repayments** → savings test |
| Row notes render | ✅ *"Entered in PART 5. Shown here because the savings test below deducts it."* |
| Negative case | ✅ test −£3,000.00 → add-back £0.00 |
| **Positive case** | ✅ cash £60,000 → adjusted £8,571.43 → test **+£5,571.43** → add-back **£5,571.43**, exactly equal |
| **CH-38 live** | ✅ that household now labels **"decent savings"** — one of the relabelled bands (50k–75k was "fair savings") |
| CH-39 on nonprod | ✅ SQL confirms categories 1–11 with boundaries unchanged |
| CH-38 on nonprod | ✅ SQL confirms all 15 rows match her table |

`R-9` restored to `cash_savings = 0.00` afterwards. Charlotte's
`WS-202627-0008` was not touched.

### Test position

**2,204 passing / 163 files.** 20 existing tests had encoded the old values —
including one literally named *"preserves the CALC-A1 anomaly"* — and moved with
the spec, each annotated. New seed-data tests assert **monotonicity as an
invariant**, which is what her correction actually asked for and what stops the
`7,8,7,8` shape returning.

### ⚠️ Q8 — found while proving CH-37, award-affecting

Her savings test and the engine's are two different calculations:

| | Her description | Engine |
|---|---|---|
| Savings | £9,700 raw | £692.86 (÷ 2 children ÷ 7 years) |
| Debt | £8,000 raw | £1,142.86 (÷ 7 years) |
| Deduction | **£19,000** `SAVINGS_CUSHION` | **£6,000** `NOTIONAL_SAVINGS` |
| Result | −£17,300 | **−£6,450** |

Both negative, so her assessment is unaffected — but for a household with real
savings this decides whether anything is added back at all. An earlier note in
the plan estimated the benchmark at £7,142.86; that was wrong and has been
corrected.

### ⚠️ Note for the promotion

CH-39 shifts the income category for **any household above £90,000**. Prod holds
no assessments yet, so nothing is retro-changed — but if she has already noted a
category against a real family, it will read one higher.

## 🔴 Priority change — 25 Aug 18:27 UTC

**She has put the two real prod assessments on hold**, and CH-37/38/39 are now
the blocking set rather than Lane 1 "next". Her words (msg `1a03a2d7097c455e`):

> *"The savings test moving below the debt section, your corrected savings bands,
> the income categories running 1 to 11 — These things are important for the
> assessment to go well so I'd rather wait a bit (if you think that you will be
> able to work on these this early evening) as **the savings test number does
> change the calculation if positive**."*

Her reasoning is exactly right and is the reason this cannot be deferred: a
positive savings test adds back into available income (CH-37), so any household
with net savings above the cushion gets a **materially wrong award** until it is
in place. Running the real assessments first would produce numbers she would
then have to redo.

**Open question for Brian:** she is explicitly asking whether these can be done
this early evening. That is a commitment to make or decline, not a technical
call.

Meanwhile she **is** proceeding with one more assessment on the **test**
environment right now (msg `1a03a333d5e8892d`, 18:33), *"ignoring anything that
is still pending"* — so expect a further feedback batch tonight against nonprod,
not prod.

### Also from the same burst

- **CH-45 sharpened, still open.** She wrote *"Thanks for fixing that"* (18:29)
  then corrected herself two minutes later (18:31): *"I spoke too fast, the
  reordering is there on the applications page, not the assessments page. So that
  one is still open."* Nothing was shipped for CH-45 — she had compared the wrong
  page. The item stands, and its scope is now unambiguous: the **Assessments**
  page.
- She confirmed Q1/Q2 were already sent (*"I have sent you earlier the comments
  re this: that's done"*), which is the 17:54 email already decoded in #351.

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
