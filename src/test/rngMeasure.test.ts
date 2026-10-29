import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type * as RngModule from '../engine/rng.ts'
import { makeCountingRng, newDrawLog, type DrawLog } from './countingRng.ts'

// Counting the draws of the random numbers, for tests only (the multilingual work, step 0-A): engine/rng.ts is replaced in this file
// alone (vi.mock) by a makeRng that hands out the real generator, or, while `ctl.log` is set, the counting copy (countingRng.ts).
// The game's code is not touched. Before the counts may be trusted: the copy gives the same numbers as the real one, call by call and
// state by state; whole lives are the same with and without it; and the counted lives match the fingerprints stored by
// scripts/fingerprint.ts, which were made without any of this.

const ctl = vi.hoisted(() => ({ log: null as DrawLog | null }))

vi.mock('../engine/rng.ts', async (importOriginal) => {
  const real = await importOriginal<typeof RngModule>()
  return { ...real, makeRng: (seed: number) => (ctl.log ? makeCountingRng(seed, real.hashSeed, ctl.log) : real.makeRng(seed)) }
})

import { createLife, endYear, isPlaying, planYear, resolveDecision, runHeadless, type Sim } from '../engine/life.ts'
import { defaultParams } from '../engine/params.ts'
import type { CountryCode } from '../data/types.ts'

const real = await vi.importActual<typeof RngModule>('../engine/rng.ts')
const COUNTRIES: CountryCode[] = ['JP', 'US', 'KR', 'CU']

/** runs `f` with the counting copy in place, and gives its result with the draws it made */
function counted<T>(f: () => T): { value: T; log: DrawLog } {
  ctl.log = newDrawLog()
  try {
    const value = f()
    return { value, log: ctl.log }
  } finally {
    ctl.log = null
  }
}

/** a life as on screen (おまかせ answers): every line with its time, every question whole, and the state at the end */
function screenLife(cc: CountryCode, seed: number): string {
  const sim: Sim = { params: defaultParams() }
  const s = createLife({ seed, country: cc, pace: 'p15' })
  const rec: unknown[] = []
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    rec.push(plan.events.map((e) => [e.at, e.entry]))
    let d = plan.decision?.decision
    while (d && s.alive) {
      rec.push(['D', d])
      const r = resolveDecision(s, d.autoIndex, sim)
      rec.push(r.events.map((e) => [e.at, e.entry]))
      d = r.followUp?.decision
    }
    endYear(s)
  }
  rec.push(s)
  return JSON.stringify(rec)
}

/** a life without a screen: the calibrated draws in order and the state at the end */
function headlessLife(cc: CountryCode, seed: number, potential = false): string {
  const tally: string[] = []
  const sim: Sim = { params: defaultParams(), headless: true, tally: (k, ok) => tally.push(`${k}${ok ? 1 : 0}`) }
  const s = runHeadless({ seed, country: cc, pace: 'p15', ...(potential ? { mode: 'potential' as const, stars: 9 } : {}) }, sim)
  return JSON.stringify([tally, s])
}

/** scripts/fingerprint.ts careerPrint, line for line (the script runs 100,000 lives when imported, so it is copied, not imported) */
function careerPrint(seed: number): string {
  const draws: string[] = []
  const sim: Sim = { params: defaultParams(), headless: true, tally: (k, ok) => draws.push(`${k}${ok ? 1 : 0}`) }
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    let d = plan.decision?.decision
    while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
    endYear(s)
    if (s.career.endedAge !== null && !isPlaying(s)) break
  }
  const c = s.career
  return [draws.join(','), c.highestRank, c.endedAge, c.achievements.join('/'), c.draftedFrom ?? '', c.proDebut, c.proSeasons, c.minorSeasons, s.timeline.map((t) => t.phase[0]).join('')].join('|')
}

describe('the counting copy of the random numbers', () => {
  it('gives the same numbers as engine/rng.ts for every kind of call, and the same state after each (seen through fork)', () => {
    const seeds = [0, 1, 2, 0x7fffffff, 0x80000000, 0xffffffff, ...Array.from({ length: 994 }, (_, i) => real.hashSeed(i + 9_200_000))]
    let calls = 0
    for (const seed of seeds) {
      const log = newDrawLog()
      const a = real.makeRng(seed)
      const b = makeCountingRng(seed, real.hashSeed, log)
      expect(b.seed).toBe(a.seed)
      // the script of calls comes from a third, separate generator, so both sides get the same calls
      const script = real.makeRng(seed ^ 0x5eed5eed)
      const same = (x: unknown, y: unknown, what: string) => expect(Object.is(x, y), `seed ${seed}, call ${calls}: ${what} ${String(x)} ≠ ${String(y)}`).toBe(true)
      for (let step = 0; step < 120; step++) {
        calls++
        const op = script.int(0, 6)
        if (op === 0) same(a.next(), b.next(), 'next')
        else if (op === 1) same(a.normal(), b.normal(), 'normal')
        else if (op === 2) {
          const lo = script.int(-50, 50)
          const hi = lo + script.int(0, 100)
          same(a.int(lo, hi), b.int(lo, hi), 'int')
        } else if (op === 3) {
          const p = [0, 1, 0.5, script.next()][script.int(0, 3)]
          same(a.chance(p), b.chance(p), 'chance')
        } else if (op === 4) {
          const items = Array.from({ length: script.int(1, 9) }, (_, i) => ({ i }))
          same(a.pick(items), b.pick(items), 'pick')
        } else if (op === 5) {
          const n = script.int(1, 8)
          const items = Array.from({ length: n }, (_, i) => ({ i }))
          const weights = Array.from({ length: n }, () => [0, 1, script.next() * 5][script.int(0, 2)])
          same(a.weighted(items, weights), b.weighted(items, weights), 'weighted')
        } else {
          const salt = script.int(0, 1_000_000)
          const fa = a.fork(salt)
          const fb = b.fork(salt)
          expect(fb.seed).toBe(fa.seed)
          for (let k = 0; k < 4; k++) same(fa.next(), fb.next(), 'next of a fork')
          same(fa.normal(), fb.normal(), 'normal of a fork')
        }
        // the state after the call: fork reads it without moving it, so equal forks mean the two have drawn the same number of times
        same(a.fork(1).next(), b.fork(1).next(), 'state')
        same(a.fork(987_654).next(), b.fork(987_654).next(), 'state')
      }
      // and the stream goes on the same after all of it
      for (let k = 0; k < 8; k++) same(a.next(), b.next(), 'next after the script')
    }
    expect(calls).toBe(seeds.length * 120)
  })

  it('counts each draw once: next, int, chance, pick and weighted one each; normal two, then none for its spare; fork none', () => {
    const log = newDrawLog()
    const b = makeCountingRng(42, real.hashSeed, log)
    const own = () => log.counts[0]
    b.next()
    b.int(1, 6)
    b.chance(0.5)
    b.pick([1, 2, 3])
    b.weighted([1, 2], [1, 1])
    expect(own()).toBe(5)
    b.normal()
    expect(own()).toBe(7)
    b.normal()
    expect(own()).toBe(7)
    const f = b.fork(3)
    expect(own()).toBe(7)
    expect(log.streams.length).toBe(2)
    f.next()
    expect(log.counts).toEqual([7, 1])
    expect(log.total).toBe(8)
  })
})

describe('whole lives with and without the counting', () => {
  it('on screen: the same lines at the same times, the same questions and the same state (4 countries × 3 seeds)', () => {
    for (const cc of COUNTRIES) {
      for (let i = 0; i < 3; i++) {
        const seed = real.hashSeed(i + 9_300_000)
        const plain = screenLife(cc, seed)
        const c = counted(() => screenLife(cc, seed))
        expect(c.value, `${cc} seed ${seed}`).toBe(plain)
        expect(c.log.total, `${cc} seed ${seed}: draws counted`).toBeGreaterThan(100)
        // the same life counted twice: the same draws, stream by stream, in the same order
        const again = counted(() => screenLife(cc, seed))
        expect(again.log, `${cc} seed ${seed}`).toEqual(c.log)
      }
    }
  })

  it('without a screen: the same calibrated draws in order and the same state (4 countries × 5 seeds, and 2 lives with ★)', () => {
    const cases: [CountryCode, number, boolean][] = []
    for (const cc of COUNTRIES) for (let i = 0; i < 5; i++) cases.push([cc, real.hashSeed(i + 9_310_000), false])
    for (let i = 0; i < 2; i++) cases.push(['JP', real.hashSeed(i + 9_320_000), true])
    for (const [cc, seed, potential] of cases) {
      const plain = headlessLife(cc, seed, potential)
      const c = counted(() => headlessLife(cc, seed, potential))
      expect(c.value, `${cc} seed ${seed}`).toBe(plain)
      const again = counted(() => headlessLife(cc, seed, potential))
      expect(again.log, `${cc} seed ${seed}`).toEqual(c.log)
    }
  })

  it('the counted lives give the fingerprints stored by scripts/fingerprint.ts (made without this file): the first 300', () => {
    const file = fileURLToPath(new URL('../../scripts/fingerprint-jp.txt', import.meta.url))
    const base = readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'))
    const N = 300
    let draws = 0
    for (let i = 0; i < N; i++) {
      const seed = real.hashSeed(i + 4_000_000)
      const c = counted(() => careerPrint(seed))
      draws += c.log.total
      expect(createHash('sha1').update(c.value).digest('hex').slice(0, 12), `#${i} seed ${seed}`).toBe(base[i])
    }
    expect(draws).toBeGreaterThan(N * 100)
  })
})
