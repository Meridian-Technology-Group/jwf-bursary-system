/**
 * submission-flow.ts — the post-submit download beat (Epic 14 A5, CG-13/LA-1).
 *
 * Charlotte's flow: SUBMIT → "file sent" confirmation → a single
 * `DOWNLOAD MY COPY` button with NO explanatory or scarcity copy → continue →
 * portal home. The one-successful-download rule (D13-4) is unchanged
 * server-side; what changed is the presentation — the parent is not told it is
 * their only chance, and once they move on the button is simply gone.
 *
 * "Just submitted" is marked by a sessionStorage flag written by the submit
 * path immediately before the server action runs. The offer is live only while
 * that flag names this application AND the server says the download is
 * unspent. Downloading or continuing consumes the flag, so clicking past the
 * offer forfeits it (LA-1); a plain revisit to /submitted shows no download
 * path and no explanation.
 *
 * Pure module — the component reads sessionStorage and feeds this resolver, so
 * the beat matrix is unit-testable without a DOM.
 */

/** sessionStorage key holding the application id of an in-flight submit beat. */
export const SUBMISSION_FLOW_KEY = "jwf:submission-flow";

export type DownloadBeat =
  /** Fresh submit — show `DOWNLOAD MY COPY` + `Continue`. */
  | "offer"
  /** Download started this visit — only `Continue` remains. */
  | "continue"
  /** Spent, forfeited, or a plain revisit — no download surface at all. */
  | "hidden";

export function resolveDownloadBeat(input: {
  /** Server truth: when the single download was taken, or null if unspent. */
  downloadedAt: string | null;
  /** The sessionStorage flag's value (an application id), or null. */
  flowApplicationId: string | null;
  /** The application this /submitted page is showing. */
  applicationId: string;
  /** The parent clicked the download link during this visit. */
  downloadStarted: boolean;
}): DownloadBeat {
  if (input.downloadStarted) return "continue";
  if (input.downloadedAt) return "hidden";
  return input.flowApplicationId === input.applicationId ? "offer" : "hidden";
}
