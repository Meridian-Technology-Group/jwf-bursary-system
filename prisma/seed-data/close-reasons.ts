// prisma/seed-data/close-reasons.ts
// Placeholder close reasons (item 4.3, Story 4.3). Charlotte to send the
// full list and confirm each reason's purgeOnClose toggle — see the story
// notes at docs/backlog/stories/04-close-reason-dropdown.md. Until then,
// every placeholder is purgeOnClose: false so a close never purges PII
// on an unconfirmed setting. "Declined by the school" is the most likely
// candidate to flip to true once confirmed (a school decline implies no
// bursary was ever awarded), but that is Charlotte's call, not ours.

export const closeReasons = [
  { label: "Declined by the school", purgeOnClose: false, sortOrder: 1 },
  { label: "Relocation", purgeOnClose: false, sortOrder: 2 },
  { label: "Accepting another school offer", purgeOnClose: false, sortOrder: 3 },
] as const;
