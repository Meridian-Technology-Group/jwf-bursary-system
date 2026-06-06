/**
 * Epic 07 — auto-populate-then-confirm (pure, UI-free).
 *
 * Reference defaults (family-type costs, council tax) fill reference-backed
 * inputs and stay in step with the selected family type — UNTIL the assessor
 * edits a field. Once a field is overridden, changing the family type (or any
 * other default source) must NOT clobber the assessor's value; instead the UI
 * offers an explicit "reset to default".
 *
 * The assessment form holds the live state and the override set; this module is
 * the pure decision logic, extracted so the rule (and the regression against the
 * OLD destructive `handleFamilyCategoryChange` behaviour) is unit-tested without
 * rendering React.
 */

export type OverridableField =
  | 'notionalRent'
  | 'utilityCosts'
  | 'foodCosts'
  | 'councilTax';

/**
 * Given the new reference defaults for the selected family type and the set of
 * fields the assessor has overridden, returns the value each field should take.
 *
 * Fill-empties-only semantics: an OVERRIDDEN field keeps its current value; a
 * non-overridden field adopts the new default. This is the corrected behaviour —
 * the old handler unconditionally wrote all three defaults, silently discarding
 * assessor edits (plan 07 §4 / §5.3, the `:415` regression).
 *
 * @param current     The current on-screen values.
 * @param defaults    The reference defaults for the newly-selected family type.
 * @param overridden  The set of fields the assessor has independently edited.
 */
export function applyFamilyTypeDefaults<
  T extends Partial<Record<OverridableField, number>>,
>(current: T, defaults: T, overridden: ReadonlySet<OverridableField>): T {
  const result = { ...current };
  for (const key of Object.keys(defaults) as OverridableField[]) {
    if (defaults[key] === undefined) continue;
    if (!overridden.has(key)) {
      result[key] = defaults[key] as T[OverridableField];
    }
  }
  return result;
}

/**
 * Seeds the "already overridden" set from a persisted assessment: a stored value
 * that differs from the live reference default is treated as a deliberate prior
 * override (so a family-type change won't clobber it). A field with no stored
 * value (null/undefined), or one equal to its default, is treated as untouched.
 *
 * @param stored    The persisted field values (null = never set).
 * @param defaults  The live reference defaults for the assessment's family type.
 */
export function deriveOverriddenFields(
  stored: Partial<Record<OverridableField, number | null | undefined>>,
  defaults: Record<OverridableField, number>,
): Set<OverridableField> {
  const set = new Set<OverridableField>();
  (Object.keys(defaults) as OverridableField[]).forEach((key) => {
    const value = stored[key];
    if (value != null && Number(value) !== Number(defaults[key])) {
      set.add(key);
    }
  });
  return set;
}
