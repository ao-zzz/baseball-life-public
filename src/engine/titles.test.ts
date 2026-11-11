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
import { HONOUR_ORDER, honourCounts, QUALIFY_OUTS, QUALIFY_PA } from './titles.ts'
import type { LifeConfig, LifeState } from './types.ts'

const sim: Sim = { params: defaultParams(), headless: true }
const config = (i: number, country: LifeConfig['country'] = 'JP'): LifeConfig => ({ seed: hashSeed(i + 4_000_000), country, pace: 'p15', mode: 'potential', stars: 10 })

/** the life without the honours: its lines by age (order within the year aside: the honours' lines take slots of the year), the
 * state without the log and without the record of honours */
function strip(s: LifeState) {
  const lines = new Map<number, string[]>()
  for (const e of s.log) if (!ctl.texts.has(e.text)) lines.set(e.age, [...(lines.get(e.age) ?? []), `${e.kind}|${e.text}`].sort())
  const rest = structuredClone({ ...s, log: [] }) as LifeState
  if (rest.bb?.rec) delete rest.bb.rec.honours
  return { lines: [...lines], rest }
}

describe('titles and big moments of an NPB season', () => {
  it('change nothing else in a life: the same lines, money, career and state without them', () => {
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
        if (h.id === 'era') expect(line!.outs).toBeGreaterThanOrEqual(QUALIFY_OUTS)
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

  it('are an NPB player’s only: none in the lives of the other countries', () => {
    ctl.off = false
    for (const country of ['US', 'KR', 'CU'] as const) {
      for (let i = 0; i < 15; i++) expect(runHeadless(config(i, country), sim).bb?.rec?.honours ?? []).toEqual([])
    }
  })
})
