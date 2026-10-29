import { describe, expect, it } from 'vitest'
import { createLife, endYear, EVENTS, fullName, planYear, prefName, resolveDecision, runHeadless, type Sim } from '../../life.ts'
import { defaultParams } from '../../params.ts'
import { hashSeed } from '../../rng.ts'
import { validateSpecs } from '../../events/spec.ts'
import { MLB_MIN_USD, usdToMan } from '../../contract.ts'
import { COUNTRY_INFO, COUNTRY_ORDER } from '../index.ts'
import { US_FAMILY_NAMES, US_GIVEN_NAMES, US_STATES } from '../../../data/us.ts'
import { US_COLLEGES } from '../../../data/usColleges.ts'
import { STATS } from '../../../data/stats.ts'
import { shareUrl, readShared } from '../../../game/shareLink.ts'
import { PREFECTURES } from '../../../data/jp.ts'
import { US_CHECKS, usProb, usTarget } from './checks.ts'
import { US_ALPHA } from './calibration.ts'
import { COLLEGE_LEVELS, MINOR_PAY_USD, MINOR_RAISE } from './settings.ts'
import { US_DRAFT_ROUNDS, usDraftPick, usMlbPay, usMinorPay } from './model.ts'
import { US_SPECS } from './events.ts'
import { US_DAILY_SPECS } from './daily.ts'
import { US_LIFE_EVENTS } from './lifeEvents.ts'
import { spendingSpecsOf } from '../../events/spending.ts'
import { PUBLIC_SPECS_US } from '../../events/publicLife.ts'
import { PACK_ENTRIES } from '../../packs/index.ts'
import type { Decision, LifeState } from '../../types.ts'

// The US model (PROJECT_PLAN §11.31): the country's place in the registry and the share link, the stages and their ages, the draft
// and its eligibility, the minors and the majors, the events, the death rate, and the rule that a choice on screen cannot change the
// life an おまかせ answer gives (and that Japan's lives do not know the country at all).

const headless: Sim = { params: defaultParams(), headless: true }
const screen: Sim = { params: defaultParams() }
const us = (seed: number, extra: object = {}) => ({ seed, country: 'US' as const, pace: 'p15' as const, ...extra })

function run(seed: number, sim: Sim = headless): LifeState {
  return runHeadless(us(seed), sim)
}

/** a life played as on screen, choosing with `choose` (or the おまかせ answer) */
function play(seed: number, choose?: (d: Decision, s: LifeState) => number | undefined, until = 130): { s: LifeState; asked: { age: number; d: Decision }[] } {
  const s = createLife(us(seed))
  const asked: { age: number; d: Decision }[] = []
  for (let g = 0; g < until && s.alive; g++) {
    const plan = planYear(s, screen)
    let d = plan.decision?.decision
    while (d && s.alive) {
      asked.push({ age: s.age, d })
      d = resolveDecision(s, choose?.(d, s) ?? d.autoIndex, screen).followUp?.decision
    }
    endYear(s)
  }
  return { s, asked }
}

const SEEDS = Array.from({ length: 3500 }, (_, i) => hashSeed(i + 12_000_000))
const LIVES = SEEDS.map((seed) => run(seed))

describe('the country in the registry, the settings and the share link', () => {
  it('Japan, the US, Korea and Cuba can be played (all but Japan as betas), the others are 「準備中」; the order keeps Japan first and the US second', () => {
    expect(COUNTRY_INFO.JP.implemented).toBe(true)
    expect(COUNTRY_INFO.US.implemented).toBe(true)
    for (const c of COUNTRY_ORDER.slice(2)) expect(COUNTRY_INFO[c].implemented, c).toBe(c === 'KR' || c === 'CU')
    expect(COUNTRY_ORDER.slice(0, 2)).toEqual(['JP', 'US'])
    expect(new Set(COUNTRY_ORDER).size).toBe(8)
    expect(COUNTRY_INFO.JP.regions).toHaveLength(PREFECTURES.length)
    expect(COUNTRY_INFO.US.regions).toHaveLength(50)
    // the title 「12万分の1」 is Japan's: another country does not carry it (PROJECT_PLAN §11.30-9)
    expect(COUNTRY_INFO.JP.brand).toBe('12万分の1')
    expect(COUNTRY_INFO.US.brand).not.toContain('12万')
  })

  it('a share link carries the country only when it is not Japan; an old link is Japan\'s; a country that cannot be played voids the link', () => {
    const jp = shareUrl('https://example.org/', { seed: 9, country: 'JP', pace: 'p15', prefecture: 12 })
    expect(jp).not.toContain('c=')
    expect(readShared(new URL(jp).search)).toEqual({ seed: 9, prefecture: 12 })
    expect(readShared('?s=9')).toEqual({ seed: 9 })
    const link = shareUrl('https://example.org/', { seed: 9, country: 'US', pace: 'p15', prefecture: 48, mode: 'potential', stars: 5 })
    expect(new URL(link).searchParams.get('c')).toBe('US')
    expect(readShared(new URL(link).search)).toEqual({ seed: 9, country: 'US', prefecture: 48, mode: 'potential', stars: 5 })
    // the place is checked against the table of the country: 48 is a state, but not a prefecture
    expect(readShared('?s=9&pf=48')).toBeNull()
    expect(readShared('?s=9&c=US&pf=50')).toBeNull()
    expect(readShared('?s=9&c=US&pf=49')).toEqual({ seed: 9, country: 'US', prefecture: 49 })
    expect(readShared('?s=9&c=TW')).toBeNull()
    expect(readShared('?s=9&c=ZZ')).toBeNull()
    expect(readShared('?s=9&c=JP')).toEqual({ seed: 9 })
  })

  it('a US life has English names, a state, and the place and the name read right', () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const s = createLife(us(seed))
      expect(s.person.country).toBe('US')
      expect(US_GIVEN_NAMES).toContain(s.person.given)
      expect(US_FAMILY_NAMES).toContain(s.person.family)
      expect(s.person.prefecture).toBeGreaterThanOrEqual(0)
      expect(s.person.prefecture).toBeLessThan(US_STATES.length)
      expect(prefName(s)).toBe(US_STATES[s.person.prefecture].name)
      expect(fullName(s)).toBe(`${s.person.given} ${s.person.family}`)
    }
    // the draw follows the weights: the biggest state is drawn far more often than the smallest
    const counts = new Map<string, number>()
    for (const seed of SEEDS.slice(0, 3000)) {
      const n = prefName(createLife(us(seed)))
      counts.set(n, (counts.get(n) ?? 0) + 1)
    }
    expect(counts.get('カリフォルニア州') ?? 0).toBeGreaterThan((counts.get('ワイオミング州') ?? 0) * 10)
    // a Japanese life is as it was
    const jp = createLife({ seed: 5, country: 'JP', pace: 'p15' })
    expect(jp.person.country).toBe('JP')
    expect(fullName(jp)).toBe(`${jp.person.family} ${jp.person.given}`)
    expect(PREFECTURES.map((p) => p.name)).toContain(prefName(jp))
  })

  it('a chosen state is kept', () => {
    const s = createLife(us(3, { prefecture: 4 }))
    expect(prefName(s)).toBe('カリフォルニア州')
  })
})

describe('the stages and their ages (the internal age is the age at the start of the school year)', () => {
  const played = (s: LifeState) => s.timeline.map((t, i) => ({ age: t.age, phase: i > 0 ? s.timeline[i - 1].phase : 'child' }))
  const range = (phase: string) => {
    const ages = LIVES.flatMap((s) => played(s).filter((t) => t.phase === phase).map((t) => t.age))
    return [Math.min(...ages), Math.max(...ages)]
  }

  it('Little League (joined at 8, played 9–10), middle school 11–13, high school 14–17 (four years), college 18–21', () => {
    expect(range('youth')).toEqual([9, 10])
    expect(range('jhs')).toEqual([11, 13])
    expect(range('hs')).toEqual([14, 17])
    const [lo, hi] = range('univ')
    expect(lo).toBe(18)
    expect(hi).toBeLessThanOrEqual(21)
    for (const s of LIVES) {
      const hs = played(s).filter((t) => t.phase === 'hs')
      expect(hs.length === 0 || hs.length <= 4, `seed ${s.config.seed}`).toBe(true)
      const col = played(s).filter((t) => t.phase === 'univ')
      expect(col.length <= 4, `seed ${s.config.seed}`).toBe(true)
    }
  })

  it('a stage is entered at the age that ends the one before it (no skipped year, no extra year)', () => {
    for (const s of LIVES) {
      const p = played(s)
      let last = ''
      let prevAge = -1
      for (const t of p) {
        if (t.phase !== last) {
          // the first year of a stage follows the last year of the one before (unless he left baseball in between)
          if (t.phase !== 'retired') {
            if (last === 'youth') expect(t.age, `seed ${s.config.seed}`).toBe(11)
            if (last === 'jhs') expect(t.age).toBe(14)
            if (last === 'hs') expect(t.age).toBe(18)
          }
          last = t.phase
        }
        expect(t.age).toBe(prevAge + 1)
        prevAge = t.age
      }
    }
  })
})

describe('the draft and who may enter it', () => {
  const drafted = LIVES.filter((s) => s.career.usDraft)

  it('is found in the lives, in 20 rounds at most, with a bonus that falls with the pick', () => {
    expect(drafted.length).toBeGreaterThan(3)
    for (const s of drafted) {
      const d = s.career.usDraft!
      expect(d.round).toBeGreaterThanOrEqual(1)
      expect(d.round).toBeLessThanOrEqual(US_DRAFT_ROUNDS)
      expect(d.overall).toBeGreaterThanOrEqual((d.round - 1) * 30 + 1)
      expect(d.overall).toBeLessThanOrEqual(d.round * 30)
      expect(d.bonusUsd).toBeGreaterThan(0)
      expect(['drafted', 'signed', 'declined']).toContain(d.status)
    }
    for (let k = 1; k <= 20 * 30; k += 7) {
      const b = usDraftPick(0.5, 0.5, (k % 30) / 30).bonusUsd
      expect(b).toBeGreaterThan(0)
    }
    // the first slot is the 2025 first pick's assigned value (MLB.com), the late picks at most about $150,000
    expect(usDraftPick(1, 0.5, 0).bonusUsd).toBe(11_075_900)
    expect(usDraftPick(0, 0.5, 0.5).bonusUsd).toBeLessThanOrEqual(150_000)
    // a better player goes earlier and gets more
    let prev = 0
    for (const st of [0, 0.2, 0.5, 0.8, 0.99]) {
      const b = usDraftPick(st, 0.5, 0.5).bonusUsd
      expect(b).toBeGreaterThanOrEqual(prev)
      prev = b
    }
  })

  it('a high-school player is drafted at the end of his senior year (17), a four-year college player after the junior year or at 21 (age 20 and on), a junior-college player in either of his two years (18, 19)', () => {
    for (const s of drafted) {
      const d = s.career.usDraft!
      if (d.from === 'hs') expect(d.age, `seed ${s.config.seed}`).toBe(17)
      if (d.from === 'univ') {
        expect(d.age, `seed ${s.config.seed}`).toBeGreaterThanOrEqual(20)
        expect(d.age).toBeLessThanOrEqual(21)
      }
      if (d.from === 'juco') {
        expect(d.age, `seed ${s.config.seed}`).toBeGreaterThanOrEqual(18)
        expect(d.age).toBeLessThanOrEqual(19)
      }
      // and the draft is the year's own: the age of the draft is a year of the stage he was in
      expect(d.year).toBe(s.person.birthYear + d.age)
    }
  })

  it('who signs enters the minors in that year, with the bonus as income; who does not never plays pro from that draft', () => {
    for (const s of drafted.filter((x) => x.career.usDraft!.status === 'signed')) {
      expect(s.career.draftedFrom).toBe(`US-${s.career.usDraft!.from}`)
      expect(s.timeline.some((t) => t.phase === 'proMinor' || t.phase === 'pro')).toBe(true)
      expect(s.career.highestRank).toBeGreaterThanOrEqual(6)
      expect(s.career.salaryHist?.some((h) => h.kind === 'minor')).toBe(true)
    }
    for (const s of drafted.filter((x) => x.career.usDraft!.status === 'declined')) {
      // (he may be drafted again later from college: only a life that never signed has no pro years)
      if (!s.career.salaryHist?.length) expect(s.timeline.every((t) => t.phase !== 'proMinor' && t.phase !== 'pro')).toBe(true)
    }
  })
})

describe('the college and its levels', () => {
  const col = LIVES.filter((s) => s.schools?.univ)

  /** a life asked the college route, answered with the level named (the label of the option) */
  const toLevel = (label: RegExp) => (d: Decision) => (d.id === 'us.route' ? (d.choices.findIndex((c) => label.test(c.label)) >= 0 ? d.choices.findIndex((c) => label.test(c.label)) : undefined) : undefined)

  it('Division I is a real college of the list, the others carry a general name; the settings of every level are there', () => {
    expect(col.length).toBeGreaterThan(10)
    const names = new Set(US_COLLEGES.map((c) => c.name))
    for (const s of col) {
      const u = s.schools!.univ!
      if (u.id.startsWith('us-d1-')) expect(names.has(u.name), u.name).toBe(true)
      else expect(u.name, u.name).toContain('一般名')
    }
    for (const k of Object.keys(COLLEGE_LEVELS)) expect(COLLEGE_LEVELS[k as keyof typeof COLLEGE_LEVELS].years).toBeGreaterThan(0)
    expect(COLLEGE_LEVELS.juco.years).toBe(2)
    expect(COLLEGE_LEVELS.d1.years).toBe(4)
  })

  it('every level can be chosen on screen (the route is a decision): Division II and III, a junior college, or a Division I place when one invited him', () => {
    const levels = [
      ['d2', /NCAA 2部/],
      ['d3', /NCAA 3部/],
      ['juco', /短大/],
    ] as const
    for (const [id, label] of levels) {
      let n = 0
      for (const seed of SEEDS) {
        if (n >= 4) break
        const base = play(seed, undefined, 20)
        if (!base.asked.some((a) => a.d.id === 'us.route')) continue
        // (stopped when he is 18, right after the route was answered: a junior-college player may later transfer to any level)
        const forced = play(seed, toLevel(label), 18)
        const u = forced.s.schools?.univ
        expect(u, `seed ${seed}`).toBeDefined()
        // (a Division II or III team that does not take him sends him to a junior college)
        expect([`us-${id}`, 'us-juco']).toContain(u!.id)
        expect(u!.name).toContain('一般名')
        n++
      }
      expect(n, id).toBeGreaterThan(0)
    }
  }, 120_000)

  it('a junior-college stay is two years, and a player who goes on transfers to a four-year college as a junior for two more', () => {
    let ended = 0
    let moved = 0
    for (const seed of SEEDS) {
      if (ended >= 12 && moved >= 1) break
      const base = play(seed, undefined, 20)
      if (!base.asked.some((a) => a.d.id === 'us.route')) continue
      const j = play(seed, toLevel(/短大/), 30)
      const years = j.s.timeline.filter((_t, i) => (i > 0 ? j.s.timeline[i - 1].phase : 'child') === 'univ').length
      if (j.s.schools?.univ?.id !== 'us-juco') {
        moved++
        expect(years, `seed ${seed}`).toBeGreaterThan(2)
        expect(years).toBeLessThanOrEqual(4)
      } else if (j.s.timeline.every((t) => t.phase !== 'proMinor' && t.phase !== 'pro')) {
        ended++
        expect(years, `seed ${seed}`).toBeLessThanOrEqual(2)
      }
    }
    expect(ended).toBeGreaterThan(0)
  }, 120_000)
})

describe('the minors and the majors', () => {
  const pros = LIVES.filter((s) => s.career.salaryHist?.length)

  it('the pay: the minors by level, the majors from the league minimum, never above the cap, and the years add up to the service years', () => {
    expect(pros.length).toBeGreaterThan(2)
    for (const s of pros) {
      const hist = s.career.salaryHist!
      for (const h of hist) {
        if (h.kind === 'minor') {
          expect(h.usd!).toBeGreaterThanOrEqual(MINOR_PAY_USD[0])
          expect(h.usd!).toBeLessThanOrEqual(MINOR_PAY_USD[3] * (1 + MINOR_RAISE.max))
        }
        if (h.kind === 'mlb') {
          expect(h.usd!).toBeGreaterThanOrEqual(MLB_MIN_USD)
          expect(h.usd!).toBeLessThanOrEqual(35_000_000)
        }
      }
      const mlb = hist.filter((h) => h.kind === 'mlb')
      expect(mlb.length).toBe(s.career.proSeasons)
      // minor years come before the major years
      const firstMlb = hist.findIndex((h) => h.kind === 'mlb')
      if (firstMlb >= 0) expect(hist.slice(firstMlb).every((h) => h.kind === 'mlb')).toBe(true)
    }
  })

  it('the pay model: near the minimum before arbitration, a share of the market in the three arbitration years, the market after six', () => {
    expect(usMlbPay(0, 0, 0, 0)).toBe(MLB_MIN_USD)
    expect(usMlbPay(2, 0, 3, 2)).toBeLessThan(MLB_MIN_USD * 1.2)
    const arb = usMlbPay(3, 800_000, 1, 0)
    const fa = usMlbPay(6, arb, 1, 0)
    expect(arb).toBeGreaterThan(MLB_MIN_USD)
    expect(fa).toBeGreaterThan(arb)
    expect(usMlbPay(6, 30_000_000, 3, 2.5)).toBeLessThanOrEqual(35_000_000)
    expect(usMlbPay(8, 10_000_000, -2, -2)).toBeGreaterThanOrEqual(6_000_000)
    for (let l = 0; l < 4; l++) expect(usMinorPay(l)).toBe(MINOR_PAY_USD[l])
    expect(MINOR_PAY_USD[0]).toBeLessThan(MINOR_PAY_USD[3])
  })

  it('the minors\' pay (§11.51): the game\'s least pay of each level, a raise for standing and seasons up to 50%, never below the least', () => {
    // the assumed least yearly pay (Rookie, Single-A, Double-A, Triple-A), in dollars
    expect(MINOR_PAY_USD).toEqual([18_000, 26_840, 30_905, 36_590])
    for (let l = 0; l < 4; l++) {
      // a poor record and a first year: the least; no standing, however low, goes below it
      expect(usMinorPay(l, -3, 0)).toBe(MINOR_PAY_USD[l])
      expect(usMinorPay(l, 0, 0)).toBe(MINOR_PAY_USD[l])
      // a good record pays more than a poor one at the same level and seasons, and more seasons pay more
      expect(usMinorPay(l, 1.5, 2)).toBeGreaterThan(usMinorPay(l, -1, 2))
      expect(usMinorPay(l, 0, 4)).toBeGreaterThan(usMinorPay(l, 0, 1))
      // a star's pay is capped at 50% over the least
      expect(usMinorPay(l, 9, 20)).toBeLessThanOrEqual(Math.round(MINOR_PAY_USD[l] * 1.5))
    }
    // a promotion (the next level, one season later, the same standing) never lowers the pay
    for (let l = 0; l < 3; l++) for (const st of [-1, 0, 1, 2]) for (let k = 0; k < 6; k++) expect(usMinorPay(l + 1, st, k + 1)).toBeGreaterThanOrEqual(usMinorPay(l, st, k))
    // the yen shown (usdToMan) of the least pay: Rookie $18,000 = 270万円 at 150 yen
    expect(usdToMan(MINOR_PAY_USD[0])).toBe(270)
  })

  it('the ladder: the minors are rank 6, Double-A or above 7, the first game in the majors 8', () => {
    for (const s of pros) {
      if (s.career.proDebut) expect(s.career.highestRank).toBeGreaterThanOrEqual(8)
      else expect(s.career.highestRank).toBeLessThan(8)
      expect(s.career.highestRank).toBeGreaterThanOrEqual(6)
    }
    // an MLB career is in the record with its games
    const mlb = pros.find((s) => s.career.proDebut)
    if (mlb) expect(mlb.bb?.rec?.official.pro?.games ?? 0).toBeGreaterThan(0)
  })
})

describe('the checks, the death rate and the events', () => {
  it('every check has a target among the statistics (all game assumptions) and its intercept is calibrated', () => {
    for (const [key, c] of Object.entries(US_CHECKS)) {
      const stat = STATS[c.stat]
      expect(stat, key).toBeDefined()
      expect(stat.kind, key).toBe('assumption')
      expect(usTarget(key)).toBeGreaterThan(0)
      expect(usTarget(key)).toBeLessThan(1)
      expect(US_ALPHA[key], `${key} is not calibrated`).toBeTypeOf('number')
      const s = createLife(us(1))
      expect(usProb(s, key)).toBeGreaterThan(0)
      expect(usProb(s, key)).toBeLessThan(1)
    }
  })

  it('the stage rates stay near their targets (the calibration of scripts/calibrate-us.ts)', () => {
    const tally: Record<string, [number, number]> = {}
    const sim: Sim = { params: defaultParams(), headless: true, tally: (k, ok) => { const a = (tally[k] ??= [0, 0]); a[1]++; if (ok) a[0]++ } }
    for (const seed of SEEDS.slice(0, 3000)) runHeadless(us(seed), sim, true)
    for (const key of ['us.mid', 'us.hs', 'us.hsStay', 'us.hsCollege']) {
      const [ok, n] = tally[key]
      expect(n, key).toBeGreaterThan(300)
      expect(Math.abs(ok / n - usTarget(key)), key).toBeLessThan(0.06)
    }
  })

  it('the life table: the mean age at death of US lives is near the table (76.5 at birth)', () => {
    const mean = LIVES.reduce((a, s) => a + s.age, 0) / LIVES.length
    expect(mean).toBeGreaterThan(75.2)
    expect(mean).toBeLessThan(78.4)
    expect(STATS.usLifeMale.value).toBe(76.5)
    expect(STATS.usLifeMale.kind).toBe('measured')
  })

  it('the US events are well formed, neutral on the おまかせ path, and met only by US lives (and none of Japan\'s by them)', () => {
    const known = new Set(EVENTS.all().map((e) => e.id))
    expect(validateSpecs(US_SPECS, known)).toEqual([])
    // (the daily-life specs and the retirees' events of §11.35–11.36 are the US's too)
    expect(validateSpecs([...US_SPECS, ...US_DAILY_SPECS], known)).toEqual([])
    const base = [...US_SPECS.map((e) => e.id), ...US_DAILY_SPECS.map((e) => e.id), ...US_LIFE_EVENTS.map((e) => e.id), ...spendingSpecsOf('US').map((e) => e.id), ...PUBLIC_SPECS_US.map((e) => e.id)]
    // the event packs (src/engine/packs) that name the US are the US's too; a pack chosen by the country of birth that names the US and
    // not Japan never meets a Japanese life (one chosen by residence may, while he lives in the US)
    const packIds = (f: (e: (typeof PACK_ENTRIES)[number]) => boolean) => PACK_ENTRIES.filter(f).map((e) => e.def.id)
    const usIds = new Set([...base, ...packIds((e) => e.countries.includes('US'))])
    const usOnly = new Set([...base, ...packIds((e) => e.countries.includes('US') && !e.countries.includes('JP') && e.where === 'born')])
    for (const s of LIVES) for (const id of Object.keys(s.evHist ?? {})) expect(usIds.has(id), `${id} in a US life`).toBe(true)
    let met = 0
    for (const s of LIVES) met += Object.keys(s.evHist ?? {}).length
    expect(met).toBeGreaterThan(20)
    for (let i = 0; i < 300; i++) {
      const jp = runHeadless({ seed: hashSeed(i + 13_000_000), country: 'JP', pace: 'p15' }, headless)
      for (const id of Object.keys(jp.evHist ?? {})) expect(usOnly.has(id), `${id} in a Japanese life`).toBe(false)
    }
  }, 60_000)

  it('a Japanese life never draws a US check', () => {
    const keys = new Set<string>()
    const sim: Sim = { params: defaultParams(), headless: true, tally: (k) => keys.add(k) }
    for (let i = 0; i < 200; i++) runHeadless({ seed: hashSeed(i + 14_000_000), country: 'JP', pace: 'p15' }, sim)
    expect([...keys].some((k) => k.startsWith('us.'))).toBe(false)
    expect([...keys].some((k) => k.startsWith('jp.'))).toBe(true)
  })
})

describe('the choices on screen leave the おまかせ life as the headless one', () => {
  it('a US life played with the おまかせ answers on screen is the headless life', () => {
    for (const seed of SEEDS.slice(0, 150)) {
      const h = run(seed)
      const { s } = play(seed)
      expect(s.career.highestRank, `seed ${seed}`).toBe(h.career.highestRank)
      expect(s.career.endedAge).toBe(h.career.endedAge)
      expect(s.career.usDraft).toEqual(h.career.usDraft)
      expect(s.career.proSeasons).toBe(h.career.proSeasons)
      expect(s.career.minorSeasons).toBe(h.career.minorSeasons)
      expect(s.career.salaryHist).toEqual(h.career.salaryHist)
      expect(s.age).toBe(h.age)
    }
  }, 120_000)

  // the lives in which the player is asked to sign or to go to school, found among the headless lives that were drafted
  const asks = LIVES.filter((s) => s.career.usDraft).map((s) => s.config.seed)

  it('the question of signing or going to school is asked on screen only, with the signing answer from a check; the other answer is a different life', () => {
    let tried = 0
    for (const seed of asks) {
      if (tried >= 6) break
      const base = play(seed)
      const q = base.asked.find((a) => a.d.id === 'us.draftSign')
      if (!q) continue
      tried++
      expect(q.d.stop).toBe(true)
      expect(q.d.choices).toHaveLength(2)
      expect(q.d.choices[0].label).toContain('契約する')
      const other = q.d.autoIndex === 0 ? 1 : 0
      // (the stage he is in at the end of that year, after the answer: the minors if he signed, not if he did not)
      const phaseAfter = (r: { s: LifeState }) => r.s.timeline.find((t) => t.age === q.age)?.phase
      const alt = play(seed, (d) => (d.id === 'us.draftSign' ? other : undefined))
      expect(phaseAfter(alt) === 'proMinor', `seed ${seed}`).toBe(other === 0)
      expect(phaseAfter(base) === 'proMinor').toBe(q.d.autoIndex === 0)
      // signing leads to the minors
      const sign = play(seed, (d) => (d.id === 'us.draftSign' ? 0 : undefined))
      expect(phaseAfter(sign)).toBe('proMinor')
      expect(sign.s.career.salaryHist?.some((h) => h.kind === 'minor')).toBe(true)
      expect(sign.s.career.signingPay === undefined || sign.s.career.signingPay >= 0).toBe(true)
      // a player's own choice never reaches the headless life: the headless one is the おまかせ one
      expect(run(seed).career.usDraft).toEqual(base.s.career.usDraft)
    }
    expect(tried).toBeGreaterThan(0)
  }, 120_000)

  it('nothing is asked in a headless life, and the college route is a decision on screen with the quitting answer last', () => {
    let seen = 0
    for (const seed of SEEDS.slice(0, 200)) {
      const { asked } = play(seed)
      const r = asked.find((a) => a.d.id === 'us.route')
      if (!r) continue
      seen++
      expect(r.d.choices.at(-1)!.label).toContain('野球をやめて')
      expect(r.d.stop).toBe(true)
    }
    expect(seen).toBeGreaterThan(0)
  }, 60_000)
})
