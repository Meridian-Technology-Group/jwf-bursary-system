# Parent / Applicant Portal — Technical Implementation Plan

**Author:** Frontend engineering (implementation spec)
**Date:** 2026-06-07 (revised same day with locked client decisions)
**Status:** Ready to execute. Companion to `docs/ux/parent-portal-ux-proposal.md` (approved). All 10 client decisions of 2026-06-07 are baked in. No app code changed by this document.
**Branch base:** all work branches from `staging` per repo `CLAUDE.md`. Small, focused PRs targeting `staging`.
**Scope:** the `src/app/(portal)/` lead-applicant route group + its shared shell. The `(contribute)` secondary-parent group is touched **only** as a non-regression constraint — never modified here.

> Reference anchors throughout are `path:line` verified against the working tree on `fix/contact-edit-form-prefill`, 2026-06-07. Where a line moves during implementation, the function/JSX landmark named alongside it is the durable anchor.

> **This document is the complete handoff.** It is written to be executed with no prior conversation context. Everything needed to build is here.

---

## Decisions locked (2026-06-07)

The client reviewed the proposal's open questions and this plan's draft, and locked the following. These override any earlier "recommended / alternative / open" framing anywhere below.

1. **Desktop stepper = UNIFIED SINGLE RAIL.** Sections nest under "My Application" in the one persistent left rail (not a separate in-content column). Stepper gap data is still fetched in the `apply` segment but renders inside the rail owned by the persistent portal layout. Mechanism: a **parallel-route `@stepper` slot** on `(portal)/layout.tsx`, rendering nothing except under `/apply/*`. **Thin client-context bridge** is the documented fallback if slot wiring is awkward. (§2.2, §2.4, §2.7, PR-7.)
2. **Documents = first-class, in the nav from day one.** `PortalNav` includes "Documents" → `/documents` starting in PR-7 (shell), with a friendly empty state when no application exists (never hidden/disabled). Aggregation query + full page land in PR-8. (§2.2, PR-7, PR-8.)
3. **Sticky footer + provider — single path.** Canonical footer = scoped sticky `ApplyFooter` with `SectionSavingProvider` in the `apply` content segment. The "in-form footer fallback" is removed. (PR-7 / Q3.)
4. **"My Application" = stable label, adaptive target.** Label is always "My Application"; target = wizard (first incomplete section) while drafting, `/status` after submit. Never `/submitted`. (Default target set in PR-7; made adaptive in PR-9.)
5. **Round label stays OUT of the global persistent nav** — it stays in the stepper + dashboard only. No extra fetch in the root layout. (§2.4, PR-7/PR-9.)
6. **Two component families** — separate `PortalNav` vs the `/contribute`-shared stepper components. Do NOT parameterise one to do both. (PR-7.)
7. **Help = tiered.** Full guidance at `/help` (PR-4). On Home, a quiet "Need help? → Help" link in all states **except "invited, not started"**, where it is slightly elevated for first-timers. (PR-6.)
8. **Income = one continuous page.** Fix length with density + progressive disclosure (two-column rows, collapsible empty sub-tables, fieldset sub-cards, wider grid column). NO Parent 1 / Parent 2 sub-steps. (PR-10.)
9. **Denominator = real active sections only** → "of 10" (new) / "of 9" (re-assessment), applied identically in shell, dashboard, review, and section header. (PR-2.)
10. **Section-list consolidation = YES.** Collapse the 4–5 duplicate order/slug/title declarations into `src/lib/portal/sections.ts` as a standalone `chore/` PR **between PR-2 and the shell split** (now **PR-5** in the renumbered sequence). (§4.1, PR-5.)

---

## 0. TL;DR for the lead

- **Unified single rail is the spine (Decision 1).** The persistent left rail — owned by `(portal)/layout.tsx` and rendering `PortalNav` (Home / My Application / Documents / History / Help / Account→Sign out) — also hosts the section **stepper** nested under "My Application", but only while in the wizard. The stepper's gap data is fetched in the `apply` route segment yet rendered in the persistent rail via a **parallel-route `@stepper` slot** on the portal layout. `(portal)/layout.tsx` still owns the access guard + `IdleLogoutWatcher`; the wizard's **one canonical sticky footer** lives in the `apply` segment. The `(contribute)` group remains a fully independent sibling shell, untouched.
- **Staleness is already half-fixed server-side.** `saveSection` already calls `revalidatePath("/", "layout")` (`apply/actions.ts:229`), so the server cache for the layout subtree is invalidated on every save. The missing half is purely client: `SectionForm.onSubmit` calls `router.push(nextHref)` without `router.refresh()` (`section-form.tsx:99-101`). **`router.refresh()` re-executes server components in the current tree in place — including the `@stepper` slot's async body** — so adding it makes the stepper/progress live. This is the fix (one line), not a client store. The rail/slot restructuring does NOT by itself fix staleness; the `router.refresh()` is what does, and it ships first and stands alone.
- **Defects + sign-out ship first**, before the risky rail restructuring: PR-1 (`router.refresh()`, clears #5 + #4), PR-2 (`countSynthetic={false}` denominator unification, #6), PR-3 (Sign-out form, part of #1). Then PR-4 `/help` and PR-5 the section-list consolidation `chore/`. Q3 (one footer) is folded into the shell PR (PR-7).
- **Build order:** PR-1 (refresh) → PR-2 (denominator) → PR-3 (sign-out) → PR-4 (`/help`) → **PR-5 (`chore/` section-list consolidation)** → PR-6 (demote guidance off Home) → **PR-7 (unified-rail shell + `@stepper` slot + `PortalNav` + one footer + Documents nav item)** → PR-8 (`/documents` page + aggregation query) → PR-9 (nav badging + adaptive "My Application") → PR-10+ (scrolling, per-section, anytime).

---

## 1. Overview & sequencing

### 1.1 Roadmap → PR mapping

The proposal's roadmap items (Q1–Q4, M1–M3, L1–L3) re-sequenced into the order I would actually build and PR them, with the dependency that governs each.

| PR | Roadmap item(s) | Title | Size | Depends on | One PR? |
|----|-----------------|-------|------|-----------|---------|
| **PR-1** | Q1 (#5, #4) | `fix(portal): refresh stepper/progress after section save` | S | — | yes |
| **PR-2** | Q2 (#6) | `fix(portal): unify section denominator (exclude synthetic Review)` | S | — | yes |
| **PR-3** | Q4 (#1 part) | `feat(portal): add Sign out to the portal shell` | S | — | yes (interim footer; absorbed into PR-7's `PortalNav`) |
| **PR-4** | M2 (#2) | `feat(portal): /help page hosting guidance tabs` | S–M | — | yes |
| **PR-5** | (Decision 10) | `chore(portal): consolidate section order/slug/title into lib/portal/sections.ts` | M | PR-2 | yes |
| **PR-6** | M1 (#2) | `feat(portal): demote guidance off Home, lead with state primary` | M | PR-4 | yes |
| **PR-7** | L1 + Q3 + Q4 (#1, #3) | `feat(portal): unified-rail shell — @stepper slot + PortalNav + one footer + Documents nav item` | L | PR-1, PR-2, PR-3, PR-5 | **one PR, staged commits (7a/7b/7c)** |
| **PR-8** | L2 (#1, #2) | `feat(portal): /documents first-class area + aggregation query` | M–L | PR-7 | yes |
| **PR-9** | L3 (#1, #2) | `feat(portal): nav badging + adaptive My Application target` | M | PR-7, PR-8 | yes |
| **PR-10…n** | M3 (#7) | `refactor(portal): reduce scrolling — income / additional-info / …` | M–L | PR-5 (slug source) | **one PR per section** |

> **Renumber note (vs the draft):** the old PR-5 "demote guidance" is now **PR-6**; the section-list consolidation (Decision 10) is promoted from an open question into **PR-5**, slotted between the denominator fix (PR-2) and the shell split (PR-7). The old PR-6a/6b sub-split is replaced by a single **PR-7** with three staged commits (7a rail/slot, 7b `PortalNav` + sign-out + Documents item, 7c one-footer + saving provider) — they are commits, not separate merges, because no intermediate state (rail with neither nav nor stepper) is worth shipping.

### 1.2 Why this order

- **Defects + sign-out first (PR-1/2/3).** All S-sized, independent, high trust-impact, and all land cleanly on today's single-layout shell. They clear the client's two named defects and the most-cited "doesn't feel like a portal" gap (no sign-out) **before** the risky structural change. Per the risk register (§5) this de-risks the rail restructuring: if PR-7 must be reverted, the defects stay fixed.
- **`/help` before demote-guidance (PR-4 before PR-6).** M1 needs a target for the "→ Help" link. Building the route first makes PR-6 a pure Home re-order + a link, not a route+reorder bundle.
- **Section-list consolidation (PR-5) before the shell (PR-7).** Decision 10. Done after PR-2 (so the denominator defect is fixed regardless of this refactor) and before PR-7 (so the new `@stepper` slot and `apply/layout` import the canonical list rather than minting a fifth copy). Its blast radius (server actions, wizard, review, gap engine) is why it is isolated in its own `chore/` PR — see §4.1.
- **Unified-rail shell (PR-7) after the cheap wins.** The cornerstone and the riskiest piece (parallel-route `@stepper` slot, SSR/CSR boundaries, `/contribute` non-regression). Staged into 3 commits on one branch for reviewability; each independently revertable at the commit level.
- **Documents (PR-8) and badging (PR-9) last** — they sit on the finished frame; the only server work in the programme (the documents aggregation query, PR-8) is isolated there. The "Documents" **nav item** itself ships earlier, in PR-7 (Decision 2), pointing at an empty-state `/documents` until PR-8 fills it.
- **Scrolling (PR-10+) is orthogonal** — pure per-section FE refactors; depend only on PR-5 for the canonical slug import, else free to interleave.

### 1.3 Server vs front-end

Everything is front-end / existing-server-component except **PR-8** (a new aggregation query `getAllDocumentsForApplication`). **No schema/migration work** anywhere in this programme — confirmed: the `Document` model already carries `slot`, `filename`, `fileSize`, `uploadedAt`, `uploadedByContributorId` (`prisma/schema.prisma:259-278`), and a signed-URL route already exists (`src/app/api/documents/[id]/url/route.ts`).

---

## 2. Architecture — the layout-segment restructuring

### 2.1 The problem restated

Today `(portal)/layout.tsx` is doing **three** jobs that belong to different scopes:

1. **Portal-wide** (every page): the access guard (`layout.tsx:49-58`), `IdleLogoutWatcher` (`:126`), the shell chrome, and — missing today — persistent nav + sign-out.
2. **Wizard-only** (`/apply/*`): the section stepper + progress bar (`PortalDesktopSidebar`/`PortalMobileHeader` bodies are entirely `PortalSidebarContent`), the `getSectionGapStatuses` fetch (`:90-95`), and the sticky `PortalBottomNav` (`:159-161`).
3. It renders the wizard chrome on **every** page — so Home/Status/History/Submitted all get a section stepper and a dead bottom-nav (`PortalBottomNav` submit targets a non-existent `form="section-form"`, Back is a no-op — `portal-bottom-nav.tsx:23-34,39`).

### 2.2 The decision — unified single rail via a parallel-route `@stepper` slot (Decision 1)

The persistent left rail is **one** rail, owned by `(portal)/layout.tsx`. It renders `PortalNav` and, nested visually under the "My Application" nav item, the **section stepper** — but only while in the wizard. The challenge: the stepper's data is an **async server** read (`getSectionGapStatuses`, scoped to the PRIMARY contributor — `layout.tsx:69-95`) that should run **only on `/apply/*`**, yet it must render in the rail that structurally belongs to the **persistent** portal layout (not in the page content area).

**Mechanism: a parallel-route `@stepper` slot on `(portal)/layout.tsx`.** App Router parallel routes let a layout receive an additional, independently-routed subtree as a named prop. We add a `@stepper` slot directory whose only matching content is under `apply/`; for every other portal route it resolves to a `default.tsx` that renders `null`. The layout receives `stepper` as a prop alongside `children` and places it inside the rail, beneath the "My Application" item. Net effect:

- The gap-status fetch lives in `@stepper/apply/…` (the slot's segment) and therefore runs **only on `/apply/*`** — same scoping guarantee a nested layout would give, but the output renders in the persistent rail rather than the content column.
- On Home/Status/History/Documents/Help the slot resolves to `default.tsx` → `null`, so the rail shows nav only. No stepper, no gap fetch, no dead footer.
- `router.refresh()` (PR-1) re-executes the active server subtree **including the `@stepper` slot's async body**, so the live-progress fix carries over unchanged.

**`default.tsx` is mandatory.** A parallel slot that has no match for the current route renders its `default.tsx`; without one, App Router throws a 404 for unmatched segments on hard navigation. So the slot ships with `@stepper/default.tsx → export default function () { return null; }`. (Verified: Next 14.2.35; no parallel routes exist in this app yet, so this is the first — `find src/app -type d -name '@*'` returns nothing.)

**Documented fallback — thin client-context bridge.** If the slot wiring proves awkward (e.g. the slot's loading/error boundaries or the nested `apply/` segment inside the slot fight the existing `apply/[section]` segment), fall back to: render the stepper as a client component in the persistent rail, fed by a React context whose value is set from a tiny server component rendered inside the **content** `apply/` subtree. Concretely — `apply/layout.tsx` (content side) fetches the gaps and writes them into a `StepperDataProvider` mounted high enough to be read by a `RailStepper` client component in the persistent rail. This re-introduces a cross-tree data hop (the reason the slot is preferred) but keeps the single-rail visual. **Use the `@stepper` slot first; treat the bridge as the escape hatch and note in the PR which was used.** Either way the rail stays unified and `(contribute)` is untouched.

**Why not a separate in-content stepper column (the draft's option B):** rejected by Decision 1 — the client wants sections nested in the one persistent rail, not a second column.

**Why not a `usePathname()` client check that fetches on every page:** the gap fetch is async-server and must not run on Home (where there may be no application yet). The slot's `default.tsx` short-circuit gives "only fetch under `/apply/*`" for free.

### 2.3 Before / after route tree

```
BEFORE                                          AFTER  (unified rail + @stepper parallel slot)
src/app/(portal)/                               src/app/(portal)/
├─ layout.tsx  ── owns EVERYTHING:              ├─ layout.tsx  ── owns PORTAL-WIDE + the ONE rail:
│    • access guard + IdleLogoutWatcher         │    • access guard + IdleLogoutWatcher
│    • getSectionGapStatuses (always)           │    • <PortalNav> in the persistent rail
│    • <PortalDesktopSidebar> = stepper         │      (Home / My Application / Documents /
│    • <PortalMobileHeader>   = stepper         │       History / Help / Account→Sign out)
│    • <PortalBottomNav>      (every page)      │    • renders the `stepper` slot prop INSIDE the
│                                               │      rail, under "My Application"
│                                               │    • NO bottom nav, NO gap fetch of its own
│                                               │
│                                               ├─ @stepper/                 (NEW — parallel slot)
│                                               │    ├─ default.tsx           → renders null
│                                               │    └─ apply/
│                                               │       ├─ layout.tsx?        (optional; see §2.7)
│                                               │       ├─ [section]/page.tsx → <RailStepper …>
│                                               │       └─ review/page.tsx    → <RailStepper …>
│                                               │         (gap fetch lives HERE — /apply/* only)
│                                               │
├─ page.tsx          (Home)                     ├─ page.tsx          (Home)        ── nav only
├─ status/page.tsx                              ├─ status/page.tsx                 ── nav only
├─ history/page.tsx                             ├─ history/page.tsx                ── nav only
├─ submitted/page.tsx                           ├─ submitted/page.tsx              ── nav only
├─ respond/page.tsx                             ├─ respond/page.tsx                ── nav only
└─ apply/                                        ├─ help/page.tsx       (NEW, PR-4) ── nav only
   ├─ [section]/page.tsx                         ├─ documents/page.tsx  (NEW, PR-8) ── nav + empty
   └─ review/page.tsx                            └─ apply/   (the CONTENT segment — children)
                                                    ├─ layout.tsx  (NEW) ── wizard CONTENT chrome:
                                                    │    • <SectionSavingProvider> wrapper
                                                    │    • <ApplyFooter> = ONE canonical sticky footer
                                                    ├─ [section]/page.tsx
                                                    └─ review/page.tsx  ── own "Proceed" CTA, no footer
```

The `@stepper` slot and the `apply/` content segment are **two routings of the same `/apply/*` URL**: the slot supplies the rail's stepper, the content segment supplies the page + footer. Both are matched by App Router for any `/apply/*` route; the slot's `default.tsx` supplies `null` for every non-`apply` route so the rail is nav-only elsewhere.

### 2.4 What lives where after the restructuring

| Concern | File (after) | Notes |
|---|---|---|
| Access guard (`loadPortalAccessState` → `/portal-closed`) | `(portal)/layout.tsx` | unchanged logic (`layout.tsx:49-58`) |
| `IdleLogoutWatcher` | `(portal)/layout.tsx` | unchanged (`:126`) |
| Persistent nav (desktop rail + mobile header) | `(portal)/layout.tsx` → renders new `PortalNav` | new component; includes **Documents** item from PR-7 (Decision 2) |
| The `stepper` slot render position (inside the rail, under "My Application") | `(portal)/layout.tsx` | layout signature gains a `stepper` prop; placed in the rail (Decision 1) |
| Account / **Sign out** footer | `(portal)/layout.tsx` → `PortalAccountFooter` | reuses admin `<form action="/api/auth/logout">` pattern |
| **Round label** | stepper + dashboard only — **NOT** the persistent nav | Decision 5: no round read added to the root layout. The slot's stepper still shows it (it already fetches the round); dashboard already shows it. |
| `getSectionGapStatuses` + `buildSidebarSections` (the stepper data) | **`@stepper/apply/[section]` + `@stepper/apply/review`** | runs only under `/apply/*` (the slot); moved from current `layout.tsx:69-95` |
| Stepper render (tri-state icons, progress bar) | `@stepper` slot → `RailStepper` (wraps `PortalSidebarContent`) | `countSynthetic={false}` (Decision 9); `basePath="/apply"` |
| `@stepper` empty render for non-apply routes | `@stepper/default.tsx` | returns `null` — **mandatory** for parallel slots (§2.2) |
| Canonical sticky footer | `(portal)/apply/layout.tsx` (content segment) → `ApplyFooter` | the one Back / Save-and-Continue; in-form footer + `PortalBottomNav` both removed |
| Saving state for the one footer | `SectionSavingProvider` in `(portal)/apply/layout.tsx` | provider above both `SectionForm` (writes) and `ApplyFooter` (reads) — §2.7 |
| `<main>` width / padding wrapper | `(portal)/layout.tsx` keeps the content `<main>`; `apply/layout.tsx` adds the sticky footer beneath `children` | see §2.7 |

### 2.5 The staleness mechanism — definitive

**Root cause (confirmed):** `PortalSidebarContent` computes `completedSections`/`progressPct` from the `sections` prop (`portal-sidebar.tsx:119-138`). Those props originate from the layout's async body (`layout.tsx:90-95`), which App Router executes **once** and does not re-run on client-side navigation between sibling `/apply/[section]` routes. After a save, `SectionForm.onSubmit` does `router.push(nextHref)` (`section-form.tsx:101`) with **no** `router.refresh()`. Server data never re-reads → "0 of 11, 0%" forever.

**Decision: `router.refresh()` in `SectionForm.onSubmit`, immediately before the push.** Rationale and confirmation of sufficiency:

- `revalidatePath("/", "layout")` already runs inside `saveSection` (`apply/actions.ts:229`) → the server render cache for the layout subtree is invalidated. But `revalidatePath` only marks the cache stale; it does not push a new render to a client that is merely doing a soft `push`. `router.refresh()` is the client call that **re-requests the current route's server components and reconciles them in place**, picking up the now-fresh layout data.
- **Does `router.refresh()` re-execute the server body that fetches the gaps — wherever it lives?** Yes. `router.refresh()` re-fetches the server component payload for the **current route**, which includes every layout AND every parallel-route slot in the active segment chain. Today that body is the root `(portal)/layout` (`:90-95`); after PR-7 it is the `@stepper/apply/[section]` slot segment. In both cases `router.refresh()` re-runs it, re-calls `getSectionGapStatuses`, and the stepper re-renders with current data. So PR-1 is correct **before** the rail restructuring and stays correct after it — the slot is part of the refreshed subtree.
- **The rail restructuring does NOT by itself fix staleness.** Layouts and parallel slots both persist across navigations between sibling child pages (that is their purpose). Without `router.refresh()` the stepper would be just as frozen inside the `@stepper` slot as it is in today's layout. The two changes are independent: PR-1 fixes data freshness; PR-7 fixes scoping + placement. PR-1 ships first and stands alone.

**Wiring (PR-1), `section-form.tsx:96-102`:**

```ts
const result = await onSave(data);
if (result.success) {
  setSaveState("saved");
  router.refresh();             // ← re-runs server layout(s); picks up revalidated gap data
  if (nextHref) {
    router.push(nextHref);      // soft-navigate to the next section
  }
}
```

Order note: call `refresh()` then `push()`. `router.refresh()` does not block navigation; the push proceeds and the refreshed tree resolves for the destination route (whose layout + slot chain is the same). For the **last** section (Declaration), `onSave` throws `NEXT_REDIRECT` before we reach here, so no change to that path.

**Trade-off vs the client-store alternative.** A client progress store (Zustand/context, optimistic) would update the stepper with zero server round-trip and no flash. Cost: a second source of truth for completion that can drift from the authoritative server gap computation (`section-gaps.ts` runs the rule engine — the client cannot replicate "no error-severity gaps" cheaply or correctly). **Recommendation: `router.refresh()` only.** The refresh round-trip is one already-warm server render; any flash is sub-frame because the layout shell is unchanged and only the stepper's icons/bar update. Reach for a client store **only if** real-device testing shows a visible flash — and even then, scope it to the optimistic "this section is now saved" tick, leaving the authoritative tri-state to the refreshed server data.

### 2.6 `/apply/review` in the content segment + the slot

`apply/review/page.tsx` sits under `/apply`, so for the **content** segment it inherits `apply/layout.tsx` (footer wrapper), and for the **`@stepper` slot** it matches `@stepper/apply/review/page.tsx` → `RailStepper`. So Review shows the stepper in the rail (desirable: Review is a navigable waypoint; the synthetic Review entry highlights as active via `currentSlug === "review"`, `portal-sidebar.tsx:109-113`). **Confirmed desired.**

Its footer differs: Review has its own "Proceed to Declaration" CTA (`review/page.tsx:687-714`) gated on `hasBlockingGaps`, not a generic Save-and-Continue. So `ApplyFooter` is **conditional on route**:

- On `/apply/[section]` → render the canonical Back / Save-and-Continue (submits `form="section-form"`).
- On `/apply/review` → render **nothing** (the page owns its CTA). The footer's `usePathname()` returns early for `review`. This mirrors how the old `PortalBottomNav` already special-cased `/apply/declaration` (`portal-bottom-nav.tsx:17-18`).

`ApplyFooter` keeps a small `usePathname()` switch — it is a client component (`"use client"`), so this is free.

### 2.7 Unified-rail mechanics — the `@stepper` slot, footer placement, and the `<main>`/width gotcha

This section is the concrete how-to for Decision 1. There are **three** moving parts: (a) the `@stepper` parallel slot that puts the stepper in the persistent rail, (b) the content-side `apply/layout.tsx` that owns the sticky footer, (c) the desktop `<main>`/width + mobile sheet wiring.

**(a) The `@stepper` slot — files and wiring.**

```
src/app/(portal)/
├─ layout.tsx                              # signature gains `stepper` prop (see below)
└─ @stepper/
   ├─ default.tsx                          # export default () => null  (MANDATORY)
   └─ apply/
      ├─ [section]/page.tsx                # async; fetch gaps; <RailStepper sections=… />
      └─ review/page.tsx                   # async; same fetch; <RailStepper … />
```

`(portal)/layout.tsx` receives the slot as a prop and renders it inside the rail, under the "My Application" nav item:

```tsx
export default async function PortalLayout({
  children,
  stepper,                                 // ← the @stepper slot
}: { children: React.ReactNode; stepper: React.ReactNode }) {
  // …access guard, IdleLogoutWatcher, displayName (unchanged)…
  return (
    <div className="flex min-h-screen bg-canvas-50">
      {user ? <IdleLogoutWatcher /> : null}
      <aside className="hidden md:flex md:flex-col md:w-[280px] md:shrink-0 md:fixed md:inset-y-0 md:left-0 md:z-30 bg-white border-r border-slate-200 shadow-xs">
        <PortalNav userName={displayName} applicationHref={…} needsDocs={…}>
          {/* The stepper renders here, nested under "My Application", only on /apply/* */}
          {stepper}
        </PortalNav>
      </aside>
      <div className="md:hidden sticky top-0 z-30 w-full bg-white border-b border-slate-200 shadow-xs">
        <PortalNavMobileHeader userName={displayName} stepper={stepper} />
      </div>
      <div className="flex flex-1 flex-col md:ml-[280px]">
        <main id="main-content" className="flex-1 px-4 py-6 md:px-8 md:py-10 pb-24">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
        {/* NO footer here — the apply content segment owns it */}
      </div>
    </div>
  );
}
```

`@stepper/apply/[section]/page.tsx` is the only place the gap data is fetched after PR-7 — a near-verbatim move of `layout.tsx:69-95`:

```tsx
// src/app/(portal)/@stepper/apply/[section]/page.tsx  (async server component)
export default async function StepperSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  const resolved = await withUserContext(user.id, user.role as RlsRole, async (tx) => {
    const application = await getApplicationForUser(tx, user.id);   // returns all cols + round (verified)
    if (!application) return null;
    const ownerContributorId = await resolveOwningContributorId(tx, application.id, user.id);
    return { application, ownerContributorId };
  });
  if (!resolved?.application) return null;
  const gaps = resolved.ownerContributorId
    ? await getSectionGapStatuses(resolved.application.id, resolved.ownerContributorId)
    : await getSectionGapStatuses(resolved.application.id);
  const sections = buildSidebarSections(gaps, { isReassessment: resolved.application.isReassessment });
  const roundName = resolved.application.round?.academicYear
    ? `${resolved.application.round.academicYear} Assessment Round` : undefined;
  return <RailStepper sections={sections} roundName={roundName} />;
}
```

`@stepper/apply/review/page.tsx` is the same body (Review needs the same data so its synthetic entry highlights). Factor the fetch into a shared async helper, e.g. `loadRailStepper()` in `src/lib/portal/rail-stepper-data.ts`, called by both slot pages.

`RailStepper` is a thin client component wrapping the existing `PortalSidebarContent` with `basePath="/apply"` and `countSynthetic={false}` (Decision 9):

```ts
interface RailStepperProps { sections?: SidebarSection[]; roundName?: string; }
```

**(b) The content-side footer.** `(portal)/apply/layout.tsx` (the **content** segment, NOT the slot) wraps `children` in the saving provider and renders the one sticky footer:

```tsx
// src/app/(portal)/apply/layout.tsx
export default function ApplyContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionSavingProvider>
      <div className="flex min-h-[60vh] flex-col">
        <div className="flex-1">{children}</div>
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white shadow-md">
          <ApplyFooter />
        </div>
      </div>
    </SectionSavingProvider>
  );
}
```

This layout does **no** data fetch (the slot does); it is a client-or-server wrapper that exists purely to scope the footer + provider to `/apply/*`. Keep it a server component and let `SectionSavingProvider`/`ApplyFooter` carry the `"use client"` boundary.

**(c) Desktop width + mobile sheets.**
- Desktop: the persistent rail is `md:w-[280px] md:fixed`; the stepper renders inside it (under "My Application"). The content `<main>` keeps `max-w-3xl` (`layout.tsx:153`) — widen to `max-w-4xl` only for the grid-heavy Income section (PR-10), scoped to that section, not the layout.
- Mobile: the persistent nav is a Sheet from the mobile header (owned by `PortalNavMobileHeader`); the **stepper** is a second Sheet ("All sections") that also receives the `stepper` slot node and renders it only when on `/apply/*` (the slot is `null` elsewhere, so the "All sections" trigger can be conditionally hidden when `stepper` is empty — or simply rendered, showing nothing off-wizard). Both reuse the existing `Sheet` primitive (`portal-mobile-header.tsx:77-114`). Keep their `open` state in separate `useState`.

**Fallback (client-context bridge), if the slot fights the app:** drop `@stepper/`; instead have the **content** `apply/layout.tsx` fetch the gaps and publish them via a `StepperDataProvider` context; a `RailStepper` client component mounted in the persistent rail (`PortalNav` children) reads the context. Trade-off: re-introduces the cross-tree data hop the slot avoids, and the rail's stepper now depends on a context populated by the content subtree (works because both are under `(portal)/layout`, and the provider can sit in the root layout reading a value the content layout sets via a server→client prop). Prefer the slot; record in the PR which path shipped. (See §6 Open Q1 for the one genuinely-uncertain bit.)

**Why this satisfies Decision 1:** one rail, one `PortalNav`, the stepper nested under "My Application", gap data fetched only on `/apply/*`, and `router.refresh()` still drives liveness because the slot is in the refreshed subtree.

---

## 3. Per-item implementation specs

### PR-1 — Q1: refresh stepper/progress after save (#5 + #4)

**Files edited:** `src/components/portal/section-form.tsx`.

**Change.** In `onSubmit` (`section-form.tsx:90-119`), after `if (result.success)` and `setSaveState("saved")`, insert `router.refresh()` before the `router.push(nextHref)` (already wired, `:101`). `router` is already in scope (`:57`). No new imports.

```ts
if (result.success) {
  setSaveState("saved");
  router.refresh();          // NEW — re-run server layout, pick up revalidated gaps
  if (nextHref) router.push(nextHref);
} else { /* unchanged */ }
```

**Why this fixes #4 too.** The tri-state icons in `PortalSidebarContent` (`portal-sidebar.tsx:168-227`) already render from `section.status`; once the refreshed `sections` prop carries live statuses, the green/amber/grey icons appear with no further change. #4 is "stop feeding frozen data", not "build indicators".

**Secondary polish (optional, same PR or defer):** the active-but-incomplete state renders a numbered bubble (`portal-sidebar.tsx:203-205`) competing visually with the to-do `Circle`. Consider a filled accent ring for "current". Low priority; can be a follow-up.

**Edge cases / gotchas.**
- Declaration path is unaffected — `handleSave` for `DECLARATION` throws `NEXT_REDIRECT` from `submitApplication` before returning success (`section-page-client.tsx:311-335`), so the refresh line is never reached there.
- Do **not** also add `router.refresh()` to `(contribute)`'s form unless its sidebar is equally stale — out of scope here; the contribute form is a different component. (Verify separately if the second-parent stepper shows the same freeze; not part of this PR.)
- `router.refresh()` keeps client React state (the RHF form is being navigated away from anyway), so no input-loss risk.

**Verification.**
- `npx tsc --noEmit`, `npm run lint`.
- Manual: start a draft, complete `child-details`, Save & Continue → the left stepper's item 1 flips to a green tick and "1 of 10 … 10%" updates without a full reload. Matches the proposal's draft-in-progress state (`proposal §2.3`).
- New test (worth adding): a unit test is awkward for a `router.refresh()` side-effect; instead add a lightweight RTL test of `SectionForm` that mocks `next/navigation`'s `useRouter` and asserts `refresh` then `push` are both called on a successful `onSave`. Place under `src/components/portal/__tests__/section-form.test.tsx`. (No such test exists today — see §3 test note.)

---

### PR-2 — Q2: unify the denominator (#6)

**Files edited:** `src/app/(portal)/layout.tsx` (interim — pass `countSynthetic={false}`; this prop later moves to the `@stepper` slot's `RailStepper` in PR-7, where `countSynthetic={false}` is set permanently), `src/app/(portal)/apply/review/page.tsx` (review header copy). Optionally `src/components/portal/portal-sidebar-sections.ts` (comment only).

**Root mismatch (confirmed).** The lead stepper counts the synthetic Review step because `PortalSidebarContent` defaults `countSynthetic=true` (`portal-sidebar.tsx:102`) and the layout passes no override, so `countedSections.length` = 11 (`:119-121,234`). Dashboard uses 10 (`page.tsx:62`), section header uses `activeSectionOrder.length` = 10 (`[section]/page.tsx:363`), review's own counter uses `SECTION_ORDER.length` = 10 (`review/page.tsx:500`) but its **header** says "Step 10 of 11" (`:484`).

**Change A — stepper denominator.** Pass `countSynthetic={false}` to the lead stepper, exactly as `(contribute)` already does (`src/app/(contribute)/layout.tsx:90,102`). Concretely, in `(portal)/layout.tsx`, add `countSynthetic={false}` to both `<PortalDesktopSidebar …>` (`layout.tsx:130-134`) and `<PortalMobileHeader …>` (`:139-143`). The prop already threads through both components to `PortalSidebarContent` (`portal-desktop-sidebar.tsx:23,31`; `portal-mobile-header.tsx:37,102`). Result: the synthetic Review entry stays **navigable** (still in `sectionList`, still rendered in the `<ol>`), but is excluded from `countedSections` → "N of 10".

**Change B — review header copy.** `review/page.tsx:484` "Step 10 of 11 — Review" → reconcile to the new scheme. Review is a gate, not section 10-of-11. Recommended copy: drop the "Step X of Y" framing on Review and use e.g. `"Review — final check before you submit"`. The body counter `{completedCount} of {SECTION_ORDER.length}` (`:500`) is already "of 10" and correct — leave it.

**Re-assessment denominator (of 9).** `buildSidebarSections` already drops `FAMILY_ID` for re-assessments (`portal-sidebar-sections.ts:158-160`), and the dashboard drops it too (`page.tsx:124`). With `countSynthetic={false}`, the stepper counts real active sections only → 9 for re-assessment, matching dashboard. The chosen rule ("count real, active, non-synthetic sections") holds in both cases by construction. **No special-casing needed.**

**Edge cases / gotchas.**
- The mobile header already supports `countSynthetic` (`portal-mobile-header.tsx:42-48`) — make sure both desktop and mobile get the prop or they'll disagree (11 vs 10).
- Do not remove the synthetic Review entry from `DEFAULT_SIDEBAR_SECTIONS` — that would lose it as a navigable stepper row. Excluding from the *count* is the right lever, and it is what `countSynthetic` exists for.

**Verification.**
- **New unit test (high value, cheap):** `buildSidebarSections` is pure. Add `src/components/portal/__tests__/portal-sidebar-sections.test.ts` asserting: (1) default list has 11 entries, 1 synthetic; (2) a NEW application's counted length (filter `!isSynthetic`) = 10; (3) a re-assessment (`isReassessment: true`) drops `family-id` → counted = 9. This locks the denominator rule against regression.
- Manual: dashboard, section header, stepper, review all read the same N-of-10 (or 9). Matches `proposal §Issue#6`.
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/components/portal/__tests__/portal-sidebar-sections.test.ts`.

---

### PR-3 — Q4: Sign out in the portal shell (#1 part)

**Files created:** `src/components/portal/portal-account-footer.tsx` (small client component).
**Files edited:** `src/components/portal/portal-desktop-sidebar.tsx`, `src/components/portal/portal-mobile-header.tsx`.

This ships sign-out **before** the full nav (high value, trivial cost). It is later reused as the account footer inside `PortalNav` (PR-7) — but standing it up now means the shared-device safety gap closes immediately.

**New component:**

```tsx
// src/components/portal/portal-account-footer.tsx
"use client";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalAccountFooterProps {
  userName: string;
  /** Compact (mobile sheet) vs full (desktop rail). */
  variant?: "rail" | "sheet";
}

export function PortalAccountFooter({ userName, variant = "rail" }: PortalAccountFooterProps) {
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
      <p className="truncate text-xs text-slate-500">Signed in as</p>
      <p className="truncate text-sm font-medium text-primary-900">{userName}</p>
      {/* Reuses the proven admin pattern: form POST to the CSRF-guarded route. */}
      <form action="/api/auth/logout" method="POST" className="mt-2">
        <button
          type="submit"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500",
            "hover:bg-slate-100 hover:text-primary-900 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          )}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
```

**Edits.** Replace the bare "Signed in as {name}" footer in `portal-desktop-sidebar.tsx:34-40` and `portal-mobile-header.tsx:103-111` with `<PortalAccountFooter userName={userName} variant="…" />`. The sign-out form is the exact admin pattern (`admin-nav.tsx:234-248`) posting to the same `/api/auth/logout` route the `portal-closed` dead-end already uses (`portal-closed/page.tsx:42-49`, route `src/app/api/auth/logout/route.ts`).

**Edge cases / gotchas.**
- The logout route enforces CSRF via Origin/Referer (`logout/route.ts:18-35`); a same-origin `<form action>` POST satisfies it. No token needed.
- Keep this footer out of `(contribute)`'s sidebar usage — `PortalDesktopSidebar`/`PortalMobileHeader` are shared by `(contribute)`. **Gotcha:** editing the shared footer here changes the contribute shell too. That is acceptable/desirable (second parents also deserve sign-out), but call it out in the PR and verify `/contribute` still renders. If contribute must stay footerless, gate the footer behind a prop instead. Recommendation: add sign-out to contribute too (consistent, safe).

**Verification.**
- Manual: every portal page shows a Sign out control; clicking it clears the session and lands on `/login`. Repeat on `/contribute`.
- `npx tsc --noEmit`, `npm run lint`.

---

### PR-4 — M2: `/help` page (#2)

**Files created:** `src/app/(portal)/help/page.tsx`.
**Files edited:** none (component reused as-is).

```tsx
// src/app/(portal)/help/page.tsx
import { PortalGuidanceTabs } from "@/components/portal/portal-guidance-tabs";

export const metadata = { title: "Help & Guidance" };

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Help &amp; guidance</h1>
        <p className="mt-1 text-sm text-slate-500">
          How to apply, the document checklist, and the bursary terms &amp; conditions.
        </p>
      </div>
      <PortalGuidanceTabs />
    </div>
  );
}
```

**Notes.**
- `PortalGuidanceTabs` is already a self-contained client component with the 28rem T&Cs PDF (`portal-guidance-tabs.tsx:248-252`). It takes an optional `isRollingOver` prop (`:36-43`); on a standalone `/help` omit it (defaults false) — the checklist's first-application flag still renders fine.
- This page inherits the persistent nav after PR-7. Because PR-4 lands **before** PR-7, the page transiently shows the old wizard chrome (today's shell renders the stepper on every page) — acceptable and still navigable. With the `@stepper` slot in place (PR-7), `/help` resolves the slot to `default.tsx` → `null`, so the rail is nav-only. No action needed.

**Verification.** Manual: `/help` renders all three tabs incl. inline PDF. `npx tsc --noEmit`, `npm run lint`.

---

### PR-5 — Decision 10: consolidate the section list into `src/lib/portal/sections.ts`

**Files created:** `src/lib/portal/sections.ts`.
**Files edited (replace local declarations with imports):** `src/components/portal/portal-sidebar-sections.ts`, `src/app/(portal)/page.tsx`, `src/app/(portal)/apply/[section]/page.tsx`, `src/lib/portal/section-gaps.ts`, `src/app/(portal)/apply/actions.ts`, `src/app/(portal)/apply/review/page.tsx`.

**Why a standalone `chore/` PR (sequenced between PR-2 and PR-7).** The denominator just drifted (#6) precisely because the ordered section list is declared in 4–5 places. PR-2 fixes the *symptom* (the count). This PR removes the *cause* (duplicate sources) so it can't recur, and it must land before PR-7 so the new `@stepper` slot imports the canonical list rather than minting a fifth copy. It is isolated because its blast radius spans server actions + the wizard + review + the gap engine — exactly the surface you do not want entangled with the shell change.

**The canonical module:**

```ts
// src/lib/portal/sections.ts  (server- and client-safe; NO "use client", NO "server-only")
import { ApplicationSectionType } from "@prisma/client";

export const SECTION_ORDER: ApplicationSectionType[] = [
  "CHILD_DETAILS", "FAMILY_ID", "PARENT_DETAILS", "DEPENDENT_CHILDREN",
  "DEPENDENT_ELDERLY", "OTHER_INFO", "PARENTS_INCOME", "ASSETS_LIABILITIES",
  "ADDITIONAL_INFO", "DECLARATION",
];

export const SECTION_TO_SLUG: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "child-details", FAMILY_ID: "family-id", PARENT_DETAILS: "parent-details",
  DEPENDENT_CHILDREN: "dependent-children", DEPENDENT_ELDERLY: "dependent-elderly",
  OTHER_INFO: "other-info", PARENTS_INCOME: "parents-income",
  ASSETS_LIABILITIES: "assets-liabilities", ADDITIONAL_INFO: "additional-info",
  DECLARATION: "declaration",
};

export const SLUG_TO_SECTION: Record<string, ApplicationSectionType> =
  Object.fromEntries(Object.entries(SECTION_TO_SLUG).map(([k, v]) => [v, k])) as Record<string, ApplicationSectionType>;

// The page-header / review-card titles. (NOTE: the wizard uses a slightly different
// FAMILY_ID title than review — see gotcha below; keep BOTH maps until reconciled.)
export const SECTION_TITLES: Record<ApplicationSectionType, string> = { /* … */ };

/** Sections that are hidden for a rolling-over re-assessment (currently just FAMILY_ID). */
export const REASSESSMENT_HIDDEN: ApplicationSectionType[] = ["FAMILY_ID"];
export const REASSESSMENT_SECTION_ORDER: ApplicationSectionType[] =
  SECTION_ORDER.filter((s) => !REASSESSMENT_HIDDEN.includes(s));
```

**Replace, one importer at a time:**
- `portal-sidebar-sections.ts:60-71` `SECTION_TYPE_TO_SLUG` → import `SECTION_TO_SLUG`. (Keep `DEFAULT_SIDEBAR_SECTIONS` — it carries the synthetic Review entry + labels the stepper needs; but derive its ordering from `SECTION_ORDER` so it can't drift.)
- `page.tsx:50-62` `ALL_SECTION_TYPES` / `TOTAL_SECTIONS` → import `SECTION_ORDER`; `TOTAL_SECTIONS = SECTION_ORDER.length`.
- `[section]/page.tsx:39-94` `SLUG_TO_SECTION` / `SECTION_TO_SLUG` / `SECTION_ORDER` → import all; **keep** the wizard-specific `SECTION_TITLES` only if it differs from the canonical (it does — see gotcha).
- `section-gaps.ts:126-137` inline `SECTION_ORDER` → import.
- `apply/actions.ts:325-336` `ALL_SECTIONS` → import `SECTION_ORDER`.
- `review/page.tsx:47-58` `SECTION_ORDER` (+ `SECTION_SLUGS` `:78-89`, `SECTION_TITLES` `:65-76`) → import.

**Edge cases / gotchas.**
- **Title divergence.** The wizard's `SECTION_TITLES` (`[section]/page.tsx:83-94`) differs from review's (`review/page.tsx:65-76`) — e.g. `FAMILY_ID` is "Details of Child — Identification" in the wizard but "Family Identification" on review; `CHILD_DETAILS` is "Details of Child" vs "Details of Child". **Do not silently merge them.** Either keep two title maps (canonical + a wizard override) or get product to pick one. Flag in the PR; this is a copy decision, not a refactor decision.
- `section-gaps.ts` is `server-only` (`:19`); `sections.ts` must therefore carry **no** `"use client"` and **no** `"server-only"` so it imports cleanly into both server (`section-gaps`, `actions`) and client (`portal-sidebar-sections` is imported by client `portal-sidebar.tsx`) trees. It is plain data + pure helpers — safe in both, exactly like `portal-sidebar-sections.ts` is today (`portal-sidebar-sections.ts:7-9` documents this neutrality).
- Re-assessment: `REASSESSMENT_SECTION_ORDER` here must match `HIDDEN_REASSESSMENT_SECTIONS` from `@/lib/db/queries/reassessment` (used at `[section]/page.tsx:79-81`). Don't introduce a second hidden-set source — either re-export the existing one or keep `[section]/page.tsx` importing the reassessment module for hiding and `sections.ts` only for the base order. Verify they agree (both = `["FAMILY_ID"]` today).

**Verification.**
- `npx tsc --noEmit` (catches any record key mismatch), `npm run lint`.
- Full `npm test` — `section-rules.test.ts` and the new `portal-sidebar-sections.test.ts` (PR-2) must stay green; they exercise the section order indirectly.
- Manual smoke: wizard navigation, review deep-links ("Go fix this", `review/page.tsx:543-548`), dashboard count — all unchanged. This PR is behaviour-preserving by design.

---

### PR-6 — M1: demote guidance off Home, tiered help (#2, Decision 7)

**Files edited:** `src/app/(portal)/page.tsx`.

**Change.** Remove the always-on `<PortalGuidanceTabs … />` from the top of the dashboard (`page.tsx:297`) and the now-unused import (`:25`). Replace with a **tiered "Need help?" affordance** keyed on portal state (Decision 7):

- **All states except "invited, not started"** → a quiet link row near the bottom of the page:

```tsx
{/* Quiet help link — all states except invited-not-started (Decision 7). */}
<div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
  <span className="text-slate-500">Need help? </span>
  <Link href="/help" className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800">
    How to apply · Checklist · Terms &amp; Conditions
  </Link>
</div>
```

- **"Invited, not started"** (the `invitation` branch where no application exists yet, `page.tsx:483-494`) → a **slightly elevated** help card directly under the `ApplicationTypeChooser`, for first-timers — a bordered call-out (not just a link row), still pointing at `/help`, e.g. heading "New to bursary applications?" + one line + a "Read the guidance" button. Same destination, more prominence.

The state is already known in `page.tsx`: the `application` branch vs the `invitation` branch vs the no-invitation fallback (`:299`, `:483`, `:495`). Place the quiet link in the `application` and no-invitation branches; place the elevated card in the `invitation` branch.

**Lead-with-state (re-order).** The pieces already exist; this PR only re-orders so the state-appropriate primary is above the fold (`proposal §2.3`, §2.6). Within the `application` branch:
- Keep the **paused "Action needed"** link first (`page.tsx:309-331`) — already first among the cards; ensure nothing (the removed guidance) precedes it.
- Then the **status card** (`:334-385`) for submitted/assessing.
- For a **draft**, the proposal wants a "Continue — N of M" primary card with the next-incomplete section + deadline countdown above the fold. The countdown already renders for drafts (`:304-306`); progress lives inside the status card (`:364-384`). Minimal version: remove guidance, keep the existing order (countdown → status+progress → quick actions). Fuller version (recommended, still this PR): lift a compact "Continue where you left off — N of M · Next: {section}" card to the top of the draft branch, reusing `completedSections`/`totalSections` already in scope (`:99-101`). "Next incomplete section" needs the per-section status list — already fetched as `getSectionStatusList` server-side (`page.tsx:141`); thread the first incomplete slug down as a prop for the deep-link, else link to `/apply/child-details` (current behaviour, `:399`).

**Edge cases / gotchas.**
- `isRollingOver` (`page.tsx:274-276`) was only used to feed `PortalGuidanceTabs`. After removal it may become unused — delete it if so to keep lint clean (verify it is referenced nowhere else first).
- Don't regress the **no-invitation** and **invited-not-started** branches (`page.tsx:483-509`) — guidance demotion only changes the help affordance; the onboarding `ApplicationTypeChooser` (`:489`) stays front-and-centre, with the elevated help card *below* it.
- Re-assessment "welcome back" copy is unaffected (lives in the chooser / invitation branch); a re-assessment parent is in the `invitation` branch only when they have a pending re-assessment and no current-round app (`:218-244`) — for them the elevated card is fine (they may still want the checklist), but it is acceptable to keep it elevated since the proposal notes re-assessment parents "almost certainly don't need it on Home" — if product prefers, gate the elevation to `eligibleType === "NEW"`. Default: elevate for all invited-not-started; flag the re-assessment nuance in the PR.

**Verification.** Manual across states (draft, submitted, paused, no-invite, invited): status/next-action above the fold; guidance is a single link row. `npx tsc --noEmit`, `npm run lint`. No existing test asserts dashboard order; optional snapshot test is low-value given the dynamic branches.

---

### PR-7 — L1 + Q3 + Q4: unified-rail shell — `@stepper` slot + `PortalNav` + one footer (#1, #3)

The cornerstone. **One branch, three staged commits** (7a/7b/7c) — not three merges, because no intermediate state (a rail with neither nav nor stepper) is worth shipping. The mechanism is fully specced in §2.7; this section is the file-by-file build.

#### Commit 7a — the `@stepper` parallel slot (rail-side stepper, scoped to `/apply/*`)

**Files created:**
- `src/app/(portal)/@stepper/default.tsx` — `export default function StepperDefault() { return null; }`. **Mandatory** (§2.2): without it, hard-navigating to a non-`apply` route 404s the unmatched slot.
- `src/app/(portal)/@stepper/apply/[section]/page.tsx` — async server component; fetches the gaps and renders `<RailStepper …>` (full body in §2.7(a)).
- `src/app/(portal)/@stepper/apply/review/page.tsx` — same body (shared via `loadRailStepper()`).
- `src/lib/portal/rail-stepper-data.ts` — `loadRailStepper()` async helper (the fetch extracted once; called by both slot pages).
- `src/components/portal/rail-stepper.tsx` — `RailStepper` client component wrapping `PortalSidebarContent` with `basePath="/apply"`, `countSynthetic={false}`.

**Files edited:**
- `src/app/(portal)/layout.tsx` — change the signature to accept the `stepper` slot prop; remove its own gap-status fetch (`:66-95`) and the bottom nav (`:159-161`). It still renders the rail `<aside>` and `<main>` column (§2.7(a) code block). At commit 7a it can still render the OLD `PortalDesktopSidebar` for nav-less continuity — but since 7b lands on the same branch immediately, prefer to bring in `PortalNav` together. Treat 7a/7b as inseparable commits.

`loadRailStepper()` is a verbatim lift of the current fetch (`layout.tsx:69-95`) and is correct: `getApplicationForUser` returns all `Application` columns + the `round` relation (it uses `include`, not `select` — verified `applications.ts:381-393`), so `application.isReassessment`, `.id`, and `.round?.academicYear` are all valid — exactly as the current layout already uses them (`layout.tsx:88-98`).

#### Commit 7b — `PortalNav` persistent rail + sign-out + Documents item

**Files created:**
- `src/components/portal/portal-nav.tsx` — the persistent nav (desktop rail body + active states), modelled on `admin-nav.tsx`. Accepts `children` (the stepper slot node) and renders it under the "My Application" item.
- `src/components/portal/portal-nav-mobile-header.tsx` — the **new** mobile header for the lead portal nav (logo + hamburger → nav Sheet). Receives the `stepper` slot node and exposes a second "All sections" Sheet that renders it (only non-empty on `/apply/*`). **Do NOT repurpose the existing `portal-mobile-header.tsx`** — see the `(contribute)` gotcha below.

**Files edited:**
- `src/app/(portal)/layout.tsx` — render `PortalNav` in the desktop `<aside>` (passing `{stepper}` as children) and `PortalNavMobileHeader` in the mobile header; render `PortalAccountFooter` (from PR-3) as the nav's footer. Change the metadata title default from "My Application" (`layout.tsx:33`) to "Bursary Portal" (`proposal §Issue#1`).

**`PortalNav` signature and item model (the shared primitive — §4):**

```ts
// src/components/portal/portal-nav.tsx  ("use client")
export interface PortalNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  match: string;                 // pathname to match for active state
  matchMode?: "exact" | "prefix";
  badge?: boolean;               // dot, e.g. paused → Documents. Wired in PR-9.
}

interface PortalNavProps {
  userName: string;
  /** Adaptive target for "My Application": wizard while drafting, /status after submit. Wired PR-9. */
  applicationHref?: string;
  /** Whether a paused document request exists (badges Documents). Wired PR-9. */
  needsDocs?: boolean;
  /** The @stepper slot node — rendered nested under "My Application" (null off /apply/*). */
  children?: React.ReactNode;
}
```

Items (constant membership — **includes Documents from this PR**, Decision 2 — `proposal §2.2`):

```ts
const PORTAL_NAV = (applicationHref: string): PortalNavItem[] => [
  { label: "Home",            href: "/",                       icon: Home,       match: "/",          matchMode: "exact" },
  { label: "My Application",  href: applicationHref,           icon: FileText,   match: "/apply",     matchMode: "prefix" },
  { label: "Documents",       href: "/documents",              icon: Upload,     match: "/documents", matchMode: "prefix" },
  { label: "History",         href: "/history",                icon: History,    match: "/history",   matchMode: "prefix" },
  { label: "Help & guidance", href: "/help",                   icon: HelpCircle, match: "/help",      matchMode: "prefix" },
];
// applicationHref defaults to "/apply/child-details" until PR-9 makes it adaptive (Decision 4).
```

Render the stepper `children` immediately **after** the "My Application" `<li>` (indented, visually nested) so it reads as that item's sub-navigation. On non-`apply` routes `children` is the slot's `null`, so nothing renders there — the rail is nav-only. Active-state via `usePathname()` + the admin gold-accent pattern (`admin-nav.tsx:95-126`): exact for Home, prefix for the rest; "My Application" active for any `/apply/*` (incl. `/apply/review`, `/apply/declaration`). The account/sign-out footer is `PortalAccountFooter` (PR-3).

**Decision 4 — "My Application" label/target:** the label is **always** "My Application". `applicationHref` (the target) is adaptive and finalised in PR-9: wizard (first incomplete section) while drafting, `/status` after submit, **never** `/submitted`. In this PR ship the static default `/apply/child-details`.

**Decision 5 — round label:** **not** in `PortalNav`. No round read is added to the root layout. The round label stays in the stepper (the slot already fetches it via `loadRailStepper`) and on the dashboard. `PortalNavProps` has no `roundName`.

#### Commit 7c — one canonical sticky footer + saving provider (Q3)

**Files created:**
- `src/app/(portal)/apply/layout.tsx` — the **content-segment** layout (no data fetch): wraps `children` in `SectionSavingProvider` and renders the sticky `ApplyFooter` (full body in §2.7(b)).
- `src/components/portal/apply-footer.tsx` — `ApplyFooter` (the one footer).
- `src/components/portal/section-saving-context.tsx` — `SectionSavingProvider` + `useSectionSaving()`.

**Files edited:**
- `src/components/portal/section-form.tsx` — **delete the in-form nav block** (`:225-266`), keeping the auto-save indicator (`:170-183`) and error summary (`:186-213`). Replace the local `setSaving` with `useSectionSaving().setSaving(...)` so the lifted state drives the footer button (`:58,91,116`).

**Files deleted:**
- `src/components/portal/portal-bottom-nav.tsx` — its role is now `ApplyFooter`. **Verified safe to delete:** the only real import is `(portal)/layout.tsx:22,160`; the references in `(contribute)/layout.tsx:16` and `section-form.tsx:41,225` are **comments**, not imports (grep-confirmed 2026-06-07). Re-grep before deleting.

**`ApplyFooter` (the one canonical footer — Decision 3, single path):**

```ts
// src/components/portal/apply-footer.tsx  ("use client")
// Scoped to /apply/* by living in apply/layout. SHELL footer — NOT in-form. (Decision 3.)
export function ApplyFooter() { /* reads usePathname() + useSectionSaving() */ }
```

Behaviour:
- `usePathname()`; if path is `/apply/review` → render nothing (the page owns its CTA, §2.6).
- **Back:** real handler — `router.back()`. Today's `PortalBottomNav` Back has **no** handler (`portal-bottom-nav.tsx:23-34`); this fixes that dead control.
- **Save-and-Continue:** `<button type="submit" form="section-form">` (unchanged mechanism, `portal-bottom-nav.tsx:37-49`); label "Review and Submit" on `/apply/declaration` (keep the special-case, `:17-18`).
- **Saving state:** reads `useSectionSaving().saving` for the disabled/spinner. The provider sits in `apply/layout.tsx` above **both** `{children}` (which contains `SectionForm`) and `ApplyFooter`, so the footer can reflect the form's saving state. `SectionForm` calls `setSaving(true/false)` in its `onSubmit`/`finally` (replacing its local `useState`). One button, one saving source. **The in-form-footer fallback offered in the draft is removed — this sticky-footer-with-provider is the locked single path (Decision 3).**

```ts
// src/components/portal/section-saving-context.tsx  ("use client")
const Ctx = React.createContext<{ saving: boolean; setSaving: (v: boolean) => void }>({ saving: false, setSaving: () => {} });
export function SectionSavingProvider({ children }: { children: React.ReactNode }) {
  const [saving, setSaving] = React.useState(false);
  return <Ctx.Provider value={{ saving, setSaving }}>{children}</Ctx.Provider>;
}
export function useSectionSaving() { return React.useContext(Ctx); }
```

**Edge cases / gotchas (whole PR).**
- **`(contribute)` MUST NOT regress — the single biggest trap.** `(contribute)/layout.tsx:29-30,85,96` imports `PortalDesktopSidebar` + `PortalMobileHeader` and uses them as its **stepper** shell. Therefore: (1) do NOT touch `portal-mobile-header.tsx` or `portal-desktop-sidebar.tsx` — they remain the contribute stepper components; (2) the lead portal gets a **new** `PortalNav` + `PortalNavMobileHeader`, leaving the shared stepper components behaviourally byte-identical; (3) `RailStepper` wraps `PortalSidebarContent` directly (not via `PortalDesktopSidebar`), so the lead rail and contribute rail share only the leaf content component, not the shell. **Verify `/contribute` manually after this PR** (stepper header, "N of 3", no portal nav).
- **Two component families confirmed (Decision 6):** `PortalNav`/`PortalNavMobileHeader` (lead persistent nav) vs `PortalDesktopSidebar`/`PortalMobileHeader` (the `/contribute`-shared stepper). Do not parameterise one to do both.
- **`@stepper/default.tsx` is required** — see §2.2. Test hard-navigation to `/`, `/status`, `/help`, `/documents` to confirm no slot 404.
- **`usePathname` boundary** — `PortalNav` is a client component; the root layout (server) passes serialisable props (`userName`, `applicationHref`, `needsDocs`) + the `stepper` slot node (a server-rendered React node, which is fine to pass through a client component as `children`).
- **Mobile two-sheet model** — the nav Sheet (hamburger, `PortalNavMobileHeader`) and the stepper Sheet ("All sections", also in `PortalNavMobileHeader`, fed the slot node). Reuse the `Sheet` primitive (`@/components/ui/sheet`); separate `useState` per sheet so their open state never collides.
- **PR-1's `router.refresh()` still drives liveness** — the `@stepper` slot is in the refreshed subtree (§2.5). Re-verify the stepper updates after a save once it lives in the slot.

**Verification.**
- Manual state table (`proposal §2.3`): on Home/Status/History/Documents/Help the stepper + footer are **absent** (slot → `null`); on `/apply/*` they are present in the rail; "My Application" highlights on all `/apply/*`; Sign out present everywhere; Documents item present and clickable (lands on the empty-state `/documents` until PR-8).
- `/contribute` unchanged — stepper header, "N of 3", no portal nav, no regression.
- Post-submit: `/apply/*` redirects to `/submitted` (`[section]/page.tsx:133-135`) so the wizard chrome never shows post-submit — confirm.
- Live progress: complete a section → stepper updates without reload (PR-1 carried into the slot).
- `npx tsc --noEmit`, `npm run lint`, full `npm test` (the `buildSidebarSections` test from PR-2 stays green).

---

### PR-8 — L2: `/documents` first-class area (#1, #2)

The **nav item** shipped in PR-7 (Decision 2). This PR fills the page + adds the aggregation query. Depends on PR-7 (nav + shell) and PR-5 (canonical slug source for section grouping).

**Files created:**
- `src/lib/db/queries/applications.ts` → new export `getAllDocumentsForApplication` (aggregation, ordered list — distinct from the existing `getDocumentsForApplication` map, `applications.ts:519-542`).
- `src/app/(portal)/documents/page.tsx` — server component.
- `src/components/portal/documents-list.tsx` — client component for per-document download (calls `/api/documents/[id]/url`).

**New query signature:**

```ts
export interface DocumentListItem {
  id: string;
  slot: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;          // ISO
}
export async function getAllDocumentsForApplication(
  tx: Tx,
  applicationId: string,
  ownerContributorId?: string, // scope to PRIMARY's own uploads (dual-parent)
): Promise<DocumentListItem[]>
```

Implementation mirrors `getDocumentsForApplication` (`applications.ts:522-542`) but returns an **ordered array** (newest first, or grouped by section/slot) and, critically, **scopes by `uploadedByContributorId`** when provided so the lead applicant never sees the secondary's uploads — exactly as the document URL route enforces (`api/documents/[id]/url/route.ts:88-103`) and as the review page scopes (`review/page.tsx:427-431`).

**Page composition.** The `/documents` page should:
1. Resolve the lead applicant's PRIMARY contributor (the established pattern: `resolveOwningContributorId`, self-heal under admin context — `[section]/page.tsx:184-193`).
2. Fetch `getAllDocumentsForApplication(tx, appId, ownerContributorId)` under `withUserContext`.
3. If the assessment is PAUSED with an outstanding request, surface the **"Action needed: upload requested documents"** card linking to `/respond` (reuse the markup from `page.tsx:309-331` / `status/page.tsx:159-183`).
4. List uploaded documents grouped by section, each with a Download button (humanised slot via `humaniseSlot`, `src/lib/documents/slots.ts:54-59`).

**`documents-list.tsx` download mechanic:** on click, `fetch('/api/documents/{id}/url?download=true')` → `{ url }` → `window.location.assign(url)` (the route signs a 5-min attachment URL, `api/documents/[id]/url/route.ts:48-49,126-129`). This is the same route the admin doc viewer uses; no new API.

**Edge cases / gotchas.**
- **RLS context.** The query runs under `withUserContext(user.id, role)` so RLS applies; the `ownerContributorId` filter is defence-in-depth on top. Do **not** run it under admin context.
- **No documents yet / no application (Decision 2 — locked):** show a **friendly empty state**, never hide or disable the nav item or redirect. With documents but no uploads: "No documents uploaded yet — you'll add documents as you complete your application." With **no application at all** (invited-not-started, or no invitation): a gentle "You don't have any documents yet. Once you start your application, anything you upload will appear here." plus a link to Home / begin. The Documents nav item is always present and always lands somewhere sensible.
- **Secondary parent** never reaches `/documents` (they're redirected to `/contribute`, `page.tsx:78-95`); but if they did, the `ownerContributorId` scoping plus RLS protects them. No special handling.
- **Re-assessment** documents: the same query returns whatever was uploaded for the current rolling application; identity docs from a prior year live on the prior application and are intentionally not shown here (consistent with "already on file").

**Verification.**
- Manual: upload across sections → `/documents` lists them with working downloads; paused state shows the action card.
- Cross-contributor: a lead applicant does not see a secondary's uploads (seed a dual-parent app to check).
- Unit test for `getAllDocumentsForApplication` ordering/scoping is possible but needs a DB; prefer a focused manual check plus reuse of existing document-rules coverage. `npx tsc --noEmit`, `npm run lint`.

---

### PR-9 — L3: nav badging + adaptive "My Application" target (#1, #2)

**Files edited:** `src/app/(portal)/layout.tsx` (compute `needsDocs`, `applicationHref`), `src/components/portal/portal-nav.tsx` (consume them).

**Change.**
- **`needsDocs`** — in the root layout, cheaply detect a paused assessment for the user's current application (the dashboard already reads `application.assessment?.status === "PAUSED"`, `page.tsx:309`). Pass `needsDocs` to `PortalNav`; render a dot on the Documents item (`PortalNavItem.badge`). The proposal badges Documents for paused (`proposal §2.3`, §2.5).
- **`applicationHref` (Decision 4 — locked):** the label stays "My Application" always; only the **target** adapts. Pre-submit → first incomplete section (else `/apply/child-details`); post-submit → **`/status`**. **Never `/submitted`.** The layout can tell from `formStatus`. Pass `applicationHref` to `PortalNav`.

**Edge cases / gotchas.**
- This adds one lightweight read to the **root** layout (paused + formStatus). Keep it a narrow `select` (assessment status + `formStatus` only), not the full application; it runs on every portal page. **Decision 5:** do NOT add a round read here — the round label stays out of the nav.
- "First incomplete section" for the pre-submit target reuses the per-section status list logic already in the dashboard (`getSectionStatusList`, `page.tsx:141`); if you don't want a second read in the layout, default `applicationHref` to `/apply/child-details` and let the wizard's own redirect logic land the user on the right section. Either is acceptable; the deep-link is a polish.

**Verification.** Manual: paused account shows a Documents badge; post-submit "My Application" → `/status` (never `/submitted`); draft → wizard. `npx tsc --noEmit`, `npm run lint`.

---

### PR-10+ — M3: reduce section scrolling (#7)

**One PR per section.** Independent of the shell; depends only on PR-5 for the canonical slug import where a section references slugs. Apply the patterns the codebase already contains (Assets is the exemplar: `<fieldset><legend>` + `grid sm:grid-cols-2`, `assets-liabilities-form.tsx:94,124,167,217`).

- **PR-10 Income** (`src/components/portal/sections/parents-income-form.tsx`) — **Decision 8: ONE continuous page, NO Parent 1 / Parent 2 sub-steps.** Reduce length with density + progressive disclosure only:
  - The `Row`/`MoneyRow` use a `grid-cols-3` one-input-per-row (`:81,88-99`); pair related figures two-up via `grid sm:grid-cols-2`.
  - **Collapse empty sub-tables** (`SubTable`, `:171`) — a sub-table with no declared figures renders collapsed (a `<details>`/disclosure), expandable on demand.
  - Keep the fieldset sub-card shape `SubTable` already has; the win is two-column rows + collapsing.
  - **Widen the grid-heavy column to `max-w-4xl`**, scoped to this section only. After PR-7 the width cap is the content `<main>` wrapper (`layout.tsx:153`); set the wider width on the Income section's own container (e.g. a wrapper `className` on the section card), NOT the layout, so prose/declaration keep `max-w-3xl`.
  - Both parents stay on one page for at-a-glance combined totals (Decision 8).
- **PR-11 Additional Info** (`additional-info-form.tsx`): the 6 circumstance cards (`CIRCUMSTANCES`, `:38`, rendered `:122`) are exceptions most parents skip; render as a compact checklist revealing the upload inline on demand (already conditional via `ConditionalField`, `:73`). Reduce the `rows={8}` textarea (`:154`) default height.
- **PR-12+ repeatables** (Family ID / Dependent Children / Dependent Elderly): tidy `useFieldArray` card chrome.

**Edge cases / gotchas.**
- Income has legacy-draft normalisation (`section-page-client.tsx:114-131`, `income-model.ts`); a layout-only refactor must not touch field `name`s (RHF paths) or the back-compat reader. Change presentation (grid/fieldset/disclosure), not the schema or field paths.
- The deep-link focus-by-`name` effect (`section-page-client.tsx:341-378`) relies on field `name` attributes — keep them intact so "Go fix this" from Review still lands. **Collapsing a sub-table must not hide a field a deep-link targets** — when a hash targets a field inside a collapsed disclosure, open it (the existing focus effect retries for 2s, `:370-373`; ensure the `<details>` is opened by the focus handler or default-open any sub-table that has a value).
- Two-column rows must stay single-column on mobile (`sm:grid-cols-2` already does this).

**Verification.** Manual: Income/Additional-Info noticeably shorter; deep-links from Review still focus the right field (incl. into a collapsed sub-table); mobile single-column; combined income total still visible without sub-stepping. `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/lib/portal/__tests__/section-rules.test.ts` (ensure no rule/path drift).

---

## 4. Shared primitives (build once, reuse)

| Primitive | New file | Used by | Replaces / dedupes |
|---|---|---|---|
| Canonical section list (`SECTION_ORDER` / slug / title maps) | `src/lib/portal/sections.ts` (PR-5) | sidebar, dashboard, wizard, gap engine, actions, review | the 4–5 duplicate declarations (§4.1) — Decision 10 |
| `PortalNavItem` type + `PORTAL_NAV` list | `portal-nav.tsx` (PR-7) | `PortalNav` (desktop + mobile) | the only source for nav membership |
| `PortalAccountFooter` (sign-out form) | `portal-account-footer.tsx` (PR-3) | desktop rail, mobile sheet, `PortalNav` footer | duplicated "Signed in as" blocks in `portal-desktop-sidebar.tsx:34-40` + `portal-mobile-header.tsx:103-111` |
| `RailStepper` (rail-side stepper) | `rail-stepper.tsx` (PR-7) | `@stepper` slot pages | wraps `PortalSidebarContent`; carries `countSynthetic={false}` (Decision 9) |
| `loadRailStepper()` (slot data fetch) | `rail-stepper-data.ts` (PR-7) | both `@stepper/apply/*` slot pages | single fetch (was `layout.tsx:69-95`) shared by `[section]` + `review` slots |
| `ApplyFooter` (one canonical footer) | `apply-footer.tsx` (PR-7) | `apply/layout` (content segment) only | `PortalBottomNav` (delete) **and** the in-form nav (`section-form.tsx:225-266`, delete) |
| `SectionSavingProvider` / `useSectionSaving` | `section-saving-context.tsx` (PR-7) | `SectionForm` (writes), `ApplyFooter` (reads) | lifts the single saving state so one button reflects it (Decision 3) |
| `getAllDocumentsForApplication` | in `applications.ts` (PR-8) | `/documents` | new; sibling to `getDocumentsForApplication` |

### 4.1 The duplicated section list — recommendation

The ordered section list / order array exists in **four** places today:

1. `DEFAULT_SIDEBAR_SECTIONS` + `SECTION_TYPE_TO_SLUG` — `portal-sidebar-sections.ts:45-71`
2. `ALL_SECTION_TYPES` / `TOTAL_SECTIONS` — dashboard `page.tsx:50-62`
3. `SLUG_TO_SECTION` / `SECTION_TO_SLUG` / `SECTION_ORDER` / `SECTION_TITLES` — `[section]/page.tsx:39-94`
4. `SECTION_ORDER` (again) — `section-gaps.ts:126-137`, and `apply/actions.ts:325-336` (`ALL_SECTIONS`), and `review/page.tsx:47-58`.

**Decision 10 (locked): consolidate into `src/lib/portal/sections.ts` as a standalone `chore/` PR — this is now PR-5, sequenced between PR-2 and PR-7.** The module exports `SECTION_ORDER`, `SLUG_TO_SECTION`, `SECTION_TO_SLUG`, `SECTION_TITLES`, and `REASSESSMENT_SECTION_ORDER`, consumed everywhere. Benefit: the denominator/order can never drift again (it just did — #6). It is isolated in its own PR because its blast radius spans server actions + wizard + review + gap engine. Done **after** PR-2 (the denominator symptom is fixed regardless of this refactor) and **before** PR-7 (so the new `@stepper` slot imports the canonical list rather than minting a fifth copy). Full file-level spec is in **PR-5** (§3). Note the title-divergence gotcha there (the wizard and review use different `FAMILY_ID` titles) — that is a copy decision to surface, not silently merge.

---

## 5. Risk register

| Risk | Likelihood | Impact | De-risk |
|---|---|---|---|
| **The `@stepper` parallel-route slot is now the single riskiest piece** (PR-7) — parallel routes are unfamiliar territory, no precedent in this app | Med | High | (1) Ship PR-1/2/3 (defects + sign-out) FIRST so they are fixed independently of the slot; if PR-7 is reverted, the defects stay. (2) The slot **must** have `@stepper/default.tsx → null` or non-`apply` routes 404 on hard nav — build and test that first. (3) Build PR-7 as 3 commits (7a slot, 7b nav, 7c footer); each commit reversible. (4) If the slot fights the existing `apply/` segment or its boundaries, fall back to the **client-context bridge** (§2.7) — the rail stays unified either way. (5) Verify hard-nav to `/`, `/status`, `/help`, `/documents` shows no slot 404. |
| **`(contribute)` regresses** when shared `portal-mobile-header.tsx` / `PortalDesktopSidebar` are touched | **High** | High | Decision 6 — two component families. Do NOT touch the shared stepper components; add **new** `portal-nav.tsx` / `portal-nav-mobile-header.tsx` for the lead nav; `RailStepper` wraps `PortalSidebarContent` directly. Manually verify `/contribute` (stepper header, "N of 3", no portal nav) after PR-7. |
| **Staleness "fix" insufficient** (refresh doesn't re-run the slot) | Low | Med | Confirmed: `router.refresh()` re-executes the active layout + parallel-slot chain, incl. `@stepper` (§2.5). Validate on a real device in PR-1, and again after the slot lands in PR-7; the server already `revalidatePath`s. |
| **Saving-state context is fragile** (PR-7) | Low | Low | Provider sits in `apply/layout` (content segment) above both `SectionForm` and `ApplyFooter` (§2.7(b)); both are inside `children`. No cross-tree hop. (The in-form fallback is removed per Decision 3 — single path.) |
| **Section-list consolidation breaks a consumer** (PR-5) | Med | Med | Behaviour-preserving by design; `npx tsc --noEmit` catches record-key mismatches; full `npm test`; isolated `chore/` PR so it can't entangle with the shell. Surface the title-divergence as a copy decision, don't merge silently. |
| **Denominator drift recurs** | Low | Med | PR-2 unit test on `buildSidebarSections` + PR-5 single source of truth. |
| **Documents query leaks secondary uploads** (PR-8) | Low | High | Scope by `uploadedByContributorId` + `withUserContext` RLS; mirror the URL route's contributor checks (`api/documents/[id]/url/route.ts:88-103`). |
| **Transient old chrome on `/help`** between PR-4 and PR-7 | Low | Low | Cosmetic only (today's shell shows the stepper everywhere); resolves automatically when the `@stepper` slot lands. No action. |
| **Income refactor breaks RHF paths / Review deep-links** (PR-10) | Med | Med | Decision 8 — density only, no sub-steps. Never touch field `name`s or the legacy normaliser; open a collapsed sub-table when a deep-link targets a field inside it; re-run `section-rules.test.ts`; manual deep-link check. |

---

## 6. Open technical questions

The six questions from the draft are all resolved by the 10 locked decisions (stepper placement → D1; component families → D6; section-list → D10; `/documents` empty state → D2; round label → D5; footer path → D3). Only the following genuinely-uncertain items remain — none block starting work; each is a "discover during PR-7/PR-8" item with a documented fallback already in the plan.

1. **`@stepper` slot vs the existing `apply/` content segment — do they coexist cleanly?** (PR-7.) A parallel slot (`@stepper/apply/…`) and a normal segment (`apply/…`) both match `/apply/*`. This is a supported App Router pattern, but this app has no prior parallel routes, so the one thing to validate in 7a is that the slot's `apply/` subtree does not need its own `loading.tsx`/`error.tsx` to satisfy the content segment's, and that hard-navigation + `router.refresh()` both resolve the slot. **Fallback is fully specced** (client-context bridge, §2.7) — so this is a "confirm the cleaner path works, else take the documented escape hatch" item, not a blocker. Record which path shipped in the PR.
2. **Does the rail need its own scroll containment when nav + stepper stack?** (PR-7.) The current rail is a single `PortalSidebarContent` with its own internal scroll (`portal-sidebar.tsx:163-164`). With `PortalNav` items above the stepper, a long stepper (11 entries) + nav may overflow the 100vh rail on short viewports. Likely fine, but verify on a small laptop; if it overflows, make the stepper region the scroll container and pin the account footer. Pure CSS, no architectural impact.
3. **`getAllDocumentsForApplication` grouping key.** (PR-8.) Grouping documents "by section" needs a slot→section map. The review page already has one (`SECTION_DOC_SLOTS`, `review/page.tsx:876-881`) but it is partial (4 sections). Decide whether to (a) reuse/extend that map, (b) group by humanised slot only (no section grouping), or (c) add a slot→section map to the new `lib/portal/sections.ts` (PR-5). Recommendation: (b) for the first cut (simplest, correct), enrich to (c) later. Not blocking; a presentation choice on an isolated page.

If none of the above surfaces a problem during PR-7/PR-8, there are **no** outstanding technical unknowns — the plan is fully determined by the 10 locked decisions.

---

*Plan grounded against the working tree on `fix/contact-edit-form-prefill`, 2026-06-07; revised the same day to bake in the 10 locked client decisions. New `path:line` claims (parallel-route `default.tsx` requirement, `PortalBottomNav` importer audit, `getApplicationForUser` `include`-not-`select` shape, `applications.ts:381-393`) re-verified against the working tree. No application code was modified in producing this document.*
