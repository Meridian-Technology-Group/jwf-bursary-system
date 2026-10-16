/**
 * Field picker + download link (Epic 23 T4, D-12). Pure so the client card
 * stays thin and every rule is unit-tested:
 *
 * - every box ticked by default; a remembered selection is reused only for
 *   keys the section still has (a renamed or removed column drops out, a new
 *   one arrives ticked);
 * - ticking a group ticks all its columns; the group reads as partly ticked
 *   when some are;
 * - the download URL sends `fields=` only when the selection is not "all",
 *   in registry order, plus the non-blank filters and the format.
 */

import type { ColumnDef } from "./columns";

export type GroupState = "all" | "some" | "none";

/** Default (all) or a remembered selection reconciled with today's registry. */
export function initialSelection(
  columns: readonly ColumnDef[],
  remembered: readonly string[] | null | undefined,
  knownAtSave?: readonly string[] | null,
): Set<string> {
  const all = columns.map((c) => c.key);
  if (!remembered) return new Set(all);
  const keep = new Set(remembered);
  const seen = new Set(knownAtSave ?? remembered);
  // A column added since the selection was saved arrives ticked.
  return new Set(all.filter((k) => keep.has(k) || !seen.has(k)));
}

export function groupState(groupKeys: readonly string[], selected: ReadonlySet<string>): GroupState {
  const n = groupKeys.filter((k) => selected.has(k)).length;
  return n === 0 ? "none" : n === groupKeys.length ? "all" : "some";
}

/** Toggle a whole group: anything less than all → all; all → none. */
export function toggleGroup(groupKeys: readonly string[], selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  const on = groupState(groupKeys, selected) !== "all";
  for (const k of groupKeys) {
    if (on) next.add(k);
    else next.delete(k);
  }
  return next;
}

export function toggleField(key: string, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** `/api/exports/<section>?…` for the current form. */
export function buildExportHref(
  sectionKey: string,
  columns: readonly ColumnDef[],
  selected: ReadonlySet<string>,
  filters: Readonly<Record<string, string | null | undefined>>,
  format: "xlsx" | "csv",
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && v !== "" && v !== "__all__") params.set(k, v);
  }
  const keys = columns.map((c) => c.key).filter((k) => selected.has(k));
  if (keys.length !== columns.length) params.set("fields", keys.join(","));
  params.set("format", format);
  return `/api/exports/${sectionKey}?${params.toString()}`;
}
