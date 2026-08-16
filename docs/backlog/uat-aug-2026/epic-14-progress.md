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
| C3 | Five-tab IA | in review | `feature/e14-c3-five-tabs` | Assessment workspace is now five sub-routes (deep-linkable): UPLOADED DOCUMENTS DISPLAY (full-width list + filter + verified toggle + inline viewer; split-screen RETIRED per CG-23/D14-2, component deleted) · APPLICATION FORM (read-only sections child→declaration via shared cards + per-section doc titles + jump link) · ASSESSMENT MODEL (1-4) (existing form A–F, save/pause/complete verified working) · AWARD (placeholder → recommendation pointer, C7 builds) · ADMIN (reference strip + synopsis w/ own save + prior wizard notes, C8 builds tables). 24 new unit tests (slot→section grouping). Browser walk of all five tabs on nonprod. |
| C4 | Prefill removal + Part 1 | in review | `feature/e14-c4-part1-prefill` | Applicant-figure prefill removed (D14-3): assessment opens empty except names / year-of-entry (editable, LA-5) / remaining-years / hidden annual fees / reference notionals; declared values live on the APPLICATION FORM tab. Part 1 = the verbatim 11-row table; sibling names persist in new additive `sibling_details` JSONB (pre-applied to nonprod, IF NOT EXISTS). Also fixed a pre-existing autosave staleness bug (stale debounce could overwrite a manual save / drop the last keystroke). Browser: fresh v2 assessment opens empty; sibling name round-trips exactly; in-flight assessment keeps its saved values. |
| C5 | Income two-column table | in review | `feature/e14-c5-income-table` | PART 2 as one Excel-style table: 27 workbook rows verbatim (incl. EESA/NBER), status-block groups, Parent 1 · Parent 2 columns, adjustment line + AUTO household total = engine C40 exactly. Storage stays per-earner records (block-presence semantics preserved via pure `income-table` helpers, 7 unit tests + parity fixture). LA-8 inert rows: sole-trader profits, PIP-split. Browser: 30k+9k entered per column → £39,000 total, SEE COMPUTATION reconciles, save round-trips, no page h-scroll at 1280px. EarnerFormV2 retired. |
| C6 | Parts 3–4 tables | in review | `feature/e14-c6-notional-assets-tables` | Parts 3, 4 and the LA-6 "Part 5" debt + lifestyle-squeeze blocks render as plain workbook tables, labels verbatim (STUCTURE incl.). AUTO cells bind to the engine's notional-spend lines / orchestrator output / pure profiling helpers (equity totals, net financial equity, lifestyleSqueeze re-used verbatim — zero new maths). Manual cells = existing inputs relocated (cash/savings to Part 3 per workbook). Savings-cushion display-only (LA-8 №5 note). Browser: 400k−250k home → £150k equity AUTO; toggles drive add-backs; strip reconciles. |
| C7 | Bursary Award tab | in review | `feature/e14-c7-award-tab` | Award tab = the award sheet: AUTO header (recipient/school/annual fees/completed-on) + SILBINGS' FEES block (3 rows, school selects, sibling-account picker, persists to `sibling_details`; engine absorption unchanged — LA-8 note inline) + the SHARED RecommendationSurface (extracted from the Recommendation page — one implementation: legs, min-of-three, scholarship/bursary/VAT summary, gap + 9-code picker, last PF + 36-code picker, outcome actions). Snapshot semantics + reopen-after-outcome unchanged. Browser E2E on throwaway: complete → award tab → save recommendation (gap reason enforced) → AWARDED recorded → reopen blocked → queue shows Locked. |
| C8 | Assessment Admin tab | in review | `feature/e14-c8-admin-tab` | Sheet-3 complete: header strip (name · reference · school · siblings), synopsis + wizard-notes editor relocated from form section F (same storage/save; read-only when COMPLETED), YoY history table (system years from snapshots + LA-7 manual pre-system rows in new `bursary_accounts.pre_system_history` JSONB with editor + audited action; deltas across the manual→system seam, 4 unit tests incl. Charlotte's example figures), payable-fees schedule (per Epic 10 year: reason codes · payable + Δ · school year · submit-by · 3 statuses; future rows Scheduled/Not started; year-matching falls back to round academic year when entries aren't back-linked). Browser-verified end-to-end on the awarded throwaway. |
| C9 | Real reason codes | merged (pre-delivered) | delivered by CALC-09/CALC-02/CALC-11 (calc-model epic) | Verified 2026-08-16 against the new extraction: the 36 YoY codes are seeded (101–136, placeholders 1–35 deprecated-in-place for historic references) and match the extraction verbatim — 0 label mismatches; the 9 gap codes live in `gap_reasons` (dup-"5" already renumbered); Settings → Reason Codes shows both sets with CRUD/deprecation. Remaining C9 scope = the award-tab pickers, which belong to C7 by design. CG-25/D4 closed. |
| D1 | Round scenarios | in review | `feature/e14-d1-round-scenarios` | New `round_windows` table (RLS policies in the same migration, admin-modify/staff-read) keyed (round, scenario) with opensOn/submitBy/defaultTaxYear; pure resolver `resolveRoundScenario` with the full boundary matrix (19/20 Aug, 10 Nov, 11/12 Apr, 22 May — 10 unit tests, LA-4 fixed 12 Apr cutover); "Round scenarios" card on the round page with 4 editable rows + derived defaults as placeholders. E1 deadline columns stay authoritative for the effective-deadline chain (decision recorded); D2 wires consumption. Browser: RA dates edited, persisted, reloaded. |
| D2 | Scenario consumption | in review | `feature/e14-d2-scenario-consumption` | Pure `window-consumption.ts`: stored window `submitBy` FILLS a null E1 per-type round default (explicit E1 column always wins — D1 decision preserved); `{{opening_date}}` = window `opensOn` > `Round.openDate` > resolver derived default. Wired into all four round-anchored sends (contact invite, quick invite, resend, reassessment batch — batch resolves once per round). Second-parent invite deliberately untouched (application-anchored deadline). Tax year: Epic 02 rule engine (round-year → (Y-1)/Y) DISAGREES with Charlotte's winter-window "previous year" — per plan the RULE ENGINE WINS, disagreement documented in `tax-year.ts` + pinned by a test; flip point is one line. 12 unit tests. |
| D3 | Portal schedule home | in review | `feature/e14-d3-portal-schedule-home` | Returning parents (≥1 ACTIVE account) lead with per-child Bursary Application Schedule blocks: one row per schedule entry — academic year · school year · opens · submit by · award news (Round.decisionDate) · state. States: SUBMITTED (app in OR entry RECEIVED/COMPLETE) / CONTINUE (in-flight draft; deep-links only when it's the portal's current app pre-E2) / START APPLICATION (in-window + round; anchors to the chooser) / LOCKED (future or no round) / CLOSED (past, never submitted — 4th honest label beyond her 3-state list). Dates: entry availableOn/requiredBy → D1 window (D2 precedence) → E1 chain → derived scenario defaults. Query is admin-context (round_windows staff-read RLS), hard-scoped to the user, derived fields only. First-timers keep the single-path home (gated conditional; account-less users still hit lifecycle gates first — verified). 14 unit tests on the state machine; browser: throwaway returning parent shows SUBMITTED 2026-27 + LOCKED 2027-28 with real dates, screenshot on file. |
| E1 | Second child on one login | in review | `fix/e14-e1-multi-child-invite` | Root cause: every invite path called `createUser(email)` unconditionally → raw "already registered" failure on a second child. Fix: shared `provisionApplicantAuthUser` (reuse APPLICANT profile → create → recover half-provisioned; staff emails refused) wired into contact-invite + quick-invite (queue path already looked up); rollbacks guarded so a REUSED login is never deleted. New existing-account accept step at /register?token (no password reset; signed-in one-click or sign-in-and-accept). Browser E2E = Charlotte's exact test: contact #2 same email → invite (reused auth user, situation carried) → accept signed-out with the EXISTING password → both applications on one profile, invitation ACCEPTED. Fixture kept for E2. |
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

- **C9 note (relay):** Charlotte's 36 YoY + 9 gap reason codes were already
  ingested during the calc-model build and match her 16 Aug workbook
  verbatim (verified). Her gap list's duplicate "5" is seeded as two
  distinct codes in her order — worth a one-line confirmation.
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

- **D2 tax-year question (decision needed):** the application form's tax-year
  wording is derived from the ROUND's academic year (Epic 02 rule: round
  2027/28 → tax year 2026/27), regardless of when the parent fills it in.
  Charlotte's scenario table wants the winter window (Nov–11 Apr, before the
  tax year ends) to ask for the PREVIOUS year (2025/26) instead. Per the epic
  plan we kept the existing rule and documented the disagreement — the form
  behaviour is unchanged. If Charlotte wants the winter window to switch to
  the previous tax year, it's a small follow-up (the plumbing is in place).
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

- **C4 · pre-existing autosave staleness (fixed in the C4 PR).** The v2
  form's 400 ms debounced autosave captured `handleSave` at schedule time —
  one render behind the change that scheduled it — so the autosave could
  drop the last keystroke of a typed value, and a pending stale timer could
  fire AFTER a manual Save and overwrite it. Observed live while testing the
  new sibling fields; affected every setState-then-scheduleAutoSave field in
  principle. Fixed with a latest-closure ref + manual saves cancelling any
  pending timer.
- **C4 · WS-202627-0007's empty v1 NOT_STARTED assessment stub deleted**
  (own throwaway) so Begin could create a fresh v2 assessment for the
  empty-open verification.
