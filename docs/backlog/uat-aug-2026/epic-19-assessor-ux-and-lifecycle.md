---
title: "Epic 19 — assessor UX, post-assessment lifecycle, and the standing residue"
status: open
severity: medium
area: assessment, admin display, portal, uploads, lifecycle, security
opened: 2026-08-26
opened_by: Brian Wagner
supersedes_queue_of:
  - ./epic-16-post-go-live-residue.md      # absorbed as Lane C
  - ./epic-18-post-assessment-lifecycle.md # remains the spec; Lane B is its build queue
related:
  - ../../client-feedback/2026-08-26-charlotte-feedback.md
  - ./epic-17-progress.md
  - ./follow-ups.md
  - ../../product/state-model.md
---

# Epic 19 — the next sprint

**One queue for everything currently pending.** Epics 16, 17 and 18 each left work behind; this epic is the single ordered list, so there is exactly one place to look for "what is next" and one place a build agent picks work from.

Epic 16 and Epic 18 are not closed by this — Epic 16 keeps its rationale, Epic 18 keeps its state-machine spec. What moves here is the **queue**: sequencing, sizing, gating and the handover detail.

Build detail lives in [`epic-19-implementation-plan.md`](epic-19-implementation-plan.md). Running state lives in [`epic-19-progress.md`](epic-19-progress.md).

---

## Where the world stands, 26 Aug 2026

| Fact | Consequence for this sprint |
|---|---|
| `origin/staging` and `origin/main` hold identical trees (`6f9e730`); main is ahead only by merge commits | Clean start. Nothing is stranded on staging. Every fix here begins from a promoted baseline. |
| **Charlotte completed the first live production assessment and confirmed the calculations are correct** | Epic 17's calc thread is closed by the client. Nothing in this sprint may regress the assessment model without her re-confirming. |
| A second live assessment runs the evening of 26 Aug | Expect one more feedback batch before this sprint starts. Do not begin Lane A until it lands — it may add to it. |
| She is unavailable **Fri 28 Aug → Wed 2 Sep** (JWF financial year end) | Every question in the register below is asked on the **Thu 27 Aug call** or waits until 3 Sep. This is the sprint's hard scheduling constraint. |
| Three real families are in the portal; Charlotte is on production | The path is per-fix: fix → validate → merge to `staging` → promote `staging → main`. A fix is not done on staging. |
| Prod holds real assessments now (it held none during Epic 17) | The "prod has zero rows, so nothing is retro-changed" escape hatch used repeatedly in Epic 17 **no longer applies**. Any change to a stored figure or a derived category must be checked against live data before promotion. |

---

## Ground rules

Carried from Epic 16, plus two additions forced by the facts above.

- **Charlotte is on production.** Fix → validate → `staging` → promote, per fix. Never batch a promotion across unrelated lanes.
- 🆕 **Production now holds assessments.** Before promoting anything that changes a calculation, a category, a band or a stored figure, run the change against the live rows and state the blast radius in the PR. "Prod is empty" is no longer true.
- 🆕 **Do not regress the model she just signed off.** Lane A is display-only by design. If a Lane A change turns out to touch a computed value, it stops being Lane A and gets its own verification.
- Never write a **new enum value** to production before the code that knows it is deployed — the running Prisma client is generated from the old schema and throws on deserialising an unknown member.
- Run the typecheck the way CI does: `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit`. A stale buildinfo makes the local check skip new files.
- `prisma format --check` is a CI gate that no local command runs by default. Run it before pushing.
- Lint is `continue-on-error` in CI. **Only typecheck and test gate a merge** — a green CI does not mean lint-clean.
- Migrations apply to nonprod automatically on merge to `staging` (`db-push.yml`), to prod on merge to `main`. Author SQL with `migrate diff --script`; never mutate a shared DB by hand.
- **RLS is force-enabled on every new public table** by the `ensure_rls` event trigger. A migration without policies is a silent app-wide empty read. Policies ship in the same PR.

---

## Lane A — Charlotte's 26 Aug batch `client-facing` `do first`

Full catalogue: [`2026-08-26-charlotte-feedback.md`](../../client-feedback/2026-08-26-charlotte-feedback.md). All four are specced — she answered Brian's clarifying questions the same morning — and **none is blocking**: she finished the live assessment without them.

### WP-A1 · CH-60 — the document viewer is too short `S`

> *"I would need somehow the search window to collapse as I check the document content so that the window that lets me see the document expands… Right now, it is a narrow window and makes the whole exercise more acrobatic."*

Then, correcting the obvious implementation:

> *"Please keep the search panel in view, it works very well. Simply collapse what can be collapsed so that the window to appreciate the document expands a little bit more than what it is now."*

**So the filter/search row is pinned and the document list gives up the height** — not the other way round. Today `listOpen` collapses the *whole* panel including the search row, which is exactly what she does not want.

Root cause is a height budget, in two places:
- `src/app/(admin)/applications/[id]/assessment/documents/page.tsx:75` — the shell is `h-[calc(100vh-260px)] min-h-[560px]`. On a 800 px laptop viewport that is 540 px total.
- `src/components/admin/document-list-client.tsx:349` — the list panel takes `max-h-[45%]` of that, leaving the viewer ~300 px after the toolbar row.

### WP-A2 · CH-61 — parent details render in raw JSONB key order `S`

Her screenshot shows *City, Email, Title, Mobile, Country, Last Name, Postcode, First Name, Address Line1, Address Line2*. Her order:

> Title → First name → Last name → Mobile → Email → Address line 1; Address line 2 → City → Postcode → Country

Confirmed to apply to **Parent 2 as well**.

Root cause: `DataBlock` (`src/components/admin/application-section-cards.tsx:261`) renders `Object.entries(data)` with no ordering at all. Every section on both the Applicant Data tab and the APPLICATION FORM tab has this — CH-61 and CH-62 are the two places she has noticed it.

### WP-A3 · CH-62 — Assets & Liabilities is "thrown out in an arbitrary way" `M`

> *"Can we have all the property related answers on the APPLICATION FORM reported within the same section and for each property according to the same logical display to mirror the order on the form? (currently the data looks all piled up in an un-orderly way, irrespective of whether it is car-related, transport-related, accommodation-related, savings-related or debt-related, so it is confusing)"*

Her groups: **property → car & public transport → council tax → financial assets → debt**, each with its uploaded-document titles listed beneath it.

Two corrections she made that change the spec:
- **Household-level, not per-parent.** *"No this is not parent specific (only the income section is), the property assets and financial assets are household-related as a whole."* Do not invent a Parent 1 / Parent 2 split here.
- **Branch-aware.** *"If the applicant selects renting, he should have no mortgage field, instead the monthly rent field."*

The list in her first email contained paste artefacts (a duplicated *Mortgage Balance*, a stray *"No"*) — she said so. Build to the rule, not to that list.

Helpfully, `src/lib/documents/slots.ts:40-59` **already carries her exact grouping as comments** (`// Assets & Liabilities — property` / `— car` / `— financial` / `— debt`). The work is largely turning those comments into data.

### WP-A4 · CH-63 — a typed `0` reverts to blank `M` `⚠ has a decision`

> *"When I enter a 0 in a field, the form switched back to a blank field. Could I have a 0 saved in when entered? It is just that the form will show that a nil value was entered to show that it was worked on and reported as nil, rather than the current display which may look like it was left unanswered."*

She is right, and the reason matters: on an assessment worked by one person and reviewed by another, *answered as nil* and *never touched* are different facts and the UI renders them identically.

**The stored value is already `0`.** This is display-only — no data is lost today.

**But it is not a one-line fix.** `hasValue` at `src/components/admin/earner-form-v2.tsx:67` is shared by every admin money cell, and two of them — `rentAddBackOverride` and `councilTaxOverride` — deliberately use blank-as-zero as the **"no override" sentinel** (documented at `assessment-form-v2.tsx:540`, enforced in five places each). Flipping the shared component would turn "no override" into a deliberate **£0 override**, which changes an award.

Options and a recommendation are in the implementation plan (§WP-A4). **Do not ship a global flip.**

> **Note the connection to `F6`.** Lane C carries F6 — *"blank vs deliberate £0 indistinguishable at field level"* — deferred in Epic 13 as having **no current symptom**. CH-63 *is* that symptom, arriving on the assessor side. F6 is the same defect on the parent side. Solve A4 in a way F6 can reuse.

---

## Lane B — Epic 18, the post-assessment lifecycle `largest` `spec exists`

Spec, her words and the answered questions: [`epic-18-post-assessment-lifecycle.md`](epic-18-post-assessment-lifecycle.md). Not repeated here — Lane B is the **build queue** for it.

This is the largest thing in the sprint and the only lane that changes behaviour the client has not yet seen. It replaces the three award-decision buttons (**Award / Qualifies — not awarded / Decline**) which she asked to have removed:

> *"I need to think of something else than that to match the logic of what happens next rather than the buttons, because this is not the logic. Could these be removed for now?"*

**Her five final states**, from the 26 Aug illustration: one intermediary stage (*storing assessment as complete*) then **Locked → New award** · **Closed & archived** · **Closed & purged** · **On the bursary waiting list**.

| WP | Item | Size | Gate |
|---|---|---|---|
| WP-B1 | Draw the state machine — states, transitions, guards, side effects — and put it to her as a diagram with Q11/Q14/Q15 attached | S | none · **do this first** |
| WP-B2 | "Stored as complete" — likely a relabel of `AssessmentStatus.COMPLETED` + the CH-05 strip, not a new state | S | B1 |
| WP-B3 | **New Award** transition: lock the assessment, create/promote the bursary account, activate the admin page, prompt to amend the account reference | L | B1, **Q14** |
| WP-B4 | **On the bursary waiting list** as a state of the assessment | M | B1 |
| WP-B5 | **Closed & archived**, with reopen-to-stored if she wants it | M | B1, **Q15** |
| WP-B6 | **Closed & purged** — destroy documents and application | L | B1, **Q10 reconciliation** · **build LAST** |
| WP-B7 | Remove the three decision buttons | S | **B3 must land first** |

**Two things that must not be done out of order.**

1. **WP-B7 cannot precede WP-B3.** Removing the buttons first leaves no way to finish an assessment at all: nothing locks, no outcome is recorded, no account is created. Held deliberately on 25 Aug for exactly this reason.
2. **WP-B6 is built last, behind the existing two-step confirmation.** It is the one transition whose wrong behaviour cannot be undone. Two things still need reconciling with her **in writing** first:
   - the existing **7-year retention guard** on the GDPR path, and
   - **`audit_logs` is append-only by design** — a purge cannot remove the audit trail, so either the trail must be shown to contain nothing identifying the family, or the guard is revisited with her.

   Her governing clause is the test to apply: *"not destroy everything if we say to parents that we do."* Do not half-delete.

**WP-B3 also fixes CH-49's caveat.** Today the schedule mirror early-returns on `!bursaryAccountId`, so a first-time applicant's Assessment Admin tables stay empty. Creating the account at a defined moment gives the mirror something to write to.

---

## Lane C — the standing engineering residue `not client-facing`

Carried from [`epic-16-post-go-live-residue.md`](./epic-16-post-go-live-residue.md) and [`follow-ups.md`](./follow-ups.md) §2–§3. **Verified still open in the code on 2026-08-26, not assumed.**

### C-code

| WP | Item | Size | Gate | Note |
|---|---|---|---|---|
| WP-C1 | **F1** — retire name masking coherently | M | **D-B, D-C** | **Closes security finding 2.18.** Do first in this lane. |
| WP-C2 | **F12** — inline upload input has no accessible name | S | none | Parent-facing, pre-existing, cheap |
| WP-C3 | **F9** — staff multipart uploads store a NULL content digest | S | none | Hole in duplicate detection on one path |
| WP-C4 | **F10** — family-ID slots key off the member's array index | M | none | **Real data-loss shape** — a deleted member's document can satisfy a later member's requirement |
| WP-C5 | **F8** — `INVESTMENT_PARENT_2` stale-branch guard | M | **D-D** | A wrong guess *suppresses* a legitimate requirement |
| WP-C6 | **F11b / F11c** — hidden-branch data retention | L / M | **D-A** | D-A answering "yes" **deletes F11b entirely** |
| WP-C7 | **F6** — blank vs deliberate £0 at field level | M | WP-A4 | No longer symptomless — see CH-63 |
| WP-C8 | **CH-27** — preview the invitation email before sending, editable for that send | M–L | none | The only Lane C item with a client expectation attached |
| WP-C9 | 🆕 Retire the legacy `/applications/{id}/recommendation` route | S | none | See below |

**WP-C1 is first in this lane because half-retired is worse than either state.** `getApplicationWithDetails` (`src/lib/db/queries/applications.ts:471`) still strips applicant name fields "per finding 2.18 / NM-01..05", and `getApplicationNamesForReveal` (~:556) still carries *"The Assessment tab MUST NOT call this"* — while the feature they guard has been half-retired around them. The next reader cannot tell which behaviour is intended, and the security finding stays open until it is settled.

**WP-C8 (CH-27) carries a design constraint that is the reason it was deferred rather than rushed.** Once a send can be edited, `email_log` must record **the text actually sent**, not the template nominally used — otherwise Sent Emails quietly starts lying about what the parent received, which is worse than not having the feature because she now relies on that page. So: persist the sent subject/body on the log row (new nullable columns), show them flagged as edited, and **never** write a per-send override back to the template. The preview must call the *same* resolver the send does (`resolveInvitationTemplate` + `replaceMergeFields`) — a preview that can disagree with the send is precisely the class of bug CH-28 was.

**WP-C9 is new, found while closing Epic 17.** `/applications/{id}/recommendation` is the v1 route and still exists. It shows the old three-layer header with a blue **Mark Complete**, the old `Applicant Data / Assessment / Recommendation / History` tab row, and *"Assessment must be completed first"* — all of which CH-04, CH-07 and CI-11 removed from the v2 workspace at `/applications/{id}/assessment`. Charlotte is not using it, so it is not urgent, but it is a live second front door to the same application and will confuse whoever finds it. Decide: redirect to the v2 workspace, or delete.

### C-human — checks that need a person, not a test

All were deliberately skipped as timing-, state- or layout-dependent; the repo has no `jsdom`/`@testing-library/react`. **More valuable now than when written, because real parents are in the portal.**

| # | Check | From | Why a human |
|---|---|---|---|
| H1 | Type, kill the network → indicator must read "Not saved"; close the tab and return | B2 | Timing-dependent |
| H2 | Dirty-nav guard: prompt / save / discard / stay | B1 | Timing-dependent |
| H3 | One-time PDF: download once, confirm 410 after | D1 | End-to-end state; consumes the single download |
| H4 | UC repeat-slot UI + the 409 duplicate path | D2 | Unit-tested only |
| H5 | Three-button declaration footer at **mobile widths** (the row wraps) | D4 | Layout |

> **H1, H2 and H5 are parent-facing and three real families are in the portal now.** Run those first, on **nonprod with a throwaway application**. Do not test against Charlotte's or any real family's data.

---

## Lane D — Epic 17 leftovers

| WP | Item | Size | State |
|---|---|---|---|
| WP-D1 | **Q8 — the savings test deducts a different figure than she describes** | — | 🔴 **open, award-affecting** — see below |
| WP-D2 | **CH-41** — property category → 5 | M | 🔶 gated on **Q7** |
| WP-D3 | **CH-32** — BCC on the single-invite step | S | ⬜ buildable now on the decided default (option 1) |
| WP-D4 | **CH-33 / CH-34** — applicant progress view + Assessment Admin forward view | M–L | 🔶 gated on **Q5** (her layout email, promised 23 Aug, still not sent) |
| WP-D5 | **CH-47b** — winter-window tax-year switch | S | ⬜ deferred with reason — **no effect until 10 Nov**, but it is a dated obligation |
| WP-D6 | **CH-48** — route parent replies to fees@ on the test environment | S | 🔶 needs Brian — env var change, not code |

### 🔴 WP-D1 · Q8 is the highest-risk open item in the backlog

Found on 25 Aug while proving CH-37. **Her savings test and the engine's are two different calculations:**

| | Her description | Engine |
|---|---|---|
| Savings | £9,700 raw | £692.86 (÷ 2 children ÷ 7 years) |
| Debt | £8,000 raw | £1,142.86 (÷ 7 years) |
| Deduction | **£19,000** `SAVINGS_CUSHION` | **£6,000** `NOTIONAL_SAVINGS` |
| Result | −£17,300 | **−£6,450** |

Both figures are seeded for category 3, and the £19,000 renders on her form marked *"feeds no calculation"*. Her own *"adjusted saving is calculated correctly"* endorses annualising, which points at annualising the cushion too — **if the cushion is the intended figure at all**.

**Why it did not stop the promotion, and why it still matters.** Both results are negative, so nothing is added back and *her* assessment is unaffected. **For a household with net savings above the cushion, this decides whether anything is added back at all** — i.e. it decides the award.

⚠️ **Her "the calculations are correct" sign-off does not close this.** One family, whose savings test came out negative, cannot exercise the branch where the two calculations diverge. Treat Q8 as open until she answers it directly. It is the single best use of five minutes on the Thu 27 Aug call.

---

## Lane E — operations and commercial `not code`

| WP | Item | Owner | Note |
|---|---|---|---|
| WP-E1 | **Domain name and URL customisation** | Brian + **Alex Skrzynski** (JWF side) | On the Thu 27 Aug agenda. DNS/Vercel, not application work. She has asked what Alex needs to do "over the next few weeks". |
| WP-E2 | **Grant Tracker data migration / integration** | Four-way: Brian, Alex, Charlotte, Grant Tracker | Scheduling call is the deliverable, not the build — see below |
| WP-E3 | £7,000 PO awaiting a colleague's signature | Charlotte | No action. She is chasing it and is aware of the BACS deadline. |

### WP-E2 is new scope and belongs to a future epic, not this one

Her ask:

> *"Ideally, I would love for all active bursaries to have their assessment admin page activated with the data the applicants entered in their rolling-over application in May or in their new application during the winter, and for the corresponding assessment data to also be captured into the new system."*

Driven by two real needs she names: **year-on-year reporting**, and **next year's assessment using the previous one as its benchmark**.

**Why it is not a lane in this sprint.** It is a data-migration programme with an external vendor, an unknown source schema, and a hard functional dependency on Lane B — *"assessment admin page activated"* is precisely the New Award transition Epic 18 defines (Q12). Migrating into a lifecycle that is still being specified means migrating into a shape that then changes.

**Sequence:** Lane B lands the lifecycle → vendor call establishes the source schema → Epic 20 scopes the migration. The only thing owed before then is the meeting.

**Availability offered:** next Thu/Fri (3–4 Sep) or the week of 8 Sep.

---

## Open questions register

Everything currently waiting on someone else. **Her window closes Thursday 27 Aug and reopens 3 September.**

### For Charlotte — ask on the Thu 27 Aug call

| ID | Question | Gates | Priority |
|---|---|---|---|
| **Q8** | Savings test — which deduction (`SAVINGS_CUSHION` £19,000 vs `NOTIONAL_SAVINGS` £6,000), and raw or annualised? | **WP-D1** — award-affecting | 🔴 **highest** |
| **Q7** | Dropping the "with mortgage" rows makes property categories 2, 3, 6, 8, 10 and 12 unreachable — the scale would only ever return 1, 4, 5, 7, 9, 11, 13. Her wording was *"you may want to"*, so this needs a knowing yes | WP-D2 (CH-41) | high |
| **Q11** | Does the outcome email stop existing, or move to the "New award" transition? Today it fires on recording an outcome, which she says is not her process. **If it simply stops, nobody is ever told.** | WP-B3 | high |
| **Q14** | The prompt to *"amend the bursary account reference"* at New Award — is the assessor editing an existing reference, or minting one? References are uniqueness-validated | WP-B3 | high |
| **Q15** | Is **closed & archived** reopenable? Her earlier sketch had "closed" reopenable to *stored*; the illustration does not say, and it now matters which of the two closed states that applied to | WP-B5 | medium |
| **Q10b** | The purge path vs. the **7-year retention guard** and **append-only `audit_logs`** — needs written agreement before WP-B6 is built | WP-B6 | medium (B6 is last anyway) |
| **Q9** | Debt ratio of exactly zero. She puts zero in level 1, reserving ZERO DEBT for negatives — but `calculateDebtOverNdiRatio` floors the exposure at zero, so ZERO DEBT is unreachable and every debt-free household reads "SMALL DEBT LEVEL". Remove the floor, or move zero onto ZERO DEBT? | nothing (CH-40 shipped without it) | medium |
| **Q5** | Her Assessment Admin layout email, promised 23 Aug, still not sent | WP-D4 (CH-33/34) | medium |
| **Q4** | BCC option 1 vs 2 (asked 23 Aug) | WP-D3 — default decided, buildable without her | low |
| **Q3** | Her improved debt-status label wordings — hers to draft, September per her own note | nothing | low |
| **Q6** | Her £89,257.14 "stops qualifying" figure does not reconcile — worked properly the answer is £98,001 for Whitgift 2026-27. Confirm the intent, not the number | nothing | low |

### For Brian — no client input needed

| ID | Question | Gates |
|---|---|---|
| **D-A** | Should a collapsed branch preserve what was typed? Today: **yes**. **Recommendation: keep "yes"** — it makes D3's rule guards the correct permanent design and **deletes F11b entirely**. "No" means unmounting *plus* `shouldUnregister: true` across 10 `useForm` call sites, and risks swapping one data-loss complaint for another from a client who has already lost work three times | WP-C6 |
| **D-B** | Does the queue keep its masked-by-default name toggle? | WP-C1 |
| **D-C** | Do `NAME_REVEAL` audit rows still earn their keep? C4a writes one on **every** detail-page load | WP-C1 |
| **D-D** | How should a document rule read state from outside its own section? `INVESTMENT_PARENT_2` gates on `parent2OwnsInvestments` (in the blob) but renders under `!isSoleParent` (derived outside it). **A wrong guess suppresses a legitimate requirement** — the harmful direction | WP-C5 |
| **D-E** | 🆕 CH-63 — does the "no override" sentinel move to an explicit control, or do the two override fields opt out of the new zero behaviour? | WP-A4 |
| **D-F** | 🆕 WP-C9 — redirect the legacy recommendation route, or delete it? | WP-C9 |

---

## Suggested order

Sized against the one hard constraint: **her availability ends Thursday and resumes 3 September.**

1. **Wait for the second live assessment's feedback** (evening of 26 Aug) before starting Lane A. It may add to it, and Lane A is small enough that re-batching costs nothing.
2. **Thu 27 Aug call** — ask **Q8** first, then Q7, Q11, Q14, Q15. Settle WP-E1 (domain) and book the Grant Tracker call. This is the sprint's highest-leverage hour, and everything else is scheduled around it.
3. **Lane A** (WP-A1 → A4) — display-only, client-facing, and the only work she is actively waiting on. A1/A2 are `S` and independent; A3 shares A2's mechanism; **A4 needs D-E answered first.**
4. **C-human H1, H2, H5** — hours, not days, on paths three real families are walking now.
5. **WP-B1** — draw the state machine and put it to her. One round of a diagram is much cheaper than building a guess at a workflow that governs awards and deletions. Do this while her answers are fresh.
6. **WP-C1 (F1)** once D-B and D-C are answered — closes security finding 2.18.
7. **WP-C2, WP-C3, WP-C9** — all `S`, all self-contained, good filler between larger pieces.
8. **Lane B proper** (B2 → B3 → B4 → B5 → B7), in that order. **B6 last, and only after Q10b is agreed in writing.**
9. **WP-C8 (CH-27)** — she has been told it is coming rather than imminent, but it should not sit indefinitely.
10. **WP-C4, WP-C5, WP-C6, WP-C7** as their decisions land. **WP-D2 (CH-41)** when Q7 comes back; **WP-D4** when Q5 arrives.
11. **WP-D5 (CH-47b)** before **10 Nov** — the only dated obligation in the sprint.

---

## Out of scope

- **Grant Tracker migration build** — Epic 20, after the vendor call. Only the meeting is owed here.
- **Anything Charlotte raises next** — starts its own thread and follows fix → validate → staging → promote.
- **A production login for staff other than Charlotte** — considered on 22 Aug and **declined** (Brian). Standing consequence: production changes are verifiable at the database and platform level but **not through the UI**, and direct SQL fixes bypass the app's audit log.
- **Commercial change** — this sprint is remediation and previously-agreed work under the existing Build Fee, the same stance carried from Epic 14 onward. The one genuinely new ask (Grant Tracker) is deliberately held out of it.
