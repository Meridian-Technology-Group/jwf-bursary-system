---
title: "Epic 18 — post-assessment lifecycle (Charlotte's five final states)"
status: open
severity: high
area: assessment lifecycle, bursary accounts, outcome email, retention
opened: 2026-08-26
opened_by: Brian Wagner (source: Charlotte Perrier, 25 Aug 2026 22:32 + 22:47)
depends_on:
  - ../../product/state-model.md          # canonical 3-lifecycle model this revises
  - ./epic-17-assessment-verification-sprint.md
---

# Epic 18 — post-assessment lifecycle

> **This document stays the spec.** Her words, her illustration, the five states
> and the answered questions all live here and are not duplicated elsewhere. The
> **build queue** for it is [Epic 19](./epic-19-assessor-ux-and-lifecycle.md)
> **Lane B** (`WP-B1`…`WP-B7`), with the sequencing rules and gates; the
> per-WP handover is in
> [`epic-19-implementation-plan.md`](./epic-19-implementation-plan.md) §5 and §7.

**Q10 answered 26 Aug, so no longer blocked outright.** Her illustration settles
the states, the account timing and the waiting list; Q11 and Q14–Q15 remain and
none is destructive. Build the purge path last.

## Why this exists

Charlotte asked for the three award-decision buttons — **Award / Qualifies — not
awarded / Decline** — to be removed: *"I need to think of something else than
that to match the logic of what happens next rather than the buttons, because
this is not the logic. Could these be removed for now?"* (25 Aug, 21:48)

She then corrected our description of what they do: *"No we don't send emails
from the assessment completion. Then this creates an account. It does not work
like that. Those buttons don't work as they are."*

She is right that the current behaviour does not match her process, and it is
worth being precise about what it actually does today, because two of those
behaviours are wrong rather than merely unwanted:

| Today | Where |
|---|---|
| Recording an outcome **sends the matching outcome email** | `set-outcome-core.ts` |
| Recording an outcome **creates / promotes the bursary account** | `account-promotion.ts` |
| Recording an outcome is **the only thing that LOCKS** the assessment | the CH-05 four-state strip |
| Completing an assessment mirrors onto the schedule, but **only if an account already exists** | `completeAssessmentAction`, early-returns on `!bursaryAccountId` |

That last row is why her Assessment Admin tables stay empty for a first-time
applicant: the account is created on AWARD, so nothing to mirror onto until then
(verified 25 Aug, CH-49).

## Her model, approved 25 Aug 22:47 ("Yes let's go ahead and use those")

1. **Stored as complete** — the assessment is finished and parked while the rest
   of the intake is worked through (she named the winter admission process).
2. Then one of:
   - **Locked → "New award"** — opens an active bursary status, and *"that should
     activate the admin page"*.
   - **Closed** — with the option to reopen and set it back to *stored*.
   - **Closed & purged** — *"no going back"*.
   - **On the bursary waiting list**.

Her own caveat: *"Something like that…"*. The states are agreed; the transitions,
the guards and the side effects are not.

## Her illustration, 26 Aug — three of the four questions answered

Committed as
[`source-materials/screenshots-2026-08-23-24/epic18-lifecycle-illustration.png`](source-materials/screenshots-2026-08-23-24/epic18-lifecycle-illustration.png).
It splits the model into one **intermediary** stage and four **final** ones, and
adds detail beyond what was asked:

| Stage | Her note on what it means "system wise" |
|---|---|
| **Storing assessment as complete** | the intermediary stage, for *all* assessments |
| **Locking assessment as new award & set up active bursary** | *"the assessment is locked, finalised, can't be amended again"* · *"the corresponding admin page is activated"* · *"from that point, the admin page will be linking that assessment as assessment one and the future applications will be linked to their corresponding assessment pages; those assessment entries will feed the same single admin page per active bursary account"* · *"there should be a prompt asking the assessor to amend the bursary account reference then"* |
| **Closed & archived** | *"the assessment status shows as closed; there might be a reason to keep the assessment in the system for whatever reason"* |
| **Closed & purged** | *"this status will apply to all new applications that result in no bursary award being eventually awarded"* |
| **On the bursary waiting list** | *"the near future whilst the admission team goes through the accepted and declined place offers"* |

**Note this is FIVE final states, not four** — "closed" split into *archived* and
*purged*, which was not in her original sketch.

### Q10 — ANSWERED (26 Aug 07:20)

> *"Yes the 'closed and purged' will mean, from a GDPR concern angle, us
> destroying the documents, the application. We can discuss if or why a portion
> of the related data could be kept and why we would potentially need to keep it.
> I don't want to complicate stuff if we never look at the data again anyway or
> not destroy everything if we say to parents that we do."*

So: **destroy the documents and the application.** Her closing clause is the
governing principle and worth keeping in front of us — *do not half-delete*. If
the privacy notice tells parents the data is destroyed, it must actually be
destroyed. She is open to a reasoned exception for a retained fragment, but the
burden is on justifying what is kept, not on justifying deletion.

**Still to reconcile before building:** the existing 7-year retention guard on
the GDPR path, and `audit_logs` being append-only by design (a purge cannot
remove the audit trail, so the trail must be shown to contain nothing that
identifies the family, or the guard has to be revisited with her).

### Q12 — ANSWERED. Q13 — ANSWERED.

- **Q12** — the account is set up at **"Locking as new award"**, and that is also
  what activates the admin page. Her "assessment one" framing gives the account a
  spine: each future application links to its own assessment page, all feeding
  one admin page per active bursary account. Reopening is not addressed, but
  "can't be amended again" implies locking is terminal, so a reopen may not
  exist for this state at all — worth confirming.
- **Q13** — "waiting list" reads as a state of the **assessment**, sitting
  alongside the other finals, held while the admission team works through
  accepted and declined place offers.

### Q11 — STILL OPEN

Does the outcome email stop existing, or move to the "New award" transition? She
has not said. Today it fires on recording an outcome, which she says is not her
process. If it simply stops, nobody is ever told.

### New, from her illustration

- **Q14** — the prompt to *"amend the bursary account reference"* at New Award:
  is the assessor editing an existing reference, or minting one? References are
  validated for uniqueness (Story 11.1/11.2, `applications/reference.ts`).
- **Q15** — is **closed & archived** reopenable? Her earlier sketch had closed
  reopenable to "stored"; the illustration does not say, and it now matters which
  of the two "closed" states that applied to.

## Also in scope, and already decided

- **Remove the three decision buttons** — but only as part of the replacement.
  Removing them first leaves no way to finish an assessment at all: nothing
  locks, no outcome is recorded, no account is created. Held deliberately on
  25 Aug for that reason and she did not object.
- **"Stored as complete" already largely exists** as `AssessmentStatus.COMPLETED`
  plus the CH-05 strip's COMPLETE state. This is likely a relabel rather than a
  new state.
- **Activating the admin page on "New award"** is the clean fix for CH-49's
  caveat: it gives the schedule mirror an account to write to at a defined
  moment, instead of depending on AWARD having happened.

## What this touches

`docs/product/state-model.md` is the canonical three-lifecycle model from the
2026-06-11 review, and this revises the decision track within it. Epic 01's
status keystone (#141–#145) fused `applications.status` and dropped the old
`ApplicationStatus` enum; `AssessmentOutcome.QUALIFIES` was already left
vestigial. So the ground here has moved once before and the doc is the record of
why — read it before proposing enum changes.

## Suggested first step

Draw the state machine — states, allowed transitions, what each one locks, and
the side effect of each transition — and put it to her as a diagram with Q10–Q13
attached. One round of that is much cheaper than building a guess at a workflow
that governs awards and deletions.

**Q10 is answered**, so implementation is no longer blocked outright. Q11 and
Q14–Q15 remain, and none of them is destructive — they can be settled alongside a
first pass at the state machine rather than before it.

The purge path itself should still be built **last** and behind the existing
two-step confirmation: it is the one transition whose wrong behaviour cannot be
undone, and the retention-guard reconciliation above has to be agreed with her in
writing first.
