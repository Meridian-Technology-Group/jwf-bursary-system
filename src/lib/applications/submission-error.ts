/**
 * submission-error — what an applicant is allowed to read when submit fails.
 *
 * The submit gates throw errors written for whoever is debugging them: a
 * JSON-encoded gap payload, a list of section enum values, a Prisma or RLS
 * failure. All of it reached the parent verbatim — the portal's submit handler
 * simply rendered `err.message` — so submitting with two unfinished fields
 * showed Charlotte an internal blob instead of an answer (CF-25).
 *
 * This module decides the applicant-facing sentence. It never decides whether
 * the error is recorded: the caller logs the real error via `logError` first
 * and only then asks for a message. The diagnostic has to stop reaching the
 * applicant, not stop existing.
 *
 * Three outcomes:
 *   - the error is already applicant copy (deadline passed, not signed in) →
 *     passed through unchanged;
 *   - the error names sections the applicant can act on → plain sentence plus
 *     those section names;
 *   - anything else → the plain sentence alone. Nothing from the underlying
 *     error is echoed, because "anything else" is where the leaks live.
 */

import { SECTION_TITLES } from "@/lib/portal/sections";
import type { ApplicationSectionType } from "@prisma/client";

/** The plain message CF-25 asks for. */
export const SUBMISSION_BLOCKED_MESSAGE =
  "Your application can't be submitted yet.";

/**
 * Applicant-safe copy for the deadline lockout. It lives here, not next to the
 * gate that throws it, so "is this message safe to show?" has exactly one
 * answer and the allow-list below cannot drift from the string it allows.
 */
export const SUBMISSION_DEADLINE_PASSED_MESSAGE =
  "The submission deadline for this application has passed, so it can no longer be submitted. Forms submitted late cannot be assessed — please contact the Foundation if you believe this is an error.";

/** Shape of the gap payload the submit gate JSON-encodes into an Error message. */
interface GapsPayload {
  code?: string;
  gaps?: Array<{ sectionType?: string } | null>;
}

/**
 * Messages that are already written for the applicant and carry information the
 * plain sentence would throw away. Everything not listed here is replaced.
 */
const APPLICANT_SAFE_MESSAGES: ReadonlySet<string> = new Set([
  SUBMISSION_DEADLINE_PASSED_MESSAGE,
  "You must be signed in to submit an application.",
  "You do not have permission to submit this application.",
]);

function sectionLabel(sectionType: string): string {
  return (
    SECTION_TITLES[sectionType as ApplicationSectionType] ?? "your application"
  );
}

/** De-duplicated, in the order the applicant walks the form. */
function labelList(sectionTypes: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const sectionType of sectionTypes) {
    const label = sectionLabel(sectionType);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

/** Sections named by the error, if it names any. */
function blockingSections(err: unknown): string[] {
  if (!(err instanceof Error)) return [];

  // Incomplete sections — the structured list rides alongside the message.
  const incomplete = (err as { incompleteSections?: unknown }).incompleteSections;
  if (Array.isArray(incomplete) && incomplete.length > 0) {
    return incomplete.filter((s): s is string => typeof s === "string");
  }

  // Gap errors — a JSON payload stuffed into the message. The review page reads
  // it to draw the "issues to resolve" panel; here we only want the sections.
  try {
    const parsed = JSON.parse(err.message) as GapsPayload;
    if (parsed?.code === "GAPS_BLOCKING_SUBMISSION" && Array.isArray(parsed.gaps)) {
      return parsed.gaps
        .map((gap) => gap?.sectionType)
        .filter((s): s is string => typeof s === "string");
    }
  } catch {
    // Not JSON — an ordinary error message. Nothing to name.
  }

  return [];
}

/**
 * The message to show the applicant for a failed submission. Assumes the real
 * error has already been logged.
 */
export function applicantSubmissionMessage(err: unknown): string {
  if (err instanceof Error && APPLICANT_SAFE_MESSAGES.has(err.message)) {
    return err.message;
  }

  const labels = labelList(blockingSections(err));
  if (labels.length === 0) return SUBMISSION_BLOCKED_MESSAGE;

  return `${SUBMISSION_BLOCKED_MESSAGE} Please finish these sections and try again: ${labels.join(", ")}.`;
}
