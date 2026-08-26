---
title: "Epic 19 — implementation plan and build handover"
status: open
opened: 2026-08-26
opened_by: Brian Wagner
depends_on:
  - ./epic-19-assessor-ux-and-lifecycle.md
  - ../../client-feedback/2026-08-26-charlotte-feedback.md
---

# Epic 19 — implementation plan

**This document is the handover.** It assumes no prior context beyond the repo. Scope, sizing and gating live in [`epic-19-assessor-ux-and-lifecycle.md`](epic-19-assessor-ux-and-lifecycle.md); this is how to build it, prove it, and get it to staging.

Read §0 and §1 before touching code. Then work the tranche you have been given.

---

## §0 · Ground rules — read once, apply always

### The git path is not optional

`CLAUDE.md` governs and overrides any habit to the contrary.

```bash
git checkout staging && git pull
git checkout -b feature/<short-kebab-name>     # or fix/ or chore/
# … work, focused commits, Conventional Commits style …
gh pr create --base staging
```

- **Never commit to `main` or `staging` directly.** Branch from `staging`, PR to `staging`.
- **Only Brian promotes `staging` → `main`.** Do not open or merge that PR without an explicit instruction naming the promotion.
- Never `--no-verify`, never force-push, never merge your own PR without standing authority for that item.

### The three gates that actually fail CI

```bash
rm -f tsconfig.tsbuildinfo && npx tsc --noEmit   # stale buildinfo silently skips new files
npm test                                          # vitest run
npx prisma format --check                         # CI gate that no local command runs by default
```

Lint is `continue-on-error` in CI — **a green CI does not mean lint-clean**, and lint being clean does not mean CI passes. Only typecheck and test gate a merge.

> ⚠️ `tsconfig.json` sets no `target`, so the default is **ES5** and iterating a `Set`/`Map` is a `TS2802` error. Use `Array.from()`. Local `tsc` has passed while CI failed on exactly this.

### Database facts that bite

- Migrations apply to **nonprod** automatically on merge to `staging`, and to **prod** on merge to `main` (`db-push.yml`). The Vercel build does **not** apply them.
- Author migration SQL with `prisma migrate diff --script`. **Never** mutate a shared database by hand. Never `migrate reset` against staging or prod.
- **RLS is force-enabled on every new public table** by the `ensure_rls` event trigger. A migration that creates a table without policies produces silent, app-wide empty reads. Policies ship in the same PR — patterns in `20260519163000` and `20260710205004`.
- `audit_logs` is **append-only**; `DELETE` is denied (42501) even under `service_role`. A cleanup that deletes audit rows rolls back the entire transaction.
- Prisma CLI reads `.env`; the app and seeds read `.env.local`. **Verify the project ref before any write.**

### Production is no longer empty

Epic 17 leaned repeatedly on "prod holds zero assessments, so nothing is retro-changed". **That is no longer true** — Charlotte completed a live assessment on 26 Aug and a second the same evening.

Before promoting anything that changes a calculation, a band, a category or a stored figure: **query the live rows and state the blast radius in the PR body.** If the answer is "n families would see a different number", that goes to Brian before the promotion, not after.

### Testing in a repo with no jsdom

There is no `jsdom` and no `@testing-library/react`. **Do not add them mid-sprint** — a `package.json` change with branches in flight is how Epic 13 lost a day.

The established pattern is to **extract the decision into a pure exported function and test that**, leaving the component as a thin renderer. `isRenderableObject` in `application-section-cards.tsx:71` exists for exactly this reason, and its test (`__tests__/section-cards-null-guard.test.ts`) is the model to copy. Every WP below names its testable seam.

---

## §1 · Tranches and PR shape

Six tranches. Each is independently mergeable and independently promotable. **Do not batch a promotion across tranches** — Charlotte is on production and each fix follows its own path.

| Tranche | Contents | Branch | Depends on |
|---|---|---|---|
| **T1** | WP-A1 (CH-60) · WP-A2 (CH-61) · WP-A3 (CH-62) | `feature/ch60-62-assessor-display` | nothing |
| **T2** | WP-A4 (CH-63) | `fix/ch63-zero-not-blank` | **D-E answered** |
| **T3** | C-human H1, H2, H5 | *no branch — findings only* | nothing |
| **T4** | WP-B1 (state machine diagram + questions) | `docs/epic-18-state-machine` | nothing |
| **T5** | WP-C1 (F1) · WP-C2 (F12) · WP-C3 (F9) · WP-C9 (legacy route) | one branch each | C1 needs **D-B, D-C**; C9 needs **D-F** |
| **T6** | Lane B build (B2 → B3 → B4 → B5 → B7), B6 last | one branch per WP | T4 landed; B3 needs **Q14**; B6 needs **Q10b** |

**T1 can be one PR.** A2 and A3 share a mechanism and splitting them would mean building the seam twice. A1 is independent but small and touches adjacent surfaces, so it rides along rather than earning its own review cycle.

**Everything else is one PR per WP.** Epic 13's stacked-PR experiment cost more in reconciliation than it saved.

---

## §2 · Tranche T1 — the assessor display batch

Branch: `feature/ch60-62-assessor-display`. Target: `staging`. All three are **display-only**; none touches a computed value. If any of them turns out to, stop and re-scope — see §0, "do not regress the model she just signed off".

### WP-A1 · CH-60 — give the document viewer its height back

**Her constraint, which rules out the obvious fix:** *"Please keep the search panel in view, it works very well. Simply collapse what can be collapsed."* The search row stays pinned. The **document list** is what gives up height.

**Files**
- `src/app/(admin)/applications/[id]/assessment/documents/page.tsx:75`
- `src/components/admin/document-list-client.tsx` (~:349 list panel, ~:453 viewer)

**Today's height budget.** The shell is `h-[calc(100vh-260px)] min-h-[560px]`; the list panel inside takes `max-h-[45%]`; the toolbar row takes the rest of the top. On a 800 px viewport the viewer ends up around 300 px — her "narrow window".

**Change**

1. **Split the collapsible panel.** The filter/search row currently lives *inside* the `listOpen` conditional, so collapsing hides it. Lift the filter row out so it renders unconditionally; leave only the scrollable `<ul>` of documents and the count footer inside the toggle.
2. **Shrink the list's share.** `max-h-[45%]` → `max-h-[30%]` when open. The list already scrolls internally, so this costs visible rows, not access.
3. **Reclaim page chrome.** `calc(100vh-260px)` → `calc(100dvh-200px)`. `dvh` is correct on mobile browsers with retracting toolbars; measure the actual chrome above the container before settling on 200 and adjust to what is really there.
4. **Default the list closed** on this tab, since the pinned filter row plus the existing dropdown and Prev/Next (`[` / `]`) already give her navigation without it.

**Acceptance**
- The filter input and the verified-only control are visible whether the list is open or closed.
- With the list closed, the viewer occupies the full height below the toolbar.
- With the list open, the viewer is still meaningfully taller than today.
- No horizontal scroll at 1280 px or 1440 px.

**Testable seam:** none worth extracting — this is pure layout. **Prove it in the browser**, at 1280×800 and 1440×900, with a real multi-page PDF. Screenshot before and after into the progress board.

### WP-A2 · CH-61 — parent details in her order

**Files**
- `src/components/admin/application-section-cards.tsx` — `DataBlock` (:246) and a new ordering module
- Consumed by `src/app/(admin)/applications/[id]/page.tsx` (Applicant Data) and `.../assessment/application-form/page.tsx` (APPLICATION FORM) — **both surfaces get the fix from one change**, which is why the component was extracted in the first place

**Root cause.** `DataBlock` does `Object.entries(data)` (:261) with no ordering. JSONB preserves insertion order, which is form-field-registration order, which is arbitrary from a reader's point of view.

**Change.** Add a field-order spec and apply it in `DataBlock`.

```ts
// src/lib/admin/section-field-order.ts  (new)

/**
 * Display order for a section's fields, keyed by the object path the field
 * sits at. Keys not listed keep their natural (JSONB) order and sort AFTER
 * every listed key — so an added schema field appears rather than vanishing.
 */
export const FIELD_ORDER: Record<string, readonly string[]> = {
  // CH-61 — her order, verbatim, applied to both parents.
  parentContact: [
    "title", "firstName", "lastName",
    "mobile", "telephone", "telephone2", "email",
    "addressLine1", "addressLine2", "city", "postcode", "country",
  ],
  // …
};

export function orderEntries(
  entries: [string, unknown][],
  spec: readonly string[] | undefined
): [string, unknown][] { /* stable: listed keys in spec order, then the rest as-is */ }
```

**The rule that must not be broken: unlisted keys are never dropped.** A future schema field that nobody adds to the spec must still render. Sort listed keys first in spec order, then append everything else in its existing order, stably.

**Wiring.** `DataBlock` needs to know which spec applies. It already receives `pathPrefix`; resolve the spec from the *leaf* container name (`parent1Contact` and `parent2Contact` both resolve to the `parentContact` spec) rather than the full path, so Parent 2 gets it for free — which is what she asked for.

**Her order maps to these schema keys** (`src/lib/schemas/parent-details.ts:38-57`):

| Her label | Key |
|---|---|
| Title | `title` |
| First name | `firstName` |
| Last name | `lastName` |
| Mobile | `mobile` (then `telephone`, `telephone2` — she did not name these; keep them adjacent to mobile) |
| Email | `email` |
| Address line 1; address line 2 | `addressLine1`, `addressLine2` |
| City | `city` |
| Postcode | `postcode` |
| Country | `country` |

**Acceptance**
- Parent 1 and Parent 2 contact blocks both render in her order on **both** tabs.
- A key absent from the spec still renders, after the ordered ones.
- A key in the spec but absent from the data renders nothing (no "Not provided" ghost row that was not there before).

**Testable seam:** `orderEntries` — pure, exported, unit-tested. Cover: exact order, unlisted-key passthrough, missing-key tolerance, empty spec, empty entries.

### WP-A3 · CH-62 — group Assets & Liabilities by subject

**The spec is her rule, not her list.** Her first email's list had paste artefacts and she said so. Build to: *"all the property related answers… within the same section and for each property according to the same logical display to mirror the order on the form"*, grouped by subject, **household-level** (no per-parent split — *"only the income section is"* parent-specific).

**Files:** the same ordering module plus a grouping layer, and `SectionDataCard` to render group headings.

**The groups already exist as comments** in `src/lib/documents/slots.ts:40-59` (`— property` / `— car` / `— financial` / `— debt`). Turn them into data so the field grouping and the document grouping cannot drift.

**Grouping, with the real schema keys** from `src/lib/schemas/assets-liabilities.ts`:

| Group | Fields, in form order | Document slots |
|---|---|---|
| **Property** | `propertyOwnership` · `residenceValue` · `hasMortgage` · `mortgageBalance` · `monthlyMortgageRepayment` · `rentAgreementType` · `monthlyRent` · `hasOtherProperties` · `otherProperties[]` (each: `address`, `postcode`, `value`, `mortgageBalance`, `monthlyRepayment`, `usedAsRental`) · `hasChargingOrder` · `chargingOrderAddress` · `chargingOrderPostcode` · `chargingOrderValue` | `MAIN_MORTGAGE_STATEMENT`, `TENANCY_AGREEMENT`, `HOUSING_BENEFIT_LETTER`, `RELATIVE_LETTER` |
| **Car & public transport** | `carOwnership` · `carValue` · `carMonthlyLease` · `usesPublicTransport` · `publicTransportMonthly` · `otherPossessionsValue` | `CAR_LEASE_AGREEMENT` |
| **Council tax** | `councilTaxDocumentId` | `COUNCIL_TAX` |
| **Financial assets** | `totalCashBalance` · `investmentsValue` · `parent1OwnsInvestments` · `parent2OwnsInvestments` | `BANK_STATEMENT_CURRENT_*`, `BANK_STATEMENT_SAVINGS_*`, `INVESTMENT_*` |
| **Debt** | `hasPersonalDebt` · `creditCardBalance` · `bankOverdraft` · `loansToAgencies` · `loansToFriendsFamily` · `schoolFeesOwed` | `CREDIT_CARD_STATEMENT`, `LOAN_STATEMENT`, `LOAN_AGREEMENT`, `OTHER_DEBT_DOCUMENT` |
| *(ungrouped)* | `documentsConfirmed` and anything new | — |

**Branch awareness.** *"If the applicant selects renting, he should have no mortgage field, instead the monthly rent field."* The blob may carry stale values from a branch the applicant later switched away from — the exact stale-branch class D3/F7 fixed for document rules. **Suppress display of the off-branch fields**: when `propertyOwnership === "RENT"`, hide `hasMortgage`/`mortgageBalance`/`monthlyMortgageRepayment`; when `"OWN"`, hide `rentAgreementType`/`monthlyRent`.

⚠️ **Suppression is the dangerous direction.** A field hidden by a wrong guard is data the assessor never sees. Suppress **only** on the two explicit `propertyOwnership` values, never on `undefined` — an unanswered ownership question must show everything present.

**Document titles per group.** `SectionDocumentTitles` in `.../assessment/application-form/page.tsx:43` currently lists a section's documents once at the bottom. Split it per group using the slot→group map. `groupDocumentsBySection` (`src/lib/documents/section-grouping.ts:61`) stays as-is; add a second, finer grouping beside it.

**Acceptance**
- Assets & Liabilities renders under five headings in the order above.
- Each property in `otherProperties[]` renders as its own labelled sub-block in form order.
- A renting household shows rent fields and no mortgage fields; an owning household the reverse; an unanswered household shows everything present.
- Each group lists only its own uploaded document titles; the "open in Uploaded Documents" link still works from each.
- No field present in the blob disappears from the page unless the branch rule above deliberately hides it.

**Testable seam:** the grouping function — `groupSectionFields(sectionType, data)` returning `{ groupLabel, entries }[]`. Unit-test: every schema key lands in exactly one group; an unknown key lands in *ungrouped* and is never dropped; both branch cases; `undefined` ownership suppresses nothing.

> **Cross-check to run before opening the PR:** enumerate every key in `assetsLiabilitiesSchema` and assert the union of the group specs plus *ungrouped* covers it. A key silently missing from every group is the failure mode this whole WP exists to prevent.

### T1 validation

| Check | How |
|---|---|
| `npm test` | new seams covered; existing suite unbroken |
| `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` | clean |
| `npx prisma format --check` | clean (no schema change expected — confirm) |
| Applicant Data tab renders | on nonprod, against a **real-shaped** application with 3 properties |
| APPLICATION FORM tab renders | same application; both tabs must agree |
| The CH-57 null-array case still does not crash | an application with an unfilled multi-doc slot (`[null, null, null]`) |
| Document viewer height | browser, 1280×800 and 1440×900, real multi-page PDF |
| No migration in this tranche | `git diff --stat prisma/` empty |

---

## §3 · Tranche T2 — WP-A4 · CH-63, zero is a value

**Blocked on D-E.** Do not start without an answer.

**The problem.** `src/components/admin/earner-form-v2.tsx:67`:

```ts
const hasValue = (v: number) => (allowNegative ? v !== 0 : v > 0);
```

Shared by every admin money cell. `onBlur` (:96) resets the display to `""` whenever `hasValue` is false, so a typed `0` vanishes. **The stored value is already `0`** — this is display-only, no data is lost — but the assessor cannot distinguish *answered as nil* from *never touched*, which is her whole point.

**The collision.** `rentAddBackOverride` and `councilTaxOverride` use blank-as-zero as the **"no override" sentinel**, documented at `assessment-form-v2.tsx:540` and enforced in five places each:

| Purpose | Lines |
|---|---|
| State init from a nullable column | `:542`, `:548` |
| Save path (autosave) | `:597`, `:600` |
| Save path (explicit) | `:794`, `:797` |
| Render guard ("override active?") | `:1365`, `:1426` |

A global flip turns *no override* into a deliberate **£0 override** — which changes an award. This is why CH-63 is `M`, not `S`.

### The two options

**Option 1 — give the override fields an explicit "no override" control (recommended).**

Add a checkbox or a two-state control per override ("Use calculated value" / "Override"), and let the £ field mean exactly what it says. `null` in the column keeps meaning "no override"; `0` becomes a legal override value.

- Cost: two small UI additions, five call sites each, one nullable-state refactor.
- Benefit: the sentinel disappears. The current design cannot express "override to £0" **at all** — that is a latent bug independent of CH-63, and this closes it.
- Risk: touches the save paths for two award-affecting fields. Tests must pin all three states (no override / £0 override / £n override) end to end.

**Option 2 — opt the two override fields out via a prop.**

Add `treatZeroAsEmpty?: boolean` (default `false` after the flip) and pass `true` at the two override call sites.

- Cost: minimal.
- Benefit: ships in an afternoon.
- Risk: preserves a sentinel that cannot express £0, and leaves two fields behaving differently from every other money cell on the same page with nothing on screen to explain why. That is the "half-retired" shape WP-C1 exists to clean up elsewhere.

**Recommendation: Option 1.** The sentinel is exactly the kind of thing that bites later, she has just given a reason to touch these fields, and the inability to override to £0 is a real gap. If the sprint is tight, Option 2 with a `TODO` referencing this section is defensible — but it is a deferral, not a fix.

**Also in scope either way**

- `allowNegative` is currently passed by **no consumer** (`grep -rn allowNegative src/components/admin/` → definition only). Either wire it where the manual income-adjustment line needs it, or note it as dead. Do not leave it ambiguous.
- Make the same distinction visible on the **read-only** side: `fmtMoney` (`assessment-form-v2.tsx:210`) renders `null` as `—`, which is right. Confirm a stored `0` renders `£0.00` and not `—` anywhere on the assessment or recommendation surfaces.
- **F6 (WP-C7) is the same defect on the parent side.** Whatever seam A4 creates, shape it so F6 can reuse it.

**Acceptance**
- Typing `0` into any assessment money cell leaves `0` on screen after blur, and after a reload.
- The two override fields can express all three of: no override · override to £0 · override to £n — and each round-trips through save and reload.
- No stored value changes for any existing assessment. **Prove this against the live production rows before promoting.**

**Testable seam:** `hasValue` and `parseCurrency`, exported and unit-tested. Plus a pure `resolveOverride(state) → number | null` covering the three states, so the save-path logic is testable without a DOM.

**Validation:** unit tests, then a browser pass on nonprod against a throwaway assessment — enter `0`, save, reload, confirm. Then re-run Charlotte's own AJ figures through the calculator and confirm the output is **byte-identical** to what she signed off.

---

## §4 · Tranche T3 — the human checks

No branch, no code. **Findings go into the progress board.**

Run on **nonprod, with a throwaway application**. Do not test against Charlotte's data or any of the three real families.

| # | Check | Method |
|---|---|---|
| **H1** | Autosave indicator under network failure | Type into a section; DevTools → Network → Offline; confirm the indicator reads **"Not saved"**; close the tab; reopen; confirm what survived |
| **H2** | Dirty-nav guard | Type; navigate away; walk each branch — prompt appears, *save* saves, *discard* discards, *stay* stays |
| **H5** | Declaration footer at mobile widths | 390 px and 360 px; the three-button row wraps; all three remain reachable and labelled |

H3 (one-time PDF 410) and H4 (UC repeat-slot + 409) are lower priority — H3 **consumes the single download**, so run it only on a throwaway whose PDF nobody needs.

**Deliverable:** a table in `epic-19-progress.md` with pass/fail and a screenshot for each. A failure becomes its own WP; it does not get fixed inline.

---

## §5 · Tranche T4 — WP-B1, the state machine

**The highest-value hour in Lane B, and it is not code.**

Produce a diagram — states, allowed transitions, what each transition locks, and the side effect of each — and put it to Charlotte with **Q11, Q14, Q15** attached. One round of a diagram is much cheaper than building a guess at a workflow that governs awards and deletions.

**Inputs:** `epic-18-post-assessment-lifecycle.md` (her words, her illustration, Q10/Q12/Q13 already answered), `docs/product/state-model.md` (the canonical 3-lifecycle model this revises), and `docs/diagrams/bursary-application-flow.drawio`.

**Must be explicit about, per transition:**

| Dimension | Why |
|---|---|
| What locks | She said New Award means *"can't be amended again"* — say what that forbids, concretely |
| Whether an email fires | **Q11.** Today the outcome email fires on recording an outcome, which she says is not her process. If it simply stops, **nobody is ever told** |
| Whether a bursary account is created | **Q12 answered** — at New Award, and that also activates the admin page |
| Whether it is reversible | **Q15** for archived; her sketch had closed → stored; the illustration is silent |
| What it destroys | **Q10 answered** — purge destroys documents and the application. Reconcile with the 7-year retention guard and append-only `audit_logs` (**Q10b**) |

**Deliverable:** the diagram committed under `docs/diagrams/`, plus a short email to her. Not a PR that changes behaviour.

> **The sequencing rule for the whole of Lane B, restated because it is easy to get wrong:** **WP-B7 (remove the three buttons) cannot land before WP-B3 (New Award).** Removing them first leaves no way to finish an assessment at all — nothing locks, no outcome is recorded, no account is created.

---

## §6 · Tranche T5 — the residue

One branch per WP. All are non-client-facing; none is urgent; all are self-contained.

### WP-C1 · F1 — retire name masking coherently `M` `blocked: D-B, D-C`

**Do this one first in the lane — it closes security finding 2.18.**

The codebase currently contradicts itself:
- `src/lib/db/queries/applications.ts:471` still strips applicant name fields *"per finding 2.18 / NM-01..05"*
- `getApplicationNamesForReveal` (~:556) still carries *"The Assessment tab MUST NOT call this"*
- the queue still masks by default
- the PRD still specifies the toggle (`docs/product/prd/04-admin-round-management.md:7`, AC-03)

**Half-retired is worse than either state** — the next reader cannot tell which behaviour is intended. Decide the end state (D-B, D-C), make the code say **only** that, update the PRD, and mark finding 2.18 **superseded** rather than leaving it open.

### WP-C2 · F12 — inline upload input has no accessible name `S`

`src/components/portal/file-upload.tsx` associates a `<label htmlFor>` in the block variant (`:416` → input `:433`) and the multi-file variant (`:688` → input `:706`), but the **inline** variant's input (`:360`) is `sr-only` with **no `<label>` at all** — only `InlineDropButton` carries an `aria-label`. A screen-reader user reaching the input directly gets no accessible name.

> Line numbers verified 2026-08-26. `follow-ups.md` cites ~:348/~:401/~:658, which have drifted; use the numbers here, and re-verify before editing — the reliable check is `grep -n "htmlFor\|sr-only" src/components/portal/file-upload.tsx`, which should show three `sr-only` inputs against only two `htmlFor`s. When that count reaches three-and-three, the WP is done.

Parent-facing, pre-existing, cheap. Pair with an a11y pass over the other two variants while in there.

### WP-C3 · F9 — staff uploads store a NULL content digest `S`

`/api/admin/documents` (edit-on-behalf) stores `content_digest` NULL because D2 computes the digest in the presigned confirm endpoint only. Staff uploads are therefore neither duplicate-checked nor checkable against applicant uploads. Low urgency, but a hole on one path.

### WP-C9 · retire the legacy recommendation route `S` `blocked: D-F`

`src/app/(admin)/applications/[id]/recommendation/` is the v1 route and still live. It shows the old three-layer header with a blue **Mark Complete**, the old four-tab row, and *"Assessment must be completed first"* — all removed from the v2 workspace by CH-04, CH-07 and CI-11. Charlotte is not using it; it is a second front door to the same application that will confuse whoever finds it.

Redirect to `/applications/{id}/assessment` or delete outright (**D-F**). If deleting, check `__tests__/` and `actions.ts` in that directory for anything the v2 route still imports.

### Also in this lane, when their decisions land

**WP-C4 (F10)** — family-ID slots key off the member's array index; removing a member shifts later members onto slots holding the removed member's documents, so **a deleted member's document can silently satisfy a later member's requirement**. Also: 7 `FAMILY_ID_*` documents are already orphaned on nonprod (one named `PASSEPORT.docx.pdf` against a member with no doc-ids at all) and still show on the assessor's list. Confirm the current blast radius before sizing — the household model has moved since this was written.

**WP-C5 (F8)** — `INVESTMENT_PARENT_2` gates on `parent2OwnsInvestments` (in the blob) while its control renders under `!isSoleParent` (derived outside the blob). **A wrong guess suppresses a legitimate requirement** — a document silently never asked for, the harmful direction. D3 deliberately left it rather than guess. Needs **D-D**.

**WP-C6 (F11b/F11c)** — needs **D-A**. If D-A answers "yes" (the recommendation), **F11b is deleted, not built**.

**WP-C7 (F6)** — build on whatever seam WP-A4 creates.

**WP-C8 (CH-27)** — the invitation preview. Design constraint restated because it is the whole reason this was deferred rather than rushed: once a send can be edited, `email_log` must record **the text actually sent**, or Sent Emails starts lying about what the parent received. New nullable columns for sent subject/body; shown flagged as edited; **never** write back to the template. The preview must call the *same* resolver the send does (`resolveInvitationTemplate`, `replaceMergeFields` in `src/lib/email/merge.ts`) — a preview that can disagree with the send is exactly the class of bug CH-28 was. Both invite paths (quick invite and invite-from-contact) are in scope; she uses both.

---

## §7 · Tranche T6 — Lane B build

Do not start before T4 has been sent to Charlotte and answered. Order: **B2 → B3 → B4 → B5 → B7**, then **B6 last**.

**The four modules Lane B rewires** (verified present 2026-08-26):

| Module | What it does today |
|---|---|
| `src/lib/applications/set-outcome-core.ts` | Recording an outcome **sends the matching outcome email** — the behaviour **Q11** decides the fate of |
| `src/lib/applications/account-promotion.ts` | Recording an outcome **creates / promotes the bursary account** — moves to the New Award transition (**Q12 answered**) |
| `src/app/(admin)/applications/[id]/assessment/actions.ts` | `completeAssessmentAction` mirrors onto the schedule but **early-returns on `!bursaryAccountId`** — the CH-49 caveat B3 fixes |
| `src/lib/applications/reference.ts` | Uniqueness-validated bursary account references — **Q14**'s subject |

Each has a sibling `__tests__/` directory; extend those rather than starting new suites.

| WP | One-line brief |
|---|---|
| **B2** | "Stored as complete" — likely a relabel of `AssessmentStatus.COMPLETED` + the CH-05 strip's COMPLETE state, not a new state. Confirm before adding an enum value. |
| **B3** | New Award: lock the assessment · create/promote the bursary account (`account-promotion.ts`) · activate the admin page · prompt to amend the account reference (**Q14**; references are uniqueness-validated, `applications/reference.ts`). Also fixes CH-49's caveat — `completeAssessmentAction` early-returns on `!bursaryAccountId`, which is why first-time applicants' Assessment Admin tables stay empty. |
| **B4** | Waiting list as a state of the assessment, alongside the other finals. |
| **B5** | Closed & archived; reopen-to-stored iff **Q15** says so. |
| **B7** | Remove the three decision buttons. **Only after B3.** |
| **B6** | Closed & purged. **Last.** Behind the existing two-step confirmation. Requires **Q10b** agreed in writing: the 7-year retention guard, and append-only `audit_logs` meaning a purge cannot remove the trail. Her test to apply: *"not destroy everything if we say to parents that we do."* |

**Enum warning that applies to every WP in this tranche:** never write a new enum value to production before the code that knows it is deployed — the running Prisma client is generated from the old schema and throws on deserialising an unknown member. And before widening any Prisma enum, `grep` for `case "<value>"`: four modules once kept private `group → school-year` switches with `default: return null`, so a new value fell through to a fallback horizon **with no error**.

---

## §8 · Definition of done

A WP is done when **all** of these hold. Not before.

1. **Code** — branch off `staging`, focused Conventional Commits, PR targeting `staging`.
2. **Green** — `npm test`, `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit`, `npx prisma format --check`, and CI green on the PR.
3. **Covered** — the WP's named testable seam has unit tests, including the failure mode the WP exists to prevent.
4. **Proven in a browser** where the change is visual or stateful — on nonprod, against a throwaway, never against real family data. Screenshot into the progress board.
5. **Blast radius stated** — if the change touches a calculation, band, category or stored figure, the PR body says how many live rows change and how. "None" is an acceptable answer; silence is not.
6. **Recorded** — `epic-19-progress.md` updated with what shipped, what was verified, and anything the work surfaced that nobody asked about.
7. **On `staging`** — merged, and the migration (if any) confirmed applied to nonprod by `db-push.yml`.
8. **Handed to Brian for promotion.** Do **not** open `staging → main`. Report the PR and say plainly that it is awaiting promotion.

### What "validated on staging" means concretely

Merging to `staging` triggers the nonprod migration run and the aliased preview deploy. After the merge:

```bash
# confirm the migration actually applied — the Vercel build does NOT do this
npx prisma migrate status        # against nonprod
```

Then open the staging alias and walk the specific behaviour the WP changed — not a smoke test, the actual path Charlotte would take. Epic 13 shipped a sprint whose previews were all un-browsable because migrations had not applied; the browser was the only place that class showed up, and it showed up as an opaque digest.

---

## §9 · Traps this repo has actually sprung

Not hypotheticals. Each of these cost real time.

| Trap | Guard |
|---|---|
| Local `tsc` passes, CI fails | No `target` in `tsconfig.json` → ES5 → iterating a `Set`/`Map` is `TS2802`. Use `Array.from()`. And `rm -f tsconfig.tsbuildinfo` first — a stale one skips new files. |
| A migration ships without RLS policies | `ensure_rls` force-enables RLS on every new public table → silent empty reads app-wide. Policies in the same PR. |
| A cleanup script rolls back entirely | `audit_logs` denies `DELETE` (42501) even under `service_role`. Skip audit rows in any cleanup transaction. |
| Prisma CLI writes to the wrong database | The CLI reads `.env`; the app and seeds read `.env.local`. Verify the project ref before any write. |
| Worktree agents type-check against the wrong Prisma client | Worktree `node_modules` is only *sometimes* isolated; `prisma generate` can rewrite a shared client → phantom type errors. **Trust CI, not local `tsc`, while schema PRs are in flight.** |
| A widened enum silently changes behaviour | `grep 'case "<value>"'` before widening; four modules once had duplicated switches with `default: return null`. |
| `prisma format --check` fails CI after a column rename | It reflows schema alignment. Run it locally before pushing. |
| A "fix" is reported done when it is only on `staging` | Charlotte is on **production**. Done means promoted, and only Brian promotes. |
| Emailed one-time links are already spent on arrival | JWF is Exchange Online; Safe Links GETs every link. Verify tokens on **submit**, never on load. |
| A staff/admin login created by raw SQL 500s on sign-in | Never `INSERT` into `auth.users` by hand — NULL token columns break GoTrue. Use the `/add-admin` skill. |
