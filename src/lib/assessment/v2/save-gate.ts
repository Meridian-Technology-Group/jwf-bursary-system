/**
 * CALC-15 — pure save-outcome gating shared by the v2 assessor form.
 *
 * Found during an E2E walkthrough: a stale Prisma client made every
 * `saveAssessmentAction` call throw server-side, yet (a) the assessor UI showed
 * no visible failure, and (b) Complete succeeded anyway — producing a COMPLETED
 * assessment whose v2 snapshot columns were ALL NULL. Both behaviours trace back
 * to the form treating `handleSave()` as fire-and-forget: its result was never
 * inspected before flipping status or clearing the error banner.
 *
 * Extracted here as pure functions (no React, no DOM) so the fix — (1) the
 * persistent "last save failed" indicator, and (2) Complete/Pause only
 * proceeding after a successful save — is unit-testable without rendering the
 * form.
 */

export type SaveOutcome = { success: true } | { success: false; error: string };

/**
 * The inline "last save failed" banner text to show, given the latest save
 * outcome. `null` means render nothing (the last save succeeded).
 *
 * Only a SUCCESSFUL outcome clears the banner. Callers must feed this the
 * outcome of every save attempt (autosave or explicit) and must NOT
 * optimistically clear the banner before an outcome is known — doing so would
 * blank it during a retry's "Saving…" window and defeat the "stays until a
 * save succeeds" requirement.
 */
export function reduceSaveError(outcome: SaveOutcome): string | null {
  return outcome.success ? null : outcome.error;
}

/**
 * Complete/Pause must only proceed when the synchronous save that precedes
 * them succeeded. A failed save must never be silently followed by a status
 * flip — that is exactly how a stale-save failure produced a COMPLETED
 * assessment with a null snapshot.
 */
export function canProceedAfterSave(outcome: SaveOutcome): boolean {
  return outcome.success;
}
