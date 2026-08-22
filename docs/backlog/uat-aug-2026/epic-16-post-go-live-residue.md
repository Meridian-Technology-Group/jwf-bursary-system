---
title: "Epic 16 — post-go-live residue sprint"
status: open
severity: medium
area: assessment, portal, uploads, security, invitations
opened: 2026-08-22
opened_by: Brian Wagner
related:
  - ./follow-ups.md
  - ./epic-15-progress.md
  - ../../client-feedback/2026-08-22-charlotte-feedback.md
---

# Epic 16 — post-go-live residue sprint

Scoped 2026-08-22, immediately after CH-26/28/30 reached production and the
2026/27 round went live with three real families in it.

**Nothing in this sprint is client-blocking.** Charlotte has everything she has
asked for. This is the residue: one deferred feature she proposed, the Epic 13
engineering leftovers that never got picked up, and the manual checks that were
deliberately skipped because they need a human rather than a test.

**Commercial position (Brian, 2026-08-22): no scope expansion, no commercial
change.** This sprint is remediation and previously-agreed work under the
existing Build Fee — the same stance carried from Epic 14 through CH/CI.

## Ground rules

Unchanged from Epic 15, and now stricter on one point:

- **Charlotte is on production.** A fix is not done when it lands on `staging`.
  The path is fix → validate → merge to `staging` → promote `staging → main`,
  per fix. See [[project-charlotte-feedback-2026-08-22]] in memory.
- Never write a **new enum value** to production before the code that knows it
  is deployed — the running Prisma client is generated from the old schema and
  throws on deserialising an unknown member.
- Run the typecheck the way CI does: `rm -f tsconfig.tsbuildinfo && npx tsc
  --noEmit`. A stale buildinfo makes the local check skip new files. Lint is
  `continue-on-error` in CI; only typecheck and test gate a merge.
- `prisma format --check` is a CI gate no local command runs by default.

---

## Lane A — the deferred feature

### A1 · CH-27 — preview the invitation email before sending, editable for that send

**Charlotte's words (22 Aug):** *"When I click on send the invitation: would it
be possible to have a preview of the email about to be sent, with an editable
functionality? So that when I click on 'send invitation', it is exactly as
required in that particular case?"*

Deferred by Brian on 22 Aug in favour of getting CH-26/28/30 to production. She
has been told it is coming and that we want to build it properly.

Size: **M–L.** Both invite paths are in scope (quick invite and
invite-from-contact), because she uses both.

**Shape.** At the confirmation step, render the fully merged email — resolved
template name, subject and body with this family's real merge values — with
subject and body editable for this send only.

**The design constraint that made it worth deferring.** Once a send can be
edited, `email_log` (CI-02, Epic 15 X1) must record **the text that was actually
sent**, not the template that was nominally used. Otherwise Sent Emails quietly
starts lying about what the parent received — worse than not having the feature,
because she now relies on that page. So:

- persist the sent subject/body on the log row (new nullable columns), and
- show them in Sent Emails, flagged as edited for that send, and
- leave the template itself untouched — a per-send override must never write
  back to the template.

Merge-field resolution already exists (`replaceMergeFields`, `src/lib/email/merge.ts`)
and template resolution is `resolveInvitationTemplate` — the preview must call
the *same* resolver the send does, or the preview and the send can disagree,
which is the exact class of bug CH-28 was.

---

## Lane B — Epic 13 engineering residue

Carried from [`follow-ups.md`](./follow-ups.md) §2. Still open — verified in the
code on 2026-08-22, not assumed. Sizes as recorded there: S ≤ half a day,
M ~1 day, L 2 days+.

### B1 · F1 — retire name masking coherently `M` — **do this one first**

The codebase contradicts itself. `getApplicationWithDetails`
(`src/lib/db/queries/applications.ts:471`) still strips applicant name fields
"per finding 2.18 / NM-01..05", and `getApplicationNamesForReveal` (~:556) still
carries *"The Assessment tab MUST NOT call this"* — while the feature it guards
has been half-retired around it.

**Why first:** half-retired is worse than either state, because the next reader
cannot tell which behaviour is intended — and **security finding 2.18 is still
open against it**. Closing this closes the finding. Decide the end state, make
the code say only that, and mark 2.18 superseded rather than leaving it hanging.

Blocked on **D-B** (does the queue keep its masked-by-default name toggle?) and
**D-C** (do `NAME_REVEAL` audit rows still earn their keep?) — both small
decisions, both in `follow-ups.md` §1.

### B2 · F12 — inline upload input has no accessible name `S`

`src/components/portal/file-upload.tsx` associates a `<label>` in the block and
multi-file variants but not the **inline** one: three `sr-only` inputs, two
`htmlFor`s. A screen-reader user reaching that input directly gets no accessible
name. Parent-facing, pre-existing, cheap. Pair it with an accessibility pass over
the other two variants while in there.

### B3 · F9 — staff multipart uploads store a NULL content digest `S`

A hole in duplicate detection on one upload path only. Parent uploads populate
`content_digest`; the staff path does not.

### B4 · F10 — family-ID slots key off the member's array index `M`

Recorded in `follow-ups.md` as *"a real data-loss shape"* — reordering or
removing a household member can re-point a document slot at the wrong person.
Worth confirming the current blast radius before sizing the fix, since the
household model has moved since it was written.

### B5 · F8 — `INVESTMENT_PARENT_2` stale-branch guard `M`

Blocked on **D-D** (how should a document rule read state from outside its own
section?).

### B6 · F11b / F11c — hidden-branch data retention `L` / `M`

`F11b` (unmount hidden branches) is **only** wanted if **D-A** answers "no" to
*should a collapsed branch preserve what was typed?* `F11c` (render a control
whenever it holds data, even off-branch) is a per-form pattern, not a component
change. Answer D-A first; it may delete F11b entirely.

### B7 · F6 — blank vs deliberate £0 indistinguishable at field level `M`

Explicitly deferred in Epic 13 with **no current symptom**. Lowest priority
here; carry it rather than build it unless a symptom appears.

### Decisions to close first (all small, all in `follow-ups.md` §1)

| ID | Question | Gates |
|---|---|---|
| D-A | Should a collapsed branch preserve what was typed? | B6 (`F11b`) |
| D-B | Does the queue keep its masked-by-default name toggle? | B1 (`F1`) |
| D-C | Do `NAME_REVEAL` audit rows still earn their keep? | B1 (`F1`) |
| D-D | How should a document rule read state from outside its own section? | B5 (`F8`) |

---

## Lane C — checks that need a human, not a test

From [`follow-ups.md`](./follow-ups.md) §3. All five were deliberately skipped as
timing-, state- or layout-dependent. Now more valuable than when written,
because real parents are in the portal for the first time.

| # | Check | From | Why a human |
|---|---|---|---|
| C1 | Type, kill the network → indicator must read "Not saved"; close the tab and return | B2 | Timing-dependent |
| C2 | Dirty-nav guard: prompt / save / discard / stay | B1 | Timing-dependent |
| C3 | One-time PDF: download once, confirm 410 after | D1 | End-to-end state; consumes the single download |
| C4 | UC repeat-slot UI + the 409 duplicate path | D2 | Unit-tested only |
| C5 | Three-button declaration footer at **mobile widths** (the row wraps) | D4 | Layout |

**C1, C2 and C5 are parent-facing and the three real families are in the portal
now** — run those first, on nonprod with a throwaway application. Do not test
against Charlotte's or any real family's data.

---

## Suggested order

1. **Lane C** (C1, C2, C5) — hours, not days, and they cover paths three real
   families are walking this week.
2. **B1 (F1)** once D-B and D-C are answered — closes security finding 2.18.
3. **B2 (F12)**, **B3 (F9)** — both `S`, both self-contained.
4. **A1 (CH-27)** — the only item with a client expectation attached, so it
   should not sit indefinitely; but it is also the largest, and she has been
   told it is coming rather than imminent.
5. **B4, B5, B6** as their decisions land. **B7** only on a symptom.

## Parked — only if Charlotte asks again

### P1 · Default application-reference format `S`

She described the new-application reference as school-letters-first with no
school year; the generated default is
`{Child name} – {School name} – {Year group} – {Academic year}`. Same
information, different arrangement, and she overwrites it when the bursary
becomes active — so she was told the recommendation is to leave it. Parked
unless she pushes.

⚠️ **If it is ever changed**, `resolveRolloverReference` detects an "untouched"
default by **recomputing the current default and comparing**. Changing the
format makes every previously-untouched default stop matching, so it is treated
as human-entered and inherited forward — dragging stale academic years onto new
applications. Add the outgoing format to `LEGACY_GENERATED_REFERENCE` in the
same change, and cover it with a test.

## Out of scope

- Anything Charlotte raises next — that starts its own thread and follows the
  fix → validate → staging → promote path.
- A production login for staff other than Charlotte: considered on 22 Aug and
  **declined** (Brian). Consequence to keep in mind: production changes can be
  verified at the database and platform level but **not through the UI**, and
  direct SQL fixes bypass the app's audit log.
