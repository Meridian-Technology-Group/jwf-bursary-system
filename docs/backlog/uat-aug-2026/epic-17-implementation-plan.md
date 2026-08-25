---
title: "Epic 17 — implementation plan (autonomous execution)"
status: open
severity: critical
area: assessment, calc-engine, reference data, admin ui, dashboard, email config
opened: 2026-08-25
opened_by: Brian Wagner
depends_on:
  - ./epic-17-assessment-verification-sprint.md   # item map, CH-32..52
  - ./epic-17-progress.md                          # live board
  - ./source-materials/screenshots-2026-08-23-24/README.md   # decodes; screenshots WIN over prose
---

# Epic 17 — implementation plan

Executable directly from Claude Code. Each work package is self-contained:
read §0–§4, then the brief, then the files it names.

> **Authority for this run.** Open a PR per WP against `staging`; when CI is
> green, **squash-merge it**. Never open or merge `staging → main` — promotion
> is Brian's, named explicitly, per `CLAUDE.md` rule 6. Charlotte is on
> production, so every tranche ends with a promotion *recommendation*, not a
> promotion.

---

## 0. Cold-start bootstrap (read first, every session)

```bash
export PATH="$HOME/.local/share/nvm/v22.12.0/bin:$PATH"   # vitest fails to load its config without this
git checkout staging && git pull --ff-only
```

- Item map: [`epic-17-assessment-verification-sprint.md`](epic-17-assessment-verification-sprint.md).
  Live board: [`epic-17-progress.md`](epic-17-progress.md). Update the board row
  as each WP merges.
- **Screenshots override prose.** Established twice already this sprint (CH-36's
  VAT direction, CH-41's market-value-vs-equity). Decode before building.
- Nonprod test admin: `brian.admin@jwf-bursary.test` / `JWF-Admin-Test-2026!`
  (reset via the `/add-admin` skill). Staging alias:
  `jwf-bursary-system-git-staging-meridian-tech-group.vercel.app`.
- Typecheck the way CI does: `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit`.
  `prisma format --check` is a CI gate no local command runs by default.

### Data you must not break

| Record | Rule |
|---|---|
| `WS-202627-0008` (Kaluba, assessment `7c98ec69-…`) | **Charlotte's own test assessment.** Read freely; verify arithmetic by typing without saving (the recommendation form has no autosave). **Never save.** |
| Any real family on nonprod (from 21 Aug) | Never touch. Real applicant data lives here. |
| `R-9` (`7558900d-…`, assessment `1a27e962-…`) | Brian's throwaway, v2, school+year+fees set. Use this for state-changing E2E. Restore what you change. |
| `audit_logs` | Append-only; DELETE is denied even under service_role. Cleanups must skip it. |

---

## 1. Exit criteria

1. Charlotte can run a real assessment end-to-end on production and trust every
   figure in Parts 1–6 — with the savings test reading in the order she expects,
   her corrected savings bands, and income categories running 1→11.
2. Every CH-32..52 item is either **merged**, **explicitly deferred with a
   reason**, or **blocked on a named question to her**. No silent omissions.
3. The reference data on nonprod *and* prod matches her supplied tables exactly
   (savings bands, income bands, affordability floor).
4. Anything her spec left ambiguous is answered in writing, not guessed.

---

## 2. Ground rules (deltas on Epic 15 §2 / Epic 16)

- **Charlotte is on production.** A merge to `staging` is not done. Each tranche
  ends with a promotion recommendation for Brian, with the evidence attached.
- **Re-check prod row counts before every migration.** Prod held 0 recommendations
  and 0 assessments at 18:20 UTC on 25 Aug. She is assessing for real imminently,
  so that will change — a change that was safe this afternoon may not be tomorrow.
- **v2 engine changes carry Playwright-verified worked examples**, using her
  figures where she has supplied them.
- Reference-data changes extend `seed-reference.ts` **idempotently** and ship the
  migration in the same PR. Never demo-seed-only.
- New tables need RLS policies in the same PR (`ensure_rls` force-enables RLS on
  every new public table; a policy-less table reads empty app-wide).

---

## 3. Locked assumptions (LA17-*)

| # | Assumption |
|---|---|
| LA17-1 | **CH-37 is display-ordering only.** The engine already computes the savings test and already adds it back when positive — see §4 row 1. Do not "fix" the calculation. |
| LA17-2 | The affordability cap (CH-52) reads the VAT-inclusive payable figure from the **same** derivation CH-36 introduced. One helper, two callers — never re-gross the fee independently. |
| LA17-3 | CH-41's matched £ figure is **total property market value**, not equity. Screenshot beats prose; the mortgage dimension belongs to the separate property equity category. |
| LA17-4 | CH-52's rule is built; her £89,257.14 illustration is **not** calibrated to (Q6). |
| LA17-5 | Reference data is the seam for band changes (CH-38, CH-39, CH-52-floor). Prefer a reference row over a code constant every time. |

---

## 4. Ground truth (verified 25 Aug — re-verify before relying)

1. **The savings-test add-back already works.** `notional-spend.ts:169-176`
   computes `savingsTestNumber = adjustedSavings − derivedYearlyDebtRepayments −
   notionalSavingsBenchmark`, then `addBack('savingsTestAddBack', …,
   Math.max(0, savingsTestNumber))`, which is in `lines`, summed into
   `totalNotionalSpend`, and folded into `ndiAfterNotionalSpend`. Covered by
   `notional-spend.test.ts:303-305` (positive case `4_800` → `+4_800`) and
   `:286-287` (negative → `0`). **The engine is not a spreadsheet — it takes all
   inputs and computes once, so "a value entered further down the model" is a
   reading-order problem, not a calculation one.**
2. ⚠️ **Her savings test and the engine's are two different calculations.**
   Verified against her Kaluba assessment (`7c98ec69-…`) and
   `notional_cost_configs`, 25 Aug. An **earlier note in this plan estimated the
   benchmark at ≈£7,142.86 — that was wrong**; the real figures are below.

   | | Her description | Engine |
   |---|---|---|
   | Savings | £9,700 raw | **£692.86** (`9,700 ÷ 2 children ÷ 7 school years`) |
   | Debt | £8,000 raw | **£1,142.86** (`8,000 ÷ 7 years`) |
   | Deduction | **£19,000** — `SAVINGS_CUSHION` (cat 3) | **£6,000** — `NOTIONAL_SAVINGS` (cat 3) |
   | Result | −£17,300 | **−£6,450** |

   Two divergences, not one: the engine works on **yearly** figures rather than
   totals, **and it deducts a different reference value**. Both figures exist in
   `notional_cost_configs` for category 3 — and the £19,000 she expects is
   rendered on her form two rows above the test, labelled *"Reference value only
   — feeds no calculation"* (`assessment-form-v2.tsx:1452-1456`).

   Both results are negative, so her assessment is unaffected and nothing she has
   reviewed is wrong because of it. But for a household with real savings this
   decides whether **anything is added back at all**, so it is a live
   award-affecting question.

   Note her own remark *"The adjusted saving is calculated correctly"* endorses
   the annualisation of savings — which points toward annualising the £19,000
   rather than using it raw, if the cushion is the intended deduction.

   **This is Q8. Ask; do not reconcile by changing code** — and per §2, do not
   promote a change to savings treatment while it is open.
3. Property: her household is `is_mortgage_free: false`, `mortgageBalance
   179,000`, `value 450,000`, `portfolioType SINGLE` → Table 2 as written yields
   **3**, which is what the engine returns. Her expected **5** requires dropping
   the with-mortgage rows (Q7).
4. Affordability bands seeded: 31 rows, `27001–29000 @ 0%` … `103001–105000 @
   45%`. Below the floor the code clamps to 0%, so **£0–£29,000 → 0% already
   holds**. Above £105,000 the top percentage is held — that is what CH-52 changes.
5. Prod at 18:20 UTC 25 Aug: **0 assessments, 0 recommendations**, 84/84
   migrations, deploy `dpl_ESztQQ…` READY, zero runtime errors.
6. CH-45: the sortable column exists on **Applications**, not **Assessments**
   (she confirmed 25 Aug 18:31). Nothing has shipped for it.

---

## 5. Tranches

Ordered by what unblocks her, then by dependency. **Tranche A is what she is
waiting on tonight.**

| Tranche | WPs | Why this order |
|---|---|---|
| **W0** | Finish the WP0 decode | Gates A3, C4, C1 — do not build those blind |
| **A** *(her blocker)* | A1 CH-37 · A2 CH-38 · A3 CH-39 | She has paused the real prod assessments for exactly these three |
| **B** | B1 CH-40 · B2 CH-52 · B3 CH-41 *(Q7)* | Calc completion; B3 gated |
| **C** | C1 CH-46 · C2 CH-44 · C3 CH-45 · C4 CH-43 · C5 CH-50/51 · C6 CH-47 · C7 CH-48 · C8 CH-49 | Additions; independent of each other |
| **D** | D1 CH-32 · D2 CH-33/34 *(Q5)* | Lane 3; D2 blocked on her layout email |

---

## 6. Work-package briefs

---

### W0 · Finish the screenshot decode · S · `docs/e17-w0-decode`

**Requirement.** Three items are unbuildable without their images, and one of
them (CH-46) is destructive if guessed.

**Steps.**
1. Pull and commit to `source-materials/screenshots-2026-08-23-24/`:
   - `1a033733c3550e80` / `image001.png` → **CH-39** corrected income bands 1→11
   - `1a033733c3550e80` / `image002.png` → **CH-40** debt-ratio band boundaries
   - `1a0357ecd2e12b6c` / `image001.png` → **CH-46** which dashboard banners
   - `1a036115b3877a5f` / `POST CODE - POST CODE AREA.xlsx` → **CH-43** lookup
   - remaining `1a036115b3877a5f` images for completeness
2. Extend the source-materials README with a decode row per image, in the
   established table format.
3. If any decode contradicts the sprint doc, **amend the sprint doc in this PR**
   and say so in the body. That has happened twice; expect it.

**Validation.** No code. PR body must state, per item, what the image settled.

---

### A1 · CH-37 · Savings test below the debt section · S · `fix/e17-a1-savings-test-order`

**Requirement.** Charlotte: *"the formula is linking a value which is to be
entered further down the model… so maybe we should move this part to the debt
section."*

**This is a display-ordering change only** (LA17-1, §4 row 1). The calculation
and the positive add-back already work and are tested. Do not touch
`notional-spend.ts`.

**Steps.**
1. In `assessment-form-v2.tsx`, move the `DISPLAY ONLY - SAVINGS TEST NUMBER`
   row (currently ~`:1457`) to sit **after** the debt inputs it reads, so the
   form reads in dependency order. Keep the workbook label verbatim.
2. Check the surrounding Part 3 rows still read coherently after the move — the
   notional-savings-benchmark line and the add-back line belong beside it.
3. Add a test asserting the **rendered order** of those Part 3 rows if one can be
   written without RTL (this repo has no jsdom — extract an ordered row
   descriptor if that is what it takes; otherwise say why in the PR body).
4. **Write to her, in the PR body's "For Brian" section**: the calculation was
   never at risk, and her worked examples use different units from the engine
   (§4 row 2 → **Q8**).

**Validation.** Playwright against `R-9` on nonprod: enter savings and debt such
that the test goes **positive**, and screenshot (a) the row now below the debt
section, (b) the add-back appearing in the notional-spend total, (c) NDI moving
by exactly that amount. Then a negative case showing no add-back.

---

### A2 · CH-38 · Savings / equity band table · S · `fix/e17-a2-savings-bands`

**Requirement.** Her 14-row floor/ceiling/label table, verbatim, from
`open-ended → −0.01 · "in debt"` through `1,600,000 → open-ended ·
"stratospheric savings - level 4"`. Full list in the sprint doc.

**Steps.**
1. Transcribe **from the email**, not from memory or from this plan. Cross-check
   every boundary and every label string character-for-character.
2. Additive migration + idempotent `seed-reference.ts` upsert. Replace the first
   seven levels as she specified; keep the table a single source of truth.
3. Confirm the open-ended ends are representable (nullable floor/ceiling or
   sentinel — follow whatever the existing band tables do).
4. Tests: one per boundary, plus both open-ended ends, plus a value exactly on a
   boundary (her `<` convention from CH-40 applies here too — confirm in the PR
   body which side a boundary falls).

**Validation.** Post-merge, confirm the migration on nonprod via MCP
`list_migrations` and spot-check three bands by SQL. Screenshot the label
rendering for one household in each of three different bands.

---

### A3 · CH-39 · Income categories 1→11 · S · `fix/e17-a3-income-bands` · **needs W0**

**Requirement.** Her workbook's `…7, 8, 7, 8` sequence was her own slip:
*"it should show logically and incrementally from category 1 to category 11."*
We reproduced the slip faithfully, so the fix is to the reference bands.

**Steps.**
1. Decode `1a033733c3550e80/image001.png` for the exact corrected boundaries
   (W0). Do not infer them — the whole point is that the sequence was wrong once
   already.
2. Additive migration + idempotent seed upsert.
3. Assert **monotonicity as a test**: iterate the seeded bands and assert the
   category increases by exactly 1 and never decreases. That is the invariant her
   correction is really asking for, and it would have caught the original slip.
4. Re-derive her assessment's `income_category` (currently 7) and record the
   before/after in the PR body.

**Validation.** SQL spot-check of the seeded bands; Playwright screenshot of the
category on `R-9` for two incomes either side of a boundary.

---

### B1 · CH-40 · Debt-ratio bands · S · `fix/e17-b1-debt-bands` · **needs W0**

**Requirement.** She confirmed the non-overlapping `<` reading, and refined it:
negatives are *"zero debt, no credit risk"*; `0 ≤ x < 0.1` is level 1.

**Steps.**
1. Decode `image002.png` (W0) for the boundaries.
2. **Verify before changing.** This may already be correct — read
   `profiling.ts`'s debt-band resolution and test the boundaries first. If it is
   right, the WP is a test-only PR that pins the convention. Say so plainly.
3. Tests: exact-boundary values, a negative ratio, and `0`.
4. Her improved status wordings are **hers to draft** (Q3) — labels unchanged.

---

### B2 · CH-52 · Affordability cap · M · `feature/e17-b2-affordability-cap`

**Requirement.** Two halves, per §4 row 4:
- **Lower:** 0% from £0. Behaviourally a no-op — change the first band's floor to
  `0` so the table documents itself instead of relying on the code clamp. Assert
  the clamp and the row now agree.
- **Upper:** replace "hold the top percentage" with **capped at the full
  VAT-inclusive fees for the school in question**: `min(pct × income,
  feesInclVat)`.

**Steps.**
1. Derive `feesInclVat` from the **same** helper CH-36 uses (LA17-2). Extract one
   if the VAT gross-up is currently inline — CH-51 needs the identical figure, so
   this pays for itself twice.
2. Apply the cap in the affordability leg. Confirm which of the three award legs
   this is and that the min-of-three still behaves.
3. Tests: below the floor; on each boundary; above £105,000 uncapped-vs-capped;
   a case where the cap binds and one where it does not; and the crossing point —
   for Whitgift 2026-27, £98,001 is where £34,300 first exceeds £31,410.
4. **Do not calibrate to £89,257.14** (LA17-4, Q6).

**Validation.** Playwright on `R-9` at three incomes: mid-grid, just above
£105,000, and far above. Screenshot the affordability leg and the resulting
recommended payable fees each time.

---

### B3 · CH-41 · Property category · M · `fix/e17-b3-property-category` · **BLOCKED on Q7**

**Requirement + full mapping**: sprint doc CH-41. Match the existing 4-option
`Property asset structure` dropdown against **total property market value**
(LA17-3).

**Do not start until Q7 is answered.** Dropping the with-mortgage rows makes
categories 2, 3, 6, 8, 10, 12 unreachable, and her wording was *"you may want
to"*. Building it on a guess would bake a scale change into her live model.

**Unblocked prep, safe to do now:** write the failing test from her known case
(SINGLE, £450,000 → expected 5, currently 3) and trace which branch returns 3, so
the fix is a one-liner when she confirms.

---

### C1 · CH-46 · Remove the dashboard banners · S · `fix/e17-c1-dashboard-banners` · **needs W0**

**Requirement.** *"Could you remove these banners as we don't use that logic."*

⚠️ **Destructive if guessed.** Decode `1a0357ecd2e12b6c/image001.png` first and
name the exact components in the PR body. Remove the **display only** — leave the
underlying audit-derived rules intact (the Round Cockpit watchlist derives from
`AuditLog`; deleting the derivation would silently break rules 4–7).

---

### C2 · CH-44 · Family category on the summary panel · S · `feature/e17-c2-family-category`

Add `family_type_category` to the categories panel in `recommendation-form-v2.tsx`
(the `items` array, beside the CH-42 row). Needs plumbing through
`V2AssessmentSnapshot` + `recommendation-surface.tsx` — the field is on the
assessment row but not currently in the snapshot. Display only.

---

### C3 · CH-45 · Sortable Submitted column · S · `feature/e17-c3-assessments-sort`

**Scope is the Assessments page**, not Applications — she confirmed the sort
already exists on the latter (§4 row 6). Toggle asc/desc on the header. Reuse the
Applications-page sort pattern rather than inventing a second one.

---

### C4 · CH-43 · Postcode + area lookup · M · `feature/e17-c4-postcode` · **needs W0**

**Requirement.** Manual postcode field in Part 1; summary shows outward code +
area (`SM4` → `SM4-MORDEN`), from her attached xlsx.

**Steps.**
1. New reference table (district → area) + **RLS policies in the same PR**.
   Seeded idempotently from the xlsx via `seed-reference.ts`.
2. Nullable `postcode` column on assessments (additive).
3. Free-text entry, lookup-on-match. **Do not hard-validate** against the table —
   her list may not be exhaustive, and an unknown outward code must still save
   and display as typed.
4. Derive nothing from it yet; she will *"link it to another table"* later.

---

### C5 · CH-50 / CH-51 · School fees admin · S · `feature/e17-c5-fees-admin-vat`

Header gains `(excluding VAT)`; a new derived column shows `annual_fees × 1.2`.
**Use the same helper as B2** (LA17-2) so the cap and the column cannot disagree.
No new storage.

---

### C6 · CH-47 · Winter-window tax year · S · `fix/e17-c6-winter-tax-year`

Her confirmation: forms show **2025-26** now, with self-employed / one-year-in-
arrears wording referring to **2024-25**. The dynamic tax-year logic exists from
Epic 02 — this flips the winter-window branch and the arrears copy. Test both
window states.

---

### C7 · CH-48 · Reply-to `fees@` on staging · S · `chore/e17-c7-staging-reply-to`

Config only. Staging currently sends no reply-to (#318 made the fallback
prod-only). **Tell Brian before touching env vars** — `CLAUDE.md` does not
pre-authorise `vercel env` changes.

---

### C8 · CH-49 · Verify admin flow-through · S · `docs/e17-c8-admin-flowthrough`

Her question: do assessment fields populate the Assessment Admin sections on
completion? Epic 15 built the scaffold to fill *"as assessments complete"*
(CI-13) — **verify, don't assume.** Complete a throwaway assessment on `R-9` and
screenshot the admin tab before/after. If it does not populate, this becomes a
fix WP and the sprint gains an item.

---

### D1 · CH-32 · BCC on the single invite · S · `feature/e17-d1-invite-bcc`

Build **option 1** — auto-copy `fees@` on every invite, address shown and
clearable — per Brian's stated hunch, unless Q4 lands first. The "don't email"
path defaults to no copy.

### D2 · CH-33 / CH-34 · **BLOCKED on Q5** — her Assessment Admin layout email,
promised 23 Aug, still not sent. Design the applicant-progress view and the
forward view **together** when it arrives; Brian committed to one design, not two
half-overlapping screens.

---

## 7. Validation & evidence standards (every WP)

1. **Local gates before any PR:** `npx prisma validate` · `npx prisma format
   --check` · `npm run lint` · `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` ·
   `npx vitest run` · `npx next build` for anything touching a route.
2. **Behavioural change → a test beside the code.** If a meaningful test is
   genuinely impossible (no jsdom/RTL here), say why in the PR body and pin the
   logic by extracting it — as `lifecycleChipClass` was for CH-35.
3. **Browser verification for anything user-visible**, via Playwright MCP against
   nonprod. Screenshot every acceptance state the brief names. Throwaway data
   only; never save into `WS-202627-0008`.
4. **Migrations:** additive; RLS for new tables in the same PR; post-merge confirm
   on nonprod (`db-push.yml` green + `list_migrations`).
5. **Reference-data changes:** verify by SQL after merge, on nonprod, and state in
   the PR body that prod still needs the same seed applied at promotion.
6. **CI is the authority** while schema PRs are in flight (worktree Prisma-client
   hazard).

---

## 8. Execution loop (the automation contract)

Per WP, in order:

1. `git checkout staging && git pull --ff-only && git checkout -b <branch>`
2. Implement. Tests alongside.
3. Run every §7.1 gate locally. Do not push red.
4. Browser-verify per the brief; capture screenshots.
5. Push; open PR against `staging` with: requirement, her words, what changed,
   evidence, and a **For Brian** section for anything needing him.
6. **Wait for CI.** If green → `gh pr merge <n> --squash --delete-branch`.
   If red → fix on the same branch; never merge red, never `--no-verify`.
7. If the PR carries a migration, confirm `db-push.yml` succeeded on `staging`
   and the migration is recorded on nonprod before starting the next WP.
8. Update the `epic-17-progress.md` row.
9. **Never** open or merge `staging → main`. At the end of each tranche, post a
   promotion recommendation with the evidence and stop.

**Stop and ask** rather than guessing when: a decode contradicts the spec; a
change would alter a figure she has already signed off; a WP needs an env var; or
a blocked question (Q5, Q7) is the only thing in the way.

---

## 9. Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| Q3 | Debt-status label rewordings | nothing | Charlotte (September) |
| Q4 | BCC option 1 vs 2 | D1 default = 1 | Charlotte |
| Q5 | Assessment Admin layout email | **D2** | Charlotte |
| Q6 | £89,257.14 does not reconcile with her own grid | nothing — build the rule | Charlotte |
| Q7 | Dropping with-mortgage rows makes 6 categories unreachable | **B3** | Charlotte |
| **Q8** | **Savings test — which deduction, and raw or yearly?** The engine deducts `NOTIONAL_SAVINGS` **£6,000** from annualised figures (−£6,450); she describes deducting the `SAVINGS_CUSHION` **£19,000** from raw totals (−£17,300). Both values are seeded for category 3, and the £19,000 is on her form marked as feeding no calculation. Her case is unaffected (both negative) but a household with real savings turns on it. | **holds the Tranche A promotion** (§2) | Charlotte |

### For Brian

- **Tranche A is what she is waiting on**, and she asked whether it could be done
  this early evening. That is a commitment to make or decline.
- **A1 means she may not be blocked at all** — the savings-test calculation and
  its positive add-back already work and are tested. Worth telling her tonight
  regardless of when the display moves.
- Promotion of each tranche to production is yours.
- Grant Tracker data-migration call: she is awaiting availability for next week or
  the week of 7 Sept.
- She is running one more nonprod test assessment now; expect a further batch,
  which starts at **CH-53** and does not reopen these WPs.
