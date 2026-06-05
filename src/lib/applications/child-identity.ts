/**
 * Per-child identity key (Epic 04, D12).
 *
 * One application/account per child is keyed on (childName + childDob), NOT
 * childName alone, so twins (same first name, distinct DOB) are distinct. This
 * pure helper computes the dedupe key the DB enforces via two indexes on
 * `applications`:
 *   - composite UNIQUE (round, lead, child_name, child_dob) for non-NULL DOB;
 *   - partial UNIQUE (round, lead, child_name) WHERE child_dob IS NULL.
 *
 * The key here MIRRORS that enforcement: a NULL DOB coalesces to a single
 * sentinel so two unknown-DOB same-name children collide (matching the partial
 * index), while two distinct non-NULL DOBs do not (matching the composite).
 * Use it to detect a would-be collision in app code BEFORE hitting a P2002.
 */

/** Sentinel for "DOB unknown" so two NULL-DOB same-name children collide. */
const NULL_DOB_SENTINEL = "∅";

/** Normalises a DOB (Date | string | null) to a stable YYYY-MM-DD or sentinel. */
export function normaliseChildDob(dob: Date | string | null | undefined): string {
  if (dob == null) return NULL_DOB_SENTINEL;
  if (typeof dob === "string") {
    // Accept an ISO date or a YYYY-MM-DD already.
    const m = dob.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : NULL_DOB_SENTINEL;
  }
  return dob.toISOString().slice(0, 10);
}

/**
 * The per-child identity key within a (round, lead applicant) scope. Same key
 * ⇒ the DB would reject a second application for that child (twins differ
 * because their DOB differs).
 */
export function childIdentityKey(params: {
  childName: string;
  childDob: Date | string | null | undefined;
}): string {
  return `${params.childName.trim().toLowerCase()}|${normaliseChildDob(
    params.childDob
  )}`;
}

/**
 * True when two children (within one round + lead applicant) would collide
 * under the per-child uniqueness rule. Twins (same name, distinct DOB) do NOT
 * collide; two unknown-DOB same-name children DO (NULL coalesced).
 */
export function childrenCollide(
  a: { childName: string; childDob: Date | string | null | undefined },
  b: { childName: string; childDob: Date | string | null | undefined }
): boolean {
  return childIdentityKey(a) === childIdentityKey(b);
}
