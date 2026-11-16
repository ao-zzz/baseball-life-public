import { describe, expect, it, vi } from 'vitest'
import type * as TitlesModule from './titles.ts'
import type { EventCtx } from './events.ts'

// The personal titles and big moments of an NPB 1軍 season (titles.ts, called once a year from life.ts proYear). In this file alone
// (vi.mock) they can be switched off, which is the game before the change: the lives must be the same apart from the honours' own
// lines and record. Lives of the potential mode (★10) reach the 1軍 often enough to meet every kind of honour.

const ctl = vi.hoisted(() => ({ off: false, texts: new Set<string>() }))

vi.mock('./titles.ts', async (importOriginal) => {
  const real = await importOriginal<typeof TitlesModule>()
  return {
    ...real,
    seasonHonours: (c: EventCtx, released: boolean) => {
      if (ctl.off) return
      const add: EventCtx['add'] = (kind, text, opts) => {
        ctl.texts.add(text)
        c.add(kind, text, opts)
      }
      real.seasonHonours({ ...c, add }, released)
    },
  }
})

import { runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { firstAmong, HONOUR_ORDER, honourCounts, QUALIFY_OUTS, QUALIFY_PA, shareBelow, SP_QUAL_OUTS } from './titles.ts'
import leaders from '../data/npb-leaders.json' with { type: 'json' }
import rivals from '../data/title-rivals.json' with { type: 'json' }
import type { LifeConfig, LifeState } from './types.ts'

const sim: Sim = { params: defaultParams(), headless: true }
const config = (i: number, country: LifeConfig['country'] = 'JP'): LifeConfig => ({ seed: hashSeed(i + 4_000_000), country, pace: 'p15', mode: 'potential', stars: 10 })

/**
 * the life without the honours: its lines by age (order within the year aside: the honours' lines take slots of the year), and the
 * state without the log, the record of honours and the record of the events met. The honours feed one thing on purpose: the people a
 * known pro meets (lifeLoveEvents.ts celebShare, honourPoints, 1.9.0), so the everyday-life events of the playing years (category
 * life…, answered おまかせ with a line and no change of state) may come in other years; their lines are left out here.
 */
function strip(s: LifeState) {
  const lines = new Map<number, string[]>()
  for (const e of s.log) if (!ctl.texts.has(e.text) && !e.category?.startsWith('life')) lines.set(e.age, [...(lines.get(e.age) ?? []), `${e.kind}|${e.text}`].sort())
  const rest = structuredClone({ ...s, log: [], evHist: undefined, taken: [], flags: undefined }) as LifeState
  if (rest.bb?.rec) delete rest.bb.rec.honours
  return { lines: [...lines], rest }
}

describe('titles and big moments of an NPB season', () => {
  it('change nothing else in a life but the people he meets: the same lines, money, career and state without them', () => {
    let met = 0
    for (let i = 0; i < 40; i++) {
      ctl.off = false
      const on = runHeadless(config(i), sim)
      ctl.off = true
      const off = runHeadless(config(i), sim)
      met += on.bb?.rec?.honours?.length ?? 0
      expect(strip(on)).toEqual(strip(off))
    }
    expect(met).toBeGreaterThan(0)
  })

  it('belong to 1軍 seasons only, and a title is earned by the season it names', () => {
    ctl.off = false
    const seen = new Set<string>()
    for (let i = 0; i < 150; i++) {
      const s = runHeadless(config(i), sim)
      const rows = s.bb?.rec?.tournaments ?? []
      for (const h of s.bb?.rec?.honours ?? []) {
        seen.add(h.id)
        const line = rows.find((t) => t.age === h.age && t.level === 'pro')?.line
        expect(line?.games).toBeGreaterThan(0)
        if (h.id === 'avg') expect(line!.pa).toBeGreaterThanOrEqual(QUALIFY_PA)
        // (the ERA title's 規定投球回 is the game's own scale: SP_QUAL_OUTS, below NPB's 143 innings)
        if (h.id === 'era') expect(line!.outs).toBeGreaterThanOrEqual(SP_QUAL_OUTS)
        if (h.id === 'nohit' || h.id === 'perfect' || h.id === 'w' || h.id === 'era' || h.id === 'k') expect(s.person.position).toBe('P')
        if (['avg', 'hr', 'rbi', 'sb', 'h'].includes(h.id)) expect(s.person.position).not.toBe('P')
      }
      // one 新人王 at most; a 日本一 is a Japan Series of that year
      const hs = s.bb?.rec?.honours ?? []
      expect(hs.filter((h) => h.id === 'rookie').length).toBeLessThanOrEqual(1)
      for (const h of hs.filter((x) => x.id === 'champion')) expect(hs.some((x) => x.id === 'jseries' && x.age === h.age)).toBe(true)
      // the counts shown on the result screen add up to the record
      expect(honourCounts(s).reduce((a, [, n]) => a + n, 0)).toBe(hs.length)
    }
    // the common ones are met (the rare titles are measured by scripts/titlestats.ts)
    for (const id of ['jseries', 'champion', 'allstar', 'best9', 'w'] as const) expect(seen.has(id)).toBe(true)
    expect([...seen].every((id) => (HONOUR_ORDER as string[]).includes(id))).toBe(true)
  })

  it('a title is first place among the league’s qualified players: one in K over the rivals themselves (2026-11-16)', () => {
    // the real numbers of qualified players: every season of both leagues, in the range of NPB's tables
    expect(leaders.rows).toHaveLength(20)
    for (const r of leaders.rows) {
      expect(r.qualB).toBeGreaterThanOrEqual(15)
      expect(r.qualB).toBeLessThanOrEqual(40)
      expect(r.qualP).toBeGreaterThanOrEqual(4)
      expect(r.qualP).toBeLessThanOrEqual(20)
    }
    // the rivals: enough seasons of the game's players, and the game's 規定投球回 below NPB's
    expect(rivals.meta.seasons.bat).toBeGreaterThan(1000)
    expect(rivals.meta.seasons.sp).toBeGreaterThan(300)
    expect(SP_QUAL_OUTS).toBeGreaterThan(200)
    expect(SP_QUAL_OUTS).toBeLessThan(QUALIFY_OUTS)
    // over the pool itself, F(x)^(K−1) averages about 1/K (ties counted half), and a better season has the better chance
    const pools = rivals.pools as unknown as Record<string, Record<string, [number, number][]>>
    for (const [pool, stat, k, lower] of [['bat', 'hr', 26, false], ['bat', 'avg', 26, false], ['sp', 'w', 11, false], ['sp', 'era', 11, true]] as const) {
      const h = pools[pool][stat]
      const n = h.reduce((a, [, c]) => a + c, 0)
      const mean = h.reduce((a, [v, c]) => a + c * firstAmong(pool, stat, v, k, lower), 0) / n
      expect(mean, `${pool}.${stat}`).toBeGreaterThan(0.4 / k)
      expect(mean, `${pool}.${stat}`).toBeLessThan(1.6 / k)
      const [lo, hi] = lower ? [h.at(-1)![0], h[0][0]] : [h[0][0], h.at(-1)![0]]
      expect(firstAmong(pool, stat, hi, k, lower)).toBeGreaterThan(firstAmong(pool, stat, lo, k, lower))
    }
    expect(shareBelow([[1, 1], [2, 2], [3, 1]], 2)).toBeCloseTo(0.5)
    expect(shareBelow([[1, 1], [2, 2], [3, 1]], 2, true)).toBeCloseTo(0.5)
    expect(shareBelow([[1, 1], [2, 2], [3, 1]], 3)).toBeCloseTo(0.875)
  })

  it('are an NPB player’s only: none in the lives of the other countries', () => {
    ctl.off = false
    for (const country of ['US', 'KR', 'CU'] as const) {
      for (let i = 0; i < 15; i++) expect(runHeadless(config(i, country), sim).bb?.rec?.honours ?? []).toEqual([])
    }
  })
})
