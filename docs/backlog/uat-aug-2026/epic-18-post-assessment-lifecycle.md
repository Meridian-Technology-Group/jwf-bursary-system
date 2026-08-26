---
title: "Epic 18 — post-assessment lifecycle (Charlotte's four states)"
status: scoping
severity: high
area: assessment lifecycle, bursary accounts, outcome email, retention
opened: 2026-08-26
opened_by: Brian Wagner (source: Charlotte Perrier, 25 Aug 2026 22:32 + 22:47)
depends_on:
  - ../../product/state-model.md          # canonical 3-lifecycle model this revises
  - ./epic-17-assessment-verification-sprint.md
---

# Epic 18 — post-assessment lifecycle

**Not buildable yet. Four questions below have to be answered first**, and one of
them governs irreversible data deletion.

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

## The four questions that gate a build

| # | Question | Why it cannot be inferred |
|---|---|---|
| **Q10** | **What does "closed & purged" actually delete, and how does it interact with the 7-year retention guard?** | The existing GDPR deletion path is guarded by a 7-year retention check and a two-step confirmation, and `audit_logs` is append-only by design. "No going back" could mean anonymise, hard-delete the application, or delete the whole bursary account and its history. Guessing here destroys real family data irreversibly. |
| **Q11** | **Does the outcome email disappear, or move?** | She says emails do not come from assessment completion. If a family must still be told, the send has to move to a deliberate step (most likely the "New award" transition) rather than simply being deleted. Silently removing it means nobody is ever notified. |
| **Q12** | **When is the bursary account created?** | Today it is created on AWARD. Her model creates the *award* at "New award", which suggests the account moves there too. But reopening a closed assessment back to "stored" then has to decide what happens to an account that already exists — orphan it, close it, or block the reopen. |
| **Q13** | **Is "waiting list" a state of the assessment, the application, or the account?** | It reads like an outcome that is neither awarded nor declined, and it needs to survive into the next round. Which entity owns it decides whether this is a new enum value, a new column, or a new table. |

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

**Do not start implementation until Q10 is answered in writing.** It is the only
question here whose wrong answer cannot be undone.
