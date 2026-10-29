import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from '../../life.ts'
import { defaultParams } from '../../params.ts'
import { hashSeed } from '../../rng.ts'
import type { LifeState } from '../../types.ts'
import { LIFE_ABROAD_EVENTS } from '../../lifeAbroadEvents.ts'
import { livesAbroad, livesIn, residenceOf } from '../index.ts'
import { US_LIFE_EVENTS, US_LIFE_KINDS } from './lifeEvents.ts'

// Daily life after baseball in the US and across a border (PROJECT_PLAN §11.35): the events ask where he lives, not only where he was
// born; a country's events do not reach a man who is not there.

const headless: Sim = { params: defaultParams(), headless: true }
const screen: Sim = { params: defaultParams() }
const mk = (country: 'JP' | 'US', seed = 3) => createLife({ seed, country, pace: 'p15' })
const def = (id: string) => EVENTS.get(id)!

describe('where he lives', () => {
  it('is the country of birth unless he plays abroad (a Japanese in the MLB lives in the US) or a residence is set', () => {
    expect(residenceOf(mk('JP'))).toBe('JP')
    expect(residenceOf(mk('US'))).toBe('US')
    const away = mk('JP')
    away.career.phase = 'abroad'
    expect(residenceOf(away)).toBe('US')
    expect(livesAbroad(away)).toBe(true)
    away.career.phase = 'retired'
    expect(livesAbroad(away)).toBe(false)
    const moved = mk('US')
    moved.residence = 'JP'
    expect(livesIn(moved, 'JP')).toBe(true)
    expect(livesAbroad(moved)).toBe(true)
  })

  it('a US-born man who lives elsewhere does not meet the US events; one who lives in the US does', () => {
    const s = mk('US')
    s.age = 40
    s.after = { work: { title: 't', years: 5 }, retired: false } as unknown as LifeState['after']
    s.money = 500
    expect(def('us.insurance').when!(s)).toBe(true)
    expect(def('us.thanksgiving').when!(s)).toBe(true)
    s.residence = 'JP'
    for (const d of US_LIFE_EVENTS) if (d.when) expect(d.when(s), d.id).toBe(false)
  })

  it('the events of a country are in that country\'s catalog only', () => {
    for (const d of US_LIFE_EVENTS) expect(d.lives, d.id).toBe('US')
    const jp = mk('JP', 5)
    jp.age = 40
    const open = EVENTS.eligible(jp, 'adult', true).map((d) => d.id)
    expect(open.filter((id) => id.startsWith('us.'))).toEqual([])
  })

  it('every US life event has a kind (arranged or native) and is registered', () => {
    expect(Object.keys(US_LIFE_KINDS).sort()).toEqual(US_LIFE_EVENTS.map((d) => d.id).sort())
    for (const d of US_LIFE_EVENTS) expect(EVENTS.get(d.id), d.id).toBeDefined()
  })
})

describe('across a border', () => {
  const settle = def('life.abroad.settle')

  it('happens to a man who plays in another country, and to nobody else', () => {
    const away = mk('JP')
    away.age = 25
    away.career.phase = 'abroad'
    away.career.phaseYears = 1
    away.career.highestRank = 10
    for (const d of LIFE_ABROAD_EVENTS) if (d.id !== 'life.abroad.distance' && d.id !== 'life.abroad.culture') expect(d.when!(away), d.id).toBe(true)
    expect(def('life.abroad.culture').when!(away)).toBe(true)
    // at home: the same man in a Japanese team, or a US-born man in the US
    const home = mk('JP')
    home.age = 25
    home.career.phase = 'pro'
    home.career.phaseYears = 1
    const us = mk('US')
    us.age = 25
    us.career.phase = 'pro'
    us.career.phaseYears = 1
    for (const d of LIFE_ABROAD_EVENTS) {
      expect(d.when!(home), `${d.id} (home)`).toBe(false)
      expect(d.when!(us), `${d.id} (US)`).toBe(false)
    }
  })

  it('the distance event needs someone far away; the おまかせ answers change no state', () => {
    const away = mk('JP')
    away.age = 25
    away.career.phase = 'abroad'
    away.family.father = null
    away.family.mother = null
    expect(def('life.abroad.distance').when!(away)).toBe(false)
    away.family.partner = 'Emily'
    expect(def('life.abroad.distance').when!(away)).toBe(true)
    for (const d of LIFE_ABROAD_EVENTS) {
      const before = JSON.stringify([away.family, away.status, away.money, away.flags])
      const asked: { auto: number; n: number }[] = []
      d.run({ s: away, rng: undefined as never, headless: true, add: () => {}, ask: (q) => asked.push({ auto: q.autoIndex, n: q.choices.length }), canAsk: () => true })
      d.resolve!({ s: away, rng: undefined as never, headless: true, add: () => {}, ask: () => {}, canAsk: () => true }, asked[0].auto, {})
      expect(JSON.stringify([away.family, away.status, away.money, away.flags]), d.id).toBe(before)
      expect(asked[0].n).toBeGreaterThanOrEqual(2)
    }
    expect(settle.lifePass).toBe(true)
  })
})

describe('later life in the US (PROJECT_PLAN §11.39)', () => {
  /** whether the scheduler would offer it: the age range and the conditions */
  const open = (d: { ages?: [number, number]; when?: (s: LifeState) => boolean }, s: LifeState) => (!d.ages || (s.age >= d.ages[0] && s.age <= d.ages[1])) && (!d.when || d.when(s))
  const retired = (age: number, rank = 6, endedAge = age - 3) => {
    const s = mk('US', 21)
    s.age = age
    s.career.phase = 'retired'
    s.career.highestRank = rank
    s.career.endedAge = endedAge
    return s
  }

  it('a job in baseball: only for a man who played beyond high school and stopped recently', () => {
    const d = def('us.coachOffer')
    expect(open(d, retired(30))).toBe(true)
    expect(open(d, retired(30, 4))).toBe(false) // high school only
    expect(open(d, retired(30, 6, 15))).toBe(false) // stopped too long ago
    const never = retired(30)
    never.career.endedAge = null
    expect(open(d, never)).toBe(false)
    const away = retired(30)
    away.residence = 'JP'
    expect(open(d, away)).toBe(false)
  })

  it('the broadcaster\'s offer needs the major leagues', () => {
    const d = def('us.broadcast')
    expect(open(d, retired(40, 8))).toBe(true)
    expect(open(d, retired(40, 7))).toBe(false)
    expect(open(d, retired(70, 8))).toBe(false)
  })

  it('the public health insurance comes at 64 to 66, once, and おまかせ enrols a man who no longer works', () => {
    const d = def('us.medicare')
    expect(open(d, retired(63))).toBe(false)
    expect(open(d, retired(65))).toBe(true)
    expect(open(d, retired(67))).toBe(false)
    const s = retired(65)
    const asked: number[] = []
    d.run({ s, rng: undefined as never, headless: true, add: () => {}, ask: (q) => asked.push(q.autoIndex), canAsk: () => true })
    expect(asked[0]).toBe(0)
    s.after = { work: { title: 't', years: 3 }, retired: false } as unknown as LifeState['after']
    d.run({ s, rng: undefined as never, headless: true, add: () => {}, ask: (q) => asked.push(q.autoIndex), canAsk: () => true })
    expect(asked[1]).toBe(1)
    s.taken.push('us.medicare')
    expect(open(d, s)).toBe(false)
  })

  it('the family\'s visit needs a grown child; the move needs the later years and no job (or 65)', () => {
    const visit = def('us.familyVisit')
    const s = retired(62)
    expect(open(visit, s)).toBe(false)
    s.family.kids = [30]
    expect(open(visit, s)).toBe(true)
    const move = def('us.retireMove')
    expect(open(move, retired(59))).toBe(false)
    expect(open(move, retired(62))).toBe(true)
    const working = retired(62)
    working.after = { work: { title: 't', years: 3 }, retired: false, home: 'rent' } as unknown as LifeState['after']
    expect(open(move, working)).toBe(false)
    working.age = 66
    expect(open(move, working)).toBe(true)
  })

  it('each has a subject (theme), and none is met by a man who lives in another country', () => {
    for (const id of ['us.coachOffer', 'us.broadcast', 'us.medicare', 'us.familyVisit', 'us.retireMove']) {
      const d = def(id)
      expect(d.lives, id).toBe('US')
      expect(d.theme, id).toBeTruthy()
      const away = retired(66, 9)
      away.family.kids = [30]
      away.residence = 'JP'
      expect(d.when!(away), id).toBe(false)
    }
  })
})

describe('US life after baseball', () => {
  it('the events happen in retired US lives and a screen life with the おまかせ answers is the headless life', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 150; i++) {
      const s = runHeadless({ seed: hashSeed(i + 16_000_000), country: 'US', pace: 'p15' }, headless)
      for (const id of Object.keys(s.evHist ?? {})) if (id.startsWith('us.')) seen.add(id)
    }
    for (const id of ['us.thanksgiving', 'us.insurance', 'us.retirementPlan']) expect(seen.has(id), id).toBe(true)
    for (let i = 0; i < 8; i++) {
      const seed = hashSeed(i + 16_100_000)
      const ui = createLife({ seed, country: 'US', pace: 'p15' })
      for (let g = 0; g < 130 && ui.alive; g++) {
        const plan = planYear(ui, screen)
        let d = plan.decision?.decision
        while (d && ui.alive) d = resolveDecision(ui, d.autoIndex, screen).followUp?.decision
        endYear(ui)
      }
      const fast = runHeadless({ seed, country: 'US', pace: 'p15' }, headless)
      expect(ui.age).toBe(fast.age)
      expect(ui.money).toBe(fast.money)
      expect(ui.family).toEqual(fast.family)
    }
  })

  it('a divorce, a new start and a second marriage', () => {
    const s = mk('US', 8)
    s.age = 40
    s.family.spouse = { name: 'Emily', years: 6 }
    s.family.everMarried = true
    s.family.children = 1
    s.family.kids = [4]
    const rng = { chance: () => true, pick: <T,>(a: T[]) => a[0], next: () => 0.1 }
    const c = { s, rng: rng as never, headless: true, add: () => {}, ask: () => {}, canAsk: () => true }
    def('us.divorce').resolve!(c, 1, {})
    expect(s.family.spouse).toBeNull()
    expect(s.family.ended).toBe('divorce')
    expect(def('us.remeet').when!(s)).toBe(false)
    s.age += 1
    expect(def('us.remeet').when!(s)).toBe(true)
    def('us.remeet').resolve!(c, 0, { name: 'Grace' })
    expect(s.family.partner).toBe('Grace')
    expect(def('us.remeet').when!(s)).toBe(false)
    // the proposal (us.propose, year.ts) marries and clears the end of the first marriage
    ;(s as unknown as { pending: unknown }).pending = { id: 'us.propose', data: { name: 'Grace' } }
    resolveDecision(s, 0, screen)
    expect(s.family.spouse?.name).toBe('Grace')
    expect(s.family.ended).toBeUndefined()
    expect(s.family.children).toBe(1)
    // while married there is no new start and no second divorce question without years together
    expect(def('us.remeet').when!(s)).toBe(false)
  })

  it('a child leaving for college is asked once per child; the college event needs a college', () => {
    const s = mk('US', 9)
    s.age = 48
    s.family.kids = [17, 14]
    s.family.children = 2
    s.money = 100
    const kc = def('us.kidCollege')
    expect(kc.when!(s)).toBe(true)
    const asked: { auto: number }[] = []
    kc.run({ s, rng: undefined as never, headless: true, add: () => {}, ask: (q) => asked.push({ auto: q.autoIndex }), canAsk: () => true })
    expect(asked[0].auto).toBe(1) // savings are short: the loan-and-job route
    expect(kc.when!(s)).toBe(false) // the 17-year-old is settled; the 14-year-old is not old enough
    expect(def('us.homecoming').when!(s)).toBe(false)
  })
})

