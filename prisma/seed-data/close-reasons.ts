// prisma/seed-data/close-reasons.ts
// Definitive close reasons supplied by the client (2026-07-10), replacing the
// earlier placeholders. Every reason is purgeOnClose: false for now — a close
// never purges PII until the client confirms which reasons should flip to true.
// Label is the natural key; seed-reference upserts by label (idempotent).
// NOTE: the upsert does not delete labels removed from this list — old
// placeholders were removed from the DB directly when this list landed.

export const closeReasons = [
  { label: "Closed account – Applicant no longer interested in bursary support", purgeOnClose: false, sortOrder: 1 },
  { label: "Closed account – Applicant thinks he/she is above qualifying threshold & won’t pursue", purgeOnClose: false, sortOrder: 2 },
  { label: "Closed account – Assessment confirms above threshold, does not qualify for bursary support", purgeOnClose: false, sortOrder: 3 },
  { label: "Closed account – Family relocating", purgeOnClose: false, sortOrder: 4 },
  { label: "Closed account – Recipient accepted offer from another school", purgeOnClose: false, sortOrder: 5 },
  { label: "Closed account – Qualifies for a bursary but not part of admissions’ final shortlist", purgeOnClose: false, sortOrder: 6 },
  { label: "Closed account – End of cycle reached (year 13)", purgeOnClose: false, sortOrder: 7 },
  { label: "Closed account – ID checks fail", purgeOnClose: false, sortOrder: 8 },
  { label: "Closed account – Internal bursary request but not eligible for bursary support", purgeOnClose: false, sortOrder: 9 },
  { label: "Closed account – Debt situation escalated, withdrawal", purgeOnClose: false, sortOrder: 10 },
  { label: "Closed account – Recipient having disciplinary issues, withdrawal of the bursary award", purgeOnClose: false, sortOrder: 11 },
  { label: "Closed account – Applicant missed deadline(s) & gave up", purgeOnClose: false, sortOrder: 12 },
  { label: "Closed account – Applicant tampered with the documents, dishonesty flag", purgeOnClose: false, sortOrder: 13 },
  { label: "Closed account – Applicant could not submit the required documents", purgeOnClose: false, sortOrder: 14 },
] as const;
