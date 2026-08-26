---
title: "Epic 19 — live progress board"
status: open
opened: 2026-08-26
opened_by: Brian Wagner
related:
  - ./epic-19-assessor-ux-and-lifecycle.md
  - ./epic-19-implementation-plan.md
  - ../../client-feedback/2026-08-26-charlotte-feedback.md
---

# Epic 19 — progress

Board for [`epic-19-assessor-ux-and-lifecycle.md`](epic-19-assessor-ux-and-lifecycle.md),
built per [`epic-19-implementation-plan.md`](epic-19-implementation-plan.md).

## Status at a glance

| Tranche | WP | Item | State | PR |
|---|---|---|---|---|
| **T1** | WP-A1 | CH-60 · document viewer height, search row pinned | ✅ **on `staging`-bound PR** | (T1) |
| **T1** | WP-A2 | CH-61 · parent details in her order, both parents | ✅ **on `staging`-bound PR** | (T1) |
| **T1** | WP-A3 | CH-62 · Assets & Liabilities grouped by subject | ✅ **on `staging`-bound PR** | (T1) |
| T2 | WP-A4 | CH-63 · typed `0` persists | ⛔ blocked on **D-E** | — |
| T3 | — | H1 / H2 / H5 human checks | ⬜ not started | — |
| T4 | WP-B1 | Epic 18 state machine + Q11/Q14/Q15 | ⬜ not started | — |
| T5 | WP-C1…C9 | the residue | ⬜ not started | — |
| T6 | Lane B | build queue | ⬜ gated on T4 | — |

**Nothing in T1 touches a computed value.** Charlotte signed off the calculation
model on 26 Aug (*"The calculations are correct"*) and T1 is display-only by
design. Blast radius on live rows: **none** — no migration, no schema change, no
stored figure read or written. `git diff --stat prisma/` is empty.

---

## T1 — the assessor display batch

Branch `feature/ch60-62-assessor-display` → `staging`. One PR, per §1 of the
plan: A2 and A3 share the ordering mechanism, and A1 rides along.

### Gates

| Gate | Result |
|---|---|
| `npm test` | ✅ 168 files / 2314 tests pass; **46 new** across the two seams |
| `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` | ✅ clean |
| `npx prisma format --check` | ✅ "All files are formatted correctly" |
| `git diff --stat prisma/` | ✅ empty — no migration in this tranche |

### WP-A1 · CH-60 — measured, and the plan's step 3 was wrong

Her constraint ruled out the obvious fix: *"Please keep the search panel in
view, it works very well. Simply collapse what can be collapsed."*

What shipped:

1. The filter/search row is **lifted out of the `listOpen` conditional** and
   renders unconditionally. It used to live inside it, so collapsing the list
   took her search panel with it.
2. The open list is capped at **30%** of the shell, down from 45%. It already
   scrolls internally, so this costs visible rows, not access.
3. The list now **starts closed regardless of document count**. It used to
   auto-open past 12 documents — and WS-202627-0010 has 45, so for her it was
   *always* open. That auto-open was most of the missing height.
4. `100vh` → `100dvh`, for mobile browsers with a retracting toolbar.
5. Typing in the filter, or switching on verified-only, re-opens the list, so
   the pinned row is never inert. The toggle still closes it again.

> **The plan's step 3 does not survive measurement.** It proposed
> `calc(100vh-260px)` → `calc(100dvh-200px)` on the assumption that 260px
> over-counted the page chrome. Measured at 1280×800, the chrome above the
> container (application header card + five-tab nav) is **258px** — so 260 was
> already right. Shipping 200 made the shell 600px and pushed it **58px below
> the fold**, which is worse for exactly the reason she complained. The
> subtrahend stays at 260 and the comment in
> `documents/page.tsx` now records the measurement so nobody re-opens it.

**Measured, WS-202627-0010 (45 documents, real multi-page PDFs):**

| Viewport | State | Shell | Toolbar | Filter row | List | **Viewer** |
|---|---|---|---|---|---|---|
| 1280×800 | **before** (list auto-open) | 560 | 49 | *inside list* | 237 | **240 px** |
| 1280×800 | after, list closed *(default)* | 560 | 49 | 49 | — | **428 px** |
| 1280×800 | after, list opened by toggle | 560 | 49 | 49 | 158 | **270 px** |
| 1440×900 | after, list closed *(default)* | 640 | 49 | 49 | — | **508 px** |

So her working state goes **240 px → 428 px (+188, +78%)** at 1280×800, and
even with the list deliberately open it is taller than before (270 vs 240).

| Acceptance | Result |
|---|---|
| Filter input + verified-only visible whether the list is open or closed | ✅ verified both states, both viewports |
| List closed → viewer occupies the full height below the toolbar | ✅ 428 px / 508 px |
| List open → viewer still meaningfully taller than today | ✅ 270 px vs 240 px |
| No horizontal scroll at 1280 px or 1440 px | ✅ `scrollWidth === clientWidth` in both |

Screenshots: [`ch60-before-1280x800.png`](source-materials/epic-19-t1-screenshots/ch60-before-1280x800.png)
· [`ch60-after-listclosed-1280x800.png`](source-materials/epic-19-t1-screenshots/ch60-after-listclosed-1280x800.png)
· [`ch60-after-listopen-1280x800.png`](source-materials/epic-19-t1-screenshots/ch60-after-listopen-1280x800.png)
· [`ch60-after-listclosed-1440x900.png`](source-materials/epic-19-t1-screenshots/ch60-after-listclosed-1440x900.png)

### WP-A2 · CH-61 — parent details in her order

`src/lib/admin/section-field-order.ts` (new). `DataBlock` resolves a spec from
the **leaf container name**, so `parent1Contact` and `parent2Contact` share one
`parentContact` spec — which is what she confirmed she wanted for Parent 2.

| Acceptance | Result |
|---|---|
| Both parents in her order on **both** tabs | ✅ Title → First Name → Last Name → Mobile → Email → Address Line1 (→ Address Line2) → City → Postcode → Country, read out of the DOM on the APPLICATION FORM tab **and** the Applicant Data tab, for Parent 1 and Parent 2 |
| A key absent from the spec still renders, after the ordered ones | ✅ unit-tested, and proven live: `otherNonFinancialAssetsValue` (not in the current schema) still renders on WS-202627-0008 |
| A spec key absent from the data renders nothing | ✅ WS-202627-0008 has no `addressLine2` → no ghost row; WS-202627-0010 has one → it appears in position |

Seam `orderEntries` — 21 tests, including "never loses or duplicates an entry
whatever the spec" and the exact key order from her screenshot.

Screenshot: [`ch61-parent-details-after-1280.png`](source-materials/epic-19-t1-screenshots/ch61-parent-details-after-1280.png)

### WP-A3 · CH-62 — Assets & Liabilities grouped by subject

`src/lib/admin/section-field-groups.ts` (new) turns the grouping that
`src/lib/documents/slots.ts:40-59` carried **as comments** into data, and keeps
the slot→group map beside the field specs so field grouping and document
grouping cannot drift.

| Acceptance | Result |
|---|---|
| Five headings in her order | ✅ Property · Car & public transport · Council tax · Financial assets · Debt, then a trailing **Other details** |
| Each property in `otherProperties[]` its own labelled sub-block in form order | ✅ 3-property fixture: Address · Postcode · Value · Mortgage Balance · Monthly Repayment · Used As Rental · Mortgage Statement Document Id, then `id` (unlisted, so last) |
| Renting shows rent fields and no mortgage fields | ✅ both on a fixture and on the **real** RENT household WS-202627-0010 |
| Owning shows the reverse | ✅ WS-202627-0008 — and note its blob really does carry a stale `monthlyRent: 0` from a branch it left, now correctly hidden |
| Unanswered ownership shows everything present | ✅ `propertyOwnership` deleted → all 11 property fields render, both branches |
| Each group lists only its own document titles; the link still works from each | ✅ Property 4 · Council tax 1 · Financial assets 10 · Debt 4, each with its own "Open in Uploaded Documents" |
| No field in the blob disappears unless the branch rule hides it | ✅ unit-tested against all 46 schema keys, plus the live orphan key above |

Seam `groupSectionFields` / `groupForDocumentSlot` — 25 tests, including the
cross-check the plan asked for: enumerate `assetsLiabilitiesSchema` (46 keys)
and assert the group specs plus the trailing bucket cover every one, and that
every registry slot `sectionForDocumentSlot` calls `ASSETS_LIABILITIES` lands in
a named group. **A key silently missing from every group is now a test failure.**

Screenshots: [`ch62-assets-liabilities-after-1280.png`](source-materials/epic-19-t1-screenshots/ch62-assets-liabilities-after-1280.png)
· [`ch62-applicant-data-tab-grouped-1280.png`](source-materials/epic-19-t1-screenshots/ch62-applicant-data-tab-grouped-1280.png)
· [`ch62-rent-branch-1280.png`](source-materials/epic-19-t1-screenshots/ch62-rent-branch-1280.png)
· [`ch62-unanswered-branch-1280.png`](source-materials/epic-19-t1-screenshots/ch62-unanswered-branch-1280.png)
· [`ch62-real-rent-household-1440x900.png`](source-materials/epic-19-t1-screenshots/ch62-real-rent-household-1440x900.png)

### Regression checks from the plan's T1 table

| Check | Result |
|---|---|
| Applicant Data tab renders, real-shaped application with 3 properties | ✅ WS-202627-0008 |
| APPLICATION FORM tab renders, same application; both tabs agree | ✅ identical group headings and identical parent field order on both |
| CH-57 null-array case still does not crash | ✅ WS-202627-0010 (`ucMonthlyDocumentIds = [null,null,null]`) renders three "Not provided" rows on **both** tabs, no error boundary |
| Sections with no grouping spec render exactly as before | ✅ Child Details / Family Identity / Parent Details / Income / Declaration all unchanged and unreordered |
| Console | ✅ clean bar a `favicon.ico` 404 on localhost |

### Nonprod fixture — created, used, removed

No application on nonprod had **any** `otherProperties`, so the 3-property shape
had to be built. On **WS-202627-0008** (a nonprod test application, not one of
the three real families — those are on production):

1. Snapshotted its `ASSETS_LIABILITIES` blob to a temp table.
2. Additively set `hasOtherProperties` + three `otherProperties`, and inserted
   three `OTHER_PROPERTY_MORTGAGE_{0,1,2}` document rows.
3. Also flipped `propertyOwnership` to `RENT`, then deleted the key entirely, to
   photograph the other two branch cases.
4. **Restored** — blob compared byte-equal to the snapshot (`data = b.data` →
   `true`), fixture documents deleted (26 documents before, 26 after), temp table
   dropped (`to_regclass` → null).

No `audit_logs` rows were touched, so nothing hit the append-only wall.

---

## Things this work surfaced that nobody asked about

1. **`OTHER_PROPERTY_MORTGAGE_{n}` was landing in "Other documents."** The
   per-property mortgage statement from the `otherProperties` repeater
   (`assets-liabilities-form.tsx:849`) is not in `ALL_DOCUMENT_SLOTS`, so
   `sectionForDocumentSlot` returned `null` and its title listed in the
   catch-all bucket at the very bottom of the page — the opposite of *"all the
   property related answers within the same section."* **Fixed in this PR**
   (one alternation added to the A&L pattern) because it is the same defect
   CH-62 describes; the screenshot shows the three fixture statements listing
   under Property.
2. **`otherNonFinancialAssetsValue` is live on nonprod but not in the schema.**
   WS-202627-0008 carries it. It is harmless — it renders under "Other details"
   — but it means either the schema dropped a field or a seed wrote one that
   never existed. Worth a look; not touched here.
3. **The currency heuristic misses several money fields.** `formatValue`'s
   `currencyKeys` list has no `lease`, `overdraft`, `loans`, or `transport`, so
   *Car Monthly Lease*, *Bank Overdraft*, *Loans To Agencies*, *Loans To Friends
   Family* and *Public Transport Monthly* render as bare numbers (`8396`) beside
   neighbours rendered as `£8,396.00`. Pre-existing, display-only, and outside
   T1's three WPs — but it is the kind of inconsistency she notices, and it
   sits next to **CH-63**'s zero-vs-blank question. Candidate for T2.
4. **`min-h-[560px]` overflows an 800px-tall viewport by ~50px.** Pre-existing:
   the shell's minimum is taller than the space below 258px of chrome at
   1280×800, so the page carries a small scroll. Reducing it to ~520px would
   remove the scroll at the cost of ~20px of viewer height on shorter screens.
   Left alone — it is a separate judgement call, and CH-60 is already satisfied.
5. **Suppression stops at the two named triples.** On a RENT household,
   `mortgageStatementDocumentId` still renders (and its document still lists).
   Deliberate: the plan named exactly three fields for RENT and two for OWN, and
   an uploaded document is evidence the assessor should see even if the branch
   that asked for it has changed. Say the word if she wants it hidden too.

---

## Awaiting

**T1 is awaiting promotion by Brian.** Per `CLAUDE.md` rule 6 and §8.8 of the
plan, no `staging` → `main` PR has been opened.
