/**
 * Gap F2 — pure derivation for the parent-facing Year 6 → Year 13 schedule
 * calendar (canonical §10).
 *
 * An ACTIVE family sees a STANDING, read-only calendar of their full
 * Year 6 → Year 13 assessment span — one row per academic year ("due to be
 * assessed May 2028, May 2029…"). It is informational reassurance only: NO
 * actions, NO links into prior application data.
 *
 * This module is the DB-free half. Given the account's entry year-group, its
 * first-assessment academic year, and the portal-visible (`showOnPortal`)
 * schedule entries, it builds the full span of academic-year rows and decides,
 * per row, whether it is:
 *   - "active"  — inside the award AND surfaced on the portal (showOnPortal),
 *   - "current" — the active row that is the current/next assessment year,
 *   - "greyed"  — outside the award window (before entry / after the final
 *                 eligible year) OR a year not yet surfaced on the portal.
 *
 * The span runs from the child's entry school year to `FINAL_ELIGIBLE_SCHOOL_YEAR`
 * (Year 13) — the same horizon the admin schedule grid is generated against
 * (`lib/bursary-accounts/schedule.ts`). Academic-year LABELS are produced by the
 * same `formatAcademicYearLabel` the admin grid + fee columns use, so the parent
 * sees byte-identical year labels.
 *
 * No DB, no UI dependencies — pure TypeScript, unit-tested.
 */

import type { EntryYearGroup } from "@prisma/client";
import {
  parseAcademicYearStart,
  formatAcademicYearLabel,
} from "@/lib/assessment/fee-year";
import { FINAL_ELIGIBLE_SCHOOL_YEAR } from "@/lib/bursary-accounts/schedule";
// Single source of truth for group → school-year (CH-26 added Y8/Y10/Y11/Y13);
// OTHER / null / unrecognised → null and the caller falls back.
import { schoolYearForEntryYearGroup as schoolYearForGroup } from "@/lib/assessment/schooling-years";

/** Per-row visual + a11y state of a calendar row. */
export type PortalScheduleRowState = "current" | "active" | "greyed";

/** A single academic-year row in the parent calendar. */
export interface PortalScheduleRow {
  /**
   * School year number this row represents (6..13), or `null` when the entry
   * year-group is OTHER/unknown and no real school year can be derived. The UI
   * omits the "Year N" label for `null` rows rather than inventing a misleading
   * "Year 1..N" that contradicts the Year 6 → Year 13 framing.
   */
  schoolYear: number | null;
  /** Academic-year label, identical to the admin grid (e.g. "2027-28"). */
  academicYear: string;
  /** Visual / accessibility state. */
  state: PortalScheduleRowState;
  /**
   * Short human state label, surfaced as VISIBLE text + aria so state is never
   * conveyed by colour alone (a11y).
   */
  stateLabel: string;
}

/** The minimal portal-visible schedule entry the calendar needs. */
export interface PortalScheduleEntryInput {
  /** 1-based offset from the entry (award) year — Year 1 is the entry year. */
  scheduleYear: number;
  /** The entry's own academic-year label (authoritative for that row). */
  academicYear: string;
}

export interface BuildPortalScheduleParams {
  /** Entry year-group (Y6/Y7/Y9/Y12/OTHER) — fixes the start of the span. */
  entryYearGroup: EntryYearGroup | null;
  /** The account's first-assessment academic year, e.g. "2026/2027". */
  firstAssessmentYear: string;
  /** ONLY the `showOnPortal` entries for the account (caller filters/scopes). */
  visibleEntries: PortalScheduleEntryInput[];
  /** The current academic year's start (for marking the current/next row). */
  currentAcademicYearStart: number;
}

const STATE_LABELS: Record<PortalScheduleRowState, string> = {
  current: "This year's assessment",
  active: "Scheduled",
  greyed: "Outside your award",
};

/**
 * Pure: build the full Year 6 → Year 13 span of academic-year rows for a
 * family, marking each row's state.
 *
 * Span: entry school year → FINAL_ELIGIBLE_SCHOOL_YEAR (Year 13). Each school
 * year `s` maps to academic-year start `entryStart + (s - entrySchoolYear)`.
 *
 * State rules per row:
 *   - greyed  → the year is not surfaced on the portal (no matching
 *               `showOnPortal` entry). Far-future / out-of-award years the admin
 *               has not opened up are greyed.
 *   - active  → a `showOnPortal` entry exists for this academic year.
 *   - current → the active row whose academic year is the current/next
 *               assessment year (the earliest active year at or after "now").
 *
 * When the entry school year can't be derived (OTHER/unknown group) there is no
 * deterministic Year 6 → Year 13 span to draw and no real school-year number per
 * row. Rather than invent a misleading "Year 1..N" index (which contradicts the
 * page's Year 6 → Year 13 framing), the OTHER/null case renders ONLY the visible
 * scheduled entries — ordered by academic year, each with `schoolYear: null` so
 * the UI shows just the academic year + state. No greyed synthetic rows.
 */
export function buildPortalScheduleRows(
  params: BuildPortalScheduleParams
): PortalScheduleRow[] {
  const {
    entryYearGroup,
    firstAssessmentYear,
    visibleEntries,
    currentAcademicYearStart,
  } = params;

  const entryStart = parseAcademicYearStart(firstAssessmentYear);
  if (entryStart == null) return [];

  // Map each portal-visible entry to its academic-year START (entryStart shifted
  // by scheduleYear-1), so we can match span rows by academic year regardless of
  // how the entry's own label was formatted.
  const visibleStarts = new Set<number>(
    visibleEntries.map((e) => entryStart + (e.scheduleYear - 1))
  );

  // The current/next assessment year is the EARLIEST active (portal-visible)
  // academic year at or after the current academic year. If every active year
  // is in the past, the latest active year is treated as current.
  const activeStarts = Array.from(visibleStarts).sort((a, b) => a - b);
  const upcoming = activeStarts.filter((s) => s >= currentAcademicYearStart);
  const currentStart =
    upcoming.length > 0
      ? upcoming[0]
      : activeStarts.length > 0
        ? activeStarts[activeStarts.length - 1]
        : null;

  const stateForStart = (academicStart: number): PortalScheduleRowState => {
    if (!visibleStarts.has(academicStart)) return "greyed";
    if (currentStart != null && academicStart === currentStart) return "current";
    return "active";
  };

  const entrySchoolYear = schoolYearForGroup(entryYearGroup);

  // OTHER/unknown group: no deterministic school year. Render one row per
  // VISIBLE entry (no synthetic span, no "Year N" label) so the calendar stays
  // graceful and never mislabels rows against the Year 6 → Year 13 framing.
  if (entrySchoolYear == null) {
    return activeStarts.map((academicStart) => {
      const state = stateForStart(academicStart);
      return {
        schoolYear: null,
        academicYear: formatAcademicYearLabel(academicStart),
        state,
        stateLabel: STATE_LABELS[state],
      };
    });
  }

  // Known entry group: draw the full school-year span entry → Year 13.
  const rows: PortalScheduleRow[] = [];
  for (let s = entrySchoolYear; s <= FINAL_ELIGIBLE_SCHOOL_YEAR; s++) {
    const academicStart = entryStart + (s - entrySchoolYear);
    const state = stateForStart(academicStart);
    rows.push({
      schoolYear: s,
      academicYear: formatAcademicYearLabel(academicStart),
      state,
      stateLabel: STATE_LABELS[state],
    });
  }

  return rows;
}
