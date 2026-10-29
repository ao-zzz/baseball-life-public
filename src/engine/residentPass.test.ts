import { describe, expect, it } from 'vitest'
import { EVENTS, createLife } from './life.ts'
import { EventRegistry, countryFits, eligibleExtra, runResidentPass, stageOf, themeOf, type EventCtx, type EventDef } from './events.ts'
import { makeRng } from './rng.ts'
import type { LifeState } from './types.ts'
import { US_DAILY_SPECS } from './countries/us/daily.ts'
import { US_LIFE_EVENTS } from './countries/us/lifeEvents.ts'
import { spendingSpecsOf } from './events/spending.ts'
import { PUBLIC_SPECS_US } from './events/publicLife.ts'

// Daily life follows the country he lives in, not the one he was born in (PROJECT_PLAN §11.37): a Japanese who plays in the MLB meets
// the US's daily events, a US-born man who lives elsewhere does not, an event of a subject is met once a year whichever table it
// comes from, and the birth countries' own draws are not involved.

const mk = (country: 'JP' | 'US', seed = 6): LifeState => createLife({ seed, country, pace: 'p15' })
const RESIDENT_IDS = new Set([...US_DAILY_SPECS.map((s) => s.id), ...US_LIFE_EVENTS.map((d) => d.id), ...spendingSpecsOf('US').map((s) => s.id), ...PUBLIC_SPECS_US.map((s) => s.id)])

function ctx(s: LifeState, seed: number, asked: string[] = []): EventCtx {
  return { s, rng: makeRng(seed), headless: true, add: () => {}, ask: (d) => asked.push(d.id), canAsk: () => true }
}

/** a Japanese in the MLB: phase 'abroad', the first team of a pro league reached */
function japaneseInMlb(age = 28): LifeState {
  const s = mk('JP')
  s.age = age
  s.career.phase = 'abroad'
  s.career.highestRank = 10
  s.career.proSeasons = 8
  s.career.phaseYears = 3
  return s
}

const def = (id: string, over: Partial<EventDef>): EventDef => ({ id, category: 'x', stages: ['pro'], run: () => {}, ...over })

describe('which table an event comes from', () => {
  it('the US daily events are tied to where he lives and are in no birth country\'s table', () => {
    for (const id of RESIDENT_IDS) {
      const d = EVENTS.get(id)!
      expect(d.lives, id).toBe('US')
      expect(d.country, id).toBeUndefined()
      expect(themeOf(d), id).toBeTruthy()
    }
    for (const stage of ['pro', 'adult', 'hs'] as const) {
      const us = mk('US')
      us.age = 30
      expect(EVENTS.eligible(us, stage, true).filter((d) => RESIDENT_IDS.has(d.id))).toEqual([])
      expect(eligibleExtra(EVENTS, us, stage).filter((d) => RESIDENT_IDS.has(d.id))).toEqual([])
    }
  })

  it('countryFits follows the residence for these events and the birth country for the others', () => {
    const jpAbroad = japaneseInMlb()
    const resident = EVENTS.get('us.news.clip')!
    expect(countryFits(resident, jpAbroad)).toBe(true)
    expect(countryFits(resident, mk('JP'))).toBe(false)
    const usBorn = mk('US')
    expect(countryFits(resident, usBorn)).toBe(true)
    usBorn.residence = 'JP'
    expect(countryFits(resident, usBorn)).toBe(false)
    // an event of a birth table still goes by the birth country
    expect(countryFits({ country: 'US' }, jpAbroad)).toBe(false)
    expect(countryFits({}, jpAbroad)).toBe(true)
  })
})

describe('a Japanese who plays in the MLB', () => {
  it('meets the US daily events, and only while he lives there', () => {
    const met = new Set<string>()
    for (let seed = 1; seed <= 60; seed++) {
      const s = japaneseInMlb(24 + (seed % 12))
      s.evHist = {}
      for (const id of runResidentPass(EVENTS, ctx(s, seed))) met.add(id)
    }
    expect(met.size).toBeGreaterThanOrEqual(8)
    for (const id of met) expect(RESIDENT_IDS.has(id), id).toBe(true)
    // in a Japanese team, or retired and home again, nothing
    for (const phase of ['pro', 'retired'] as const) {
      const home = japaneseInMlb()
      home.career.phase = phase
      // (Japan has events of its own now: what must not appear is the US's)
      for (let seed = 1; seed <= 20; seed++) expect(runResidentPass(EVENTS, ctx(home, seed)).filter((id) => RESIDENT_IDS.has(id))).toEqual([])
    }
  })

  it('a life in a country that has no resident events draws nothing from the pass, not even a random number', () => {
    const jp = mk('JP')
    jp.age = 30
    jp.career.phase = 'pro'
    jp.residence = 'TW'
    const c: EventCtx = { ...ctx(jp, 1), rng: new Proxy(makeRng(1), { get: () => () => { throw new Error('a draw') } }) }
    expect(runResidentPass(EVENTS, c)).toEqual([])
    expect(stageOf(japaneseInMlb())).toBe('pro')
  })
})

describe('events of another residence (the structure for the other countries)', () => {
  it('a US-born man who lives in Japan meets Japan\'s resident events, not the US\'s', () => {
    const reg = new EventRegistry()
    const asked: string[] = []
    reg.register([def('t.jp.festival', { lives: 'JP', theme: 'community', run: (c) => c.add('normal', 'festival') }), def('t.us.fair', { lives: 'US', theme: 'community', run: (c) => c.add('normal', 'fair') })])
    const s = mk('US')
    s.age = 28
    s.career.phase = 'pro'
    s.residence = 'JP'
    const ran = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      s.evHist = {}
      for (const id of runResidentPass(reg, ctx(s, seed, asked))) ran.add(id)
    }
    expect([...ran]).toEqual(['t.jp.festival'])
  })
})

describe('no double occurrence', () => {
  it('an event of a subject that already happened this year, from the birth table, is left out', () => {
    const reg = new EventRegistry()
    // a birth-table event of the category "friends" (its subject comes from the category table) ran this year
    reg.register([def('t.jp.friends', { category: 'friends', stages: ['pro'] }), def('t.us.friends', { lives: 'US', category: 'usFriends', theme: 'friends' }), def('t.us.holiday', { lives: 'US', category: 'usHoliday', theme: 'holiday' })])
    const s = japaneseInMlb()
    let friends = 0
    let holiday = 0
    for (let seed = 1; seed <= 60; seed++) {
      s.evHist = { 't.jp.friends': [s.age, 1] }
      for (const id of runResidentPass(reg, ctx(s, seed))) {
        if (id === 't.us.friends') friends++
        if (id === 't.us.holiday') holiday++
      }
    }
    expect(friends).toBe(0)
    expect(holiday).toBeGreaterThan(0)
    // the last year's does not count
    s.evHist = { 't.jp.friends': [s.age - 1, 1] }
    let again = 0
    for (let seed = 1; seed <= 60; seed++) again += runResidentPass(reg, ctx(s, seed)).filter((id) => id === 't.us.friends').length
    expect(again).toBeGreaterThan(0)
  })

  it('two resident events of one subject never happen in the same year', () => {
    const reg = new EventRegistry()
    reg.register([def('t.a', { lives: 'US', theme: 'health' }), def('t.b', { lives: 'US', theme: 'health' }), def('t.c', { lives: 'US', theme: 'work' })])
    const s = japaneseInMlb()
    for (let seed = 1; seed <= 200; seed++) {
      s.evHist = {}
      const ran = runResidentPass(reg, ctx(s, seed))
      expect(ran.filter((id) => id === 't.a' || id === 't.b').length).toBeLessThanOrEqual(1)
    }
  })

  it('the same man does not meet the same event twice in a year across passes: cooldown and limits hold', () => {
    const reg = new EventRegistry()
    reg.register([def('t.once', { lives: 'US', theme: 'media', cooldown: 5, maxPerLife: 1 })])
    const s = japaneseInMlb()
    s.evHist = { 't.once': [s.age - 2, 1] }
    for (let seed = 1; seed <= 30; seed++) expect(runResidentPass(reg, ctx(s, seed))).toEqual([])
  })
})
