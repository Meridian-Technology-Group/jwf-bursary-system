---
title: "Epic 17 — assessment-model verification sprint (Charlotte feedback 23–24 Aug)"
status: open
severity: critical
area: assessment, calc-engine, admin ui, dashboard, invitations, email config
opened: 2026-08-25
opened_by: Brian Wagner (source: Charlotte Perrier, CH-32..49)
depends_on:
  - ../../client-feedback/2026-08-22-charlotte-feedback.md   # prior batch CH-26..31
  - ./epic-16-post-go-live-residue.md                        # CH-27 preview lives there, NOT here
related:
  - ./epic-15-go-live-sprint.md      # ground rules + D15 decisions carried forward
  - ./follow-ups.md
---

# Epic 17 — assessment-model verification sprint

Everything arising from Charlotte's 23 Aug evening batch and her 24 Aug
model-verification day, shaped around one hard fact: **she has verified the
v2 assessment model end-to-end against `WS-202627-0008` and it is almost
entirely correct** — Parts 1, 2, 5 and 6 signed off ("spot on 😊"), the
full-bursary outcome verified with and without a sibling. What is left is
two blockers, a cluster of calc corrections she specified precisely, and a
short list of additions.

**Her timeline:** the first real parent application was submitted on prod on
24 Aug ("this parent seems to have been able to complete the whole
application journey without any help"). Two more internal applications
arrived the same day. Her words: *"if the changes can be applied by you at
some point tomorrow, I should be able to use the live system to complete the
two real internal bursary applications … tomorrow evening."* **Tomorrow
evening = 25 Aug evening. The blockers must be on production today.**

She is also running a second test assessment with real data this morning
(25 Aug), comparing against the old system — expect a further feedback email;
it starts its own items, it does not reopen these.

## Numbering

Continues the CH- series from the 22 Aug batch (CH-26..31). This sprint is
**CH-32..49**. Source emails are cited by Gmail message ID (account
brian@meridiantech.group).

## Ground rules (unchanged from Epic 16, restated because they bite today)

- **Charlotte is on production.** A fix is not done on `staging`. The path is
  fix → validate → merge to `staging` → **promote `staging → main`** (Brian
  promotes). The blockers ride one promotion train today.
- Her model testing happens on **staging/nonprod** (`WS-202627-0008`,
  Kaluba); her real assessments happen on **prod**. Fixes must land in both,
  which the normal train does automatically.
- Never write a new enum value to prod before the code that knows it is
  deployed.
- Typecheck the way CI does: `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit`.
- Reference-data changes extend `seed-reference.ts` idempotently and ship
  with a migration where schema is touched — never demo-seed-only.
- v2 calc-engine changes carry Playwright-verified worked examples, as in
  the calc-model v2 cutover. Charlotte supplied worked examples for the
  savings test — use hers verbatim as test fixtures.

---

## Lane 0 — today's blockers (promotion train must leave in time for her evening)

### CH-35 · COMPLETE button unresponsive — assessment cannot be finished `blocker`

**Her words (24 Aug, msg `1a036115b3877a5f`):** *"it is not letting me click
on COMPLETE. The COMPLETE button is irresponsive, and the progress level
seems to be stuck on 'PAUSED' asking me to complete the assessment still. I
was able to save the 'recommendation' at the bottom of the part 6 … maybe
there is a loop that needs closing there."*

**Investigated 25 Aug (audit trail + DB):**

- The audit log shows **no `ASSESSMENT_COMPLETE` and no `ASSESSMENT_SAVE`
  after 22:10:15 UTC** on 24 Aug — only three `RECOMMENDATION_SAVE`s
  (22:59, 23:01, 23:04). The click never produced a server call, which
  matches a **disabled button**, not a failing action.
- The gate is `assessment-form-v2.tsx:992`:
  `!assessmentSchool || typeof entrySchoolYear !== "number" || annualFees <= 0`.
- But the persisted row **passes all three**: `assessment_school = WHITGIFT`,
  `entry_school_year = 7`, `annual_fees = 26175.00`, and the `school_fees`
  reference row exists (WHITGIFT, effective 2026-09-01, £26,175). So the
  **client-side state is diverging from the saved row** — likely the fee/
  school/year state not rehydrating on load, or being cleared by a render
  path the recommendation saves go through.
- A disabled button gives no click, no toast, no audit row — exactly
  "irresponsive". There is also **no tooltip/message when the gate is the
  reason**, which is its own defect: she was given no way to know why.

**Fix shape:** browser repro against her exact assessment on staging first
(`WS-202627-0008`, assessment `7c98ec69-…`); fix the state divergence; and
make the gate **explain itself** (disabled-with-reason, mirroring the
existing "Missing from reference data…" hint pattern at :1206). Regression
test: load a persisted, gate-passing assessment fresh and assert Complete is
enabled before any user input.

### CH-36 · Award summary must be VAT-aware — 6 replacement fields `blocker`

**Her words (24 Aug, same msg):** *"the fees are now inclusive of VAT, the
scholarship and the bursary award are understood before VAT. The payable
fees and the net disposable income need to be understood with VAT applied in
mind as this is something the parent needs to pay. … We basically will never
need to store the bursary award inclusive of VAT but we need these 6 fields
below instead."*

The six fields are specified in an inline screenshot (`image012.png`, msg
`1a036115b3877a5f`) — **decode before building** (WP0). Constraints already
clear from her prose:

- Fees: inclusive of VAT. Scholarship and bursary award: ex-VAT.
- Payable fees and net disposable income: displayed **with VAT applied**
  (what the parent actually pays).
- **Never store** a VAT-inclusive bursary award — display-layer derivation
  only. `vat_rate` (20.00) already exists on the assessment row.
- Everything upstream of the award summary is signed off — this is a
  summary-display change, not an engine change. Keep it that way if the
  decode allows; if a stored field is genuinely needed, it ships as an
  additive migration on the train.

---

## Lane 1 — calc/spec corrections (she specified these precisely; build to her words)

### CH-37 · Move the savings test below the debt section and enable it `M`

Currently `DISPLAY ONLY – SAVINGS TEST NUMBER` sits above the debt inputs it
depends on. **Her spec:** net savings = total savings − total debt; test =
net savings − notional savings cushion for the family category; **positive →
added back into yearly income total available; negative → nothing added.**

Her worked examples, to be used verbatim as test fixtures (family category 3,
cushion £19,000):

| Savings | Debt | Net | Test | Effect |
|---|---|---|---|---|
| £9,700 | £8,000 | £1,700 | −£17,300 | nothing added back |
| £39,700 | £8,000 | £31,700 | **+£12,700** | added back to income available |

Note the persisted row already computes `savings_test_number = -6450.00` for
her assessment — the calculation exists; the work is **placement** (below
debt, so the inputs exist when it runs) and **wiring the positive case into
the income total**. Verify whether the add-back is currently applied at all.

### CH-38 · Replace the savings/equity band table (14 rows supplied) `S`

She supplied the full floor/ceiling/label table verbatim (msg
`1a036115b3877a5f`): from `open-ended → −0.01 · in debt` and
`0 → 0 · no debt, no equity`, through `3,000–20,000 · within default cushion
savings`, up to `1,600,000 → open-ended · stratospheric savings – level 4`.
Reference-data swap: extend `seed-reference.ts` idempotently, apply to
nonprod + prod on the train. Transcribe from the email exactly — do not
retype from memory.

### CH-39 · Income category bands: monotonic 1→11 `S`

Her workbook's sequence `…7, 8, 7, 8` was **her slip** (confirmed 24 Aug,
msg `1a033733c3550e80`): *"it should show logically and incrementally from
category 1 to category 11."* We copied the workbook exactly, so the current
implementation reproduces the slip. Fix the bands to run 1–11
monotonically; her screenshot in that email carries the corrected bands —
decode in WP0 to get the exact boundaries.

### CH-40 · Debt-ratio bands: `<` logic confirmed — verify implementation `S`

She confirmed our non-overlapping reading and refined it: strictly-less-than
boundaries; **negative number = "zero debt, no credit risk"**; `0 ≤ x < 0.1`
= level 1. Verify the implementation matches (boundary values land on the
band below, negatives get the zero-debt label). Her improved status wordings
come later ("I will have a think") — labels stay as-is until then.

### CH-41 · Property category mis-derived — expected 5, derived 3 `M` — **partially blocked**

Her household should report **category 5**; the row holds
`property_category_derived = 3` (and `property_category = null`). She
concedes her single/double/multiple × value/equity matrix table *"is
confusing"* — Brian has asked (reply sent 25 Aug) for the rule **in plain
sentences** rather than reinterpreting the grid. **Blocked on her answer**
for the fix itself; unblocked now: write the failing test from her known
case (this household → 5) and trace which branch of the current derivation
returns 3, so the fix is a one-liner when her wording arrives.

### CH-42 · Lifestyle squeeze: show status only — and the ×100 unit bug `S`

She flagged `7631%` as odd and asked to keep only the status. **Root cause
found 25 Aug:** `lifestyle_squeeze_ratio` is stored already-in-percent
(`76.3071`) but rendered as `(ratio * 100).toFixed(0)` in **two** places —
`assessment-calc-strip-v2.tsx:239` and `recommendation-form-v2.tsx:259`. Her
instinct was right twice over: the ratio is correct AND the display is
nonsense. Fix: drop the `* 100` (or the stored unit — pick one convention
and grep for other consumers), and per her ask show **status only** in the
summary panel. The ratio itself she verified as correct.

---

## Lane 2 — additions to the assessment page

### CH-43 · Postcode field + postcode-area lookup `M`

Part 1 gets a manual postcode field (*"I need to fill it manually. I will
then link it to another table for the assessment"*). The summary panel then
shows outward code + area: assessor types `SM4`, summary reads
**`SM4-MORDEN`**. She attached the lookup table:
`POST CODE - POST CODE AREA.xlsx` (msg `1a036115b3877a5f`, 11.8 KB).

Shape: new reference table (postcode district → area), seeded idempotently
from the xlsx via `seed-reference.ts`; nullable `postcode` column on
assessments (additive migration); free-text entry with lookup-on-match —
**do not hard-validate against the table** (her table may not be
exhaustive; an unknown outward code should still save and display as
typed). She will "link it to another table for the assessment" later —
capture the value now, derive nothing from it yet.

### CH-44 · Add family category to the summary panel `S`

*"Could you add the family category as well?"* — the categories-in-one-place
panel she likes. `family_type_category` already on the row; display only.

### CH-45 · Assessments list: sortable Submitted column `S`

(23 Aug msg `1a03580afb67e923`, sent 24 Aug 20:40) — clicking the
**Submitted** column header re-orders chronologically. Toggle asc/desc.

### CH-46 · Remove the dashboard banners `S`

(msg `1a0357ecd2e12b6c`) *"Could you remove these banners as we don't use
that logic."* Which banners = `image001.png` in that email — decode in WP0
before deleting anything. Likely the watchlist/derived-rules tiles; confirm
against the screenshot, remove display only, leave the underlying audit
derivations alone.

### CH-47 · Winter-window tax year: switch now `S` — **pre-agreed, she confirmed**

From Brian's four-questions email, her answer (msg `1a033733c3550e80`):
*"Yes I need all forms right now to show the tax year 2025-26 and for the
comments re self-employed and reporting one year in arrears to refer to
2024-25 then."* The dynamic tax-year logic exists (Epic 02); this flips the
winter-window behaviour and the arrears wording. Applies to forms **right
now** — it rides the train.

### CH-48 · Route parent replies to fees@ on the test environment `S` `config`

Her *"Okay, let's do that"* to Brian's standing offer. Staging currently
sends no reply-to (#318 made the fees@ fallback prod-only — see CI-03).
Config/env change on the staging scope; tell Brian before touching env vars
per CLAUDE.md.

### CH-49 · Verify: do completed-assessment fields flow into Assessment Admin? `S` `question`

*"will the fields entered into the assessment get picked up and populated in
the relevant sections as soon as the assessment is marked as complete?"* —
Epic 15 built the history scaffold to fill "as assessments complete"
(CI-13). **Verify it actually populates on completion** (nonprod, complete a
throwaway assessment once CH-35 is fixed — this doubles as the CH-35
regression check), then answer her either way. If it doesn't populate, that
becomes a fix item on this sprint.

---

## Lane 3 — 23 Aug items (uncatalogued until now)

### CH-32 · BCC on the single-invite step `S` — **awaiting her choice, default is decided**

(msg `1a0304b960e8ccaa`) She looked for BCC on the individual invite; it only
exists on bulk email. Brian committed to add it (reply 23 Aug) and posed the
choice: **(1)** auto-copy fees@ on every invite, shown and clearable, or
**(2)** empty box each time. Brian's stated hunch is (1). **Build to (1)
unless her answer says otherwise**; the second question (no copy when using
"Don't email — I'll send the link myself") defaults to no-copy.

### CH-33 · Applicant progress view ("snooping button") `M` — **design with CH-34**

(msg `1a0304f46227ad31`) She needs to see, per applicant: sections complete,
last touched, ever-logged-in — for the *"parents claiming to have run out of
time"* case. Brian's reply gave her the interim (edit view — look, don't
save — plus History tab) and committed to building the real thing **jointly
with the Assessment Admin forward view**, one design, not two half-
overlapping screens.

### CH-34 · Assessment Admin forward view `M–L` — **blocked: her layout email not yet received**

She promised the layout email "tomorrow" (i.e. 24 Aug, msg
`1a03040069113318`); as of 25 Aug morning it has not arrived — her 24 Aug
went into model verification instead. **Do not design ahead of it.** When it
lands, CH-33 + CH-34 become one design pass.

---

## WP0 — prework (first commit of the sprint)

1. **Pull and commit source materials** to
   `source-materials/screenshots-2026-08-23-24/`: the 17 inline images from
   msg `1a036115b3877a5f` (esp. `image012` = the six VAT fields, CH-36),
   `image001` from `1a0357ecd2e12b6c` (which banners, CH-46), the corrected
   income-band screenshot from `1a033733c3550e80` (CH-39), and
   `POST CODE - POST CODE AREA.xlsx` (CH-43).
2. Decode each into the item it feeds; anything that contradicts this doc's
   reading of her prose **wins over this doc** — update the item.
3. Open `epic-17-progress.md` as the live board (Epic 14/15 pattern).

## Open with Charlotte (tracked, not blocking the train)

| # | Question | Blocks |
|---|---|---|
| Q1 | Property matrix in plain sentences (asked 25 Aug) | CH-41 fix |
| Q2 | Affordability grid outside £27k–£105k (her #3: "will check later") | nothing — current clamp behaviour stands |
| Q3 | Debt-status label rewordings (hers to draft; September per her Part 5 note) | nothing |
| Q4 | BCC option 1 vs 2 (asked 23 Aug) | CH-32 default = option 1 |
| Q5 | Assessment Admin layout email (promised, not yet sent) | CH-34, and the joint design for CH-33 |

## Suggested order

1. **WP0** — decode `image012` before anything; CH-36 cannot be built
   without it.
2. **Lane 0** (CH-35, CH-36) → one PR each or one train PR → staging →
   validate on her actual staging assessment → **promote to prod before her
   evening**. CH-47 and CH-42's ×100 fix are small and ride the same train.
3. **Lane 1** remainder (CH-37, CH-38, CH-39, CH-40; CH-41 test-first while
   blocked) — these are what her *second* real-data comparison will exercise;
   the sooner they land, the fewer false discrepancies she reports.
4. **Lane 2** (CH-43, CH-44, CH-45, CH-46, CH-48, CH-49).
5. **Lane 3** as answers land (CH-32 buildable now on the default).

## Out of scope

- **CH-27** (invitation preview + per-send edit) — stays in Epic 16 Lane A.
  Do not let CH-32's invite-step work drag it in.
- Epic 16 Lanes B/C (Epic 13 residue, human checks) — unchanged, unblocked,
  lower priority than this sprint this week.
- Her improved debt-status wordings and the affordability-grid answer —
  hers; incorporate when supplied.
- Whatever this morning's second real-data test surfaces — new items,
  catalogued on arrival, not scope-crept into these.
- The Kaluba/Laguza confusion — **resolved, no build**: it was Brian's 10 Jul
  v2 verification run on nonprod (audit-trail-proven, prod clean, she had
  already correctly reopened it; explanation email sent 25 Aug).
