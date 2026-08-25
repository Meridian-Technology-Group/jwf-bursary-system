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
