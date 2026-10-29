import { describe, expect, it, vi } from 'vitest'
import type * as RngModule from '../engine/rng.ts'
import type * as SeasonModule from '../engine/careerSeason.ts'
import type { EventCtx } from '../engine/events.ts'
import { makeCountingRng, newDrawLog, type DrawLog } from './countingRng.ts'

// A Japanese player's MLB seasons (careerSeason.ts mlbSeason, called once a year from life.ts abroadYear) against the same lives
// without them. In this file alone (vi.mock): the random numbers are counted (countingRng.ts, proved equal to the real ones by
// rngMeasure.test.ts), and mlbSeason can be switched off, which is the game before the change (the call is the change's only
// effect on a life). Every life here goes to the MLB under the game's own settings: the one life of the normal mode among the
// fingerprint's 100,000 seeds, and lives of the potential mode (★5, ★10), which the settings offer.

const ctl = vi.hoisted(() => ({
  log: null as DrawLog | null,
  mlbOff: false,
  /** the seeds of the streams mlbSeason was given, and the lines it wrote */
  mlbSeeds: new Set<number>(),
  mlbTexts: new Set<string>(),
  mlbLines: 0,
  calls: 0,
}))

vi.mock('../engine/rng.ts', async (importOriginal) => {
  const real = await importOriginal<typeof RngModule>()
  return { ...real, makeRng: (seed: number) => (ctl.log ? makeCountingRng(seed, real.hashSeed, ctl.log) : real.makeRng(seed)) }
})

vi.mock('../engine/careerSeason.ts', async (importOriginal) => {
  const real = await importOriginal<typeof SeasonModule>()
  return {
    ...real,
    mlbSeason: (c: EventCtx, standing: number, year: number) => {
      ctl.calls++
      ctl.mlbSeeds.add(c.rng.seed)
      if (ctl.mlbOff) return
      const add: EventCtx['add'] = (kind, text, opts) => {
        ctl.mlbTexts.add(text)
        ctl.mlbLines++
        c.add(kind, text, opts)
      }
      real.mlbSeason({ ...c, add }, standing, year)
    },
  }
})

import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from '../engine/life.ts'
import { mlbSeason } from '../engine/careerSeason.ts'
import { defaultParams } from '../engine/params.ts'
import type { LifeConfig, LifeState, StatLine } from '../engine/types.ts'

const real = await vi.importActual<typeof RngModule>('../engine/rng.ts')
const JP = (seed: number, stars?: number): LifeConfig => ({ seed, country: 'JP', pace: 'p15', ...(stars ? { mode: 'potential' as const, stars } : {}) })
const mlbYears = (s: LifeState) => (s.career.salaryHist ?? []).filter((h) => h.kind === 'mlb')

/** a life with or without its MLB seasons: the calibrated draws in order, the events taken, every line and question with its time,
 * the draws of every stream but the MLB seasons' (by seed), and the state at the end without the MLB record */
function play(config: LifeConfig, screen: boolean, off: boolean) {
  ctl.mlbOff = off
  ctl.mlbSeeds.clear()
  ctl.mlbTexts.clear()
  ctl.mlbLines = 0
  ctl.calls = 0
  ctl.log = newDrawLog()
  try {
    const tally: string[] = []
    const sim: Sim = { params: defaultParams(), headless: !screen, tally: (k, ok) => tally.push(`${k}${ok ? 1 : 0}`) }
    const s = createLife(config)
    const lines: unknown[] = []
    // the time of each line in its year (screen only: life.ts add places a line one slot after the lines before it in the year)
    const times: { age: number; at: number }[] = []
    const keep = (evs: { at: number; entry: LifeState['log'][number] }[]) => {
      for (const e of evs) {
        s.log.push(e.entry)
        if (ctl.mlbTexts.has(e.entry.text)) continue
        lines.push(e.entry)
        times.push({ age: e.entry.age, at: e.at })
      }
    }
    for (let g = 0; g < 130 && s.alive; g++) {
      const plan = planYear(s, sim)
      if (plan.decision) times.push({ age: s.age, at: plan.decision.at })
      keep(plan.events)
      let d = plan.decision?.decision
      while (d && s.alive) {
        lines.push(['D', d])
        const r = resolveDecision(s, d.autoIndex, sim)
        keep(r.events)
        d = r.followUp?.decision
      }
      endYear(s)
    }
    const log = ctl.log
    const draws = new Map<number, number>()
    let mlbDraws = 0
    log.streams.forEach((seed, i) => {
      if (ctl.mlbSeeds.has(seed)) mlbDraws += log.counts[i]
      else draws.set(seed, (draws.get(seed) ?? 0) + log.counts[i])
    })
    // the state without the MLB record and its lines (the only things the seasons add)
    const x = structuredClone(s)
    const mlbRows = x.bb?.rec?.tournaments.filter((t) => t.level === 'mlb') ?? []
    if (x.bb?.rec) {
      x.bb.rec.tournaments = x.bb.rec.tournaments.filter((t) => t.level !== 'mlb')
      delete x.bb.rec.official.mlb
    }
    x.log = x.log.filter((e) => !ctl.mlbTexts.has(e.text))
    return { tally, taken: [...s.taken], lines: lines.map((l) => JSON.stringify(l)), times, draws: [...draws.entries()].sort((a, b) => a[0] - b[0]), mlbDraws, calls: ctl.calls, mlbRows, mlbLines: ctl.mlbLines, state: JSON.stringify(x), life: s }
  } finally {
    ctl.log = null
    ctl.mlbOff = false
  }
}

/** '' when the two lists are the same; else where they first part, short enough to read */
function firstDiff(a: string[], b: string[]): string {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return `#${i} of ${a.length}/${b.length}\n  with:    ${a[i]?.slice(0, 400)}\n  without: ${b[i]?.slice(0, 400)}`
  return ''
}

// lives that go to the MLB, found by the game's own runs: the normal mode's one among the fingerprint's seeds (hashSeed(i + 4_000_000)),
// and the first of the potential mode's at ★5 and ★10 (hashSeed(i + 9_700_000))
const CASES: [string, LifeConfig][] = [
  ['normal', JP(2773927017)],
  ...[542075065, 2467314401, 3589431820].map((seed): [string, LifeConfig] => ['★5', JP(seed, 5)]),
  ...[1480476264, 1131301190, 2893515760, 2664157323].map((seed): [string, LifeConfig] => ['★10', JP(seed, 10)]),
]

describe('the MLB seasons leave the rest of the life as it was', () => {
  for (const screen of [false, true]) {
    it(`${screen ? 'on screen' : 'without a screen'}: the same calibrated draws, events, lines, draws of every other stream, NPB record and state`, () => {
      let shifted = 0
      for (const [mode, config] of CASES) {
        const name = `${mode} seed ${config.seed}`
        const on = play(config, screen, false)
        const off = play(config, screen, true)
        // the case is worth something only if he did play in the MLB
        expect(mlbYears(on.life).length, `${name}: years in the MLB`).toBeGreaterThan(0)
        expect(on.calls, name).toBe(mlbYears(on.life).length)
        expect(off.calls, name).toBe(on.calls)
        expect(on.mlbDraws, `${name}: the MLB seasons draw on their own streams`).toBeGreaterThan(0)
        expect(off.mlbDraws, name).toBe(0)
        expect(on.mlbRows.length, name).toBeGreaterThan(0)
        expect(on.mlbLines, name).toBe(mlbYears(on.life).length)
        expect(on.tally, `${name}: calibrated draws`).toEqual(off.tally)
        expect(on.taken, `${name}: events`).toEqual(off.taken)
        expect(firstDiff(on.lines, off.lines), `${name}: lines and questions, in order`).toBe('')
        // the time of a line in its year: the same in every year outside the MLB; in an MLB year a line after the season's comes
        // one slot (0.11 of the year) later, or at the year's last moment (the clamp of life.ts add); a question keeps its time
        const years = new Set(mlbYears(on.life).map((h) => h.age))
        expect(on.times.length, name).toBe(off.times.length)
        on.times.forEach((t, i) => {
          const o = off.times[i]
          expect(t.age, name).toBe(o.age)
          if (!years.has(t.age)) expect(t.at, `${name} age ${t.age}: time of line ${i}`).toBe(o.at)
          else {
            const d = t.at - o.at
            expect(Math.abs(d) < 1e-9 || Math.abs(d - 0.11) < 1e-9 || (d > 0 && (t.at === 0.94 || t.at === 0.55)), `${name} age ${t.age}: ${o.at} → ${t.at}`).toBe(true)
            if (Math.abs(d) > 1e-9) shifted++
          }
        })
        expect(on.draws, `${name}: draws of every other stream`).toEqual(off.draws)
        expect(on.state, `${name}: state (NPB record included)`).toBe(off.state)
      }
      console.log(`${screen ? 'screen' : 'headless'}: ${CASES.length} lives; lines placed later in their MLB year: ${shifted}`)
    }, 120_000)
  }
})

// ---------------------------------------------------------------- the lines of the MLB seasons

const ok = (n: number) => Number.isInteger(n) && n >= 0

/** a season line that a box score could have: whole numbers, no more hits than at-bats, at most 162 games, and so on */
function sane(l: StatLine, what: string) {
  for (const k of Object.keys(l) as (keyof StatLine)[]) expect(ok(l[k]), `${what}: ${k} ${l[k]}`).toBe(true)
  expect(l.games, what).toBeLessThanOrEqual(162)
  expect(l.ab, what).toBeLessThanOrEqual(l.pa)
  expect(l.h, what).toBeLessThanOrEqual(l.ab)
  expect(l.hr, what).toBeLessThanOrEqual(l.h)
  expect(l.rbi, what).toBeGreaterThanOrEqual(l.hr)
  expect(l.sb, what).toBeLessThanOrEqual(l.games)
  expect(l.w + l.l, what).toBeLessThanOrEqual(l.games)
  if (l.outs) expect(Number.isFinite((l.er * 27) / l.outs), what).toBe(true)
}

describe('the MLB seasons themselves', () => {
  const sim: Sim = { params: defaultParams(), headless: true }
  const lives: LifeState[] = []
  for (let i = 0; i < 700; i++) {
    const s = runHeadless(JP(real.hashSeed(i + 9_700_000), 10), sim)
    if (mlbYears(s).length) lives.push(s)
  }

  it('every MLB season is a possible line; one row a year at most, never in a year of NPB games; totals are the sums', () => {
    expect(lives.length).toBeGreaterThan(100)
    let rows = 0
    let batters = 0
    let pitchers = 0
    for (const s of lives) {
      const rec = s.bb!.rec!
      const mlb = rec.tournaments.filter((t) => t.level === 'mlb')
      const npbAges = new Set(rec.tournaments.filter((t) => t.level === 'pro' || t.level === 'farm').map((t) => t.age))
      expect(new Set(mlb.map((t) => t.age)).size, `${s.config.seed}`).toBe(mlb.length)
      for (const t of mlb) {
        sane(t.line, `${s.config.seed} age ${t.age}`)
        expect(t.line.games).toBeGreaterThan(0)
        expect(npbAges.has(t.age), `${s.config.seed} age ${t.age}: MLB and NPB games in one year`).toBe(false)
        if (s.person.position === 'P') {
          expect(t.line.pa).toBe(0)
          expect(t.line.outs).toBeGreaterThan(0)
        } else expect(t.line.outs).toBe(0)
      }
      rows += mlb.length
      if (mlb.length && s.person.position === 'P') pitchers++
      else if (mlb.length) batters++
      for (const [lv, list] of [['mlb', mlb], ['pro', rec.tournaments.filter((t) => t.level === 'pro')]] as const) {
        const tot = rec.official[lv]
        for (const k of ['games', 'pa', 'ab', 'h', 'hr', 'rbi', 'sb', 'outs', 'k', 'er', 'w', 'l'] as const) expect(tot?.[k] ?? 0, `${s.config.seed} ${lv} ${k}`).toBe(list.reduce((a, t) => a + t.line[k], 0))
      }
    }
    expect(rows).toBeGreaterThan(200)
    expect(batters).toBeGreaterThan(10)
    expect(pitchers).toBeGreaterThan(10)
  })

  // the share of a season and the games follow the standing given: here the function alone, with standings from far below to far above
  // those met in play, on real lives in their MLB years (a test of the function's edges, not a state the game reaches as such)
  it('at its edges: no games (one line, nothing in the record), a few games, a full season (at most 162 games for a batter)', () => {
    // one life of each kind of player that went to the MLB. No reliever did in 20,000 lives at ★10 (2026-10-23): the reliever is the
    // starter's life with the stamina of a reliever (careerSeason.ts proType), for this test of the function only
    const types = new Map<string, LifeState>()
    const kindOf = (s: LifeState) => (s.person.position !== 'P' ? 'batter' : (s.bb?.skills.stamina ?? 0) > -0.05 ? 'starter' : 'reliever')
    for (const s of lives) if (!types.has(kindOf(s))) types.set(kindOf(s), s)
    expect([...types.keys()].sort()).toEqual(['batter', 'starter'])
    const reliever = structuredClone(types.get('starter')!)
    reliever.bb!.skills.stamina = -0.5
    expect(kindOf(reliever)).toBe('reliever')
    types.set('reliever', reliever)
    let none = 0
    for (const [kind, life] of types) {
      for (const standing of [-8, -1.5, 0.5, 2, 8]) {
        const s = structuredClone(life)
        const before = structuredClone(s.bb!.rec!)
        const lines: string[] = []
        const c: EventCtx = { s, rng: real.makeRng(real.hashSeed(standing * 1000 + 7)), headless: true, add: (_k, t) => void lines.push(t), ask: () => {}, canAsk: () => false }
        s.age += 1 // a year after his last one (no row of this age yet)
        mlbSeason(c, standing, 9)
        const rec = s.bb!.rec!
        const added = rec.tournaments.filter((t) => t.age === s.age && t.level === 'mlb')
        expect(lines.length, `${kind} ${standing}`).toBe(1)
        expect(added.length, `${kind} ${standing}`).toBeLessThanOrEqual(1)
        if (!added.length) {
          none++
          expect(lines[0]).toContain('メジャーの試合には出場できませんでした')
          expect(rec).toEqual(before)
          continue
        }
        const l = added[0].line
        sane(l, `${kind} ${standing}`)
        expect(rec.official.mlb!.games).toBe((before.official.mlb?.games ?? 0) + l.games)
        expect(lines[0]).toMatch(/^メジャー9年目、MLBで\d+試合に(出場|登板)/)
        if (standing === -8) expect(l.games).toBeLessThanOrEqual(3)
        if (standing === 8) expect(l.games).toBeGreaterThanOrEqual(kind === 'batter' ? 150 : kind === 'starter' ? 30 : 60)
      }
    }
    // the lowest standing gives a year without games for every kind of player
    expect(none).toBeGreaterThanOrEqual(3)
  })
})
