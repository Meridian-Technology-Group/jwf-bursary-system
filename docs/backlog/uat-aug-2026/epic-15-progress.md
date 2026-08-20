---
title: "Epic 15 — live progress board"
status: open
opened: 2026-08-20
related:
  - ./epic-15-implementation-plan.md
---

# Epic 15 — progress

Live sprint board. **Every session updates this file** in its WP's PR:
set status when you start (`in progress` + branch) and when you finish
(`merged` + PR # + one-line evidence note). Anything a WP produces for
Brian goes under §For Brian. Statuses: `todo · in progress · blocked ·
in review · merged`.

## Board

| WP | Title | Status | Branch / PR | Evidence |
|---|---|---|---|---|
| G1 | Password-reset loop (CI-01) | todo | `fix/e15-g1-password-reset-loop` | |
| G2 | Invitation name contract (CH-09) | todo | `fix/e15-g2-invitation-names` | |
| G3 | Go-live readiness pass + runbook (CI-09) | todo | `docs/e15-g3-golive-readiness` | |
| P1 | Missing-docs window lock (CI-07/08) | todo | `feature/e15-p1-missing-docs-window-lock` | |
| W1 | Four-state assessment lifecycle (CH-04/05/06) | todo | `feature/e15-w1-assessment-lifecycle` | |
| W2 | Header compression + tab-row removal + fonts (CH-01/03/07/08) | todo | `feature/e15-w2-assessment-chrome` | |
| M6 | Award tab ungate + rebuild (CI-11/12) | todo | `feature/e15-m6-award-tab-rebuild` | |
| M5 | Flags removal + tab rename (CI-10, CH-25) | todo | `fix/e15-m5-flags-tab-rename` | |
| M2 | Per-academic-year school fees (CH-17) | todo | `feature/e15-m2-school-fees-years` | |
| M1 | Part 1 rebuild (CH-10..16) | todo | `feature/e15-m1-part1-rebuild` | |
| M3 | Part 2 blank + annotation strip (CH-18/19/20) | todo | `fix/e15-m3-part2-blank` | |
| M4 | Part 3 overrides + sign display (CH-21..24) | todo | `feature/e15-m4-part3-overrides` | |
| M7 | Admin history scaffold (CI-13) | todo | `feature/e15-m7-admin-scaffold` | |
| X1 | Sent-emails log view (CI-02) | todo | `feature/e15-x1-sent-emails` | |
| X2 | Reply-to on staging + BCC + quiet contact create (CI-03/04/05) | todo | `feature/e15-x2-comms-controls` | |

## For Brian (accumulate; do not delete answered items — strike through)

- **Day-0 gate**: after G1+G2 merge and the staging deploy is green,
  green-light Charlotte to set up the three internal applicants and send
  invitations (D15-2). G3 produces the runbook + suggested reply points.
- Timeline reply to Charlotte (she asked twice): epic §4 has the suggested
  dates — confirm/adjust before relaying.
- X2 will need a Vercel Preview-scope env value for the reply-to
  (see plan) — flag lands here when the WP merges; do not set early.
- Commercial position: this plan assumes the Epic 14 stance (pre-go-live
  acceptance remediation under the Build Fee, no new scope) carries over
  to CH/CI. The X-lane comms items are the most arguable — confirm.
- Separately (not in this epic): reissue the 2026-27 invoice dated in
  August without the "due 30/09/2026" line (PO114282 thread, 18 Aug).

## Post-merge verification (evidence promised in PR bodies)

_(collect here as WPs merge)_

## Deviations from plan / discoveries

_(collect here as WPs merge)_
