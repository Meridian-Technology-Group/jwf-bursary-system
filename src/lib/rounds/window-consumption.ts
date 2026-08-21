/**
 * window-consumption.ts — Epic 14 D2 (CG-01, US-D2): how the D1 round-window
 * config feeds invitations.
 *
 * Precedence, per the D1 reconciliation decision:
 *  - {{deadline}} stays on the Epic 13 E1 chain
 *    (override → per-type round default → closeDate). A stored window's
 *    `submitBy` FILLS the per-type default only when the E1 column is null —
 *    the explicitly-set E1 column always wins.
 *  - {{opening_date}} has no E1 equivalent, so a stored window's `opensOn`
 *    wins over `Round.openDate`; absent both, the resolver's derived default.
 *
 * Tax-year note (documented disagreement, NOT silently resolved): Epic 02's
 * rule engine derives the application form's tax year from the ROUND's
 * academic year (round 2027/28 → tax year 2026/27) regardless of when the
 * parent applies. Charlotte's NA-winter scenario wants the PREVIOUS year
 * (2025/26) for applications made before the 12 Apr cutover. Per the plan,
 * THE RULE ENGINE WINS until Brian/Charlotte decide otherwise — flagged on
 * the progress board; flipping precedence later is a one-line change here.
 *
 * Pure module — the callers fetch the windows; this decides.
 */

import type { InvitationSituation } from '@prisma/client'
import type { SubmissionDeadlineRound } from '@/lib/rounds/submission-deadline'
import {
  resolveRoundScenario,
  type RoundScenarioKey,
} from '@/lib/rounds/round-scenario'

export interface StoredRoundWindow {
  scenario: RoundScenarioKey
  opensOn: Date | null
  submitBy: Date | null
  defaultTaxYear: string | null
}

/**
 * Which scenario an invitation's situation lands in, decided at send time
 * (`onDate`) against the round being invited into.
 */
export function scenarioForInvitation(
  situation: InvitationSituation | null | undefined,
  onDate: Date,
  roundStartYear: number,
): RoundScenarioKey {
  return resolveRoundScenario({
    applicationType: situation === 'ROLLING_OVER' ? 'ROLLING_OVER' : 'NEW',
    onDate,
    roundStartYear,
  }).scenario
}

/** The stored window row for a scenario, if any. */
export function windowForScenario(
  windows: readonly StoredRoundWindow[],
  scenario: RoundScenarioKey,
): StoredRoundWindow | null {
  return windows.find((w) => w.scenario === scenario) ?? null
}

/**
 * Applies a stored window's `submitBy` as the per-type round default ONLY
 * where the E1 column is null (the E1 column, when set, always wins).
 * Returns a new object; never mutates the input.
 */
export function applyWindowToDeadlineRound(
  round: SubmissionDeadlineRound,
  window: StoredRoundWindow | null,
  situation: InvitationSituation | null | undefined,
): SubmissionDeadlineRound {
  if (!window?.submitBy) return round
  if (situation === 'ROLLING_OVER') {
    return {
      ...round,
      defaultSubmissionDeadlineRolling:
        round.defaultSubmissionDeadlineRolling ?? window.submitBy,
    }
  }
  return {
    ...round,
    defaultSubmissionDeadlineNew:
      round.defaultSubmissionDeadlineNew ?? window.submitBy,
  }
}

/**
 * The {{opening_date}} source: stored window's `opensOn` → the round's
 * openDate → the resolver's derived default for the scenario.
 */
export function openingDateFromWindow(
  window: StoredRoundWindow | null,
  roundOpenDate: Date | null,
  derivedOpensOn: Date,
): Date {
  return window?.opensOn ?? roundOpenDate ?? derivedOpensOn
}

/**
 * The `select` fragment a round read adds to bring its stored windows along.
 * Kept here so every consuming path fetches the same shape.
 */
export const ROUND_WINDOWS_SELECT = {
  windows: {
    select: {
      scenario: true,
      opensOn: true,
      submitBy: true,
      defaultTaxYear: true,
    },
  },
} as const

export interface InvitationScenarioFields {
  /** The deadline round with any window `submitBy` filled into null defaults. */
  deadlineRound: SubmissionDeadlineRound | null
  /** The {{opening_date}} source date, or null when there is no round at all. */
  openingDate: Date | null
}

/**
 * One call per invitation send: resolves the scenario from the situation ×
 * send date × round year, then applies the stored window per the precedence
 * above. With no round (`academicYear` unparseable / null), everything passes
 * through untouched — no invented dates.
 */
export function invitationScenarioFields(input: {
  situation: InvitationSituation | null | undefined
  academicYear: string | null | undefined
  /** The send instant — passed in, never read from the clock here. */
  onDate: Date
  deadlineRound: SubmissionDeadlineRound | null
  roundOpenDate: Date | null
  windows: readonly StoredRoundWindow[]
}): InvitationScenarioFields {
  const { situation, academicYear, onDate, deadlineRound, roundOpenDate, windows } =
    input
  const match = academicYear?.match(/(\d{4})/)
  if (!match) {
    return { deadlineRound, openingDate: roundOpenDate }
  }
  const roundStartYear = Number.parseInt(match[1], 10)
  const derived = resolveRoundScenario({
    applicationType: situation === 'ROLLING_OVER' ? 'ROLLING_OVER' : 'NEW',
    onDate,
    roundStartYear,
  })
  const window = windowForScenario(windows, derived.scenario)
  return {
    deadlineRound: deadlineRound
      ? applyWindowToDeadlineRound(deadlineRound, window, situation)
      : null,
    openingDate: openingDateFromWindow(window, roundOpenDate, derived.opensOn),
  }
}
