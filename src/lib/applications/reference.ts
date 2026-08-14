/**
 * Application reference — the single user-facing label on an Application.
 *
 * **The reference is a label, not an identity** (Epic 13, D13-1a). Identity is
 * the UUID primary key; no foreign key anywhere points at `reference`. The
 * label is freely editable to ANY value — typically re-edited once a bursary is
 * awarded so it matches the external fees system (e.g.
 * `TS-SMITH05-Smith, Bob`) for reconciliation — and is therefore **not unique**
 * at any layer (see migration
 * `20260814120000_application_reference_non_unique`).
 *
 * Default format for a new application:
 *
 *   {Child first last} – {School name} – {Year group} – {Academic year}
 *   e.g. "Bob Smith – Trinity School – Year 6 – 2027-28"
 *
 * Separator is an en dash surrounded by spaces. Segments that cannot be
 * resolved (no year-group recorded, unparseable academic year) are omitted
 * rather than rendered as a placeholder, so the label stays readable.
 *
 * Pure module — no DB access, no `Tx`. The previous generator counted existing
 * rows to derive a padded sequence (`TS-20252026-0001`); that both required a
 * transaction and carried a read-then-write race. Both are gone.
 */

import type { EntryYearGroup, School } from "@prisma/client";
import {
  parseAcademicYearStart,
  formatAcademicYearLabel,
} from "@/lib/assessment/fee-year";
import { ENTRY_YEAR_GROUP_LABELS } from "@/lib/assessment/schooling-years";

/** Segment separator: space + en dash + space. */
const SEPARATOR = " – ";

/** Last-resort label when every segment is unresolvable (never blank). */
const EMPTY_FALLBACK = "Application";

/**
 * The application facts the default label is built from. All fields are
 * tolerant of `null`/`undefined` so the generator can be fed straight from a
 * partially-populated create payload or a Prisma row.
 */
export interface ApplicationReferenceInput {
  /** `Application.childName` — the child's full name, used verbatim. */
  childName: string | null | undefined;
  /** `Application.school` (Prisma `School` enum value). */
  school: School | string | null | undefined;
  /** `Application.entryYearGroup` (Prisma `EntryYearGroup`), may be absent. */
  entryYearGroup: EntryYearGroup | string | null | undefined;
  /** `Round.academicYear` in any stored form ("2027/28", "2027-2028", …). */
  academicYear: string | null | undefined;
}

/** "TRINITY" → "Trinity School". Unknown/absent → "" (segment omitted). */
function schoolSegment(school: School | string | null | undefined): string {
  if (school === "TRINITY") return "Trinity School";
  if (school === "WHITGIFT") return "Whitgift School";
  return "";
}

/**
 * "Y6" → "Year 6". `OTHER` and absent both yield "" — "Other" carries no
 * information in a label, so the segment is dropped instead.
 */
function yearGroupSegment(
  group: EntryYearGroup | string | null | undefined
): string {
  if (!group || group === "OTHER") return "";
  return (
    ENTRY_YEAR_GROUP_LABELS[group as keyof typeof ENTRY_YEAR_GROUP_LABELS] ?? ""
  );
}

/** "2027/28" → "2027-28". Unparseable/absent → "" (segment omitted). */
function academicYearSegment(academicYear: string | null | undefined): string {
  const start = parseAcademicYearStart(academicYear);
  return start === null ? "" : formatAcademicYearLabel(start);
}

/**
 * Builds the default reference label for an application.
 *
 * Deterministic and pure: the same inputs always produce byte-identical output.
 * `resolveRolloverReference` depends on that property to tell an untouched
 * default from a human-entered value.
 */
export function generateApplicationReference(
  input: ApplicationReferenceInput
): string {
  const segments = [
    (input.childName ?? "").trim(),
    schoolSegment(input.school),
    yearGroupSegment(input.entryYearGroup),
    academicYearSegment(input.academicYear),
  ].filter((segment) => segment !== "");

  return segments.length > 0 ? segments.join(SEPARATOR) : EMPTY_FALLBACK;
}

// ─── Rollover inheritance (D13-1a, Q5) ────────────────────────────────────────

/**
 * References produced by the two pre-Epic-13 count-based generators:
 *
 *   - `TS-20252026-0001` / `WS-2025-26-0001` — `generateApplicationReference`
 *     as it was before this module was rewritten.
 *   - `INT-2025-26-0001` — the internal-request generator in
 *     `src/app/(admin)/queue/actions.ts`.
 *
 * Anchored and deliberately tight: a human-entered fees-system code such as
 * `TS-SMITH05-Smith, Bob` cannot match (the middle group is not all digits and
 * the tail is not exactly four digits). Recognising these lets a rollover
 * replace a stale machine-generated label instead of dragging it forward
 * forever, without ever discarding a human-entered value.
 */
const LEGACY_GENERATED_REFERENCE =
  /^(?:TS|WS)-\d{4}(?:[-/]?\d{2,4})?-\d{4}$|^INT-\d{4}-\d{2}-\d{4}$/;

/**
 * Decides the reference a ROLLING_OVER application should carry (D13-1a, Q5).
 *
 * Inherits the prior application's reference **unless** that reference is
 * byte-identical to the default this generator would produce for the *prior*
 * application (or matches a pre-Epic-13 generated format) — i.e. it was never
 * edited — in which case a fresh default is generated for the new year.
 *
 * Rationale: the point of carrying the reference forward is that a
 * human-entered fees-system code survives into next year. An untouched default
 * is not such a value, and inheriting it verbatim would drag a stale academic
 * year (`… – 2027-28`) onto a 2028-29 application. Detection is a pure
 * recompute-and-compare — no audit-log lookup, no extra column.
 *
 * **A human-entered value is never discarded.**
 *
 * @param prior - the prior year's application (its reference plus the facts
 *                that determined its own default), or `null` when there is none
 * @param next  - the facts for the application being created
 */
export function resolveRolloverReference(
  prior: (ApplicationReferenceInput & { reference: string }) | null | undefined,
  next: ApplicationReferenceInput
): string {
  const nextDefault = generateApplicationReference(next);
  if (!prior) return nextDefault;

  const priorDefault = generateApplicationReference(prior);
  const wasNeverEdited =
    prior.reference === priorDefault ||
    LEGACY_GENERATED_REFERENCE.test(prior.reference);

  return wasNeverEdited ? nextDefault : prior.reference;
}

// ─── Reference edit validation (item 11) ───────────────────────────────────────

export type ReferenceValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validates a candidate bursary reference for an edit (Story 11.1/11.2).
 *
 * References are required and have no format restriction — whitespace and
 * special characters are significant and preserved verbatim, so this only
 * rejects a value that is empty/whitespace-only. It does NOT trim the value
 * for storage; the caller persists `value` exactly as given. Uniqueness is NOT
 * checked here or anywhere else (D13-1a) — duplicates are legitimate.
 */
export function validateReferenceInput(value: string): ReferenceValidationResult {
  if (value.trim() === "") {
    return { valid: false, error: "Bursary reference cannot be blank." };
  }
  return { valid: true };
}
