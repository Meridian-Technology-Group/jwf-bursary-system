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
| G1 | Password-reset loop (CI-01) | merged | #321 (`fix/e15-g1-password-reset-loop`) | Root cause: `/reset-password/update` never existed. Built the set-new-password page (12-char + HIBP, expired-link state), login now explains callback failures. Browser E2E on nonprod throwaway: request → real Supabase email → link → set password → sign in with new password ✓; re-used link → friendly login message ✓; sessionless visit → expired state ✓. Localhost IS in the Supabase redirect allowlist (verified live). 7 unit tests. |
| G2 | Invitation name contract (CH-09) | merged | #322 (`fix/e15-g2-invitation-names`) | Child first name, surname AND DOB now required on both invite paths (contact register + quick invite); no child title anywhere (CH-09). Split identity + DOB carried Invitation→Application via additive migration (pre-applied to nonprod, IF NOT EXISTS); Part 1 reads the split columns, whitespace-split fallback for legacy rows. Browser E2E: missing-first-name refused; full invite→email→register run wrote child_first_name/child_last_name/child_dob on invitation AND application (SQL-verified); contact dialog shows the exact contract. 17 unit tests touched/added. Legacy contacts without split names/DOB are no longer invite-ready until edited. |
| G3 | Go-live readiness pass + runbook (CI-09) | in review | `docs/e15-g3-golive-readiness` | Staging-alias browser pass GREEN: CI-01 repro fixed end-to-end (screenshot); quick invite (new mandatory identity) → real email → register → application with split identity (DB-verified) → wizard prefilled. Runbook at `docs/operations/go-live-runbook-2026-08.md`. ⚠️ Invitation email states deadline 30/11/2026 — Brian decides whether to move the round window to 27/08 (see runbook §1.2). Staging sends carry NO reply-to until Preview-scope env is set (§1.1). |
| P1 | Missing-docs window lock (CI-07/08) | merged | #323 (`feature/e15-p1-missing-docs-window-lock`) | Also FIXED A LATENT DEFECT: parent re-uploads on a paused SUBMITTED application 409'd (no PAUSED exemption in upload-authorization) — /respond uploads never worked. Now: paused + requested slot = allowed; paused + other slot = 409 naming the window; resumed = blanket 409 again (the one-shot close). Wizard writes were already structurally blocked post-submission (context resolver excludes SUBMITTED) — CI-08 hole was uploads only. 4 new route tests; browser E2E: pause → /respond upload succeeds (DB-verified doc row) → resume → /respond redirects to /status. |
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

- ~~**Day-0 gate**~~ **READY TO GREEN-LIGHT (2026-08-20 ~23:00)**: G1+G2+P1
  merged, staging deploy verified by a full browser pass (see G3 row). Two
  pre-flight items are yours (runbook §1): the Preview-scope
  `RESEND_REPLY_TO_EMAIL` if replies must hit fees@ from day one, and the
  ⚠️ **deadline question** — the invitation email currently tells parents
  30/11/2026; moving it to 27/08 is a one-field edit on the 2026/27 round's
  NEW scenario window (affects the whole round, not just these three).
  Runbook: `docs/operations/go-live-runbook-2026-08.md`.
- Timeline reply to Charlotte (she asked twice): epic §4 has the suggested
  dates — confirm/adjust before relaying. Suggested points for the E7 reply:
  (1) go ahead and set the three families up on the current system tomorrow —
  password reset + invitation contract are fixed and verified; (2) child
  first name/surname/DOB now required when preparing invitations; (3) the
  missing-docs upload window works and locks itself after her requested
  documents come back; (4) assessment-model changes (her CH list + Part 6)
  land through this week, in time for the 27 Aug assessments; (5) answer to
  CH-02 = yes once the workspace train merges.
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
