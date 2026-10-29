import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, runHeadless } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { faYearsLeft, multiYearAllowed, multiYearWeight } from './contractTiming.ts'
import { multiYearTerm } from './contract.ts'
import { US_ARB_YEARS, US_FA_YEARS } from './countries/us/model.ts'
import { KR_FA_HS, KR_FA_UNIV } from './countries/league/profile.ts'
import type { LifeState, StatLine } from './types.ts'

// When a multi-year contract is talked about (PROJECT_PLAN §11.51): the last year before free agency of the player's own league,
// the year before that only for an exceptional season, never earlier; arbitration is not free agency.

const line = (o: Partial<StatLine>): StatLine => ({ games: 130, pa: 500, ab: 450, h: 120, hr: 12, rbi: 0, sb: 0, outs: 0, k: 0, er: 0, w: 0, l: 0, ...o })

/** a Japanese pro with n full first-team seasons in the record */
function jp(n: number, from = '高校'): LifeState {
  const s = createLife({ seed: 11, country: 'JP', pace: 'p15' })
  s.age = 26
  s.career.phase = 'pro'
  s.career.proDebut = true
  s.career.draftedFrom = from
  // (a new life has no record yet: the record is made here, as freeAgent.test.ts does)
  s.bb ??= { rec: { tournaments: [], official: {} } } as unknown as NonNullable<LifeState['bb']>
  s.bb.rec ??= { tournaments: [], official: {} } as unknown as NonNullable<NonNullable<LifeState['bb']>['rec']>
  for (let k = 1; k <= n; k++) s.bb.rec.tournaments.push({ age: s.age - k, name: 'pro', result: '', line: line({}), level: 'pro' })
  return s
}

function other(country: 'US' | 'KR' | 'CU', seasons: number, from?: string): LifeState {
  const s = createLife({ seed: 12, country, pace: 'p15' })
  s.career.phase = 'pro'
  s.career.proSeasons = seasons
  if (from) s.career.draftedFrom = from
  return s
}

describe('the years left before free agency, by league', () => {
  it('Japan: 8 seasons from high school, 7 from a university; none left once he has the right', () => {
    expect(faYearsLeft(jp(3))).toBe(5)
    expect(faYearsLeft(jp(7))).toBe(1)
    expect(faYearsLeft(jp(8))).toBe(0)
    expect(faYearsLeft(jp(3, '大学'))).toBe(4)
    expect(faYearsLeft(jp(6, '大学'))).toBe(1)
  })
  it('the US: 6 years of service; the 3 of arbitration are not "near" (3 left), and the arbitration year is not the last', () => {
    expect(US_ARB_YEARS).toBeLessThan(US_FA_YEARS)
    expect(faYearsLeft(other('US', 0))).toBe(US_FA_YEARS)
    expect(faYearsLeft(other('US', US_ARB_YEARS))).toBe(US_FA_YEARS - US_ARB_YEARS)
    expect(multiYearWeight(other('US', US_ARB_YEARS))).toBe(0)
    expect(faYearsLeft(other('US', US_FA_YEARS - 1))).toBe(1)
  })
  it('Korea: 9 seasons, 8 from a university; Cuba\'s league has no free agency in the model', () => {
    expect(faYearsLeft(other('KR', 2, 'KR-hs'))).toBe(KR_FA_HS - 2)
    expect(faYearsLeft(other('KR', 2, 'KR-univ'))).toBe(KR_FA_UNIV - 2)
    expect(faYearsLeft(other('CU', 3))).toBeUndefined()
    // a Cuban who went to the US plays by the US's years
    const c = other('CU', 2)
    c.flags = { 'cu.mlb': 25 }
    expect(faYearsLeft(c)).toBe(US_FA_YEARS - 2)
  })
})

describe('in the lives', () => {
  it('the talk of the last contract year happens within two years of the right (and mostly in the last), never earlier', () => {
    let seen = 0
    const left: number[] = []
    for (let i = 0; i < 6000 && seen < 12; i++) {
      const s = runHeadless({ seed: hashSeed(i + 5_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 }, { params: defaultParams(), headless: true })
      const h = s.evHist?.['x.pro.contractYear']
      if (!h) continue
      seen++
      const at = h[0]
      // (the life at the age of the event, with the record up to it)
      const then = structuredClone(s)
      then.age = at
      left.push(faYearsLeft(then) ?? 99)
    }
    expect(seen, 'lives with the event').toBeGreaterThan(0)
    // (the record of the event's year may not be in yet, so one year of slack on the last year)
    for (const l of left) expect(l, left.join()).toBeLessThanOrEqual(2)
  }, 120_000)
})

describe('when a multi-year talk is allowed', () => {
  it('three or more years left: never; two: a fraction and only for an exceptional season; one or none: as before', () => {
    expect(multiYearWeight(jp(3))).toBe(0)
    expect(multiYearWeight(jp(5))).toBe(0)
    expect(multiYearWeight(jp(6))).toBe(0.15)
    expect(multiYearWeight(jp(7))).toBe(1)
    expect(multiYearWeight(jp(8))).toBe(1)
    expect(multiYearAllowed(jp(3), 3)).toBe(false)
    expect(multiYearAllowed(jp(6), 1.5)).toBe(false)
    expect(multiYearAllowed(jp(6), 2)).toBe(true)
    expect(multiYearAllowed(jp(7), 1.2)).toBe(true)
    // where the league has no free agency the old rules stay
    expect(multiYearWeight(other('CU', 3))).toBe(1)
  })
  it('the event of the last contract year uses it, and the star contract of the pay still needs its own conditions', () => {
    const ev = EVENTS.get('x.pro.contractYear')!
    const w = (s: LifeState) => (typeof ev.weight === 'function' ? ev.weight(s) : ev.weight ?? 0)
    expect(w(jp(3))).toBe(0)
    expect(w(jp(7))).toBe(22)
    // the auto contract is a star's only: a 3-year deal from 3億円, unchanged
    expect(multiYearTerm(30000, 1.3, 27, false)).toBe(3)
    expect(multiYearTerm(30000, 1.3, 27, true)).toBe(0)
  })
})
