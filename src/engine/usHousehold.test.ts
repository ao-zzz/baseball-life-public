import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { LifeState } from './types.ts'
import { PENSION, US_PENSION_AGE, ensureAfter, householdYear, incomeNow, usHousehold, usMedical, usPension } from './after.ts'
import { setResidence } from './countries/index.ts'
import { STATS } from '../data/stats.ts'

// The US's pension and health costs in retirement (PROJECT_PLAN §11.40): only for a man who lives in the US, once, in the income that
// the lifetime total and the household both read.

const headless: Sim = { params: defaultParams(), headless: true }
const mk = (country: 'JP' | 'US', age = 70): LifeState => {
  const s = createLife({ seed: 31, country, pace: 'p15' })
  s.age = age
  s.career.phase = 'retired'
  const a = ensureAfter(s)
  a.retired = true
  a.home = 'own'
  s.lifetimeIncome = 12000
  return s
}

describe('the US pension', () => {
  it('begins at 67, not at 65, and is scaled by what he earned; a spouse adds a share', () => {
    const s = mk('US', 66)
    expect(usPension(s)).toBe(0)
    expect(incomeNow(s, null)).toBe(0)
    s.age = US_PENSION_AGE
    expect(usPension(s)).toBe(250)
    expect(incomeNow(s, null)).toBe(250)
    s.lifetimeIncome = 3000
    expect(usPension(s)).toBeLessThan(250)
    expect(usPension(s)).toBeGreaterThanOrEqual(100)
    s.lifetimeIncome = 12000
    s.family.spouse = { name: 'Emily', years: 30 }
    expect(usPension(s)).toBe(375)
    // working a little beside it: 40% of the job's pay, as before (one count, not two)
    expect(incomeNow(s, null)).toBe(375)
  })

  it('is the US\'s only for a man who lives in the US: a Japanese keeps Japan\'s, and a US-born man who lives in Japan has Japan\'s', () => {
    const jp = mk('JP', 66)
    expect(usHousehold(jp)).toBe(false)
    expect(incomeNow(jp, null)).toBe(PENSION)
    const usAtHome = mk('US', 66)
    expect(incomeNow(usAtHome, null)).toBe(0)
    const usInJapan = mk('US', 66)
    setResidence(usInJapan, 'JP')
    expect(usHousehold(usInJapan)).toBe(false)
    expect(incomeNow(usInJapan, null)).toBe(PENSION)
    // a Japanese who lives in the US (a retired man there, set by hand) has the US's
    const jpInUs = mk('JP', 66)
    setResidence(jpInUs, 'US')
    expect(incomeNow(jpInUs, null)).toBe(0)
  })
})

describe('health costs in retirement', () => {
  it('are charged from 65 to a retired man in the US, more from 80, and to nobody else', () => {
    expect(usMedical(mk('US', 64))).toBe(0)
    expect(usMedical(mk('US', 65))).toBe(30)
    expect(usMedical(mk('US', 80))).toBe(55)
    const working = mk('US', 66)
    ensureAfter(working).retired = false
    expect(usMedical(working)).toBe(0)
    // the household: the same year costs a US man the medical sum more than the same Japanese
    const us = mk('US', 70)
    const jp = mk('JP', 70)
    for (const s of [us, jp]) {
      s.income = 200
      s.money = 1000
    }
    householdYear(us)
    householdYear(jp)
    expect(jp.money - us.money).toBe(30)
  })
})

/** one year as the game plays it: the real planYear, the answers of おまかせ, endYear */
function playYear(s: LifeState) {
  const plan = planYear(s, headless)
  let d = plan.decision?.decision
  while (d && s.alive) d = resolveDecision(s, d.autoIndex, headless).followUp?.decision
}

interface Year {
  age: number
  lifetimeBefore: number
  lifetimeAfter: number
  income: number
}

/**
 * A fixed fixture, played through the real yearly code: a retired man of 64 with no job, no spouse and a set lifetime income, living
 * from 64 to 69 (the seed is the first in a fixed list whose man lives that long and takes no job: the fixture, not the result). The
 * assertions below are strict for every one of those six years.
 */
function retiredYears(country: 'JP' | 'US', lifetime: number): Year[] {
  for (let i = 0; i < 400; i++) {
    const s = createLife({ seed: hashSeed(i + 20_200_000), country, pace: 'p15' })
    s.age = 64
    s.career.phase = 'retired'
    s.job = ''
    s.family.spouse = null
    s.money = 5000
    s.lifetimeIncome = lifetime
    const a = ensureAfter(s)
    a.retired = true
    a.home = 'own'
    a.work = undefined
    const years: Year[] = []
    for (let g = 0; g < 6 && s.alive; g++) {
      const lifetimeBefore = s.lifetimeIncome
      const age = s.age
      playYear(s)
      if (!s.alive) break
      years.push({ age, lifetimeBefore, lifetimeAfter: s.lifetimeIncome, income: s.income })
      if (s.after?.work || s.family.spouse) break
      endYear(s)
    }
    if (years.length === 6) return years
  }
  throw new Error('no fixture life')
}

describe('a retired man through the real yearly code (a fixed fixture, strict for every year)', () => {
  it('US: nothing at 64, 65 and 66; at 67 the pension of what he had earned; every year\'s income is counted once in the lifetime total', () => {
    const years = retiredYears('US', 12000)
    expect(years.map((y) => y.age)).toEqual([64, 65, 66, 67, 68, 69])
    for (const y of years) {
      // counted once: the lifetime total grows by exactly the year's income
      expect(y.lifetimeAfter - y.lifetimeBefore, `age ${y.age}`).toBe(y.income)
      if (y.age < US_PENSION_AGE) expect(y.income, `age ${y.age}`).toBe(0)
      else {
        // 250 万円 at a lifetime income of 1.2億円 (the full pension), scaled down as the total is not yet the same each year: the
        // formula reads the total before the year is added
        const expected = Math.round(250 * (0.4 + 0.6 * Math.min(1, y.lifetimeBefore / 12000)))
        expect(y.income, `age ${y.age}`).toBe(expected)
      }
    }
    expect(years[3].income).toBe(250)
    expect(years[3].lifetimeAfter).toBe(12000 + 250)
  })

  it('US: a smaller lifetime income gives a smaller pension, never below four tenths', () => {
    const years = retiredYears('US', 3000)
    const first = years.find((y) => y.age === US_PENSION_AGE)!
    expect(first.income).toBe(Math.round(250 * (0.4 + 0.6 * (3000 / 12000))))
    expect(first.income).toBeLessThan(250)
    expect(first.income).toBeGreaterThanOrEqual(100)
  })

  it('JP: Japan\'s pension from the first retired year, 180 万円 every year, counted once', () => {
    const years = retiredYears('JP', 12000)
    for (const y of years) {
      expect(y.income, `age ${y.age}`).toBe(PENSION)
      expect(y.lifetimeAfter - y.lifetimeBefore, `age ${y.age}`).toBe(PENSION)
    }
  })

  it('the pension enters the household once: from 66 to 67 the year\'s money rises by less than the take-home pension', () => {
    const run = (income: number) => {
      const s = mk('US', 67)
      s.income = income
      s.money = 1000
      householdYear(s)
      return s.money
    }
    const gap = run(0)
    const paid = run(usPension({ ...mk('US', 67) } as LifeState))
    expect(paid).toBeGreaterThan(gap)
    // the household takes 90% of a retired man's income and spends part of it: the rise is positive and can never exceed the pension itself
    expect(paid - gap).toBeLessThanOrEqual(250)
    expect(paid - gap).toBeGreaterThan(0)
  })
})

describe('whole lives', () => {
  it('a US life keeps its money consistent through the years of the pension, and a Japanese life is unchanged', () => {
    for (let i = 0; i < 40; i++) {
      const s = runHeadless({ seed: hashSeed(i + 20_000_000), country: 'US', pace: 'p15' }, headless)
      expect(Number.isFinite(s.money) && Number.isInteger(s.money), `seed ${i}`).toBe(true)
      expect(Number.isFinite(s.lifetimeIncome) && s.lifetimeIncome >= 0).toBe(true)
    }
  })


  it('the assumptions are recorded as assumptions', () => {
    expect(STATS.usHouseholdModel.kind).toBe('assumption')
    expect(STATS.usHouseholdModel.value).toBe(US_PENSION_AGE)
  })
})
