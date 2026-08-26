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
| T1 | WP-A1 | CH-60 · document viewer height | ✅ ⏭ awaiting promotion | #379 |
| T1 | WP-A2 | CH-61 · parent details field order | ✅ ⏭ awaiting promotion | #379 |
| T1 | WP-A3 | CH-62 · Assets & Liabilities grouping | ✅ ⏭ awaiting promotion | #379 |
| T2 | WP-A4 | CH-63 · typed `0` persists as `0` | 🔴 needs **D-E** | |
| T3 | H1 | Autosave indicator under network failure | ⬜ | |
| T3 | H2 | Dirty-nav guard | ⬜ | |
| T3 | H5 | Declaration footer at mobile widths | ⬜ | |
| T3 | H3 | One-time PDF 410 | ⬜ low | |
| T3 | H4 | UC repeat-slot + 409 | ⬜ low | |
| T4 | WP-B1 | Lifecycle state machine diagram + questions to her | ✅ drawn · ⏭ **email awaiting Brian's send** | #380 |
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
4. **Q14** — the reference prompt at New Award. ⚠️ **Reframed by WP-B1**: both original premises were wrong. An account has **no** reference of its own (`account-promotion.ts:118`, D13-1a — the user-facing label is `Application.reference`), references are **not** uniqueness-validated any more (`edit-reference-dialog.tsx:12`, D13-1a), and the editor **already exists** (ADMIN-only, no state gate). So it reduces to: blocking or advisory · pre-filled or current · may an ASSESSOR edit, or admin-only?
5. **Q15** — is "closed & archived" reopenable?
6. **Q16** 🆕 — is **New Award** reversible? Every other final state has an exit; this one has none. Fell out of drawing the WP-B1 diagram.
7. **Q10b** — purge vs the 7-year retention guard and append-only `audit_logs`. **Deliberately held out of the WP-B1 email** — it needs its own thread and a written position, and it only gates WP-B6, which is last anyway.
8. Q9 (debt ratio of exactly zero) · Q5 (her Assessment Admin layout email) · Q4 (BCC) · Q3 (debt labels) · Q6 (the £89,257.14 reconciliation)

---

## T1 — the assessor display batch · PR #379

Branch `feature/ch60-62-assessor-display` → `staging`. One PR, per §1 of the
plan: A2 and A3 share the ordering mechanism, and A1 rides along.

**Blast radius: none.** Nothing in T1 touches a computed value — she signed off
the calculation model on 26 Aug and T1 is display-only by design. No migration
(`git diff --stat prisma/` empty), no schema change, no stored figure read or
written. Live production rows that would show a different number: **zero**.

### Gates

| Gate | Result |
|---|---|
| `npm test` | ✅ 168 files / 2314 tests pass; **46 new** across the two seams |
| `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` | ✅ clean |
| `npx prisma format --check` | ✅ "All files are formatted correctly" |
| CI on #379 | ✅ green — typecheck/test, Vercel, preview comments |

### WP-A1 · CH-60 — measured, and the plan's step 3 was wrong

Her constraint ruled out the obvious fix: *"Please keep the search panel in
view, it works very well. Simply collapse what can be collapsed."*

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
> over-counted the page chrome, and told us to measure before settling on 200.
> Measured at 1280×800, the chrome above the container (application header card
> + five-tab nav) is **258px** — so 260 was already right. Shipping 200 made the
> shell 600px and pushed it **58px below the fold**, which is worse for exactly
> the reason she complained. The subtrahend stays at 260, and the comment in
> `documents/page.tsx` records the measurement so nobody re-opens it.

**Measured, WS-202627-0010 (45 documents, real multi-page PDFs):**

| Viewport | State | Shell | Toolbar | Filter row | List | **Viewer** |
|---|---|---|---|---|---|---|
| 1280×800 | **before** (list auto-open) | 560 | 49 | *inside list* | 237 | **240 px** |
| 1280×800 | after, list closed *(default)* | 560 | 49 | 49 | — | **428 px** |
| 1280×800 | after, list opened by toggle | 560 | 49 | 49 | 158 | **270 px** |
| 1440×900 | after, list closed *(default)* | 640 | 49 | 49 | — | **508 px** |

Her working state goes **240 px → 428 px (+188, +78%)** at 1280×800, and even
with the list deliberately open it is taller than before (270 vs 240).

| Acceptance | Result |
|---|---|
| Filter input + verified-only visible whether the list is open or closed | ✅ both states, both viewports |
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
and assert the group specs plus the trailing bucket cover every one, that no key
is in two groups, that no spec names a field the schema lacks, and that every
registry slot `sectionForDocumentSlot` calls `ASSETS_LIABILITIES` lands in a
named group. **A key silently missing from every group is now a test failure.**

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
| Sections with no grouping spec render exactly as before | ✅ Child Details / Family Identity / Parent Details / Income / Declaration unchanged and unreordered |
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

### Things T1 surfaced that nobody asked about

1. **`OTHER_PROPERTY_MORTGAGE_{n}` was landing in "Other documents."** The
   per-property mortgage statement from the `otherProperties` repeater
   (`assets-liabilities-form.tsx:849`) is not in `ALL_DOCUMENT_SLOTS`, so
   `sectionForDocumentSlot` returned `null` and its title listed in the
   catch-all bucket at the very bottom of the page — the opposite of *"all the
   property related answers within the same section."* **Fixed in #379** (one
   alternation added to the A&L pattern) because it is the same defect CH-62
   describes.
2. **`otherNonFinancialAssetsValue` is live on nonprod but not in the schema.**
   WS-202627-0008 carries it. Harmless — it renders under "Other details" — but
   it means either the schema dropped a field or a seed wrote one that never
   existed. Worth a look; not touched.
3. **The currency heuristic misses several money fields.** `formatValue`'s
   `currencyKeys` list has no `lease`, `overdraft`, `loans`, or `transport`, so
   *Car Monthly Lease*, *Bank Overdraft*, *Loans To Agencies*, *Loans To Friends
   Family* and *Public Transport Monthly* render as bare numbers (`8396`) beside
   neighbours rendered as `£8,396.00`. Pre-existing, display-only, outside T1's
   three WPs — but it is the kind of inconsistency she notices, and it sits next
   to **CH-63**'s zero-vs-blank question. Candidate for T2.
4. **`min-h-[560px]` overflows an 800px-tall viewport by ~50px.** Pre-existing:
   the shell's minimum is taller than the space below 258px of chrome at
   1280×800, so the page carries a small scroll. Reducing it to ~520px would
   remove the scroll at the cost of ~20px of viewer height on shorter screens.
   Left alone — separate judgement call, and CH-60 is already satisfied.
5. **Suppression stops at the two named triples.** On a RENT household,
   `mortgageStatementDocumentId` still renders and its document still lists.
   Deliberate: the plan named exactly three fields for RENT and two for OWN, and
   an uploaded document is evidence the assessor should see even if the branch
   that asked for it has changed. Flag if she wants it hidden too.

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

### 2026-08-26 · T4 · WP-B1 — the state machine is drawn

[`docs/diagrams/epic-18-post-assessment-lifecycle.md`](../../diagrams/epic-18-post-assessment-lifecycle.md)
— a Mermaid state diagram (renders on GitHub) plus every transition on the five
dimensions the plan requires: what locks, whether an email fires, whether an
account is created, whether it is reversible, what it destroys. **No behaviour
changed.** The email to her is **drafted, not sent**:
[`2026-08-26-lifecycle-questions-draft.md`](../../client-feedback/2026-08-26-lifecycle-questions-draft.md).

Drawing it produced four things worth more than the picture:

- **Q14's two premises were both wrong.** A bursary account has **no**
  user-facing reference (`account-promotion.ts:118` — internal FK only, D13-1a;
  the label lives on `Application.reference`), and references are **not**
  uniqueness-validated any more (`edit-reference-dialog.tsx:12` — *"Since D13-1a
  the reference is NOT unique"*). Both the Epic 18 spec and the implementation
  plan say otherwise. The editor also **already exists** — ADMIN-only, no state
  gate. So WP-B3 builds a *prompt*, not an editor, and Q14 shrinks to three small
  choices.
- **Q16 is new.** Every final state has an exit except **New Award**. *"Can't be
  amended again"* may be exactly what she wants, but terminal-with-no-escape is a
  support problem the first time an award locks in error. Better a decision than
  an accident of the sketch.
- **Q11 has three answers, not two**, and the third is probably right: not
  "stops" or "moves to New Award" but **manual** — a "notify the family" action
  triggered when the admissions position settles. That fits the winter admission
  process, and it never sends on a state she is only parking a case in.
- **Q10b is held out of the email on purpose.** It gates the one irreversible
  transition and deserves its own thread, not a quick answer buried under four
  smaller questions. WP-B6 is last regardless.

### 2026-08-26 · T1 built — CH-60/61/62 on PR #379, awaiting promotion

All three Lane A display items shipped as one PR, gates green, browser pass at
1280×800 and 1440×900 against an application with three properties. Detail in
[T1 above](#t1--the-assessor-display-batch--pr-379).

Two things the build changed about the plan:

- **The plan's CH-60 step 3 was wrong**, and its own instruction to measure
  first caught it. The chrome above the documents container is 258px, so the
  260px subtrahend was already correct; the proposed 200 pushed the panel below
  the fold. The height came from the pinned filter row, the 30% list cap and
  closing the list by default instead.
- **`OTHER_PROPERTY_MORTGAGE_{n}` was listing in "Other documents"** rather than
  with the property it belongs to. Not in the plan; the same defect CH-62
  describes, so fixed alongside it.

This branch was cut from `staging` per `CLAUDE.md` and therefore could not see
the Epic 19 docs, which live only on PR #378 — so it independently added a
second `epic-19-progress.md`. Reconciled here by merging #378's branch and
taking the union, so nothing from either side is lost. **#378 should merge
before #379**; if #378 is squash-merged, this one file needs a re-reconcile.

### 2026-08-26 · Epic 19 opened

Queued every pending item into one ordered list: Charlotte's 26 Aug batch (CH-60…63), Epic 18's lifecycle build, Epic 16's engineering residue, Epic 17's leftovers, and the two operational threads. Absorbed Epic 16's queue; Epic 18 keeps its spec and contributes Lane B. Catalogued the 26 Aug emails as [`2026-08-26-charlotte-feedback.md`](../../client-feedback/2026-08-26-charlotte-feedback.md).

Root causes located while scoping, so the build does not have to re-derive them:

- **CH-60** — `documents/page.tsx:75` (`h-[calc(100vh-260px)]`) and `document-list-client.tsx:349` (`max-h-[45%]`). Her constraint rules out the obvious fix: the search row is pinned, the *list* gives up height.
- **CH-61 / CH-62** — one cause. `DataBlock` (`application-section-cards.tsx:261`) renders `Object.entries(data)` in raw JSONB order. Her grouping for CH-62 **already exists as comments** in `slots.ts:40-59`.
- **CH-63** — `earner-form-v2.tsx:67`, `hasValue = v > 0`. Collides with the CH-21/22 override sentinel documented at `assessment-form-v2.tsx:540` and enforced in five places each for two award-affecting fields. Not a one-line fix; hence **D-E**.

Also surfaced: `allowNegative` on the admin `CurrencyInput` is passed by no consumer, so its `v !== 0` branch is dead code today.
