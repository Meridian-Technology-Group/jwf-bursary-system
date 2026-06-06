/**
 * Terms & Conditions reference — Epic 05 (Decision D10).
 *
 * The Foundation supplied a single "legal customer" T&Cs PDF that a parent
 * accepts when taking a bursary award. This module is the ONE source of truth
 * for:
 *   - where the PDF is served from (a static asset under `public/`), and
 *   - which version string is stamped onto an application at submission
 *     (`applications.terms_version`, recorded per submission — D10).
 *
 * The version is a content marker, not a semver: bump it whenever the served
 * PDF is replaced so historic acceptances stay attributable to the exact
 * wording the parent saw. Keep `TERMS_AND_CONDITIONS_PATH` and the file in
 * `public/legal/` in lockstep.
 */

/** Public URL path of the served T&Cs PDF (relative to the site root). */
export const TERMS_AND_CONDITIONS_PATH = "/legal/terms-and-conditions.pdf";

/**
 * Version marker for the currently-served T&Cs document. Stamped onto
 * `applications.terms_version` at submission so a later document swap never
 * rewrites what a parent previously agreed to. Bump on every PDF replacement.
 */
export const TERMS_AND_CONDITIONS_VERSION = "2026-06";

/** Human label for the document, used in viewers and the submitted summary. */
export const TERMS_AND_CONDITIONS_LABEL =
  "Bursary Terms & Conditions (parent as legal customer)";
