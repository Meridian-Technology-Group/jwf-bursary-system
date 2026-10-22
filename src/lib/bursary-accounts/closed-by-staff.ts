/**
 * Client-safe: the reverse button reads it, and the server action enforces it.
 *
 * Retention trial, 22 Oct 2026: on a bursary account staff had closed, "reverse
 * the assessment" undid the award lock, and the reopen after it made the
 * account active again — undoing a close she had chosen, and with it the date
 * the retention clock runs from. A staff close carries a close reason (Close
 * bursary account); the close the schedule makes itself when the last year
 * completes does not, and stays reversible through the reopen path.
 */
export const ACCOUNT_CLOSED_REVERT_MESSAGE =
  "This bursary account has been closed, so its award can't be reversed.";

export function isClosedByStaff(account: { status: string; closeReasonId: string | null } | null): boolean {
  return account?.status === "CLOSED" && account.closeReasonId != null;
}
