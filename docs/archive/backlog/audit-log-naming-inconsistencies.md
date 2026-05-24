---
title: AuditLog action + entityType naming is inconsistent across call sites
status: done
severity: low
area: audit, consistency
opened: 2026-05-23
opened_by: Brian Wagner (via Claude, during API-reference authoring)
related:
  - src/app/api/siblings/route.ts (entityType "SIBLING_LINK", action "SIBLING_LINK_CREATED")
  - src/app/api/siblings/[id]/route.ts (entityType "SIBLING_LINK")
  - src/app/(admin)/applications/[id]/assessment/actions.ts (action "assessment.save" etc.)
  - docs/engineering/api-reference.md (audit action-key reference)
---

## Resolution (2026-05-24, forward-only)

Standardised on **SCREAMING_SNAKE** for `action` and the **PascalCase model
name** for `entityType`. Centralised the vocabulary in
`src/lib/audit/actions.ts` (`AUDIT_ACTIONS` / `AUDIT_ENTITY_TYPES` + derived
union types); `createAuditLog` now takes those unions so a typo is a compile
error. All call sites import the constants. No DB backfill — historical rows
keep their legacy values, and the audit page maps them via
`LEGACY_ACTION_ALIASES` / `LEGACY_ENTITY_TYPE_ALIASES` so old and new rows
render identically and the `SiblingLink` filter still matches legacy
`SIBLING_LINK` rows. The original audit listed 6 dotted `action` keys; in
practice the `settings.*` flows used 6 more dotted keys (incl. a
`reason_code.create`/`.update` ternary), all normalised here too.

## Context

The `AuditLog` rows written across the app use **two different naming
conventions**, surfaced while compiling the API reference:

- **Dotted lower-case** for assessment/recommendation flows, e.g.
  `assessment.begin`, `assessment.save`, `assessment.pause`,
  `assessment.complete`, `recommendation.save`.
- **SCREAMING_SNAKE** elsewhere, e.g. `SIBLING_LINK_CREATED`,
  `SIBLING_LINK_REMOVED`, and the GDPR / invitation actions.

Separately, the **`entityType`** column is mostly the PascalCase Prisma model
name (e.g. `Application`, `Assessment`), but the siblings routes write
`entityType: "SIBLING_LINK"` (SCREAMING_SNAKE) — an outlier
(`src/app/api/siblings/route.ts:99`, `src/app/api/siblings/[id]/route.ts:38,98`).

## Why it matters

Low — nothing is broken. But:

- The audit page filters by `entityType`; the `SIBLING_LINK` outlier won't group
  with other entity types and is easy to miss when filtering.
- Mixed `action` casing makes querying/reporting the audit trail
  (`docs/guides/walkthroughs/admins/13-audit-log-review.md`) harder and
  error-prone, and looks inconsistent in any export.

## Proposed approach

1. Pick one convention for `action` (recommend dotted lower-case `domain.verb`,
   which already dominates the assessment/recommendation flows) and normalise
   the SCREAMING_SNAKE call sites to match.
2. Make `entityType` consistently the PascalCase model name; change
   `"SIBLING_LINK"` → `"SiblingLink"`.
3. Decide whether to backfill historical rows or only normalise going forward
   (a forward-only change is simplest; the audit page can map legacy values).
4. Centralise the action/entityType vocabulary in one module so call sites can't
   drift again.

## Out of scope

- Changing the AuditLog schema itself.
- Backfilling historical audit rows, unless the team wants a clean dataset for
  reporting (decide as part of step 3).
