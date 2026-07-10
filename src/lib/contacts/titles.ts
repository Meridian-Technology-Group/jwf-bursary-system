/**
 * Title option lists for the contact register. Pure data — safe to import from
 * both server actions and client components.
 *
 * Parents use the adult set (Mr/Mrs/…); the child set is re-exported from the
 * portal application schema so the two flows stay consistent.
 */

export { CHILD_TITLES } from "@/lib/schemas/child-details";

export const ADULT_TITLES = [
  { value: "MR", label: "Mr" },
  { value: "MRS", label: "Mrs" },
  { value: "MS", label: "Ms" },
  { value: "MISS", label: "Miss" },
  { value: "DR", label: "Dr" },
  { value: "PROF", label: "Prof" },
  { value: "OTHER", label: "Other" },
] as const;

/** Resolve a stored title code (e.g. "MRS") to its display label ("Mrs"). */
export function titleLabel(
  value: string | null | undefined,
  list: ReadonlyArray<{ value: string; label: string }>
): string {
  if (!value) return "";
  return list.find((t) => t.value === value)?.label ?? value;
}
