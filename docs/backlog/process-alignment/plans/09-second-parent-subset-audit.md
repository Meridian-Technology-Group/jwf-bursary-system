---
title: Second-parent (P/G2) restricted-view subset — audit
status: reference
area: household, forms
epic: 09
related:
  - 09-complex-household-and-second-parent.md
---

# 09 — Second-parent restricted-view subset audit

Plan 09 §3.2 requires the restricted secondary (P/G2) view to ask the second
parent **only**: their own contact block, their **own income & evidence**, and
**their own declaration** — **not** the child/household-level questions (school,
dependants, court orders, household assets) which belong to the lead. This
document records the audit of the live `(contribute)` route against that subset.

## What the second parent sees today (verified)

The restricted route is a **separate route group** — `src/app/(contribute)/` —
not the full applicant wizard. The section list is hard-pinned in
`src/app/(contribute)/contribute/[section]/page.tsx`:

```
SECTION_ORDER = [PARENT_DETAILS, PARENTS_INCOME, ASSETS_LIABILITIES] → review → submit
```

There is **no** path to CHILD_DETAILS, FAMILY_ID, DEPENDENT_CHILDREN,
DEPENDENT_ELDERLY, OTHER_INFO, ADDITIONAL_INFO, or DECLARATION (the
child/household sections). The slug→section map only resolves those three slugs;
any other slug `notFound()`s.

| Section | Shown to P/G2? | Scope as rendered | §3.2 verdict |
|---|---|---|---|
| CHILD_DETAILS | No (not routable) | child shown READ-ONLY, name only, in the header | ✅ no leakage |
| FAMILY_ID | No | — | ✅ |
| PARENT_DETAILS | **Yes** | `secondaryMode` — sole-parent toggle + P/G2 block **suppressed**; only the single-earner "Parent / Guardian 1" contact + employment + **own declaration** render | ✅ own subset only |
| DEPENDENT_CHILDREN | No | — | ✅ |
| DEPENDENT_ELDERLY | No | — | ✅ |
| OTHER_INFO (court orders, maintenance, insurance, outstanding fees) | No | — | ✅ household-level, stays with lead |
| PARENTS_INCOME | **Yes** | `isSoleParent` — single-earner income sub-tables for **their own** declared employment status + their own evidence uploads | ✅ own subset only |
| ASSETS_LIABILITIES | **Yes** | `isSoleParent` — their own assets/liabilities + own bank statements | ✅ own subset only |
| ADDITIONAL_INFO | No | — | ✅ |
| DECLARATION | (own declaration tick is embedded in PARENT_DETAILS `secondaryMode`) | per-parent declaration only | ✅ |

## Confidentiality framing (verified present)

`contribute-section-client.tsx` already renders the §3.2 contributor framing on
every secondary section:

> "You are providing your own financial details for the bursary application for
> **&lt;child&gt;**. Your information is confidential — the other parent cannot
> see what you enter here."

The child is shown **read-only, name only** (resolved server-side from the
secondary's contributor context — never a client-supplied id; IDOR-hardened).

## Server-side guarantees (verified)

- The owning contributor + application are resolved **server-side from the
  session** (`getSecondaryContributorContext`), never from a client id.
- All reads run under the secondary's **RLS context**, which permits only their
  own owned rows (`ApplicationSection.ownerContributorId`,
  `Document.uploadedByContributorId`).
- `PARENT_DETAILS` is force-set `isSoleParent = true` so the parent-2 block stays
  hidden and the schema's parent-2 validation is skipped — the secondary can
  never enter a partner's details.

## Conclusion

**No household-level leakage exists.** The restricted view already asks the
second parent only the §3.2 subset (own contact, own income & evidence, own
declaration) with confidential, child-name-only framing. **No trimming was
required** — the audit is the deliverable for plan 09 §6 PR-2. The framing copy
called for in §3.2 / §5.3 is already present.

> Outstanding (non-blocking): if Charlotte confirms the second parent should
> also see a one-line summary of *which* sections the lead has completed, that is
> an additive enhancement — not a leakage fix — and is left for a follow-up.
