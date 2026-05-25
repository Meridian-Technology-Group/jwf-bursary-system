---
title: Secondary-parent /contribute portal shows the full applicant section sidebar
status: open
severity: low
area: portal, dual-parent, ux
opened: 2026-05-25
opened_by: Brian Wagner (via Claude)
related:
  - src/app/(portal)/layout.tsx
  - src/components/portal/portal-sidebar-sections.tsx
  - src/app/(portal)/contribute/*
  - "#109 (PR 4b — restricted secondary-parent portal)"
  - docs/engineering/dual-parent-implementation-plan.md
---

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
