/**
 * Which leg an account's recommendation is taken from (batch 1, 8 Oct 2026).
 *
 * The portal recommends from the actual leg alone. For some Year 13 accounts
 * she measures the gap from the theoretical or affordability leg instead.
 * Those accounts close in March 2027 and are not reassessed, so the migration
 * sets the recommendation from her leg once, at load. A later assessment save
 * recalculates it from the actual leg.
 *
 * Pure. The calc, the load plan and the loader's checks all take the
 * recommendation from here, so they cannot disagree.
 */
import type { AssessmentV2Output } from '../../../src/lib/assessment/v2/orchestrator'
import { recommendedPayableFees } from '../../../src/lib/assessment/v2/award'

export type ReferenceLeg = 'ACTUAL' | 'THEORETICAL' | 'AFFORDABILITY'

type Legs = Pick<AssessmentV2Output, 'actualRemainingDi' | 'theoreticalBenchmarkDi' | 'affordabilityAdjustedDi'>

export function legValue(legs: Legs, leg: ReferenceLeg): number {
  switch (leg) {
    case 'THEORETICAL':
      return legs.theoreticalBenchmarkDi
    case 'AFFORDABILITY':
      return legs.affordabilityAdjustedDi
    case 'ACTUAL':
      return legs.actualRemainingDi
  }
}

/**
 * The recommendation from the chosen leg (actual by default), floored at £0 as
 * the engine floors it. The actual leg is returned exactly as the engine gives
 * it; another leg is rounded to pennies first (the affordability leg carries
 * fractions of a penny), so the stored figure and the gap computed from it
 * always agree.
 */
export function recommendedFromLeg(legs: Legs, leg?: ReferenceLeg | null): number {
  const chosen = leg ?? 'ACTUAL'
  const value = recommendedPayableFees(legValue(legs, chosen))
  return chosen === 'ACTUAL' ? value : Math.round(value * 100) / 100
}

/** How the synopsis names a leg. */
export const LEG_NAME: Record<ReferenceLeg, string> = {
  ACTUAL: 'actual',
  THEORETICAL: 'theoretical benchmark',
  AFFORDABILITY: 'affordability-adjusted',
}
