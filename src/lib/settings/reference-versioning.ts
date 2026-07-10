/**
 * CALC-11 — Pure helpers for the "create a new version" flow shared by every
 * versioned reference table in the admin settings page (NotionalCostConfig,
 * FamilyCategoryMeta, and the six profiling band tables).
 *
 * The pattern throughout this codebase (FamilyTypeConfig, SchoolFees,
 * CouncilTaxDefault) is: never mutate or delete an existing row — inserting a
 * new row with a fresh `effectiveFrom` is what "editing" means. CALC-11
 * extends that to tables that are versioned as a WHOLE GENERATION (every row
 * of the table shares one `effectiveFrom` — see `reference-tables.ts`'s
 * `latestGeneration` helper), where a "new version" duplicates every row of
 * the current generation (admin-edited in the UI) and re-stamps them with a
 * new `effectiveFrom`. This module is DB-free and pure so the payload shape
 * is unit-tested without a database; the server actions just call it then
 * `createMany`.
 */

/** The version-identity fields every reference-table row carries. */
export interface VersionedRow {
  id: string;
  createdAt: Date | string;
  effectiveFrom: Date | string;
}

/**
 * Strips the version-identity fields (`id`, `createdAt`, `effectiveFrom`)
 * from a set of "current" reference rows (as submitted by the settings UI,
 * which round-trips the fetched rows through client state) and re-stamps
 * every row with `newEffectiveFrom` — the exact payload shape every CALC-11
 * "create new version" action passes to `createMany`.
 *
 * Never mutates the input rows.
 */
export function buildVersionDuplicationPayload<T extends VersionedRow>(
  currentRows: readonly T[],
  newEffectiveFrom: Date
): Array<Omit<T, "id" | "createdAt" | "effectiveFrom"> & { effectiveFrom: Date }> {
  return currentRows.map((row) => {
    const { id: _id, createdAt: _createdAt, effectiveFrom: _effectiveFrom, ...rest } = row;
    return { ...rest, effectiveFrom: newEffectiveFrom } as Omit<
      T,
      "id" | "createdAt" | "effectiveFrom"
    > & { effectiveFrom: Date };
  });
}

/**
 * True when `newEffectiveFrom` matches (to the day) an `effectiveFrom` that
 * already exists among `existingEffectiveFroms`. The DB's compound unique
 * constraint (e.g. `[category, costType, effectiveFrom]`) would reject the
 * insert anyway, but checking this first lets the action return a friendly,
 * specific error instead of a raw Prisma constraint message.
 */
export function isDuplicateEffectiveFrom(
  newEffectiveFrom: Date,
  existingEffectiveFroms: readonly (Date | string)[]
): boolean {
  const target = normaliseToDayStart(newEffectiveFrom).getTime();
  return existingEffectiveFroms.some(
    (d) => normaliseToDayStart(new Date(d)).getTime() === target
  );
}

function normaliseToDayStart(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
