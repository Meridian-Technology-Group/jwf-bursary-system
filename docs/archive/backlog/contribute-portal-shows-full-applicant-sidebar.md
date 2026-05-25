---
title: Secondary-parent /contribute portal shows the full applicant section sidebar
status: done
severity: low
area: portal, dual-parent, ux
opened: 2026-05-25
opened_by: Brian Wagner (via Claude)
resolved: 2026-05-25
resolved_in: "#118 (PR), #119 (staging→main promotion)"
related:
  - src/app/(contribute)/layout.tsx
  - src/components/portal/portal-sidebar-sections.ts
  - src/app/(contribute)/contribute/*
  - "#109 (PR 4b — restricted secondary-parent portal)"
  - docs/archive/engineering/dual-parent-implementation-plan.md
---

## Resolution (2026-05-25, #118)

Gave `/contribute` its **own route-group layout** instead of inheriting the
applicant `(portal)` shell. Moved `src/app/(portal)/contribute/` →
`src/app/(contribute)/contribute/` (URLs unchanged — route groups don't affect
paths; the moved files are pure renames) and added
`src/app/(contribute)/layout.tsx`.

The new layout renders a **trimmed three-section stepper** — Your Details → Your
Income → Your Assets & Liabilities, plus a synthetic **Review** step — linking to
`/contribute/*`, with an owner-scoped **"N of 3"** progress bar built from
`getSectionGapStatuses(applicationId, contributorId)`. Keyed off the **route**
(not the user's identity), so a parent who is both a lead applicant on one
application and a second parent on another always gets the right nav per URL.

The sidebar primitives gained `basePath` (default `"/apply"`) and
`countSynthetic` (default `true`) props, so the applicant wizard is byte-for-byte
unchanged. The new layout also **omits the applicant sticky `PortalBottomNav`** —
the contribute `SectionForm` already renders its own Back/Continue — which
removed a duplicate, partly-dead bottom bar (confirmed in scope with the
reporter).

Verified live on a seeded second-parent session: sidebar shows the 3 steps +
Review with "0 of 3", no `/apply/*` links, no duplicate bottom bar.

## Context

Noticed during a Playwright walkthrough of the shipped dual-parent feature
(#20) on staging. The second parent's restricted `/contribute` flow reuses the
shared portal layout (`src/app/(portal)/layout.tsx`), so the left sidebar still
renders the **full 11-section applicant navigation** — Details of Child, Family
Identification, Dependent Children, …, Declaration & Submit — with links to
`/apply/*`, plus a "0 of 11 sections complete" progress bar.

The actual contribution flow in the main pane is correctly restricted (only the
second parent's own Parent Details → Income → Assets & Liabilities, child shown
read-only), and the `/apply/*` links are not a security hole: a second parent is
not a lead applicant, so `getOwnedApplicationContext` returns null and those
routes deny / redirect. The issue is purely the **misleading navigation** shown
to a second parent.

## Why it matters

- **Confusing for the second parent.** They're told they only need to provide
  their own financials, but the sidebar implies a 10-section application with a
  child-details/declaration flow they can't (and shouldn't) complete. The
  "0 of 11 complete" progress never reflects their actual 3-section progress.
- Low severity: cosmetic/UX only; no data or access-control impact (verified the
  `/apply/*` links are gated). But it undercuts the "simple, confidential,
  just-your-bit" promise the `/contribute` landing makes.

## Proposed approach

Give the `/contribute` route group its own trimmed sidebar/progress rather than
inheriting the applicant one. Options:

1. **Contribute-specific nav** (preferred): a sidebar listing only the three
   contribution steps (Your Details / Your Income / Your Assets & Liabilities)
   linking to `/contribute/*`, with a 0-of-3 progress bar scoped to the
   secondary contributor's owned sections (the data is already owner-scoped —
   see `getSectionGapStatuses(applicationId, ownerContributorId)`).
2. Parameterise `portal-sidebar-sections.tsx` with a `mode: "apply" | "contribute"`
   prop and a section list, so the layout can render the right nav based on the
   route segment.

Either way, suppress the "Details of Child / Family ID / Dependents /
Declaration" entries and the `/apply/*` links for contribute mode.

## Out of scope

- Any change to the contribution *flow* itself or its three sections (working as
  intended).
- The `/apply/*` route guards (already correct — a second parent is denied).
