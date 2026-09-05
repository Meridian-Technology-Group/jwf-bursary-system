/**
 * Display field order for the read-only application-section cards — CH-61.
 *
 * `DataBlock` renders `Object.entries(data)` straight out of JSONB, and JSONB
 * preserves *insertion* order, which is form-field-registration order. To a
 * reader that is arbitrary: Charlotte's Parent 1 Contact block came out as
 * City, Email, Title, Mobile, Country, Last Name, Postcode, First Name,
 * Address Line1, Address Line2.
 *
 * This module supplies the order a human expects. It is display-only — nothing
 * here touches a stored or computed value.
 *
 * THE RULE THAT MUST NOT BE BROKEN: an unlisted key is never dropped. Listed
 * keys sort first in spec order; everything else follows in its existing order.
 * A schema field nobody adds to the spec still appears, just at the bottom.
 */

/**
 * Display order for a container's fields, keyed by the container's own name
 * (the *leaf* of the JSONB path, so `parent1Contact` and `parent2Contact` can
 * share one spec — see `CONTAINER_ALIASES`).
 */
export const FIELD_ORDER: Record<string, readonly string[]> = {
  // CH-61 — her order, verbatim, applied to both parents. `telephone` and
  // `telephone2` were not named; they sit next to `mobile` because that is
  // where a reader looking for a phone number will look.
  parentContact: [
    "title",
    "firstName",
    "lastName",
    "mobile",
    "telephone",
    "telephone2",
    "email",
    "addressLine1",
    "addressLine2",
    "city",
    "postcode",
    "country",
  ],
  // CH-62 — each additional property renders in the portal form's own order
  // (see `OtherPropertyFields` in assets-liabilities-form.tsx). `id` is not
  // listed, so it falls to the bottom rather than leading with a UUID.
  otherProperties: [
    "address",
    "postcode",
    "value",
    "mortgageBalance",
    "monthlyRepayment",
    "usedAsRental",
    "mortgageStatementDocumentId",
  ],
};

/**
 * Containers that share another container's spec. Keyed by the container name
 * as it appears in the data; the value is a key of `FIELD_ORDER`.
 */
const CONTAINER_ALIASES: Record<string, string> = {
  parent1Contact: "parentContact",
  parent2Contact: "parentContact",
};

/**
 * The container name a JSONB dot-path addresses — the last segment that is not
 * an array index. `"otherProperties.2"` → `"otherProperties"`, so every element
 * of an array shares the array's spec.
 */
export function leafContainerName(pathPrefix: string): string {
  const segments = pathPrefix
    .split(".")
    .filter((s) => s.length > 0 && !/^\d+$/.test(s));
  return segments.length > 0 ? segments[segments.length - 1] : "";
}

/** The order spec that applies at `pathPrefix`, or undefined for none. */
export function resolveFieldOrderSpec(
  pathPrefix: string
): readonly string[] | undefined {
  const leaf = leafContainerName(pathPrefix);
  if (!leaf) return undefined;
  return FIELD_ORDER[CONTAINER_ALIASES[leaf] ?? leaf];
}

/**
 * Sorts `entries` into `spec` order, stably, appending every unlisted key
 * afterwards in its original order.
 *
 * A key in the spec but absent from `entries` contributes nothing — no ghost
 * row appears that was not there before.
 */
export function orderEntries<V>(
  entries: [string, V][],
  spec: readonly string[] | undefined
): [string, V][] {
  if (!spec || spec.length === 0) return entries;

  const rank: Record<string, number> = {};
  spec.forEach((key, i) => {
    // First listing wins, so a duplicated key in a spec cannot reshuffle.
    if (rank[key] === undefined) rank[key] = i;
  });

  const listed: [string, V][] = [];
  const rest: [string, V][] = [];
  for (const entry of entries) {
    if (rank[entry[0]] !== undefined) listed.push(entry);
    else rest.push(entry);
  }
  // Array.prototype.sort is stable in every supported runtime, and the ranks
  // are unique per key anyway.
  listed.sort((a, b) => rank[a[0]] - rank[b[0]]);

  return listed.concat(rest);
}
