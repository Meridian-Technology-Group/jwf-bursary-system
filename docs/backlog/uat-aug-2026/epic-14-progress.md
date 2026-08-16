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
| A2 | Upload progress honesty | in review | `fix/e14-a2-upload-progress` | Root cause: the progress bar was a fake timer parked at 85% for the whole transfer + verification. Now real XHR byte progress (0→100%) + explicit "Checking your file…" phase during server verification. 4 new transport unit tests; live 9 MB upload to nonprod storage captured 0→13→…→100% → checking → success. |
| A3 | Idle timer 60+60 | in review | `fix/e14-a3-idle-timer-60` | Portal default now 60 min (env override still wins); "Stay signed in (+60 min)" resets the full window. Resolver unit tests (4 new); browser-verified with a 1-min override: warning → extend resets window → expiry signs out. Admin shell stays 30 min. |
| A4 | Expiry-dialog overflow | in review | (paired with A3) | Base DialogContent hardened: viewport margin below `sm`, rounded corners at all widths, max-height + internal scroll, `break-words` on descriptions. Screenshots at 375px + 1440px — dialog centred and contained. |
| A5 | Post-submit download flow | in review | `feature/e14-a5-submit-download-flow` | Three-beat flow live: submit confirm → "application sent" + bare `DOWNLOAD MY COPY` + `Continue` (zero scarcity copy) → home. Offer exists only in the live post-submit beat (sessionStorage flag, LA-1 forfeit); server one-download rule + 410 unchanged. 6 unit tests on the beat matrix; full E2E submit on throwaway WS-202627-0007 with screenshots of all beats; revisit shows no download path. |
| B1 | replyTo on all sends | in review | `feature/e14-b1-reply-to` | All three Resend send sites carry `replyTo` (`RESEND_REPLY_TO_EMAIL` ?? fees@johnwhitgiftfoundation.org — prod correct even unset). Bulk wizard step 2 shows "Replies to" beside the from-address. 5 unit tests across every send path. Staging live-email check = Brian (see §For Brian). |
| B2 | Missing-docs template copy | in review | `feature/e14-b2-missing-docs-copy` | Migration `20260816160000` updates the MISSING_DOCS row to Charlotte's verbatim subject + body ({{applicant_name}}, {{missing_documents}}, {{deadline}}); merge data already flows from the pause action. 3 render tests pin the shipped copy. SQL dry-run validated against nonprod in a rolled-back tx; applies via db-push on merge. |
| B3 | Five invitation templates | in review | `feature/e14-b3-invitation-templates` | Enum + seed migrations (validated on scratch PG); resolver (situation × school → template, 12 unit tests); situation persisted on Contact + Invitation; selectors on quick-invite + contact dialog (default New); internal-request path hard-wired INTERNAL; resend reuses stored variant; rolling template carries {{opening_date}} + rolling {{deadline}} from the round. All 5 listed + locked in Settings. Browser check of selectors/Settings deferred to post-merge (column lands via db-push). |
| C0 | Field-map workbook ⇄ engine/UI | in review | `docs/e14-c0-field-map` | `epic-14-field-map.md` committed: every workbook row mapped to a v2 engine input/output or flagged. LA-8 list = 5 items (Part-1 scholarship, sibling names/schools, sole-trader profits row, DLA/PIP split, savings-cushion display) + manual-vs-computed conflicts on 3 award cells (note A). Removal candidates listed (prefill blocks → C4; rest keep). |
| C1 | Assessments queue + naming | in review | `feature/e14-c1-assessments-queue` | New `/assessments` list (reference · child · school · round · derived assessment status · assignee · submitted) + status chips + assignee filter; nav item beside Applications. Status derivation pure + 7 unit tests (due/in-progress/paused/completed/locked-by-outcome/closed). Browser: 31 nonprod assessments render with sane statuses; ASSESSOR spot check (minted test assessor) sees only their assigned row. |
| C2 | Assessment chrome | in review | `feature/e14-c2-assessment-chrome` | On assessment routes only: status-badge block hidden (reference/child/school stay left); second-parent+GDPR card behind a collapsed MANAGE disclosure (DOM-absent until opened); Save/Pause/Complete banner leads the workspace; live calc behind SEE COMPUTATION (collapsed default, localStorage-persisted). Other tabs unchanged (browser-verified). Screenshots default/expanded/1280px. |
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

- **C0 / LA-8 list (relay for sign-off):** see `epic-14-field-map.md` §LA-8 —
  (1) Part 1 "Bursary recipient's Scholarship" has no engine field (manual
  text cell vs display of the award-side scholarship %?); (2) sibling
  names/schools aren't stored anywhere (proposed small additive store filled
  by the C7 sibling-account picker); (3) the sole-trader "COMPANY NET
  PROFITS" row has no separate engine input (historically entered under
  gross salaried — confirm one bound row is acceptable); (4) the workbook
  splits DLA and PIP but the engine holds one combined figure (proposed one
  combined row); (5) "SAVINGS CUSHION ALLOWANCE" exists as reference data
  but feeds no calculation (display-only OK?). **Note A:** the award sheet
  marks AFFORDABILITY ADJUSTED DI / SCHOLARSHIP VALUE / PAYABLE FEES NEXT
  YEAR as manual-fill, but the engine computes all three — C7 renders them
  computed (no per-field overrides, D13-3/D14-4); manual entry there would
  be a calculation change (MSA 9.3).

- **CG-07 answers (B2, ready to relay):** yes — Request Missing Documents
  emails the lead applicant, pauses the application, and merges the ticked
  items + return-by date into the email. Replies now land at
  `fees@johnwhitgiftfoundation.org` (B1 replyTo). The email uses the
  standard branded wrapper around her body copy. Parents can also still
  respond through the portal (`/respond`), but per her copy the email only
  mentions returning documents by email (LA-2).
- **B2 note:** her default body has no slot for the assessor's personal
  note (the dialog's "custom message"), so that note no longer appears in
  the email — it still shows on the portal respond page. If she wants the
  note in the email, tell us where it should sit and we'll add
  `{{custom_message}}` back at that spot.

## Deviations from plan / discoveries

*(record here anything a WP found that corrects the plan or epic —
sprint-01 §3 style: claim, status, detail)*
