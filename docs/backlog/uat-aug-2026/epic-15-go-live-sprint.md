---
title: "Epic 15 — go-live sprint (Charlotte feedback 17+20 Aug, first real applicants)"
status: open
severity: critical
area: assessment, portal auth, invitations, uploads, email, admin settings
opened: 2026-08-20
opened_by: Brian Wagner (source: Charlotte Perrier, CH-01..25 + CI-01..13)
depends_on:
  - ../../client-feedback/2026-08-17-charlotte-feedback.md   # CH-01..25
  - ../../client-feedback/2026-08-20-charlotte-feedback.md   # CI-01..13
  - ./epic-14-implementation-plan.md                          # prior art; LAs amended below
implementation:
  - ./epic-15-implementation-plan.md   # autonomous-execution plan — start there
  - ./epic-15-progress.md              # live board
related:
  - source-materials/screenshots-2026-08-17-20/  # Charlotte's screenshots, decoded per item below
---

# Epic 15 — go-live sprint

Everything arising from Charlotte's 17 Aug (`CH-*`) and 20 Aug (`CI-*`)
batches, shaped around one hard fact: **she has three real internal bursary
applicants and wants invitation emails out on Fri 21 Aug, with a parent
submission deadline of Thu 27 Aug** (CI-09). If all three are awarded they
become the first active bursaries on the portal.

> **Implementation**: executed autonomously by Claude Code sessions. The
> authoritative how — bootstrap, authority, ground rules, locked assumptions,
> per-WP briefs, validation standards — is
> [`epic-15-implementation-plan.md`](epic-15-implementation-plan.md).
> Live status: [`epic-15-progress.md`](epic-15-progress.md).

## 0. Decisions locked by Brian (2026-08-20)

| # | Decision |
|---|---|
| D15-1 | **Environment**: the three real applicants run on **staging + supabase-nonprod**. Charlotte already expects a post-assessment data transfer; promotion of their data to prod is a later, separate exercise. GDPR posture: real family data on nonprod is accepted for this round — noted, minimised, not repeated as SOP. |
| D15-2 | **Day-0 hotfix track**: CI-01 (password-reset loop) + CH-09 (invitation names) ship first thing 21 Aug, browser-verified, before Brian green-lights Charlotte to invite. |
| D15-3 | **Comms scope is minimal**: sent-emails log view, BCC, create-contact-without-email, and reply-routing answered by configuration. The full "Bursary Department inbox" is deferred to its own design pass. |
| D15-4 | **Merge authority**: same as Epic 14 — squash-merge own green PRs to `staging` with evidence recorded; never `staging → main`. |

## 1. Goal & success criterion

1. **By end of Fri 21 Aug**: Charlotte can set up the three internal
   applicants and send invitations; a parent who follows the invite can
   register, and a parent who forgets their password can actually reset it
   (CI-01). Invitations cannot be sent without the child's first name and
   surname (CH-09).
2. **By Thu 27 Aug** (her submission deadline): the missing-documents
   window is one-shot and upload-only for parents (CI-07/08), and the
   assessment workspace lets her run a full assessment end-to-end —
   Parts 1–5 amended per CH, **Part 6 reachable and completable without the
   "Assessment must be completed first" gate** (CI-11/12), four-state
   lifecycle on the header (CH-05), admin tab shows the history scaffold
   (CI-13).
3. Charlotte has a written timeline (she asked twice) and answers to her
   open questions — via Brian, never directly.

Parts 2, 4 and 5 calculations are **signed off by Charlotte as correct**
(CI batch, E8). The v2 engine remains read-only; everything here is
UI/workflow/data-model, not maths.

## 2. Item → work-package map

Every CH/CI item, where it lands, and what the screenshot decode resolved.
Screenshots are committed under
`source-materials/screenshots-2026-08-17-20/` (`ch-*` = 17 Aug email,
`ci-*` = 20 Aug).

| Item | Decoded meaning (screenshot) | WP |
|---|---|---|
| CH-01 | Assessments list mixes the mono reference font with sans in one row (`ch-image002`) | W2 |
| CH-02 | Question — confirm her recipient's assessment reflects the changes | For Brian → Charlotte (yes, once train merges) |
| CH-03 | Compress 3 header layers (breadcrumb / title block / Actions row, `ch-image004`) into one row per her mock (`ch-image003`): ref + surname + school chip + Round/Entry line + 4 status buttons + Reject & Restart / MANAGE / Request Missing Documents / SEE COMPUTATION | W2 |
| CH-04 | Blue "Mark Complete" (old actions row) vs green "COMPLETE" (v2 banner) — duplication to resolve | W1 |
| CH-05 | Four-state lifecycle NOT STARTED → PAUSED → COMPLETE → LOCKED, exactly one green (`ch-image007`) | W1 |
| CH-06 | Hide "Actions > Review in progress" labelling | W1 |
| CH-07 | Remove the old `Applicant Data / Assessment / Recommendation / History` tab row on assessment routes; keep the 5 workbook tabs (`ch-image005`) | W2 |
| CH-08 | Remove the household-summary card ("Household: Single parent" + WHO IS ASSESSED / LEAD APPLICANT, `ch-image008`) from the assessment page | W2 |
| CH-09 | Invitation sendable with empty child names (`ch-image006`: First name shows "Skrzynski", Surname "—"); make both mandatory; recipient record = first name, surname, DOB, assigned school, assigned year of entry — no title | **G2 (day-0)** |
| CH-10 | Entry year is a school year (Year 6–13), academic year is dual-year (2027/2028) — current UI conflates them (`ch-image010` shows calendar "2027") | M1 |
| CH-11 | Part 1 missing: school picker (Trinity/Whitgift), award year of entry (Year dropdown), scholarship — all empty + mandatory, **no prefill** (overturns Epic 14 LA-5) | M1 |
| CH-12 | Hidden matrix entry-year→remaining-years (Y6→8 … Y13→1) autofills the remaining-years row (`ch-image014` currently shows 0) | M1 |
| CH-13 | Scholarship %: 1–100, manual, needed at start of rolling-over assessments (`ch-image012`) | M1 |
| CH-14 | School field manually switchable mid-assessment (Trinity→Whitgift recalculation scenario) | M1 |
| CH-15 | "Number of schooling age children" (`ch-image015`): accept 1–20, **no default** (currently defaults 1) | M1 |
| CH-16 | Net Part 1 contract = her workbook table (`ch-image016`): autofill = first name, surname, annual school fees; manual = school (dropdown), year of entry, scholarship, siblings 1–3, family category (dropdown), remaining years (matrix-autofilled but editable), children count | M1 |
| CH-17 | School fees per school **per academic year** (current + next columns, history retained; figures supplied). Current admin is one versioned fee per school (`ch-image009`) | M2 |
| CH-18 | Part 2 income cells arrived pre-populated (`ch-image011`: £40,000/£32,000) — must open blank | M3 |
| CH-19 | Remove the light-brown annotation lines — our internal LA-8/build notes leaking into the UI (`ch-image013`, `ch-image017`: "No separate engine input (LA-8, sign-off pending)…", "Single combined DLA/PIP figure…") | M3 |
| CH-20 | Remove the MANUAL INCOME ADJUSTMENT section (`ch-image018`) — duplicates the divorced-parents capture | M3 |
| CH-21 | Notional-rent add-back (`ch-image019`): keep 4-option dropdown, add manual override of the derived value | M4 |
| CH-22 | Council tax deduct (`ch-image020`): manual editable field; dropdown applies the default | M4 |
| CH-23 | "DISPLAY ONLY — ENTER TOTAL CASH HELD / TOTAL SAVINGS" arrived prefilled (`ch-image021`) — unlink, open empty | M4 |
| CH-24 | Sign convention (`ch-image022`): DEDUCT lines show negative totals; ADD BACK lines are recharges — display-level, engine untouched. She re-verifies with real data | M4 |
| CH-25 | Tab rename: ASSESSMENT MODEL (1-5) / BURSARY AWARD CALCULATION (6) | M5 |
| CI-01 | Password reset: request succeeds ("Check your email", `ci-rounds-image002`) but the emailed link lands back on sign-in, never the set-new-password form | **G1 (day-0)** |
| CI-02 | Sent-emails visibility → minimal log view | X1 |
| CI-03 | Parents' replies → `fees@johnwhitgiftfoundation.org`: staging currently sends **no reply-to** (#318 made the fees@ fallback prod-only) — real applicants live on staging (D15-1), so staging needs the reply-to too | X2 |
| CI-04 | Create contact without auto-generated email (ad-hoc Outlook sends) | X2 |
| CI-05 | BCC support | X2 |
| CI-06 | "Bring content forward, hide plumbing" — absorbed into W1/W2 chrome work | W1/W2 |
| CI-07 | One-shot missing-docs upload window: block parent uploads once the requested documents are submitted | P1 |
| CI-08 | While the window is open, parent can ONLY upload — rest of form read-only to parent, still editable by assessor | P1 |
| CI-09 | Go-live: 3 internal applicants, invites 21 Aug, deadline 27 Aug | G3 + For Brian |
| CI-10 | Remove the "E. Flags" section (Dishonesty flag + credit-risk note, `ci-image025`) from Part 5 | M5 |
| CI-11 | "Assessment must be completed first / …before recording a recommendation" (`ci-image027`) — the award tab's RecommendationSurface is gated on assessment completion; Part 6 must be workable as the natural continuation of Part 5 | M6 |
| CI-12 | Rebuild Part 6 to her scoping layout (full field list in the 20 Aug catalogue, §E8) | M6 |
| CI-13 | Assessment-admin tab: render the empty history-table **scaffold** (headers + year rows) instead of "no history"; column contracts = her two tables (catalogue §E8) | M7 |

## 3. Sprint board (summary — live status in epic-15-progress.md)

Sizes: S ≤ half day · M ~1 day · L 2 days+.

| Lane | WP | Item(s) | Size | Branch |
|---|---|---|---|---|
| **G — day-0 (21 Aug)** | G1 password-reset loop | CI-01 | S–M | `fix/e15-g1-password-reset-loop` |
| G | G2 invitation name contract | CH-09 | S–M | `fix/e15-g2-invitation-names` |
| G | G3 go-live readiness pass + runbook | CI-09 | M | `docs/e15-g3-golive-readiness` |
| **P — parent window (by 27 Aug)** | P1 missing-docs window lock | CI-07/08 | M | `feature/e15-p1-missing-docs-window-lock` |
| **W — workspace chrome (train start)** | W1 four-state lifecycle | CH-04/05/06, CI-06 | L | `feature/e15-w1-assessment-lifecycle` |
| W | W2 header compression + tab-row removal + fonts | CH-01/03/07/08 | L | `feature/e15-w2-assessment-chrome` |
| **M — model train (sequential after W)** | M6 award tab: ungate + rebuild | CI-11/12 | L | `feature/e15-m6-award-tab-rebuild` |
| M | M5 flags removal + tab rename | CI-10, CH-25 | S | `fix/e15-m5-flags-tab-rename` |
| M | M2 per-year school fees | CH-17 | L | `feature/e15-m2-school-fees-years` |
| M | M1 Part 1 rebuild | CH-10..16 | L | `feature/e15-m1-part1-rebuild` |
| M | M3 Part 2 blank + annotations | CH-18/19/20 | M | `fix/e15-m3-part2-blank` |
| M | M4 Part 3 overrides + sign display | CH-21..24 | M–L | `feature/e15-m4-part3-overrides` |
| M | M7 admin history scaffold | CI-13 | M | `feature/e15-m7-admin-scaffold` |
| **X — comms minimal** | X1 sent-emails log view | CI-02 | M | `feature/e15-x1-sent-emails` |
| X | X2 reply-to staging + BCC + quiet contact create | CI-03/04/05 | M | `feature/e15-x2-comms-controls` |

Order of battle: **G1+G2+G3 first (day-0)**, P1 next in the parent lane.
The workspace train runs W1 → W2 → M6 → M5 → M2 → M1 → M3 → M4 → M7
sequentially (same surface — Epic 14's C-train lesson). X1/X2 fit between
train slots or in parallel (disjoint files). M6 is deliberately early in
the train: it is the item blocking Charlotte's formula testing.

## 4. Questions Charlotte has open (answer via Brian)

1. CH-02: yes — her recipient's assessment reflects the changes once the
   train merges (say which PRs when replying).
2. CI-03: replies routing — answered by X2 + Vercel env (see plan).
3. CI-13: column contracts built exactly to her two example tables; flag
   that the scaffold ships empty and fills as assessments complete.
4. Timeline (she asked twice, E1 + E7): G-lane 21 Aug; parent window items
   by 25 Aug; assessment train aiming 26–27 Aug — Brian to confirm/adjust
   when relaying.
