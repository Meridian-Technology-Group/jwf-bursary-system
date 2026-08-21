/**
 * declaration-submit.ts — the DECLARATION save/submit split (CF-32, D4).
 *
 * ## The defect this module exists to fix
 *
 * Saving the Declaration USED TO BE submitting. `handleSave` in
 * `section-page-client.tsx` called `submitApplication()` the moment a
 * DECLARATION save succeeded, so the wizard's one primary button was
 * simultaneously "save my work" and "commit irreversibly". Charlotte's UAT
 * feedback (CF-32):
 *
 *   > it seems stressful to have the REVIEW action and the SUBMIT action on the
 *   > same button. Many parents will want to review the form first and then have
 *   > a separate SUBMIT button.
 *
 * So the two actions are now two buttons, and this module holds the decision
 * that separates them — as a PURE function, because the repo has no jsdom/RTL
 * and the rule ("a save is only ever a save unless the applicant explicitly and
 * confirmably asked to submit") is the part that must never regress.
 *
 * ## The intent handshake
 *
 * `ApplyFooter` arms the NEXT form submission with a `SectionSubmitIntent`
 * before the browser dispatches `submit` (a ref write in
 * `section-saving-context`, so it is synchronous and cannot lose a race with
 * React batching). `SectionPageClient.handleSave` consumes it — read-once,
 * reset to `"review"` — and hands it here.
 *
 * ## Why the confirmation is AFTER validation, not on the button click
 *
 * The intent ref is armed by a click but consumed by a *successful* validation
 * pass. If validation fails, `handleSave` never runs, so the intent can survive
 * into a later submission (e.g. the applicant fixes the field and presses Enter
 * in a text input). Gating on the click alone would let that stale intent
 * submit the application with no prompt. Gating HERE — inside the run, after
 * react-hook-form has validated — makes "submission always passed a
 * confirmation dialog" an invariant that holds no matter how the form was
 * submitted. A stale intent costs the applicant one extra dialog, never a
 * surprise submission.
 *
 * It also means the applicant is never asked "are you sure?" only to then be
 * told they have validation errors — which is the same stress CF-32 reports.
 */

/** Which action the applicant asked for when they submitted the section form. */
export type SectionSubmitIntent = "review" | "submit";

/**
 * The intent every form submission starts from. NEVER `"submit"`: submission
 * must be opted into by an explicit button press, so anything that submits the
 * form without arming an intent (Enter in a text input, the `/contribute` flow,
 * the assessor's edit-on-behalf shell, a component rendered outside the
 * provider) falls through to a plain save.
 */
export const DEFAULT_SUBMIT_INTENT: SectionSubmitIntent = "review";

/**
 * The ONE label for committing the application, shared by the sticky footer and
 * the wizard page's `nextLabel`. Before D4 the footer said "Review and Submit"
 * while the page said "Submit Application" — the same control named two
 * different things. Both now read from here, so they cannot drift again.
 */
export const SUBMIT_APPLICATION_LABEL = "Submit Application";

/** The separate, non-submitting "take me back to the review tab" action. */
export const REVIEW_LABEL = "Review";

/** Structural mirror of `SaveSectionResult` — kept local so this stays server-free. */
export interface SectionSaveResult {
  success: boolean;
  errors?: string[];
}

/**
 * Returned when the applicant cancels the submit confirmation.
 *
 * `success: false` with an EMPTY `errors` array is a deliberate silent no-op in
 * `SectionForm`: it skips `navigateAfterSave` (so a cancel does not fling the
 * applicant off to /apply/review) while `serverErrors` stays empty, so the red
 * error banner — whose render is gated on `allErrors.length > 0` — never
 * appears. A cancel must not look like a failure.
 */
export const SUBMIT_CANCELLED: SectionSaveResult = Object.freeze({
  success: false,
  errors: [],
});

/** True when `result` is the cancel sentinel above (nothing was persisted). */
export function isSubmitCancelled(result: SectionSaveResult): boolean {
  return result.success === false && result.errors?.length === 0;
}

/**
 * Next's `redirect()` throws a sentinel error carrying a `NEXT_REDIRECT` digest.
 * `submitApplication` redirects to `/submitted` on success, so that throw is the
 * SUCCESS path and must keep propagating all the way out to the router. Only a
 * non-redirect throw is a real failure.
 */
export function isNextRedirect(err: unknown): boolean {
  const digest = (err as { digest?: string } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export interface SectionSaveRequest {
  /** The section being saved (`ApplicationSectionType`). */
  sectionType: string;
  /** The consumed intent for THIS submission. */
  intent: SectionSubmitIntent;
  /**
   * True when an assessor is editing on behalf of the applicant (CR-001).
   * On-behalf editing NEVER submits from the section form — staff submission is
   * a separate, audited action in the edit-on-behalf chrome.
   */
  onBehalf: boolean;
}

export interface SectionSaveDeps {
  /** Persist the section data. */
  save: () => Promise<SectionSaveResult>;
  /** Ask the applicant to confirm. Resolves `false` on cancel/dismiss. */
  confirmSubmit: () => Promise<boolean>;
  /** Submit the application. Throws `NEXT_REDIRECT` on success. */
  submit: () => Promise<void>;
}

/**
 * True only for an explicit, applicant-driven submission of the Declaration.
 * Every other combination is a plain save — including a DECLARATION save, which
 * is the whole point of CF-32.
 */
export function isSubmitRequest(request: SectionSaveRequest): boolean {
  return (
    request.sectionType === "DECLARATION" &&
    !request.onBehalf &&
    request.intent === "submit"
  );
}

/**
 * Run one section save, submitting only when explicitly asked AND confirmed.
 *
 * Order is load-bearing: confirm → save → submit. Confirming first means a
 * cancel leaves the database untouched (nothing half-committed), and saving
 * before submitting means the signature the applicant just typed is persisted
 * before the completeness gates in `submitApplicationCore` run against it.
 */
export async function runSectionSave(
  request: SectionSaveRequest,
  deps: SectionSaveDeps
): Promise<SectionSaveResult> {
  // CF-32: a DECLARATION save is now JUST a save. No submission, no prompt.
  if (!isSubmitRequest(request)) {
    return deps.save();
  }

  const confirmed = await deps.confirmSubmit();
  if (!confirmed) return SUBMIT_CANCELLED;

  const result = await deps.save();
  if (!result.success) return result;

  try {
    await deps.submit();
  } catch (err) {
    // The success path — let the router navigate to /submitted.
    if (isNextRedirect(err)) throw err;
    return {
      success: false,
      errors: [
        err instanceof Error
          ? err.message
          : "Submission failed. Please try again.",
      ],
    };
  }

  return result;
}
