# 31 — Round summary

Backlink: [[README#Reports]]

The round-level totals — total applications, by status, by outcome,
and by school for the currently-selected round.

> **Note:** today's `/reports` page does not yet include a dedicated
> *Round summary* section. The information described below is partly
> derived from the **School Comparison** section and the round
> selector. A purpose-built **Round summary** section is spec'd and
> tracked separately; this guide reflects the README intent.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- At least one round exists.

## Steps

1. Sidebar → **Reports**. You land at `/reports` under the heading
   **Reports** with strapline *"Aggregate statistics for each
   assessment round."*
2. Use the **Round selector** (top-right of the page) to pick the
   round. The active round is selected by default. The URL updates with
   `?roundId=…`.
3. Read the **School Comparison** card — *"Side-by-side comparison of
   Trinity and Whitgift applications for this round."* — to get the
   per-school breakdown:
   - **Total applications** count.
   - **Avg bursary award** (%).
   - **Avg monthly payable fees** (£).
4. For per-status / per-outcome totals, cross-reference with `/queue`
   filtered by round (see [[01-triage-the-queue]]) and the **Status**
   popover.

## Verification

- The School Comparison cards render values for both schools.
- The round selector reflects the round you chose; the URL contains
  the matching `roundId`.

## Notes

- An at-a-glance dashboard with status counts already exists on
  `/admin` (the admin dashboard) — open it for a live tile view of
  the queue across all rounds.
- A purpose-built **Round summary** card on `/reports` is on the
  roadmap and will surface in this section once shipped.
