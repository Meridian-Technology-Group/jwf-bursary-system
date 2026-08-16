---
title: "Epic 14 — live progress board"
status: open
opened: 2026-08-16
related:
  - ./epic-14-implementation-plan.md
---

# Epic 14 — progress

Live sprint board. **Every session updates this file** in its WP's PR:
set status when you start (`in progress` + branch) and when you finish
(`merged` + PR # + one-line evidence note). Anything a WP produces for
Brian goes under §For Brian. Statuses: `todo · in progress · blocked ·
in review · merged`.

## Board

| WP | Title | Status | Branch / PR | Evidence |
|---|---|---|---|---|
| A1 | UC duplicate-upload rejection | in review | `fix/e14-a1-uc-duplicate-rejection` | Root cause: pre-Epic-13-D2 documents carry a NULL `content_digest` that digest-equality can never match (Charlotte's "Dec 2025 UC.pdf" sat undigested in the legacy `UC_MONTHLY` slot). Fix: lazy digest heal of undigested UC rows at confirm + fail-closed UC check + 409 names the clashing file. Unit tests (5 new) + live browser check on a throwaway (both fresh-digest and simulated-legacy paths refused; healed digest persisted). |
| A2 | Upload progress honesty | todo | | |
| A3 | Idle timer 60+60 | in review | `fix/e14-a3-idle-timer-60` | Portal default now 60 min (env override still wins); "Stay signed in (+60 min)" resets the full window. Resolver unit tests (4 new); browser-verified with a 1-min override: warning → extend resets window → expiry signs out. Admin shell stays 30 min. |
| A4 | Expiry-dialog overflow | in review | (paired with A3) | Base DialogContent hardened: viewport margin below `sm`, rounded corners at all widths, max-height + internal scroll, `break-words` on descriptions. Screenshots at 375px + 1440px — dialog centred and contained. |
| A5 | Post-submit download flow | todo | | |
| B1 | replyTo on all sends | todo | | |
| B2 | Missing-docs template copy | todo | | |
| B3 | Five invitation templates | todo | | |
| C0 | Field-map workbook ⇄ engine/UI | todo | | |
| C1 | Assessments queue + naming | todo | | |
| C2 | Assessment chrome | todo | | |
| C3 | Five-tab IA | todo | | |
| C4 | Prefill removal + Part 1 | todo | | |
| C5 | Income two-column table | todo | | |
| C6 | Parts 3–4 tables | todo | | |
| C7 | Bursary Award tab | todo | | |
| C8 | Assessment Admin tab | todo | | |
| C9 | Real reason codes | todo | | |
| D1 | Round scenarios | todo | | |
| D2 | Scenario consumption | todo | | |
| D3 | Portal schedule home | todo | | |
| E1 | Second child on one login | todo | | |
| E2 | Portal multi-application UX | todo | | |

## For Brian (accumulate; do not delete answered items — strike through)

- Set `RESEND_REPLY_TO_EMAIL` in Vercel after B1 (Production →
  `fees@johnwhitgiftfoundation.org`); confirm idle-timer envs after A3.
- Live-email spot check on staging after B1/B2/B3.
- Ping Charlotte for retest after Wave A; again after the C train.
- Relay to Charlotte: CG-07 answer (missing-docs mechanics — see plan B2),
  CG-14 answer (outcomes live on the award/recommendation step), epic §6
  Q1–Q7 (built to LA-1..7), C0's LA-8 list once produced, C9's gap-code
  renumbering.
- Staging browser pass of the full assessment path before Charlotte's
  session.

## For Brian → Charlotte (questions raised during implementation)

*(none yet)*

## Deviations from plan / discoveries

*(record here anything a WP found that corrects the plan or epic —
sprint-01 §3 style: claim, status, detail)*
