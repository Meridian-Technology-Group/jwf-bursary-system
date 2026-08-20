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
| G3 | Go-live readiness pass + runbook (CI-09) | merged | #324 (`docs/e15-g3-golive-readiness`) | Staging-alias browser pass GREEN: CI-01 repro fixed end-to-end (screenshot); quick invite (new mandatory identity) → real email → register → application with split identity (DB-verified) → wizard prefilled. Runbook at `docs/operations/go-live-runbook-2026-08.md`. ⚠️ Invitation email states deadline 30/11/2026 — Brian decides whether to move the round window to 27/08 (see runbook §1.2). Staging sends carry NO reply-to until Preview-scope env is set (§1.1). |
| P1 | Missing-docs window lock (CI-07/08) | merged | #323 (`feature/e15-p1-missing-docs-window-lock`) | Also FIXED A LATENT DEFECT: parent re-uploads on a paused SUBMITTED application 409'd (no PAUSED exemption in upload-authorization) — /respond uploads never worked. Now: paused + requested slot = allowed; paused + other slot = 409 naming the window; resumed = blanket 409 again (the one-shot close). Wizard writes were already structurally blocked post-submission (context resolver excludes SUBMITTED) — CI-08 hole was uploads only. 4 new route tests; browser E2E: pause → /respond upload succeeds (DB-verified doc row) → resume → /respond redirects to /status. |
| W1 | Four-state assessment lifecycle (CH-04/05/06) | merged | #325 (`feature/e15-w1-assessment-lifecycle`) | Strip NOT STARTED · PAUSED · COMPLETE · LOCKED (one green, her mock) above the workbook tabs on every assessment tab; derives from existing data via new pure `lifecycle-state.ts` (LA15-1: PAUSED covers IN_PROGRESS — 'anything saved'; LOCKED = outcome/closed). On assessment routes the Actions row's 'Actions › Review in progress' label (CH-06) and the blue Mark Complete duplicate (CH-04) are hidden — the form's green Complete is the single affordance; non-assessment tabs unchanged. 6 unit tests on the full derivation matrix; browser walk NOT STARTED → save → PAUSED → Complete → COMPLETE → outcome → LOCKED, 4 screenshots. |
| W2 | Header compression + tab-row removal + fonts (CH-01/03/07/08) | merged | #326 (`feature/e15-w2-assessment-chrome`) | Assessment routes now show ONE header card (her mock): mono ref + child + school chip + Round/Entry, W1 strip, Reject & Restart · Request Missing Documents · SEE COMPUTATION (deep-links model tab ?see=1); breadcrumb, Actions row and the old 4-tab row hidden there (LA15-3 — surfaces stay reachable off assessment routes); MANAGE disclosure unchanged; household summary card removed from the assessment view (CH-08, dead plumbing pruned); assessments-list reference cell same size as its row (CH-01). Non-assessment routes byte-identical (browser-verified). Screenshots at 1280 + 375px. |
| M6 | Award tab ungate + rebuild (CI-11/12) | merged | #327 (`feature/e15-m6-award-tab-rebuild`) | CI-11 KILLED: the award tab renders the full Part 6 for an IN-PROGRESS v2 assessment (new pure `award-surface-state.ts`, 8 tests) — values anchored to the LAST SAVE (banner says so); never-saved shows a soft 'save the model first' prompt, never the completion gate; outcome actions withheld until COMPLETE with a one-line note (server already enforced this in set-outcome-core; saveRecommendationAction never required completion). Sibling rows now editable until the OUTCOME locks them (LA15-4). 'PART 6 - BURSARY AWARD CALCULATION' heading + always-visible COMPLETED ON (— until complete). Recommendation route keeps its gate; v1 keeps its gate. Browser walk: no-save prompt → save → full ungated form → pre-completion Save Recommendation OK → Complete → Award-decision card appears. |
| M5 | Flags removal + tab rename (CI-10, CH-25) | merged | #328 (`fix/e15-m5-flags-tab-rename`) | E. Flags section (Dishonesty checkbox + credit-risk note) removed from the model tab — columns + saved values preserved, just no longer surfaced (CI-10); tabs renamed ASSESSMENT MODEL (1-5) / BURSARY AWARD CALCULATION (6) incl. doc-comment sweep (CH-25). Browser-verified on the retained E14 fixture (read-only view). |
| M2 | Per-academic-year school fees (CH-17) | merged | #329 (`feature/e15-m2-school-fees-years`) | LA15-7 held — NO schema change (effectiveFrom already encodes the year; fee-year resolver untouched). Settings now lists EVERY row per school labelled by academic year; edit updates THAT year (upsert on [school, 1-Sep]); Add-year form (last year → +2). Charlotte's REAL figures seeded + applied to nonprod (2025-26: T £24,366.67 / W £25,200.00 · 2026-27: T £25,390.00 / W £26,175.00). ⚠️ Deleted 3 nonprod placeholder rows (2× invented ~+5% 2027-28 uplifts + 1 stray mid-year Trinity row from the old 'version from today' path) — the seed's own NOTE marked them swap-for-real; leaving them would have fed an invented 2027-28 fee into real award calcs. Existing assessment snapshots untouched. Browser: 4 real rows year-labelled, add-2027-28 round-trip (test row removed). |
| M1 | Part 1 rebuild (CH-10..16) | merged | #330 (`feature/e15-m1-part1-rebuild`) | Part 1 = her contract: school dropdown (empty, no prefill, SWITCHABLE — CH-14 verified live: Trinity £25,390 → Whitgift £26,175 on switch, fees derived per school from M2 data via new feesBySchool prop); year of entry = Year 6–13 dropdown (school year, not calendar — CH-10, overturns E14 LA-5) autofilling remaining-years from the CH-12 matrix (new pure helper, browser-verified Y9→5); scholarship % 1–100 manual in Part 1 sharing the award tab's column (CH-13); children count 1–20 with NO default (CH-15, meta reseeding removed); Complete gated on school+year+fee. Additive migration (assessment_school + entry_school_year) with backfill from the application so ALL 32 in-flight nonprod assessments keep their effective behaviour; pre-applied. DB round-trip verified for every new field. |
| M3 | Part 2 blank + annotation strip (CH-18/19/20) | merged | #331 (`fix/e15-m3-part2-blank`) | CH-19: every internal annotation stripped from user-visible copy (income-table row notes 'No separate engine input (LA-8, sign-off pending)…' / DLA-PIP notes, savings-cushion note, CALC-A7 mention, sibling-block LA-8 note) — reworded assessor-facing. CH-20 (LA15-6): MANUAL INCOME ADJUSTMENT entry block removed; engine input remains — a stored adjustment still counts and shows as the amber table line + in SEE COMPUTATION (browser-verified with a £5k legacy fixture); input UI gone. CH-18 ROOT CAUSE: her £40k/£32k are PERSISTED PRE-C4 PREFILL on her own TS-Skrzynski assessment (earner JSON carries applicant p60/payslip documentIds — the old prefill's fingerprint); new assessments open blank (C4 test + repeated fixture opens). One-off reset of her assessment's earner rows offered, on her say-so (§For Brian). |
| M4 | Part 3 overrides + sign display (CH-21..24) | merged | #332 (`feature/e15-m4-part3-signs`) | CH-24 SHIPPED: every notional-spend line renders the engine's existing signedAmount — DEDUCT rows negative (browser: DEDUCT NOTIONAL RENT −£19,000.00, her exact example), ADD BACK rows explicit '+'; totals untouched (pure display). CH-23: cash/savings display-only rows already open at 0 on fresh assessments — her prefilled values are the same pre-C4 persisted story as CH-18 (documented, no code). ⚠️ CH-21/CH-22 ESCALATED, NOT BUILT: manual £ overrides of the rent add-back and council-tax lines require NEW ENGINE INPUTS (verified: the engine derives both from reference data with no override input) — locked rule says never improvise engine changes. Proposal in §For Brian. |
| M7 | Admin history scaffold (CI-13) | merged | #333 (`feature/e15-m7-admin-scaffold`) | Both admin-tab tables now render their SCAFFOLD when empty: full headers + one row per academic year (round year → horizon sized by the assessment's remaining-years, default 8, pure helper + 5 tests), em-dash cells; data-bearing rows keep the existing C8 rendering. Browser: fresh assessment shows 2026/27→2032/33 in both tables (full-page screenshot). Her Table-1 columns all present (Lifestyle Squeeze Ratio included); 'Living arrangement' fills from C8's existing source when data exists. |
| X1 | Sent-emails log view (CI-02) | merged | #334 (`feature/e15-x1-sent-emails`) | New append-style `email_log` table (staff-read/server-insert RLS in the same migration, round_windows pattern; pre-applied to nonprod) written best-effort by all three senders (SENT+resendId / FAILED+error / SKIPPED; a log failure never fails a send — 5 unit tests). New `/emails` admin page (nav: Invitations → Sent Emails): reverse-chron, email filter, pagination, honest 'from 21 Aug 2026' caveat. Browser: real invitation send → SENT row with template label + rendered subject. NOTE: it's a send log, not a mailbox — replies go to the reply-to address (CI-03). |
| X2 | Reply-to on staging + BCC + quiet contact create (CI-03/04/05) | in review | `feature/e15-x2-comms-controls` | CI-04: 'Don't email — I'll send the registration link myself' on BOTH invite paths — creates the invitation (auth user, 30-day token, resend later still works) without sending and shows the copyable registration link (browser E2E: link created, ZERO email_log rows, link opens the registration page). CI-05: optional BCC on ad-hoc/bulk sends (sendRawEmail option + bulk wizard input + server validation; unit-pinned passthrough). CI-03: NO CODE (LA15-9) — Vercel Preview-scope RESEND_REPLY_TO_EMAIL is Brian's pre-flight (runbook §1.1). |

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
- **CH-21/CH-22 need your call (M4 escalation)**: Charlotte wants manual £
  overrides of the notional-rent add-back and the annual council-tax deduct.
  Both amounts are ENGINE-DERIVED from reference data with no override input,
  so building them means touching `v2/notional-spend.ts` — outside this
  sprint's authority (engine read-only). Proposed shape when you approve:
  two OPTIONAL engine inputs (`rentAddBackOverride`, `councilTaxOverride`),
  default null = today's behaviour byte-for-byte (existing fixtures prove
  parity), UI = editable £ cell beside the dropdown/toggle. ~half a day.
- **CH-18 answer for Charlotte** (M3 investigation): the £40,000/£32,000 she
  saw in Part 2 are values SAVED onto her TS-Skrzynski assessment by the old
  prefill (before Epic 14 C4 removed it) — stored records win on load, so
  they are not a live link to the form. Fresh assessments open blank. If she
  wants that assessment's income cells cleared rather than hand-zeroed, say
  the word and we reset its two earner records (they carry the old prefill's
  document-id fingerprint, so they are provably not her manual entries).

## Post-merge verification (evidence promised in PR bodies)

_(collect here as WPs merge)_

## Deviations from plan / discoveries

_(collect here as WPs merge)_
