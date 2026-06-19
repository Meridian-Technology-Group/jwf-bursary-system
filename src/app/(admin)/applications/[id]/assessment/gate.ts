// Plain module (NOT "use server"): a "use server" file may only export async
// functions, so the B1 gate's user-facing message constant lives here and is
// imported by both the server action and its test.

/** User-facing message when assessment is attempted on a not-yet-submitted form. */
export const NOT_SUBMITTED_GATE_MESSAGE =
  "This application has not been submitted yet — an assessment can only be " +
  "started once the applicant has submitted their form.";
