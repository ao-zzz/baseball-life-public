import { describe, expect, it } from 'vitest'
import { fmtOneIn, rarityOf, runCohort, type CohortResult } from './cohort.ts'
import type { Sim } from './life.ts'
import { wilson } from './math.ts'
import { defaultParams } from './params.ts'
import type { LifeConfig } from './types.ts'

const sim: Sim = { params: defaultParams() }

function fake(atLeast: number[], nRarity = 10000): CohortResult {
  return { nRarity, atLeast, nFull: 0, medians: { lifespan: 0, yearsPlaying: 0, lifetimeIncome: 0, happiness: 0 }, playingByAge: [], aliveByAge: [], rankHist: [] }
}

describe('Wilson interval', () => {
  it('contains the point estimate and matches a known value', () => {
    const { lo, hi } = wilson(4674, 10000)
    expect(lo).toBeLessThan(0.4674)
    expect(hi).toBeGreaterThan(0.4674)
    expect(lo).toBeCloseTo(0.4576, 3)
    expect(hi).toBeCloseTo(0.4772, 3)
  })

  it('handles 0 and n hits', () => {
    expect(wilson(0, 10000).lo).toBe(0)
    expect(wilson(0, 10000).hi).toBeGreaterThan(0)
    expect(wilson(10000, 10000).hi).toBeCloseTo(1, 10)
  })
})

describe('rarity is a frequency in same-condition runs (PROJECT_PLAN §6.1, J4)', () => {
  it('states the count, the number of runs and an interval that agree with each other', () => {
    const r = rarityOf(fake([10000, 9000, 4674, 120, 0]), 2)
    expect(r.k).toBe(4674)
    expect(r.n).toBe(10000)
    expect(r.oneIn).toBeCloseTo(10000 / 4674, 10)
    expect(r.text).toContain('10,000回')
    expect(r.text).toContain('4,674回')
    expect(r.lo).toBeLessThan(r.k / r.n)
    expect(r.hi).toBeGreaterThan(r.k / r.n)
  })

  it('shows only a range when fewer than 10 runs reach the stage', () => {
    const r = rarityOf(fake([10000, 50, 7]), 2)
    expect(r.oneIn).toBeNull()
    expect(r.text).toContain('7回')
    expect(r.text).toContain('10回未満')
  })

  it('shows an upper bound when no run reaches the stage', () => {
    const r = rarityOf(fake([10000, 50, 0]), 2)
    expect(r.oneIn).toBeNull()
    expect(r.text).toContain('0回')
    expect(r.text).toContain('上限')
  })

  it('formats frequencies without false precision', () => {
    expect(fmtOneIn(0.75)).toBe('75%')
    expect(fmtOneIn(1 / 2.13)).toBe('2.1回に1回')
    expect(fmtOneIn(1 / 37.4)).toBe('37回に1回')
    expect(fmtOneIn(1 / 1234)).toBe('1,200回に1回')
    expect(fmtOneIn(0)).toBe('—')
  })
})

describe('same-condition cohort', () => {
  const base: LifeConfig = { seed: 99, country: 'JP', pace: 'p15', prefecture: 12 }
  const c = runCohort(base, sim, 2000, 200)

  it('counts are cumulative and consistent', () => {
    expect(c.atLeast[0]).toBe(c.nRarity)
    for (let r = 1; r < c.atLeast.length; r++) expect(c.atLeast[r]).toBeLessThanOrEqual(c.atLeast[r - 1])
    expect(c.rankHist.reduce((a, b) => a + b, 0)).toBe(c.nFull)
  })

  it('curves are shares and survival never rises', () => {
    for (const v of [...c.playingByAge, ...c.aliveByAge]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    for (let a = 1; a < c.aliveByAge.length; a++) expect(c.aliveByAge[a]).toBeLessThanOrEqual(c.aliveByAge[a - 1] + 1e-12)
    for (let a = 0; a < c.playingByAge.length; a++) expect(c.playingByAge[a]).toBeLessThanOrEqual(c.aliveByAge[a] + 1e-12)
  })

  it('medians are finite and plausible', () => {
    expect(c.medians.lifespan).toBeGreaterThan(60)
    expect(c.medians.lifespan).toBeLessThan(100)
    expect(Number.isFinite(c.medians.lifetimeIncome)).toBe(true)
    expect(c.medians.yearsPlaying).toBeGreaterThanOrEqual(0)
  })

  it('is reproducible', () => {
    const again = runCohort(base, sim, 2000, 200)
    expect(again).toEqual(c)
  })
})
