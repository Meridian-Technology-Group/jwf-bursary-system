/**
 * unsaved-changes.ts — the pure decision logic behind the portal's
 * dirty-navigation guard (Epic 13 / WP B1, CF-15 / CF-16 / CF-19 / CF-22).
 *
 * The wizard's left-hand stepper used to render each step as a raw `<a href>`,
 * so clicking a step triggered a full document load and the browser threw away
 * every value typed since the last "Save and Continue" — the client lost a
 * fully-completed income section (and the ids of four uploaded documents) that
 * way. Client-side navigation alone would not fix it: a soft `push` unmounts the
 * react-hook-form instance just as thoroughly. The section must be given the
 * chance to persist first.
 *
 * This module holds ONLY the decisions, with no React and no browser APIs, so
 * the branch table can be unit-tested directly (the repo has no jsdom/RTL). The
 * wiring — the registry, the dialog and the link interception — lives in
 * `@/components/portal/unsaved-changes-context`.
 *
 * ── Dirty-state contract (read this before changing anything) ────────────────
 * "Dirty" means: the form's values differ from a snapshot taken once the
 * section has finished mounting. It is deliberately NOT react-hook-form's
 * `formState.isDirty`.
 *
 * `isDirty` looks like the obvious signal and is the wrong one. The moment a
 * component subscribes to it, react-hook-form re-derives it on every render as
 * `!deepEqual(getValues(), defaultValues)` (`useForm`'s `_proxyFormState.isDirty`
 * effect, RHF 7.71) — so it reports a *value* difference, not an *applicant*
 * edit, and `setValue(..., { shouldDirty: false })` does not keep anything out
 * of it. Several sections write to themselves as they mount:
 *
 *  - the income column seeds all seven sub-blocks and recomputes `total`
 *    (`parents-income-form.tsx`),
 *  - the child-details form re-applies the admin-locked school,
 *  - the parent/guardian form clears `isRemarriedSoleParent` when the CF-13
 *    matrix stops asking the question (`parent-details-form.tsx`).
 *
 * Reading `isDirty` therefore made the Income section prompt "you have unsaved
 * changes" on a page the applicant had not touched — verified in the browser on
 * 2026-08-14. Snapshotting after mount lets those writes settle into the
 * baseline, so the prompt fires on the applicant's edits and nothing else. All
 * three of those effects use `shouldDirty: false` to say "this is not the
 * applicant's doing"; the snapshot is what actually honours that intent.
 *
 * WP B2 (autosave) stacks on top of this module: its debounced writer reads the
 * SAME registration (`isDirty` + `save`) rather than introducing a second,
 * competing notion of "does this section have work in it".
 */

/** What the applicant chose in the "you have unsaved changes" dialog. */
export type UnsavedChoice = "save" | "discard" | "cancel";

/**
 * How a guarded navigation request ended.
 *
 *  - `navigated`   — the destination was reached (clean form, discard, or a save
 *                    that actually persisted).
 *  - `cancelled`   — the applicant stayed put; nothing was written.
 *  - `save-failed` — a save was attempted and did NOT persist, so navigation was
 *                    deliberately withheld. Losing the work quietly is exactly
 *                    the defect being fixed, so a failed save must never fall
 *                    through to a navigation.
 */
export type NavigationOutcome = "navigated" | "cancelled" | "save-failed";

/**
 * Reduce an href to the part that identifies the destination page, so a link to
 * the section the applicant is already on (or to the same section with a
 * deep-link hash, as the Review page's "Issues to resolve" panel emits) is not
 * treated as leaving it.
 *
 * Query strings are kept: two different query strings are two different views.
 * Only the hash and a trailing slash are dropped.
 */
export function normaliseHref(href: string): string {
  const withoutHash = href.split("#")[0];
  if (withoutHash.length > 1 && withoutHash.endsWith("/")) {
    return withoutHash.slice(0, -1);
  }
  return withoutHash;
}

export interface NavigationRequest {
  /** Does the currently-mounted section form hold unsaved applicant edits? */
  isDirty: boolean;
  /** Where the applicant is trying to go. */
  targetHref: string;
  /** The current pathname (`usePathname()`), or null before hydration. */
  currentPath: string | null;
}

/**
 * True when the applicant must be asked before this navigation proceeds.
 *
 * Staying on the same page is never a loss, so a same-route link (including a
 * hash-only deep link into the current section) is always allowed through — the
 * prompt would be pure noise, and it is a real click path: the Review page links
 * back into individual fields of the section being edited.
 */
export function shouldPromptBeforeNavigation({
  isDirty,
  targetHref,
  currentPath,
}: NavigationRequest): boolean {
  if (!isDirty) return false;
  if (currentPath && normaliseHref(targetHref) === normaliseHref(currentPath)) {
    return false;
  }
  return true;
}

/**
 * Deep-copy form values so the baseline cannot be mutated out from under the
 * guard.
 *
 * This is NOT optional bookkeeping. `react-hook-form`'s `getValues()` returns a
 * SHALLOW spread of its internal values object (RHF 7.71), so every nested
 * branch — `parent1Contact`, `parent1Income.employed`, the dependent-children
 * array — is shared by reference with the live form. Keeping that as the
 * baseline means the applicant's typing edits the baseline too, the comparison
 * is always equal, and the guard silently never fires: the exact defect it
 * exists to fix, reintroduced. (Observed in the browser on 2026-08-14: typing
 * into `parent1Contact.lastName` produced no prompt at all.)
 *
 * Deliberately explicit rather than `structuredClone`: the value model here is
 * closed (JSON-shaped section blobs plus Dates), and a clone that throws on
 * anything unexpected would disable the guard at the worst moment.
 */
export function snapshotValues<T>(values: T): T {
  if (values instanceof Date) return new Date(values.getTime()) as unknown as T;
  if (Array.isArray(values)) {
    return values.map((item) => snapshotValues(item)) as unknown as T;
  }
  if (values === null || typeof values !== "object") return values;

  const source = values as Record<string, unknown>;
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    copy[key] = snapshotValues(source[key]);
  }
  return copy as unknown as T;
}

/**
 * Structural equality for form values, used to compare the live values against
 * the post-mount snapshot.
 *
 * `undefined` is treated as equivalent to an absent key. That is not a detail:
 * react-hook-form clears a field by setting it to `undefined` rather than
 * deleting it, so `{ isRemarriedSoleParent: undefined }` and `{}` are the same
 * form to an applicant and must be the same form to the guard.
 *
 * Arrays compare element-wise (order matters — a reordered dependent-children
 * list IS an edit). Dates compare by timestamp; everything else falls back to
 * `Object.is`, so `NaN` equals `NaN` and `0`/`-0` are distinguished, matching
 * how the values round-trip through the section blob.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;

  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, i) => valuesEqual(item, b[i]));
  }

  if (typeof a !== "object" || typeof b !== "object") return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  // Union of keys — a key present on one side only still has to compare equal,
  // which it does when its value is `undefined` (see the `undefined` rule above).
  const keys = Object.keys(left).concat(
    Object.keys(right).filter((key) => !(key in left))
  );
  return keys.every((key) => valuesEqual(left[key], right[key]));
}

/** The subset of a mouse event the guard reasons over. */
export interface ClickIntent {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * True when the browser is being asked to do something other than a plain
 * same-tab navigation — a new tab/window, a middle-click, a download, a
 * `target` other than `_self`. The current page is not torn down in any of
 * those cases, so there is nothing to guard and the click must pass straight
 * through.
 */
export function isModifiedClick(
  event: ClickIntent,
  target?: string
): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (!!target && target !== "_self")
  );
}

export interface UnsavedChoiceHandlers {
  /**
   * Persist the section. Resolves true only when the write actually landed.
   * A resolved-false or a thrown error both hold the applicant on the page.
   */
  save: () => Promise<boolean>;
  /** Perform the navigation. Only called once the work is safe (or discarded). */
  navigate: () => void;
}

/**
 * Apply the applicant's answer to the prompt.
 *
 * "Save" navigates only if the save reports success — a guard that loses the
 * work anyway is worse than no guard, so a failed write keeps them on the page
 * with the form (and its error banner) intact.
 */
export async function resolveUnsavedChoice(
  choice: UnsavedChoice,
  { save, navigate }: UnsavedChoiceHandlers
): Promise<NavigationOutcome> {
  if (choice === "cancel") return "cancelled";

  if (choice === "discard") {
    navigate();
    return "navigated";
  }

  let saved = false;
  try {
    saved = await save();
  } catch {
    saved = false;
  }

  if (!saved) return "save-failed";

  navigate();
  return "navigated";
}
