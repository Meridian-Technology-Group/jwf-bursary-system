/**
 * A–Z ordering for the Reference column on the Applications and Assessments
 * lists.
 *
 * Charlotte, 10 Oct 2026: *"Could the REFERENCE headed column have an inbuilt
 * alphabetical sorting functionality when the user clicks on the word
 * REFERENCE?"*
 *
 * References are free text and re-edited to the fees-system code by hand, so
 * the same shape arrives spaced in different ways (`TS-ALI04-…` and
 * `TS - ALI04 - …`). A plain string sort would file every spaced one ahead of
 * every unspaced one, since a space sorts before a letter. So spacing and
 * punctuation are ignored, case is ignored, and digit runs compare as numbers
 * (`ADAM2` before `ADAM10`).
 */
const collator = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
  ignorePunctuation: true,
});

/** Ascending comparator; equal-looking references fall back to a plain compare so the order is stable. */
export function compareReferences(a: string, b: string): number {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}
