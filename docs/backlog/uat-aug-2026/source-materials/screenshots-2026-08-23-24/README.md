# Charlotte's screenshots — 23–24 Aug 2026 (Epic 17)

Decoded source materials for [`epic-17-assessment-verification-sprint.md`](../../epic-17-assessment-verification-sprint.md).
Gmail account `brian@meridiantech.group`; message IDs cited per file.

## Committed so far (WP0, Lane 0 subset)

| File | Source | Feeds | What it settles |
|---|---|---|---|
| `ch36-award-summary-six-fields.png` | `1a036115b3877a5f` / `image012.png` | **CH-36** | Her six award-summary fields with the arithmetic written out beside them. **Settles D8 and overturns `ASSUMPTION(CALC-A5)`** — see below. |
| `ch35-header-lifecycle-strip.png` | `1a036115b3877a5f` / `image013.png` | **CH-35** | The header she clicked: `NOT STARTED · PAUSED · COMPLETE · LOCKED` drawn as four bordered, filled chips — i.e. as four buttons. This is the "irresponsive COMPLETE button". |
| `ch35-award-tab-dead-end.png` | `1a036115b3877a5f` / `image015.png` | **CH-35** | The award tab's `Complete the assessment to record the outcome.` — an instruction with no control anywhere on the tab. |

## Our verification captures

| File | What it shows |
|---|---|
| `ch36-award-summary-verified-staging.png` | The shipped CH-36 summary on the staging alias, driven against Charlotte's own assessment `WS-202627-0008`: fees £26,175 at 10% with a £12,000 before-VAT bursary → scholarship spend £2,617.50, net £11,557.50, payable **£13,869.00** incl. VAT. Her six labels, her order. The figures were typed but never saved, so her assessment was left untouched. |

## CH-36 — what the screenshot actually says

Her labels and arithmetic, transcribed verbatim:

| # | Field | Kind | Rule |
|---|---|---|---|
| 1 | Fees for next year (or applicable year) — before VAT | `auto fill 1` | school-fees reference |
| 2 | Scholarship Award (%) | `manual fill 1` | assessor |
| 3 | Scholarship Spend — before VAT | `auto fill 4` | `autofill1 × manual1` |
| 4 | Bursary Award / Spend — before VAT | `manual fill 2` | assessor |
| 5 | Net fees (or applicable year) — before VAT | `auto fill 2` | `autofill1 − (autofill1 × manual1) − manual2` |
| 6 | Yearly Payable fees — including VAT | `auto fill 3` | `autofill2 × 1.20` |

**The correction this forces.** Everything is computed **before VAT**, and VAT
is applied **exactly once, at the end**, to the payable line — because that is
the only figure the parent actually pays. Two consequences:

- The **bursary award is entered before VAT**, not after. The engine previously
  took it as an after-VAT figure and divided back out (`bursaryAwardAfterVat ÷
  1.2`) to derive the school's spend. Under her model the entered figure *is*
  the before-VAT spend, so no division exists.
- The **scholarship spend carries no VAT**. The engine previously grossed it up
  (`fees × pct × 1.2`).

That is `ASSUMPTION(CALC-A5)` overturned. Her prose in the same email —
*"the fees are now inclusive of VAT"* — refers to what the **parent pays**, not
to the reference data: the fee table stays pre-VAT, exactly as its admin panel
already says in her own screenshot. Reading that sentence without the
screenshot would have produced the wrong model, which is why WP0 gates CH-36.

Also visible in the same image, incidentally confirming the fee reference is
correct: Trinity £25,390.00 / Whitgift £26,175.00 for 2026-27, and £24,366.67 /
£25,200.00 for 2025-26.

## 25 Aug follow-up (msg `1a03a0ef60dcb5b9`, 17:54 UTC) — Q1 + Q2 answered

| File | Feeds | What it settles |
|---|---|---|
| `ch41-property-option-and-total-value.png` | **CH-41** | The two inputs to match: the existing 4-option `Property asset structure` dropdown, and **`DISPLAY ONLY — HOUSEHOLD'S TOTAL PROPERTY VALUE`** (£450,000 in her case). Her annotation: *"the sum of the values entered into the **market value** fields"*. |
| `ch41-property-benchmark-table2.png` | **CH-41** | Her scoping-document Table 2 in full — Single / Double / Multiple portfolio blocks, each row a value band × an equity condition → a category. |
| `ch52-affordability-lower-band.png` | **CH-52** | The bottom band as it stands: `27001 → 29000 @ 0%`. |
| `ch52-affordability-upper-bands.png` | **CH-52** | The top three bands: `98001–100000 @ 35%`, `100001–103000 @ 40%`, `103001–105000 @ 45%`. |
| `ch50-51-school-fees-admin.png` | **CH-50/51** | The School Annual Fees admin table she wants relabelled and extended. |

### CH-41 — the screenshot corrects her prose, twice

Her email says *"the assessor enters the **equity** value of these properties"*. The
screenshot says the matched figure is the **total market value** — she boxed the
three `MARKET VALUE` rows and the `HOUSEHOLD'S TOTAL PROPERTY VALUE` total, not
the mortgage-balance rows. The screenshot wins (WP0 rule), and it is
self-consistent with her footnote: the mortgage/equity dimension is handled by
the *separate* property equity category, so the property category keys off gross
value.

**And this is a spec change, not the bug we called it.** Her household carries a
**£179,000 mortgage on the £450,000 home** (`assessment_properties`:
`is_mortgage_free: false`). Under Table 2 as written, Single Property × £360K–£500K
× *with mortgage* → category **3** — exactly what the engine returns. Her expected
**5** is the `if C103 = C96` row, i.e. owned outright. So the engine is faithful to
her table; what she is actually asking for is the footnote:

> *"since we have now a property equity category, you may want to ignore all the
> rows referring to 'with mortgage' and only keep in the table the rows starting
> with 'if'."*

Dropping the with-mortgage rows gives, for Single Property:

| Total property value | Category |
|---|---|
| under £360K | 4 |
| £360K – £500K | **5** ← her case |
| £500K – £800K | 7 |
| £800K – £1.2m | 9 |
| over £1.2m | 11 |

Double and Multiple portfolios follow the same shape with two extra bands
(£1.2m–£1.6m → 11, over £1.6m → 13). Renting → 1.

⚠️ **Consequence to put to her before building:** with the with-mortgage rows
gone, categories **2, 3, 6, 8, 10 and 12 become unreachable** — the property
category could only ever return 1, 4, 5, 7, 9, 11 or 13. Her wording is
tentative (*"you may want to"*), so this is a decision, not an instruction.

### CH-52 — the affordability cap, and an example that does not reconcile

Two halves:

- **Lower end.** She confirms 0% should apply from **£0 to £29,000**. The system
  already behaves that way (a 0% clamp below the table's floor, plus the
  `27001–29000 @ 0%` row), so this is a no-op behaviourally — worth dropping the
  first band's floor to `0` so the table documents itself instead of relying on
  the clamp.
- **Upper end.** Not "hold the top percentage" as we implemented, but
  **capped at the full VAT-inclusive school fees for the school in question**.
  That is a real engine change: the affordability leg becomes
  `min(pct × income, feesInclVat)`.

**Her worked example does not survive her own grid**, and should be queried
rather than built to. She says a Whitgift family stops qualifying at
**£89,257.14**. Against the seeded bands:

- £89,257.14 falls in `88001–90000`, which is **25%** → £22,314, nowhere near the fees.
- Her figure implies `fees ÷ 0.35 = 89,257.14`, i.e. fees of **£31,240** — which is
  neither £31,410 (Whitgift 2026-27 incl. VAT) nor £30,240 (2025-26 incl. VAT),
  the two figures she quotes in the same paragraph.
- Even taking £31,410 ÷ 0.35 = £89,742.86, that income sits in the **25%** band, so
  35% cannot apply there.

Working her grid properly, a Whitgift 2026-27 family stops qualifying at
**£98,001** — the first income in the 35% band, where £34,300 first exceeds
£31,410. The *principle* is unambiguous and buildable; only the illustration is
off.

## A3 / CH-39 decode — resolved without the image

`1a033733c3550e80` / `image001.png` sits directly under her sentence *"This is my
mistake, it should show logically and incrementally from category 1 to category
11"*. It is the **current** (slipped) table she is annotating — a before picture,
not a corrected one. The target is nevertheless fully determined, because the
seeded table has exactly **11 bands** and she wants categories **1–11**:

| Band | Current category | Target |
|---|---|---|
| ≤ £27,000 | 1 | 1 |
| £27,000–£40,000 | 2 | 2 |
| £40,000–£50,000 | 3 | 3 |
| £50,000–£60,000 | 4 | 4 |
| £60,000–£70,000 | 5 | 5 |
| £70,000–£80,000 | 6 | 6 |
| £80,000–£90,000 | 7 | 7 |
| £90,000–£100,000 | **7** | **8** |
| £100,000–£110,000 | **8** | **9** |
| £110,000–£120,000 | **7** | **10** |
| over £120,000 | **8** | **11** |

Boundaries are unchanged — she never questioned them — and `fees_benchmark_pct`
is untouched: her complaint was purely the category numbering. The `7,8,7,8`
tail is exactly the slip Brian asked about.

## Still to pull

The remaining 14 inline images from `1a036115b3877a5f`, plus:

| Source | Feeds | Wanted for |
|---|---|---|
| `1a0357ecd2e12b6c` / `image001.png` | CH-46 | **Which** dashboard banners to remove — do not delete anything before decoding this |
| `1a033733c3550e80` / `image001.png` | CH-39 | Her corrected income-category bands 1→11 |
| `1a033733c3550e80` / `image002.png` | CH-40 | Her debt-ratio band boundaries |
| `1a036115b3877a5f` / `image005`, `image007` | CH-41 | The property single/double/multiple × value/equity matrix — she concedes it *"is confusing"*, and Brian has asked for it in plain sentences instead; keep these for cross-checking her answer |
| `1a036115b3877a5f` / `image011` | CH-42, CH-44 | The summary panel showing `7631%` and where the family category should sit |
| `POST CODE - POST CODE AREA.xlsx` | CH-43 | The district → area lookup (`SM4` → `SM4-MORDEN`) |
