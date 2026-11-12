// Which OPEN round is "current" when several are open (prod, 12 Nov 2026:
// opening 2027/28 displaced 2026/27 as the current round).

import { describe, expect, it } from 'vitest'

import { splitOpenRounds } from '../current-round'

const round = (academicYear: string, status: string, openDate: string) => ({
  academicYear,
  status,
  openDate: new Date(`${openDate}T00:00:00.000Z`),
})

describe('splitOpenRounds', () => {
  it('keeps the earliest-opened round current when a later round is opened', () => {
    const r2627 = round('2026/27', 'OPEN', '2025-11-07')
    const r2728 = round('2027/28', 'OPEN', '2026-11-07')
    // Input order must not matter (the Rounds page lists academic year desc).
    const { current, future } = splitOpenRounds([r2728, r2627])
    expect(current).toBe(r2627)
    expect(future).toEqual([r2728])
  })

  it('promotes the next round once the current one is closed', () => {
    const r2627 = round('2026/27', 'CLOSED', '2025-11-07')
    const r2728 = round('2027/28', 'OPEN', '2026-11-07')
    expect(splitOpenRounds([r2728, r2627])).toEqual({ current: r2728, future: [] })
  })

  it('ignores DRAFT rounds and returns null when nothing is open', () => {
    const draft = round('2027/28', 'DRAFT', '2026-11-07')
    expect(splitOpenRounds([draft])).toEqual({ current: null, future: [] })
  })

  it('breaks an open-date tie on the earlier academic year', () => {
    const a = round('2027/28', 'OPEN', '2026-11-07')
    const b = round('2026/27', 'OPEN', '2026-11-07')
    expect(splitOpenRounds([a, b]).current).toBe(b)
  })
})
