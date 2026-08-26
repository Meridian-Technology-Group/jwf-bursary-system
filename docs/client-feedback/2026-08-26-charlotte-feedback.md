# Charlotte Perrier — feedback, 26 Aug 2026

Catalogue of the emails received from Charlotte (charlotteperrier@johnwhitgiftfoundation.org) on Wednesday 26 Aug 2026, after the Epic 17 promotion. Gmail links open under the `brian@meridiantech.group` account.

Item IDs continue the `CH-*` series (last used: **CH-59**, shipped in `6f9e730`). Today's batch is **CH-60 … CH-63**.

> 🎉 **The first live assessment passed.** This batch is the feedback from Charlotte completing a real production assessment end to end — Aditya Jayaprakash, Trinity School, Year 11, 2026/27. Her verdict on the model itself is unqualified, and every item below is a refinement she raised *while* the assessment succeeded, not a blocker to it. That is a different class of feedback from every previous batch.

---

## E1 — 10:31 · Comments on the UPLOADED DOCUMENTS section and the APPLICATION FORM section

- **Message ID**: `1a03d9ff977408ae` · [open message](https://mail.google.com/mail/u/0/#all/1a03d9ff977408ae) · thread `1a03d9ff977408ae`
- Cc: Alex Skrzynski
- 📷 `image002.png` — the **Parent1 Contact** block on the APPLICATION FORM tab, rendering in raw JSONB key order: City, Email, Title, Mobile, Country, Last Name, Postcode, First Name, Address Line1, Address Line2.
- Framing: *"I am currently carrying out the first live assessment and would like to make the requests below."*

| ID | Type | Item |
|---|---|---|
| CH-60 | Change | **Give the document viewer more height.** *"I would need somehow the search window to collapse as I check the document content so that the window that lets me see the document expands so that I can check the full document more easily. Right now, it is a narrow window and makes the whole exercise more acrobatic."* |
| CH-61 | Change | **Parent details in a human order.** Her order, verbatim: Title → First name → Last name → Mobile → Email → Address line 1; Address line 2 → City → Postcode → Country. |
| CH-62 | Change | **Group the Assets & Liabilities section by subject.** *"Right now the data is thrown out in an arbitrary way."* Her grouping: property → car & public transport → council tax → financial assets → debt, each with its own uploaded-document titles listed beneath it. |

## E2 — 11:43 · RE: Comments on the UPLOADED DOCUMENTS section and the APPLICATION FORM section

- **Message ID**: `1a03de1f95960de1` · [open message](https://mail.google.com/mail/u/0/#all/1a03de1f95960de1) · thread `1a03d9ff977408ae`
- Replying to Brian's 12:27 clarifying questions. **All three items are now unambiguous.**

### CH-60 — she does *not* want the search panel hidden

> *"Please keep the search panel in view, it works very well. Simply collapse what can be collapsed so that the window to appreciate the document expands a little bit more than what it is now."*

This is the opposite of what the question offered (auto-collapse vs. manual toggle) and it rules out the obvious implementation. The filter/search row stays pinned; the **document list** below it is what gives up height.

### CH-61 — the same order applies to Parent 2

> *"2- thanks"* — accepting the order as stated, in answer to *"should the same order apply to Parent2?"*

### CH-62 — the list in E1 had paste artefacts; the *rule* is what matters

She corrected three things Brian queried:

- The duplicated **Mortgage Balance** and the stray **"No"** were collation artefacts: *"I may have removed inadvertently some sections for property 2 and for the third property section."* Her example household owns three properties, so the panel legitimately repeats per property.
- Renting vs. owning: *"if the applicant selects renting, he should have no mortgage field, instead the monthly rent field."*
- **The actual requirement, in her words:** *"can we have all the property related answers on the APPLICATION FORM reported within the same section and for each property according to the same logical display to mirror the order on the form? (currently the data looks all piled up in an un-orderly way, irrespective of whether it is car-related, transport-related, accommodation-related, savings-related or debt-related, so it is confusing)"*
- **Not parent-specific:** *"No this is not parent specific (only the income section is), the property assets and financial assets are household-related as a whole."*

So CH-62 is **not** a literal transcription of her E1 list. It is: mirror the portal form's own order, grouped by subject, and do not invent a per-parent split for a household-level section.

> ⚠️ Brian also asked whether these were needed *before* she finished the assessment in flight. She did not answer directly — but E3, sent 21 minutes earlier than this reply, reports the assessment **complete**. So the answer is empirically "next release".

## E3 — 11:22 · Completing the first live assessment: my feedback... :)

- **Message ID**: `1a03dcf07cd055e5` · [open message](https://mail.google.com/mail/u/0/#all/1a03dcf07cd055e5) · thread `1a03dcf07cd055e5`
- Cc: Alex Skrzynski
- **No items.** This is the acceptance signal for Epic 17.

> *"I have completed the assessment for AJ – Trinity School – Year 11 – 2026-27. Great stuff!... Very user-friendly for the assessor... Very efficient in terms of data consulting... **The calculations are correct**... Nothing else to report. 😊 (see my other emails for some small adjustments about layout of the application form & Zero/Blank request). I will complete the other one this evening. A big thank you again!"*

**What this closes.** Epic 17 shipped CH-32…CH-59 against her workbook and her screenshots, but every verification to that point was ours — unit tests, SQL against nonprod, and Playwright walkthroughs. This is the first time the calculation model has been checked by the person who owns the process, against a real family, on production, front to back. *"The calculations are correct"* is the sentence that retires the whole calc-model verification thread.

**What it does not close.** One assessment, one family shape (Year 11, Trinity, internal). The second live assessment is due the same evening and is the one worth watching — a different family shape can still surface a gap.

## E4 — 11:06 · One comment re the assessment model - Zero and Blank

- **Message ID**: `1a03dc0387956394` · [open message](https://mail.google.com/mail/u/0/#all/1a03dc0387956394) · thread `1a03dc0387956394`
- Cc: Alex Skrzynski

| ID | Type | Item |
|---|---|---|
| CH-63 | Change | **A typed `0` must persist as `0`, not revert to blank.** *"When I enter a 0 in a field, the form switched back to a blank field. Could I have a 0 saved in when entered? It is just that the form will show that a nil value was entered to show that it was worked on and reported as nil, rather than the current display which may look like it was left unanswered as the default blank field."* |

### Analysis — she has found a real design flaw, and it is bigger than she thinks

Her reasoning is exactly right: on an assessment worked by one person and reviewed by another, *"answered as nil"* and *"never touched"* are different facts, and today the UI renders them identically.

**Root cause** is one line — `src/components/admin/earner-form-v2.tsx:67`:

```ts
const hasValue = React.useCallback(
  (v: number) => (allowNegative ? v !== 0 : v > 0),
  [allowNegative]
);
```

Every non-negative money cell in the assessment treats `0` as "no value", so `onBlur` (`:96`) resets the display to `""`. The stored number is already `0` — this is display-only — but the assessor cannot tell.

**The collision.** That same blank-is-zero behaviour is load-bearing for the two CH-21/22 manual overrides, documented at `src/components/admin/assessment-form-v2.tsx:540`:

> `// CH-21/22 — manual £ overrides. 0 = "no override" (the CurrencyInput's empty state), matching the manual-adjustment idiom; persisted as null.`

`rentAddBackOverride` and `councilTaxOverride` each use `> 0` as the sentinel in five places — state init (`:542`, `:548`), both save paths (`:597`/`:600`, `:794`/`:797`) and the render guards (`:1365`, `:1426`). Making `0` display as `0` globally would make those two read as a deliberate **£0 override**, which changes an award.

So CH-63 cannot be a one-line change. See Epic 19 WP-A4 for the two options and the recommendation.

## E5 — 11:34 · Catch up tomorrow on teams?

- **Message ID**: `1a03dd9cb8979798` · [open message](https://mail.google.com/mail/u/0/#all/1a03dd9cb8979798) · thread `1a03dd9cb8979798`
- To: Brian **and** Alex Skrzynski (not Cc — Alex is a principal here)
- **No code items.** Two agenda items, one of which is significant new scope.

1. **Domain name and URL customisation** — *"what you need Alex to do on our side over the next few weeks."* Alex is the JWF-side owner. This is DNS/Vercel work, not application work.
2. **Grant Tracker data migration / integration** — schedule a four-way Teams call (Brian, Alex, Charlotte, Grant Tracker) for next Thu/Fri or the week of 8 Sep. Extends her 25 Aug ask (`1a0393f825b09fde`, *"I have approached Grant Tracker with a view that you, Alex, them and myself meet via teams"*).

### The migration ask, in her words

> *"Ideally, I would love for all active bursaries to have their assessment admin page activated with the data the applicants entered in their rolling-over application in May or in their new application during the winter, and for the corresponding assessment data to also be captured into the new system."*

> *"This would have an impact on: 1. The reporting: ability to do year on year comparisons. 2. The bursary assessment itself next year taking into account the current payable fees applied (the previous assessment is always used as a benchmark for the next year's assessment)."*

**Why this is its own epic and not a lane in Epic 19.** It is a data-migration programme with an external vendor, an unknown source schema, and a hard functional dependency on Epic 18 — *"assessment admin page activated"* is precisely the New Award transition Epic 18 defines (Q12). Building a migration onto a lifecycle that is still being specified would mean migrating into a shape that then changes. Tracked as **Lane E** in Epic 19 for visibility and sequencing only; the build belongs to Epic 20 after the vendor call.

### ⏰ Her availability is the binding constraint

> *"As it is our financial year end on the 31st of August, I won't have any availability from Friday 28th till Wednesday 2nd September to address anything bursary related. (yes… you are reading this correctly… I won't bother you this bank holiday weekend! 😊)"*

**Unavailable Fri 28 Aug → Wed 2 Sep inclusive.** Thursday 27 Aug is the only slot before the break. Every open question in Epic 19 that needs her answer — Q3, Q4, Q5, Q7, Q8, Q9, Q11, Q14, Q15 — either gets asked on that call or waits until 3 September.

## E6 — 13:21 · RE: FW: Purchase Order Request from FO

- **Message ID**: `1a03e3b9af463f8e` · [open message](https://mail.google.com/mail/u/0/#all/1a03e3b9af463f8e) · thread `1a0380157e025eae`
- **Commercial, no code.** The £7,000 PO (supplier `V107262`, expenditure code *Software licences 28050*, budget year 2026/27) is stuck awaiting a colleague's signature: *"It is sitting with a temperamental colleague of mine for signature.. so I will find a way to get her to complete the sign off. I am mindful of the payment deadline for next week's bacs."*
- Nothing to action — she is chasing it herself and is aware of the BACS deadline.

---

## Summary

| ID | Item | Class | Size | Lands in |
|---|---|---|---|---|
| CH-60 | Document viewer height; keep the search panel pinned | Change | S | Epic 19 · WP-A1 |
| CH-61 | Parent details field order (both parents) | Change | S | Epic 19 · WP-A2 |
| CH-62 | Assets & Liabilities grouped by subject, form order within | Change | M | Epic 19 · WP-A3 |
| CH-63 | Typed `0` persists as `0` | Change | M | Epic 19 · WP-A4 |
| — | First live assessment: calculations confirmed correct | ✅ Acceptance | — | Closes Epic 17 |
| — | Domain / URL customisation with Alex | Ops | — | Epic 19 · Lane E |
| — | Grant Tracker data migration + integration | New scope | L | Epic 20 (after vendor call) |
| — | £7,000 PO awaiting signature | Commercial | — | No action |

**Nothing in this batch is client-blocking.** She has completed a live assessment and is proceeding to the second one tonight without any of it.
