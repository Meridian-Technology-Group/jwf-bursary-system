# Parent / Applicant Portal — UX Proposal

**Author:** UX Researcher (audit + proposal)
**Date:** 2026-06-07
**Status:** Proposal for client review — no code changes made.
**Scope:** The `src/app/(portal)/` route group (lead-applicant portal) and its shared shell. Excludes the secondary-parent `/contribute` flow and the admin/assessor app except as a reference pattern.

---

## 1. Executive summary

The parent portal was built as a **single-shot application wizard**, and the shell still reflects that: the persistent left sidebar is *only* the application-section stepper, there is no portal-level navigation, and there is no way to sign out from inside the portal. But the product's job has grown well past "fill in one form". A parent now legitimately returns to:

- **upload extra documents** when an assessor pauses their case (`/respond`),
- **apply for the next round** / re-assessment (the dashboard "Begin" card),
- **check status** (`/status`),
- **review past rounds and download what they submitted** (`/history`),
- and, after a decision, simply **come back later**.

The shell hasn't kept up. The result is the client's core complaint — *"it doesn't feel like a portal"* — plus a cluster of smaller defects that all trace back to the same architectural fact: **the wizard is the shell, instead of being one area inside a shell.**

The diagnosis is consistent across every file I read. The good news is that the hard parts already exist — the status projection, history loader, respond flow, guidance content, and tri-state progress engine are all built and wired (`buildSidebarSections`, `loadAccountHistory`, `projectParentStatus`). The portal does not need new capabilities so much as a **frame** that exposes the capabilities it already has, plus two genuine bug fixes.

There is also a strong in-house pattern to copy rather than invent: the **admin shell** already does grouped persistent navigation with a user footer and a working **Sign out** form (`src/components/admin/admin-nav.tsx:234`), and the logout endpoint it posts to is the same one the `portal-closed` dead-end already uses (`src/app/portal-closed/page.tsx:42`, `src/app/api/auth/logout/route.ts`). We should reuse it.

### The 4–6 highest-leverage moves

1. **Introduce a real portal shell with persistent navigation and sign-out.** Replace the wizard-only sidebar with a portal nav (Home / My Application / Documents / History / Account → Sign out). Demote the section stepper to a *contextual sub-navigation* that appears only while inside `/apply/*`. Reuse the admin nav + logout pattern. *(Issue #1 — largest, highest leverage.)*
2. **Make the dashboard lead with the dashboard.** Move the large guidance block (`PortalGuidanceTabs`, including a 28rem embedded PDF) off the top of the landing page and into a dedicated Help area / collapsed accordion, so status + the next action are above the fold for every portal state. *(Issue #2.)*
3. **Fix the two defects.** (a) The bottom-left progress bar is frozen at "0 of 11, 0%" because the layout never re-runs on client navigation and `SectionForm` never calls `router.refresh()` — a **staleness bug**, not unwired data (#5). (b) The denominator disagrees with itself: shell says "of 11", review/dashboard say "of 10", because the shell counts the synthetic Review pseudo-step (#6). Both are quick wins.
4. **Collapse the duplicate footer.** `SectionForm` renders its own Back / Save-and-Continue *and* the shell renders a second `PortalBottomNav` simultaneously — one canonical footer only. *(Issue #3.)*
5. **Reduce per-section scrolling** in the heavy sections (Parents' Income, Assets & Liabilities, Additional Information) via two-column field rows, fieldset cards, and progressive disclosure — patterns the Assets form already demonstrates and the Income form does not. *(Issue #7.)*
6. **Promote Documents to a first-class portal area.** Uploading is no longer a one-time wizard step — it's a recurring task (`/respond`, re-assessment). Give it a persistent home in the nav rather than burying it inside the form.

The first three moves resolve the *"doesn't feel like a portal"* perception and clear both defects; they are also the cheapest. The rest is incremental polish on top of a now-correct frame.

---

## 2. Holistic portal model & information architecture

### 2.1 The mental model shift

**Today:** `Portal === Application`. The shell *is* the form. Everything else (`/status`, `/history`, `/respond`, `/submitted`) is a page you can only reach via a button on the dashboard, with no persistent way back except an in-page "Back to dashboard" link (e.g. `status/page.tsx:335`, `history/page.tsx:170`). There is no sign-out anywhere in `(portal)/layout.tsx`.

**Proposed:** `Portal ⊃ Application`. The portal is the parent's **account home** for their relationship with the Foundation. The application is **one area inside it**, alongside Documents, History, Status, and Account. The section stepper is sub-navigation *for the application area only* — it should not be the spine of the whole portal.

### 2.2 Persistent navigation — what it contains

A single persistent nav, present on every portal page, adapting its emphasis (not its membership) to the portal state:

| Nav item | Route | Always present? | Notes |
|---|---|---|---|
| **Home** | `/` | Yes | The dashboard. Default landing. |
| **My Application** | `/apply/…` or `/status` | Yes (label/target adapts) | While drafting → deep-links into the wizard and reveals the section stepper. After submit → points at `/status` (read-only). |
| **Documents** | new `/documents` (or `/respond` when paused) | Yes | First-class home for uploads + the paused "action needed" task. Today uploads only exist *inside* form sections + `/respond`. |
| **History** | `/history` | Yes | Already built (`loadAccountHistory`). Multi-round account view. |
| **Help & guidance** | new `/help` | Yes | New home for `PortalGuidanceTabs` (How to Apply / Checklist / T&Cs) — see Issue #2. |
| **Account** | menu → **Sign out** | Yes | Reuses `src/components/admin/admin-nav.tsx:234` pattern + `/api/auth/logout`. The single biggest "feels like a portal" fix. |

The section **stepper** (`PortalSidebarContent`) is retained but **scoped to `/apply/*`**: it renders as contextual sub-navigation *below* the persistent nav (desktop) or inside the "All sections" sheet (mobile) only while the user is in the wizard. On Home, Status, History, Documents it is hidden — which also stops the bottom nav and stepper appearing on pages where they make no sense.

### 2.3 State adaptation

The nav membership is constant; what changes is **what Home leads with** and **where "My Application" points**. The dashboard already computes most of these states (`page.tsx:258-276`); we are mostly re-prioritising what surfaces first.

| Portal state | Home leads with | "My Application" target | Notes |
|---|---|---|---|
| **No invitation** | Neutral "no invitation — contact the Foundation" card (`page.tsx:496`) | hidden/disabled | Guidance moves to Help. |
| **Invited, not started** | "Begin your application" (the `ApplicationTypeChooser`, `page.tsx:489`) | `/apply/child-details` | Onboarding card front and centre. |
| **Draft in progress** | "Continue — N of M sections complete" + deadline countdown | deep-link to first incomplete section; stepper visible | Today this is pushed below the guidance block. |
| **Submitted / received** | "Received — decision expected by {date}" status summary | `/status` (read-only) | Stepper hidden; Continue action removed. |
| **In assessment** | Status summary + "decision expected by {date}" (`status/page.tsx:320`) | `/status` | No action required. |
| **Paused — needs docs** | **Prominent "Action needed: upload documents"** task (already at `page.tsx:309` and `status/page.tsx:159`) | `/respond` via Documents | The single most time-sensitive state — should be the first thing on Home and badged in the nav. |
| **Decided** | Outcome card (`status/page.tsx:257`) + History prompt | `/status` | |
| **Re-assessment invited** | "Welcome back — begin your {year} re-assessment" (`page.tsx:218`) | `/apply/child-details` (rolling) | Returning-holder path; should not require scrolling past last year's guidance. |

### 2.4 ASCII wireframe — proposed shell (desktop, ≥768px)

While **inside the application wizard** (`/apply/*`):

```
┌──────────────────────────┬─────────────────────────────────────────────┐
│  [JWF logo]              │  Details of Child            Section 1 of 10 │
│  Bursary Assessment      │  ───────────────────────────────────────────│
│                          │                                              │
│  PORTAL                  │  ┌─────────────────────────────────────────┐ │
│  ▸ Home                  │  │ (section form content)                   │ │
│  ▸ My Application   ◀──── active                                       │ │
│  ▸ Documents             │  │  ...                                      │ │
│  ▸ History               │  └─────────────────────────────────────────┘ │
│  ▸ Help & guidance       │                                              │
│                          │  ┌─ ONE canonical footer ─────────────────┐  │
│  ── 2026/27 Round ──     │  │  [‹ Back]            [Save & Continue ›]│  │
│  APPLICATION SECTIONS    │  └────────────────────────────────────────┘  │
│  ✓ 1 Details of Child    │                                              │
│  ● 2 Family ID  (active) │                                              │
│  ○ 3 Parent Details      │                                              │
│  △ 4 Dependent Children  │   ✓ complete  ● active  ○ to-do  △ attention│
│  ○ … Review · Declaration│                                              │
│  ▓▓▓▓░░░░ 3 of 10 · 30%  │                                              │
│                          │                                              │
│  [👤 Jane Doe       ▾]   │                                              │
│      └ Sign out          │                                              │
└──────────────────────────┴─────────────────────────────────────────────┘
```

While **outside the wizard** (Home / Status / History / Documents) — the stepper and bottom nav are **not** rendered:

```
┌──────────────────────────┬─────────────────────────────────────────────┐
│  [JWF logo]              │  Welcome back, Jane                          │
│  Bursary Assessment      │  ───────────────────────────────────────────│
│                          │                                              │
│  PORTAL                  │  ⚠ Action needed: upload requested documents │
│  ▸ Home            ◀──── active                          [Upload ›]     │
│  ▸ My Application         │                                              │
│  ▸ Documents  •          │  ┌─ Application status ───────────────────┐  │
│  ▸ History               │  │ 2026/27 round   [ Being assessed ]      │  │
│  ▸ Help & guidance       │  │ Decision expected by 12 July 2026       │  │
│                          │  └─────────────────────────────────────────┘ │
│  (no stepper here —      │                                              │
│   not in the wizard)     │  Quick actions:  [Status] [History] [Docs]   │
│                          │                                              │
│  [👤 Jane Doe       ▾]   │  Help & guidance ▸ (collapsed, link to /help)│
│      └ Sign out          │                                              │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### 2.5 ASCII wireframe — proposed shell (mobile, <768px)

```
┌─────────────────────────────────────────┐
│ [JWF]   2026/27 Round           [☰ Menu] │  ← Menu opens the PORTAL nav sheet
│ ▓▓▓▓░░░░ 3/10        [All sections ▾]    │  ← progress + stepper sheet only in /apply/*
├─────────────────────────────────────────┤
│                                          │
│  Details of Child         Section 1/10   │
│  ┌────────────────────────────────────┐  │
│  │ (form content)                      │  │
│  └────────────────────────────────────┘  │
│                                          │
├─────────────────────────────────────────┤
│  [‹ Back]            [Save & Continue ›] │  ← one footer, only in /apply/*
└─────────────────────────────────────────┘

  Menu sheet (☰):                 Account row pinned at bottom of the sheet:
  ┌───────────────────────┐       ┌───────────────────────┐
  │ Home                  │       │ 👤 Jane Doe           │
  │ My Application        │       │ Sign out              │
  │ Documents          •  │       └───────────────────────┘
  │ History               │
  │ Help & guidance       │
  └───────────────────────┘
```

The mobile header today (`portal-mobile-header.tsx`) already has a left-sheet for sections and a "Signed in as {name}" footer — but **no menu and no sign-out**. We add a second sheet (the portal nav) and a Sign-out action in the existing footer, reusing the same Sheet primitive.

### 2.6 ASCII wireframe — redesigned dashboard (draft-in-progress state)

```
┌─────────────────────────────────────────────────────────────┐
│  Welcome back, Jane                                          │
│  2026/27 Assessment Round — continue your application below. │
├─────────────────────────────────────────────────────────────┤
│  ⏳ 4 days left to submit · deadline 14 June          (count) │   ← only if draft
├─────────────────────────────────────────────────────────────┤
│  ┌─ Continue where you left off ──────────────────────────┐  │
│  │  ▓▓▓▓▓▓░░░░  6 of 10 sections complete · 60%           │  │   ← PRIMARY card,
│  │  Next: Parents' Income                  [Continue ›]    │  │     above the fold
│  └────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Quick actions                                               │
│  [ View status ]   [ Documents ]   [ History ]               │
├─────────────────────────────────────────────────────────────┤
│  Need help? How to apply · Checklist · Terms      → /help    │   ← guidance demoted
└─────────────────────────────────────────────────────────────┘
```

Guidance is now a single quiet link row at the bottom (or a collapsed accordion), not a fold-dominating tabbed card with an embedded PDF.

---

## 3. Issue-by-issue

### Issue #1 — "Doesn't feel like a portal" (design change — largest)

**Current behaviour.** `(portal)/layout.tsx:129` renders a fixed 280px `PortalDesktopSidebar`, whose entire body is `PortalSidebarContent` — the application-section stepper + progress bar (`portal-sidebar.tsx:162-247`). The only footer is "Signed in as {name}" (`portal-desktop-sidebar.tsx`). There is:

- **no portal navigation** — no Home, My Application, Documents, History, or Account links anywhere in the shell;
- **no sign-out** — `grep` for `signOut`/`logout` across the portal returns only the `IdleLogoutWatcher` (auto-logout) and the `portal-closed` dead-end; the live portal shell has none;
- a default page title of **"My Application"** (`layout.tsx:33`), framing the whole portal as the form.

Inter-page movement relies on ad-hoc in-page links ("Back to dashboard": `status/page.tsx:335`, `history/page.tsx:170`, `submitted/page.tsx:104`). A returning parent who lands on Home and wants to reach History has a button; a parent on Status who wants Documents has nothing.

**Why it's a problem.** It violates the parent's mental model. They were told they have a "portal" but get a form with no way out, no map of where they are, and no sign-out — which is also a mild security/shared-device concern given the financial data involved. The information architecture has not kept pace with the feature set (respond, re-assess, history) the team has already shipped.

**Recommended change.** Build the portal shell in §2. Concretely:

- Add a `PortalNav` client component modelled on `admin-nav.tsx` (grouped links, active-state accent, user footer, **Sign-out form** posting to `/api/auth/logout` — the exact pattern at `admin-nav.tsx:234-248`, already proven and CSRF-guarded by the route).
- In `(portal)/layout.tsx`, render `PortalNav` as the persistent shell; render the **section stepper only when `pathname` is under `/apply`** (a client check, or split into an `/apply` sub-layout segment that owns the stepper + bottom nav).
- Mirror on mobile: extend `portal-mobile-header.tsx` with a second Sheet for the portal nav and a Sign-out action in the existing footer.
- Reconsider the default title "My Application" → a neutral "Bursary Portal" default, with section pages setting their own titles (they already do via `metadata`).

This is the move that turns the form into a portal. Everything below is smaller.

### Issue #2 — Landing-page real estate (design change)

**Current behaviour.** `(portal)/page.tsx:278-297` renders, top to bottom: welcome heading → **`PortalGuidanceTabs`** → status card → quick actions. `PortalGuidanceTabs` (`portal-guidance-tabs.tsx`) is a large tabbed card whose Terms tab embeds a **28rem-tall** PDF `<object>` (`portal-guidance-tabs.tsx:248-252`). So application *guidance* sits above the actual dashboard for every state, including a paused parent who just needs to upload one file.

**Why it's a problem.** Guidance is reference material consulted occasionally; status and the next action are what a returning parent needs immediately. Putting a tall, tabbed, PDF-bearing card first pushes the real dashboard below the fold and buries the time-sensitive "Action needed" paused card lower than it should be. It's also redundant for re-assessment parents, who have done this before.

**Recommended change.**

- **Move `PortalGuidanceTabs` to a dedicated `/help` page** in the persistent nav ("Help & guidance"), keeping it always reachable before/during/after an application (its stated requirement) without it crowding Home.
- On Home, replace it with a **single quiet link row / collapsed accordion** ("Need help? How to apply · Checklist · Terms → /help"). New applicants who want it can expand or click through.
- **Dashboard leads with the state-appropriate primary** (§2.3): for a draft, the "Continue — N of M" card with the next-incomplete section; for paused, the "Action needed" card first; for submitted/assessing, the status summary. The pieces already exist in `page.tsx` (`309`, `334`, `397`) — this is a re-order plus the guidance demotion.
- Keep the embedded T&Cs PDF on `/help` (and at the Declaration step where consent is actually given), not on Home.

### Issue #3 — Duplicate footers (design change — quick win)

**Current behaviour.** Two Back / Save-and-Continue bars render at once inside the wizard:

- `SectionForm` renders its own nav at `section-form.tsx:225-266` (a `<a>Back` + `<button type="submit" form={formId}>`), and
- the shell renders `PortalBottomNav` for **every** portal page from `(portal)/layout.tsx:159-161`, whose submit button targets `form="section-form"` (`portal-bottom-nav.tsx:39`) and whose Back button has **no handler at all** (`portal-bottom-nav.tsx:23-34`).

So in the wizard the user sees two identical bars; on non-wizard pages (Home, Status, History) the sticky `PortalBottomNav` still renders but its submit targets a non-existent `section-form` and its Back does nothing.

**Why it's a problem.** It looks unfinished ("sloppy", per the client), wastes vertical space (compounding Issue #7), and the shell copy is a no-op/dead control on most pages.

**Recommended change — one canonical footer.** Pick the **shell `PortalBottomNav`** as the single source of truth *but scope it to `/apply/*` only* (it disappears on Home/Status/History once the stepper is scoped per §2.2), and:

- Delete the in-form nav block in `SectionForm` (`section-form.tsx:225-266`); keep the auto-save indicator + error summary.
- Give `PortalBottomNav` a real **Back** handler (it already knows `pathname`; wire `router.back()` or pass the section's `backHref`), and keep its existing `form="section-form"` submit + the `saving` disabled/spinner state currently living in `SectionForm` (lift the saving state to a small shared store or context so the one button can reflect it).

Alternatively, if lifting save state is fiddly, keep the **in-form** footer as canonical and **remove `PortalBottomNav` from the layout entirely** — simpler, fewer moving parts, at the cost of the footer scrolling with content rather than sticking. Recommended default: scoped sticky `PortalBottomNav`, in-form nav removed.

### Issue #4 — Stepper doesn't indicate complete / incomplete / to-do (design change, shares root cause with #5)

**Current behaviour.** The capability is fully built: `buildSidebarSections` (`portal-sidebar-sections.ts:111`) computes a tri-state status per section (`complete` / `needs_attention` / `not_started`) from `getSectionGapStatuses`, and `PortalSidebarContent` renders distinct icons — green `CheckCircle2`, amber `AlertTriangle`, numbered bubble for active, grey `Circle` for to-do (`portal-sidebar.tsx:32-73, 168-227`). It *should* show status. It doesn't, because the data it receives is stale (see #5).

**Why it's a problem.** A wizard with no completion indicators gives the parent no sense of progress or what's left — the exact thing a stepper is for. But the fix is not to build indicators (they exist) — it's to stop feeding the component frozen data.

**Recommended change.** Same fix as #5 (refresh the layout data after each save). Once the stepper receives live `sections`, the tri-state icons already render correctly. Secondary polish: the active-but-incomplete state currently shows a numbered bubble (`portal-sidebar.tsx:203`) which competes visually with the to-do `Circle`; consider a clearer "current" treatment (filled accent ring) distinct from to-do.

### Issue #5 — Progress bar always reads "0 of 11, 0%" — **DEFECT**

**Current behaviour.** The bottom-left label `{completedSections} of {countedSections.length} sections complete` + `{progressPct}%` (`portal-sidebar.tsx:233-235`) is computed in `PortalSidebarContent`, which is rendered by the **persistent App Router layout** (`(portal)/layout.tsx:130`). The layout's `async` body computes `sidebarSections` from `getSectionGapStatuses` (`layout.tsx:90-95`) **once, at first mount**. App Router does **not** re-execute a parent layout on client-side navigation between sibling `/apply/*` pages. After a section save, `SectionForm` calls `router.push(nextHref)` (`section-form.tsx:101`) but **never `router.refresh()`**, so the layout's server data is never re-fetched. The sidebar is frozen at its initial value — typically 0 complete — for the entire wizard.

**Why it's a defect (not a design gap).** The numbers are correct *server-side*; they are simply never refreshed client-side. This is a staleness bug.

**Fix direction.** Smallest correct fix: after a successful save in `SectionForm.onSubmit`, call `router.refresh()` **before/around** `router.push(nextHref)` so the persistent layout re-runs its server query and the stepper re-renders with current data. (`router.refresh()` re-fetches server components in place; combine with the push so navigation + data refresh both happen.) A more robust option for snappier feedback is to **hoist progress into a client store** (or move the live stepper into the `/apply` page subtree, which *does* re-render on navigation) so it updates optimistically without a server round-trip. Recommend `router.refresh()` first (one line, low risk), client store only if the refresh flash is noticeable. **Same fix resolves #4.**

### Issue #6 — Counter mismatch: review says "N of 10", shell says "N of 11" — **DEFECT**

**Current behaviour.** Two denominators disagree:

- The **shell sidebar** counts the synthetic Review pseudo-step. `DEFAULT_SIDEBAR_SECTIONS` has **10 real sections + 1 synthetic Review = 11** (`portal-sidebar-sections.ts:45-58`), and `PortalSidebarContent` is called with the default `countSynthetic=true` (`portal-sidebar.tsx:102`, `119-121`), so `countedSections.length` = 11.
- The **dashboard** counts only the 10 real `ApplicationSectionType`s (`page.tsx:50-62`, `TOTAL_SECTIONS = 10`).
- The **review page** header says "Step 10 of 11 — Review" (`apply/review/page.tsx:484`) but its own sections-complete counter reads `{completedCount} of {SECTION_ORDER.length}` = **"N of 10"** (`review/page.tsx:500`).
- The **wizard section pages** show "Section {currentIndex+1} of {activeSectionOrder.length}" where `totalSteps` excludes Review (`apply/[section]/page.tsx:362-363`) = of 10.

So a parent sees "of 10" on the dashboard, "of 10" in the section header, "of 10" on review's own counter — but "of 11" in the persistent sidebar, and "Step 10 of 11" in the review header. The synthetic Review step is counted in one place and not the others.

**Why it's a defect.** Inconsistent denominators for the same quantity are a correctness bug; the parent cannot trust the progress numbers.

**Fix direction.** Pick **10 (real sections only)** as the single denominator everywhere, and **exclude the synthetic Review step from the count** — exactly as the `/contribute` stepper already does via `countSynthetic=false` (`portal-sidebar.tsx:94`, `119-121`; documented at `portal-sidebar-sections.ts:79`). Concretely: pass `countSynthetic={false}` to the lead-applicant stepper too (or drop the synthetic Review from the counted set). Keep Review as a **navigable stepper entry** (it's a useful waypoint) but **not counted** toward "N of M". Also reconcile the review header "Step 10 of 11" (`review/page.tsx:484`) to the same scheme (Review is a gate, not section 10-of-11). Note the re-assessment case already shifts the denominator to 9 by dropping `FAMILY_ID` (`page.tsx:122-126`, `portal-sidebar-sections.ts:158-160`) — the chosen rule must hold there too; counting real-active-sections-only does.

### Issue #7 — Too much vertical scrolling (design change)

**Current behaviour.** Each section renders as one long single-column white card. The content column is capped at `max-w-3xl` (`(portal)/layout.tsx:153`) and each section is wrapped in a single `rounded-xl … p-6` card (`section-page-client.tsx:397`). The heaviest:

- **Parents' Income** (`parents-income-form.tsx`) — `space-y-10` stack of full-width sub-tables, each row a 3-col grid with the input pinned to a single narrow column (`Row`, line 81; `MoneyRow`, line 99). For a PAYE + benefits parent this is a very long single column, doubled for two parents (`557-582`).
- **Assets & Liabilities** (`assets-liabilities-form.tsx`) — ~15 fields. *Already* uses fieldsets + `sm:grid-cols-2` two-column grids (`124`, `222`) — this is the good pattern to propagate.
- **Additional Information** (`additional-info-form.tsx`) — 6 expandable circumstance cards stacked vertically (`CIRCUMSTANCES`, line 38; `121-130`), each expanding to reveal an upload, then a tall `rows={8}` textarea (`154`) + a general upload area.
- **Family ID / Dependent Children / Dependent Elderly** — repeatable `useFieldArray` cards that grow unbounded.

**Why it's a problem.** Long single-column forms feel heavier than they are, increase perceived effort and drop-off, and bury the (single, scoped) footer far below the fold. The `max-w-3xl` cap means horizontal space is wasted even on desktop.

**Recommended change.** Apply the patterns the codebase already contains, section by section:

- **Group related numeric inputs into two-column rows** (`grid sm:grid-cols-2`), as Assets already does (`assets-liabilities-form.tsx:124`). Propagate to Income: the income `MoneyRow` (`parents-income-form.tsx:99`) can pair related figures (e.g. State Pension / Private Pension; gross salaried / property income) two-up instead of one-per-row.
- **Split each section card into labelled fieldset sub-cards** rather than one tall card — again Assets's `<fieldset><legend>` pattern (`assets-liabilities-form.tsx:94`, `167`, `217`, `263`). Income's `SubTable` (`parents-income-form.tsx:171`) is already this shape; the win there is two-column rows + collapsing empty sub-tables.
- **Progressive disclosure** for Additional Information: the 6 circumstances are *exception* cases — most parents tick none. Render them as a compact checklist (toggles only), revealing the upload **inline on demand** (already conditional via `ConditionalField`, `additional-info-form.tsx:73`) — but collapse the card chrome so 6 untouched circumstances occupy ~6 rows, not ~6 cards.
- **Consider light sub-steps for Income only** (the heaviest): Parent 1 → Parent 2 as two panels with a "next parent" control, instead of one continuous scroll, so a two-parent household isn't a single ~2× page.
- **Widen the wizard content column** for grid-heavy sections (e.g. `max-w-4xl`) so two-column rows have room; keep `max-w-3xl` for prose/declaration.
- **Sticky section sub-nav** is *not* needed if the stepper is scoped per §2 — the stepper already serves intra-application navigation.

**Before / after sketch — Parents' Income (one parent, PAYE):**

```
BEFORE (single column, ~1 field per row)            AFTER (fieldset card + two-up rows)
┌──────────────────────────────────┐                ┌───────────────────────────────────────────┐
│ Parent 1 — Income                 │                │ Parent 1 — Income     Employed (PAYE)       │
│ Employed (PAYE)                   │                │ ┌─────────────────────┬───────────────────┐ │
│   Gross salary (P60) ......[ £ ]  │                │ │ Gross salary (P60)  │ £ [_________]     │ │
│   [ upload P60 ]                  │                │ │ Other taxable inc.  │ £ [_________]     │ │
│   [ upload March payslip ]        │      ⇒         │ └─────────────────────┴───────────────────┘ │
│ Third-party support               │                │ Documents: [P60] [March payslip]            │
│   Income support .........[ £ ]   │                │ ▸ Third-party support (collapsed unless > 0)│
│   Who provides it? [        ]     │                │ TOTAL £24,500   ☑ documents legible          │
│ TOTAL £24,500                     │                └───────────────────────────────────────────┘
│ ☑ I confirm documents legible     │
└──────────────────────────────────┘                Shorter, scannable, uses horizontal space.
```

---

## 4. In-application experience (consolidated)

Putting the wizard-specific recommendations together, the target state inside `/apply/*` is:

1. **One canonical footer** — scoped sticky `PortalBottomNav`, in-form nav removed, real Back handler, shared saving state (#3).
2. **Live stepper status** — tri-state icons fed by data refreshed after every save via `router.refresh()` (#4 + #5).
3. **One consistent denominator** — real sections only (10, or 9 for re-assessment), synthetic Review navigable-but-uncounted, applied identically in shell / dashboard / review / section header (#6).
4. **Scoped sub-navigation** — stepper + bottom nav appear only in the wizard, not on Home/Status/History (#1 + #3).
5. **Less scrolling** — two-column rows, fieldset sub-cards, progressive disclosure, wider grid column on heavy sections (#7).

---

## 5. Prioritised roadmap

Effort: **S** ≈ <½ day · **M** ≈ 1–2 days · **L** ≈ 3–5+ days. FE = front-end only; SVR = needs server/query changes.

| # | Item | Issue | Effort | FE/SVR | Sequencing / dependency |
|---|------|-------|--------|--------|-------------------------|
| **Quick wins** | | | | | |
| Q1 | **Fix stale progress/stepper** — `router.refresh()` after save in `SectionForm.onSubmit` | #5, #4 | **S** | FE | Independent. Ship first — clears two defects in one change. |
| Q2 | **Unify the denominator** — pass `countSynthetic={false}` to lead stepper; reconcile review header "Step 10 of 11" | #6 | **S** | FE | Independent. |
| Q3 | **One footer** — remove `SectionForm` nav block; scope `PortalBottomNav` to `/apply/*`; wire real Back | #3 | **S–M** | FE | Pairs naturally with shell work (P1). Can land standalone if footer kept in-form instead. |
| Q4 | **Add Sign out to the portal shell** — reuse `admin-nav.tsx:234` form + `/api/auth/logout` | #1 (part) | **S** | FE | Independent; high perceived value, trivial cost. Do early even before full nav. |
| **Medium** | | | | | |
| M1 | **Demote guidance off Home** — collapse `PortalGuidanceTabs` to a link/accordion; reorder dashboard to lead with state-appropriate primary | #2 | **M** | FE | Depends on M2 (`/help` target) or ship as collapsed accordion first. |
| M2 | **`/help` page** — host `PortalGuidanceTabs` (How to Apply / Checklist / T&Cs PDF) | #2 | **S–M** | FE | New route in `(portal)`; reuses existing component. |
| M3 | **Reduce section scrolling** — two-column rows + fieldset sub-cards + progressive disclosure, starting with Income, then Additional Info; widen grid column | #7 | **M–L** | FE | Per-section; independent; can be staged section-by-section. |
| **Larger IA** | | | | | |
| L1 | **Portal shell + persistent nav** — `PortalNav` (Home / My Application / Documents / History / Help / Account); scope stepper to `/apply/*`; mobile menu sheet | #1 | **L** | FE (mostly) | Cornerstone. Q3/Q4 fold into this. Mostly FE; "Documents" as its own area (L2) may want a query. |
| L2 | **Documents as a first-class area** — `/documents` aggregating uploads + the paused `/respond` task, badged in nav | #1, #2 | **M–L** | SVR | Needs a query to list an application's documents by slot (data exists; not yet aggregated for a standalone page). Depends on L1. |
| L3 | **State-adaptive dashboard polish** — nav badging for paused, "My Application" target adapts pre/post submit | #1, #2 | **M** | FE | Depends on L1; uses states already computed in `page.tsx`. |

**Recommended sequence.** Ship **Q1–Q4** immediately (defects + sign-out + footer — all S, high trust impact). Then **L1** (the shell — the thing that makes it "feel like a portal"), folding in Q3/Q4. Then **M1+M2** (guidance demotion + `/help`) and **M3** (scrolling), which are independent and can run in parallel. **L2/L3** last, as polish on the new frame.

**Pure FE vs needs server.** Everything except **L2** (Documents aggregation query) is achievable front-end / in existing server components. **Q1** touches client navigation only. No schema/migration work is implied by any item.

---

## 6. Open questions / decisions for the client

1. **"Documents" as a standalone area** — do parents need a single place to see *all* uploaded documents across sections, or is "upload within the section / respond to a request" sufficient? This decides whether L2 is in scope (and whether we need the aggregation query). The audit shows uploads are currently scattered across form sections + `/respond` with no consolidated view.
2. **Help placement** — move guidance fully to `/help` (cleanest Home), or keep a collapsed accordion on Home for first-time applicants? Re-assessment parents almost certainly don't need it on Home.
3. **"My Application" after submission** — should the nav item point at the read-only `/status`, the `/submitted` summary, or stay labelled "My Application" pointing at status? Affects post-submit wording.
4. **Canonical footer choice** (#3) — sticky shell footer (more app-like, slightly more wiring) vs in-form footer (simpler, scrolls with content). Recommend sticky-but-scoped; confirm.
5. **Section sub-steps for Income** (#7) — is splitting a two-parent income section into Parent 1 / Parent 2 panels acceptable, or must both parents stay on one continuous page for at-a-glance totals?
6. **Sign-out everywhere vs idle-only** — the portal currently relies on `IdleLogoutWatcher` (auto) only. Confirm an explicit manual Sign out in the shell is wanted (recommended; shared-device safety). No security objection — the endpoint and CSRF guard already exist.
7. **Re-assessment denominator** — confirm "N of 9 (Family ID skipped)" is the desired wording for re-assessment, matching the existing `page.tsx:122-126` behaviour, once denominators are unified.

---

*All file/line references verified against the working tree on branch `fix/contact-edit-form-prefill` as of 2026-06-07. No code was modified.*
