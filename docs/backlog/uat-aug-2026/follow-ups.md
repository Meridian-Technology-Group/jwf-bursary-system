---
title: "Epic 13 — outstanding work after Sprint 01"
status: open
severity: medium
area: portal, assessment, uploads, references, admin
opened: 2026-08-14
opened_by: Brian Wagner
depends_on:
  - ./sprint-01-implementation-plan.md
  - ./epic-13-uat-feedback.md
---

# Epic 13 — outstanding work after Sprint 01

Sprint 01 delivered every work package in the epic (waves A–E). This is what is
**left**: items discovered while building, decisions still open, and checks that
need a human rather than a test.

Nothing here blocks Charlotte's re-test. Everything here was found *because* the
sprint went looking, so it is the useful residue of the work rather than a list
of things that went wrong.

**How to read the sizes:** S ≤ half a day · M ~1 day · L 2 days+.

---

## 0. Can Charlotte resume testing once the stack merges?

**Yes.** Every blocker she reported is fixed, and none of the follow-ups below
stands between her and a submitted application. But three things gate it, and
only one of them is code.

### Gate 1 — merging the stack (the real work)
22 stacked PRs must merge **in order**, and three sibling pairs need reconciling
where two branches touched one file: `file-upload.tsx` (D2 + F2), and the three
siblings off A2 (A3 / A4 / A6). Migrations apply to nonprod automatically on
merge to `staging`, in stack order.

### Gate 2 — a UAT pass by us first (the highest-value step)
**Six behaviours are deliberately unverified in a browser** (§3). They are
exactly the paths she will exercise in her first ten minutes: uploading a large
file, autosave, the dirty-nav prompt, the one-time PDF, the UC repeat slots, the
submit footer. If one is broken she is blocked again, and the sprint's credit is
spent. Walk §3 on the preview deploy before handing back.

### Gate 3 — two follow-ups are the *same class* that blocked her
**F7** and **F8** are both stale-branch document requirements — the exact defect
D3 fixed in six sibling rules, and the same shape as CF-17 and CF-21: an
invisible requirement with nothing on screen to satisfy it.

- **F7 is a one-line fix.** Do it before she tests.
- **F8 needs D-D answered** and affects parent-2 investments.

If she edits "do you own other properties?" or the parent-2 investment toggle
after first answering it, she can hit a fourth instance. She has already reported
three.

**Not blocking, but worth knowing during her test:** **F10** means deleting a
family member can let that member's document silently satisfy a later member's
requirement. It won't stop her submitting — it may produce a quietly wrong
application, which is worse to discover later.

**Also decide:** the 30-minute idle logout still applies. After B1 it no longer
destroys work and is now genuinely configurable — so choose deliberately whether
to set `NEXT_PUBLIC_SESSION_IDLE_ENABLED=false` on Preview for her testing
window, rather than leaving it on by default.

---

## 1. Decisions needed before any code

These are not engineering questions. Answer them and some of the work below
disappears.

### D-A · Should a collapsed branch preserve what was typed? → gates **F11b**

Today: **yes**. `ConditionalField` hides with CSS and never unmounts, so an
applicant who ticks a branch, types, unticks by accident and re-ticks gets their
input back.

- **If "yes" stands** — D3's rule guards are the *correct permanent design*, not
  a stopgap, and **F11b needs no code at all**.
- **If "no"** — it means unmounting **plus** `shouldUnregister: true` across 10
  `useForm` call sites. `shouldUnregister` is currently set nowhere, so
  react-hook-form's default retains unmounted values and unmounting alone would
  **not** fix stale blobs. It also risks swapping one data-loss complaint for
  another, from a client who has already lost work three times this round.

**Recommendation: keep "yes".** Guard the rules; don't discard the input.

### D-B · Does the queue keep its masked-by-default name toggle? → part of **F1**

Masking was retired (D13-1b), but the queue still masks by default and the PRD
still specifies the toggle (`docs/product/prd/04-admin-round-management.md:7`,
AC-03).

### D-C · Do `NAME_REVEAL` audit rows still earn their keep? → part of **F1**

If names are simply visible, an audit row per detail-page load is cost with no
purpose. C4a currently writes one on **every** load.

### D-D · How should a document rule read state from outside its own section? → gates **F8**

`INVESTMENT_PARENT_2` gates on `parent2OwnsInvestments` (in the blob) but its
control renders under `!isSoleParent` (derived **outside** the blob). A wrong
guess **suppresses** a legitimate requirement — a document silently never asked
for, which is the harmful direction. D3 deliberately left it rather than guess.

---

## 2. Fixes to make

| ID | What | Size | Notes |
|---|---|---|---|
| **F1** | Retire NM-01..05 name masking **coherently** | M | Blocked on D-B and D-C |
| **F6** | Blank vs deliberate £0 indistinguishable at field level | M | Deferred to sprint 2 — no current symptom |
| **F7** | `arrayForEach` rules cannot see the section blob | S | One line; see below |
| **F8** | `INVESTMENT_PARENT_2` stale-branch guard | M | Blocked on D-D |
| **F9** | Staff multipart uploads store a NULL content digest | S | Hole in duplicate detection on one path |
| **F10** | Family-ID slots key off array index | M | Real data-loss shape; see below |
| **F11b** | Unmount hidden branches | L | **Only if D-A answers "no"** |
| **F11c** | Render a control whenever it holds data, even off-branch | M | Per-form pattern, not a component change |
| **F12** | Inline upload variant has no `<label>` | S | Accessibility; see below |

### F12 · The inline upload variant is unlabelled for screen readers
Found during F11a. `file-upload.tsx` associates a label in the block variant
(`htmlFor` at ~:401) and the multi-file variant (~:658), but the **inline**
variant's input (~:348) is `sr-only` with no `<label>` at all — only
`InlineDropButton` carries an `aria-label`. A screen-reader user reaching the
input directly gets no accessible name. Pre-existing, unrelated to the F11a
change that surfaced it, and cheap to fix.

### F1 · Retire name masking coherently
The codebase now contradicts itself: `getApplicationWithDetails`
(`src/lib/db/queries/applications.ts:429-468`) still strips `childName` "per
finding 2.18"; `getApplicationNamesForReveal` (~:516) still carries the comment
*"The Assessment tab MUST NOT call this"*; the queue still masks by default; the
PRD still specifies the toggle. **Half-retired is worse than either state** — the
next reader cannot tell which behaviour is intended. Also mark security finding
2.18 superseded rather than leaving it open.

### F7 · `arrayForEach` rules cannot see the blob
`OTHER_PROPERTY_MORTGAGE_STATEMENT` has the same stale-branch defect D3 fixed in
six sibling rules, but its `elementGate` receives only the array element, so it
cannot re-check `hasOtherProperties`. **Fix: pass the blob as `elementGate`'s
second argument** — one line in `src/lib/portal/document-rules.ts`. Do **not**
convert it to `structural`; that would destroy the per-index gap ids existing
tests assert.

### F9 · Staff uploads have no digest
`/api/admin/documents` (edit-on-behalf) still stores `content_digest` NULL,
because D2 computes the digest in the presigned confirm endpoint only. Staff
uploads are therefore neither duplicate-checked nor checkable against applicant
uploads. Low urgency — staff uploading the same file three times is not the
reported problem — but it is a hole on one path.

### F10 · Family-ID slots key off the member's array index
Removing a member shifts every later member onto slots that already hold the
removed member's documents. The blob doc-ids follow the member correctly, but the
`uploadedSlots` gate fallback and the `/respond` per-slot view do not — **a
deleted member's document can silently satisfy a later member's requirement.**

Related, found in nonprod: **7 `FAMILY_ID_*` documents are already unreferenced**
by any member field (orphaned uploads, one named `PASSEPORT.docx.pdf` on a member
with no doc-ids saved at all). They still appear on the assessor's document list.

---

## 3. Checks that need a human, not a test

Several WPs are deliberately unverified in a browser. Timing-dependent and
DOM-dependent behaviour cannot be proven by the current suite — the repo has no
`jsdom`/`@testing-library/react`, and adding it mid-sprint would have meant a
`package.json` change with ten branches in flight.

| Check | From | Why it needs a human |
|---|---|---|
| Autosave: type and watch; kill the network → must read "Not saved"; close the tab and return | B2 | Timing-dependent |
| Dirty-nav guard: prompt / save / discard / stay | B1 | Timing-dependent |
| One-time PDF: download once, confirm 410 after | D1 | End-to-end state |
| UC repeat-slot UI + the 409 duplicate path | D2 | Unit-tested only |
| Three-button footer at **mobile widths** (the row wraps) | D4 | Layout |
| 20 MB upload through a real browser drag-and-drop | A1 | Storage leg proven server-side; the browser leg was not |
| **`ucMonthlyDocumentIds` shape change** — spot-check an in-progress nonprod application | D2 | `string[]` → positional `(string \| null)[]`; existing blobs keep their single id in position 1 |
| **CF-20** re-test on preview (**F3**) | A1 | Did not reproduce; needs the CF-19 data-loss state, which B1/B2 now prevent |

---

## 4. Infrastructure / process

- **Fix the `supabase-prod` read-only credential.** It has rejected the read-only
  user (`FATAL 28P01`) throughout the sprint, so **no prod data check was
  possible at any point**. C4b's column drops and F2's data audit are both
  nonprod-verified only. This blocks every prod check, not just these.
- **`prisma format` is a CI gate that no local command runs.** D1 failed CI on it
  after a column name reflowed the schema's alignment. It is now in the plan's
  ground rules; consider adding it to a pre-commit hook.
- **Worktree agents share the generated Prisma client.** Measured across 10
  worktrees: 9 had their own `node_modules`, 1 symlinked to the parent. Since
  `@prisma/client` is generated *into* `node_modules`, a schema-changing branch
  can leave another agent type-checking against the wrong client. Six agents hit
  the resulting phantom `BursaryAccount` errors. **CI is the only trustworthy
  gate** while schema PRs are in flight.

---

## 5. Owed to Charlotte

Corrections and confirmations for the reply — see the epic for the full CF map.

- **We were wrong about the session timer, and she was right.** There *is* one:
  a 30-minute idle logout whose environment switches never reached the browser,
  so it was unconfigurable everywhere. That is CF-15 and CF-16 in one mechanism.
- **CF-24 was never the 413.** A duplicate DOM id meant the visible "Passport"
  label opened the *hidden* UK-passport input; the upload succeeded but filed
  itself against a field nothing rendered. Submission was not even blocked.
- **CF-18 could not be reproduced** — the number-entry fix shipped 2026-07-18,
  four weeks before her test, and the behaviour she describes is the pre-fix one.
  Ask her to re-confirm on the current preview.
- **CF-23 was misdiagnosed by us, not by her** — year of entry is now removed
  from applicant input *and* display entirely.
- **CF-08 and CF-11** need no build; see the epic's corrections section.
- **Open question worth asking:** `BursaryAccount.feesAccountCode` was removed as
  redundant — confirm the application reference is the only fees-system code she
  needs.
