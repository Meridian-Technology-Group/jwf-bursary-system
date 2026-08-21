/**
 * Child-name helpers (Epic 15 G2 / CH-09).
 *
 * The split first name / surname captured at invitation prep is the source
 * of truth. Legacy rows only carry the composed `childName` string, so
 * consumers fall back to a whitespace split (last token = surname) — the
 * pre-G2 behaviour, kept only as a fallback.
 */

export interface ChildNameParts {
  firstName: string;
  lastName: string;
}

export function resolveChildNameParts(source: {
  childName: string | null;
  childFirstName?: string | null;
  childLastName?: string | null;
}): ChildNameParts {
  const first = source.childFirstName?.trim();
  const last = source.childLastName?.trim();
  if (first || last) {
    return { firstName: first ?? "", lastName: last ?? "" };
  }

  const tokens = (source.childName ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: "", lastName: "" };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: "" };
  return {
    firstName: tokens.slice(0, -1).join(" "),
    lastName: tokens[tokens.length - 1],
  };
}

/** Compose the single-string backing store from the split fields. */
export function composeChildName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  return [firstName, lastName]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}
