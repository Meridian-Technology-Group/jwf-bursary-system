/**
 * Default (empty) form values for the PARENT_DETAILS section.
 *
 * CF-17. These live here rather than inline in `section-page-client.tsx` so the
 * seed can be asserted against `parentDetailsSchema` in a unit test — the defect
 * below is invisible to a schema test that builds its own fixture.
 *
 * Why every required string must be seeded to `""` and never left absent:
 * a required `z.string()` that arrives `undefined` fails Zod's BASE TYPE check,
 * which carries no custom message and produces the raw
 * `"Invalid input: expected string, received undefined"`. The section form's
 * error banner prints `.message` only, so the applicant gets that sentence with
 * no field name attached and no way to tell what to fix. Seeded as `""` the same
 * field fails `.min(1, "…")` instead and shows the human copy.
 *
 * Parent 2's block was previously not seeded at all, so the moment a coupled
 * relationship status (married / civil partnership / cohabiting) made Parent 2
 * required, every one of its untouched fields produced that raw sentence.
 * `parent1Contact.email` had the same hole.
 *
 * Keep this in the same shape as `parentContactSchema` / `parentEmploymentSchema`:
 * every non-optional string gets `""`; enums stay `undefined` because their
 * schemas already carry a custom "Please select …" message.
 */

/** One parent's contact block, with every required string seeded. */
function emptyContact() {
  return {
    title: undefined,
    firstName: "",
    lastName: "",
    email: "",
    addressLine1: "",
    city: "",
    postcode: "",
    country: "",
  };
}

/** Fresh default values for a blank Parent / Guardian Details form. */
export function parentDetailsDefaultValues() {
  return {
    isSoleParent: undefined,
    relationshipStatus: undefined,
    parent1Contact: emptyContact(),
    parent1Employment: { status: undefined },
    // Seeded even for a sole parent: the Parent 2 block is always mounted (it
    // is collapsed, not unmounted), so react-hook-form registers these fields
    // regardless, and a coupled status can make them required at any moment.
    parent2Contact: emptyContact(),
    parent2Employment: { status: undefined },
  };
}
