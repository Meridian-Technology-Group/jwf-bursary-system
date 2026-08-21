/**
 * Item 10 (Story 10.2/10.5) — the canonical PII scrub map.
 *
 * ONE place that says, per model, which fields count as personal data and what
 * value replaces them when scrubbed. BOTH erasure routines derive their
 * `data` payloads from here so they cannot drift:
 *
 *   - `purgeApplication` (src/lib/retention/purge.ts) — the GDPR/retention
 *     cascade. PROFILE-scoped intent: the applicant is being forgotten, so it
 *     hard-deletes the assessment, recommendation and form sections wholesale
 *     (financials included) and erases the lead profile + auth user.
 *   - `purgeClosedApplication` (src/lib/retention/close-purge.ts) — the
 *     reason-driven close purge (items 2/4/10). APPLICATION-scoped intent:
 *     personal data goes, but the Foundation's financial record stays — the
 *     assessment row (all Decimal figures, outcome, synopsis), the
 *     recommendation awards + reason codes, the bursary reference and key
 *     dates are RETAINED.
 *
 * Intentional differences between the two routines are documented inline —
 * everything SHARED lives here as a constant or builder, so adding a new PII
 * column means updating this file (and its exhaustiveness test) once.
 *
 * D-2 (resolved 2026-07-09): the assessment `synopsis` may contain names in
 * prose but is RETAINED VERBATIM on a close purge — the confirm dialog warns
 * staff, and the residual risk is flagged to the DPO. The GDPR cascade is
 * unaffected (it deletes the whole assessment row).
 */

/** Replacement for a scrubbed child name (both routines, all models). */
export const REDACTED_CHILD_NAME = "[Child Removed]";

/** Replacement for scrubbed required free-text (e.g. Contact.lastName). */
export const REDACTED_TEXT = "[Removed]";

/** Anonymised, undeliverable replacement email for an erased Profile. */
export function anonymisedProfileEmail(profileId: string): string {
  return `[deleted-${profileId}]@removed.invalid`;
}

/** Anonymised replacement email for a scrubbed Contact row (not unique). */
export const REDACTED_CONTACT_EMAIL = "[removed]@removed.invalid";

/**
 * Application — child identity is scrubbed; the row itself is NEVER deleted
 * (preserves the reference lineage, dates, school and — from A3 — the close
 * reason). Used by both routines.
 */
export const APPLICATION_CHILD_SCRUB = {
  childName: REDACTED_CHILD_NAME,
  childDob: null,
} as const;

/**
 * Profile — full personal erasure (name, phone, email) + role tombstone.
 * Used by both routines, but ONLY behind a shared-profile guard: the profile
 * must be linked to nothing beyond the application being erased (see
 * `decideSecondaryProfileErasure` and close-purge's lead guard).
 */
export function profileScrubData(profileId: string) {
  return {
    firstName: null,
    lastName: null,
    phone: null,
    email: anonymisedProfileEmail(profileId),
    role: "DELETED" as const,
  };
}

/**
 * Contact — the admin-managed register row holds a full second copy of the
 * family's PII (parent name/email/phone, home address, child identity,
 * free-text notes). Fixing a pre-existing residue gap: neither routine
 * scrubbed contacts before item 10. `lastName`/`childName`/`email` are
 * NOT NULL columns, so they take redaction tokens rather than null.
 */
export const CONTACT_SCRUB = {
  firstName: null,
  lastName: REDACTED_TEXT,
  email: REDACTED_CONTACT_EMAIL,
  phone: null,
  childName: REDACTED_CHILD_NAME,
  childDob: null,
  addressLine1: null,
  addressLine2: null,
  town: null,
  postcode: null,
  notes: null,
} as const;

/**
 * BursaryAccount — child identity is scrubbed; reference, status, dates and
 * benchmark figures are retained (they are the Foundation's financial
 * record). Fixing the second pre-existing residue gap.
 */
export const BURSARY_ACCOUNT_CHILD_SCRUB = {
  childName: REDACTED_CHILD_NAME,
  childDob: null,
} as const;

/**
 * Assessment — close purge only (the GDPR cascade deletes the whole row).
 * Free-text OTHER THAN the synopsis is treated as PII (Story 10.2: prose may
 * embed names/addresses). The synopsis is retained verbatim per D-2. All
 * Decimal financials, flags, outcome and dates are retained untouched.
 */
export const ASSESSMENT_FREETEXT_SCRUB = {
  manualAdjustmentReason: null,
  secondaryParentOverrideReason: null,
} as const;

/**
 * Recommendation — close purge only. Prose fields are scrubbed; the award
 * figures (`bursaryAward`, `scholarshipAward`, payable fees), categorical
 * strings (`accommodationStatus`, `incomeCategory` — reporting dimensions,
 * not prose) and reason-code links are retained.
 */
export const RECOMMENDATION_FREETEXT_SCRUB = {
  familySynopsis: null,
  summary: null,
} as const;

/**
 * Human-readable retained-vs-scrubbed summary for the close purge, consumed
 * by confirm-dialog copy and asserted against in tests so UI wording, code
 * and this map stay in step.
 */
export const CLOSE_PURGE_SUMMARY = {
  scrubbed: [
    "Child name and date of birth (application, bursary account, contact register)",
    "Parent name, email and phone (contact register; profile when no other live records)",
    "Home address and register notes",
    "Uploaded documents (files and records)",
    "Application form data (all sections)",
    "Free-text assessment notes other than the synopsis",
    "Invitations for this application",
  ],
  retained: [
    "Bursary reference and key dates",
    "All assessment financial figures and the outcome",
    "Assessment synopsis (verbatim — may contain personal data; see D-2)",
    "Recommendation awards, fee figures and reason codes",
    "Close reason, closing user and close date",
    "Audit trail (append-only; user links nulled only on full profile erasure)",
  ],
} as const;
